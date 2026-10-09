"""
Unit tests for per-90 metrics, conversion rate, and shot accuracy calculations.
Does not require a live database.
"""

import pytest


def calculate_per_90_metrics(minutes: int, goals: int, xg: float, xa: float, shots: int, shots_on_target: int, key_passes: int):
    """Replicates the per-90 calculation logic used across API and SQL views."""
    m90 = (minutes / 90.0) if minutes > 0 else 1.0
    return {
        "goals_per_90": round(goals / m90, 2) if minutes > 0 else 0.0,
        "xg_per_90": round(xg / m90, 2) if minutes > 0 else 0.0,
        "xa_per_90": round(xa / m90, 2) if minutes > 0 else 0.0,
        "shots_per_90": round(shots / m90, 2) if minutes > 0 else 0.0,
        "key_passes_per_90": round(key_passes / m90, 2) if minutes > 0 else 0.0,
        "shot_accuracy_pct": round((shots_on_target / shots) * 100.0, 1) if shots > 0 else 0.0,
        "conversion_rate_pct": round((goals / shots) * 100.0, 1) if shots > 0 else 0.0,
    }


def test_standard_90_minute_calculation():
    """Test standard 90 minute match stats."""
    res = calculate_per_90_metrics(
        minutes=90,
        goals=1,
        xg=0.85,
        xa=0.45,
        shots=4,
        shots_on_target=2,
        key_passes=3,
    )
    assert res["goals_per_90"] == 1.0
    assert res["xg_per_90"] == 0.85
    assert res["xa_per_90"] == 0.45
    assert res["shots_per_90"] == 4.0
    assert res["key_passes_per_90"] == 3.0
    assert res["shot_accuracy_pct"] == 50.0
    assert res["conversion_rate_pct"] == 25.0


def test_multiple_matches_per_90_calculation():
    """Test calculations across 10 matches (900 minutes)."""
    res = calculate_per_90_metrics(
        minutes=900,
        goals=10,
        xg=8.50,
        xa=3.20,
        shots=35,
        shots_on_target=14,
        key_passes=22,
    )
    # 900 min = 10 blocks of 90 min
    assert res["goals_per_90"] == 1.0
    assert res["xg_per_90"] == 0.85
    assert res["xa_per_90"] == 0.32
    assert res["shots_per_90"] == 3.5
    assert res["key_passes_per_90"] == 2.2
    assert res["shot_accuracy_pct"] == 40.0
    assert res["conversion_rate_pct"] == round(10 / 35 * 100, 1)


def test_zero_minutes_and_zero_shots_edge_cases():
    """Test safety against division by zero."""
    res = calculate_per_90_metrics(
        minutes=0,
        goals=0,
        xg=0.0,
        xa=0.0,
        shots=0,
        shots_on_target=0,
        key_passes=0,
    )
    assert res["goals_per_90"] == 0.0
    assert res["xg_per_90"] == 0.0
    assert res["shot_accuracy_pct"] == 0.0
    assert res["conversion_rate_pct"] == 0.0
