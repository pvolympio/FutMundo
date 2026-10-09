"""
Middleware para a API FUTFUT.
Inclui logging, tratamento de erros, CORS e rate limiting.
"""

import time
import logging
import traceback
import uuid
from collections import OrderedDict
from typing import Callable

from prometheus_client import Counter, Histogram

HTTP_REQUESTS_TOTAL = Counter(
    "futmundo_http_requests_total",
    "Total de requisições HTTP processadas",
    ["method", "endpoint", "status"]
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "futmundo_http_request_duration_seconds",
    "Histograma de latência de requisições HTTP",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0)
)

from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware

from backend.api.config import settings
from backend.api.models import ErrorResponse

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware para correlação de Request-ID, log estruturado e métricas Prometheus."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Extrai ou gera Request-ID para rastreabilidade de ponta a ponta
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:16]
        request.state.request_id = request_id

        path_label = request.url.path
        # Agrupa endpoints parametrizados para não inflacionar cardinalidade de métricas
        if path_label.startswith("/players/") and path_label != "/players/rankings":
            path_label = "/players/{id}"
        elif path_label.startswith("/matches/") and path_label != "/matches/latest":
            path_label = "/matches/{id}"
        elif path_label.startswith("/teams/"):
            path_label = "/teams/{id}"

        logger.info(
            f"[{request_id}] {request.method} {request.url.path} - "
            f"Client: {request.client.host if request.client else 'unknown'}"
        )

        try:
            response = await call_next(request)
            process_time = time.time() - start_time

            # Registra métricas Prometheus
            HTTP_REQUEST_DURATION_SECONDS.labels(method=request.method, endpoint=path_label).observe(process_time)
            HTTP_REQUESTS_TOTAL.labels(method=request.method, endpoint=path_label, status=str(response.status_code)).inc()

            logger.info(
                f"[{request_id}] {request.method} {request.url.path} - "
                f"Status: {response.status_code} - "
                f"Time: {process_time*1000:.2f}ms"
            )

            # Injeta headers de rastreamento
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Processing-Time"] = f"{process_time*1000:.2f}ms"

            return response
        except Exception as e:
            process_time = time.time() - start_time
            HTTP_REQUESTS_TOTAL.labels(method=request.method, endpoint=path_label, status="500").inc()
            logger.error(
                f"[{request_id}] {request.method} {request.url.path} - "
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
    Middleware de rate limiting em memória por IP real baseado em LRU (Least Recently Used).
    Atua como defesa em profundidade local/aplicacional, complementando o rate limit
    perimetral do Nginx (limit_req com zone=api_limit no nginx.conf).
    
    Substitui limpezas totais destrutivas (clear()) por evicção LRU seletiva
    para prevenir evasão deliberada de limites por atacantes.
    """

    def __init__(self, app, requests: int = 100, window: int = 60, max_entries: int = 10000):
        super().__init__(app)
        self.requests = requests
        self.window = window
        self.max_entries = max_entries
        self._store: OrderedDict[str, list[float]] = OrderedDict()
        self._last_cleanup = time.time()

    def _cleanup_old_entries(self, current_time: float) -> None:
        """Limpa IPs inativos e evicta os menos recentemente usados quando a capacidade é atingida."""
        if current_time - self._last_cleanup < 60:
            return
        self._last_cleanup = current_time

        # 1. Remove IPs cujos timestamps já expiraram da janela
        expired_ips = [
            ip for ip, timestamps in self._store.items()
            if not timestamps or (current_time - timestamps[-1] >= self.window)
        ]
        for ip in expired_ips:
            self._store.pop(ip, None)

        # 2. Se a capacidade máxima ainda for excedida, evicta seletivamente os mais antigos (LRU)
        # Nunca faz clear() global para não resetar baldes de clientes ativos
        evicted_count = 0
        while len(self._store) > self.max_entries:
            self._store.popitem(last=False)
            evicted_count += 1

        if evicted_count > 0:
            logger.warning(
                "RateLimitMiddleware atingiu teto de %d entradas. %d clientes inativos evictados via LRU.",
                self.max_entries,
                evicted_count,
            )

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

        if len(timestamps) >= self.requests:
            reset_time = max(
                1,
                int(self.window - (current_time - (timestamps[0] if timestamps else current_time)))
            )
            # Reinsere para marcar atividade recente
            self._store[client_ip] = timestamps
            self._store.move_to_end(client_ip)
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
        self._store[client_ip] = timestamps
        self._store.move_to_end(client_ip)

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