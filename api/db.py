"""Pool de conexões com o Postgres, para reaproveitar entre requisições."""
from __future__ import annotations

from contextlib import contextmanager

import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor

from .config import database_url

_pool: psycopg2.pool.SimpleConnectionPool | None = None


def iniciar_pool(minimo: int = 1, maximo: int = 10) -> None:
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.SimpleConnectionPool(minimo, maximo, database_url())


def encerrar_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


@contextmanager
def conexao():
    if _pool is None:
        iniciar_pool()
    assert _pool is not None
    conn = _pool.getconn()
    try:
        yield conn
        conn.commit()  # só há leitura aqui, mas fecha a transação aberta pelo cursor
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


@contextmanager
def cursor():
    with conexao() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
