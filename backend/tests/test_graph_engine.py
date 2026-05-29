"""
Тесты для движка графов диалогов.
"""
import pytest
from src.engine.graph_engine import (
    SceneGraph, SceneNode, DialogueNodeData, NodeOption,
    NodePosition, SceneEdge, TargetType,
    GraphExecutionEngine, ExecutionContext, GraphFactory
)


class TestDialogueNodeData:
    """Тесты данных узла диалога."""
    
    def test_create_node_data(self):
        """Создание данных узла."""
        data = DialogueNodeData(
            character_name="Test",
            text="Hello",
            is_start=True
        )
        assert data.character_name == "Test"
        assert data.text == "Hello"
        assert data.is_start is True
    
    def test_deduplicate_options(self):
        """Удаление дубликатов опций."""
        opt1 = NodeOption(id="1", text="Option 1", target_type=TargetType.NODE)
        opt2 = NodeOption(id="1", text="Option 1", target_type=TargetType.NODE)  # Duplicate
        opt3 = NodeOption(id="2", text="Option 2", target_type=TargetType.NODE)
        
        data = DialogueNodeData(
            character_name="Test",
            text="Hello",
            options=[opt1, opt2, opt3]
        )
        
        deduped = data.deduplicate_options()
        assert len(deduped.options) == 2
    
    def test_empty_options(self):
        """Узел без опций."""
        data = DialogueNodeData(character_name="", text="")
        assert len(data.options) == 0


class TestSceneNode:
    """Тесты узла сцены."""
    
    def test_create_node(self):
        """Создание узла."""
        node = SceneNode(
            id="node-1",
            type="dialogue",
            position=NodePosition(x=100, y=200),
            data=DialogueNodeData(character_name="Test", text="Hello")
        )
        assert node.id == "node-1"
        assert node.position.x == 100
        assert node.position.y == 200
        assert node.data.character_name == "Test"


class TestSceneGraph:
    """Тесты графа сцены."""
    
    def test_create_graph(self):
        """Создание графа."""
        graph = SceneGraph(id=1, name="Test Scene", nodes=[], edges=[])
        assert graph.id == 1
        assert graph.name == "Test Scene"
        assert len(graph.nodes) == 0
    
    def test_get_start_node(self):
        """Получение стартового узла."""
        start_node = SceneNode(
            id="start",
            type="dialogue",
            position=NodePosition(x=0, y=0),
            data=DialogueNodeData(text="Start", is_start=True)
        )
        other_node = SceneNode(
            id="other",
            type="dialogue",
            position=NodePosition(x=100, y=100),
            data=DialogueNodeData(text="Other")
        )
        
        graph = SceneGraph(
            id=1,
            name="Test",
            nodes=[other_node, start_node],
            edges=[]
        )
        
        start = graph.get_start_node()
        assert start is not None
        assert start.id == "start"
    
    def test_get_start_node_first_when_no_start(self):
        """Получение первого узла, если нет помеченного как стартовый."""
        node1 = SceneNode(
            id="node1",
            type="dialogue",
            position=NodePosition(x=0, y=0),
            data=DialogueNodeData(text="First")
        )
        node2 = SceneNode(
            id="node2",
            type="dialogue",
            position=NodePosition(x=100, y=0),
            data=DialogueNodeData(text="Second")
        )
        
        graph = SceneGraph(id=1, name="Test", nodes=[node1, node2], edges=[])
        
        start = graph.get_start_node()
        assert start is not None
        assert start.id == "node1"
    
    def test_build_graph(self):
        """Построение направленного графа."""
        node1 = SceneNode(
            id="node1",
            type="dialogue",
            position=NodePosition(x=0, y=0),
            data=DialogueNodeData(
                text="First",
                options=[
                    NodeOption(
                        id="opt1",
                        text="Next",
                        target_type=TargetType.NODE,
                        target_node_id="node2"
                    )
                ]
            )
        )
        node2 = SceneNode(
            id="node2",
            type="dialogue",
            position=NodePosition(x=100, y=0),
            data=DialogueNodeData(text="Second")
        )
        
        edge = SceneEdge(
            id="edge1",
            source="node1",
            source_handle="opt-opt1",
            target="node2"
        )
        
        graph = SceneGraph(
            id=1,
            name="Test",
            nodes=[node1, node2],
            edges=[edge]
        )
        
        G = graph.build_graph()
        assert len(G.nodes) == 2
        assert len(G.edges) == 1
    
    def test_validate_graph_valid(self):
        """Валидация корректного графа."""
        node1 = SceneNode(
            id="node1",
            type="dialogue",
            position=NodePosition(x=0, y=0),
            data=DialogueNodeData(
                text="First",
                is_start=True,
                options=[
                    NodeOption(
                        id="opt1",
                        text="Next",
                        target_type=TargetType.NODE,
                        target_node_id="node2"
                    )
                ]
            )
        )
        node2 = SceneNode(
            id="node2",
            type="dialogue",
            position=NodePosition(x=100, y=0),
            data=DialogueNodeData(text="Second")
        )
        
        edge = SceneEdge(
            id="edge1",
            source="node1",
            source_handle="opt-opt1",
            target="node2"
        )
        
        graph = SceneGraph(
            id=1,
            name="Test",
            nodes=[node1, node2],
            edges=[edge]
        )
        
        is_valid, errors = graph.validate_graph()
        assert is_valid is True
        assert len(errors) == 0
    
    def test_validate_graph_empty(self):
        """Валидация пустого графа."""
        graph = SceneGraph(id=1, name="Test", nodes=[], edges=[])
        
        is_valid, errors = graph.validate_graph()
        assert is_valid is True
        assert len(errors) == 1  # "Сцена не содержит узлов"


class TestGraphExecutionEngine:
    """Тесты движка выполнения графов."""
    
    def test_traverse_graph(self):
        """Обход графа."""
        node = SceneNode(
            id="start",
            type="dialogue",
            position=NodePosition(x=0, y=0),
            data=DialogueNodeData(
                text="Hello",
                is_start=True,
                options=[
                    NodeOption(
                        id="opt1",
                        text="Continue",
                        target_type=TargetType.NOVEL_END
                    )
                ]
            )
        )
        
        graph = SceneGraph(id=1, name="Test", nodes=[node], edges=[])
        engine = GraphExecutionEngine()
        context = ExecutionContext(project_id=1, scene_id=1)
        
        result = engine.traverse_graph(graph, context)
        
        assert result["status"] == "active"
        assert result["current_node"] is not None
        assert result["current_node"]["text"] == "Hello"
        assert result["has_options"] is True
    
    def test_traverse_empty_graph(self):
        """Обход пустого графа."""
        graph = SceneGraph(id=1, name="Test", nodes=[], edges=[])
        engine = GraphExecutionEngine()
        context = ExecutionContext(project_id=1, scene_id=1)
        
        result = engine.traverse_graph(graph, context)
        
        assert result["status"] == "empty"
        assert "error" in result
    
    def test_select_option_to_novel_end(self):
        """Выбор опции, ведущей к концу новеллы."""
        node = SceneNode(
            id="start",
            type="dialogue",
            position=NodePosition(x=0, y=0),
            data=DialogueNodeData(
                text="Hello",
                is_start=True,
                options=[
                    NodeOption(
                        id="opt1",
                        text="End",
                        target_type=TargetType.NOVEL_END,
                        points=5
                    )
                ]
            )
        )
        
        graph = SceneGraph(id=1, name="Test", nodes=[node], edges=[])
        engine = GraphExecutionEngine()
        context = ExecutionContext(project_id=1, scene_id=1)
        
        result = engine.select_option(graph, context, "start", "opt1")
        
        assert result["action"] == "end"
        assert context.total_points == 5
    
    def test_select_option_to_node(self):
        """Выбор опции, ведущей к другому узлу."""
        node1 = SceneNode(
            id="node1",
            type="dialogue",
            position=NodePosition(x=0, y=0),
            data=DialogueNodeData(
                text="First",
                is_start=True,
                options=[
                    NodeOption(
                        id="opt1",
                        text="Next",
                        target_type=TargetType.NODE,
                        target_node_id="node2"
                    )
                ]
            )
        )
        node2 = SceneNode(
            id="node2",
            type="dialogue",
            position=NodePosition(x=100, y=0),
            data=DialogueNodeData(text="Second")
        )
        
        edge = SceneEdge(
            id="edge1",
            source="node1",
            source_handle="opt-opt1",
            target="node2"
        )
        
        graph = SceneGraph(
            id=1,
            name="Test",
            nodes=[node1, node2],
            edges=[edge]
        )
        engine = GraphExecutionEngine()
        context = ExecutionContext(project_id=1, scene_id=1)
        
        result = engine.select_option(graph, context, "node1", "opt1")
        
        assert result["action"] == "node"
        assert result["target_node_id"] == "node2"


class TestExecutionContext:
    """Тесты контекста выполнения."""
    
    def test_create_context(self):
        """Создание контекста."""
        ctx = ExecutionContext(project_id=1, scene_id=1)
        
        assert ctx.project_id == 1
        assert ctx.scene_id == 1
        assert ctx.total_points == 0
        assert len(ctx.visited_nodes) == 0
    
    def test_add_answer(self):
        """Добавление ответа."""
        ctx = ExecutionContext(project_id=1, scene_id=1)
        option = NodeOption(id="opt1", text="Yes", target_type=TargetType.NODE, points=10)
        
        ctx.add_answer("node1", option)
        
        assert ctx.total_points == 10
        assert len(ctx.answers) == 1
        assert "node1" in ctx.visited_nodes
    
    def test_add_duplicate_answer(self):
        """Добавление дублирующегося ответа (не должно добавиться)."""
        ctx = ExecutionContext(project_id=1, scene_id=1)
        option = NodeOption(id="opt1", text="Yes", target_type=TargetType.NODE, points=10)
        
        ctx.add_answer("node1", option)
        ctx.add_answer("node1", option)  # Duplicate
        
        assert len(ctx.answers) == 1
        assert ctx.total_points == 10  # Points не должны удвоиться
    
    def test_set_get_variable(self):
        """Установка и получение переменной."""
        ctx = ExecutionContext(project_id=1, scene_id=1)
        
        ctx.set_variable("score", 100)
        assert ctx.get_variable("score") == 100
        assert ctx.get_variable("nonexistent", "default") == "default"
    
    def test_serialization(self):
        """Сериализация и десериализация контекста."""
        ctx = ExecutionContext(project_id=1, scene_id=1)
        option = NodeOption(id="opt1", text="Yes", target_type=TargetType.NODE, points=10)
        ctx.add_answer("node1", option)
        ctx.set_variable("key", "value")
        
        data = ctx.to_dict()
        restored = ExecutionContext.from_dict(data, project_id=1, scene_id=1)
        
        assert restored.total_points == 10
        assert len(restored.answers) == 1
        assert restored.get_variable("key") == "value"


class TestGraphFactory:
    """Тесты фабрики графов."""
    
    def test_from_reactflow(self):
        """Создание графа из данных ReactFlow."""
        reactflow_data = {
            "id": 1,
            "name": "Test Scene",
            "nodes": [
                {
                    "id": "node1",
                    "type": "dialogue",
                    "position": {"x": 0, "y": 0},
                    "data": {
                        "characterName": "Test",
                        "text": "Hello",
                        "isStart": True,
                        "options": [
                            {
                                "id": "opt1",
                                "text": "Continue",
                                "targetType": "node"
                            }
                        ]
                    }
                }
            ],
            "edges": []
        }
        
        graph = GraphFactory.from_reactflow(reactflow_data)
        
        assert graph.id == 1
        assert graph.name == "Test Scene"
        assert len(graph.nodes) == 1
        assert graph.nodes[0].data.character_name == "Test"
        assert graph.nodes[0].data.is_start is True
        assert len(graph.nodes[0].data.options) == 1


class TestNodeCache:
    """Тесты кэша узлов."""
    
    def test_cache_set_get(self):
        """Сохранение и получение из кэша."""
        from src.engine.graph_engine import NodeCache
        
        cache = NodeCache()
        node = SceneNode(
            id="node1",
            type="dialogue",
            position=NodePosition(x=0, y=0),
            data=DialogueNodeData(text="Hello")
        )
        
        cache.set(node, {"result": "test"})
        cached = cache.get(node)
        
        assert cached is not None
        assert cached["result"] == "test"
    
    def test_cache_clear(self):
        """Очистка кэша."""
        from src.engine.graph_engine import NodeCache
        
        cache = NodeCache()
        node = SceneNode(
            id="node1",
            type="dialogue",
            position=NodePosition(x=0, y=0),
            data=DialogueNodeData(text="Hello")
        )
        
        cache.set(node, {"result": "test"})
        cache.clear()
        
        assert cache.get(node) is None