"""
Matches API Router.
Endpoints for match-related operations.
"""

import logging
from typing import Annotated, Optional

import asyncpg
from fastapi import APIRouter, Depends, Path, Query, Response

from backend.api.config import settings
from backend.api.database import get_database, call_match_details
from backend.api.dependencies import not_found_error
from backend.api.models import PaginationParams, PaginatedResponse, LatestMatchInfo

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
    response: Response,
    pagination: PaginationParams = Depends(),
    round: Optional[int] = Query(None, ge=1, le=38, description="Round / Gameweek (1-38)"),
    season_id: Optional[int] = Query(None, ge=1, description="Season ID filter (opcional)"),
    status: Optional[str] = Query(None, pattern="^(scheduled|in_progress|finished|cancelled)$", description="Match status filter"),
    db: asyncpg.Connection = Depends(get_database),
):
    """List matches with scores, teams, and venues using single-query COUNT(*) OVER()."""
    offset = pagination.offset
    limit = pagination.page_size
    response.headers["Cache-Control"] = f"public, max-age={settings.CACHE_TTL_SECONDS}, stale-while-revalidate=60"

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
            COALESCE(v.name, '') as venue_name,
            COUNT(*) OVER() AS total_count
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

    if rows:
        total = rows[0]["total_count"]
        items = [{k: v for k, v in dict(r).items() if k != "total_count"} for r in rows]
    else:
        if offset == 0:
            total = 0
        else:
            count_query = """
                SELECT COUNT(*) FROM match
                WHERE ($1::int IS NULL OR matchday = $1)
                  AND ($2::int IS NULL OR season_id = $2)
                  AND ($3::text IS NULL OR status = $3)
            """
            total = await db.fetchval(count_query, round, season_id, status) or 0
        items = []

    return PaginatedResponse(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + limit - 1) // limit if total > 0 else 0,
    )


@router.get(
    "/latest",
    response_model=LatestMatchInfo,
    summary="Get latest played match and round",
    description="Retorna a última partida finalizada e a última rodada com jogos concluídos.",
)
async def get_latest_match(
    response: Response,
    db: asyncpg.Connection = Depends(get_database),
):
    """Retorna os identificadores mais recentes para inicialização dinâmica do frontend."""
    response.headers["Cache-Control"] = f"public, max-age={settings.CACHE_TTL_SECONDS}, stale-while-revalidate=60"
    query = """
        SELECT match_id, matchday, match_date
        FROM match
        WHERE status = 'finished'
        ORDER BY match_date DESC NULLS LAST, match_id DESC
        LIMIT 1
    """
    row = await db.fetchrow(query)
    if not row:
        # Fallback caso não haja partidas finalizadas
        fallback = await db.fetchrow("SELECT match_id, matchday FROM match ORDER BY match_id ASC LIMIT 1")
        if fallback:
            return {"match_id": fallback["match_id"], "round": fallback["matchday"] or 1}
        return {"match_id": 1, "round": 1}

    return {
        "match_id": row["match_id"],
        "round": row["matchday"] or 1,
        "match_date": row["match_date"].isoformat() if row["match_date"] else None,
    }


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
    response: Response,
    db: asyncpg.Connection = Depends(get_database),
):
    """Get complete match details from fn_api_match_details RPC function."""
    logger.info("Getting details for match_id=%s", match_id)
    response.headers["Cache-Control"] = f"public, max-age={settings.CACHE_TTL_SECONDS}, stale-while-revalidate=60"

    result = await call_match_details(db, match_id)

    if result is None:
        raise not_found_error("Match")

    return result