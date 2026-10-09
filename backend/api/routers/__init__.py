"""
API Routers package.
Contains all endpoint routers organized by functionality.
"""

from .search import router as search_router
from .standings import router as standings_router
from .teams import router as teams_router
from .players import router as players_router
from .matches import router as matches_router

__all__ = [
    "teams_router",
    "players_router",
    "matches_router",
    "search_router",
    "standings_router",
]