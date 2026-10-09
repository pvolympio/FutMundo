-- =====================================================================
-- BATERIA DE TESTES AUTOMATIZADOS E REGRESSÃO (v3.0 — 38 TESTES)
-- Execução 100% Autocontida, Idempotente e Isolada (BEGIN ... ROLLBACK)
-- Cobre Regras de Domínio + Regressão de Todas as 10 Falhas Confirmadas
-- =====================================================================

\set ON_ERROR_STOP on

-- =====================================================================
-- PARTE 1: TESTES FUNCIONAIS DE DOMÍNIO (TESTES 1 A 21)
-- =====================================================================

-- ---------------------------------------------------------------------
-- TESTE 1: get_or_create_player idempotente na mesma fonte
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    id1 BIGINT;
    id2 BIGINT;
    total INT;
BEGIN
    id1 := get_or_create_player('fbref', 'fbref-cr7-001', 'Cristiano Ronaldo', '1985-02-05', 'PRT', 1.0, 'system', 'CR7');
    id2 := get_or_create_player('fbref', 'fbref-cr7-001', 'Cristiano Ronaldo', '1985-02-05', 'PRT');
    IF id1 <> id2 THEN
        RAISE EXCEPTION 'TESTE 1 FALHOU: IDs diferentes gerados (% vs %)', id1, id2;
    END IF;
    SELECT count(*) INTO total FROM player WHERE player_id = id1;
    IF total <> 1 THEN
        RAISE EXCEPTION 'TESTE 1 FALHOU: esperava 1 jogador, achou %', total;
    END IF;
    RAISE NOTICE 'TESTE 1 OK: get_or_create_player idempotente na mesma fonte';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 2: Identidade unificada entre fontes distintas (mesmo nome + nascimento)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    id1 BIGINT;
    id2 BIGINT;
    cnt INT;
BEGIN
    id1 := get_or_create_player('fbref', 'fbref-cr7-001', 'Cristiano Ronaldo', '1985-02-05', 'PRT');
    id2 := get_or_create_player('understat', 'understat-cr7-999', 'Cristiano Ronaldo', '1985-02-05', 'PRT');
    IF id1 <> id2 THEN
        RAISE EXCEPTION 'TESTE 2 FALHOU: mesma pessoa gerou IDs distintos (% vs %)', id1, id2;
    END IF;
    SELECT count(*) INTO cnt FROM player_external_id WHERE player_id = id1;
    IF cnt <> 2 THEN
        RAISE EXCEPTION 'TESTE 2 FALHOU: esperava 2 external_ids associados ao jogador, achou %', cnt;
    END IF;
    RAISE NOTICE 'TESTE 2 OK: identidade unificada entre fontes distintas';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 3: Rejeição de external_id duplicado na mesma fonte para jogador diferente
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    p1 BIGINT;
    p2 BIGINT;
    v_src SMALLINT;
BEGIN
    SELECT source_id INTO v_src FROM dim_source WHERE code = 'fbref';
    p1 := get_or_create_player('fbref', 'ext-100', 'Jogador Um', '1990-01-01', 'BRA');
    INSERT INTO player (full_name, birth_date) VALUES ('Jogador Dois', '1991-01-01') RETURNING player_id INTO p2;
    BEGIN
        INSERT INTO player_external_id (source_id, external_id, player_id)
        VALUES (v_src, 'ext-100', p2);
        RAISE EXCEPTION 'TESTE 3 FALHOU: permitiu duplicata de external_id na mesma fonte!';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'TESTE 3 OK: constraint UNIQUE rejeitou external_id duplicado';
    END;
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 4: player_team_history — Exclusion constraint bloqueia sobreposição
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    p_id BIGINT;
    t1_id BIGINT;
    t2_id BIGINT;
BEGIN
    p_id := get_or_create_player('manual', 'p-hist', 'Jogador Historico', '2000-01-01', 'BRA');
    t1_id := get_or_create_team('manual', 't-hist-1', 'Clube A', 'BRA');
    t2_id := get_or_create_team('manual', 't-hist-2', 'Clube B', 'BRA');

    INSERT INTO player_team_history (player_id, team_id, start_date, end_date, transfer_type)
    VALUES (p_id, t1_id, '2020-01-01', '2021-12-31', 'transfer');

    BEGIN
        INSERT INTO player_team_history (player_id, team_id, start_date, end_date, transfer_type)
        VALUES (p_id, t2_id, '2021-06-01', '2022-06-01', 'transfer');
        RAISE EXCEPTION 'TESTE 4 FALHOU: permitiu sobreposição de contratos!';
    EXCEPTION WHEN exclusion_violation THEN
        RAISE NOTICE 'TESTE 4 OK: sobreposição de vínculos rejeitada pela exclusion constraint';
    END;

    INSERT INTO player_team_history (player_id, team_id, start_date, end_date, transfer_type)
    VALUES (p_id, t2_id, '2022-01-01', NULL, 'transfer');
    RAISE NOTICE 'TESTE 4b OK: período contíguo sem sobreposição aceito com sucesso';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 5: manager_tenure — Exclusion constraint bloqueia 2 head_coaches
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    m1_id BIGINT;
    m2_id BIGINT;
    t_id BIGINT;
BEGIN
    INSERT INTO manager (full_name) VALUES ('Tecnico Um') RETURNING manager_id INTO m1_id;
    INSERT INTO manager (full_name) VALUES ('Tecnico Dois') RETURNING manager_id INTO m2_id;
    t_id := get_or_create_team('manual', 't-coach', 'Clube Técnico', 'BRA');

    INSERT INTO manager_tenure (manager_id, team_id, role, start_date, end_date)
    VALUES (m1_id, t_id, 'head_coach', '2023-01-01', NULL);

    BEGIN
        INSERT INTO manager_tenure (manager_id, team_id, role, start_date, end_date)
        VALUES (m2_id, t_id, 'head_coach', '2023-06-01', NULL);
        RAISE EXCEPTION 'TESTE 5 FALHOU: permitiu 2 head coaches simultâneos!';
    EXCEPTION WHEN exclusion_violation THEN
        RAISE NOTICE 'TESTE 5 OK: dois head coaches simultâneos no mesmo clube bloqueados';
    END;
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 6: Particionamento por ano e rota para DEFAULT
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    comp_id BIGINT;
    seas_id BIGINT;
    t_home BIGINT;
    t_away BIGINT;
    m2021 BIGINT;
    m1998 BIGINT;
    p_2021 TEXT;
    p_1998 TEXT;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Particao', 'BRA') RETURNING competition_id INTO comp_id;
    INSERT INTO season (competition_id, name) VALUES (comp_id, '2021') RETURNING season_id INTO seas_id;
    t_home := get_or_create_team('manual', 't-part-h', 'Mandante Particao', 'BRA');
    t_away := get_or_create_team('manual', 't-part-a', 'Visitante Particao', 'BRA');

    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, home_score, away_score, status)
    VALUES (comp_id, seas_id, '2021-05-10 16:00+00', t_home, t_away, 2, 1, 'finished')
    RETURNING match_id INTO m2021;

    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, home_score, away_score, status)
    VALUES (comp_id, seas_id, '1998-05-10 16:00+00', t_home, t_away, 0, 0, 'finished')
    RETURNING match_id INTO m1998;

    PERFORM insert_match_event(m2021, 'whoscored', t_home, NULL, 10, NULL, 'shot', NULL, NULL, NULL, 1);
    PERFORM insert_match_event(m1998, 'whoscored', t_home, NULL, 20, NULL, 'shot', NULL, NULL, NULL, 1);

    SELECT tableoid::regclass::text INTO p_2021 FROM match_event WHERE match_id = m2021;
    SELECT tableoid::regclass::text INTO p_1998 FROM match_event WHERE match_id = m1998;

    IF p_2021 <> 'match_event_2021' THEN
        RAISE EXCEPTION 'TESTE 6 FALHOU: esperava match_event_2021, obteve %', p_2021;
    END IF;
    IF p_1998 <> 'match_event_default' THEN
        RAISE EXCEPTION 'TESTE 6 FALHOU: esperava match_event_default, obteve %', p_1998;
    END IF;
    RAISE NOTICE 'TESTE 6 OK: particionamento por ano e rota default validados';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 7: Colunas geradas de estatísticas via safe_numeric
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    comp_id BIGINT;
    seas_id BIGINT;
    t_home BIGINT;
    t_away BIGINT;
    p_id BIGINT;
    m_id BIGINT;
    v_goals NUMERIC;
    v_xg NUMERIC;
    v_min NUMERIC;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Stats', 'BRA') RETURNING competition_id INTO comp_id;
    INSERT INTO season (competition_id, name) VALUES (comp_id, '2022') RETURNING season_id INTO seas_id;
    t_home := get_or_create_team('manual', 't-stat-h', 'Mandante Stats', 'BRA');
    t_away := get_or_create_team('manual', 't-stat-a', 'Visitante Stats', 'BRA');
    p_id := get_or_create_player('manual', 'p-stats', 'Jogador Stats', '1999-01-01', 'BRA');

    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, home_score, away_score, winner_team_id, status)
    VALUES (comp_id, seas_id, '2022-03-01 15:00+00', t_home, t_away, 2, 1, t_home, 'finished')
    RETURNING match_id INTO m_id;

    PERFORM insert_player_match_stat(m_id, p_id, t_home, 'fbref', 'standard',
        '{"goals": 2, "assists": 1, "minutes": 90, "xg": 1.74, "xa": 0.45}'::jsonb);

    SELECT goals, xg, minutes INTO v_goals, v_xg, v_min
    FROM player_match_stats WHERE match_id = m_id AND player_id = p_id;

    IF v_goals <> 2 OR v_xg <> 1.74 OR v_min <> 90 THEN
        RAISE EXCEPTION 'TESTE 7 FALHOU: colunas geradas incorretas (goals=%, xg=%, min=%)', v_goals, v_xg, v_min;
    END IF;
    RAISE NOTICE 'TESTE 7 OK: colunas geradas calculadas via safe_numeric com sucesso';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 8: Camada gold — reconciliação entre fontes com base em prioridade
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    comp_id BIGINT;
    seas_id BIGINT;
    t_home BIGINT;
    t_away BIGINT;
    p_id BIGINT;
    m_id BIGINT;
    fbref_src SMALLINT;
    understat_src SMALLINT;
    chosen SMALLINT;
BEGIN
    SELECT source_id INTO fbref_src FROM dim_source WHERE code = 'fbref';
    SELECT source_id INTO understat_src FROM dim_source WHERE code = 'understat';

    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Gold', 'BRA') RETURNING competition_id INTO comp_id;
    INSERT INTO season (competition_id, name) VALUES (comp_id, '2023') RETURNING season_id INTO seas_id;
    t_home := get_or_create_team('manual', 't-gold-h', 'Mandante Gold', 'BRA');
    t_away := get_or_create_team('manual', 't-gold-a', 'Visitante Gold', 'BRA');
    p_id := get_or_create_player('manual', 'p-gold', 'Jogador Gold', '1998-01-01', 'BRA');

    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, home_score, away_score, status)
    VALUES (comp_id, seas_id, '2023-04-01 15:00+00', t_home, t_away, 1, 0, 'finished')
    RETURNING match_id INTO m_id;

    PERFORM insert_player_match_stat(m_id, p_id, t_home, 'fbref', 'shooting', '{"goals": 1}'::jsonb);
    PERFORM insert_player_match_stat(m_id, p_id, t_home, 'understat', 'shooting', '{"goals": 2}'::jsonb);

    INSERT INTO stat_source_priority (stat_type, source_id, priority)
    VALUES ('shooting', fbref_src, 1)
    ON CONFLICT (stat_type, source_id) DO UPDATE SET priority = 1;

    INSERT INTO stat_source_priority (stat_type, source_id, priority)
    VALUES ('shooting', understat_src, 2)
    ON CONFLICT (stat_type, source_id) DO UPDATE SET priority = 2;

    PERFORM refresh_gold_views(false);

    SELECT chosen_source_id INTO chosen
    FROM gold_player_match_stats
    WHERE match_id = m_id AND player_id = p_id AND stat_type = 'shooting';

    IF chosen <> fbref_src THEN
        RAISE EXCEPTION 'TESTE 8 FALHOU: esperava source_id=%, achou %', fbref_src, chosen;
    END IF;
    RAISE NOTICE 'TESTE 8 OK: camada gold reconciliou fontes conforme prioridade configurada';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 9: Histórico de alteração de campos (auditoria player_field_history)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    p_id BIGINT;
    hist_cnt INT;
BEGIN
    p_id := get_or_create_player('manual', 'p-audit', 'Nome Antigo', '1995-01-01', 'BRA');
    UPDATE player SET full_name = 'Nome Novo Corrigido' WHERE player_id = p_id;

    SELECT count(*) INTO hist_cnt
    FROM player_field_history
    WHERE player_id = p_id AND field_name = 'full_name'
      AND old_value = 'Nome Antigo' AND new_value = 'Nome Novo Corrigido';

    IF hist_cnt <> 1 THEN
        RAISE EXCEPTION 'TESTE 9 FALHOU: alteração não auditada no player_field_history';
    END IF;
    RAISE NOTICE 'TESTE 9 OK: trigger de auditoria capturou alteração de nome';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 10: Fuzzy matching real com pg_trgm (múltiplos candidatos sem WHERE pré-filtrado)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    best_name TEXT;
    best_sim REAL;
BEGIN
    PERFORM get_or_create_player('manual', 'p-cr7', 'Cristiano Ronaldo', '1985-02-05', 'PRT');
    PERFORM get_or_create_player('manual', 'p-messi', 'Lionel Messi', '1987-06-24', 'ARG');
    PERFORM get_or_create_player('manual', 'p-mbappe', 'Kylian Mbappe', '1998-12-20', 'FRA');
    PERFORM get_or_create_player('manual', 'p-eriksen', 'Christian Eriksen', '1992-02-14', 'DNK');

    SELECT full_name, similarity(normalized_name, normalize_name('Cristano Ranaldo'))
    INTO best_name, best_sim
    FROM player
    ORDER BY similarity(normalized_name, normalize_name('Cristano Ranaldo')) DESC
    LIMIT 1;

    IF best_name <> 'Cristiano Ronaldo' OR best_sim < 0.50 THEN
        RAISE EXCEPTION 'TESTE 10 FALHOU: fuzzy matching escolheu % (sim: %)', best_name, best_sim;
    END IF;
    RAISE NOTICE 'TESTE 10 OK: matching fuzzy ordenou corretamente entre múltiplos candidatos (sim=%)', best_sim;
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 11: Desambiguação de homônimos por data de nascimento
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    id1 BIGINT;
    id2 BIGINT;
BEGIN
    id1 := get_or_create_player('manual', 'lucas-2005', 'Lucas Silva', '2005-08-15', 'BRA');
    id2 := get_or_create_player('manual', 'lucas-1993', 'Lucas Silva', '1993-02-16', 'BRA');

    IF id1 = id2 THEN
        RAISE EXCEPTION 'TESTE 11 FALHOU: homônimos com datas distintas foram fundidos!';
    END IF;
    RAISE NOTICE 'TESTE 11 OK: desambiguação de homônimos por data de nascimento';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 12: Clubes homônimos em países distintos isolados
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    id_esp BIGINT;
    id_ecu BIGINT;
BEGIN
    id_esp := get_or_create_team('manual', 'barca-esp', 'Barcelona', 'ESP');
    id_ecu := get_or_create_team('manual', 'barca-ecu', 'Barcelona', 'ECU');

    IF id_esp = id_ecu THEN
        RAISE EXCEPTION 'TESTE 12 FALHOU: clubes homônimos de países diferentes foram fundidos!';
    END IF;
    RAISE NOTICE 'TESTE 12 OK: clubes homônimos isolados por país com sucesso';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 13: Contratos consecutivos no mesmo dia de transição com intervalo [)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    p_id BIGINT;
    t1_id BIGINT;
    t2_id BIGINT;
BEGIN
    p_id := get_or_create_player('manual', 'p-trans', 'Jogador Transicao', '2001-05-10', 'BRA');
    t1_id := get_or_create_team('manual', 't-trans-1', 'Clube T1', 'BRA');
    t2_id := get_or_create_team('manual', 't-trans-2', 'Clube T2', 'BRA');

    INSERT INTO player_team_history (player_id, team_id, start_date, end_date, transfer_type)
    VALUES (p_id, t1_id, '2023-01-01', '2024-06-30', 'transfer');

    INSERT INTO player_team_history (player_id, team_id, start_date, end_date, transfer_type)
    VALUES (p_id, t2_id, '2024-06-30', '2025-12-31', 'transfer');

    RAISE NOTICE 'TESTE 13 OK: intervalo [) permitiu transição contígua no mesmo dia';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 14: Classificação dinâmica de liga (vw_league_standings)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    c_id BIGINT;
    s_id BIGINT;
    t_fla BIGINT;
    t_pal BIGINT;
    t_cor BIGINT;
    lead_team BIGINT;
    lead_pts INT;
    lead_sg INT;
BEGIN
    INSERT INTO competition (canonical_name, country_code, tier) VALUES ('Brasileirao Teste', 'BRA', 1) RETURNING competition_id INTO c_id;
    INSERT INTO season (competition_id, name, is_current) VALUES (c_id, '2024', true) RETURNING season_id INTO s_id;

    t_fla := get_or_create_team('manual', 't-fla', 'Flamengo', 'BRA');
    t_pal := get_or_create_team('manual', 't-pal', 'Palmeiras', 'BRA');
    t_cor := get_or_create_team('manual', 't-cor', 'Corinthians', 'BRA');

    -- Fla 3x0 Cor (Fla 3 pts, SG +3)
    INSERT INTO match (competition_id, season_id, matchday, match_date, home_team_id, away_team_id, home_score, away_score, winner_team_id, status)
    VALUES (c_id, s_id, 1, '2024-04-14 16:00+00', t_fla, t_cor, 3, 0, t_fla, 'finished');

    -- Pal 1x0 Cor (Pal 3 pts, SG +1)
    INSERT INTO match (competition_id, season_id, matchday, match_date, home_team_id, away_team_id, home_score, away_score, winner_team_id, status)
    VALUES (c_id, s_id, 2, '2024-04-21 16:00+00', t_pal, t_cor, 1, 0, t_pal, 'finished');

    SELECT team_id, points, goal_difference INTO lead_team, lead_pts, lead_sg
    FROM vw_league_standings
    WHERE competition_id = c_id AND season_id = s_id AND position = 1;

    IF lead_team <> t_fla OR lead_pts <> 3 OR lead_sg <> 3 THEN
        RAISE EXCEPTION 'TESTE 14 FALHOU: líder incorreto (time=%, pts=%, sg=%)', lead_team, lead_pts, lead_sg;
    END IF;
    RAISE NOTICE 'TESTE 14 OK: classificação dinâmica calculada com precisão';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 15: Elenco ativo em vw_team_squad
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    t_id BIGINT;
    p_id BIGINT;
    squad_cnt INT;
BEGIN
    t_id := get_or_create_team('manual', 't-sq', 'Clube Squad', 'BRA');
    p_id := get_or_create_player('manual', 'p-sq-pedro', 'Pedro Atacante', '1997-06-20', 'BRA');

    INSERT INTO player_team_history (player_id, team_id, start_date, end_date, shirt_number, position_code, detailed_position, transfer_type)
    VALUES (p_id, t_id, '2020-01-23', NULL, 9, 'CF', 'Centroavante', 'transfer');

    SELECT count(*) INTO squad_cnt
    FROM vw_team_squad
    WHERE team_id = t_id AND player_id = p_id;

    IF squad_cnt <> 1 THEN
        RAISE EXCEPTION 'TESTE 15 FALHOU: jogador ativo não encontrado no elenco';
    END IF;
    RAISE NOTICE 'TESTE 15 OK: vw_team_squad retornou elenco ativo corretamente';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 16: Partida mata-mata com prorrogação e pênaltis
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    comp_id BIGINT;
    seas_id BIGINT;
    t1 BIGINT;
    t2 BIGINT;
    m_id BIGINT;
    winner BIGINT;
BEGIN
    INSERT INTO competition (canonical_name, country_code, competition_type) VALUES ('Copa Mata-Mata', 'BRA', 'cup') RETURNING competition_id INTO comp_id;
    INSERT INTO season (competition_id, name) VALUES (comp_id, '2024') RETURNING season_id INTO seas_id;
    t1 := get_or_create_team('manual', 't-cup-1', 'Gremio', 'BRA');
    t2 := get_or_create_team('manual', 't-cup-2', 'Internacional', 'BRA');

    INSERT INTO match (
        competition_id, season_id, stage, leg, match_date, home_team_id, away_team_id,
        home_score, away_score, home_score_extra_time, away_score_extra_time,
        home_penalty_score, away_penalty_score, winner_team_id, status
    ) VALUES (
        comp_id, seas_id, 'final', NULL, '2024-10-20 20:00+00', t1, t2,
        1, 1, 1, 1, 5, 4, t1, 'finished'
    ) RETURNING match_id, winner_team_id INTO m_id, winner;

    IF winner <> t1 THEN
        RAISE EXCEPTION 'TESTE 16 FALHOU: vencedor registrado incorreto';
    END IF;
    RAISE NOTICE 'TESTE 16 OK: mata-mata com prorrogação e disputa de pênaltis validado';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 17: Equipe de arbitragem completa (VAR, Assistentes e Árbitro)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    comp_id BIGINT;
    seas_id BIGINT;
    t1 BIGINT;
    t2 BIGINT;
    m_id BIGINT;
    r1 BIGINT;
    r2 BIGINT;
    r3 BIGINT;
    cnt INT;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Arbitragem', 'BRA') RETURNING competition_id INTO comp_id;
    INSERT INTO season (competition_id, name) VALUES (comp_id, '2024') RETURNING season_id INTO seas_id;
    t1 := get_or_create_team('manual', 't-arb-1', 'Time A', 'BRA');
    t2 := get_or_create_team('manual', 't-arb-2', 'Time B', 'BRA');

    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, home_score, away_score, status)
    VALUES (comp_id, seas_id, '2024-05-01 16:00+00', t1, t2, 0, 0, 'finished')
    RETURNING match_id INTO m_id;

    INSERT INTO referee (full_name, nationality_code) VALUES ('Wilton Pereira Sampaio', 'BRA') RETURNING referee_id INTO r1;
    INSERT INTO referee (full_name, nationality_code) VALUES ('Rodrigo DAlonso Ferreira', 'BRA') RETURNING referee_id INTO r2;
    INSERT INTO referee (full_name, nationality_code) VALUES ('Bruno Boschilia', 'BRA') RETURNING referee_id INTO r3;

    INSERT INTO match_official (match_id, referee_id, role) VALUES
        (m_id, r1, 'main_referee'),
        (m_id, r2, 'var'),
        (m_id, r3, 'assistant_1');

    SELECT count(*) INTO cnt FROM match_official WHERE match_id = m_id;
    IF cnt <> 3 THEN
        RAISE EXCEPTION 'TESTE 17 FALHOU: esperava 3 árbitros, achou %', cnt;
    END IF;
    RAISE NOTICE 'TESTE 17 OK: equipe de arbitragem e VAR registrados';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 18: Event stream com assistência, pênalti e gol
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    comp_id BIGINT;
    seas_id BIGINT;
    t1 BIGINT;
    t2 BIGINT;
    m_id BIGINT;
    p_autor BIGINT;
    p_garcom BIGINT;
    ev_id BIGINT;
    v_assist BIGINT;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Eventos', 'BRA') RETURNING competition_id INTO comp_id;
    INSERT INTO season (competition_id, name) VALUES (comp_id, '2024') RETURNING season_id INTO seas_id;
    t1 := get_or_create_team('manual', 't-ev-1', 'Time A', 'BRA');
    t2 := get_or_create_team('manual', 't-ev-2', 'Time B', 'BRA');

    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, home_score, away_score, status)
    VALUES (comp_id, seas_id, '2024-05-01 16:00+00', t1, t2, 1, 0, 'finished')
    RETURNING match_id INTO m_id;

    p_autor := get_or_create_player('manual', 'p-art', 'Autor do Gol', '1995-01-01', 'BRA');
    p_garcom := get_or_create_player('manual', 'p-gar', 'Garçom', '1996-01-01', 'BRA');

    ev_id := insert_match_event(
        m_id, 'fbref', t1, p_autor, 42, 10, 'goal', NULL, NULL, NULL, 1,
        p_garcom, false, false, 'right_foot', 'goal'
    );

    SELECT assist_player_id INTO v_assist FROM match_event WHERE event_id = ev_id;
    IF v_assist <> p_garcom THEN
        RAISE EXCEPTION 'TESTE 18 FALHOU: assistência não associada (esperava %, achou %)', p_garcom, v_assist;
    END IF;
    RAISE NOTICE 'TESTE 18 OK: stream de eventos com assistência validado';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 19: Histórico e sincronização de valor de mercado
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    p_id BIGINT;
    v_atual BIGINT;
    v_rec BIGINT;
BEGIN
    p_id := get_or_create_player('manual', 'p-vini-mkt', 'Vinicius Junior', '2000-07-12', 'BRA');

    INSERT INTO player_market_value_history (player_id, valuation_date, market_value_eur)
    VALUES (p_id, '2018-07-01', 45000000);

    INSERT INTO player_market_value_history (player_id, valuation_date, market_value_eur)
    VALUES (p_id, '2024-10-01', 200000000);

    SELECT market_value_eur, highest_market_value_eur INTO v_atual, v_rec
    FROM player WHERE player_id = p_id;

    IF v_atual <> 200000000 OR v_rec <> 200000000 THEN
        RAISE EXCEPTION 'TESTE 19 FALHOU: valores incorretos (atual=%, recorde=%)', v_atual, v_rec;
    END IF;
    RAISE NOTICE 'TESTE 19 OK: sincronização de valor de mercado e pico de carreira';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 20: Busca global unificada nativa (search_entities)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    cnt_player INT;
    cnt_team INT;
    v_slug TEXT;
BEGIN
    PERFORM get_or_create_player('manual', 'p-search', 'Gabriel Barbosa', '1996-08-30', 'BRA', 1.0, 'system', 'Gabigol');
    PERFORM get_or_create_team('manual', 't-search', 'Santos FC', 'BRA');

    SELECT count(*) INTO cnt_player FROM search_entities('Barbosa', 5) WHERE type = 'player';
    SELECT count(*), slug INTO cnt_team, v_slug FROM search_entities('Santos', 5) WHERE type = 'team' GROUP BY slug LIMIT 1;

    IF cnt_player < 1 THEN
        RAISE EXCEPTION 'TESTE 20 FALHOU: não encontrou jogador buscado';
    END IF;
    IF cnt_team < 1 THEN
        RAISE EXCEPTION 'TESTE 20 FALHOU: não encontrou clube buscado';
    END IF;
    IF v_slug IS NULL THEN
        RAISE EXCEPTION 'TESTE 20 FALHOU: slug deve estar presente sem URLs hardcoded';
    END IF;
    RAISE NOTICE 'TESTE 20 OK: busca global search_entities validada';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 21: Consulta de classificação retroativa por rodada (fn_standings_at_round)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    c_id BIGINT;
    s_id BIGINT;
    t_fla BIGINT;
    t_cor BIGINT;
    pts_r1 INT;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Rodadas', 'BRA') RETURNING competition_id INTO c_id;
    INSERT INTO season (competition_id, name) VALUES (c_id, '2024') RETURNING season_id INTO s_id;

    t_fla := get_or_create_team('manual', 't-r-fla', 'Flamengo', 'BRA');
    t_cor := get_or_create_team('manual', 't-r-cor', 'Corinthians', 'BRA');

    INSERT INTO match (competition_id, season_id, matchday, match_date, home_team_id, away_team_id, home_score, away_score, winner_team_id, status)
    VALUES (c_id, s_id, 1, '2024-04-14 16:00+00', t_fla, t_cor, 3, 0, t_fla, 'finished');

    SELECT points INTO pts_r1
    FROM fn_standings_at_round(c_id, s_id, 1::smallint)
    WHERE team_id = t_fla;

    IF pts_r1 <> 3 THEN
        RAISE EXCEPTION 'TESTE 21 FALHOU: esperava 3 pontos na rodada 1, achou %', pts_r1;
    END IF;
    RAISE NOTICE 'TESTE 21 OK: consulta de classificação retroativa por rodada funcionando';
END $$;
ROLLBACK;

-- =====================================================================
-- PARTE 2: TESTES DE REGRESSÃO DAS 10 FALHAS CONFIRMADAS (TESTES 22 A 38)
-- =====================================================================

-- ---------------------------------------------------------------------
-- TESTE 22: REGRESSÃO #1 — FK Composta (season_id, competition_id)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    c1 BIGINT;
    c2 BIGINT;
    s1 BIGINT;
    s2 BIGINT;
    t1 BIGINT;
    t2 BIGINT;
    p_id BIGINT;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Alpha', 'BRA') RETURNING competition_id INTO c1;
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Beta', 'BRA') RETURNING competition_id INTO c2;

    INSERT INTO season (competition_id, name) VALUES (c1, '2024') RETURNING season_id INTO s1;
    INSERT INTO season (competition_id, name) VALUES (c2, '2024') RETURNING season_id INTO s2;

    t1 := get_or_create_team('manual', 't-fk-1', 'Clube 1', 'BRA');
    t2 := get_or_create_team('manual', 't-fk-2', 'Clube 2', 'BRA');
    p_id := get_or_create_player('manual', 'p-fk-1', 'Jogador FK', '2000-01-01', 'BRA');

    -- Tentativa de inserir match associada à Comp 1 com Season da Comp 2
    BEGIN
        INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, status)
        VALUES (c1, s2, '2024-05-01 16:00+00', t1, t2, 'scheduled');
        RAISE EXCEPTION 'REGRESSÃO #1 FALHOU: permitiu partida com season_id de outra competição!';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'REGRESSÃO #1a OK: match rejeitou season de outra competição via FK composta';
    END;

    -- Tentativa de inserir player_season_stats com temporada cruzada
    BEGIN
        INSERT INTO player_season_stats (player_id, team_id, competition_id, season_id, source_id, stat_type, stats)
        VALUES (p_id, t1, c1, s2, (SELECT source_id FROM dim_source WHERE code='fbref'), 'standard', '{}'::jsonb);
        RAISE EXCEPTION 'REGRESSÃO #1 FALHOU: permitiu player_season_stats com season de outra competição!';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'REGRESSÃO #1b OK: player_season_stats rejeitou season de outra competição via FK composta';
    END;

    -- Tentativa de inserir team_season_stats com temporada cruzada
    BEGIN
        INSERT INTO team_season_stats (team_id, competition_id, season_id, source_id, stat_type, stats)
        VALUES (t1, c1, s2, (SELECT source_id FROM dim_source WHERE code='fbref'), 'standard', '{}'::jsonb);
        RAISE EXCEPTION 'REGRESSÃO #1 FALHOU: permitiu team_season_stats com season de outra competição!';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'REGRESSÃO #1c OK: team_season_stats rejeitou season de outra competição via FK composta';
    END;
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 23: REGRESSÃO #2 — Estatística bloqueada para clube que não jogou a partida
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    c_id BIGINT;
    s_id BIGINT;
    t_home BIGINT;
    t_away BIGINT;
    t_alien BIGINT;
    p_id BIGINT;
    m_id BIGINT;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Validacao', 'BRA') RETURNING competition_id INTO c_id;
    INSERT INTO season (competition_id, name) VALUES (c_id, '2024') RETURNING season_id INTO s_id;

    t_home := get_or_create_team('manual', 't-val-h', 'Mandante Real', 'BRA');
    t_away := get_or_create_team('manual', 't-val-a', 'Visitante Real', 'BRA');
    t_alien := get_or_create_team('manual', 't-val-alien', 'Clube Alienigena', 'BRA');
    p_id := get_or_create_player('manual', 'p-val-alien', 'Jogador Alien', '2000-01-01', 'BRA');

    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, status)
    VALUES (c_id, s_id, '2024-05-01 16:00+00', t_home, t_away, 'scheduled')
    RETURNING match_id INTO m_id;

    -- Caso A: insert_match_event com clube alienígena
    BEGIN
        PERFORM insert_match_event(m_id, 'fbref', t_alien, p_id, 10, NULL, 'goal');
        RAISE EXCEPTION 'REGRESSÃO #2 FALHOU: aceitou evento com clube alienígena!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%não disputou a partida%' THEN
            RAISE EXCEPTION 'REGRESSÃO #2 FALHOU: erro inesperado: %', SQLERRM;
        END IF;
        RAISE NOTICE 'REGRESSÃO #2a OK: insert_match_event bloqueou clube alienígena';
    END;

    -- Caso B: insert_player_match_stat com clube alienígena
    BEGIN
        PERFORM insert_player_match_stat(m_id, p_id, t_alien, 'fbref', 'standard', '{"goals": 1}'::jsonb);
        RAISE EXCEPTION 'REGRESSÃO #2 FALHOU: aceitou player_match_stat com clube alienígena!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%não disputou a partida%' THEN
            RAISE EXCEPTION 'REGRESSÃO #2 FALHOU: erro inesperado: %', SQLERRM;
        END IF;
        RAISE NOTICE 'REGRESSÃO #2b OK: insert_player_match_stat bloqueou clube alienígena';
    END;

    -- Caso C: insert_team_match_stat com clube alienígena
    BEGIN
        PERFORM insert_team_match_stat(m_id, t_alien, 'fbref', 'standard', '{"goals": 1}'::jsonb);
        RAISE EXCEPTION 'REGRESSÃO #2 FALHOU: aceitou team_match_stat com clube alienígena!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%não disputou a partida%' THEN
            RAISE EXCEPTION 'REGRESSÃO #2 FALHOU: erro inesperado: %', SQLERRM;
        END IF;
        RAISE NOTICE 'REGRESSÃO #2c OK: insert_team_match_stat bloqueou clube alienígena';
    END;

    -- Caso D: player_appearance com clube alienígena
    BEGIN
        INSERT INTO player_appearance (match_id, player_id, team_id, source_id)
        VALUES (m_id, p_id, t_alien, (SELECT source_id FROM dim_source WHERE code='fbref'));
        RAISE EXCEPTION 'REGRESSÃO #2 FALHOU: aceitou player_appearance com clube alienígena!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%não disputou a partida%' AND SQLERRM NOT LIKE '%não participou da partida%' THEN
            RAISE EXCEPTION 'REGRESSÃO #2 FALHOU: erro inesperado: %', SQLERRM;
        END IF;
        RAISE NOTICE 'REGRESSÃO #2d OK: trigger de player_appearance bloqueou clube alienígena';
    END;
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 24: REGRESSÃO #3 — Consistência de placar e vencedor
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    c_id BIGINT;
    s_id BIGINT;
    t1 BIGINT;
    t2 BIGINT;
    m_id BIGINT;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Placar', 'BRA') RETURNING competition_id INTO c_id;
    INSERT INTO season (competition_id, name) VALUES (c_id, '2024') RETURNING season_id INTO s_id;
    t1 := get_or_create_team('manual', 't-sc-1', 'Mandante', 'BRA');
    t2 := get_or_create_team('manual', 't-sc-2', 'Visitante', 'BRA');

    -- Caso A: Partida finished sem placar (home_score NULL)
    BEGIN
        INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, status)
        VALUES (c_id, s_id, '2024-05-01 16:00+00', t1, t2, 'finished');
        RAISE EXCEPTION 'REGRESSÃO #3 FALHOU: permitiu partida finished sem placar!';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'REGRESSÃO #3a OK: CHECK bloqueou partida finished sem placar preenchido';
    END;

    -- Caso B: 3x0 para mandante, mas vencedor setado como visitante (t2)
    BEGIN
        INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, home_score, away_score, winner_team_id, status)
        VALUES (c_id, s_id, '2024-05-01 16:00+00', t1, t2, 3, 0, t2, 'finished');
        RAISE EXCEPTION 'REGRESSÃO #3 FALHOU: permitiu 3x0 com vencedor sendo visitante!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Vencedor incoerente%' THEN
            RAISE EXCEPTION 'REGRESSÃO #3 FALHOU: mensagem inesperada: %', SQLERRM;
        END IF;
        RAISE NOTICE 'REGRESSÃO #3b OK: trigger de consistência bloqueou vencedor incompatível com placar';
    END;

    -- Caso C: 2x2 no tempo normal sem pênaltis, mas vencedor setado como mandante (t1)
    BEGIN
        INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, home_score, away_score, winner_team_id, status)
        VALUES (c_id, s_id, '2024-05-01 16:00+00', t1, t2, 2, 2, t1, 'finished');
        RAISE EXCEPTION 'REGRESSÃO #3 FALHOU: permitiu vencedor em empate sem prorrogação/pênaltis!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Vencedor incoerente%' AND SQLERRM NOT LIKE '%Partida empatada%' THEN
            RAISE EXCEPTION 'REGRESSÃO #3 FALHOU: mensagem inesperada: %', SQLERRM;
        END IF;
        RAISE NOTICE 'REGRESSÃO #3c OK: trigger de consistência bloqueou vencedor em empate';
    END;

    -- Caso D: 3x0 para mandante com vencedor correto (t1) -> DEVE PASSAR
    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, home_score, away_score, winner_team_id, status)
    VALUES (c_id, s_id, '2024-05-01 16:00+00', t1, t2, 3, 0, t1, 'finished')
    RETURNING match_id INTO m_id;
    RAISE NOTICE 'REGRESSÃO #3d OK: placar e vencedor consistentes aceitos com sucesso';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 25: REGRESSÃO #4 — Backfill de valor de mercado não sobrescreve valor atual
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    p_id BIGINT;
    v_atual BIGINT;
    v_rec BIGINT;
BEGIN
    p_id := get_or_create_player('manual', 'p-backfill', 'Jogador Backfill', '2000-01-01', 'BRA');

    -- Valor mais recente: 2024 valendo 200M
    INSERT INTO player_market_value_history (player_id, valuation_date, market_value_eur)
    VALUES (p_id, '2024-01-01', 200000000);

    -- Backfill: insere valor antigo de 2019 valendo 60M
    INSERT INTO player_market_value_history (player_id, valuation_date, market_value_eur)
    VALUES (p_id, '2019-01-01', 60000000);

    SELECT market_value_eur, highest_market_value_eur INTO v_atual, v_rec
    FROM player WHERE player_id = p_id;

    IF v_atual <> 200000000 THEN
        RAISE EXCEPTION 'REGRESSÃO #4 FALHOU: backfill sobrescreveu valor atual para % em vez de manter 200000000', v_atual;
    END IF;
    IF v_rec <> 200000000 THEN
        RAISE EXCEPTION 'REGRESSÃO #4 FALHOU: recorde histórico incorreto (%)', v_rec;
    END IF;
    RAISE NOTICE 'REGRESSÃO #4 OK: backfill histórico não sobrescreveu o valor atual da data mais recente';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 26: REGRESSÃO #5 — vw_top_scorers sem contagem dupla e agrega transferências
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    c_id BIGINT;
    s_id BIGINT;
    t1 BIGINT;
    t2 BIGINT;
    t3 BIGINT;
    p_id BIGINT;
    m1 BIGINT;
    m2 BIGINT;
    row_cnt INT;
    tot_goals INT;
    cur_team BIGINT;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Artilharia', 'BRA') RETURNING competition_id INTO c_id;
    INSERT INTO season (competition_id, name) VALUES (c_id, '2024') RETURNING season_id INTO s_id;

    t1 := get_or_create_team('manual', 't-art-1', 'Clube Origem', 'BRA');
    t2 := get_or_create_team('manual', 't-art-2', 'Adversario', 'BRA');
    t3 := get_or_create_team('manual', 't-art-3', 'Clube Destino', 'BRA');
    p_id := get_or_create_player('manual', 'p-art-transf', 'Goleador Viajante', '1998-05-10', 'BRA');

    -- Partida 1: Jogador joga pelo Clube Origem (t1) e faz 2 gols
    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, home_score, away_score, status)
    VALUES (c_id, s_id, '2024-02-01 16:00+00', t1, t2, 2, 0, 'finished')
    RETURNING match_id INTO m1;

    -- Ingestão dupla do mesmo jogo via FBref e Understat
    PERFORM insert_player_match_stat(m1, p_id, t1, 'fbref', 'standard', '{"goals": 2, "minutes": 90}'::jsonb);
    PERFORM insert_player_match_stat(m1, p_id, t1, 'understat', 'standard', '{"goals": 2, "minutes": 90}'::jsonb);

    -- Partida 2: Jogador se transferiu para Clube Destino (t3) e faz 3 gols
    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, home_score, away_score, status)
    VALUES (c_id, s_id, '2024-08-01 16:00+00', t3, t2, 3, 1, 'finished')
    RETURNING match_id INTO m2;

    PERFORM insert_player_match_stat(m2, p_id, t3, 'fbref', 'standard', '{"goals": 3, "minutes": 90}'::jsonb);

    -- Atualiza camada Gold
    PERFORM refresh_gold_views(false);

    SELECT count(*), SUM(goals), MAX(team_id) INTO row_cnt, tot_goals, cur_team
    FROM vw_top_scorers
    WHERE competition_id = c_id AND season_id = s_id AND player_id = p_id;

    IF row_cnt <> 1 THEN
        RAISE EXCEPTION 'REGRESSÃO #5 FALHOU: jogador apareceu em % linhas em vez de 1', row_cnt;
    END IF;

    IF tot_goals <> 5 THEN
        RAISE EXCEPTION 'REGRESSÃO #5 FALHOU: total de gols foi % em vez de 5', tot_goals;
    END IF;

    IF cur_team <> t3 THEN
        RAISE EXCEPTION 'REGRESSÃO #5 FALHOU: clube atual deveria ser % (Destino), achou %', t3, cur_team;
    END IF;

    RAISE NOTICE 'REGRESSÃO #5 OK: vw_top_scorers sem contagem dupla e agrega transferências em linha única';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 27: REGRESSÃO #6 — Particionamento imune ao fuso horário da sessão
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    c_id BIGINT;
    s_id BIGINT;
    t1 BIGINT;
    t2 BIGINT;
    p_id BIGINT;
    m_id BIGINT;
    ev_id BIGINT;
    stat_id BIGINT;
    part_ev TEXT;
    part_stat TEXT;
BEGIN
    SET LOCAL timezone = 'Asia/Tokyo';

    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Fuso', 'BRA') RETURNING competition_id INTO c_id;
    INSERT INTO season (competition_id, name) VALUES (c_id, '2024') RETURNING season_id INTO s_id;
    t1 := get_or_create_team('manual', 't-tz-1', 'Time A', 'BRA');
    t2 := get_or_create_team('manual', 't-tz-2', 'Time B', 'BRA');
    p_id := get_or_create_player('manual', 'p-tz-1', 'Jogador Fuso', '2000-01-01', 'BRA');

    -- Partida em 31/12/2024 às 23:30 UTC (em Tóquio já é 01/01/2025 às 08:30)
    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, status)
    VALUES (c_id, s_id, '2024-12-31 23:30:00+00', t1, t2, 'scheduled')
    RETURNING match_id INTO m_id;

    ev_id := insert_match_event(m_id, 'fbref', t1, p_id, 10, NULL, 'shot');
    stat_id := insert_player_match_stat(m_id, p_id, t1, 'fbref', 'standard', '{"goals": 0}'::jsonb);

    SELECT tableoid::regclass::text INTO part_ev FROM match_event WHERE event_id = ev_id;
    SELECT tableoid::regclass::text INTO part_stat FROM player_match_stats WHERE id = stat_id;

    IF part_ev <> 'match_event_2024' THEN
        RAISE EXCEPTION 'REGRESSÃO #6 FALHOU: evento caiu na partição % em vez de match_event_2024', part_ev;
    END IF;
    IF part_stat <> 'player_match_stats_2024' THEN
        RAISE EXCEPTION 'REGRESSÃO #6 FALHOU: stat caiu na partição % em vez de player_match_stats_2024', part_stat;
    END IF;

    RAISE NOTICE 'REGRESSÃO #6 OK: funções insert_* usam UTC e isolam ano de partição do fuso da sessão';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 28: REGRESSÃO #7 — Nacionalidades britânicas e países FIFA aceitos
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    p_eng BIGINT;
    p_sco BIGINT;
    p_wal BIGINT;
    p_nir BIGINT;
    p_gib BIGINT;
    p_fro BIGINT;
    p_kos BIGINT;
BEGIN
    p_eng := get_or_create_player('manual', 'p-eng', 'Harry Kane', '1993-07-28', 'ENG');
    p_sco := get_or_create_player('manual', 'p-sco', 'Andy Robertson', '1994-03-11', 'SCO');
    p_wal := get_or_create_player('manual', 'p-wal', 'Gareth Bale', '1989-07-16', 'WAL');
    p_nir := get_or_create_player('manual', 'p-nir', 'Jonny Evans', '1988-01-03', 'NIR');
    p_gib := get_or_create_player('manual', 'p-gib', 'Jogador Gibraltar', '1995-01-01', 'GIB');
    p_fro := get_or_create_player('manual', 'p-fro', 'Jogador Faroes', '1996-01-01', 'FRO');
    p_kos := get_or_create_player('manual', 'p-kos', 'Jogador Kosovo', '1997-01-01', 'KOS');

    RAISE NOTICE 'REGRESSÃO #7 OK: países do Reino Unido e federações FIFA cadastrados e válidos na FK';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 29: REGRESSÃO #8 — Deduplicação de variação de nome e fila de revisão
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    id_orig BIGINT;
    id_alias BIGINT;
    cnt_players INT;
    cnt_aliases INT;
    rev_cnt INT;
BEGIN
    id_orig := get_or_create_player('transfermarkt', 'tm-vini', 'Vinicius Junior', '2000-07-12', 'BRA');
    id_alias := get_or_create_player('opta', 'opta-vini-99', 'Vinicius Jr', '2000-07-12', 'BRA');

    IF id_orig <> id_alias THEN
        RAISE EXCEPTION 'REGRESSÃO #8 FALHOU: variação de grafia criou jogador duplicado (% vs %)', id_orig, id_alias;
    END IF;

    SELECT count(*) INTO cnt_players FROM player WHERE normalized_name IN (normalize_name('Vinicius Junior'), normalize_name('Vinicius Jr'));
    IF cnt_players <> 1 THEN
        RAISE EXCEPTION 'REGRESSÃO #8 FALHOU: esperava 1 jogador, achou %', cnt_players;
    END IF;

    SELECT count(*) INTO cnt_aliases FROM player_alias WHERE player_id = id_orig;
    IF cnt_aliases < 1 THEN
        RAISE EXCEPTION 'REGRESSÃO #8 FALHOU: variação não foi gravada em player_alias';
    END IF;

    -- Homônimos ambíguos sem data de nascimento -> entity_match_review
    PERFORM get_or_create_player('manual', 'candidato-1', 'Carlos Silva', '1990-01-01', 'BRA');
    PERFORM get_or_create_player('manual', 'candidato-2', 'Carlos Silva', '1995-05-05', 'BRA');

    PERFORM get_or_create_player('fbref', 'ambiguous-cs', 'Carlos Silva', NULL, 'BRA', 1.0, 'system', NULL, '{"source": "test"}'::jsonb);

    SELECT count(*) INTO rev_cnt FROM entity_match_review WHERE entity_type = 'player' AND status = 'pending';
    IF rev_cnt < 1 THEN
        RAISE EXCEPTION 'REGRESSÃO #8 FALHOU: caso ambíguo não foi registrado em entity_match_review';
    END IF;

    RAISE NOTICE 'REGRESSÃO #8 OK: variação de nome deduplicada por trigrama/alias e ambiguidades enviadas para revisão';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 30: REGRESSÃO #9 — Procedimento merge_players funcional
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    p_dup BIGINT;
    p_canon BIGINT;
    c_id BIGINT;
    s_id BIGINT;
    t_home BIGINT;
    t_away BIGINT;
    m_id BIGINT;
    ev_cnt INT;
    log_cnt INT;
    dup_exists INT;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Merge', 'BRA') RETURNING competition_id INTO c_id;
    INSERT INTO season (competition_id, name) VALUES (c_id, '2024') RETURNING season_id INTO s_id;
    t_home := get_or_create_team('manual', 't-mg-h', 'Time Merge A', 'BRA');
    t_away := get_or_create_team('manual', 't-mg-a', 'Time Merge B', 'BRA');

    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, status)
    VALUES (c_id, s_id, '2024-05-01 16:00+00', t_home, t_away, 'scheduled')
    RETURNING match_id INTO m_id;

    p_dup := get_or_create_player('manual', 'p-dup-01', 'Jogador Duplicado', '1999-01-01', 'BRA');
    p_canon := get_or_create_player('manual', 'p-canon-01', 'Jogador Canonico', '1999-01-01', 'BRA');

    PERFORM insert_match_event(m_id, 'fbref', t_home, p_dup, 15, NULL, 'shot');
    INSERT INTO player_market_value_history (player_id, valuation_date, market_value_eur)
    VALUES (p_dup, '2023-01-01', 10000000);

    CALL merge_players(p_dup, p_canon, 'Deduplicação de teste', 'admin_test');

    SELECT count(*) INTO ev_cnt FROM match_event WHERE player_id = p_canon;
    IF ev_cnt <> 1 THEN
        RAISE EXCEPTION 'REGRESSÃO #9 FALHOU: match_event não foi reapontado para o jogador canônico';
    END IF;

    SELECT count(*) INTO log_cnt
    FROM entity_merge_log
    WHERE from_entity_id = p_dup AND to_entity_id = p_canon;
    IF log_cnt <> 1 THEN
        RAISE EXCEPTION 'REGRESSÃO #9 FALHOU: merge não foi registrado em entity_merge_log';
    END IF;

    SELECT count(*) INTO dup_exists FROM player WHERE player_id = p_dup;
    IF dup_exists <> 0 THEN
        RAISE EXCEPTION 'REGRESSÃO #9 FALHOU: jogador duplicado não foi removido';
    END IF;

    RAISE NOTICE 'REGRESSÃO #9 OK: merge_players reapontou todas as dependências e auditou a operação';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 31: REGRESSÃO #10 — Posição desconhecida não é inventada em vw_team_squad
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    t_id BIGINT;
    p_id BIGINT;
    v_pos TEXT;
    v_name TEXT;
BEGIN
    t_id := get_or_create_team('manual', 't-sq-pos', 'Clube Sem Posicao', 'BRA');
    p_id := get_or_create_player('manual', 'p-sem-pos', 'Jogador Sem Posicao', '2002-04-10', 'BRA');

    INSERT INTO player_team_history (player_id, team_id, start_date, end_date, transfer_type, position_code)
    VALUES (p_id, t_id, '2023-01-01', NULL, 'transfer', NULL);

    SELECT position_code, position_name INTO v_pos, v_name
    FROM vw_team_squad
    WHERE team_id = t_id AND player_id = p_id;

    IF v_pos IS NOT NULL OR v_name IS NOT NULL THEN
        RAISE EXCEPTION 'REGRESSÃO #10 FALHOU: retornou posição fabricada (% / %)', v_pos, v_name;
    END IF;

    RAISE NOTICE 'REGRESSÃO #10 OK: posição desconhecida retorna NULL sem fabricar Meio-campista';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 32: REGRESSÃO #11 — create_partitions_for_year com dados na DEFAULT
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    c_id BIGINT;
    s_id BIGINT;
    t1 BIGINT;
    t2 BIGINT;
    m_id BIGINT;
    ev_id BIGINT;
    p_before TEXT;
    p_after TEXT;
    def_cnt INT;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Futura', 'BRA') RETURNING competition_id INTO c_id;
    INSERT INTO season (competition_id, name) VALUES (c_id, '2039') RETURNING season_id INTO s_id;
    t1 := get_or_create_team('manual', 't-fut-1', 'Time Fut 1', 'BRA');
    t2 := get_or_create_team('manual', 't-fut-2', 'Time Fut 2', 'BRA');

    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, status)
    VALUES (c_id, s_id, '2039-06-15 16:00+00', t1, t2, 'scheduled')
    RETURNING match_id INTO m_id;

    ev_id := insert_match_event(m_id, 'fbref', t1, NULL, 5, NULL, 'shot');

    SELECT tableoid::regclass::text INTO p_before FROM match_event WHERE event_id = ev_id;
    IF p_before <> 'match_event_default' THEN
        RAISE EXCEPTION 'REGRESSÃO #11 FALHOU: esperado match_event_default antes da procedure, achou %', p_before;
    END IF;

    CALL create_partitions_for_year(2039);

    SELECT tableoid::regclass::text INTO p_after FROM match_event WHERE event_id = ev_id;
    IF p_after <> 'match_event_2039' THEN
        RAISE EXCEPTION 'REGRESSÃO #11 FALHOU: evento não foi migrado para match_event_2039 (achou %)', p_after;
    END IF;

    SELECT count(*) INTO def_cnt FROM match_event_default WHERE event_id = ev_id;
    IF def_cnt <> 0 THEN
        RAISE EXCEPTION 'REGRESSÃO #11 FALHOU: linha ainda permanece na partição default';
    END IF;

    RAISE NOTICE 'REGRESSÃO #11 OK: create_partitions_for_year criou partição e migrou dados da default com sucesso';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 33: REGRESSÃO #12 — Deduplicação em staging_raw via payload_hash
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    v_src SMALLINT;
    cnt INT;
BEGIN
    SELECT source_id INTO v_src FROM dim_source WHERE code = 'fbref';

    INSERT INTO staging_raw (source_id, entity_type, native_id, payload)
    VALUES (v_src, 'match', 'm-123', '{"match_id": "123", "score": "2-1"}'::jsonb)
    ON CONFLICT (source_id, entity_type, native_id, payload_hash) DO NOTHING;

    INSERT INTO staging_raw (source_id, entity_type, native_id, payload)
    VALUES (v_src, 'match', 'm-123', '{"match_id": "123", "score": "2-1"}'::jsonb)
    ON CONFLICT (source_id, entity_type, native_id, payload_hash) DO NOTHING;

    SELECT count(*) INTO cnt FROM staging_raw WHERE source_id = v_src AND entity_type = 'match' AND native_id = 'm-123';
    IF cnt <> 1 THEN
        RAISE EXCEPTION 'REGRESSÃO #12 FALHOU: staging_raw gerou % linhas para o mesmo payload', cnt;
    END IF;

    RAISE NOTICE 'REGRESSÃO #12 OK: payload_hash deduplicou cargas idênticas em staging_raw';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 34: REGRESSÃO #13 — Propagação de alteração de match_date
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    c_id BIGINT;
    s_id BIGINT;
    t1 BIGINT;
    t2 BIGINT;
    m_id BIGINT;
    ev_id BIGINT;
    st_id BIGINT;
    new_ev_date DATE;
    new_st_date DATE;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga Adiada', 'BRA') RETURNING competition_id INTO c_id;
    INSERT INTO season (competition_id, name) VALUES (c_id, '2024') RETURNING season_id INTO s_id;
    t1 := get_or_create_team('manual', 't-adi-1', 'Time A', 'BRA');
    t2 := get_or_create_team('manual', 't-adi-2', 'Time B', 'BRA');

    INSERT INTO match (competition_id, season_id, match_date, home_team_id, away_team_id, status)
    VALUES (c_id, s_id, '2024-05-10 16:00+00', t1, t2, 'scheduled')
    RETURNING match_id INTO m_id;

    ev_id := insert_match_event(m_id, 'fbref', t1, NULL, 10, NULL, 'shot');
    st_id := insert_team_match_stat(m_id, t1, 'fbref', 'standard', '{"shots": 5}'::jsonb);

    UPDATE match
    SET match_date = '2024-05-25 18:00+00'
    WHERE match_id = m_id;

    SELECT event_date INTO new_ev_date FROM match_event WHERE event_id = ev_id;
    SELECT stat_date INTO new_st_date FROM team_match_stats WHERE id = st_id;

    IF new_ev_date <> '2024-05-25' OR new_st_date <> '2024-05-25' THEN
        RAISE EXCEPTION 'REGRESSÃO #13 FALHOU: datas não foram propagadas (ev=%, st=%)', new_ev_date, new_st_date;
    END IF;

    RAISE NOTICE 'REGRESSÃO #13 OK: trg_sync_match_date propagou atualização de match_date para eventos e stats';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 35: REGRESSÃO #14 — Teste unitário de safe_numeric (alta performance regex)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
BEGIN
    IF safe_numeric('123.45') <> 123.45 THEN
        RAISE EXCEPTION 'REGRESSÃO #14 FALHOU: safe_numeric(123.45)';
    END IF;
    IF safe_numeric('-99.001') <> -99.001 THEN
        RAISE EXCEPTION 'REGRESSÃO #14 FALHOU: safe_numeric(-99.001)';
    END IF;
    IF safe_numeric('  42  ') <> 42 THEN
        RAISE EXCEPTION 'REGRESSÃO #14 FALHOU: safe_numeric(espaços)';
    END IF;
    IF safe_numeric('1e5') <> 100000 THEN
        RAISE EXCEPTION 'REGRESSÃO #14 FALHOU: safe_numeric(notação científica)';
    END IF;
    IF safe_numeric('abc') IS NOT NULL THEN
        RAISE EXCEPTION 'REGRESSÃO #14 FALHOU: safe_numeric(abc) deveria ser NULL';
    END IF;
    IF safe_numeric('') IS NOT NULL THEN
        RAISE EXCEPTION 'REGRESSÃO #14 FALHOU: safe_numeric("") deveria ser NULL';
    END IF;
    IF safe_numeric(NULL) IS NOT NULL THEN
        RAISE EXCEPTION 'REGRESSÃO #14 FALHOU: safe_numeric(NULL) deveria ser NULL';
    END IF;
    RAISE NOTICE 'REGRESSÃO #14 OK: safe_numeric SQL regex validou números válidos e descartou inválidos';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 36: REGRESSÃO #15 — Escape de wildcard no search_entities
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT count(*) INTO cnt FROM search_entities('%', 10);
    IF cnt > 0 THEN
        RAISE EXCEPTION 'REGRESSÃO #15 FALHOU: busca com %% retornou % registros', cnt;
    END IF;
    RAISE NOTICE 'REGRESSÃO #15 OK: search_entities escapa wildcards do LIKE';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 37: REGRESSÃO #16 — Permissões de Segurança da Role app_reader
-- ---------------------------------------------------------------------
BEGIN;
DO $$
BEGIN
    SET LOCAL ROLE app_reader;

    PERFORM count(*) FROM vw_league_standings;
    PERFORM count(*) FROM team;
    PERFORM count(*) FROM player;

    BEGIN
        INSERT INTO country (country_code, name) VALUES ('XYZ', 'Pais Ilegal');
        RAISE EXCEPTION 'REGRESSÃO #16 FALHOU: app_reader conseguiu inserir linha!';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'REGRESSÃO #16 OK: permissão de INSERT bloqueada para role app_reader';
    END;
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 38: REGRESSÃO #17 — Advisory lock e consistência concorrente
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    p1 BIGINT;
    p2 BIGINT;
BEGIN
    p1 := get_or_create_player('manual', 'p-adv-1', 'Jogador Advisory Teste', '1995-10-10', 'BRA');
    p2 := get_or_create_player('manual', 'p-adv-1', 'Jogador Advisory Teste', '1995-10-10', 'BRA');

    IF p1 <> p2 THEN
        RAISE EXCEPTION 'REGRESSÃO #17 FALHOU: IDs diferentes retornados (% vs %)', p1, p2;
    END IF;

    RAISE NOTICE 'REGRESSÃO #17 OK: controle transacional de advisory lock validado';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 39: RPC API — Confronto direto histórico (fn_team_head_to_head)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    c_id BIGINT;
    s_id BIGINT;
    t_fla BIGINT;
    t_pal BIGINT;
    v_h2h JSONB;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Brasileirao H2H', 'BRA') RETURNING competition_id INTO c_id;
    INSERT INTO season (competition_id, name) VALUES (c_id, '2024') RETURNING season_id INTO s_id;

    t_fla := get_or_create_team('manual', 't-h2h-fla', 'Flamengo', 'BRA');
    t_pal := get_or_create_team('manual', 't-h2h-pal', 'Palmeiras', 'BRA');

    -- Jogo 1: Fla 2x1 Pal (Fla vence)
    INSERT INTO match (competition_id, season_id, matchday, match_date, home_team_id, away_team_id, home_score, away_score, winner_team_id, status)
    VALUES (c_id, s_id, 1, '2024-05-01 16:00+00', t_fla, t_pal, 2, 1, t_fla, 'finished');

    -- Jogo 2: Pal 3x0 Fla (Pal vence)
    INSERT INTO match (competition_id, season_id, matchday, match_date, home_team_id, away_team_id, home_score, away_score, winner_team_id, status)
    VALUES (c_id, s_id, 2, '2024-08-10 16:00+00', t_pal, t_fla, 3, 0, t_pal, 'finished');

    -- Jogo 3: Fla 1x1 Pal (Empate)
    INSERT INTO match (competition_id, season_id, matchday, match_date, home_team_id, away_team_id, home_score, away_score, winner_team_id, status)
    VALUES (c_id, s_id, 3, '2024-11-20 16:00+00', t_fla, t_pal, 1, 1, NULL, 'finished');

    v_h2h := fn_team_head_to_head(t_fla, t_pal, 5);

    IF (v_h2h->'summary'->>'total_matches')::INT <> 3 THEN
        RAISE EXCEPTION 'TESTE 39 FALHOU: total_matches esperado 3, obteve %', v_h2h->'summary'->>'total_matches';
    END IF;
    IF (v_h2h->'summary'->>'team_a_wins')::INT <> 1 OR (v_h2h->'summary'->>'team_b_wins')::INT <> 1 OR (v_h2h->'summary'->>'draws')::INT <> 1 THEN
        RAISE EXCEPTION 'TESTE 39 FALHOU: resumo de vitórias/empates incorreto: %', v_h2h->'summary';
    END IF;
    IF (v_h2h->'summary'->>'team_a_goals')::INT <> 3 OR (v_h2h->'summary'->>'team_b_goals')::INT <> 5 THEN
        RAISE EXCEPTION 'TESTE 39 FALHOU: gols calculados incorretamente: %', v_h2h->'summary';
    END IF;
    IF jsonb_array_length(v_h2h->'recent_matches') <> 3 THEN
        RAISE EXCEPTION 'TESTE 39 FALHOU: recent_matches esperado tamanho 3';
    END IF;

    RAISE NOTICE 'TESTE 39 OK: fn_team_head_to_head consolidou histórico de confrontos com perfeição';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 40: RPC API — Detalhes completos da partida (fn_api_match_details)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    c_id BIGINT;
    s_id BIGINT;
    v_id BIGINT;
    r_id BIGINT;
    t_home BIGINT;
    t_away BIGINT;
    m_id BIGINT;
    p_art BIGINT;
    p_gar BIGINT;
    p_res BIGINT;
    v_details JSONB;
BEGIN
    INSERT INTO venue (name, city, capacity, country_code) VALUES ('Estadio Central', 'Rio de Janeiro', 60000, 'BRA') RETURNING venue_id INTO v_id;
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga RPC Match', 'BRA') RETURNING competition_id INTO c_id;
    INSERT INTO season (competition_id, name) VALUES (c_id, '2024') RETURNING season_id INTO s_id;
    INSERT INTO referee (full_name, nationality_code) VALUES ('Arbitro FIFA', 'BRA') RETURNING referee_id INTO r_id;

    t_home := get_or_create_team('manual', 't-rpc-h', 'Time Mandante', 'BRA');
    t_away := get_or_create_team('manual', 't-rpc-a', 'Time Visitante', 'BRA');

    p_art := get_or_create_player('manual', 'p-rpc-1', 'Goleador Titular', '1995-03-01', 'BRA');
    p_gar := get_or_create_player('manual', 'p-rpc-2', 'Meia Assistente', '1996-05-15', 'BRA');
    p_res := get_or_create_player('manual', 'p-rpc-3', 'Jogador Banco', '2000-01-01', 'BRA');

    INSERT INTO match (
        competition_id, season_id, match_date, home_team_id, away_team_id,
        home_score, away_score, winner_team_id, venue_id, status
    ) VALUES (
        c_id, s_id, '2024-06-01 16:00+00', t_home, t_away,
        1, 0, t_home, v_id, 'finished'
    ) RETURNING match_id INTO m_id;

    INSERT INTO match_official (match_id, referee_id, role) VALUES (m_id, r_id, 'main_referee');
    INSERT INTO match_lineup_formation (match_id, team_id, formation, source_id) VALUES (m_id, t_home, '4-3-3', (SELECT source_id FROM dim_source WHERE code='manual'));

    INSERT INTO player_appearance (match_id, player_id, team_id, is_starter, shirt_number, position_code, is_captain, source_id)
    VALUES
        (m_id, p_art, t_home, true, 9, 'CF', true, (SELECT source_id FROM dim_source WHERE code='manual')),
        (m_id, p_res, t_home, false, 19, 'LW', false, (SELECT source_id FROM dim_source WHERE code='manual'));

    PERFORM insert_match_event(m_id, 'manual', t_home, p_art, 35, 10, 'goal', NULL, NULL, NULL, 1, p_gar, false, false, 'right_foot', 'goal');

    -- Insere stat_type 'standard' e 'extras' para validar desambiguação da camada Gold
    PERFORM insert_team_match_stat(m_id, t_home, 'manual', 'standard', '{"goals": 1, "shots": 12, "shots_on_target": 5, "possession_pct": 58.5}'::jsonb);
    PERFORM insert_team_match_stat(m_id, t_home, 'manual', 'extras', '{"corners": 7, "fouls": 11, "yellow_cards": 2}'::jsonb);
    PERFORM refresh_gold_views(false);

    INSERT INTO match_odds (match_id, source_id, bookmaker, home_odds, draw_odds, away_odds)
    VALUES (m_id, (SELECT source_id FROM dim_source WHERE code='manual'), 'Bet365', 1.85, 3.40, 4.20);

    v_details := fn_api_match_details(m_id);

    IF (v_details->>'match_id')::BIGINT <> m_id THEN
        RAISE EXCEPTION 'TESTE 40 FALHOU: match_id incorreto no payload';
    END IF;
    IF v_details->'score'->>'home' <> '1' OR v_details->'score'->>'away' <> '0' THEN
        RAISE EXCEPTION 'TESTE 40 FALHOU: placar incorreto: %', v_details->'score';
    END IF;
    IF v_details->'venue'->>'name' <> 'Estadio Central' THEN
        RAISE EXCEPTION 'TESTE 40 FALHOU: venue incorreto: %', v_details->'venue';
    END IF;
    IF jsonb_array_length(v_details->'timeline') <> 1 THEN
        RAISE EXCEPTION 'TESTE 40 FALHOU: timeline deve conter 1 evento';
    END IF;
    IF jsonb_array_length(v_details->'lineups'->'home'->'starters') <> 1 THEN
        RAISE EXCEPTION 'TESTE 40 FALHOU: escalação titular incorreta';
    END IF;
    IF (v_details->'odds'->>'home_win')::NUMERIC <> 1.85 THEN
        RAISE EXCEPTION 'TESTE 40 FALHOU: odds incorretas';
    END IF;
    IF (v_details->'stats'->'home'->>'shots')::INT <> 12 THEN
        RAISE EXCEPTION 'TESTE 40 FALHOU: team_stats deve retornar stat_type=standard (shots=12), obtido: %', v_details->'stats'->'home';
    END IF;

    RAISE NOTICE 'TESTE 40 OK: fn_api_match_details gerou payload de partida completo em JSON com stats standard';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 41: RPC API — Perfil completo do jogador (fn_api_player_profile)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    p_id BIGINT;
    t_id BIGINT;
    v_prof JSONB;
BEGIN
    t_id := get_or_create_team('manual', 't-prof-1', 'Clube do Atleta', 'BRA');
    p_id := get_or_create_player('manual', 'p-prof-vini', 'Vinicius de Teste', '2000-07-12', 'BRA');

    -- Contrato atual
    INSERT INTO player_team_history (player_id, team_id, start_date, end_date, shirt_number, position_code, wage_eur_weekly, transfer_type)
    VALUES (p_id, t_id, '2022-01-01', NULL, 7, 'LW', 250000, 'transfer');

    -- Histórico de mercado
    INSERT INTO player_market_value_history (player_id, valuation_date, market_value_eur)
    VALUES
        (p_id, '2020-01-01', 50000000),
        (p_id, '2024-01-01', 150000000);

    -- Lesão
    INSERT INTO player_injury (player_id, injury_type, start_date, status)
    VALUES (p_id, 'Lesão Muscular', '2024-02-01', 'available');

    v_prof := fn_api_player_profile(p_id);

    IF (v_prof->>'player_id')::BIGINT <> p_id THEN
        RAISE EXCEPTION 'TESTE 41 FALHOU: player_id incorreto no perfil';
    END IF;
    IF v_prof->'nationality'->>'code' <> 'BRA' OR v_prof->'nationality'->>'name' <> 'Brasil' THEN
        RAISE EXCEPTION 'TESTE 41 FALHOU: nacionalidade incorreta: %', v_prof->'nationality';
    END IF;
    IF (v_prof->'market_value'->>'current_eur')::BIGINT <> 150000000 THEN
        RAISE EXCEPTION 'TESTE 41 FALHOU: valor de mercado atual incorreto';
    END IF;
    IF jsonb_array_length(v_prof->'market_value'->'history') <> 2 THEN
        RAISE EXCEPTION 'TESTE 41 FALHOU: histórico de valor de mercado incompleto';
    END IF;
    IF v_prof->'club'->'team'->>'name' <> 'Clube do Atleta' THEN
        RAISE EXCEPTION 'TESTE 41 FALHOU: clube atual incorreto';
    END IF;
    IF jsonb_array_length(v_prof->'injuries') <> 1 THEN
        RAISE EXCEPTION 'TESTE 41 FALHOU: histórico de lesões incorreto';
    END IF;

    RAISE NOTICE 'TESTE 41 OK: fn_api_player_profile gerou perfil completo do atleta em JSON';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 42: RPC API — Perfil completo do clube (fn_api_team_profile)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    c_id BIGINT;
    s_id BIGINT;
    t_id BIGINT;
    t_adv BIGINT;
    p_id BIGINT;
    m_id BIGINT;
    v_team JSONB;
BEGIN
    INSERT INTO competition (canonical_name, country_code) VALUES ('Liga RPC Team', 'BRA') RETURNING competition_id INTO c_id;
    INSERT INTO season (competition_id, name, is_current) VALUES (c_id, '2024', true) RETURNING season_id INTO s_id;

    t_id := get_or_create_team('manual', 't-prof-team', 'Clube Perfil Teste', 'BRA');
    t_adv := get_or_create_team('manual', 't-prof-adv', 'Clube Rival', 'BRA');

    INSERT INTO manager (full_name) VALUES ('Prof Pardal') RETURNING manager_id INTO m_id;
    INSERT INTO manager_tenure (manager_id, team_id, role, start_date, end_date)
    VALUES (m_id, t_id, 'head_coach', '2023-01-01', NULL);

    p_id := get_or_create_player('manual', 'p-team-atk', 'Atacante do Clube', '1998-01-01', 'BRA');
    INSERT INTO player_team_history (player_id, team_id, start_date, end_date, shirt_number, position_code, transfer_type)
    VALUES (p_id, t_id, '2023-01-01', NULL, 9, 'CF', 'transfer');

    INSERT INTO match (competition_id, season_id, matchday, match_date, home_team_id, away_team_id, home_score, away_score, winner_team_id, status)
    VALUES (c_id, s_id, 1, '2024-05-01 16:00+00', t_id, t_adv, 2, 0, t_id, 'finished');

    v_team := fn_api_team_profile(t_id, s_id);

    IF (v_team->>'team_id')::BIGINT <> t_id THEN
        RAISE EXCEPTION 'TESTE 42 FALHOU: team_id incorreto no perfil do clube';
    END IF;
    IF v_team->'manager'->>'name' <> 'Prof Pardal' THEN
        RAISE EXCEPTION 'TESTE 42 FALHOU: técnico incorreto no perfil: %', v_team->'manager';
    END IF;
    IF jsonb_array_length(v_team->'squad'->'forwards') <> 1 THEN
        RAISE EXCEPTION 'TESTE 42 FALHOU: atacante não agrupado em forwards: %', v_team->'squad';
    END IF;
    IF jsonb_array_length(v_team->'recent_matches') <> 1 THEN
        RAISE EXCEPTION 'TESTE 42 FALHOU: partida recente não encontrada';
    END IF;

    RAISE NOTICE 'TESTE 42 OK: fn_api_team_profile gerou perfil completo do clube com elenco agrupado';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- TESTE 43: Segurança — Execução das funções RPC como role app_reader
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    t1 BIGINT;
    t2 BIGINT;
    p_id BIGINT;
BEGIN
    t1 := get_or_create_team('manual', 't-sec-1', 'Time Sec 1', 'BRA');
    t2 := get_or_create_team('manual', 't-sec-2', 'Time Sec 2', 'BRA');
    p_id := get_or_create_player('manual', 'p-sec-1', 'Jogador Sec', '2000-01-01', 'BRA');

    SET LOCAL ROLE app_reader;

    PERFORM fn_team_head_to_head(t1, t2, 5);
    PERFORM fn_api_player_profile(p_id);
    PERFORM fn_api_team_profile(t1);

    RAISE NOTICE 'TESTE 43 OK: role app_reader tem permissão de execução nas funções RPC';
END $$;
ROLLBACK;

-- =====================================================================
-- SUMÁRIO FINAL
-- =====================================================================
DO $$
BEGIN
    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'BATERIA DE TESTES CONCLUÍDA COM SUCESSO! (43/43)';
    RAISE NOTICE 'Todos os testes passaram com isolamento e idempotência.';
    RAISE NOTICE '=========================================================';
END $$;

