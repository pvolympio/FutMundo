"""
Configurações da API via variáveis de ambiente.
"""

from functools import lru_cache
from typing import Any, List
import logging

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Configurações da aplicação."""

    # Database - em produção, deve ser fornecido via env var com credenciais seguras do papel app_reader
    DATABASE_URL: str = Field(
        default="postgresql://app_reader:app_reader_secret@localhost:5432/futfut",
        description="URL de conexão PostgreSQL (utilizar usuário somente leitura app_reader para a API)",
    )
    DATABASE_POOL_MIN_SIZE: int = Field(default=5, ge=1, le=100)
    DATABASE_POOL_MAX_SIZE: int = Field(default=20, ge=1, le=100)

    # API
    PROJECT_NAME: str = "FutMundo API"
    API_VERSION: str = "1.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    API_DESCRIPTION: str = (
        "API profissional para consumo analítico de dados do FutMundo. "
        "Inclui endpoints para times, jogadores, partidas, rankings e classificações."
    )

    # CORS - Aceita lista, string separada por vírgula ou JSON array
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        """Aceita lista, JSON array ou string separada por vírgula no CORS_ORIGINS."""
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            if v.startswith("[") and v.endswith("]"):
                try:
                    import json
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [item.strip() for item in v.split(",") if item.strip()]
        if isinstance(v, (list, tuple, set)):
            return [str(item).strip() for item in v if str(item).strip()]
        return []

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # Cache
    CACHE_TTL_SECONDS: int = 300

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return settings