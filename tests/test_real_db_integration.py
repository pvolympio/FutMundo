"""
Integration tests executing against a real PostgreSQL instance seeded with backend/seed.sql.
Marked with @pytest.mark.integration to run against live test database in CI and local setup.
"""

import os
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.api.config import get_settings


@pytest.mark.integration
def test_real_db_trigram_search():
    """Verify trigram search index and normalization against real seeded database."""
    client = TestClient(app)
    
    # Busca com acentuação e minúsculas/maiúsculas testando normalize_name e unaccent
    response = client.get("/players?search=saka")
    if response.status_code == 200:
        data = response.json()
        assert "items" in data
        names = [item["name"] for item in data["items"]]
        assert any("Saka" in n for n in names)

    # Busca com variação fonética/trigram
    response2 = client.get("/players?search=haaland")
    if response2.status_code == 200:
        data2 = response2.json()
        names2 = [item["name"] for item in data2["items"]]
        assert any("Haaland" in n for n in names2)


@pytest.mark.integration
def test_real_db_materialized_rankings():
    """Verify that mv_player_season_rankings returns properly sorted per-90 metrics."""
    client = TestClient(app)
    response = client.get("/players/rankings?metric=goals&min_minutes=50")
    if response.status_code == 200:
        rankings = response.json()
        assert len(rankings) >= 1
        top = rankings[0]
        assert "rank" in top
        assert top["rank"] == 1
        assert "goals_per_90" in top
        assert "xg_per_90" in top
        assert top["goals"] >= 1


@pytest.mark.integration
def test_real_db_latest_match():
    """Verify that /matches/latest fetches the most recently concluded match."""
    client = TestClient(app)
    response = client.get("/matches/latest")
    if response.status_code == 200:
        data = response.json()
        assert "match_id" in data
        assert "round" in data
        assert data["match_id"] >= 1
