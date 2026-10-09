"""
Integration tests for pagination, filters, and SQL optimizations.
Requires database connection.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_players_pagination_and_total(async_client: AsyncClient):
    """Test /players pagination with page_size and total count."""
    response = await async_client.get("/players?page=1&page_size=5")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "total_pages" in data
    assert data["page"] == 1
    assert data["page_size"] == 5
    assert len(data["items"]) <= 5
    if data["items"]:
        # Ensure total_count window column is not leaked in final item dict
        assert "total_count" not in data["items"][0]
        assert "name" in data["items"][0]


@pytest.mark.anyio
async def test_players_position_filter(async_client: AsyncClient):
    """Test /players filter by position code (MID, DEF, FW, GK)."""
    response = await async_client.get("/players?position=MID&page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    for item in data["items"]:
        assert item["position"] == "MID"


@pytest.mark.anyio
async def test_players_rankings_metrics(async_client: AsyncClient):
    """Test /players/rankings with goals, assists and goals_per_90."""
    response_goals = await async_client.get("/players/rankings?metric=goals&limit=5")
    assert response_goals.status_code == 200
    rankings_goals = response_goals.json()
    assert isinstance(rankings_goals, list)
    if rankings_goals:
        assert rankings_goals[0]["rank"] == 1
        assert "goals" in rankings_goals[0]
        assert "goals_per_90" in rankings_goals[0]

    response_p90 = await async_client.get("/players/rankings?metric=goals_per_90&limit=5")
    assert response_p90.status_code == 200
    rankings_p90 = response_p90.json()
    assert isinstance(rankings_p90, list)


@pytest.mark.anyio
async def test_matches_latest_endpoint(async_client: AsyncClient):
    """Test /matches/latest returns match_id and round."""
    response = await async_client.get("/matches/latest")
    assert response.status_code == 200
    data = response.json()
    assert "match_id" in data
    assert "round" in data
    assert isinstance(data["match_id"], int)
    assert isinstance(data["round"], int)


@pytest.mark.anyio
async def test_cache_control_headers(async_client: AsyncClient):
    """Verify that historical and analytical endpoints include Cache-Control headers."""
    response = await async_client.get("/players/rankings?metric=goals&limit=10")
    assert response.status_code == 200
    cache_header = response.headers.get("Cache-Control", "")
    assert "public" in cache_header
    assert "max-age" in cache_header
