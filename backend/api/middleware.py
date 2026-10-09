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


def get_client_ip(request: Request) -> str:
    """Extrai IP real do cliente considerando proxies reversos (X-Forwarded-For, X-Real-IP)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client = forwarded.split(",")[0].strip()
        if client:
            return client
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware para adicionar headers de segurança em todas as respostas sem anular cache HTTP."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Não adiciona Cache-Control no-store aqui para permitir caching HTTP nos endpoints históricos
        return response


# Alias para retrocompatibilidade
ErrorHandlingMiddleware = SecurityHeadersMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware de rate limiting em memória por IP real com limpeza periódica de entradas.
    Complementa o limit_req do Nginx para ambientes locais e defesa em profundidade.
    """

    def __init__(self, app, requests: int = 100, window: int = 60):
        super().__init__(app)
        self.requests = requests
        self.window = window
        self._store: dict[str, list[float]] = {}
        self._last_cleanup = time.time()

    def _cleanup_old_entries(self, current_time: float) -> None:
        """Limpa IPs inativos para evitar vazamento de memória."""
        if current_time - self._last_cleanup < 60:
            return
        self._last_cleanup = current_time
        expired_ips = [
            ip for ip, timestamps in self._store.items()
            if not timestamps or (current_time - timestamps[-1] >= self.window)
        ]
        for ip in expired_ips:
            self._store.pop(ip, None)
        # Proteção contra crescimento ilimitado
        if len(self._store) > 10000:
            self._store.clear()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Pula rate limit em endpoints de saúde/liveness
        if request.url.path.startswith("/health"):
            return await call_next(request)

        client_ip = get_client_ip(request)
        current_time = time.time()
        self._cleanup_old_entries(current_time)

        # Filtra timestamps da janela atual
        timestamps = self._store.get(client_ip, [])
        timestamps = [t for t in timestamps if current_time - t < self.window]
        self._store[client_ip] = timestamps

        if len(timestamps) >= self.requests:
            reset_time = max(
                1,
                int(self.window - (current_time - (timestamps[0] if timestamps else current_time)))
            )
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Limite de {self.requests} requisições por {self.window}s excedido"
                },
                headers={
                    "X-RateLimit-Limit": str(self.requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_time),
                    "Retry-After": str(reset_time),
                },
            )

        timestamps.append(current_time)
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests)
        response.headers["X-RateLimit-Remaining"] = str(max(0, self.requests - len(timestamps)))
        return response


def setup_cors(app):
    """Configura CORS para a API."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[
            "Retry-After",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "X-Processing-Time",
            "ETag",
        ],
    )


def setup_middleware(app):
    """Configura todos os middlewares da API na ordem correta."""
    # Headers de segurança
    app.add_middleware(SecurityHeadersMiddleware)

    # Logging de requisições
    app.add_middleware(RequestLoggingMiddleware)

    # Rate limiting
    app.add_middleware(
        RateLimitMiddleware,
        requests=settings.RATE_LIMIT_REQUESTS,
        window=settings.RATE_LIMIT_WINDOW_SECONDS,
    )

    # CORS
    setup_cors(app)


# Alias for compatibility with main.py
register_middleware = setup_middleware