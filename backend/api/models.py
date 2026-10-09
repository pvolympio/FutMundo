"""
Pydantic models for API requests and responses.
All models are designed to work with the JSON output from PostgreSQL RPC functions.
"""

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, ConfigDict


# ============================================
# Common Response Models
# ============================================

class APIResponse(BaseModel):
    """Standard API response wrapper."""

    success: bool = True
    message: Optional[str] = None
    data: Optional[Any] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Operation completed successfully",
                "data": {}
            }
        }
    )


class ErrorResponse(BaseModel):
    """Standard error response."""

    detail: str
    error: Optional[str] = None
    details: Optional[str] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "detail": "The requested resource could not be found"
            }
        }
    )


# ============================================
# Pagination Models
# ============================================

class PaginationParams(BaseModel):
    """Pagination query parameters."""

    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""

    items: list = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 0

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "items": [],
                "total": 100,
                "page": 1,
                "page_size": 20,
                "total_pages": 5
            }
        }
    )


# ============================================
# Team Models
# ============================================

class CountryInfo(BaseModel):
    """Country information."""

    code: Optional[str] = None
    name: Optional[str] = None


class TeamBase(BaseModel):
    """Base team information."""

    id: int
    name: str
    short_name: Optional[str] = None
    slug: Optional[str] = None
    crest_url: Optional[str] = None


class TeamProfile(BaseModel):
    """Complete team profile from fn_api_team_profile."""

    team_id: int
    canonical_name: str
    short_name: Optional[str] = None
    slug: Optional[str] = None
    country: Optional[CountryInfo] = None
    state: Optional[str] = None
    city: Optional[str] = None
    founded_year: Optional[int] = None
    crest_url: Optional[str] = None
    accent_color: Optional[str] = None
    venue: Optional[dict[str, Any]] = None
    manager: Optional[dict[str, Any]] = None
    standings: Optional[dict[str, Any]] = None
    form: Optional[dict[str, Any]] = None
    squad: Optional[dict[str, Any]] = None
    recent_matches: Optional[list[dict[str, Any]]] = None


class TeamSeasonMatch(BaseModel):
    """One finished match of a team in a season."""
    match_id: int
    matchday: Optional[int] = None
    date: Optional[datetime] = None
    is_home: bool
    opponent_id: int
    opponent: str
    goals_for: int
    goals_against: int
    result: str  # V / E / D
    xg_for: Optional[float] = None
    xg_against: Optional[float] = None
    shots_for: Optional[int] = None
    shots_against: Optional[int] = None


class TeamSeasonSummary(BaseModel):
    """Aggregated season numbers computed from the match list."""
    matches: int = 0
    wins: int = 0
    draws: int = 0
    losses: int = 0
    points: int = 0
    goals_for: int = 0
    goals_against: int = 0
    goal_difference: int = 0
    clean_sheets: int = 0
    xg_for: float = 0.0
    xg_against: float = 0.0
    xg_difference: float = 0.0
    goals_minus_xg: float = 0.0
    avg_xg_for: float = 0.0
    avg_xg_against: float = 0.0
    shots_for: int = 0
    shots_against: int = 0


class TeamSeasonPlayer(BaseModel):
    """Squad member derived from player_appearance."""
    player_id: int
    name: str
    nationality: Optional[str] = None
    photo_url: Optional[str] = None
    position_code: Optional[str] = None
    position_name: Optional[str] = None
    line: Optional[str] = None
    appearances: int = 0
    starts: int = 0
    minutes: int = 0
    goals: int = 0
    assists: int = 0
    xg: float = 0.0
    xa: float = 0.0


class TeamSeasonResponse(BaseModel):
    """Team season overview: results, summary and real squad."""
    team_id: int
    season_id: Optional[int] = None
    season_name: Optional[str] = None
    summary: TeamSeasonSummary
    matches: list[TeamSeasonMatch] = []
    squad: list[TeamSeasonPlayer] = []


class HeadToHeadSummary(BaseModel):
    """H2H summary statistics."""

    total_matches: int
    team_a_wins: int
    team_b_wins: int
    draws: int
    team_a_goals: int
    team_b_goals: int


class HeadToHeadResponse(BaseModel):
    """Response from fn_team_head_to_head."""

    team_a: Optional[TeamBase] = None
    team_b: Optional[TeamBase] = None
    summary: Optional[HeadToHeadSummary] = None
    recent_matches: Optional[list[dict[str, Any]]] = None


# ============================================
# Player Models
# ============================================

class PlayerBase(BaseModel):
    """Base player information."""

    id: int
    name: str


class PlayerProfile(BaseModel):
    """Complete player profile from fn_api_player_profile."""

    player_id: int
    full_name: str
    display_name: Optional[str] = None
    birth_date: Optional[date] = None
    age: Optional[int] = None
    nationality: Optional[CountryInfo] = None
    physical: Optional[dict[str, Any]] = None
    photo_url: Optional[str] = None
    market_value: Optional[dict[str, Any]] = None
    club: Optional[dict[str, Any]] = None
    career_teams: Optional[list[dict[str, Any]]] = None
    injuries: Optional[list[dict[str, Any]]] = None
    current_season_stats: Optional[dict[str, Any]] = None


# ============================================
# Match Models
# ============================================

class MatchBase(BaseModel):
    """Base match information."""

    id: int
    date: datetime
    status: str
    home_team: TeamBase
    away_team: TeamBase
    score: dict[str, Any]


class MatchDetails(BaseModel):
    """Complete match details from fn_api_match_details."""

    match_id: int
    match_date: Optional[datetime] = None
    status: Optional[str] = None
    stage: Optional[str] = None
    group_name: Optional[str] = None
    matchday: Optional[int] = None
    leg: Optional[int] = None
    score: Optional[dict[str, Any]] = None
    competition: Optional[dict[str, Any]] = None
    season: Optional[dict[str, Any]] = None
    venue: Optional[dict[str, Any]] = None
    home_team: Optional[TeamBase] = None
    away_team: Optional[TeamBase] = None
    officials: Optional[list[dict[str, Any]]] = None
    lineups: Optional[dict[str, Any]] = None
    timeline: Optional[list[dict[str, Any]]] = None
    stats: Optional[dict[str, Any]] = None
    odds: Optional[dict[str, Any]] = None


# ============================================
# Standings Models
# ============================================

class LeagueStanding(BaseModel):
    """Single league standing entry."""

    position: int
    team_id: int
    team_name: str
    team_short_name: Optional[str] = None
    team_slug: Optional[str] = None
    crest_url: Optional[str] = None
    played: int
    won: int
    drawn: int
    lost: int
    goals_for: int
    goals_against: int
    goal_difference: int
    points: int


class StandingsResponse(BaseModel):
    """Response from fn_standings_at_round."""

    standings: list[LeagueStanding] = []
    competition_id: Optional[int] = None
    season_id: Optional[int] = None


# ============================================
# Search Models
# ============================================

class SearchResult(BaseModel):
    """Single search result."""

    type: str  # 'team' or 'player'
    id: int
    name: str
    subtitle: Optional[str] = None
    slug: Optional[str] = None
    photo_url: Optional[str] = None
    score: Optional[float] = None


class SearchResponse(BaseModel):
    """Response from search_entities."""

    results: list[SearchResult] = []
    total: int = 0


# ============================================
# Request Validation Models
# ============================================

class HeadToHeadRequest(BaseModel):
    """Request parameters for head-to-head endpoint."""

    limit: int = Field(default=10, ge=1, le=100)


class SearchRequest(BaseModel):
    """Request parameters for search endpoint."""

    limit: int = Field(default=10, ge=1, le=50)


class StandingsRequest(BaseModel):
    """Request parameters for standings endpoint."""

    max_round: Optional[int] = Field(default=None, ge=1)


# ============================================
# Response Wrappers for RPC Functions
# ============================================

# Note: The RPC functions return JSON/JSONB directly, so these models
# are used for documentation and response validation.

def wrap_rpc_response(data: Any) -> APIResponse:
    """Wrap RPC function result in standard API response."""
    if data is None:
        return APIResponse(success=True, message="Resource not found", data=None)
    return APIResponse(success=True, data=data)