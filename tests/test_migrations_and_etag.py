"""
Tests for versioned migrations system and HTTP ETag / 304 revalidation on materialized views.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.migrations.runner import get_migration_files, ensure_migrations_table
from backend.api.database import get_database, get_view_last_modified


def test_migration_files_discovered_and_ordered():
    """Verify that migration files are discovered and sorted numerically."""
    files = get_migration_files()
    assert len(files) >= 3
    versions = [v for v, _ in files]
    assert versions[0] == "001_initial_schema"
    assert versions[1] == "002_mv_player_season_rankings"
    assert versions[2] == "003_matview_refresh_tracking"


@pytest.mark.asyncio
async def test_get_view_last_modified_returns_timestamp_or_none():
    """get_view_last_modified returns datetime from matview_refresh_log or None safely."""
    mock_conn = AsyncMock()
    now = datetime.now(timezone.utc)
    mock_conn.fetchval.return_value = now

    val = await get_view_last_modified(mock_conn, "mv_player_season_rankings")
    assert val == now

    # Test error handling fallback
    mock_conn.fetchval.side_effect = Exception("Table not found")
    val_err = await get_view_last_modified(mock_conn, "mv_player_season_rankings")
    assert val_err is None


def test_player_rankings_etag_and_304_revalidation():
    """Verify rankings endpoint sets ETag and responds with 304 Not Modified on match."""
    now = datetime(2025, 5, 20, 12, 0, 0, tzinfo=timezone.utc)
    expected_ts = int(now.timestamp())
    expected_etag = f'W/"rankings-goals-200-20-{expected_ts}"'

    with patch("backend.api.routers.players.get_view_last_modified", return_value=now):
        with patch("backend.api.routers.players.get_database") as mock_db:
            mock_conn = AsyncMock()
            mock_conn.fetch.return_value = [
                {
                    "player_id": 1,
                    "name": "Test Player",
                    "photo_url": None,
                    "nationality": "BRA",
                    "team_id": 10,
                    "team_name": "City",
                    "team_short": "MCI",
                    "goals": 25,
                    "assists": 5,
                    "xg": 23.5,
                    "xa": 4.2,
                    "minutes": 2500,
                    "matches": 30,
                    "shots": 80,
                    "shots_on_target": 40,
                    "key_passes": 20,
                    "goals_per_90": 0.9,
                    "xg_per_90": 0.85,
                    "xa_per_90": 0.15,
                    "shots_per_90": 2.88,
                    "key_passes_per_90": 0.72,
                    "shot_accuracy_pct": 50.0,
                }
            ]
            app.dependency_overrides[get_database] = lambda: mock_conn

            client = TestClient(app)
            
            # 1. Primeira requisição: recebe 200 + ETag + Last-Modified
            resp1 = client.get("/players/rankings")
            assert resp1.status_code == 200
            assert resp1.headers.get("ETag") == expected_etag
            assert "Last-Modified" in resp1.headers

            # 2. Segunda requisição com If-None-Match: deve retornar 304 Not Modified
            resp2 = client.get("/players/rankings", headers={"If-None-Match": expected_etag})
            assert resp2.status_code == 304

            app.dependency_overrides.clear()
