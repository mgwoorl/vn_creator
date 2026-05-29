"""
Исключения для модуля прохождений.
"""
from fastapi import HTTPException, status


class PlaythroughNotFoundError(HTTPException):
    def __init__(self, detail: str = "Playthrough not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class PlaythroughAccessDeniedError(HTTPException):
    def __init__(self, detail: str = "Access denied to playthrough"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class PlaythroughAlreadyCompletedError(HTTPException):
    def __init__(self, detail: str = "Playthrough already completed"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class PlaythroughNotAvailableError(HTTPException):
    def __init__(
        self,
        detail: str = "Project not available for playthrough"
    ):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )