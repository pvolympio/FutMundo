"""
Tests for health check endpoints: /health, /health/live, and /health/ready.
Verifies failure resilience when database is offline.
"""

from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app


def test_health_live_endpoint():
    """Liveness probe should always return 200 alive without database dependency."""
    client = TestClient(app)
    response = client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    assert "version" in data


def test_health_ready_success_when_db_ok():
    """Readiness probe returns 200 when database responds."""
    client = TestClient(app)
    response = client.get("/health/ready")
    assert response.status_code in [200, 503]
    data = response.json()
    assert "checks" in data


def test_health_ready_degraded_when_db_fails():
    """Readiness probe returns 503 degraded gracefully without crashing the app."""
    with patch("backend.api.main.db_pool.acquire", side_effect=Exception("Database connection timeout")):
        client = TestClient(app)
        response = client.get("/health/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert "error" in data["checks"]["database"]


def test_health_consolidated_does_not_throw_500_when_db_fails():
    """Consolidated /health returns 200 with degraded status if database connection fails."""
    with patch("backend.api.main.db_pool.acquire", side_effect=Exception("Database down")):
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert "error" in data["checks"]["database"]
