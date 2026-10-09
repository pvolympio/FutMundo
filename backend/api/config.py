"""
Configurações da API via variáveis de ambiente.
"""

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configurações da aplicação."""

    # Database
    DATABASE_URL: str = Field(
        default="postgresql://app_reader:app_reader_secret@localhost:5432/futfut"
    )
    DATABASE_POOL_MIN_SIZE: int = Field(default=5, ge=1, le=100)
    DATABASE_POOL_MAX_SIZE: int = Field(default=20, ge=1, le=100)

    # API
    PROJECT_NAME: str = "FUTFUT API"
    API_VERSION: str = "1.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    API_DESCRIPTION: str = (
        "API profissional para consumo de dados do banco FUTFUT. "
        "Inclui endpoints para times, jogadores, partidas e classificações."
    )

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # Cache
    CACHE_TTL_SECONDS: int = 300

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return settings