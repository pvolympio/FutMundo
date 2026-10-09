"""
Standings API Router.
Endpoints for league standings.
"""

import logging
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Query, Path

from backend.api.database import get_database, call_standings_at_round
from backend.api.models import StandingsResponse, LeagueStanding

router = APIRouter(
    prefix="/standings",
    tags=["Standings"],
)

logger = logging.getLogger(__name__)


@router.get(
    "/{competition_id}/{season_id}",
    response_model=StandingsResponse,
    summary="Get league standings",
    description="Get league standings for a specific competition and season. "
                "Optionally limit to a specific round.",
    responses={
        200: {"description": "Standings retrieved successfully"},
    },
)
async def get_standings(
    competition_id: Annotated[int, Path(..., description="Competition ID")],
    season_id: Annotated[int, Path(..., description="Season ID")],
    max_round: int | None = Query(None, ge=1, le=99, description="Maximum round number (optional)"),
    db: asyncpg.Connection = Depends(get_database),
):
    """
    Get league standings using fn_standings_at_round RPC function.
    Returns standings at a specific round if max_round is provided.
    """
    logger.info(
        "Getting standings for competition_id=%s, season_id=%s, max_round=%s",
        competition_id, season_id, max_round
    )

    results = await call_standings_at_round(db, competition_id, season_id, max_round)

    standings = [LeagueStanding(**r) for r in results] if results else []

    return StandingsResponse(
        standings=standings,
        competition_id=competition_id,
        season_id=season_id,
    )