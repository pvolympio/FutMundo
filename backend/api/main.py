"""
Main FastAPI Application for FUTFUT API.

A professional API for consuming FUTFUT database data.
Provides endpoints for teams, players, matches, search, and standings.
"""

import logging
import sys
from typing import Any

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import uvicorn
import asyncpg

from backend.api.config import settings
from backend.api.routers import (
    teams_router,
    players_router,
    matches_router,
    search_router,
    standings_router,
)
from backend.api.database import db_pool, close_application_connections, get_database
from backend.api.middleware import setup_middleware

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)

logger = logging.getLogger(__name__)


async def standardized_error_response(status_code: int, error: str, detail: str | None = None) -> JSONResponse:
    """Create a standardized error response."""
    return JSONResponse(
        status_code=status_code,
        content={
            "error": error,
            "detail": detail or error,
        },
    )


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle."""
    logger.info("Starting %s v%s", settings.PROJECT_NAME, settings.API_VERSION)
    await db_pool.initialize()
    yield
    logger.info("Shutting down application")
    await close_application_connections()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.API_VERSION,
        description=settings.API_DESCRIPTION,
        debug=settings.DEBUG,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
        # Contact information
        contact={
            "name": "FUTFUT API Team",
            "url": "https://github.com/futfut",
        },
        # License
        license_info={
            "name": "MIT",
            "url": "https://opensource.org/licenses/MIT",
        },
    )

    # Register middleware (CORS first - most external)
    setup_middleware(app)

    # Include routers
    app.include_router(teams_router)
    app.include_router(players_router)
    app.include_router(matches_router)
    app.include_router(search_router)
    app.include_router(standings_router)

    # Health check endpoint
    @app.get("/health", tags=["Health"], summary="Health check with database verification")
    async def health_check(db: asyncpg.Connection = Depends(get_database)):
        """Health check endpoint to verify API is running and database is accessible."""
        checks = {"status": "healthy", "version": settings.API_VERSION, "checks": {}}

        # Database check
        try:
            await db.fetchval("SELECT 1")
            checks["checks"]["database"] = "ok"
        except Exception as e:
            checks["checks"]["database"] = f"error: {str(e)}"
            checks["status"] = "degraded"

        return checks

    # Root endpoint
    @app.get("/", tags=["Root"], summary="API info")
    async def root():
        """Root endpoint with API information."""
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.API_VERSION,
            "description": settings.API_DESCRIPTION,
            "endpoints": {
                "teams": "/teams",
                "players": "/players",
                "matches": "/matches",
                "search": "/search",
                "standings": "/standings",
            },
        }

    return app


# Create the application instance
app = create_app()


# Exception handlers for standardized error format
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with standardized format."""
    logger.warning(f"HTTP error {exc.status_code}: {exc.detail}")
    content = {"error": exc.detail if isinstance(exc.detail, str) else "Bad Request"}
    if exc.detail:
        content["detail"] = exc.detail
    return JSONResponse(status_code=exc.status_code, content=content)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with standardized format."""
    errors = exc.errors()
    error_msg = "; ".join(f"{e.get('loc', ['unknown'])[-1]}: {e.get('msg', 'Invalid')}" for e in errors)
    return JSONResponse(
        status_code=422,
        content={
            "error": "Parâmetros inválidos",
            "detail": error_msg,
        },
    )


if __name__ == "__main__":
    uvicorn.run(
        "backend.api.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info",
    )