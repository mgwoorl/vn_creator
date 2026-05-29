"""
Исключения для модуля сцен.
"""
from fastapi import HTTPException, status


class SceneNotFoundError(HTTPException):
    def __init__(self, detail: str = "Scene not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class SceneAccessDeniedError(HTTPException):
    def __init__(self, detail: str = "Access denied to scene"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class SceneValidationError(HTTPException):
    def __init__(self, detail: str = "Scene validation error"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class NodeNotFoundError(HTTPException):
    def __init__(self, detail: str = "Node not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class OptionNotFoundError(HTTPException):
    def __init__(self, detail: str = "Option not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class SceneSaveError(HTTPException):
    def __init__(self, detail: str = "Error saving scene"):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail
        )