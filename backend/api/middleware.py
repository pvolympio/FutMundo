"""
Middleware para a API FUTFUT.
Inclui logging, tratamento de erros, CORS e rate limiting.
"""

import time
import logging
import traceback
from typing import Callable

from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware

from backend.api.config import settings
from backend.api.models import ErrorResponse

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware para log de requisições com timing."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()

        # Log da requisição
        logger.info(
            f"{request.method} {request.url.path} - "
            f"Client: {request.client.host if request.client else 'unknown'}"
        )

        try:
            response = await call_next(request)

            # Calcula tempo de processamento
            process_time = time.time() - start_time

            # Log da resposta
            logger.info(
                f"{request.method} {request.url.path} - "
                f"Status: {response.status_code} - "
                f"Time: {process_time*1000:.2f}ms"
            )

            # Adiciona header de resposta
            response.headers["X-Processing-Time"] = str(process_time)

            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                f"{request.method} {request.url.path} - "
                f"Error: {str(e)} - Time: {process_time*1000:.2f}ms",
                exc_info=True
            )
            raise


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware global para tratamento de erros com headers de segurança."""

    def _add_security_headers(self, response: Response) -> None:
        """Add security headers to all responses."""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            self._add_security_headers(response)
            return response
        except HTTPException as e:
            logger.warning(f"HTTP error {e.status_code}: {e.detail}")
            error_response = JSONResponse(
                status_code=e.status_code,
                content=ErrorResponse(
                    error=e.detail if isinstance(e.detail, str) else "Bad Request",
                    details=str(e.detail) if e.detail else None
                ).model_dump()
            )
            self._add_security_headers(error_response)
            return error_response
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}", exc_info=True)
            error_response = JSONResponse(
                status_code=500,
                content=ErrorResponse(
                    error="Internal Server Error",
                    details=str(e) if settings.DEBUG else "Ocorreu um erro inesperado"
                ).model_dump()
            )
            self._add_security_headers(error_response)
            return error_response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware simples de rate limiting por IP."""

    def __init__(self, app, requests: int = 100, window: int = 60):
        super().__init__(app)
        self.requests = requests
        self.window = window
        self._store: dict[str, list[float]] = {}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        current_time = time.time()

        # Limpa entradas antigas
        if client_ip in self._store:
            self._store[client_ip] = [
                t for t in self._store[client_ip]
                if current_time - t < self.window
            ]
        else:
            self._store[client_ip] = []

        # Verifica rate limit
        if len(self._store[client_ip]) >= self.requests:
            reset_time = max(1, int(self.window - (current_time - (self._store[client_ip][0] if self._store[client_ip] else 0))))
            return JSONResponse(
                status_code=429,
                content=ErrorResponse(
                    error="Too many requests",
                    details=f"Limite de {self.requests} requisições por {self.window}s excedido"
                ).model_dump(),
                headers={
                    "X-RateLimit-Limit": str(self.requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_time),
                    "Retry-After": str(reset_time),
                }
            )

        # registra a requisição
        self._store[client_ip].append(current_time)

        response = await call_next(request)

        # Adiciona headers de rate limiting
        response.headers["X-RateLimit-Limit"] = str(self.requests)
        response.headers["X-RateLimit-Remaining"] = str(self.requests - len(self._store[client_ip]))

        return response


def setup_cors(app):
    """Configura CORS para a API."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "X-Processing-Time"],
    )


def setup_middleware(app):
    """Configura todos os middlewares da API."""
    # Error handling primeiro
    app.add_middleware(ErrorHandlingMiddleware)

    # Logging de requisições
    app.add_middleware(RequestLoggingMiddleware)

    # Rate limiting
    app.add_middleware(
        RateLimitMiddleware,
        requests=settings.RATE_LIMIT_REQUESTS,
        window=settings.RATE_LIMIT_WINDOW_SECONDS
    )

    # CORS
    setup_cors(app)


# Alias for compatibility with main.py
register_middleware = setup_middleware