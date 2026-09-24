"""Configuração da API: lê DATABASE_URL do .env ou do ambiente.

Duplica de propósito o carregador de .env do pipeline (pipeline/carga.py) em
vez de importar de lá: são dois pontos de entrada independentes (CLI e
servidor web), e a função é pequena o bastante para não valer o acoplamento.
"""
from __future__ import annotations

import os
from pathlib import Path


def carregar_dotenv(caminho: str = ".env") -> None:
    p = Path(caminho)
    if not p.exists():
        return
    for linha in p.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            chave, valor = linha.split("=", 1)
            os.environ.setdefault(chave.strip(), valor.strip().strip('"').strip("'"))


def database_url() -> str:
    carregar_dotenv()
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("Defina DATABASE_URL (no .env ou no ambiente).")
    return url


def origens_cors() -> list[str]:
    """Origens liberadas para o frontend. '*' em dev; defina API_CORS_ORIGENS em produção."""
    carregar_dotenv()
    valor = os.environ.get("API_CORS_ORIGENS", "*")
    return [o.strip() for o in valor.split(",")] if valor != "*" else ["*"]
