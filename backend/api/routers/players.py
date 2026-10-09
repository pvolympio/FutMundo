"""
Players API Router.
Endpoints for player-related operations.
"""

import logging
from typing import Annotated, Optional

import asyncpg
from fastapi import APIRouter, Depends, Path, Query

from backend.api.database import get_database, call_player_profile
from backend.api.dependencies import not_found_error
from backend.api.models import PaginationParams, PaginatedResponse

router = APIRouter(
    prefix="/players",
    tags=["Players"],
    responses={404: {"description": "Not found"}},
)

logger = logging.getLogger(__name__)


@router.get(
    "",
    response_model=PaginatedResponse,
    summary="List players with pagination",
    description="List players with optional filters by team and position. Supports pagination via page and page_size parameters.",
)
async def list_players(
    pagination: PaginationParams = Depends(),
    team_id: Optional[int] = Query(None, ge=1, description="Filter by team ID"),
    position: Optional[str] = Query(None, pattern="^(GK|DEF|MID|FW)$", description="Filter by position (GK, DEF, MID, FW)"),
    search: Optional[str] = Query(None, description="Search by player name"),
    db: asyncpg.Connection = Depends(get_database),
):
    """List players with pagination and optional filters."""
    offset = pagination.offset
    limit = pagination.page_size

    # Build query with optional filters
    query = """
        SELECT
            p.player_id,
            COALESCE(p.display_name, p.full_name) as name,
            p.full_name,
            p.shirt_number,
            pth.position_code as position,
            COALESCE(t.short_name, '') as team_short,
            COALESCE(t.canonical_name, '') as team_name,
            EXTRACT(YEAR FROM age(CURRENT_DATE, p.birth_date))::int as age,
            p.market_value_eur,
            p.photo_url
        FROM player p
        LEFT JOIN player_team_history pth ON pth.player_id = p.player_id AND pth.is_current = true
        LEFT JOIN team t ON t.team_id = pth.team_id
        WHERE ($1::int IS NULL OR pth.team_id = $1)
          AND ($2::text IS NULL OR pth.position_code = $2)
          AND ($3::text IS NULL OR p.display_name ILIKE '%' || $3 || '%' OR p.full_name ILIKE '%' || $3 || '%')
        ORDER BY p.shirt_number ASC NULLS LAST, p.display_name ASC
        LIMIT $4 OFFSET $5
    """
    rows = await db.fetch(query, team_id, position, search, limit, offset)
    items = [dict(r) for r in rows]

    # Get total count for pagination
    count_query = """
        SELECT COUNT(*) FROM player p
        LEFT JOIN player_team_history pth ON pth.player_id = p.player_id AND pth.is_current = true
        WHERE ($1::int IS NULL OR pth.team_id = $1)
          AND ($2::text IS NULL OR pth.position_code = $2)
          AND ($3::text IS NULL OR p.display_name ILIKE '%' || $3 || '%' OR p.full_name ILIKE '%' || $3 || '%')
    """
    total = await db.fetchval(count_query, team_id, position, search)

    return PaginatedResponse(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + limit - 1) // limit if total > 0 else 0,
    )


@router.get(
    "/compare",
    response_model=dict,
    summary="Compare two players",
    description="Compare season statistics, radar metrics, and profile info for two players.",
)
async def compare_players(
    p1: Annotated[int, Query(..., description="First Player ID")],
    p2: Annotated[int, Query(..., description="Second Player ID")],
    db: asyncpg.Connection = Depends(get_database),
):
    """Compare two players side-by-side with radar metrics."""
    stat_query = """
        SELECT 
            p.player_id,
            COALESCE(p.display_name, p.full_name) as name,
            p.photo_url,
            p.nationality_code as nationality,
            t.team_id,
            t.canonical_name as team_name,
            t.short_name as team_short,
            COALESCE(SUM(pms.goals), 0)::int as goals,
            COALESCE(SUM(pms.assists), 0)::int as assists,
            COALESCE(ROUND(SUM(pms.xg)::numeric, 2), 0)::float as xg,
            COALESCE(ROUND(SUM(pms.xa)::numeric, 2), 0)::float as xa,
            COALESCE(SUM(pms.minutes), 0)::int as minutes,
            COUNT(DISTINCT pms.match_id)::int as matches,
            COALESCE(SUM((pms.stats->>'shots')::int), 0)::int as shots,
            COALESCE(SUM((pms.stats->>'shots_on_target')::int), 0)::int as shots_on_target,
            COALESCE(SUM((pms.stats->>'key_passes')::int), 0)::int as key_passes
        FROM player p
        JOIN gold_player_match_stats pms ON pms.player_id = p.player_id AND pms.stat_type = 'standard'
        LEFT JOIN team t ON t.team_id = pms.team_id
        WHERE p.player_id = $1
        GROUP BY p.player_id, p.display_name, p.full_name, p.photo_url, p.nationality_code, t.team_id, t.canonical_name, t.short_name
        ORDER BY minutes DESC
        LIMIT 1
    """
    row1 = await db.fetchrow(stat_query, p1)
    row2 = await db.fetchrow(stat_query, p2)

    def calc_metrics(r):
        if not r:
            return {}
        mins = r["minutes"]
        m90 = mins / 90.0 if mins > 0 else 1.0
        shots = r["shots"]
        goals = r["goals"]
        return {
            **dict(r),
            "goals_per_90": round(goals / m90, 2),
            "xg_per_90": round(r["xg"] / m90, 2),
            "xa_per_90": round(r["xa"] / m90, 2),
            "shots_per_90": round(shots / m90, 2),
            "key_passes_per_90": round(r["key_passes"] / m90, 2),
            "shot_accuracy_pct": round(r["shots_on_target"] / shots * 100, 1) if shots > 0 else 0.0,
            "conversion_rate_pct": round(goals / shots * 100, 1) if shots > 0 else 0.0,
        }

    return {
        "player_a": calc_metrics(row1),
        "player_b": calc_metrics(row2),
    }


@router.get(
    "/rankings",
    response_model=list[dict],
    summary="Player leaderboards and rankings",
    description="Ranking dos atletas da Premier League por gols, assistências, xG, xA ou métricas por 90'.",
)
async def get_player_rankings(
    metric: str = Query("goals", pattern="^(goals|assists|xg|xa|shots|key_passes|goals_per_90|xg_per_90)$", description="Métrica para ordenação"),
    limit: int = Query(20, ge=1, le=100, description="Quantidade de atletas no ranking"),
    min_minutes: int = Query(200, ge=0, description="Mínimo de minutos jogados"),
    db: asyncpg.Connection = Depends(get_database),
):
    """Rank players by standard and per-90 metrics."""
    query = """
        SELECT 
            p.player_id,
            COALESCE(p.display_name, p.full_name) as name,
            p.photo_url,
            p.nationality_code as nationality,
            t.team_id,
            t.canonical_name as team_name,
            t.short_name as team_short,
            COALESCE(SUM(g.goals), 0)::int as goals,
            COALESCE(SUM(g.assists), 0)::int as assists,
            COALESCE(ROUND(SUM(g.xg)::numeric, 2), 0)::float as xg,
            COALESCE(ROUND(SUM(g.xa)::numeric, 2), 0)::float as xa,
            COALESCE(SUM(g.minutes), 0)::int as minutes,
            COUNT(DISTINCT g.match_id)::int as matches,
            COALESCE(SUM((g.stats->>'shots')::int), 0)::int as shots,
            COALESCE(SUM((g.stats->>'shots_on_target')::int), 0)::int as shots_on_target,
            COALESCE(SUM((g.stats->>'key_passes')::int), 0)::int as key_passes
        FROM gold_player_match_stats g
        JOIN player p ON p.player_id = g.player_id
        JOIN team t ON t.team_id = g.team_id
        WHERE g.stat_type = 'standard'
        GROUP BY p.player_id, p.display_name, p.full_name, p.photo_url, p.nationality_code, t.team_id, t.canonical_name, t.short_name
        HAVING SUM(g.minutes) >= $1
    """
    rows = await db.fetch(query, min_minutes)
    results = []
    for r in rows:
        d = dict(r)
        mins = d["minutes"]
        m90 = mins / 90.0 if mins > 0 else 1.0
        shots = d["shots"]
        goals = d["goals"]
        d["goals_per_90"] = round(goals / m90, 2)
        d["xg_per_90"] = round(d["xg"] / m90, 2)
        d["xa_per_90"] = round(d["xa"] / m90, 2)
        d["shots_per_90"] = round(shots / m90, 2)
        d["key_passes_per_90"] = round(d["key_passes"] / m90, 2)
        d["shot_accuracy_pct"] = round(d["shots_on_target"] / shots * 100, 1) if shots > 0 else 0.0
        results.append(d)

    # Sort with tie-breakers
    def sort_key(item):
        val = item.get(metric, 0)
        tie = item.get("xg", 0) if metric == "goals" else item.get("xa", 0) if metric == "assists" else item.get("goals", 0)
        return (val, tie)

    results.sort(key=sort_key, reverse=True)
    ranked = []
    for idx, item in enumerate(results[:limit]):
        ranked.append({"rank": idx + 1, **item})
    return ranked


@router.get(
    "/{player_id}",
    response_model=dict,
    summary="Get player profile",
    description="Get complete player profile including current club, market value history, "
                "career teams, injuries, and current season statistics.",
    responses={
        200: {"description": "Player profile retrieved successfully"},
        404: {"description": "Player not found"},
    },
)
async def get_player_profile(
    player_id: Annotated[int, Path(..., description="Player ID")],
    db: asyncpg.Connection = Depends(get_database),
):
    """Get complete player profile from fn_api_player_profile RPC function."""
    logger.info("Getting profile for player_id=%s", player_id)

    result = await call_player_profile(db, player_id)

    if result is None:
        raise not_found_error("Player")

    return result


@router.get(
    "/{player_id}/shots",
    response_model=list[dict],
    summary="Get player shot events",
    description="Get all individual shot events for a player with coordinates and metadata.",
)
async def get_player_shots(
    player_id: Annotated[int, Path(..., description="Player ID")],
    db: asyncpg.Connection = Depends(get_database),
):
    """Get all shots taken by this player in the season with xg and situation."""
    query = """
        SELECT 
            me.event_id,
            me.match_id,
            me.minute,
            me.second,
            me.x::float as x,
            me.y::float as y,
            me.body_part,
            me.shot_result,
            me.is_penalty,
            me.is_own_goal,
            ROUND(COALESCE((me.qualifiers->>'xg')::numeric, 0), 3)::float as xg,
            me.qualifiers->>'situation' as situation,
            COALESCE(p_ast.display_name, p_ast.full_name) as assist_name,
            m.match_date,
            opp.short_name as opponent_name
        FROM match_event me
        JOIN match m ON m.match_id = me.match_id
        JOIN team opp ON opp.team_id = CASE WHEN me.team_id = m.home_team_id THEN m.away_team_id ELSE m.home_team_id END
        LEFT JOIN player p_ast ON p_ast.player_id = me.assist_player_id
        WHERE me.player_id = $1 AND me.event_type = 'shot'
        ORDER BY m.match_date ASC, me.minute ASC
    """
    rows = await db.fetch(query, player_id)
    return [dict(r) for r in rows]


@router.get(
    "/{player_id}/stats",
    response_model=dict,
    summary="Get player season summary statistics",
    description="Get consolidated Gold layer statistics for a player.",
)
async def get_player_season_stats(
    player_id: Annotated[int, Path(..., description="Player ID")],
    db: asyncpg.Connection = Depends(get_database),
):
    """Get season totals from gold_player_match_stats with per-90 metrics."""
    query = """
        SELECT 
            COALESCE(SUM(goals), 0)::int as goals,
            COALESCE(SUM(assists), 0)::int as assists,
            COALESCE(ROUND(SUM(xg)::numeric, 2), 0)::float as xg,
            COALESCE(ROUND(SUM(xa)::numeric, 2), 0)::float as xa,
            COALESCE(SUM(minutes), 0)::int as minutes,
            COUNT(DISTINCT match_id)::int as matches,
            COALESCE(SUM((stats->>'shots')::int), 0)::int as shots,
            COALESCE(SUM((stats->>'shots_on_target')::int), 0)::int as shots_on_target,
            COALESCE(SUM((stats->>'key_passes')::int), 0)::int as key_passes
        FROM gold_player_match_stats
        WHERE player_id = $1 AND stat_type = 'standard'
    """
    row = await db.fetchrow(query, player_id)
    if not row:
        return {}
    r = dict(row)
    mins = r["minutes"]
    m90 = mins / 90.0 if mins > 0 else 1.0
    shots = r["shots"]
    goals = r["goals"]
    r["goals_per_90"] = round(goals / m90, 2)
    r["xg_per_90"] = round(r["xg"] / m90, 2)
    r["xa_per_90"] = round(r["xa"] / m90, 2)
    r["shots_per_90"] = round(shots / m90, 2)
    r["key_passes_per_90"] = round(r["key_passes"] / m90, 2)
    r["shot_accuracy_pct"] = round(r["shots_on_target"] / shots * 100, 1) if shots > 0 else 0.0
    r["conversion_rate_pct"] = round(goals / shots * 100, 1) if shots > 0 else 0.0
    return r