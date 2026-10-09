"""
Search API Router.
Global search endpoint for players and teams.
"""

import logging

import asyncpg
from fastapi import APIRouter, Depends, Query

from backend.api.database import get_database, call_search_entities
from backend.api.models import SearchResponse, SearchResult

router = APIRouter(
    prefix="/search",
    tags=["Search"],
)

logger = logging.getLogger(__name__)


@router.get(
    "",
    response_model=SearchResponse,
    summary="Global search",
    description="Search for players and teams by name using fuzzy matching.",
    responses={
        200: {"description": "Search completed successfully"},
    },
)
async def search_entities(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results to return"),
    db: asyncpg.Connection = Depends(get_database),
):
    """
    Search for players and teams using the search_entities RPC function.
    Uses PostgreSQL full-text search with trigram similarity for fuzzy matching.
    """
    logger.info("Searching for query=%s, limit=%s", q, limit)

    results = await call_search_entities(db, q, limit)

    return SearchResponse(
        results=[SearchResult(**r) for r in results] if results else [],
        total=len(results) if results else 0,
    )