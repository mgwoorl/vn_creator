"""
Асинхронные CRUD операции для работы со сценами.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path

from src.scenes import models, schemas


def get_background_type_from_url(url: str) -> str:
    """Определяет тип фона (изображение или видео) по расширению файла."""
    if not url:
        return "image"
    if url.lower().endswith('.mp4'):
        return "video"
    return "image"


async def get_scene(
    db: AsyncSession,
    scene_id: int
) -> Optional[models.Scene]:
    """Возвращает сцену по её идентификатору."""
    query = await db.execute(
        select(models.Scene).where(models.Scene.id == scene_id)
    )
    return query.scalar_one_or_none()


async def get_project_scenes(
    db: AsyncSession,
    project_id: int
) -> List[models.Scene]:
    """Возвращает все сцены проекта, отсортированные по порядку."""
    query = await db.execute(
        select(models.Scene)
        .where(models.Scene.project_id == project_id)
        .order_by(models.Scene.order_index)
    )
    return query.scalars().all()


async def create_scene(
    db: AsyncSession,
    project_id: int,
    name: str = "Новая сцена"
) -> models.Scene:
    """Создаёт новую сцену в проекте."""
    # Получаем количество существующих сцен для order_index
    scenes_query = await db.execute(
        select(models.Scene)
        .where(models.Scene.project_id == project_id)
    )
    max_order = len(scenes_query.scalars().all())

    db_scene = models.Scene(
        project_id=project_id,
        name=name,
        order_index=max_order
    )
    db.add(db_scene)
    await db.commit()
    await db.refresh(db_scene)
    return db_scene


async def update_scene(
    db: AsyncSession,
    scene_id: int,
    scene_update: schemas.SceneUpdate
) -> Optional[models.Scene]:
    """Обновляет основные поля сцены."""
    db_scene = await get_scene(db, scene_id)
    if not db_scene:
        return None

    update_data = scene_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(db_scene, field):
            setattr(db_scene, field, value)

    db_scene.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(db_scene)
    return db_scene


async def delete_scene(db: AsyncSession, scene_id: int) -> bool:
    """Удаляет сцену и все связанные с ней узлы, опции и связи."""
    db_scene = await get_scene(db, scene_id)
    if not db_scene:
        return False

    await db.delete(db_scene)
    await db.commit()
    return True


async def get_nodes_by_scene(
    db: AsyncSession,
    scene_id: int
) -> List[models.SceneNode]:
    """Возвращает все узлы указанной сцены."""
    query = await db.execute(
        select(models.SceneNode)
        .where(models.SceneNode.scene_id == scene_id)
    )
    return query.scalars().all()


async def get_node_by_uuid(
    db: AsyncSession,
    node_uuid: str
) -> Optional[models.SceneNode]:
    """Возвращает узел по его уникальному идентификатору."""
    query = await db.execute(
        select(models.SceneNode)
        .where(models.SceneNode.node_uuid == node_uuid)
    )
    return query.scalar_one_or_none()


async def get_options_by_node(
    db: AsyncSession,
    node_uuid: str
) -> List[models.NodeOption]:
    """Возвращает все варианты ответов для указанного узла."""
    query = await db.execute(
        select(models.NodeOption)
        .where(models.NodeOption.node_uuid == node_uuid)
        .order_by(models.NodeOption.sort_order)
    )
    return query.scalars().all()


async def get_edges_by_scene(
    db: AsyncSession,
    scene_id: int
) -> List[models.SceneEdge]:
    """Возвращает все связи между узлами указанной сцены."""
    query = await db.execute(
        select(models.SceneEdge)
        .where(models.SceneEdge.scene_id == scene_id)
    )
    return query.scalars().all()


async def delete_node(db: AsyncSession, node_uuid: str) -> bool:
    """Удаляет узел и все связанные с ним опции."""
    db_node = await get_node_by_uuid(db, node_uuid)
    if not db_node:
        return False

    await db.delete(db_node)
    await db.commit()
    return True


async def delete_option(db: AsyncSession, option_uuid: str) -> bool:
    """Удаляет вариант ответа по его идентификатору."""
    query = await db.execute(
        select(models.NodeOption)
        .where(models.NodeOption.option_uuid == option_uuid)
    )
    db_option = query.scalar_one_or_none()
    
    if not db_option:
        return False

    await db.delete(db_option)
    await db.commit()
    return True


async def delete_edges_by_node(
    db: AsyncSession,
    node_uuid: str,
    scene_id: int
) -> int:
    """Удаляет все связи, связанные с указанным узлом."""
    query = await db.execute(
        select(models.SceneEdge).where(
            (models.SceneEdge.source_node_uuid == node_uuid) |
            (models.SceneEdge.target_node_uuid == node_uuid),
            models.SceneEdge.scene_id == scene_id
        )
    )
    edges = query.scalars().all()

    count = len(edges)
    for edge in edges:
        await db.delete(edge)

    await db.commit()
    return count


def convert_reactflow_to_db(scene_id: int, reactflow_data: dict) -> dict:
    """
    Преобразует данные из формата React Flow в структуры для сохранения в БД.
    Возвращает словарь с ключами: nodes, options, edges.
    Синхронная функция, так как работает только с данными.
    """
    result = {
        'nodes': [],
        'options': [],
        'edges': []
    }

    for node in reactflow_data.get('nodes', []):
        db_node = {
            'scene_id': scene_id,
            'node_uuid': node['id'],
            'position_x': node['position']['x'],
            'position_y': node['position']['y'],
            'width': node.get('width'),
            'height': node.get('height'),
            'character_name': node['data'].get('characterName'),
            'text': node['data'].get('text'),
            'sprite_file': node['data'].get('spriteFile'),
            'music_file': node['data'].get('musicFile'),
            'loop_music': node['data'].get('loopMusic', False) == True,
            'is_start': node['data'].get('isStart', False) == True,
            'background_url': node['data'].get('backgroundUrl')
        }
        result['nodes'].append(db_node)

        for idx, opt in enumerate(node['data'].get('options', [])):
            db_option = {
                'node_uuid': node['id'],
                'option_uuid': opt['id'],
                'option_text': opt['text'],
                'target_type': opt.get('targetType', 'node'),
                'target_node_uuid': opt.get('targetNodeId'),
                'points': opt.get('points', 0),
                'sort_order': idx
            }
            result['options'].append(db_option)

    for edge in reactflow_data.get('edges', []):
        db_edge = {
            'scene_id': scene_id,
            'edge_uuid': edge['id'],
            'source_node_uuid': edge['source'],
            'source_handle': edge['sourceHandle'],
            'target_node_uuid': edge['target']
        }
        result['edges'].append(db_edge)

    return result


def convert_db_to_reactflow(
    scene: models.Scene,
    nodes: List[models.SceneNode],
    edges: List[models.SceneEdge],
    options: List[models.NodeOption]
) -> dict:
    """
    Преобразует данные из БД в формат React Flow для отображения в редакторе.
    Синхронная функция, так как работает только с данными.
    """
    options_by_node = {}
    for opt in options:
        if opt.node_uuid not in options_by_node:
            options_by_node[opt.node_uuid] = []
        options_by_node[opt.node_uuid].append({
            'id': opt.option_uuid,
            'text': opt.option_text,
            'targetType': opt.target_type,
            'targetNodeId': opt.target_node_uuid,
            'points': opt.points,
            'sort_order': opt.sort_order
        })

    for node_uuid in options_by_node:
        options_by_node[node_uuid].sort(key=lambda x: x.get('sort_order', 0))

    rf_nodes = []
    for node in nodes:
        node_options = options_by_node.get(node.node_uuid, [])

        rf_node = {
            'id': node.node_uuid,
            'type': 'dialogue',
            'position': {
                'x': float(node.position_x) if node.position_x is not None else 0,
                'y': float(node.position_y) if node.position_y is not None else 0
            },
            'data': {
                'characterName': node.character_name or '',
                'text': node.text or '',
                'spriteFile': node.sprite_file or '',
                'musicFile': node.music_file or '',
                'loopMusic': bool(node.loop_music) if node.loop_music is not None else False,
                'isStart': bool(node.is_start) if node.is_start is not None else False,
                'options': node_options,
                'backgroundUrl': node.background_url or ''
            }
        }

        if node.width is not None:
            rf_node['width'] = float(node.width)
        if node.height is not None:
            rf_node['height'] = float(node.height)

        rf_nodes.append(rf_node)

    rf_edges = []
    for edge in edges:
        rf_edge = {
            'id': edge.edge_uuid,
            'source': edge.source_node_uuid,
            'sourceHandle': edge.source_handle,
            'target': edge.target_node_uuid,
            'targetHandle': 'in',
            'markerEnd': {'type': 'arrowclosed'},
            'style': {'stroke': '#48bb78', 'strokeWidth': 2}
        }
        rf_edges.append(rf_edge)

    return {
        'id': scene.id,
        'name': scene.name,
        'background_url': scene.background_url,
        'background_type': scene.background_type,
        'use_video_audio': (
            bool(scene.use_video_audio)
            if hasattr(scene, 'use_video_audio') and scene.use_video_audio is not None
            else False
        ),
        'order_index': scene.order_index,
        'nodes': rf_nodes,
        'edges': rf_edges
    }


async def get_full_scene(
    db: AsyncSession,
    scene_id: int
) -> Optional[dict]:
    """Загружает полную сцену со всеми узлами, опциями и связями."""
    scene = await get_scene(db, scene_id)
    if not scene:
        return None

    nodes = await get_nodes_by_scene(db, scene_id)
    edges = await get_edges_by_scene(db, scene_id)

    all_options = []
    for node in nodes:
        options = await get_options_by_node(db, node.node_uuid)
        all_options.extend(options)

    result = convert_db_to_reactflow(scene, nodes, edges, all_options)
    return result


async def save_full_scene(
    db: AsyncSession,
    scene_id: int,
    reactflow_data: dict
) -> Optional[dict]:
    """
    Сохраняет полную сцену: обновляет информацию о сцене,
    узлы, опции и связи. Удаляет те элементы, которых нет в новых данных.
    """
    db_scene = await get_scene(db, scene_id)
    if not db_scene:
        return None

    # Обновляем основные поля сцены
    if 'name' in reactflow_data:
        db_scene.name = reactflow_data['name']
    if 'background_url' in reactflow_data:
        db_scene.background_url = reactflow_data['background_url']
        db_scene.background_type = get_background_type_from_url(
            reactflow_data['background_url']
        )
    if 'use_video_audio' in reactflow_data:
        db_scene.use_video_audio = reactflow_data['use_video_audio']

    db_scene.updated_at = datetime.utcnow()
    await db.flush()

    # Получаем существующие узлы и связи
    existing_nodes_list = await get_nodes_by_scene(db, scene_id)
    existing_edges_list = await get_edges_by_scene(db, scene_id)
    
    existing_nodes = {node.node_uuid for node in existing_nodes_list}
    existing_edges = {edge.edge_uuid for edge in existing_edges_list}

    # Конвертируем новые данные
    new_data = convert_reactflow_to_db(scene_id, reactflow_data)

    new_node_uuids = {node['node_uuid'] for node in new_data['nodes']}
    new_edge_uuids = {edge['edge_uuid'] for edge in new_data['edges']}

    # Удаляем связи, которых нет в новых данных
    edges_to_delete = existing_edges - new_edge_uuids
    if edges_to_delete:
        await db.execute(
            select(models.SceneEdge).where(
                models.SceneEdge.edge_uuid.in_(edges_to_delete)
            )
        )
        for edge_uuid in edges_to_delete:
            edge_query = await db.execute(
                select(models.SceneEdge).where(
                    models.SceneEdge.edge_uuid == edge_uuid
                )
            )
            edge = edge_query.scalar_one_or_none()
            if edge:
                await db.delete(edge)

    # Удаляем опции узлов, которые будут удалены
    nodes_to_delete = existing_nodes - new_node_uuids
    if nodes_to_delete:
        for node_uuid in nodes_to_delete:
            options_query = await db.execute(
                select(models.NodeOption).where(
                    models.NodeOption.node_uuid == node_uuid
                )
            )
            options = options_query.scalars().all()
            for option in options:
                await db.delete(option)

    # Обновляем или создаём узлы
    for node_data in new_data['nodes']:
        node_query = await db.execute(
            select(models.SceneNode).where(
                models.SceneNode.node_uuid == node_data['node_uuid']
            )
        )
        existing_node = node_query.scalar_one_or_none()

        if existing_node:
            for key, value in node_data.items():
                if key not in ['node_uuid', 'scene_id', 'created_at']:
                    setattr(existing_node, key, value)
            existing_node.updated_at = datetime.utcnow()
        else:
            db_node = models.SceneNode(**node_data)
            db.add(db_node)

    await db.flush()

    # Удаляем узлы, которых нет в новых данных
    if nodes_to_delete:
        for node_uuid in nodes_to_delete:
            node_query = await db.execute(
                select(models.SceneNode).where(
                    models.SceneNode.node_uuid == node_uuid
                )
            )
            node = node_query.scalar_one_or_none()
            if node:
                await db.delete(node)

    # Обновляем или создаём опции
    for opt_data in new_data['options']:
        opt_query = await db.execute(
            select(models.NodeOption).where(
                models.NodeOption.option_uuid == opt_data['option_uuid']
            )
        )
        existing_opt = opt_query.scalar_one_or_none()

        if existing_opt:
            for key, value in opt_data.items():
                if key not in ['option_uuid', 'created_at']:
                    setattr(existing_opt, key, value)
            existing_opt.updated_at = datetime.utcnow()
        else:
            db_option = models.NodeOption(**opt_data)
            db.add(db_option)

    await db.flush()

    # Обновляем или создаём связи
    for edge_data in new_data['edges']:
        source_query = await db.execute(
            select(models.SceneNode).where(
                models.SceneNode.node_uuid == edge_data['source_node_uuid']
            )
        )
        source_exists = source_query.scalar_one_or_none() is not None

        target_query = await db.execute(
            select(models.SceneNode).where(
                models.SceneNode.node_uuid == edge_data['target_node_uuid']
            )
        )
        target_exists = target_query.scalar_one_or_none() is not None

        if not source_exists or not target_exists:
            continue

        edge_query = await db.execute(
            select(models.SceneEdge).where(
                models.SceneEdge.edge_uuid == edge_data['edge_uuid']
            )
        )
        existing_edge = edge_query.scalar_one_or_none()

        if existing_edge:
            for key, value in edge_data.items():
                if key not in ['edge_uuid', 'scene_id', 'created_at']:
                    setattr(existing_edge, key, value)
        else:
            db_edge = models.SceneEdge(**edge_data)
            db.add(db_edge)

    await db.commit()

    return await get_full_scene(db, scene_id)