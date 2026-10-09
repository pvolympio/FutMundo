-- Migration 002: Materialized View for Player Season Rankings
-- Calculates per-90 metrics aggregated at season level for high-speed API ordering.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_player_season_rankings AS
SELECT 
    p.player_id,
    COALESCE(p.display_name, p.full_name) AS name,
    p.photo_url,
    p.nationality_code AS nationality,
    t.team_id,
    t.canonical_name AS team_name,
    t.short_name AS team_short,
    COALESCE(SUM(g.goals), 0)::INTEGER AS goals,
    COALESCE(SUM(g.assists), 0)::INTEGER AS assists,
    COALESCE(ROUND(SUM(g.xg)::NUMERIC, 2), 0)::FLOAT AS xg,
    COALESCE(ROUND(SUM(g.xa)::NUMERIC, 2), 0)::FLOAT AS xa,
    COALESCE(SUM(g.minutes), 0)::INTEGER AS minutes,
    COUNT(DISTINCT g.match_id)::INTEGER AS matches,
    COALESCE(SUM((g.stats->>'shots')::INTEGER), 0)::INTEGER AS shots,
    COALESCE(SUM((g.stats->>'shots_on_target')::INTEGER), 0)::INTEGER AS shots_on_target,
    COALESCE(SUM((g.stats->>'key_passes')::INTEGER), 0)::INTEGER AS key_passes,
    ROUND(COALESCE(SUM(g.goals), 0)::NUMERIC / NULLIF(SUM(g.minutes)::NUMERIC / 90.0, 0), 2)::FLOAT AS goals_per_90,
    ROUND(COALESCE(SUM(g.xg)::NUMERIC, 0) / NULLIF(SUM(g.minutes)::NUMERIC / 90.0, 0), 2)::FLOAT AS xg_per_90,
    ROUND(COALESCE(SUM(g.xa)::NUMERIC, 0) / NULLIF(SUM(g.minutes)::NUMERIC / 90.0, 0), 2)::FLOAT AS xa_per_90,
    ROUND(COALESCE(SUM((g.stats->>'shots')::NUMERIC), 0) / NULLIF(SUM(g.minutes)::NUMERIC / 90.0, 0), 2)::FLOAT AS shots_per_90,
    ROUND(COALESCE(SUM((g.stats->>'key_passes')::NUMERIC), 0) / NULLIF(SUM(g.minutes)::NUMERIC / 90.0, 0), 2)::FLOAT AS key_passes_per_90,
    CASE 
        WHEN COALESCE(SUM((g.stats->>'shots')::INTEGER), 0) > 0 
        THEN ROUND((COALESCE(SUM((g.stats->>'shots_on_target')::NUMERIC), 0) / SUM((g.stats->>'shots')::NUMERIC)) * 100.0, 1)::FLOAT
        ELSE 0.0 
    END AS shot_accuracy_pct
FROM gold_player_match_stats g
JOIN player p ON p.player_id = g.player_id
JOIN team t ON t.team_id = g.team_id
WHERE g.stat_type = 'standard'
GROUP BY p.player_id, p.display_name, p.full_name, p.photo_url, p.nationality_code, t.team_id, t.canonical_name, t.short_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_player_season_rankings ON mv_player_season_rankings(player_id, team_id);
