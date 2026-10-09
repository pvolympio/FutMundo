"""
Testes de integração para FUTFUT API.
Testam endpoints com async client e verificam estrutura de resposta.
NOTA: Estes testes requerem um banco de dados real para endpoints que usam depends(get_database).
Os testes que não precisam de banco podem ser executados com mocks.
"""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

from backend.api.main import app


@pytest.mark.anyio
async def test_health_check_returns_healthy_status(async_client: AsyncClient):
    """Test health check returns healthy status."""
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "version" in data


@pytest.mark.anyio
async def test_root_endpoint_structure(async_client: AsyncClient):
    """Test root endpoint returns correct structure."""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "FUTFUT API"
    assert "version" in data
    assert "endpoints" in data
    assert "teams" in data["endpoints"]
    assert "players" in data["endpoints"]
    assert "matches" in data["endpoints"]


@pytest.mark.anyio
async def test_teams_endpoint_pagination(async_client: AsyncClient):
    """Test teams endpoint supports pagination."""
    response = await async_client.get("/teams?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "total_pages" in data


@pytest.mark.anyio
async def test_teams_endpoint_with_search(async_client: AsyncClient):
    """Test teams endpoint with search filter."""
    response = await async_client.get("/teams?search=Arsenal&page=1&page_size=5")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


@pytest.mark.anyio
async def test_matches_endpoint_pagination(async_client: AsyncClient):
    """Test matches endpoint supports pagination."""
    response = await async_client.get("/matches?round=1&page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "total_pages" in data


@pytest.mark.anyio
async def test_matches_endpoint_with_status_filter(async_client: AsyncClient):
    """Test matches endpoint with status filter."""
    response = await async_client.get("/matches?status=finished&page=1&page_size=5")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


@pytest.mark.anyio
async def test_players_endpoint_pagination(async_client: AsyncClient):
    """Test players endpoint supports pagination."""
    response = await async_client.get("/players?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "total_pages" in data


@pytest.mark.anyio
async def test_players_endpoint_with_position_filter(async_client: AsyncClient):
    """Test players endpoint with position filter."""
    response = await async_client.get("/players?position=GK&page=1&page_size=5")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


@pytest.mark.anyio
async def test_openapi_schema_is_valid(async_client: AsyncClient):
    """Test OpenAPI schema is generated correctly."""
    response = await async_client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "paths" in schema
    assert "info" in schema
    assert schema["info"]["title"] == "FUTFUT API"


@pytest.mark.anyio
async def test_security_headers_present(async_client: AsyncClient):
    """Test security headers are present in responses."""
    response = await async_client.get("/health")
    assert "X-Content-Type-Options" in response.headers
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "X-Frame-Options" in response.headers
    assert response.headers["X-Frame-Options"] == "DENY"


@pytest.mark.anyio
async def test_api_error_response_format(async_client: AsyncClient):
    """Test API returns consistent error format for non-existent resources."""
    response = await async_client.get("/teams/999999")
    # Should return 404 for non-existent team
    assert response.status_code == 404


@pytest.mark.anyio
async def test_validation_error_on_invalid_input(async_client: AsyncClient):
    """Test API returns 422 for invalid input."""
    # page_size must be >= 1 and <= 100
    response = await async_client.get("/teams?page=1&page_size=200")
    assert response.status_code == 422


@pytest.mark.anyio
async def test_matches_with_both_filters(async_client: AsyncClient):
    """Test matches endpoint with multiple filters."""
    response = await async_client.get("/matches?round=5&status=finished&season_id=1&page=1&page_size=20")
    assert response.status_code == 200


@pytest.mark.anyio
async def test_match_details_timeline_enriched_shots(async_client: AsyncClient):
    """Test match details returns shots with xg and situation from fn_api_match_details."""
    response = await async_client.get("/matches/50")
    assert response.status_code == 200
    data = response.json()
    assert "timeline" in data
    shots = [e for e in data["timeline"] if e.get("event_type") == "shot"]
    assert len(shots) > 0
    # First shot must have numeric xg and non-empty situation
    assert shots[0].get("xg") is not None
    assert isinstance(shots[0]["xg"], (int, float))
    assert shots[0].get("situation") is not None


@pytest.mark.anyio
async def test_player_stats_gold_layer(async_client: AsyncClient):
    """Test player season stats endpoint reads from gold layer and calculates per-90 metrics."""
    response = await async_client.get("/players/338/stats")
    assert response.status_code == 200
    data = response.json()
    assert "goals" in data
    assert "xg" in data
    assert "shots" in data
    assert "goals_per_90" in data
    assert data["matches"] > 0


@pytest.mark.anyio
async def test_team_season_overview(async_client: AsyncClient):
    """Season endpoint: 38 matches, consistent with standings, real squad from appearances."""
    response = await async_client.get("/teams/18/season")
    assert response.status_code == 200
    data = response.json()
    assert data["season_name"] == "2024-25"
    assert len(data["matches"]) == 38
    s = data["summary"]
    assert s["matches"] == 38
    assert s["wins"] + s["draws"] + s["losses"] == 38
    assert s["points"] == s["wins"] * 3 + s["draws"]
    profile = (await async_client.get("/teams/18")).json()
    assert s["goals_for"] == profile["standings"]["goals_for"]
    assert s["points"] == profile["standings"]["points"]
    assert len(data["squad"]) > 15
    # Production must not be double counted (own goals make player sum <= team goals)
    assert sum(p["goals"] for p in data["squad"]) <= s["goals_for"]


@pytest.mark.anyio
async def test_team_season_not_found(async_client: AsyncClient):
    response = await async_client.get("/teams/999999/season")
    assert response.status_code == 404


@pytest.mark.anyio
async def test_player_rankings_goals(async_client: AsyncClient):
    """Test player rankings endpoint returns top scorers."""
    response = await async_client.get("/players/rankings?metric=goals&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 10
    top = data[0]
    assert top["rank"] == 1
    assert top["goals"] >= data[1]["goals"]
    assert top["player_id"] == 327  # Salah (29 goals)
    assert top["team_short"] == "Liverpool"


@pytest.mark.anyio
async def test_player_compare_teams(async_client: AsyncClient):
    """Test player compare endpoint returns team names and valid radar metrics."""
    response = await async_client.get("/players/compare?p1=338&p2=327")
    assert response.status_code == 200
    data = response.json()
    assert "player_a" in data and "player_b" in data
    assert data["player_a"]["team_short"] == "Man City"
    assert data["player_b"]["team_short"] == "Liverpool"
    assert data["player_a"]["goals_per_90"] > 0
    assert data["player_b"]["goals_per_90"] > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])