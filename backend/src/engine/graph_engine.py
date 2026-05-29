"""
Модуль движка обработки графов диалогов.
Содержит модели данных и логику для выполнения визуальных новелл.
"""
from typing import Dict, List, Any, Optional, Set, Tuple
from pydantic import BaseModel, Field, validator
from enum import Enum
import hashlib
import json
import networkx as nx
from datetime import datetime

from src.logger import setup_logger

logger = setup_logger(__name__, 'graph_engine.log')


class TargetType(str, Enum):
    """Тип перехода при выборе опции."""
    NODE = "node"
    NEXT_SCENE = "next_scene"
    NOVEL_END = "novel_end"


class NodeOption(BaseModel):
    """Вариант ответа в узле диалога."""
    id: str
    text: str
    target_type: TargetType
    target_node_id: Optional[str] = None
    points: int = 0

    class Config:
        frozen = True


class DialogueNodeData(BaseModel):
    """
    Содержимое узла диалога.
    Включает текст, персонажа, спрайт, музыку и фон узла.
    """
    character_name: str = ""
    text: str = ""
    sprite_file: str = ""
    music_file: str = ""
    is_start: bool = False
    loop_music: bool = False
    background_url: str = ""
    options: List[NodeOption] = []

    def deduplicate_options(self) -> 'DialogueNodeData':
        """Удаляет дублирующиеся опции."""
        seen_ids = set()
        unique_options = []
        for opt in self.options:
            if opt.id not in seen_ids:
                seen_ids.add(opt.id)
                unique_options.append(opt)

        return DialogueNodeData(
            character_name=self.character_name,
            text=self.text,
            sprite_file=self.sprite_file,
            music_file=self.music_file,
            is_start=self.is_start,
            loop_music=self.loop_music,
            background_url=self.background_url,
            options=unique_options
        )


class NodePosition(BaseModel):
    """Координаты узла на холсте редактора."""
    x: float
    y: float


class SceneNode(BaseModel):
    """Узел графа сцены."""
    id: str
    type: str = "dialogue"
    position: NodePosition
    data: DialogueNodeData
    width: Optional[float] = None
    height: Optional[float] = None

    def deduplicate_options(self) -> 'SceneNode':
        """Создаёт копию узла с уникальными опциями."""
        return SceneNode(
            id=self.id,
            type=self.type,
            position=self.position,
            data=self.data.deduplicate_options(),
            width=self.width,
            height=self.height
        )


class SceneEdge(BaseModel):
    """Связь между узлами графа."""
    id: str
    source: str
    source_handle: str
    target: str


class SceneGraph(BaseModel):
    """Полный граф сцены, содержащий узлы и связи между ними."""
    id: int
    name: str
    background_url: Optional[str] = None
    nodes: List[SceneNode]
    edges: List[SceneEdge]

    _graph: Optional[nx.DiGraph] = None
    _option_map: Dict[str, Dict[str, str]] = {}

    class Config:
        arbitrary_types_allowed = True

    @validator('edges')
    def validate_edges(cls, v, values):
        """Проверяет, что все связи ссылаются на существующие узлы."""
        if 'nodes' not in values:
            return v

        node_ids = {node.id for node in values['nodes']}
        for edge in v:
            if edge.source not in node_ids:
                raise ValueError(f"Связь {edge.id} ссылается на несуществующий узел-источник {edge.source}")
            if edge.target not in node_ids:
                raise ValueError(f"Связь {edge.id} ссылается на несуществующий узел-цель {edge.target}")
        return v

    def deduplicate_all_options(self) -> 'SceneGraph':
        """Удаляет дубликаты опций во всех узлах графа."""
        deduped_nodes = [node.deduplicate_options() for node in self.nodes]
        return SceneGraph(
            id=self.id,
            name=self.name,
            background_url=self.background_url,
            nodes=deduped_nodes,
            edges=self.edges
        )

    def build_graph(self) -> nx.DiGraph:
        """Строит направленный граф из узлов и связей с помощью NetworkX."""
        if self._graph is not None:
            return self._graph

        G = nx.DiGraph()
        self._option_map = {}

        for node in self.nodes:
            G.add_node(node.id, data=node)
            self._option_map[node.id] = {}
            for opt in node.data.options:
                if opt.target_type == TargetType.NODE and opt.target_node_id:
                    self._option_map[node.id][opt.id] = opt.target_node_id

        for edge in self.edges:
            G.add_edge(edge.source, edge.target, id=edge.id, handle=edge.source_handle)

        self._graph = G
        return G

    def get_node_by_id(self, node_id: str) -> Optional[SceneNode]:
        """Возвращает узел по его идентификатору."""
        for node in self.nodes:
            if node.id == node_id:
                return node
        return None

    def get_start_node(self) -> Optional[SceneNode]:
        """
        Определяет стартовый узел сцены.
        Приоритет: узел с флагом is_start, затем узел без входящих связей,
        затем первый узел в списке.
        """
        if not self.nodes:
            return None

        for node in self.nodes:
            if node.data.is_start:
                logger.debug(f"Стартовый узел найден по флагу is_start: {node.id}")
                return node

        if self.edges:
            G = self.build_graph()
            sources = [n for n in G.nodes() if G.in_degree(n) == 0]
            if sources:
                logger.debug(f"Стартовый узел найден по отсутствию входящих связей: {sources[0]}")
                return self.get_node_by_id(sources[0])

        logger.debug(f"Используем первый узел как стартовый: {self.nodes[0].id}")
        return self.nodes[0]

    def get_option_target(self, node_id: str, option_id: str) -> Optional[str]:
        """
        Определяет целевой узел для выбранной опции.
        Сначала проверяет target_node_id в самой опции,
        затем ищет подходящую связь по source_handle.
        """
        node = self.get_node_by_id(node_id)

        if node:
            for opt in node.data.options:
                if opt.id == option_id:
                    if opt.target_node_id:
                        logger.debug(f"Цель из target_node_id опции: {opt.target_node_id}")
                        return opt.target_node_id
                    break

        if self.edges:
            G = self.build_graph()

            for _, target, data in G.out_edges(node_id, data=True):
                handle = data.get('handle', '')

                logger.debug(f"Проверка связи: источник={node_id}, цель={target}, handle='{handle}', option_id='{option_id}'")

                if handle == option_id:
                    logger.debug(f"Точное совпадение handle, цель: {target}")
                    return target

                if handle.startswith('opt-'):
                    cleaned = handle[4:]
                    if cleaned == option_id:
                        logger.debug(f"Совпадение после удаления префикса 'opt-', цель: {target}")
                        return target

                if handle.startswith('opt-opt-'):
                    cleaned = handle[8:]
                    if cleaned == option_id:
                        logger.debug(f"Совпадение после удаления префикса 'opt-opt-', цель: {target}")
                        return target

        if node:
            for opt in node.data.options:
                if opt.id == option_id:
                    if opt.target_type in (TargetType.NEXT_SCENE, TargetType.NOVEL_END):
                        logger.debug(f"Опция имеет target_type={opt.target_type}, целевой узел не требуется")
                        return None
                    break

        logger.warning(f"Цель не найдена для опции '{option_id}' в узле '{node_id}'")
        return None

    def validate_graph(self) -> Tuple[bool, List[str]]:
        """
        Проверяет корректность графа.
        Возвращает кортеж (валиден, список ошибок).
        """
        errors = []

        if not self.nodes:
            return True, ["Сцена не содержит узлов"]

        for node in self.nodes:
            seen = set()
            for opt in node.data.options:
                if opt.id in seen:
                    errors.append(f"Дублируется опция {opt.id} в узле {node.id}")
                seen.add(opt.id)

        G = self.build_graph()
        start_node = self.get_start_node()

        if not start_node:
            errors.append("Не удалось определить стартовый узел")
        elif len(self.nodes) > 1:
            reachable = set(nx.descendants(G, start_node.id))
            reachable.add(start_node.id)
            unreachable = set(G.nodes()) - reachable
            if unreachable:
                errors.append(f"Обнаружены недостижимые узлы: {', '.join(unreachable)}")

        for node in self.nodes:
            for opt in node.data.options:
                if opt.target_type == TargetType.NODE:
                    target = self.get_option_target(node.id, opt.id)
                    if not target and not opt.target_node_id:
                        errors.append(
                            f"Опция '{opt.text}' в узле {node.id} не ведёт к существующему узлу"
                        )

        return len(errors) == 0, errors


class NodeCache:
    """Кэш результатов выполнения узлов для оптимизации повторных рендеров."""

    def __init__(self):
        self._cache: Dict[str, Any] = {}

    def _hash_node(self, node: SceneNode) -> str:
        """Создаёт уникальный хеш на основе содержимого узла."""
        data = {
            'character_name': node.data.character_name,
            'text': node.data.text,
            'sprite_file': node.data.sprite_file,
            'music_file': node.data.music_file,
            'background_url': node.data.background_url,
            'options': [
                {
                    'id': opt.id,
                    'text': opt.text,
                    'target_type': opt.target_type,
                    'points': opt.points
                }
                for opt in node.data.options
            ]
        }
        content = json.dumps(data, sort_keys=True)
        return hashlib.md5(content.encode()).hexdigest()

    def get(self, node: SceneNode) -> Optional[Any]:
        """Извлекает результат из кэша по узлу."""
        return self._cache.get(self._hash_node(node))

    def set(self, node: SceneNode, result: Any):
        """Сохраняет результат выполнения узла в кэш."""
        self._cache[self._hash_node(node)] = result

    def clear(self):
        """Очищает кэш."""
        self._cache.clear()


class ExecutionContext:
    """Контекст выполнения сцены, хранит баллы, ответы и переменные."""

    def __init__(self, project_id: int, scene_id: int):
        self.project_id = project_id
        self.scene_id = scene_id
        self.variables: Dict[str, Any] = {}
        self.total_points: int = 0
        self.visited_nodes: List[str] = []
        self.answers: List[Dict] = []
        self.processed_options: Set[str] = set()

    def add_answer(self, node_id: str, option: NodeOption):
        """
        Добавляет ответ пользователя в историю.
        Проверяет дубликаты по комбинации node_id и option_id.
        """
        option_key = f"{node_id}:{option.id}"

        if option_key in self.processed_options:
            logger.debug(f"Пропущен дублирующийся ответ: {option_key}")
            return

        self.processed_options.add(option_key)
        self.answers.append({
            'node_id': node_id,
            'option_id': option.id,
            'text': option.text,
            'points': option.points,
            'timestamp': datetime.utcnow().isoformat()
        })
        self.visited_nodes.append(node_id)
        self.total_points += option.points

        logger.debug(
            f"Добавлен ответ: '{option.text}' (+{option.points} баллов), "
            f"всего ответов: {len(self.answers)}, "
            f"всего баллов: {self.total_points}"
        )

    def set_variable(self, name: str, value: Any):
        """Сохраняет переменную контекста."""
        self.variables[name] = value

    def get_variable(self, name: str, default: Any = None) -> Any:
        """Извлекает значение переменной контекста."""
        return self.variables.get(name, default)

    def to_dict(self) -> Dict:
        """Преобразует контекст в словарь для передачи на фронтенд."""
        return {
            'total_points': self.total_points,
            'visited_nodes': self.visited_nodes,
            'answers': self.answers,
            'variables': self.variables
        }

    @classmethod
    def from_dict(cls, data: Dict, project_id: int, scene_id: int) -> 'ExecutionContext':
        """
        Восстанавливает контекст выполнения из словаря.
        Используется при продолжении прохождения с сохранённого места.
        """
        context = cls(project_id, scene_id)
        context.total_points = data.get('total_points', 0)
        context.visited_nodes = data.get('visited_nodes', [])
        context.answers = data.get('answers', [])
        context.variables = data.get('variables', {})

        for answer in context.answers:
            node_id = answer.get('node_id', '')
            option_id = answer.get('option_id', '')
            if node_id and option_id:
                option_key = f"{node_id}:{option_id}"
                context.processed_options.add(option_key)

        logger.debug(
            f"Контекст восстановлен: {len(context.answers)} ответов, "
            f"{context.total_points} баллов, "
            f"{len(context.processed_options)} обработанных опций"
        )
        return context


class GraphExecutionEngine:
    """Движок выполнения диалогов визуальной новеллы."""

    def __init__(self):
        self.cache = NodeCache()

    def execute_node(self, node: SceneNode, context: ExecutionContext) -> Dict:
        """
        Подготавливает узел для отображения на фронтенде.
        Возвращает словарь с текстом, персонажем, спрайтом, музыкой,
        фоном узла и вариантами ответов.
        """
        cached = self.cache.get(node)
        if cached:
            logger.debug(f"Использован кэшированный узел: {node.id}")
            return cached

        unique_options = []
        seen = set()
        for opt in node.data.options:
            if opt.id not in seen:
                seen.add(opt.id)
                unique_options.append(opt)

        result = {
            'id': node.id,
            'character_name': node.data.character_name,
            'text': node.data.text,
            'sprite_file': node.data.sprite_file,
            'music_file': node.data.music_file,
            'loopMusic': node.data.loop_music,
            'is_start': node.data.is_start,
            'background_url': node.data.background_url,
            'options': [
                {
                    'id': opt.id,
                    'text': opt.text,
                    'target_type': opt.target_type,
                    'points': opt.points
                }
                for opt in unique_options
            ]
        }

        self.cache.set(node, result)
        logger.debug(f"Узел выполнен: {node.id}, loopMusic: {result['loopMusic']}, background_url: {result['background_url']}")
        return result

    def traverse_graph(self, graph: SceneGraph, context: ExecutionContext,
                       start_node_id: Optional[str] = None) -> Dict:
        """
        Обходит граф, начиная с указанного или стартового узла,
        и возвращает состояние для отображения.
        """
        graph = graph.deduplicate_all_options()

        if not graph.nodes:
            logger.warning("Сцена не содержит узлов")
            return {
                'error': 'Сцена не содержит узлов',
                'status': 'empty',
                'current_node': None,
                'context': context.to_dict(),
                'has_options': False,
                'has_paths': False
            }

        if start_node_id:
            logger.info(f"Начинаем с указанного узла: {start_node_id}")
            current = graph.get_node_by_id(start_node_id)
            if not current:
                logger.warning(f"Указанный стартовый узел не найден: {start_node_id}, используется стандартный")
                current = graph.get_start_node()
        else:
            logger.debug("Начинаем со стандартного стартового узла")
            current = graph.get_start_node()

        if not current:
            logger.error("Стартовый узел не найден")
            return {
                'error': 'Стартовый узел не найден',
                'status': 'error',
                'current_node': None,
                'context': context.to_dict(),
                'has_options': False,
                'has_paths': False
            }

        logger.info(f"Выполнение узла: {current.id} (is_start={current.data.is_start}, опций: {len(current.data.options)})")

        node_state = self.execute_node(current, context)

        is_valid, errors = graph.validate_graph()

        has_paths = False

        if graph.edges:
            G = graph.build_graph()
            out_edges = list(G.out_edges(current.id))
            if out_edges:
                has_paths = True

        if not has_paths:
            for opt in current.data.options:
                if opt.target_type in (TargetType.NEXT_SCENE, TargetType.NOVEL_END):
                    has_paths = True
                    break
                if opt.target_type == TargetType.NODE:
                    if opt.target_node_id:
                        has_paths = True
                        break
                    target = graph.get_option_target(current.id, opt.id)
                    if target:
                        has_paths = True
                        break

        result = {
            'current_node': node_state,
            'context': context.to_dict(),
            'has_options': len(current.data.options) > 0,
            'has_paths': has_paths,
            'status': 'active' if has_paths else 'end',
            'validation_errors': errors if not is_valid else []
        }

        logger.info(f"Результат обхода: status={result['status']}, has_options={result['has_options']}, has_paths={result['has_paths']}")

        return result

    def select_option(self, graph: SceneGraph, context: ExecutionContext,
                      node_id: str, option_id: str) -> Dict:
        """
        Обрабатывает выбор варианта ответа пользователем.
        Возвращает действие: переход к узлу, следующей сцене или завершение.
        """
        graph = graph.deduplicate_all_options()

        node = graph.get_node_by_id(node_id)
        if not node:
            logger.error(f"Узел не найден: {node_id}")
            return {'error': 'Узел не найден', 'status': 'error'}

        selected = None
        seen = set()
        for opt in node.data.options:
            if opt.id not in seen:
                seen.add(opt.id)
                if opt.id == option_id:
                    selected = opt
                    break

        if not selected:
            logger.error(f"Опция не найдена: {option_id} в узле {node_id}")
            return {'error': 'Опция не найдена', 'status': 'error'}

        context.add_answer(node_id, selected)
        logger.info(f"Выбрана опция: '{selected.text}' (+{selected.points} баллов, target_type={selected.target_type})")

        if selected.target_type == TargetType.NOVEL_END:
            logger.info("Цель: NOVEL_END")
            return {
                'action': 'end',
                'message': 'Завершение новеллы',
                'context': context.to_dict()
            }

        if selected.target_type == TargetType.NEXT_SCENE:
            logger.info("Цель: NEXT_SCENE")
            return {
                'action': 'next_scene',
                'message': 'Переход к следующей сцене',
                'context': context.to_dict()
            }

        if selected.target_type == TargetType.NODE:
            target = graph.get_option_target(node_id, option_id)

            if not target:
                target = selected.target_node_id
                logger.debug(f"Используем target_node_id из опции: {target}")

            if target:
                target_node = graph.get_node_by_id(target)
                if target_node:
                    logger.info(f"Цель: NODE -> {target}")
                    return {
                        'action': 'node',
                        'target_node_id': target,
                        'context': context.to_dict()
                    }
                else:
                    logger.warning(f"Целевой узел не найден: {target}")
                    return {
                        'action': 'end',
                        'message': f'Целевой узел "{target}" не найден',
                        'context': context.to_dict()
                    }

            logger.warning(f"Цель не найдена для опции '{option_id}' в узле '{node_id}', завершаем сцену")
            return {
                'action': 'end',
                'message': 'Путь не найден',
                'context': context.to_dict()
            }

        logger.error(f"Неизвестный тип цели: {selected.target_type}")
        return {'error': 'Неизвестный тип опции', 'status': 'error'}


class GraphFactory:
    """Фабрика для создания графов из разных источников данных."""

    @staticmethod
    def from_reactflow(scene_data: dict) -> SceneGraph:
        """Создаёт граф из данных формата React Flow."""
        logger.debug(f"Создание графа из данных React Flow: {scene_data.get('name', 'Без названия')}")

        nodes = []
        for node in scene_data.get('nodes', []):
            options_dict = {}
            for opt in node['data'].get('options', []):
                if opt['id'] not in options_dict:
                    options_dict[opt['id']] = NodeOption(
                        id=opt['id'],
                        text=opt['text'],
                        target_type=opt.get('targetType', 'node'),
                        target_node_id=opt.get('targetNodeId'),
                        points=opt.get('points', 0)
                    )

            scene_node = SceneNode(
                id=node['id'],
                type=node.get('type', 'dialogue'),
                position=NodePosition(
                    x=node['position']['x'],
                    y=node['position']['y']
                ),
                data=DialogueNodeData(
                    character_name=node['data'].get('characterName', ''),
                    text=node['data'].get('text', ''),
                    sprite_file=node['data'].get('spriteFile', ''),
                    music_file=node['data'].get('musicFile', ''),
                    is_start=node['data'].get('isStart', False),
                    loop_music=node['data'].get('loopMusic', False) == True,
                    background_url=node['data'].get('backgroundUrl', ''),
                    options=list(options_dict.values())
                ),
                width=node.get('width'),
                height=node.get('height')
            )
            nodes.append(scene_node)

        edges = [
            SceneEdge(
                id=edge['id'],
                source=edge['source'],
                source_handle=edge['sourceHandle'],
                target=edge['target']
            )
            for edge in scene_data.get('edges', [])
        ]

        graph = SceneGraph(
            id=scene_data['id'],
            name=scene_data['name'],
            background_url=scene_data.get('background_url'),
            nodes=nodes,
            edges=edges
        )

        logger.debug(f"Граф создан: {len(nodes)} узлов, {len(edges)} связей")

        for node in nodes:
            for opt in node.data.options:
                logger.debug(f"  Узел '{node.id}' опция '{opt.id}' -> target_type={opt.target_type}, target_node_id={opt.target_node_id}")
        for edge in edges:
            logger.debug(f"  Связь '{edge.id}': {edge.source}[{edge.source_handle}] -> {edge.target}")

        return graph.deduplicate_all_options()

    @staticmethod
    def from_db(scene_record, nodes_records, edges_records, options_records) -> SceneGraph:
        """Создаёт граф из записей базы данных."""
        logger.debug(f"Создание графа из БД: scene_id={scene_record.id}")

        options_by_node = {}
        for opt in options_records:
            if opt.node_uuid not in options_by_node:
                options_by_node[opt.node_uuid] = {}
            options_by_node[opt.node_uuid][opt.option_uuid] = NodeOption(
                id=opt.option_uuid,
                text=opt.option_text,
                target_type=opt.target_type,
                target_node_id=opt.target_node_uuid,
                points=opt.points
            )

        nodes = []
        for node in nodes_records:
            node_options = list(options_by_node.get(node.node_uuid, {}).values())
            scene_node = SceneNode(
                id=node.node_uuid,
                type='dialogue',
                position=NodePosition(
                    x=node.position_x or 0,
                    y=node.position_y or 0
                ),
                data=DialogueNodeData(
                    character_name=node.character_name or '',
                    text=node.text or '',
                    sprite_file=node.sprite_file or '',
                    music_file=node.music_file or '',
                    is_start=node.is_start or False,
                    loop_music=bool(node.loop_music) if node.loop_music is not None else False,
                    background_url=node.background_url or '',
                    options=node_options
                ),
                width=node.width,
                height=node.height
            )
            nodes.append(scene_node)

        edges = [
            SceneEdge(
                id=edge.edge_uuid,
                source=edge.source_node_uuid,
                source_handle=edge.source_handle,
                target=edge.target_node_uuid
            )
            for edge in edges_records
        ]

        graph = SceneGraph(
            id=scene_record.id,
            name=scene_record.name,
            background_url=scene_record.background_url,
            nodes=nodes,
            edges=edges
        )

        logger.debug(f"Граф из БД: {len(nodes)} узлов, {len(edges)} связей")
        return graph.deduplicate_all_options()