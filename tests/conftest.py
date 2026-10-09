"""
Pytest configuration and fixtures for FUTFUT API tests.
Updated for async test support and proper async client setup.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from fastapi.testclient import TestClient

from backend.api.main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def anyio_backend():
    """Backend for anyio async test support."""
    return "asyncio"


@pytest_asyncio.fixture
async def async_client():
    """Create an async test client for the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_db_connection():
    """Mock database connection for unit tests without database."""
    from unittest.mock import AsyncMock, MagicMock

    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []
    mock_conn.fetchval.return_value = 0
    mock_conn.fetchrow.return_value = None
    mock_conn.execute.return_value = "OK"

    return mock_conn


@pytest_asyncio.fixture
async def async_db_pool():
    """Mock async database pool for testing."""
    from unittest.mock import AsyncMock, MagicMock

    mock_pool = AsyncMock()
    mock_pool.acquire.return_value = await mock_db_connection()
    mock_pool.release = AsyncMock()
    mock_pool.close = AsyncMock()
    mock_pool.initialize = AsyncMock()

    return mock_pool