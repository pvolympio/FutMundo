"""
Test suite for FUTFUT API.
These tests are minimal and don't require a database connection.
"""

import pytest
from fastapi.testclient import TestClient

from backend.api.main import app


def test_health_check():
    """Test health check endpoint."""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_root_endpoint():
    """Test root endpoint."""
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "FUTFUT API"
    assert "endpoints" in data


def test_openapi_schema():
    """Test that OpenAPI schema is generated correctly."""
    client = TestClient(app)
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "paths" in schema
    assert "info" in schema
    assert schema["info"]["title"] == "FUTFUT API"