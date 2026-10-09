"""
Dependency injection helpers for FastAPI.
"""

from fastapi import HTTPException

from .models import ErrorResponse


def not_found_error(entity: str = "Resource"):
    """Raises a 404 HTTPException with consistent error format."""
    raise HTTPException(
        status_code=404,
        detail=f"{entity} não encontrado"
    )


def success_response(data: dict = None, message: str = None):
    """Creates a standard success response."""
    return {
        "success": True,
        "message": message,
        "data": data
    }


def error_response(error: str, detail: str = None, status_code: int = 400):
    """Raises an HTTPException with consistent error format."""
    raise HTTPException(
        status_code=status_code,
        detail=detail or error
    )


def cache_control(ttl: int = None, stale_while_revalidate: int = 60):
    """Dependency helper to standardize Cache-Control headers across endpoints."""
    from fastapi import Response
    from .config import settings

    def _inject(response: Response):
        max_age = ttl if ttl is not None else settings.CACHE_TTL_SECONDS
        response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={stale_while_revalidate}"

    return _inject