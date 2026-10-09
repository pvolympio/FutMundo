-- =====================================================================
-- FUTMUNDO — SEED DE DADOS MÍNIMO PARA DESENVOLVIMENTO E TESTES
-- =====================================================================

BEGIN;

-- 1. Competição e Temporada
INSERT INTO competition (competition_id, canonical_name, slug, country_code, competition_type)
VALUES (1, 'Premier League', 'premier-league', 'ENG', 'league')
ON CONFLICT (competition_id) DO NOTHING;

INSERT INTO season (season_id, competition_id, name, start_date, end_date, is_current)
VALUES (1, 1, '2024/2025', '2024-08-16', '2025-05-25', true)
ON CONFLICT (season_id, competition_id) DO NOTHING;

-- 2. Clubes
INSERT INTO team (team_id, canonical_name, short_name, slug, country_code)
VALUES 
    (1, 'Arsenal Football Club', 'Arsenal', 'arsenal', 'ENG'),
    (2, 'Manchester City Football Club', 'Man City', 'man-city', 'ENG')
ON CONFLICT (team_id) DO NOTHING;

-- 3. Atletas (com nomes próprios para testar GIN Trigram e normalização)
INSERT INTO player (player_id, full_name, display_name, slug, nationality_code, shirt_number)
VALUES 
    (1, 'Bukayo Ayoyinka Saka', 'Bukayo Saka', 'bukayo-saka', 'ENG', 7),
    (2, 'Martin Ødegaard', 'Martin Odegaard', 'martin-odegaard', 'NOR', 8),
    (3, 'Erling Braut Haaland', 'Erling Haaland', 'erling-haaland', 'NOR', 9),
    (4, 'Kevin De Bruyne', 'Kevin De Bruyne', 'kevin-de-bruyne', 'BEL', 17)
ON CONFLICT (player_id) DO NOTHING;

-- Vínculos de elenco
INSERT INTO player_team_history (player_id, team_id, valid_from, status)
VALUES 
    (1, 1, '2020-01-01', 'active'),
    (2, 1, '2021-01-01', 'active'),
    (3, 2, '2022-01-01', 'active'),
    (4, 2, '2015-01-01', 'active')
ON CONFLICT DO NOTHING;

-- 4. Partida de teste
INSERT INTO match (
    match_id, competition_id, season_id, matchday, 
    match_date, home_team_id, away_team_id, 
    home_score, away_score, status, winner_team_id
)
VALUES (
    1, 1, 1, 5, 
    '2024-09-22 16:30:00+00', 1, 2, 
    2, 1, 'finished', 1
)
ON CONFLICT (match_id) DO NOTHING;

-- 5. Estatísticas da partida (player_match_stats)
INSERT INTO player_match_stats (
    match_id, stat_date, player_id, team_id, source_id, stat_type,
    minutes, goals, assists, xg, xa, stats
)
VALUES 
    -- Saka: 1 gol, 1 assistência, 90 min, xG 0.85
    (1, '2024-09-22', 1, 1, 1, 'standard', 90, 1, 1, 0.85, 0.40, '{"shots": 4, "shots_on_target": 2, "key_passes": 3}'::jsonb),
    -- Odegaard: 1 gol, 90 min, xG 0.45
    (1, '2024-09-22', 2, 1, 1, 'standard', 90, 1, 0, 0.45, 0.35, '{"shots": 3, "shots_on_target": 1, "key_passes": 4}'::jsonb),
    -- Haaland: 1 gol, 90 min, xG 0.95
    (1, '2024-09-22', 3, 2, 1, 'standard', 90, 1, 0, 0.95, 0.05, '{"shots": 5, "shots_on_target": 3, "key_passes": 1}'::jsonb),
    -- De Bruyne: 0 gols, 1 assistência, 80 min, xA 0.65
    (1, '2024-09-22', 4, 2, 1, 'standard', 80, 0, 1, 0.15, 0.65, '{"shots": 2, "shots_on_target": 1, "key_passes": 5}'::jsonb)
ON CONFLICT DO NOTHING;

-- 6. Estatísticas por equipe (team_match_stats)
INSERT INTO team_match_stats (
    match_id, stat_date, team_id, source_id, stat_type,
    goals, xg, shots, shots_on_target, possession_pct
)
VALUES 
    (1, '2024-09-22', 1, 1, 'standard', 2, 1.85, 14, 6, 48.5),
    (1, '2024-09-22', 2, 1, 'standard', 1, 1.45, 12, 5, 51.5)
ON CONFLICT DO NOTHING;

-- 7. Atualização das Views Materializadas (Gold Layer e Rankings)
SELECT refresh_gold_views(false);

COMMIT;
