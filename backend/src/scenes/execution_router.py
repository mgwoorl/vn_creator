"""
Асинхронные маршруты для выполнения сцен (движок визуальной новеллы).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Optional
from pydantic import BaseModel

from src.database import get_db
from src.scenes import crud
from src.engine.graph_engine import GraphFactory, ExecutionContext, GraphExecutionEngine
from src.logger import setup_logger

router = APIRouter(prefix="/scenes/execute", tags=["scenes-execution"])

logger = setup_logger(__name__, 'execution.log')

# Создаем один экземпляр движка для всех запросов
engine = GraphExecutionEngine()


class SelectOptionRequest(BaseModel):
    """Запрос на выбор опции."""
    node_id: str
    option_id: str
    context_data: Dict = {}


class StartExecutionRequest(BaseModel):
    """Запрос на запуск выполнения сцены."""
    start_node_id: Optional[str] = None
    context_data: Optional[Dict] = None


@router.post("/{scene_id}/start")
async def start_scene_execution(
    scene_id: int,
    request: StartExecutionRequest = StartExecutionRequest(),
    db: AsyncSession = Depends(get_db)
):
    """
    Запускает выполнение сцены.
    Если передан context_data — восстанавливает контекст (баллы, ответы).
    """
    logger.info(
        f"[EXECUTE] Starting scene {scene_id}, "
        f"start_node_id={request.start_node_id}"
    )

    scene_data = await crud.get_full_scene(db, scene_id)
    if not scene_data:
        logger.error(f"[EXECUTE] Scene {scene_id} not found")
        raise HTTPException(status_code=404, detail="Scene not found")

    logger.info(
        f"[EXECUTE] Scene {scene_id} "
        f"use_video_audio={scene_data.get('use_video_audio')}"
    )

    try:
        graph = GraphFactory.from_reactflow(scene_data)
        logger.info(
            f"[EXECUTE] Graph built: "
            f"{len(graph.nodes)} nodes, {len(graph.edges)} edges"
        )

        start_node_id = request.start_node_id

        if start_node_id:
            target_node = graph.get_node_by_id(start_node_id)
            if target_node:
                logger.info(
                    f"[EXECUTE] RESUME: Starting from node {start_node_id}"
                )
            else:
                logger.warning(
                    f"[EXECUTE] Node {start_node_id} not found, "
                    f"falling back to start"
                )
                start_node_id = None

        # Создаём или восстанавливаем контекст
        context = ExecutionContext(
            project_id=scene_data.get('project_id', 0),
            scene_id=scene_id
        )

        if request.context_data:
            context = ExecutionContext.from_dict(
                request.context_data,
                project_id=scene_data.get('project_id', 0),
                scene_id=scene_id
            )
            logger.info(
                f"[EXECUTE] Context restored: "
                f"{len(context.answers)} answers, "
                f"{context.total_points} points"
            )

        result = engine.traverse_graph(
            graph,
            context,
            start_node_id=start_node_id
        )

        result['use_video_audio'] = scene_data.get(
            'use_video_audio',
            False
        )

        logger.info(
            f"[EXECUTE] Result: status={result.get('status')}, "
            f"node={result.get('current_node', {}).get('id')}, "
            f"use_video_audio={result.get('use_video_audio')}"
        )

        return {
            'success': True,
            'scene_id': scene_id,
            'execution': result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXECUTE] Failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{scene_id}/select")
async def select_option(
    scene_id: int,
    request: SelectOptionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Обрабатывает выбор варианта ответа пользователем.
    """
    logger.info(
        f"[SELECT] scene={scene_id}, "
        f"node={request.node_id}, option={request.option_id}"
    )

    scene_data = await crud.get_full_scene(db, scene_id)
    if not scene_data:
        logger.error(f"[SELECT] Scene not found: {scene_id}")
        raise HTTPException(status_code=404, detail="Scene not found")

    try:
        graph = GraphFactory.from_reactflow(scene_data)

        context = ExecutionContext.from_dict(
            request.context_data,
            project_id=scene_data.get('project_id', 0),
            scene_id=scene_id
        )

        logger.debug(
            f"[SELECT] Context: points={context.total_points}, "
            f"answers={len(context.answers)}"
        )

        result = engine.select_option(
            graph,
            context,
            request.node_id,
            request.option_id
        )

        logger.info(f"[SELECT] Action: {result.get('action')}")

        if result.get('action') == 'node':
            next_result = engine.traverse_graph(
                graph,
                context,
                start_node_id=result['target_node_id']
            )
            next_result['use_video_audio'] = scene_data.get(
                'use_video_audio',
                False
            )
            logger.info(
                f"[SELECT] Moved to node: {result['target_node_id']}"
            )
            return {
                'success': True,
                'execution': next_result
            }

        elif result.get('action') == 'end':
            logger.info("[SELECT] Novel ended")
            return {
                'success': True,
                'execution': {
                    'status': 'end',
                    'message': result.get(
                        'message',
                        'Завершение новеллы'
                    ),
                    'context': result['context'],
                    'use_video_audio': scene_data.get(
                        'use_video_audio',
                        False
                    )
                }
            }

        elif result.get('action') == 'next_scene':
            logger.info("[SELECT] Moving to next scene")
            return {
                'success': True,
                'execution': {
                    'status': 'next_scene',
                    'message': result.get(
                        'message',
                        'Переход к следующей сцене'
                    ),
                    'context': result['context'],
                    'use_video_audio': scene_data.get(
                        'use_video_audio',
                        False
                    )
                }
            }

        else:
            logger.error(
                f"[SELECT] Unknown action: {result.get('action')}"
            )
            raise HTTPException(
                status_code=400,
                detail=result.get('error', 'Unknown error')
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[SELECT] Failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))