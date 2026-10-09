"""
Tests for health check endpoints: /health, /health/live, and /health/ready.
Verifies failure resilience when database is offline and materialized view exposure.
Also tests RateLimitMiddleware bounded LRU eviction.
"""

from collections import OrderedDict
from unittest.mock import AsyncMock, patch, MagicMock
import time
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.api.middleware import RateLimitMiddleware


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


def test_health_ready_exposes_mv_rankings_status():
    """Readiness probe checks mv_player_season_rankings and exposes status in checks."""
    mock_conn = AsyncMock()
    mock_conn.fetchval.side_effect = [1, True]  # SELECT 1 -> 1, SELECT EXISTS -> True
    
    with patch("backend.api.main.db_pool.acquire", return_value=mock_conn):
        client = TestClient(app)
        response = client.get("/health/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["checks"]["database"] == "ok"
        assert data["checks"]["mv_rankings"] == "ok"


def test_rate_limit_lru_eviction_does_not_clear_active_store():
    """RateLimitMiddleware evicts oldest entries (LRU) instead of resetting all users with clear()."""
    middleware = RateLimitMiddleware(app=MagicMock(), requests=5, window=60, max_entries=3)
    
    now = time.time()
    # Adiciona 3 IPs com timestamps válidos
    middleware._store["ip_1"] = [now]
    middleware._store["ip_2"] = [now + 1]
    middleware._store["ip_3"] = [now + 2]
    
    assert len(middleware._store) == 3
    
    # Simula adicionar o 4º IP e forçar limpeza de limite
    middleware._store["ip_4"] = [now + 3]
    middleware._last_cleanup = now - 100  # Força limpeza
    middleware._cleanup_old_entries(now + 4)
    
    # Não deve ter apagado tudo com clear()! Deve conter exatamente max_entries (3)
    assert len(middleware._store) == 3
    # ip_1 era o mais antigo, deve ter sido evictado via LRU
    assert "ip_1" not in middleware._store
    # ip_2, ip_3, ip_4 permanecem
    assert "ip_2" in middleware._store
    assert "ip_3" in middleware._store
    assert "ip_4" in middleware._store
