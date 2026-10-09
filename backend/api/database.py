"""
Database connection and connection pool management.
Uses asyncpg with connection pooling for async support.
"""

import json
import logging
import re
from typing import AsyncGenerator, Optional

import asyncpg

from backend.api.config import get_settings

logger = logging.getLogger(__name__)


def parse_database_url(url: str) -> dict:
    """Parse DATABASE_URL into connection parameters."""
    pattern = r"postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^/]+)"
    match = re.match(pattern, url)
    if match:
        return {
            "user": match.group(1),
            "password": match.group(2),
            "host": match.group(3),
            "port": int(match.group(4)),
            "database": match.group(5),
        }
    raise ValueError(f"Invalid DATABASE_URL format: {url}")


def build_placeholders(count: int) -> str:
    """Build PostgreSQL parameter placeholders ($1, $2, ...)."""
    return ",".join(f"${i + 1}" for i in range(count))


async def _setup_connection(conn: asyncpg.Connection) -> None:
    """Setup connection with application name and JSON codec."""
    await conn.execute("SET application_name = 'futfut_api'")
    # Register JSON codecs to handle JSONB as dict, not string
    await conn.set_type_codec('json', encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    await conn.set_type_codec('jsonb', encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


class DatabasePool:
    """Database connection pool manager."""

    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None
        self._settings = get_settings()
        self._db_config = parse_database_url(self._settings.DATABASE_URL)

    async def initialize(self) -> None:
        """Initialize the connection pool."""
        import asyncio
        current_loop = asyncio.get_running_loop()
        if self._pool is not None:
            if getattr(self._pool, "_loop", None) is current_loop and not self._pool._loop.is_closed():
                return
            self._pool = None

        try:
            min_size = getattr(self._settings, "DATABASE_POOL_MIN_SIZE", 5)
            max_size = getattr(self._settings, "DATABASE_POOL_MAX_SIZE", 20)

            # Use DSN directly for asyncpg, fallback to parsed config if needed
            self._pool = await asyncpg.create_pool(
                dsn=self._settings.DATABASE_URL,
                min_size=min_size,
                max_size=max_size,
                command_timeout=30,
                setup=_setup_connection,
            )
            logger.info(
                "Database pool initialized with min_size=%d, max_size=%d",
                min_size,
                max_size,
            )
        except Exception as e:
            logger.error("Failed to initialize database pool: %s", e, exc_info=True)
            raise

    async def close(self) -> None:
        """Close the connection pool."""
        if self._pool is not None:
            if not self._pool._loop.is_closed():
                await self._pool.close()
            self._pool = None
            logger.info("Database pool closed")

    async def acquire(self) -> asyncpg.Connection:
        """Acquire a connection from the pool."""
        import asyncio
        current_loop = asyncio.get_running_loop()
        if self._pool is None or getattr(self._pool, "_loop", None) is not current_loop or self._pool._loop.is_closed():
            self._pool = None
            await self.initialize()
        return await self._pool.acquire()

    async def release(self, conn: asyncpg.Connection) -> None:
        """Release a connection back to the pool."""
        if self._pool is not None and not self._pool._loop.is_closed():
            try:
                await self._pool.release(conn)
            except Exception as e:
                logger.warning("Error releasing connection: %s", e)

    @property
    def pool(self) -> Optional[asyncpg.Pool]:
        """Get the connection pool."""
        return self._pool


# Global instance
db_pool = DatabasePool()


async def get_database() -> AsyncGenerator[asyncpg.Connection, None]:
    """
    FastAPI dependency that provides a database connection.
    Acquires a connection from the pool and releases it after use.
    """
    conn = await db_pool.acquire()
    try:
        yield conn
    finally:
        await db_pool.release(conn)


async def get_database_pool() -> DatabasePool:
    """Get the database pool instance."""
    return db_pool


async def close_application_connections() -> None:
    """Close all database connections during application shutdown."""
    await db_pool.close()


# Alias functions for compatibility
get_pool = db_pool
close_pool = close_application_connections


# RPC function wrappers
async def call_rpc_function(
    conn: asyncpg.Connection,
    function_name: str,
    *args
) -> Optional[dict]:
    """Execute an RPC function and return the result as a dictionary."""
    try:
        ph = build_placeholders(len(args))
        query = f"SELECT {function_name}({ph})"
        result = await conn.fetchval(query, *args)
        return result
    except Exception as e:
        logger.error("Error calling RPC function %s: %s", function_name, e)
        raise


async def execute_rpc_query(
    conn: asyncpg.Connection,
    function_name: str,
    *args
) -> list:
    """Execute a function that returns a table and return rows as list of dicts."""
    try:
        ph = build_placeholders(len(args))
        query = f"SELECT * FROM {function_name}({ph})"
        rows = await conn.fetch(query, *args)
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error("Error executing RPC query %s: %s", function_name, e)
        raise


# Specific RPC call wrappers
async def call_team_head_to_head(
    conn: asyncpg.Connection,
    team_a_id: int,
    team_b_id: int,
    limit: int = 10
) -> Optional[dict]:
    """Execute fn_team_head_to_head RPC function."""
    return await call_rpc_function(conn, "fn_team_head_to_head", team_a_id, team_b_id, limit)


async def call_match_details(
    conn: asyncpg.Connection,
    match_id: int
) -> Optional[dict]:
    """Execute fn_api_match_details RPC function."""
    return await call_rpc_function(conn, "fn_api_match_details", match_id)


async def call_player_profile(
    conn: asyncpg.Connection,
    player_id: int
) -> Optional[dict]:
    """Execute fn_api_player_profile RPC function."""
    return await call_rpc_function(conn, "fn_api_player_profile", player_id)


async def call_team_profile(
    conn: asyncpg.Connection,
    team_id: int,
    season_id: Optional[int] = None
) -> Optional[dict]:
    """Execute fn_api_team_profile RPC function."""
    return await call_rpc_function(conn, "fn_api_team_profile", team_id, season_id)


async def call_search_entities(
    conn: asyncpg.Connection,
    query: str,
    limit: int = 10
) -> list:
    """Execute search_entities RPC function."""
    return await execute_rpc_query(conn, "search_entities", query, limit)


async def call_standings_at_round(
    conn: asyncpg.Connection,
    competition_id: int,
    season_id: int,
    max_round: Optional[int] = None
) -> list:
    """Execute fn_standings_at_round RPC function with explicit casts."""
    query = "SELECT * FROM fn_standings_at_round($1::bigint, $2::bigint, $3::smallint)"
    rows = await conn.fetch(query, competition_id, season_id, max_round)
    return [dict(row) for row in rows]