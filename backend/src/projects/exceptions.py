"""
Исключения для модуля проектов.
"""
from fastapi import HTTPException, status


class ProjectNotFoundError(HTTPException):
    def __init__(self, detail: str = "Project not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class ProjectAccessDeniedError(HTTPException):
    def __init__(self, detail: str = "Access denied to project"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class ProjectValidationError(HTTPException):
    def __init__(self, detail: str = "Project validation error"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class ProjectPublishError(HTTPException):
    def __init__(self, detail: str = "Cannot publish project without scenes"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class StatusNotFoundError(HTTPException):
    def __init__(self, detail: str = "Status not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class StatusExistsError(HTTPException):
    def __init__(self, detail: str = "Status already exists"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )