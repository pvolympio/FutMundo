-- Patch para schema.sql: fn_api_match_details deve ler só stat_type='standard' das views gold.
-- Necessário porque a ingestão grava também stat_type='extras' (escanteios, faltas, cartões).
-- NOTA: Já incorporado no schema.sql (v3.1). Mantido como patch idempotente para bancos existentes.
-- Aplique com: psql -d futebol -f patch_fn_api_match_details.sql

CREATE OR REPLACE FUNCTION public.fn_api_match_details(p_match_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE PARALLEL SAFE
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM match WHERE match_id = p_match_id) THEN
        RETURN NULL;
    END IF;

    WITH match_base AS (
        SELECT
            m.match_id,
            m.match_date,
            m.status,
            m.stage,
            m.group_name,
            m.matchday,
            m.leg,
            m.home_score,
            m.away_score,
            m.home_score_extra_time,
            m.away_score_extra_time,
            m.home_penalty_score,
            m.away_penalty_score,
            m.winner_team_id,
            jsonb_build_object('id', c.competition_id, 'name', c.canonical_name, 'slug', c.slug, 'type', c.competition_type) AS competition,
            jsonb_build_object('id', s.season_id, 'name', s.name, 'is_current', s.is_current) AS season,
            CASE WHEN v.venue_id IS NOT NULL THEN
                jsonb_build_object('id', v.venue_id, 'name', v.name, 'city', v.city, 'capacity', v.capacity)
            ELSE NULL END AS venue,
            jsonb_build_object('id', th.team_id, 'name', th.canonical_name, 'short_name', th.short_name, 'slug', th.slug, 'crest_url', th.crest_url) AS home_team,
            jsonb_build_object('id', ta.team_id, 'name', ta.canonical_name, 'short_name', ta.short_name, 'slug', ta.slug, 'crest_url', ta.crest_url) AS away_team,
            m.home_team_id,
            m.away_team_id
        FROM match m
        JOIN competition c ON c.competition_id = m.competition_id
        JOIN season s ON s.season_id = m.season_id
        JOIN team th ON th.team_id = m.home_team_id
        JOIN team ta ON ta.team_id = m.away_team_id
        LEFT JOIN venue v ON v.venue_id = m.venue_id
        WHERE m.match_id = p_match_id
    ),
    officials AS (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'role', mo.role,
                    'name', r.full_name,
                    'nationality', r.nationality_code
                )
            ),
            '[]'::jsonb
        ) AS list
        FROM match_official mo
        JOIN referee r ON r.referee_id = mo.referee_id
        WHERE mo.match_id = p_match_id
    ),
    events AS (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'event_id', me.event_id,
                    'minute', me.minute,
                    'second', me.second,
                    'event_type', me.event_type,
                    'team_id', me.team_id,
                    'player', CASE WHEN p.player_id IS NOT NULL THEN jsonb_build_object('id', p.player_id, 'name', COALESCE(p.display_name, p.full_name)) ELSE NULL END,
                    'assist_player', CASE WHEN pa.player_id IS NOT NULL THEN jsonb_build_object('id', pa.player_id, 'name', COALESCE(pa.display_name, pa.full_name)) ELSE NULL END,
                    'is_own_goal', me.is_own_goal,
                    'is_penalty', me.is_penalty,
                    'body_part', me.body_part,
                    'shot_result', me.shot_result,
                    'x', me.x,
                    'y', me.y,
                    'xg', CASE WHEN me.event_type = 'shot' AND me.qualifiers IS NOT NULL AND me.qualifiers ? 'xg' THEN ROUND((me.qualifiers->>'xg')::numeric, 3)::float ELSE NULL END,
                    'situation', CASE WHEN me.event_type = 'shot' AND me.qualifiers IS NOT NULL AND me.qualifiers ? 'situation' THEN me.qualifiers->>'situation' ELSE NULL END
                ) ORDER BY me.minute ASC, me.second ASC, me.sequence_no ASC, me.event_id ASC
            ),
            '[]'::jsonb
        ) AS list
        FROM match_event me
        LEFT JOIN player p ON p.player_id = me.player_id
        LEFT JOIN player pa ON pa.player_id = me.assist_player_id
        WHERE me.match_id = p_match_id
    ),
    lineups AS (
        SELECT
            (
                SELECT jsonb_build_object(
                    'formation', (SELECT formation FROM match_lineup_formation WHERE match_id = p_match_id AND team_id = mb.home_team_id LIMIT 1),
                    'starters', COALESCE((
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'player_id', pa.player_id,
                                'name', COALESCE(p.display_name, p.full_name),
                                'shirt_number', pa.shirt_number,
                                'position', pa.position_code,
                                'captain', pa.is_captain
                            ) ORDER BY pa.shirt_number ASC
                        )
                        FROM player_appearance pa
                        JOIN player p ON p.player_id = pa.player_id
                        WHERE pa.match_id = p_match_id AND pa.team_id = mb.home_team_id AND pa.is_starter = true
                    ), '[]'::jsonb),
                    'bench', COALESCE((
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'player_id', pa.player_id,
                                'name', COALESCE(p.display_name, p.full_name),
                                'shirt_number', pa.shirt_number,
                                'position', pa.position_code,
                                'captain', pa.is_captain
                            ) ORDER BY pa.shirt_number ASC
                        )
                        FROM player_appearance pa
                        JOIN player p ON p.player_id = pa.player_id
                        WHERE pa.match_id = p_match_id AND pa.team_id = mb.home_team_id AND pa.is_starter = false
                    ), '[]'::jsonb)
                )
            ) AS home,
            (
                SELECT jsonb_build_object(
                    'formation', (SELECT formation FROM match_lineup_formation WHERE match_id = p_match_id AND team_id = mb.away_team_id LIMIT 1),
                    'starters', COALESCE((
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'player_id', pa.player_id,
                                'name', COALESCE(p.display_name, p.full_name),
                                'shirt_number', pa.shirt_number,
                                'position', pa.position_code,
                                'captain', pa.is_captain
                            ) ORDER BY pa.shirt_number ASC
                        )
                        FROM player_appearance pa
                        JOIN player p ON p.player_id = pa.player_id
                        WHERE pa.match_id = p_match_id AND pa.team_id = mb.away_team_id AND pa.is_starter = true
                    ), '[]'::jsonb),
                    'bench', COALESCE((
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'player_id', pa.player_id,
                                'name', COALESCE(p.display_name, p.full_name),
                                'shirt_number', pa.shirt_number,
                                'position', pa.position_code,
                                'captain', pa.is_captain
                            ) ORDER BY pa.shirt_number ASC
                        )
                        FROM player_appearance pa
                        JOIN player p ON p.player_id = pa.player_id
                        WHERE pa.match_id = p_match_id AND pa.team_id = mb.away_team_id AND pa.is_starter = false
                    ), '[]'::jsonb)
                )
            ) AS away
        FROM match_base mb
    ),
    team_stats AS (
        SELECT jsonb_build_object(
            'home', (SELECT jsonb_build_object('goals', goals, 'xg', xg, 'shots', shots, 'shots_on_target', shots_on_target, 'possession_pct', possession_pct, 'raw', stats) FROM gold_team_match_stats WHERE match_id = p_match_id AND team_id = mb.home_team_id AND stat_type = 'standard' LIMIT 1),
            'away', (SELECT jsonb_build_object('goals', goals, 'xg', xg, 'shots', shots, 'shots_on_target', shots_on_target, 'possession_pct', possession_pct, 'raw', stats) FROM gold_team_match_stats WHERE match_id = p_match_id AND team_id = mb.away_team_id AND stat_type = 'standard' LIMIT 1)
        ) AS stats
        FROM match_base mb
    ),
    odds AS (
        SELECT COALESCE(
            (
                SELECT jsonb_build_object(
                    'bookmaker', bookmaker,
                    'home_win', home_odds,
                    'draw', draw_odds,
                    'away_win', away_odds
                )
                FROM match_odds
                WHERE match_id = p_match_id
                ORDER BY collected_at DESC
                LIMIT 1
            ),
            '{}'::jsonb
        ) AS odds_info
    )
    SELECT jsonb_build_object(
        'match_id', mb.match_id,
        'match_date', mb.match_date,
        'status', mb.status,
        'stage', mb.stage,
        'group_name', mb.group_name,
        'matchday', mb.matchday,
        'leg', mb.leg,
        'score', jsonb_build_object(
            'home', mb.home_score,
            'away', mb.away_score,
            'home_extra_time', mb.home_score_extra_time,
            'away_extra_time', mb.away_score_extra_time,
            'home_penalties', mb.home_penalty_score,
            'away_penalties', mb.away_penalty_score,
            'winner_team_id', mb.winner_team_id
        ),
        'competition', mb.competition,
        'season', mb.season,
        'venue', mb.venue,
        'home_team', mb.home_team,
        'away_team', mb.away_team,
        'officials', o.list,
        'lineups', jsonb_build_object('home', l.home, 'away', l.away),
        'timeline', ev.list,
        'stats', ts.stats,
        'odds', od.odds_info
    ) INTO v_result
    FROM match_base mb, officials o, events ev, lineups l, team_stats ts, odds od;

    RETURN v_result;
END;
$function$;
