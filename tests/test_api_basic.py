"""
Basic tests for FUTFUT API.
These tests verify the API structure without requiring a database.
"""

import pytest
from fastapi.testclient import TestClient


def test_api_imports():
    """Test that all API modules can be imported."""
    from backend.api import __version__
    assert __version__ == "1.0.0"
    
    from backend.api.config import settings
    assert settings.PROJECT_NAME == "FUTFUT API"
    
    from backend.api.main import app
    assert app.title == "FUTFUT API"


def test_models_import():
    """Test that all models can be imported."""
    from backend.api.models import (
        APIResponse,
        ErrorResponse,
        TeamProfile,
        PlayerProfile,
        MatchDetails,
        StandingsResponse,
        SearchResponse,
    )


def test_database_functions():
    """Test that database functions are defined."""
    from backend.api.database import (
        get_database,
        get_pool,
        close_pool,
        call_team_profile,
        call_player_profile,
        call_match_details,
        call_team_head_to_head,
        call_search_entities,
        call_standings_at_round,
    )


def test_routers_exist():
    """Test that all routers are defined."""
    from backend.api.routers import (
        teams_router,
        players_router,
        matches_router,
        search_router,
        standings_router,
    )


def test_app_routes():
    """Test that all routes are registered."""
    from backend.api.main import app
    
    routes = list(app.openapi()["paths"].keys())
    
    assert "/" in routes
    assert "/health" in routes
    assert "/teams/{team_id}" in routes
    assert "/players/{player_id}" in routes
    assert "/matches/{match_id}" in routes
    assert "/search" in routes
    assert "/standings/{competition_id}/{season_id}" in routes


def test_openapi_schema():
    """Test that OpenAPI schema is generated."""
    from backend.api.main import app
    
    # The app should have an OpenAPI schema
    assert app.openapi_url is not None
    schema = app.openapi()
    assert "paths" in schema
    assert "info" in schema


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
