"""
Matches API Router.
Endpoints for match-related operations.
"""

import logging
from typing import Annotated, Optional

import asyncpg
from fastapi import APIRouter, Depends, Path, Query

from backend.api.database import get_database, call_match_details
from backend.api.dependencies import not_found_error
from backend.api.models import PaginationParams, PaginatedResponse

router = APIRouter(
    prefix="/matches",
    tags=["Matches"],
    responses={404: {"description": "Not found"}},
)

logger = logging.getLogger(__name__)


@router.get(
    "",
    response_model=PaginatedResponse,
    summary="List matches with pagination",
    description="List matches filtered by round / matchday (1-38). Supports pagination via page and page_size parameters.",
)
async def list_matches(
    pagination: PaginationParams = Depends(),
    round: Optional[int] = Query(None, ge=1, le=38, description="Round / Gameweek (1-38)"),
    season_id: Optional[int] = Query(None, ge=1, description="Season ID filter (opcional)"),
    status: Optional[str] = Query(None, pattern="^(scheduled|in_progress|finished|cancelled)$", description="Match status filter"),
    db: asyncpg.Connection = Depends(get_database),
):
    """List matches with scores, teams, and venues with pagination support."""
    offset = pagination.offset
    limit = pagination.page_size

    # Build query with optional filters
    query = """
        SELECT
            m.match_id,
            m.matchday,
            m.match_date,
            m.status,
            m.home_score,
            m.away_score,
            th.team_id as home_team_id,
            th.canonical_name as home_team_name,
            th.short_name as home_team_short,
            ta.team_id as away_team_id,
            ta.canonical_name as away_team_name,
            ta.short_name as away_team_short,
            COALESCE(v.name, '') as venue_name
        FROM match m
        JOIN team th ON th.team_id = m.home_team_id
        JOIN team ta ON ta.team_id = m.away_team_id
        LEFT JOIN venue v ON v.venue_id = m.venue_id
        WHERE ($1::int IS NULL OR m.matchday = $1)
          AND ($2::int IS NULL OR m.season_id = $2)
          AND ($3::text IS NULL OR m.status = $3)
        ORDER BY m.matchday ASC, m.match_date ASC
        LIMIT $4 OFFSET $5
    """
    rows = await db.fetch(query, round, season_id, status, limit, offset)
    items = [dict(r) for r in rows]

    # Get total count for pagination
    count_query = """
        SELECT COUNT(*) FROM match
        WHERE ($1::int IS NULL OR matchday = $1)
          AND ($2::int IS NULL OR season_id = $2)
          AND ($3::text IS NULL OR status = $3)
    """
    total = await db.fetchval(count_query, round, season_id, status)

    return PaginatedResponse(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + limit - 1) // limit if total > 0 else 0,
    )


@router.get(
    "/{match_id}",
    response_model=dict,
    summary="Get match details",
    description="Get complete match details including lineups, timeline, statistics, odds, and officials.",
    responses={
        200: {"description": "Match details retrieved successfully"},
        404: {"description": "Match not found"},
    },
)
async def get_match_details(
    match_id: Annotated[int, Path(..., description="Match ID")],
    db: asyncpg.Connection = Depends(get_database),
):
    """Get complete match details from fn_api_match_details RPC function."""
    logger.info("Getting details for match_id=%s", match_id)

    result = await call_match_details(db, match_id)

    if result is None:
        raise not_found_error("Match")

    return result