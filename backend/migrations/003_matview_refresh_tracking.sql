-- Migration 003: Materialized View Refresh Tracking and Audit
-- Tracks refresh timestamps to power HTTP Cache-Control, ETag and Last-Modified headers.

CREATE TABLE IF NOT EXISTS matview_refresh_log (
    view_name TEXT PRIMARY KEY,
    last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    refresh_duration_ms INTEGER,
    status TEXT DEFAULT 'success'
);

COMMENT ON TABLE matview_refresh_log IS 'Log e metadados de atualização de views materializadas para invalidação de cache HTTP (ETag).';

-- Seed inicial de registros de metadados
INSERT INTO matview_refresh_log (view_name, last_refreshed_at, status)
VALUES 
    ('gold_player_match_stats', clock_timestamp(), 'success'),
    ('gold_team_match_stats', clock_timestamp(), 'success'),
    ('mv_player_season_rankings', clock_timestamp(), 'success')
ON CONFLICT (view_name) DO NOTHING;

-- Atualiza refresh_gold_views para registrar auditoria de atualização
CREATE OR REPLACE FUNCTION refresh_gold_views(p_concurrently BOOLEAN DEFAULT false)
RETURNS VOID AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_duration INTEGER;
BEGIN
    v_start := clock_timestamp();

    IF p_concurrently THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY gold_player_match_stats;
        REFRESH MATERIALIZED VIEW CONCURRENTLY gold_team_match_stats;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_player_season_rankings;
    ELSE
        REFRESH MATERIALIZED VIEW gold_player_match_stats;
        REFRESH MATERIALIZED VIEW gold_team_match_stats;
        REFRESH MATERIALIZED VIEW mv_player_season_rankings;
    END IF;

    v_duration := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::INTEGER;

    UPDATE matview_refresh_log 
    SET last_refreshed_at = clock_timestamp(),
        refresh_duration_ms = v_duration,
        status = 'success'
    WHERE view_name IN ('gold_player_match_stats', 'gold_team_match_stats', 'mv_player_season_rankings');
END;
$$ LANGUAGE plpgsql;

-- Permissões para leitura pelo app_reader
GRANT SELECT ON matview_refresh_log TO app_reader;
