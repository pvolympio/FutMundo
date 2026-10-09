"""
Teams API Router.
Endpoints for team-related operations.
"""

import logging
from typing import Annotated, Optional

import asyncpg
from fastapi import APIRouter, Depends, Query, Path

from backend.api.dependencies import not_found_error
from backend.api.models import (
    HeadToHeadResponse,
    TeamProfile,
    TeamSeasonResponse,
    PaginationParams,
    PaginatedResponse,
)
from backend.api.database import get_database, call_team_profile, call_team_head_to_head

router = APIRouter(
    prefix="/teams",
    tags=["Teams"],
    responses={404: {"description": "Not found"}},
)

logger = logging.getLogger(__name__)


@router.get(
    "",
    response_model=PaginatedResponse,
    summary="List all teams with pagination",
    description="Get list of all Premier League teams with stadium and city information. Supports pagination via page and page_size parameters.",
)
async def list_teams(
    pagination: PaginationParams = Depends(),
    search: Optional[str] = Query(None, description="Filter by team name"),
    db: asyncpg.Connection = Depends(get_database),
):
    """List all teams in the competition with pagination."""
    offset = pagination.offset
    limit = pagination.page_size

    # Build query with optional search filter
    query = """
        SELECT
            t.team_id,
            t.canonical_name,
            t.short_name,
            t.slug,
            t.crest_url,
            COALESCE(v.name, '') as venue_name,
            COALESCE(v.city, '') as city
        FROM team t
        LEFT JOIN venue v ON v.venue_id = t.venue_id
        WHERE ($3::text IS NULL OR t.canonical_name ILIKE '%' || $3 || '%')
        ORDER BY t.canonical_name ASC
        LIMIT $1 OFFSET $2
    """
    rows = await db.fetch(query, limit, offset, search)
    items = [dict(r) for r in rows]

    # Get total count for pagination
    count_query = """
        SELECT COUNT(*) FROM team
        WHERE ($1::text IS NULL OR canonical_name ILIKE '%' || $1 || '%')
    """
    total = await db.fetchval(count_query, search)

    return PaginatedResponse(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + limit - 1) // limit if total > 0 else 0,
    )


@router.get(
    "/{team_id}",
    response_model=TeamProfile,
    summary="Get team profile",
    description="Get complete team profile including squad, manager, form, and recent matches.",
    responses={
        200: {"description": "Team profile retrieved successfully"},
        404: {"description": "Team not found"},
    },
)
async def get_team_profile(
    team_id: Annotated[int, Path(..., ge=1, description="Team ID (deve ser positivo)")],
    season_id: Optional[int] = Query(None, ge=1, description="Season ID (opcional, deve ser positivo)"),
    db: asyncpg.Connection = Depends(get_database),
):
    """Get complete team profile from fn_api_team_profile RPC function."""
    logger.info("Getting profile for team_id=%s, season_id=%s", team_id, season_id)

    result = await call_team_profile(db, team_id, season_id)

    if result is None:
        raise not_found_error("Team")

    return result


def _f(value, digits: int = 2) -> float:
    return round(float(value), digits) if value is not None else 0.0


@router.get(
    "/{team_id}/season",
    response_model=TeamSeasonResponse,
    summary="Team season overview",
    description="Resultados jogo a jogo, resumo agregado (pontos, gols, xG) e elenco real derivado das súmulas.",
    responses={404: {"description": "Team not found"}},
)
async def get_team_season(
    team_id: Annotated[int, Path(..., ge=1, description="Team ID")],
    season_id: Optional[int] = Query(None, ge=1, description="Season ID (padrão: mais recente do time)"),
    db: asyncpg.Connection = Depends(get_database),
):
    """Season matches, aggregate summary and squad for a team."""
    if not await db.fetchval("SELECT 1 FROM team WHERE team_id = $1", team_id):
        raise not_found_error("Team")

    if season_id is None:
        season_id = await db.fetchval(
            """
            SELECT s.season_id FROM season s
            WHERE EXISTS (
                SELECT 1 FROM match m WHERE m.season_id = s.season_id
                  AND m.status = 'finished' AND $1 IN (m.home_team_id, m.away_team_id)
            )
            ORDER BY s.is_current DESC, s.start_date DESC NULLS LAST, s.season_id DESC
            LIMIT 1
            """,
            team_id,
        )

    summary = {
        "matches": 0, "wins": 0, "draws": 0, "losses": 0, "points": 0,
        "goals_for": 0, "goals_against": 0, "goal_difference": 0, "clean_sheets": 0,
        "xg_for": 0.0, "xg_against": 0.0, "xg_difference": 0.0, "goals_minus_xg": 0.0,
        "avg_xg_for": 0.0, "avg_xg_against": 0.0, "shots_for": 0, "shots_against": 0,
    }
    if season_id is None:
        return {"team_id": team_id, "season_id": None, "season_name": None,
                "summary": summary, "matches": [], "squad": []}

    season_name = await db.fetchval("SELECT name FROM season WHERE season_id = $1", season_id)

    match_rows = await db.fetch(
        """
        SELECT m.match_id, m.matchday, m.match_date,
               (m.home_team_id = $1) AS is_home,
               o.team_id AS opponent_id, o.canonical_name AS opponent,
               CASE WHEN m.home_team_id = $1 THEN m.home_score ELSE m.away_score END AS goals_for,
               CASE WHEN m.home_team_id = $1 THEN m.away_score ELSE m.home_score END AS goals_against,
               ts.xg AS xg_for, ts.shots AS shots_for,
               os.xg AS xg_against, os.shots AS shots_against
        FROM match m
        JOIN team o ON o.team_id = CASE WHEN m.home_team_id = $1 THEN m.away_team_id ELSE m.home_team_id END
        LEFT JOIN gold_team_match_stats ts
               ON ts.match_id = m.match_id AND ts.team_id = $1 AND ts.stat_type = 'standard'
        LEFT JOIN gold_team_match_stats os
               ON os.match_id = m.match_id AND os.team_id = o.team_id AND os.stat_type = 'standard'
        WHERE m.season_id = $2 AND m.status = 'finished'
          AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
          AND $1 IN (m.home_team_id, m.away_team_id)
        ORDER BY m.match_date, m.match_id
        """,
        team_id, season_id,
    )

    matches = []
    for r in match_rows:
        gf, ga = int(r["goals_for"]), int(r["goals_against"])
        result = "V" if gf > ga else "E" if gf == ga else "D"
        xg_for = _f(r["xg_for"]) if r["xg_for"] is not None else None
        xg_against = _f(r["xg_against"]) if r["xg_against"] is not None else None
        matches.append({
            "match_id": r["match_id"], "matchday": r["matchday"], "date": r["match_date"],
            "is_home": r["is_home"], "opponent_id": r["opponent_id"], "opponent": r["opponent"],
            "goals_for": gf, "goals_against": ga, "result": result,
            "xg_for": xg_for, "xg_against": xg_against,
            "shots_for": r["shots_for"], "shots_against": r["shots_against"],
        })
        summary["matches"] += 1
        summary[{"V": "wins", "E": "draws", "D": "losses"}[result]] += 1
        summary["points"] += 3 if result == "V" else 1 if result == "E" else 0
        summary["goals_for"] += gf
        summary["goals_against"] += ga
        summary["clean_sheets"] += 1 if ga == 0 else 0
        summary["xg_for"] += xg_for or 0.0
        summary["xg_against"] += xg_against or 0.0
        summary["shots_for"] += r["shots_for"] or 0
        summary["shots_against"] += r["shots_against"] or 0

    n = summary["matches"]
    summary["goal_difference"] = summary["goals_for"] - summary["goals_against"]
    summary["xg_for"] = round(summary["xg_for"], 2)
    summary["xg_against"] = round(summary["xg_against"], 2)
    summary["xg_difference"] = round(summary["xg_for"] - summary["xg_against"], 2)
    summary["goals_minus_xg"] = round(summary["goals_for"] - summary["xg_for"], 2)
    summary["avg_xg_for"] = round(summary["xg_for"] / n, 2) if n else 0.0
    summary["avg_xg_against"] = round(summary["xg_against"] / n, 2) if n else 0.0

    squad_rows = await db.fetch(
        """
        WITH app AS (
            SELECT pa.player_id,
                   COUNT(DISTINCT pa.match_id)::int AS appearances,
                   COUNT(*) FILTER (WHERE pa.is_starter)::int AS starts,
                   COALESCE(SUM(pa.minutes_played), 0)::int AS minutes,
                   MODE() WITHIN GROUP (ORDER BY pa.position_code) AS position_code
            FROM player_appearance pa
            JOIN match m ON m.match_id = pa.match_id
            WHERE pa.team_id = $1 AND m.season_id = $2 AND m.status = 'finished'
            GROUP BY pa.player_id
        ),
        prod AS (
            SELECT g.player_id,
                   COALESCE(SUM(g.goals), 0)::int AS goals,
                   COALESCE(SUM(g.assists), 0)::int AS assists,
                   COALESCE(SUM(g.xg), 0) AS xg,
                   COALESCE(SUM(g.xa), 0) AS xa
            FROM gold_player_match_stats g
            JOIN match m ON m.match_id = g.match_id
            WHERE g.team_id = $1 AND m.season_id = $2
            GROUP BY g.player_id
        )
        SELECT p.player_id, COALESCE(p.display_name, p.full_name) AS name,
               p.nationality_code AS nationality, p.photo_url,
               app.position_code, dp.name AS position_name, dp.line,
               app.appearances, app.starts, app.minutes,
               COALESCE(prod.goals, 0) AS goals, COALESCE(prod.assists, 0) AS assists,
               COALESCE(prod.xg, 0) AS xg, COALESCE(prod.xa, 0) AS xa
        FROM app
        JOIN player p ON p.player_id = app.player_id
        LEFT JOIN prod ON prod.player_id = app.player_id
        LEFT JOIN dim_position dp ON dp.position_code = app.position_code
        ORDER BY app.minutes DESC, name
        """,
        team_id, season_id,
    )
    squad = [
        {**dict(r), "xg": _f(r["xg"]), "xa": _f(r["xa"])}
        for r in squad_rows
    ]

    return {
        "team_id": team_id, "season_id": season_id, "season_name": season_name,
        "summary": summary, "matches": matches, "squad": squad,
    }


@router.get(
    "/{team_id}/head-to-head/{team_b_id}",
    response_model=HeadToHeadResponse,
    summary="Head-to-head between teams",
    description="Get head-to-head statistics between two teams including recent matches.",
    responses={
        200: {"description": "Head-to-head data retrieved successfully"},
        404: {"description": "Team not found"},
    },
)
async def get_head_to_head(
    team_id: Annotated[int, Path(..., ge=1, description="First team ID (team A)")],
    team_b_id: Annotated[int, Path(..., ge=1, description="Second team ID (team B)")],
    limit: int = Query(10, ge=1, le=100, description="Number of recent matches to return"),
    db: asyncpg.Connection = Depends(get_database),
):
    """Get head-to-head statistics between two teams using fn_team_head_to_head RPC function."""
    logger.info("Getting H2H for team_a=%s, team_b=%s, limit=%s", team_id, team_b_id, limit)

    result = await call_team_head_to_head(db, team_id, team_b_id, limit)

    if result is None or result.get("team_a") is None or result.get("team_b") is None:
        raise not_found_error("Time")

    return result