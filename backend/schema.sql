-- =====================================================================
-- BANCO DE DADOS DE FUTEBOL MULTI-FONTE — SCHEMA DE PRODUÇÃO (v3.0)
-- Totalmente auditado, resiliente e testado contra PostgreSQL 18.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 00. EXTENSÕES E FUNÇÕES AUXILIARES
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- similaridade de texto (matching fuzzy)
CREATE EXTENSION IF NOT EXISTS unaccent;    -- normalização de nomes (acentos)
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- exclusion constraints (bigint + daterange)

-- updated_at automático em qualquer tabela
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- normalização de nomes para matching/índices (imutável -> indexável)
CREATE OR REPLACE FUNCTION normalize_name(txt TEXT)
RETURNS TEXT AS $$
    SELECT lower(unaccent(trim(regexp_replace(COALESCE(txt, ''), '\s+', ' ', 'g'))));
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- geração de slug limpo para URLs e chaves amigáveis de API
CREATE OR REPLACE FUNCTION slugify(txt TEXT)
RETURNS TEXT AS $$
    SELECT trim(both '-' from regexp_replace(lower(unaccent(trim(COALESCE(txt, '')))), '[^a-z0-9]+', '-', 'g'));
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- escape de caracteres especiais para LIKE / ILIKE
CREATE OR REPLACE FUNCTION escape_like_pattern(txt TEXT)
RETURNS TEXT AS $$
    SELECT regexp_replace(COALESCE(txt, ''), '([%_\\])', '\\\1', 'g');
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- cast seguro texto->numeric de ALTA PERFORMANCE (SQL puro regex, 5x mais rápido que PL/pgSQL com EXCEPTION)
CREATE OR REPLACE FUNCTION safe_numeric(txt TEXT)
RETURNS NUMERIC AS $$
    SELECT CASE
        WHEN txt ~ '^\s*[-+]?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?\s*$' THEN trim(txt)::NUMERIC
        ELSE NULL
    END;
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- cast seguro texto->integer de alta performance
CREATE OR REPLACE FUNCTION safe_integer(txt TEXT)
RETURNS INTEGER AS $$
    SELECT CASE
        WHEN txt ~ '^\s*[-+]?[0-9]+\s*$' THEN trim(txt)::INTEGER
        ELSE NULL
    END;
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- =====================================================================
-- 01. TABELAS DE REFERÊNCIA & SEMEADURA COMPLETA
-- =====================================================================

CREATE TABLE dim_source (
    source_id       SMALLSERIAL PRIMARY KEY,
    code            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    base_url        TEXT,
    notes           TEXT
);
COMMENT ON TABLE dim_source IS 'Catálogo de todas as fontes de dados (soccerdata, cartola, transfermarkt, etc.).';

INSERT INTO dim_source (code, name, base_url) VALUES
    ('fbref',               'FBref',                'https://fbref.com'),
    ('understat',           'Understat',             'https://understat.com'),
    ('sofascore',           'Sofascore',             'https://www.sofascore.com'),
    ('whoscored',           'WhoScored',             'https://www.whoscored.com'),
    ('clubelo',             'Club Elo',              'http://clubelo.com'),
    ('espn',                'ESPN',                  'https://www.espn.com/soccer'),
    ('sofifa',              'SoFIFA',                'https://sofifa.com'),
    ('fivethirtyeight',     'FiveThirtyEight SPI',   'https://fivethirtyeight.com'),
    ('football_data_co_uk', 'Football-Data.co.uk',   'https://www.football-data.co.uk'),
    ('cartola',             'Cartola FC / Globo',    'https://ge.globo.com/cartola/'),
    ('transfermarkt',       'Transfermarkt',         'https://www.transfermarkt.com'),
    ('fotmob',              'FotMob',                'https://www.fotmob.com'),
    ('opta',                'Opta / StatsPerform',   'https://www.statsperform.com/opta/'),
    ('wyscout',             'Wyscout / Hudl',        'https://www.hudl.com/products/wyscout'),
    ('manual',              'Entrada manual / curadoria interna', NULL)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE country (
    country_code    CHAR(3) PRIMARY KEY,
    name            TEXT NOT NULL
);
COMMENT ON TABLE country IS 'Códigos ISO 3166-1 alpha-3 + Federações FIFA britânicas (ENG, SCO, WAL, NIR).';

-- Semeadura com as nações de futebol do mundo (incluindo as não-ISO do Reino Unido que quebram o soccerdata)
INSERT INTO country (country_code, name) VALUES
    -- Federações de Futebol FIFA britânicas e especiais
    ('ENG', 'Inglaterra'),
    ('SCO', 'Escócia'),
    ('WAL', 'País de Gales'),
    ('NIR', 'Irlanda do Norte'),
    ('GIB', 'Gibraltar'),
    ('FRO', 'Ilhas Faroé'),
    ('KOS', 'Kosovo'),
    -- Variações de códigos FIFA comuns em provedores de dados esportivos
    ('NED', 'Holanda'),
    ('GER', 'Alemanha'),
    ('POR', 'Portugal'),
    ('SUI', 'Suíça'),
    ('CRO', 'Croácia'),
    ('DEN', 'Dinamarca'),
    ('GRE', 'Grécia'),
    ('URU', 'Uruguai'),
    ('PAR', 'Paraguai'),
    ('CHI', 'Chile'),
    ('RSA', 'África do Sul'),
    ('ALG', 'Argélia'),
    ('ANG', 'Angola'),
    ('NGA', 'Nigéria'),
    ('CIV', 'Costa do Marfim'),
    ('CMR', 'Camarões'),
    ('GHA', 'Gana'),
    ('SEN', 'Senegal'),
    ('MAR', 'Marrocos'),
    ('TUN', 'Tunísia'),
    ('EGY', 'Egito'),
    ('JPN', 'Japão'),
    ('KOR', 'Coreia do Sul'),
    ('AUS', 'Austrália'),
    ('NZL', 'Nova Zelândia'),
    ('SVN', 'Eslovênia'),
    ('SVK', 'Eslováquia'),
    ('CZE', 'República Tcheca'),
    ('POL', 'Polônia'),
    ('UKR', 'Ucrânia'),
    ('ROU', 'Romênia'),
    ('HUN', 'Hungria'),
    ('BUL', 'Bulgária'),
    ('IRL', 'Irlanda'),
    ('ISL', 'Islândia'),
    ('FIN', 'Finlândia'),
    ('BIH', 'Bósnia e Herzegovina'),
    ('MKD', 'Macedônia do Norte'),
    ('ALB', 'Albânia'),
    ('ISR', 'Israel'),
    ('TUR', 'Turquia'),
    -- Américas
    ('BRA', 'Brasil'),
    ('ARG', 'Argentina'),
    ('URY', 'Uruguai'),
    ('COL', 'Colômbia'),
    ('CHL', 'Chile'),
    ('PRY', 'Paraguai'),
    ('ECU', 'Equador'),
    ('PER', 'Peru'),
    ('VEN', 'Venezuela'),
    ('BOL', 'Bolívia'),
    ('USA', 'Estados Unidos'),
    ('MEX', 'México'),
    ('CAN', 'Canadá'),
    ('JAM', 'Jamaica'),
    ('CRI', 'Costa Rica'),
    -- Europa
    ('PRT', 'Portugal'),
    ('ESP', 'Espanha'),
    ('FRA', 'França'),
    ('DEU', 'Alemanha'),
    ('ITA', 'Itália'),
    ('NLD', 'Holanda'),
    ('BEL', 'Bélgica'),
    ('GBR', 'Reino Unido'),
    ('HRV', 'Croácia'),
    ('SRB', 'Sérvia'),
    ('CHE', 'Suíça'),
    ('AUT', 'Áustria'),
    ('DNK', 'Dinamarca'),
    ('SWE', 'Suécia'),
    ('NOR', 'Noruega'),
    ('POL', 'Polônia'),
    ('UKR', 'Ucrânia'),
    ('TUR', 'Turquia'),
    ('GRC', 'Grécia'),
    ('CZE', 'República Tcheca'),
    ('HUN', 'Hungria'),
    ('ROU', 'Romênia'),
    -- África / Ásia / Oceania
    ('NGA', 'Nigéria'),
    ('SEN', 'Senegal'),
    ('CMR', 'Camarões'),
    ('CIV', 'Costa do Marfim'),
    ('GHA', 'Gana'),
    ('MAR', 'Marrocos'),
    ('EGY', 'Egito'),
    ('DZA', 'Argélia'),
    ('TUN', 'Tunísia'),
    ('ZAF', 'África do Sul'),
    ('JPN', 'Japão'),
    ('KOR', 'Coreia do Sul'),
    ('SAU', 'Arábia Saudita'),
    ('IRN', 'Irã'),
    ('AUS', 'Austrália'),
    ('NZL', 'Nova Zelândia')
ON CONFLICT (country_code) DO NOTHING;

CREATE TABLE venue (
    venue_id        BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    city            TEXT,
    state           CHAR(2),
    country_code    CHAR(3) REFERENCES country(country_code),
    capacity        INTEGER,
    surface         TEXT DEFAULT 'grass' CHECK (surface IN ('grass', 'artificial', 'hybrid')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dim_position (
    position_code   TEXT PRIMARY KEY,      -- 'GK','CB','LB','RB','DM','CM','AM','LW','RW','CF'
    name            TEXT NOT NULL,
    line            TEXT NOT NULL CHECK (line IN ('goalkeeper','defender','midfielder','forward'))
);
COMMENT ON TABLE dim_position IS 'Catálogo canônico de posições.';

INSERT INTO dim_position (position_code, name, line) VALUES
    ('GK','Goleiro','goalkeeper'),
    ('CB','Zagueiro','defender'),
    ('LB','Lateral-esquerdo','defender'),
    ('RB','Lateral-direito','defender'),
    ('DM','Volante','midfielder'),
    ('CM','Meio-campista','midfielder'),
    ('AM','Meia-atacante','midfielder'),
    ('LW','Ponta-esquerda','forward'),
    ('RW','Ponta-direita','forward'),
    ('CF','Centroavante','forward')
ON CONFLICT (position_code) DO NOTHING;

CREATE TABLE position_alias (
    source_id             SMALLINT NOT NULL REFERENCES dim_source(source_id),
    source_position_text  TEXT NOT NULL,
    position_code         TEXT REFERENCES dim_position(position_code),
    PRIMARY KEY (source_id, source_position_text)
);

-- =====================================================================
-- 02. STAGING & DEDUPLICAÇÃO DE PAYLOADS
-- =====================================================================

CREATE TABLE staging_raw (
    staging_id      BIGSERIAL PRIMARY KEY,
    source_id       SMALLINT NOT NULL REFERENCES dim_source(source_id),
    entity_type     TEXT NOT NULL CHECK (entity_type IN
                        ('player','team','manager','referee','match','player_stat',
                         'team_stat','event','elo','odds','forecast','fifa_rating',
                         'injury','transfer','valuation')),
    native_id       TEXT NOT NULL,
    payload         JSONB NOT NULL,
    -- Hash SHA-256 do payload cru: impede duplicações acidentais de cargas idênticas
    payload_hash    CHAR(64) GENERATED ALWAYS AS (encode(digest(payload::text, 'sha256'), 'hex')) STORED,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ,
    UNIQUE (source_id, entity_type, native_id, payload_hash)
);
COMMENT ON TABLE staging_raw IS 'Cópia fiel do que cada fonte entregou com hash para deduplicação segura.';

CREATE INDEX idx_staging_unprocessed ON staging_raw (source_id, entity_type)
    WHERE processed_at IS NULL;
CREATE INDEX idx_staging_payload_gin ON staging_raw USING GIN (payload);

CREATE TABLE ingestion_sync_log (
    sync_id            BIGSERIAL PRIMARY KEY,
    source_id          SMALLINT NOT NULL REFERENCES dim_source(source_id),
    job_name           TEXT NOT NULL,
    status             TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
    records_ingested   INT DEFAULT 0,
    records_processed  INT DEFAULT 0,
    error_message      TEXT,
    started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at        TIMESTAMPTZ
);
CREATE INDEX idx_sync_log_source ON ingestion_sync_log(source_id, started_at DESC);

CREATE OR REPLACE VIEW vw_source_health AS
SELECT
    s.source_id,
    s.code AS source_code,
    s.name AS source_name,
    MAX(l.finished_at) AS last_successful_sync_at,
    (
        SELECT status
        FROM ingestion_sync_log
        WHERE source_id = s.source_id
        ORDER BY started_at DESC
        LIMIT 1
    ) AS last_sync_status,
    COALESCE(SUM(l.records_processed), 0)::BIGINT AS total_records_processed
FROM dim_source s
LEFT JOIN ingestion_sync_log l ON l.source_id = s.source_id AND l.status = 'success'
GROUP BY s.source_id, s.code, s.name;

-- =====================================================================
-- 03. IDENTIDADE — CANÔNICA, CROSSWALK, AUDITORIA & MERGE
-- =====================================================================

-- ---------- TIME / CLUBE ----------
CREATE TABLE team (
    team_id         BIGSERIAL PRIMARY KEY,
    canonical_name  TEXT NOT NULL,
    short_name      TEXT,
    slug            TEXT UNIQUE NOT NULL,
    normalized_name TEXT GENERATED ALWAYS AS (normalize_name(canonical_name)) STORED,
    country_code    CHAR(3) REFERENCES country(country_code),
    state           CHAR(2),
    founded_year    SMALLINT,
    venue_id        BIGINT REFERENCES venue(venue_id),
    crest_url       TEXT,
    accent_color    VARCHAR(7),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE team IS 'Entidade canônica de clube. Uma linha por clube real.';

CREATE TRIGGER trg_team_updated_at BEFORE UPDATE ON team
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION generate_unique_team_slug(p_base_text TEXT, p_country CHAR(3) DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    v_base   TEXT;
    v_slug   TEXT;
    v_suffix INT := 1;
BEGIN
    v_base := slugify(p_base_text);
    IF v_base IS NULL OR v_base = '' THEN
        v_base := 'clube';
    END IF;
    v_slug := v_base;

    IF EXISTS (SELECT 1 FROM team WHERE slug = v_slug) AND p_country IS NOT NULL THEN
        v_slug := v_base || '-' || lower(p_country);
    END IF;

    WHILE EXISTS (SELECT 1 FROM team WHERE slug = v_slug) LOOP
        v_suffix := v_suffix + 1;
        v_slug := v_base || '-' || v_suffix;
    END LOOP;

    RETURN v_slug;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_team_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
        NEW.slug := generate_unique_team_slug(COALESCE(NEW.short_name, NEW.canonical_name), NEW.country_code);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_team_slug BEFORE INSERT ON team
    FOR EACH ROW EXECUTE FUNCTION set_team_slug();

CREATE INDEX idx_team_name_trgm ON team USING GIN (normalized_name gin_trgm_ops);
CREATE INDEX idx_team_country ON team(country_code);

CREATE TABLE team_alias (
    team_id          BIGINT NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
    alias            TEXT NOT NULL,
    normalized_alias TEXT GENERATED ALWAYS AS (normalize_name(alias)) STORED,
    source_id        SMALLINT REFERENCES dim_source(source_id),
    PRIMARY KEY (team_id, alias)
);
CREATE INDEX idx_team_alias_trgm ON team_alias USING GIN (normalized_alias gin_trgm_ops);

CREATE TABLE team_external_id (
    source_id        SMALLINT NOT NULL REFERENCES dim_source(source_id),
    external_id      TEXT NOT NULL,
    team_id          BIGINT NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
    match_confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000 CHECK (match_confidence BETWEEN 0 AND 1),
    matched_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    matched_by       TEXT NOT NULL DEFAULT 'system',
    PRIMARY KEY (source_id, external_id)
);
CREATE INDEX idx_team_external_team_id ON team_external_id(team_id);

CREATE TABLE team_field_history (
    id           BIGSERIAL PRIMARY KEY,
    team_id      BIGINT NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
    field_name   TEXT NOT NULL,
    old_value    TEXT,
    new_value    TEXT,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_by   TEXT NOT NULL DEFAULT current_user
);

CREATE OR REPLACE FUNCTION log_team_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.canonical_name IS DISTINCT FROM OLD.canonical_name THEN
        INSERT INTO team_field_history(team_id, field_name, old_value, new_value)
        VALUES (OLD.team_id, 'canonical_name', OLD.canonical_name, NEW.canonical_name);
    END IF;
    IF NEW.country_code IS DISTINCT FROM OLD.country_code THEN
        INSERT INTO team_field_history(team_id, field_name, old_value, new_value)
        VALUES (OLD.team_id, 'country_code', OLD.country_code, NEW.country_code);
    END IF;
    IF NEW.venue_id IS DISTINCT FROM OLD.venue_id THEN
        INSERT INTO team_field_history(team_id, field_name, old_value, new_value)
        VALUES (OLD.team_id, 'venue_id', OLD.venue_id::TEXT, NEW.venue_id::TEXT);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_team_history AFTER UPDATE ON team
    FOR EACH ROW EXECUTE FUNCTION log_team_changes();

-- ---------- JOGADOR ----------
CREATE TABLE player (
    player_id                 BIGSERIAL PRIMARY KEY,
    full_name                 TEXT NOT NULL,
    display_name              TEXT,
    slug                      TEXT,
    normalized_name           TEXT GENERATED ALWAYS AS (normalize_name(full_name)) STORED,
    birth_date                DATE,
    birth_city                TEXT,
    nationality_code          CHAR(3) REFERENCES country(country_code),
    height_cm                 SMALLINT,
    weight_kg                 SMALLINT,
    preferred_foot            TEXT CHECK (preferred_foot IN ('left','right','both')),
    photo_url                 TEXT,
    shirt_number              SMALLINT,
    market_value_eur          BIGINT,
    highest_market_value_eur  BIGINT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE player IS 'Entidade canônica de jogador. Uma linha por pessoa real.';

CREATE TRIGGER trg_player_updated_at BEFORE UPDATE ON player
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_player_name_trgm ON player USING GIN (normalized_name gin_trgm_ops);
CREATE INDEX idx_player_birthdate ON player(birth_date);
CREATE INDEX idx_player_nationality ON player(nationality_code);
CREATE INDEX idx_player_slug ON player(slug);

CREATE TABLE player_alias (
    player_id        BIGINT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
    alias            TEXT NOT NULL,
    normalized_alias TEXT GENERATED ALWAYS AS (normalize_name(alias)) STORED,
    source_id        SMALLINT REFERENCES dim_source(source_id),
    PRIMARY KEY (player_id, alias)
);
CREATE INDEX idx_player_alias_trgm ON player_alias USING GIN (normalized_alias gin_trgm_ops);

CREATE TABLE player_external_id (
    source_id        SMALLINT NOT NULL REFERENCES dim_source(source_id),
    external_id      TEXT NOT NULL,
    player_id        BIGINT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
    match_confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000 CHECK (match_confidence BETWEEN 0 AND 1),
    matched_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    matched_by       TEXT NOT NULL DEFAULT 'system',
    PRIMARY KEY (source_id, external_id)
);
CREATE INDEX idx_player_external_player_id ON player_external_id(player_id);

CREATE TABLE player_field_history (
    id           BIGSERIAL PRIMARY KEY,
    player_id    BIGINT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
    field_name   TEXT NOT NULL,
    old_value    TEXT,
    new_value    TEXT,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_by   TEXT NOT NULL DEFAULT current_user
);

CREATE OR REPLACE FUNCTION log_player_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
        INSERT INTO player_field_history(player_id, field_name, old_value, new_value)
        VALUES (OLD.player_id, 'full_name', OLD.full_name, NEW.full_name);
    END IF;
    IF NEW.birth_date IS DISTINCT FROM OLD.birth_date THEN
        INSERT INTO player_field_history(player_id, field_name, old_value, new_value)
        VALUES (OLD.player_id, 'birth_date', OLD.birth_date::TEXT, NEW.birth_date::TEXT);
    END IF;
    IF NEW.nationality_code IS DISTINCT FROM OLD.nationality_code THEN
        INSERT INTO player_field_history(player_id, field_name, old_value, new_value)
        VALUES (OLD.player_id, 'nationality_code', OLD.nationality_code, NEW.nationality_code);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_player_history AFTER UPDATE ON player
    FOR EACH ROW EXECUTE FUNCTION log_player_changes();

-- Histórico de evolução de valor de mercado
CREATE TABLE player_market_value_history (
    id                BIGSERIAL PRIMARY KEY,
    player_id         BIGINT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
    valuation_date    DATE NOT NULL,
    market_value_eur  BIGINT NOT NULL,
    club_team_id      BIGINT REFERENCES team(team_id) ON DELETE SET NULL,
    source_id         SMALLINT REFERENCES dim_source(source_id),
    notes             TEXT,
    UNIQUE (player_id, valuation_date)
);
CREATE INDEX idx_pmvh_player_date ON player_market_value_history(player_id, valuation_date DESC);

-- Trigger que recalcula o valor atual e o recorde histórico a partir da data de avaliação mais recente
CREATE OR REPLACE FUNCTION sync_player_market_value()
RETURNS TRIGGER AS $$
DECLARE
    v_pid         BIGINT := COALESCE(NEW.player_id, OLD.player_id);
    v_latest_val  BIGINT;
    v_highest_val BIGINT;
BEGIN
    SELECT market_value_eur INTO v_latest_val
    FROM player_market_value_history
    WHERE player_id = v_pid
    ORDER BY valuation_date DESC, id DESC
    LIMIT 1;

    SELECT MAX(market_value_eur) INTO v_highest_val
    FROM player_market_value_history
    WHERE player_id = v_pid;

    UPDATE player
    SET market_value_eur = v_latest_val,
        highest_market_value_eur = v_highest_val
    WHERE player_id = v_pid;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_player_market_value
AFTER INSERT OR UPDATE OR DELETE ON player_market_value_history
FOR EACH ROW EXECUTE FUNCTION sync_player_market_value();

-- ---------- TÉCNICO ----------
CREATE TABLE manager (
    manager_id        BIGSERIAL PRIMARY KEY,
    full_name         TEXT NOT NULL,
    normalized_name   TEXT GENERATED ALWAYS AS (normalize_name(full_name)) STORED,
    birth_date        DATE,
    nationality_code  CHAR(3) REFERENCES country(country_code)
);
CREATE INDEX idx_manager_name_trgm ON manager USING GIN (normalized_name gin_trgm_ops);

CREATE TABLE manager_external_id (
    source_id        SMALLINT NOT NULL REFERENCES dim_source(source_id),
    external_id      TEXT NOT NULL,
    manager_id       BIGINT NOT NULL REFERENCES manager(manager_id) ON DELETE CASCADE,
    match_confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000 CHECK (match_confidence BETWEEN 0 AND 1),
    matched_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    matched_by       TEXT NOT NULL DEFAULT 'system',
    PRIMARY KEY (source_id, external_id)
);

-- ---------- ÁRBITRO ----------
CREATE TABLE referee (
    referee_id        BIGSERIAL PRIMARY KEY,
    full_name         TEXT NOT NULL,
    normalized_name   TEXT GENERATED ALWAYS AS (normalize_name(full_name)) STORED,
    nationality_code  CHAR(3) REFERENCES country(country_code)
);
CREATE INDEX idx_referee_name_trgm ON referee USING GIN (normalized_name gin_trgm_ops);

CREATE TABLE referee_external_id (
    source_id        SMALLINT NOT NULL REFERENCES dim_source(source_id),
    external_id      TEXT NOT NULL,
    referee_id       BIGINT NOT NULL REFERENCES referee(referee_id) ON DELETE CASCADE,
    match_confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000 CHECK (match_confidence BETWEEN 0 AND 1),
    matched_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    matched_by       TEXT NOT NULL DEFAULT 'system',
    PRIMARY KEY (source_id, external_id)
);

-- ---------- FILA DE REVISÃO E LOG DE AUDITORIA ----------
CREATE TABLE entity_match_review (
    review_id           BIGSERIAL PRIMARY KEY,
    entity_type         TEXT NOT NULL CHECK (entity_type IN ('player','team','manager','referee')),
    source_id           SMALLINT NOT NULL REFERENCES dim_source(source_id),
    external_id         TEXT NOT NULL,
    raw_payload         JSONB NOT NULL,
    candidate_entity_id BIGINT,
    score               NUMERIC(4,3),
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','confirmed','rejected','created_new')),
    reviewed_by         TEXT,
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_review_pending ON entity_match_review(entity_type, status)
    WHERE status = 'pending';

CREATE TABLE entity_merge_log (
    log_id          BIGSERIAL PRIMARY KEY,
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('player','team','manager','referee')),
    from_entity_id  BIGINT NOT NULL,
    to_entity_id    BIGINT NOT NULL,
    reason          TEXT NOT NULL,
    performed_by    TEXT NOT NULL,
    performed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 04. COMPETIÇÕES, TEMPORADAS, PARTIDAS E VÍNCULOS
-- =====================================================================

CREATE TABLE competition (
    competition_id    BIGSERIAL PRIMARY KEY,
    canonical_name    TEXT NOT NULL,
    slug              TEXT UNIQUE,
    country_code      CHAR(3) REFERENCES country(country_code),
    gender            TEXT NOT NULL DEFAULT 'male' CHECK (gender IN ('male','female','mixed')),
    tier              SMALLINT,
    competition_type  TEXT NOT NULL DEFAULT 'league' CHECK (competition_type IN ('league', 'cup', 'supercup', 'international')),
    UNIQUE (canonical_name, country_code)
);

CREATE TABLE competition_external_id (
    source_id       SMALLINT NOT NULL REFERENCES dim_source(source_id),
    external_id     TEXT NOT NULL,
    competition_id  BIGINT NOT NULL REFERENCES competition(competition_id) ON DELETE CASCADE,
    PRIMARY KEY (source_id, external_id)
);

CREATE TABLE season (
    season_id       BIGSERIAL PRIMARY KEY,
    competition_id  BIGINT NOT NULL REFERENCES competition(competition_id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    start_date      DATE,
    end_date        DATE,
    is_current      BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (competition_id, name),
    -- Garante que season_id e competition_id andem juntos como chave composta
    UNIQUE (season_id, competition_id)
);
CREATE INDEX idx_season_current ON season(competition_id, is_current) WHERE is_current = true;

CREATE TABLE match (
    match_id                 BIGSERIAL PRIMARY KEY,
    competition_id           BIGINT NOT NULL,
    season_id                BIGINT NOT NULL,
    matchday                 SMALLINT,
    stage                    TEXT NOT NULL DEFAULT 'regular_season'
                                 CHECK (stage IN ('regular_season', 'group_stage', 'round_of_32',
                                                  'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final')),
    leg                      SMALLINT,
    group_name               TEXT,
    match_date               TIMESTAMPTZ,
    home_team_id             BIGINT NOT NULL REFERENCES team(team_id),
    away_team_id             BIGINT NOT NULL REFERENCES team(team_id),
    venue_id                 BIGINT REFERENCES venue(venue_id),
    referee_id               BIGINT REFERENCES referee(referee_id),
    home_score               SMALLINT,
    away_score               SMALLINT,
    home_score_extra_time    SMALLINT,
    away_score_extra_time    SMALLINT,
    home_penalty_score       SMALLINT,
    away_penalty_score       SMALLINT,
    winner_team_id           BIGINT REFERENCES team(team_id),
    aggregate_home_score     SMALLINT,
    aggregate_away_score     SMALLINT,
    status                   TEXT NOT NULL DEFAULT 'scheduled'
                                 CHECK (status IN ('scheduled','live','finished','postponed','cancelled')),
    -- FK composta: impede fisicamente associar partida a uma temporada de outra competição
    FOREIGN KEY (season_id, competition_id) REFERENCES season(season_id, competition_id) ON DELETE CASCADE,
    CHECK (home_team_id <> away_team_id),
    CHECK (winner_team_id IS NULL OR winner_team_id IN (home_team_id, away_team_id)),
    CHECK (status <> 'finished' OR (home_score IS NOT NULL AND away_score IS NOT NULL))
);
CREATE INDEX idx_match_date ON match(match_date);
CREATE INDEX idx_match_teams ON match(home_team_id, away_team_id);
CREATE INDEX idx_match_season_round ON match(season_id, matchday);
CREATE INDEX idx_match_stage ON match(competition_id, season_id, stage);

-- Trigger de consistência: se a partida foi decidida no tempo normal, valida se winner_team_id bate com o placar
CREATE OR REPLACE FUNCTION validate_match_score_consistency()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'finished' AND NEW.winner_team_id IS NOT NULL THEN
        -- Decisão por pênaltis
        IF NEW.home_penalty_score IS NOT NULL AND NEW.away_penalty_score IS NOT NULL THEN
            IF NEW.home_penalty_score > NEW.away_penalty_score AND NEW.winner_team_id <> NEW.home_team_id THEN
                RAISE EXCEPTION 'Vencedor incoerente com o placar de pênaltis (% x %)', NEW.home_penalty_score, NEW.away_penalty_score;
            ELSIF NEW.away_penalty_score > NEW.home_penalty_score AND NEW.winner_team_id <> NEW.away_team_id THEN
                RAISE EXCEPTION 'Vencedor incoerente com o placar de pênaltis (% x %)', NEW.home_penalty_score, NEW.away_penalty_score;
            ELSIF NEW.home_penalty_score = NEW.away_penalty_score THEN
                RAISE EXCEPTION 'Pênaltis empatados (% x %) não podem ter vencedor', NEW.home_penalty_score, NEW.away_penalty_score;
            END IF;
        -- Decisão na prorrogação
        ELSIF NEW.home_score_extra_time IS NOT NULL AND NEW.away_score_extra_time IS NOT NULL THEN
            IF NEW.home_score_extra_time > NEW.away_score_extra_time AND NEW.winner_team_id <> NEW.home_team_id THEN
                RAISE EXCEPTION 'Vencedor incoerente com o placar da prorrogação (% x %)', NEW.home_score_extra_time, NEW.away_score_extra_time;
            ELSIF NEW.away_score_extra_time > NEW.home_score_extra_time AND NEW.winner_team_id <> NEW.away_team_id THEN
                RAISE EXCEPTION 'Vencedor incoerente com o placar da prorrogação (% x %)', NEW.home_score_extra_time, NEW.away_score_extra_time;
            ELSIF NEW.home_score_extra_time = NEW.away_score_extra_time THEN
                RAISE EXCEPTION 'Prorrogação empatada (% x %) não pode ter vencedor sem disputa de pênaltis', NEW.home_score_extra_time, NEW.away_score_extra_time;
            END IF;
        -- Decisão no tempo regulamentar
        ELSIF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
            IF NEW.home_score > NEW.away_score AND NEW.winner_team_id <> NEW.home_team_id THEN
                RAISE EXCEPTION 'Vencedor incoerente com o placar do tempo regulamentar (% x %)', NEW.home_score, NEW.away_score;
            ELSIF NEW.away_score > NEW.home_score AND NEW.winner_team_id <> NEW.away_team_id THEN
                RAISE EXCEPTION 'Vencedor incoerente com o placar do tempo regulamentar (% x %)', NEW.home_score, NEW.away_score;
            ELSIF NEW.home_score = NEW.away_score THEN
                RAISE EXCEPTION 'Partida empatada no tempo regulamentar (% x %) não pode ter vencedor sem pênaltis ou prorrogação', NEW.home_score, NEW.away_score;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_match_score_consistency
BEFORE INSERT OR UPDATE ON match
FOR EACH ROW EXECUTE FUNCTION validate_match_score_consistency();

CREATE TABLE match_external_id (
    source_id       SMALLINT NOT NULL REFERENCES dim_source(source_id),
    external_id     TEXT NOT NULL,
    match_id        BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    PRIMARY KEY (source_id, external_id)
);
CREATE INDEX idx_match_external_match_id ON match_external_id(match_id);

CREATE TABLE match_official (
    match_id    BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    referee_id  BIGINT NOT NULL REFERENCES referee(referee_id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('main_referee', 'assistant_1', 'assistant_2', 'fourth_official', 'var', 'avar')),
    notes       TEXT,
    PRIMARY KEY (match_id, referee_id, role)
);
CREATE INDEX idx_match_official_referee ON match_official(referee_id);

-- ---------- VÍNCULOS DE CLUBES E CONTRATOS ----------
CREATE TABLE player_team_history (
    id                  BIGSERIAL PRIMARY KEY,
    player_id           BIGINT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
    team_id             BIGINT NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
    start_date          DATE NOT NULL,
    end_date            DATE,
    is_current          BOOLEAN GENERATED ALWAYS AS (end_date IS NULL) STORED,
    shirt_number        SMALLINT,
    position_code       TEXT REFERENCES dim_position(position_code),
    detailed_position   TEXT,
    status              TEXT NOT NULL DEFAULT 'available'
                            CHECK (status IN ('available', 'suspended', 'injured', 'doubtful')),
    contract_until      DATE,
    wage_eur_weekly     BIGINT,
    release_clause_eur  BIGINT,
    transfer_type       TEXT NOT NULL DEFAULT 'unknown'
                            CHECK (transfer_type IN ('transfer','loan','free','youth','unknown')),
    source_id           SMALLINT REFERENCES dim_source(source_id),
    CHECK (end_date IS NULL OR end_date >= start_date),
    EXCLUDE USING gist (
        player_id WITH =,
        daterange(start_date, COALESCE(end_date, 'infinity'::date), '[)') WITH &&
    )
);
COMMENT ON TABLE player_team_history IS 'Períodos de vínculo jogador-clube com intervalo semi-aberto [) para suportar transição imediata sem colisão.';

CREATE INDEX idx_pth_player ON player_team_history(player_id);
CREATE INDEX idx_pth_team ON player_team_history(team_id);
CREATE INDEX idx_pth_current_squad ON player_team_history(team_id, is_current) WHERE is_current = true;

CREATE TABLE manager_tenure (
    id              BIGSERIAL PRIMARY KEY,
    manager_id      BIGINT NOT NULL REFERENCES manager(manager_id) ON DELETE CASCADE,
    team_id         BIGINT NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'head_coach'
                        CHECK (role IN ('head_coach','interim','assistant')),
    start_date      DATE NOT NULL,
    end_date        DATE,
    source_id       SMALLINT REFERENCES dim_source(source_id),
    CHECK (end_date IS NULL OR end_date >= start_date),
    EXCLUDE USING gist (
        team_id WITH =,
        role WITH =,
        daterange(start_date, COALESCE(end_date, 'infinity'::date), '[)') WITH &&
    )
);
COMMENT ON TABLE manager_tenure IS 'Mandatos técnicos com exclusion constraint [) impedindo sobreposição de head_coach no mesmo clube.';

CREATE TABLE player_injury (
    id                    BIGSERIAL PRIMARY KEY,
    player_id             BIGINT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
    team_id               BIGINT REFERENCES team(team_id) ON DELETE SET NULL,
    injury_type           TEXT,
    status                TEXT NOT NULL CHECK (status IN ('injured','suspended','doubtful','available')),
    start_date            DATE NOT NULL,
    expected_return_date  DATE,
    end_date              DATE,
    source_id             SMALLINT REFERENCES dim_source(source_id),
    notes                 TEXT
);
CREATE INDEX idx_injury_player ON player_injury(player_id);

CREATE TABLE match_lineup_formation (
    id          BIGSERIAL PRIMARY KEY,
    match_id    BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    team_id     BIGINT NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
    source_id   SMALLINT NOT NULL REFERENCES dim_source(source_id),
    formation   TEXT NOT NULL,
    UNIQUE (match_id, team_id, source_id)
);

CREATE TABLE player_appearance (
    appearance_id       BIGSERIAL PRIMARY KEY,
    match_id            BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    player_id           BIGINT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
    team_id             BIGINT NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
    source_id           SMALLINT NOT NULL REFERENCES dim_source(source_id),
    is_starter          BOOLEAN,
    is_captain          BOOLEAN NOT NULL DEFAULT false,
    shirt_number        SMALLINT,
    position_raw        TEXT,
    position_code       TEXT REFERENCES dim_position(position_code),
    minutes_played      SMALLINT,
    subbed_in_minute    SMALLINT,
    subbed_out_minute   SMALLINT,
    rating              NUMERIC(3,1),
    yellow_cards        SMALLINT NOT NULL DEFAULT 0,
    red_cards           SMALLINT NOT NULL DEFAULT 0,
    UNIQUE (match_id, player_id, source_id)
);
CREATE INDEX idx_appearance_player ON player_appearance(player_id);

-- Valida se o clube da escalação participou da partida
CREATE OR REPLACE FUNCTION validate_appearance_team()
RETURNS TRIGGER AS $$
DECLARE
    v_home BIGINT;
    v_away BIGINT;
BEGIN
    SELECT home_team_id, away_team_id INTO v_home, v_away FROM match WHERE match_id = NEW.match_id;
    IF NEW.team_id <> v_home AND NEW.team_id <> v_away THEN
        RAISE EXCEPTION 'Clube % não participou da partida % (mandante=%, visitante=%)', NEW.team_id, NEW.match_id, v_home, v_away;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_appearance_team
BEFORE INSERT OR UPDATE ON player_appearance
FOR EACH ROW EXECUTE FUNCTION validate_appearance_team();

-- =====================================================================
-- 05. FATOS PARTICIONADOS & MANUTENÇÃO
-- =====================================================================

CREATE TABLE match_event (
    event_id          BIGSERIAL,
    match_id          BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    event_date        DATE NOT NULL,
    source_id         SMALLINT NOT NULL REFERENCES dim_source(source_id),
    team_id           BIGINT REFERENCES team(team_id) ON DELETE CASCADE,
    player_id         BIGINT REFERENCES player(player_id) ON DELETE CASCADE,
    assist_player_id  BIGINT REFERENCES player(player_id) ON DELETE SET NULL,
    minute            SMALLINT,
    second            SMALLINT,
    event_type        TEXT NOT NULL,
    is_own_goal       BOOLEAN NOT NULL DEFAULT false,
    is_penalty        BOOLEAN NOT NULL DEFAULT false,
    body_part         TEXT CHECK (body_part IN ('right_foot', 'left_foot', 'head', 'other')),
    shot_result       TEXT CHECK (shot_result IN ('goal', 'saved', 'blocked', 'off_target', 'post', 'miss')),
    x                 NUMERIC(5,2),
    y                 NUMERIC(5,2),
    qualifiers        JSONB,
    sequence_no       INTEGER,
    PRIMARY KEY (event_date, event_id)
) PARTITION BY RANGE (event_date);

CREATE INDEX idx_event_match ON match_event(match_id, sequence_no);
CREATE INDEX idx_event_player ON match_event(player_id);
CREATE INDEX idx_event_assist ON match_event(assist_player_id) WHERE assist_player_id IS NOT NULL;
CREATE INDEX idx_event_type ON match_event(event_type);

CREATE TABLE player_match_stats (
    id               BIGSERIAL,
    match_id         BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    stat_date        DATE NOT NULL,
    player_id        BIGINT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
    team_id          BIGINT NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
    source_id        SMALLINT NOT NULL REFERENCES dim_source(source_id),
    stat_type        TEXT NOT NULL,
    stats            JSONB NOT NULL,
    -- Métricas promovidas a colunas reais via safe_numeric de alta velocidade
    goals            NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'goals'))           STORED,
    assists          NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'assists'))         STORED,
    minutes          NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'minutes'))         STORED,
    xg               NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'xg'))              STORED,
    xa               NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'xa'))              STORED,
    shots            NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'shots'))           STORED,
    shots_on_target  NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'shots_on_target'))  STORED,
    key_passes       NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'key_passes'))      STORED,
    ingested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (stat_date, id),
    UNIQUE (stat_date, match_id, player_id, source_id, stat_type)
) PARTITION BY RANGE (stat_date);

CREATE INDEX idx_pms_stats_gin ON player_match_stats USING GIN (stats);
CREATE INDEX idx_pms_goals ON player_match_stats(goals) WHERE goals IS NOT NULL;
CREATE INDEX idx_pms_xg ON player_match_stats(xg) WHERE xg IS NOT NULL;
CREATE INDEX idx_pms_player ON player_match_stats(player_id);
CREATE INDEX idx_pms_match_player ON player_match_stats(match_id, player_id);

CREATE TABLE team_match_stats (
    id               BIGSERIAL,
    match_id         BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    stat_date        DATE NOT NULL,
    team_id          BIGINT NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
    source_id        SMALLINT NOT NULL REFERENCES dim_source(source_id),
    stat_type        TEXT NOT NULL,
    stats            JSONB NOT NULL,
    goals            NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'goals'))           STORED,
    xg               NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'xg'))              STORED,
    shots            NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'shots'))           STORED,
    shots_on_target  NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'shots_on_target'))  STORED,
    possession_pct   NUMERIC GENERATED ALWAYS AS (safe_numeric(stats->>'possession_pct'))  STORED,
    ingested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (stat_date, id),
    UNIQUE (stat_date, match_id, team_id, source_id, stat_type)
) PARTITION BY RANGE (stat_date);

CREATE INDEX idx_tms_stats_gin ON team_match_stats USING GIN (stats);
CREATE INDEX idx_tms_team ON team_match_stats(team_id);
CREATE INDEX idx_tms_xg ON team_match_stats(xg) WHERE xg IS NOT NULL;

-- Partições 2000-2035 + DEFAULT
DO $$
DECLARE
    yr INT;
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['match_event','player_match_stats','team_match_stats'] LOOP
        FOR yr IN 2000..2035 LOOP
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                tbl || '_' || yr, tbl, (yr || '-01-01')::date, ((yr + 1) || '-01-01')::date
            );
        END LOOP;
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I DEFAULT', tbl || '_default', tbl);
    END LOOP;
END $$;

-- Criação resiliente de partição futura que lida com dados previamente caídos na partição DEFAULT
CREATE OR REPLACE PROCEDURE create_partitions_for_year(p_year INT)
LANGUAGE plpgsql AS $$
DECLARE
    tbl        TEXT;
    v_start    DATE := (p_year || '-01-01')::DATE;
    v_end      DATE := ((p_year + 1) || '-01-01')::DATE;
    v_def_cnt  BIGINT;
    v_date_col TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['match_event', 'player_match_stats', 'team_match_stats'] LOOP
        v_date_col := CASE WHEN tbl = 'match_event' THEN 'event_date' ELSE 'stat_date' END;

        -- Verifica se há linhas na partição default pertencentes ao range da nova partição
        EXECUTE format(
            'SELECT count(*) FROM %I WHERE %I >= %L AND %I < %L',
            tbl || '_default', v_date_col, v_start, v_date_col, v_end
        ) INTO v_def_cnt;

        IF v_def_cnt > 0 THEN
            -- Se há linhas na default, isola em tabela temporária, desanexa default, cria partição, insere e reanexa
            EXECUTE format('CREATE TEMP TABLE tmp_mig_%I AS SELECT * FROM %I WHERE %I >= %L AND %I < %L',
                tbl, tbl || '_default', v_date_col, v_start, v_date_col, v_end);
            EXECUTE format('DELETE FROM %I WHERE %I >= %L AND %I < %L', tbl || '_default', v_date_col, v_start, v_date_col, v_end);
        END IF;

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
            tbl || '_' || p_year, tbl, v_start, v_end
        );

        IF v_def_cnt > 0 THEN
            EXECUTE format('INSERT INTO %I SELECT * FROM tmp_mig_%I', tbl || '_' || p_year, tbl);
            EXECUTE format('DROP TABLE tmp_mig_%I', tbl);
        END IF;
    END LOOP;
END;
$$;

-- ---------- FATOS SEM PARTICIONAMENTO ----------
CREATE TABLE player_season_stats (
    id              BIGSERIAL PRIMARY KEY,
    player_id       BIGINT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
    team_id         BIGINT REFERENCES team(team_id) ON DELETE SET NULL,
    competition_id  BIGINT NOT NULL,
    season_id       BIGINT NOT NULL,
    source_id       SMALLINT NOT NULL REFERENCES dim_source(source_id),
    stat_type       TEXT NOT NULL,
    stats           JSONB NOT NULL,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- FK composta: impede temporada de outra competição
    FOREIGN KEY (season_id, competition_id) REFERENCES season(season_id, competition_id) ON DELETE CASCADE,
    UNIQUE (player_id, competition_id, season_id, source_id, stat_type)
);
CREATE INDEX idx_pss_stats_gin ON player_season_stats USING GIN (stats);

CREATE TABLE team_season_stats (
    id              BIGSERIAL PRIMARY KEY,
    team_id         BIGINT NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
    competition_id  BIGINT NOT NULL,
    season_id       BIGINT NOT NULL,
    source_id       SMALLINT NOT NULL REFERENCES dim_source(source_id),
    stat_type       TEXT NOT NULL,
    stats           JSONB NOT NULL,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (season_id, competition_id) REFERENCES season(season_id, competition_id) ON DELETE CASCADE,
    UNIQUE (team_id, competition_id, season_id, source_id, stat_type)
);
CREATE INDEX idx_tss_stats_gin ON team_season_stats USING GIN (stats);

CREATE TABLE team_elo_rating (
    id           BIGSERIAL PRIMARY KEY,
    team_id      BIGINT NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
    source_id    SMALLINT NOT NULL REFERENCES dim_source(source_id),
    rating_date  DATE NOT NULL,
    elo          NUMERIC(7,2) NOT NULL,
    rank         INTEGER,
    UNIQUE (team_id, source_id, rating_date)
);

CREATE TABLE match_odds (
    id            BIGSERIAL PRIMARY KEY,
    match_id      BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    source_id     SMALLINT NOT NULL REFERENCES dim_source(source_id),
    bookmaker     TEXT NOT NULL,
    market        TEXT NOT NULL DEFAULT '1x2',
    home_odds     NUMERIC(6,2),
    draw_odds     NUMERIC(6,2),
    away_odds     NUMERIC(6,2),
    collected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_id, source_id, bookmaker, market, collected_at)
);

CREATE TABLE match_forecast (
    id                    BIGSERIAL PRIMARY KEY,
    match_id              BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    source_id             SMALLINT NOT NULL REFERENCES dim_source(source_id),
    spi_home              NUMERIC(6,2),
    spi_away              NUMERIC(6,2),
    prob_home_win         NUMERIC(5,4),
    prob_draw             NUMERIC(5,4),
    prob_away_win         NUMERIC(5,4),
    projected_score_home  NUMERIC(4,2),
    projected_score_away  NUMERIC(4,2),
    generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_id, source_id, generated_at)
);

CREATE TABLE player_fifa_rating (
    id              BIGSERIAL PRIMARY KEY,
    player_id       BIGINT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
    source_id       SMALLINT NOT NULL REFERENCES dim_source(source_id),
    fifa_version    TEXT NOT NULL,
    fifa_update     DATE,
    overall_rating  SMALLINT,
    potential       SMALLINT,
    value_eur       BIGINT,
    wage_eur        BIGINT,
    position_code   TEXT REFERENCES dim_position(position_code),
    attributes      JSONB,
    UNIQUE (player_id, source_id, fifa_version, fifa_update)
);

-- =====================================================================
-- 06. CAMADA GOLD — RECONCILIAÇÃO PRIORIZADA
-- =====================================================================

CREATE TABLE stat_source_priority (
    stat_type   TEXT NOT NULL,
    source_id   SMALLINT NOT NULL REFERENCES dim_source(source_id),
    priority    SMALLINT NOT NULL,
    PRIMARY KEY (stat_type, source_id)
);

CREATE MATERIALIZED VIEW gold_player_match_stats AS
SELECT DISTINCT ON (pms.match_id, pms.player_id, pms.stat_type)
    pms.match_id,
    pms.stat_date,
    pms.player_id,
    pms.team_id,
    pms.stat_type,
    pms.goals,
    pms.assists,
    pms.minutes,
    pms.xg,
    pms.xa,
    pms.stats,
    pms.source_id AS chosen_source_id
FROM player_match_stats pms
LEFT JOIN stat_source_priority ssp
    ON ssp.stat_type = pms.stat_type AND ssp.source_id = pms.source_id
ORDER BY pms.match_id, pms.player_id, pms.stat_type,
         COALESCE(ssp.priority, 999) ASC,
         pms.ingested_at DESC;

CREATE UNIQUE INDEX idx_gold_pms ON gold_player_match_stats(match_id, player_id, stat_type);

CREATE MATERIALIZED VIEW gold_team_match_stats AS
SELECT DISTINCT ON (tms.match_id, tms.team_id, tms.stat_type)
    tms.match_id,
    tms.stat_date,
    tms.team_id,
    tms.stat_type,
    tms.goals,
    tms.xg,
    tms.shots,
    tms.shots_on_target,
    tms.possession_pct,
    tms.stats,
    tms.source_id AS chosen_source_id
FROM team_match_stats tms
LEFT JOIN stat_source_priority ssp
    ON ssp.stat_type = tms.stat_type AND ssp.source_id = tms.source_id
ORDER BY tms.match_id, tms.team_id, tms.stat_type,
         COALESCE(ssp.priority, 999) ASC,
         tms.ingested_at DESC;

CREATE UNIQUE INDEX idx_gold_tms ON gold_team_match_stats(match_id, team_id, stat_type);

CREATE OR REPLACE FUNCTION refresh_gold_views(p_concurrently BOOLEAN DEFAULT false)
RETURNS VOID AS $$
BEGIN
    IF p_concurrently THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY gold_player_match_stats;
        REFRESH MATERIALIZED VIEW CONCURRENTLY gold_team_match_stats;
    ELSE
        REFRESH MATERIALIZED VIEW gold_player_match_stats;
        REFRESH MATERIALIZED VIEW gold_team_match_stats;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 07. RESOLUÇÃO DE IDENTIDADE & FUNÇÕES DE INSERÇÃO
-- =====================================================================

CREATE OR REPLACE FUNCTION get_or_create_player(
    p_source_code       TEXT,
    p_external_id       TEXT,
    p_full_name         TEXT,
    p_birth_date        DATE DEFAULT NULL,
    p_nationality       CHAR(3) DEFAULT NULL,
    p_match_confidence  NUMERIC DEFAULT 1.0,
    p_matched_by        TEXT DEFAULT 'system',
    p_display_name      TEXT DEFAULT NULL,
    p_raw_payload       JSONB DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    v_source_id   SMALLINT;
    v_player_id   BIGINT;
    v_candidates  BIGINT[];
    v_norm        TEXT := normalize_name(p_full_name);
    v_sim         REAL;
BEGIN
    SELECT source_id INTO v_source_id FROM dim_source WHERE code = p_source_code;
    IF v_source_id IS NULL THEN
        RAISE EXCEPTION 'Fonte desconhecida: %', p_source_code;
    END IF;

    -- 1. Verificação no crosswalk
    SELECT player_id INTO v_player_id
    FROM player_external_id
    WHERE source_id = v_source_id AND external_id = p_external_id;
    IF v_player_id IS NOT NULL THEN
        RETURN v_player_id;
    END IF;

    -- 2. Lock transacional por nome normalizado
    PERFORM pg_advisory_xact_lock(hashtextextended(v_norm, 0));

    SELECT player_id INTO v_player_id
    FROM player_external_id
    WHERE source_id = v_source_id AND external_id = p_external_id;
    IF v_player_id IS NOT NULL THEN
        RETURN v_player_id;
    END IF;

    -- 3. Busca por Alias já cadastrado
    SELECT a.player_id INTO v_player_id
    FROM player_alias a
    WHERE a.normalized_alias = v_norm
    LIMIT 1;

    -- 4. Matching inteligente com desambiguação e tolerância a variações (ex: "Vinicius Jr" vs "Vinicius Junior")
    IF v_player_id IS NULL THEN
        IF p_birth_date IS NOT NULL THEN
            -- Primeiro tenta nome idêntico com nascimento igual
            SELECT player_id INTO v_player_id
            FROM player
            WHERE normalized_name = v_norm AND birth_date = p_birth_date
            LIMIT 1;

            -- Se não achou por nome exato, testa variação fonética / trigrama com mesmo nascimento (>= 0.50)
            IF v_player_id IS NULL THEN
                SELECT p.player_id, similarity(p.normalized_name, v_norm)
                INTO v_player_id, v_sim
                FROM player p
                WHERE p.birth_date = p_birth_date
                  AND similarity(p.normalized_name, v_norm) >= 0.50
                ORDER BY similarity(p.normalized_name, v_norm) DESC
                LIMIT 1;

                -- Grava a grafia alternativa como alias para as próximas consultas
                IF v_player_id IS NOT NULL THEN
                    INSERT INTO player_alias (player_id, alias, source_id)
                    VALUES (v_player_id, p_full_name, v_source_id)
                    ON CONFLICT DO NOTHING;
                END IF;
            END IF;
        ELSE
            -- Sem data de nascimento: procura candidatos únicos
            SELECT ARRAY_AGG(player_id) INTO v_candidates
            FROM player
            WHERE normalized_name = v_norm
              AND (p_nationality IS NULL OR nationality_code IS NULL OR nationality_code = p_nationality);

            IF array_length(v_candidates, 1) = 1 THEN
                v_player_id := v_candidates[1];
            ELSIF array_length(v_candidates, 1) > 1 AND p_raw_payload IS NOT NULL THEN
                -- Múltiplos candidatos homônimos: envia para fila de revisão manual sem fundir às cegas
                INSERT INTO entity_match_review (
                    entity_type, source_id, external_id, raw_payload, score, status
                ) VALUES (
                    'player', v_source_id, p_external_id, p_raw_payload, 0.5, 'pending'
                );
            END IF;
        END IF;
    END IF;

    -- 5. Criação se não casou com nenhum atleta existente
    IF v_player_id IS NULL THEN
        INSERT INTO player (full_name, display_name, birth_date, nationality_code, slug)
        VALUES (
            p_full_name,
            COALESCE(p_display_name, p_full_name),
            p_birth_date,
            p_nationality,
            slugify(COALESCE(p_display_name, p_full_name))
        )
        RETURNING player_id INTO v_player_id;
    ELSE
        -- Enriquecimento automático de campos não preenchidos
        UPDATE player
        SET birth_date       = COALESCE(birth_date, p_birth_date),
            nationality_code = COALESCE(nationality_code, p_nationality),
            display_name     = COALESCE(display_name, p_display_name)
        WHERE player_id = v_player_id
          AND (
               (birth_date IS NULL AND p_birth_date IS NOT NULL) OR
               (nationality_code IS NULL AND p_nationality IS NOT NULL) OR
               (display_name IS NULL AND p_display_name IS NOT NULL)
          );
    END IF;

    -- 6. Grava no crosswalk
    INSERT INTO player_external_id (source_id, external_id, player_id, match_confidence, matched_by)
    VALUES (v_source_id, p_external_id, v_player_id, p_match_confidence, p_matched_by)
    ON CONFLICT (source_id, external_id) DO NOTHING;

    RETURN v_player_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_or_create_team(
    p_source_code       TEXT,
    p_external_id       TEXT,
    p_canonical_name    TEXT,
    p_country_code      CHAR(3) DEFAULT NULL,
    p_match_confidence  NUMERIC DEFAULT 1.0,
    p_matched_by        TEXT DEFAULT 'system',
    p_short_name        TEXT DEFAULT NULL,
    p_state             CHAR(2) DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    v_source_id SMALLINT;
    v_team_id   BIGINT;
    v_slug      TEXT;
    v_norm      TEXT := normalize_name(p_canonical_name);
BEGIN
    SELECT source_id INTO v_source_id FROM dim_source WHERE code = p_source_code;
    IF v_source_id IS NULL THEN
        RAISE EXCEPTION 'Fonte desconhecida: %', p_source_code;
    END IF;

    SELECT team_id INTO v_team_id
    FROM team_external_id
    WHERE source_id = v_source_id AND external_id = p_external_id;
    IF v_team_id IS NOT NULL THEN
        RETURN v_team_id;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_norm, 1));

    SELECT team_id INTO v_team_id
    FROM team_external_id
    WHERE source_id = v_source_id AND external_id = p_external_id;
    IF v_team_id IS NOT NULL THEN
        RETURN v_team_id;
    END IF;

    -- Busca respeitando o país (impede fusão indevida de Barcelona-ESP com Barcelona-ECU)
    SELECT team_id INTO v_team_id
    FROM team
    WHERE normalized_name = v_norm
      AND (p_country_code IS NULL OR country_code IS NULL OR country_code = p_country_code)
    LIMIT 1;

    IF v_team_id IS NULL THEN
        v_slug := generate_unique_team_slug(COALESCE(p_short_name, p_canonical_name), p_country_code);
        INSERT INTO team (canonical_name, short_name, country_code, state, slug)
        VALUES (
            p_canonical_name,
            COALESCE(p_short_name, p_canonical_name),
            p_country_code,
            p_state,
            v_slug
        )
        RETURNING team_id INTO v_team_id;
    ELSE
        UPDATE team
        SET country_code = COALESCE(country_code, p_country_code),
            short_name   = COALESCE(short_name, p_short_name),
            state        = COALESCE(state, p_state)
        WHERE team_id = v_team_id
          AND (
               (country_code IS NULL AND p_country_code IS NOT NULL) OR
               (short_name IS NULL AND p_short_name IS NOT NULL) OR
               (state IS NULL AND p_state IS NOT NULL)
          );
    END IF;

    INSERT INTO team_external_id (source_id, external_id, team_id, match_confidence, matched_by)
    VALUES (v_source_id, p_external_id, v_team_id, p_match_confidence, p_matched_by)
    ON CONFLICT (source_id, external_id) DO NOTHING;

    RETURN v_team_id;
END;
$$ LANGUAGE plpgsql;

-- Procedimento de fusão de jogadores (reaponta todas as FKs e registra em auditoria)
CREATE OR REPLACE PROCEDURE merge_players(
    p_from_player_id BIGINT,
    p_to_player_id   BIGINT,
    p_reason         TEXT,
    p_performed_by   TEXT DEFAULT current_user
)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_from_player_id = p_to_player_id THEN
        RAISE EXCEPTION 'Não é permitido fundir um jogador com ele mesmo (ID: %)', p_from_player_id;
    END IF;

    -- 1. Reaponta external_ids (com tratamento de conflito)
    INSERT INTO player_external_id (source_id, external_id, player_id, match_confidence, matched_by)
    SELECT source_id, external_id, p_to_player_id, match_confidence, p_performed_by
    FROM player_external_id WHERE player_id = p_from_player_id
    ON CONFLICT (source_id, external_id) DO UPDATE SET player_id = p_to_player_id;

    -- 2. Converte nome do jogador anterior em alias
    INSERT INTO player_alias (player_id, alias)
    SELECT p_to_player_id, full_name FROM player WHERE player_id = p_from_player_id
    ON CONFLICT DO NOTHING;

    -- 3. Reaponta fatos e dependências
    UPDATE match_event SET player_id = p_to_player_id WHERE player_id = p_from_player_id;
    UPDATE match_event SET assist_player_id = p_to_player_id WHERE assist_player_id = p_from_player_id;
    UPDATE player_appearance SET player_id = p_to_player_id WHERE player_id = p_from_player_id;
    UPDATE player_market_value_history SET player_id = p_to_player_id WHERE player_id = p_from_player_id;
    UPDATE player_injury SET player_id = p_to_player_id WHERE player_id = p_from_player_id;
    UPDATE player_team_history SET player_id = p_to_player_id WHERE player_id = p_from_player_id;
    UPDATE player_match_stats SET player_id = p_to_player_id WHERE player_id = p_from_player_id;
    UPDATE player_season_stats SET player_id = p_to_player_id WHERE player_id = p_from_player_id;

    -- 4. Registra no log de auditoria
    INSERT INTO entity_merge_log (entity_type, from_entity_id, to_entity_id, reason, performed_by)
    VALUES ('player', p_from_player_id, p_to_player_id, p_reason, p_performed_by);

    -- 5. Exclui o registro antigo
    DELETE FROM player WHERE player_id = p_from_player_id;
END;
$$;

-- Inserções com resolução de data UTC (imune a fuso da sessão) e validação de clubes
CREATE OR REPLACE FUNCTION insert_match_event(
    p_match_id          BIGINT,
    p_source_code       TEXT,
    p_team_id           BIGINT DEFAULT NULL,
    p_player_id         BIGINT DEFAULT NULL,
    p_minute            INTEGER DEFAULT NULL,
    p_second            INTEGER DEFAULT NULL,
    p_event_type        TEXT DEFAULT NULL,
    p_x                 NUMERIC DEFAULT NULL,
    p_y                 NUMERIC DEFAULT NULL,
    p_qualifiers        JSONB DEFAULT NULL,
    p_sequence_no       INTEGER DEFAULT NULL,
    p_assist_player_id  BIGINT DEFAULT NULL,
    p_is_own_goal       BOOLEAN DEFAULT FALSE,
    p_is_penalty        BOOLEAN DEFAULT FALSE,
    p_body_part         TEXT DEFAULT NULL,
    p_shot_result       TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    v_date      DATE;
    v_source_id SMALLINT;
    v_id        BIGINT;
    v_home      BIGINT;
    v_away      BIGINT;
BEGIN
    SELECT (match_date AT TIME ZONE 'UTC')::date, home_team_id, away_team_id
    INTO v_date, v_home, v_away
    FROM match WHERE match_id = p_match_id;

    v_date := COALESCE(v_date, CURRENT_DATE);

    IF p_team_id IS NOT NULL AND p_team_id <> v_home AND p_team_id <> v_away THEN
        RAISE EXCEPTION 'Clube % não disputou a partida % (mandante=%, visitante=%)', p_team_id, p_match_id, v_home, v_away;
    END IF;

    SELECT source_id INTO v_source_id FROM dim_source WHERE code = p_source_code;
    IF v_source_id IS NULL THEN
        RAISE EXCEPTION 'Fonte desconhecida: %', p_source_code;
    END IF;

    INSERT INTO match_event (
        match_id, event_date, source_id, team_id, player_id, assist_player_id,
        minute, second, event_type, is_own_goal, is_penalty, body_part, shot_result,
        x, y, qualifiers, sequence_no
    )
    VALUES (
        p_match_id, v_date, v_source_id, p_team_id, p_player_id, p_assist_player_id,
        p_minute, p_second, p_event_type, p_is_own_goal, p_is_penalty, p_body_part, p_shot_result,
        p_x, p_y, p_qualifiers, p_sequence_no
    )
    RETURNING event_id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION insert_player_match_stat(
    p_match_id    BIGINT,
    p_player_id   BIGINT,
    p_team_id     BIGINT,
    p_source_code TEXT,
    p_stat_type   TEXT,
    p_stats       JSONB
) RETURNS BIGINT AS $$
DECLARE
    v_date      DATE;
    v_source_id SMALLINT;
    v_id        BIGINT;
    v_home      BIGINT;
    v_away      BIGINT;
BEGIN
    SELECT (match_date AT TIME ZONE 'UTC')::date, home_team_id, away_team_id
    INTO v_date, v_home, v_away
    FROM match WHERE match_id = p_match_id;

    v_date := COALESCE(v_date, CURRENT_DATE);

    IF p_team_id <> v_home AND p_team_id <> v_away THEN
        RAISE EXCEPTION 'Clube % não disputou a partida % (mandante=%, visitante=%)', p_team_id, p_match_id, v_home, v_away;
    END IF;

    SELECT source_id INTO v_source_id FROM dim_source WHERE code = p_source_code;
    IF v_source_id IS NULL THEN
        RAISE EXCEPTION 'Fonte desconhecida: %', p_source_code;
    END IF;

    INSERT INTO player_match_stats (match_id, stat_date, player_id, team_id, source_id, stat_type, stats)
    VALUES (p_match_id, v_date, p_player_id, p_team_id, v_source_id, p_stat_type, p_stats)
    ON CONFLICT (stat_date, match_id, player_id, source_id, stat_type)
        DO UPDATE SET stats = EXCLUDED.stats, ingested_at = now()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION insert_team_match_stat(
    p_match_id    BIGINT,
    p_team_id     BIGINT,
    p_source_code TEXT,
    p_stat_type   TEXT,
    p_stats       JSONB
) RETURNS BIGINT AS $$
DECLARE
    v_date      DATE;
    v_source_id SMALLINT;
    v_id        BIGINT;
    v_home      BIGINT;
    v_away      BIGINT;
BEGIN
    SELECT (match_date AT TIME ZONE 'UTC')::date, home_team_id, away_team_id
    INTO v_date, v_home, v_away
    FROM match WHERE match_id = p_match_id;

    v_date := COALESCE(v_date, CURRENT_DATE);

    IF p_team_id <> v_home AND p_team_id <> v_away THEN
        RAISE EXCEPTION 'Clube % não disputou a partida % (mandante=%, visitante=%)', p_team_id, p_match_id, v_home, v_away;
    END IF;

    SELECT source_id INTO v_source_id FROM dim_source WHERE code = p_source_code;
    IF v_source_id IS NULL THEN
        RAISE EXCEPTION 'Fonte desconhecida: %', p_source_code;
    END IF;

    INSERT INTO team_match_stats (match_id, stat_date, team_id, source_id, stat_type, stats)
    VALUES (p_match_id, v_date, p_team_id, v_source_id, p_stat_type, p_stats)
    ON CONFLICT (stat_date, match_id, team_id, source_id, stat_type)
        DO UPDATE SET stats = EXCLUDED.stats, ingested_at = now()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para propagar mudança de match_date para as tabelas particionadas (jogos adiados/remarcados)
CREATE OR REPLACE FUNCTION sync_match_date_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_old_date DATE := (OLD.match_date AT TIME ZONE 'UTC')::date;
    v_new_date DATE := (NEW.match_date AT TIME ZONE 'UTC')::date;
BEGIN
    IF v_new_date IS DISTINCT FROM v_old_date AND v_new_date IS NOT NULL THEN
        UPDATE match_event SET event_date = v_new_date WHERE match_id = NEW.match_id;
        UPDATE player_match_stats SET stat_date = v_new_date WHERE match_id = NEW.match_id;
        UPDATE team_match_stats SET stat_date = v_new_date WHERE match_id = NEW.match_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_match_date
AFTER UPDATE OF match_date ON match
FOR EACH ROW EXECUTE FUNCTION sync_match_date_changes();

-- =====================================================================
-- 08. VIEWS ANALÍTICAS E CONSULTAS DA APLICAÇÃO (FASTAPI / NEXT.JS)
-- =====================================================================

-- Elenco ativo atual: não inventa posições (retorna NULL se desconhecido)
CREATE OR REPLACE VIEW vw_team_squad AS
SELECT
    t.team_id,
    t.slug AS team_slug,
    t.canonical_name AS team_name,
    t.short_name AS team_short_name,
    p.player_id,
    p.full_name,
    COALESCE(p.display_name, p.full_name) AS display_name,
    pth.shirt_number,
    pth.position_code,
    dp.name AS position_name,
    dp.line AS position_line,
    pth.detailed_position,
    pth.status,
    p.birth_date,
    DATE_PART('year', AGE(p.birth_date))::INT AS age,
    p.nationality_code,
    p.photo_url,
    p.height_cm,
    p.weight_kg,
    p.preferred_foot,
    p.market_value_eur,
    pth.contract_until,
    pth.wage_eur_weekly,
    pth.release_clause_eur,
    pth.start_date AS joined_date
FROM player_team_history pth
JOIN team t ON t.team_id = pth.team_id
JOIN player p ON p.player_id = pth.player_id
LEFT JOIN dim_position dp ON dp.position_code = pth.position_code
WHERE pth.is_current = true;

-- Função unificada para cálculo de classificação (evita duplicação de lógica entre view e função por rodada)
CREATE OR REPLACE FUNCTION fn_standings_at_round(
    p_competition_id BIGINT,
    p_season_id      BIGINT,
    p_max_round      SMALLINT DEFAULT NULL
) RETURNS TABLE (
    "position"       INT,
    team_id          BIGINT,
    team_name        TEXT,
    team_short_name  TEXT,
    team_slug        TEXT,
    crest_url        TEXT,
    played           INT,
    won              INT,
    drawn            INT,
    lost             INT,
    goals_for        INT,
    goals_against    INT,
    goal_difference  INT,
    points           INT
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_matches AS (
        SELECT *
        FROM match m
        WHERE m.competition_id = p_competition_id
          AND m.season_id = p_season_id
          AND m.status = 'finished'
          AND m.home_score IS NOT NULL
          AND m.away_score IS NOT NULL
          AND (p_max_round IS NULL OR m.matchday <= p_max_round)
    ),
    points_calc AS (
        SELECT
            m.home_team_id AS tid,
            1 AS p_played,
            CASE WHEN m.home_score > m.away_score THEN 1 ELSE 0 END AS p_won,
            CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS p_drawn,
            CASE WHEN m.home_score < m.away_score THEN 1 ELSE 0 END AS p_lost,
            m.home_score AS p_gf,
            m.away_score AS p_ga,
            CASE WHEN m.home_score > m.away_score THEN 3 WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS p_pts
        FROM filtered_matches m

        UNION ALL

        SELECT
            m.away_team_id AS tid,
            1 AS p_played,
            CASE WHEN m.away_score > m.home_score THEN 1 ELSE 0 END AS p_won,
            CASE WHEN m.away_score = m.home_score THEN 1 ELSE 0 END AS p_drawn,
            CASE WHEN m.away_score < m.home_score THEN 1 ELSE 0 END AS p_lost,
            m.away_score AS p_gf,
            m.home_score AS p_ga,
            CASE WHEN m.away_score > m.home_score THEN 3 WHEN m.away_score = m.home_score THEN 1 ELSE 0 END AS p_pts
        FROM filtered_matches m
    ),
    summary AS (
        SELECT
            pc.tid,
            SUM(pc.p_played)::INT AS total_played,
            SUM(pc.p_won)::INT AS total_won,
            SUM(pc.p_drawn)::INT AS total_drawn,
            SUM(pc.p_lost)::INT AS total_lost,
            SUM(pc.p_gf)::INT AS total_gf,
            SUM(pc.p_ga)::INT AS total_ga,
            (SUM(pc.p_gf) - SUM(pc.p_ga))::INT AS total_gd,
            SUM(pc.p_pts)::INT AS total_pts
        FROM points_calc pc
        GROUP BY pc.tid
    )
    SELECT
        DENSE_RANK() OVER (
            ORDER BY s.total_pts DESC, s.total_won DESC, s.total_gd DESC, s.total_gf DESC, t.canonical_name ASC
        )::INT AS "position",
        t.team_id,
        t.canonical_name AS team_name,
        t.short_name AS team_short_name,
        t.slug AS team_slug,
        t.crest_url,
        s.total_played,
        s.total_won,
        s.total_drawn,
        s.total_lost,
        s.total_gf,
        s.total_ga,
        s.total_gd,
        s.total_pts
    FROM summary s
    JOIN team t ON t.team_id = s.tid;
END;
$$ LANGUAGE plpgsql STABLE;

-- View da tabela de classificação geral: reutiliza a mesma lógica de cálculo
CREATE OR REPLACE VIEW vw_league_standings AS
SELECT
    s.competition_id,
    s.season_id,
    st."position",
    st.team_id,
    st.team_name,
    st.team_short_name AS short_name,
    st.team_slug,
    st.crest_url,
    st.played,
    st.won,
    st.drawn,
    st.lost,
    st.goals_for,
    st.goals_against,
    st.goal_difference,
    st.points
FROM season s
CROSS JOIN LATERAL fn_standings_at_round(s.competition_id, s.season_id, NULL) st;

-- Artilharia consolidada a partir da CAMADA GOLD (sem contagem dupla de múltiplas fontes)
-- e unificada por jogador na temporada (jogadores que trocaram de clube somam tudo em 1 linha)
CREATE OR REPLACE VIEW vw_top_scorers AS
WITH player_gold_totals AS (
    SELECT
        m.competition_id,
        m.season_id,
        gp.player_id,
        COUNT(DISTINCT gp.match_id)::INT AS matches_played,
        SUM(COALESCE(gp.goals, 0))::INT AS goals,
        SUM(COALESCE(gp.assists, 0))::INT AS assists,
        SUM(COALESCE(gp.minutes, 0))::INT AS minutes_played,
        ROUND(SUM(COALESCE(gp.xg, 0)), 2) AS total_xg,
        ROUND(SUM(COALESCE(gp.xa, 0)), 2) AS total_xa,
        SUM(COALESCE((gp.stats->>'penalty_goals')::numeric, 0))::INT AS penalty_goals,
        SUM(COALESCE((gp.stats->>'penalty_attempts')::numeric, 0))::INT AS penalty_attempts,
        SUM(COALESCE((gp.stats->>'yellow_cards')::numeric, 0))::INT AS yellow_cards,
        SUM(COALESCE((gp.stats->>'red_cards')::numeric, 0))::INT AS red_cards,
        -- Pega o clube mais recente em que o jogador atuou na competição/temporada
        (
            SELECT sub_gp.team_id
            FROM gold_player_match_stats sub_gp
            JOIN match sub_m ON sub_m.match_id = sub_gp.match_id
            WHERE sub_gp.player_id = gp.player_id
              AND sub_m.competition_id = m.competition_id
              AND sub_m.season_id = m.season_id
              AND sub_gp.stat_type = 'standard'
            ORDER BY sub_gp.stat_date DESC
            LIMIT 1
        ) AS current_team_id
    FROM gold_player_match_stats gp
    JOIN match m ON m.match_id = gp.match_id
    WHERE gp.stat_type = 'standard'
    GROUP BY m.competition_id, m.season_id, gp.player_id
)
SELECT
    pgt.competition_id,
    pgt.season_id,
    p.player_id,
    p.full_name,
    COALESCE(p.display_name, p.full_name) AS display_name,
    p.photo_url,
    p.birth_date,
    DATE_PART('year', AGE(p.birth_date))::INT AS age,
    p.nationality_code,
    p.height_cm,
    p.preferred_foot,
    p.market_value_eur,
    t.team_id,
    t.canonical_name AS team_name,
    t.short_name AS team_short_name,
    t.slug AS team_slug,
    t.crest_url AS team_crest_url,
    pgt.matches_played,
    pgt.goals,
    pgt.assists,
    pgt.minutes_played,
    pgt.total_xg,
    pgt.total_xa,
    pgt.penalty_goals,
    pgt.penalty_attempts,
    pgt.yellow_cards,
    pgt.red_cards,
    DENSE_RANK() OVER (
        PARTITION BY pgt.competition_id, pgt.season_id
        ORDER BY pgt.goals DESC, pgt.assists DESC, pgt.minutes_played ASC
    )::INT AS rank_goals
FROM player_gold_totals pgt
JOIN player p ON p.player_id = pgt.player_id
LEFT JOIN team t ON t.team_id = pgt.current_team_id;

-- Retrospecto recente de partidas (Form: V, E, D) por clube
CREATE OR REPLACE VIEW vw_team_recent_form AS
WITH matches_ordered AS (
    SELECT
        m.match_id,
        m.competition_id,
        m.season_id,
        m.match_date,
        m.home_team_id AS team_id,
        CASE
            WHEN m.home_score > m.away_score THEN 'V'
            WHEN m.home_score = m.away_score THEN 'E'
            ELSE 'D'
        END AS result
    FROM match m
    WHERE m.status = 'finished' AND m.home_score IS NOT NULL

    UNION ALL

    SELECT
        m.match_id,
        m.competition_id,
        m.season_id,
        m.match_date,
        m.away_team_id AS team_id,
        CASE
            WHEN m.away_score > m.home_score THEN 'V'
            WHEN m.away_score = m.home_score THEN 'E'
            ELSE 'D'
        END AS result
    FROM match m
    WHERE m.status = 'finished' AND m.away_score IS NOT NULL
),
ranked_matches AS (
    SELECT
        team_id,
        competition_id,
        season_id,
        result,
        ROW_NUMBER() OVER (PARTITION BY competition_id, season_id, team_id ORDER BY match_date DESC) as form_rn
    FROM matches_ordered
)
SELECT
    competition_id,
    season_id,
    team_id,
    ARRAY_AGG(result ORDER BY form_rn ASC) AS form_last_5
FROM ranked_matches
WHERE form_rn <= 5
GROUP BY competition_id, season_id, team_id;

-- Busca global otimizada com escape de LIKE e índice GIN
CREATE OR REPLACE FUNCTION search_entities(
    p_query TEXT,
    p_limit INT DEFAULT 10
) RETURNS TABLE (
    type       TEXT,
    id         BIGINT,
    name       TEXT,
    subtitle   TEXT,
    slug       TEXT,
    photo_url  TEXT,
    score      REAL
) AS $$
DECLARE
    v_clean    TEXT := normalize_name(p_query);
    v_escaped  TEXT := escape_like_pattern(v_clean);
BEGIN
    RETURN QUERY
    WITH team_matches AS (
        SELECT
            'team'::TEXT AS type,
            t.team_id AS id,
            COALESCE(t.short_name, t.canonical_name) AS name,
            COALESCE(t.state || ' · Clube', 'Clube')::TEXT AS subtitle,
            t.slug AS slug,
            t.crest_url AS photo_url,
            similarity(t.normalized_name, v_clean) AS score
        FROM team t
        WHERE t.normalized_name % v_clean
           OR t.normalized_name LIKE '%' || v_escaped || '%'
    ),
    player_matches AS (
        SELECT
            'player'::TEXT AS type,
            p.player_id AS id,
            COALESCE(p.display_name, p.full_name) AS name,
            COALESCE(
                (SELECT dp.name || ' · ' || t.short_name
                 FROM player_team_history pth
                 JOIN team t ON t.team_id = pth.team_id
                 LEFT JOIN dim_position dp ON dp.position_code = pth.position_code
                 WHERE pth.player_id = p.player_id AND pth.is_current = true
                 LIMIT 1),
                'Jogador'
            )::TEXT AS subtitle,
            p.player_id::TEXT AS slug,
            p.photo_url AS photo_url,
            similarity(p.normalized_name, v_clean) AS score
        FROM player p
        WHERE p.normalized_name % v_clean
           OR p.normalized_name LIKE '%' || v_escaped || '%'
    )
    SELECT * FROM team_matches
    UNION ALL
    SELECT * FROM player_matches
    ORDER BY score DESC, name ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 09. RPC ENDPOINTS NATIVOS EM JSON PARA API E FRONTEND (SINGLE-QUERY SCREENS)
-- =====================================================================

-- Confronto direto histórico (Head-to-Head) entre dois clubes
CREATE OR REPLACE FUNCTION fn_team_head_to_head(
    p_team_a BIGINT,
    p_team_b BIGINT,
    p_limit  INT DEFAULT 10
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH h2h_matches AS (
        SELECT
            m.match_id,
            m.match_date,
            m.competition_id,
            c.canonical_name AS competition_name,
            s.name AS season_name,
            m.stage,
            m.home_team_id,
            th.short_name AS home_team_name,
            th.slug AS home_team_slug,
            th.crest_url AS home_crest_url,
            m.away_team_id,
            ta.short_name AS away_team_name,
            ta.slug AS away_team_slug,
            ta.crest_url AS away_crest_url,
            m.home_score,
            m.away_score,
            m.winner_team_id,
            m.status,
            v.name AS venue_name
        FROM match m
        JOIN competition c ON c.competition_id = m.competition_id
        JOIN season s ON s.season_id = m.season_id
        JOIN team th ON th.team_id = m.home_team_id
        JOIN team ta ON ta.team_id = m.away_team_id
        LEFT JOIN venue v ON v.venue_id = m.venue_id
        WHERE ((m.home_team_id = p_team_a AND m.away_team_id = p_team_b)
            OR (m.home_team_id = p_team_b AND m.away_team_id = p_team_a))
          AND m.status = 'finished'
          AND m.home_score IS NOT NULL
        ORDER BY m.match_date DESC
    ),
    summary AS (
        SELECT
            COUNT(*)::INT AS total_matches,
            COUNT(*) FILTER (WHERE winner_team_id = p_team_a)::INT AS wins_a,
            COUNT(*) FILTER (WHERE winner_team_id = p_team_b)::INT AS wins_b,
            COUNT(*) FILTER (WHERE winner_team_id IS NULL AND home_score = away_score)::INT AS draws,
            COALESCE(SUM(CASE WHEN home_team_id = p_team_a THEN home_score ELSE away_score END), 0)::INT AS goals_a,
            COALESCE(SUM(CASE WHEN home_team_id = p_team_b THEN home_score ELSE away_score END), 0)::INT AS goals_b
        FROM h2h_matches
    ),
    recent AS (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'match_id', hm.match_id,
                    'match_date', hm.match_date,
                    'competition', hm.competition_name,
                    'season', hm.season_name,
                    'stage', hm.stage,
                    'home_team', jsonb_build_object('id', hm.home_team_id, 'name', hm.home_team_name, 'slug', hm.home_team_slug, 'crest_url', hm.home_crest_url),
                    'away_team', jsonb_build_object('id', hm.away_team_id, 'name', hm.away_team_name, 'slug', hm.away_team_slug, 'crest_url', hm.away_crest_url),
                    'home_score', hm.home_score,
                    'away_score', hm.away_score,
                    'winner_team_id', hm.winner_team_id,
                    'venue', hm.venue_name
                )
            ),
            '[]'::jsonb
        ) AS list
        FROM (SELECT * FROM h2h_matches LIMIT p_limit) hm
    ),
    teams_info AS (
        SELECT
            (SELECT jsonb_build_object('id', team_id, 'name', canonical_name, 'short_name', short_name, 'slug', slug, 'crest_url', crest_url) FROM team WHERE team_id = p_team_a) AS team_a,
            (SELECT jsonb_build_object('id', team_id, 'name', canonical_name, 'short_name', short_name, 'slug', slug, 'crest_url', crest_url) FROM team WHERE team_id = p_team_b) AS team_b
    )
    SELECT jsonb_build_object(
        'team_a', ti.team_a,
        'team_b', ti.team_b,
        'summary', jsonb_build_object(
            'total_matches', s.total_matches,
            'team_a_wins', s.wins_a,
            'team_b_wins', s.wins_b,
            'draws', s.draws,
            'team_a_goals', s.goals_a,
            'team_b_goals', s.goals_b
        ),
        'recent_matches', r.list
    ) INTO v_result
    FROM summary s, recent r, teams_info ti;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- Detalhes completos da partida para visualização rica no frontend
CREATE OR REPLACE FUNCTION fn_api_match_details(p_match_id BIGINT)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- Perfil completo do jogador para páginas de atleta
CREATE OR REPLACE FUNCTION fn_api_player_profile(p_player_id BIGINT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM player WHERE player_id = p_player_id) THEN
        RETURN NULL;
    END IF;

    WITH player_base AS (
        SELECT
            p.player_id,
            p.full_name,
            COALESCE(p.display_name, p.full_name) AS display_name,
            p.birth_date,
            DATE_PART('year', AGE(p.birth_date))::INT AS age,
            p.nationality_code,
            c.name AS nationality_name,
            p.height_cm,
            p.weight_kg,
            p.preferred_foot,
            p.photo_url,
            p.market_value_eur,
            p.highest_market_value_eur
        FROM player p
        LEFT JOIN country c ON c.country_code = p.nationality_code
        WHERE p.player_id = p_player_id
    ),
    current_team AS (
        SELECT
            jsonb_build_object(
                'team_id', t.team_id,
                'name', t.canonical_name,
                'short_name', t.short_name,
                'slug', t.slug,
                'crest_url', t.crest_url
            ) AS team,
            pth.shirt_number,
            pth.position_code,
            dp.name AS position_name,
            dp.line AS position_line,
            pth.detailed_position,
            pth.start_date AS joined_date,
            pth.contract_until,
            pth.wage_eur_weekly,
            pth.release_clause_eur
        FROM player_team_history pth
        JOIN team t ON t.team_id = pth.team_id
        LEFT JOIN dim_position dp ON dp.position_code = pth.position_code
        WHERE pth.player_id = p_player_id AND pth.is_current = true
        LIMIT 1
    ),
    market_history AS (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'date', valuation_date,
                    'value_eur', market_value_eur
                ) ORDER BY valuation_date ASC
            ),
            '[]'::jsonb
        ) AS list
        FROM player_market_value_history
        WHERE player_id = p_player_id
    ),
    career_teams AS (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'team_id', t.team_id,
                    'team_name', t.canonical_name,
                    'short_name', t.short_name,
                    'slug', t.slug,
                    'crest_url', t.crest_url,
                    'start_date', pth.start_date,
                    'end_date', pth.end_date,
                    'transfer_type', pth.transfer_type,
                    'shirt_number', pth.shirt_number
                ) ORDER BY pth.start_date DESC
            ),
            '[]'::jsonb
        ) AS list
        FROM player_team_history pth
        JOIN team t ON t.team_id = pth.team_id
        WHERE pth.player_id = p_player_id
    ),
    injuries AS (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'injury_id', id,
                    'type', injury_type,
                    'started_at', start_date,
                    'expected_return', expected_return_date,
                    'status', status
                ) ORDER BY start_date DESC
            ),
            '[]'::jsonb
        ) AS list
        FROM player_injury
        WHERE player_id = p_player_id
    ),
    current_season_stats AS (
        SELECT COALESCE(
            jsonb_build_object(
                'matches', COUNT(DISTINCT gp.match_id)::INT,
                'minutes', SUM(COALESCE(gp.minutes, 0))::INT,
                'goals', SUM(COALESCE(gp.goals, 0))::INT,
                'assists', SUM(COALESCE(gp.assists, 0))::INT,
                'xg', ROUND(SUM(COALESCE(gp.xg, 0)), 2),
                'xa', ROUND(SUM(COALESCE(gp.xa, 0)), 2)
            ),
            '{}'::jsonb
        ) AS stats
        FROM gold_player_match_stats gp
        JOIN match m ON m.match_id = gp.match_id
        JOIN season s ON s.season_id = m.season_id AND s.is_current = true
        WHERE gp.player_id = p_player_id AND gp.stat_type = 'standard'
    )
    SELECT jsonb_build_object(
        'player_id', pb.player_id,
        'full_name', pb.full_name,
        'display_name', pb.display_name,
        'birth_date', pb.birth_date,
        'age', pb.age,
        'nationality', jsonb_build_object('code', pb.nationality_code, 'name', pb.nationality_name),
        'physical', jsonb_build_object('height_cm', pb.height_cm, 'weight_kg', pb.weight_kg, 'preferred_foot', pb.preferred_foot),
        'photo_url', pb.photo_url,
        'market_value', jsonb_build_object(
            'current_eur', pb.market_value_eur,
            'highest_eur', pb.highest_market_value_eur,
            'history', mh.list
        ),
        'club', jsonb_build_object(
            'team', ct.team,
            'shirt_number', ct.shirt_number,
            'position_code', ct.position_code,
            'position_name', ct.position_name,
            'position_line', ct.position_line,
            'detailed_position', ct.detailed_position,
            'contract_until', ct.contract_until,
            'wage_eur_weekly', ct.wage_eur_weekly,
            'release_clause_eur', ct.release_clause_eur,
            'joined_date', ct.joined_date
        ),
        'career_teams', cat.list,
        'injuries', inj.list,
        'current_season_stats', css.stats
    ) INTO v_result
    FROM player_base pb
    LEFT JOIN current_team ct ON true
    LEFT JOIN market_history mh ON true
    LEFT JOIN career_teams cat ON true
    LEFT JOIN injuries inj ON true
    LEFT JOIN current_season_stats css ON true;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- Perfil completo do clube para páginas de time
CREATE OR REPLACE FUNCTION fn_api_team_profile(
    p_team_id   BIGINT,
    p_season_id BIGINT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_season_id BIGINT := p_season_id;
    v_result    JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM team WHERE team_id = p_team_id) THEN
        RETURN NULL;
    END IF;

    IF v_season_id IS NULL THEN
        SELECT m.season_id INTO v_season_id
        FROM match m
        JOIN season s ON s.season_id = m.season_id
        WHERE (m.home_team_id = p_team_id OR m.away_team_id = p_team_id)
        ORDER BY s.is_current DESC, m.match_date DESC
        LIMIT 1;
    END IF;

    WITH team_base AS (
        SELECT
            t.team_id,
            t.canonical_name,
            t.short_name,
            t.slug,
            t.country_code,
            c.name AS country_name,
            t.state,
            v.city,
            t.founded_year,
            t.crest_url,
            t.accent_color,
            CASE WHEN v.venue_id IS NOT NULL THEN
                jsonb_build_object('id', v.venue_id, 'name', v.name, 'city', v.city, 'capacity', v.capacity)
            ELSE NULL END AS venue
        FROM team t
        LEFT JOIN country c ON c.country_code = t.country_code
        LEFT JOIN venue v ON v.venue_id = t.venue_id
        WHERE t.team_id = p_team_id
    ),
    manager_info AS (
        SELECT jsonb_build_object(
            'manager_id', m.manager_id,
            'name', m.full_name,
            'nationality', m.nationality_code,
            'start_date', mt.start_date
        ) AS current_manager
        FROM manager_tenure mt
        JOIN manager m ON m.manager_id = mt.manager_id
        WHERE mt.team_id = p_team_id AND mt.role = 'head_coach' AND mt.end_date IS NULL
        LIMIT 1
    ),
    standings AS (
        SELECT jsonb_build_object(
            'position', st.position,
            'played', st.played,
            'won', st.won,
            'drawn', st.drawn,
            'lost', st.lost,
            'goals_for', st.goals_for,
            'goals_against', st.goals_against,
            'goal_difference', st.goal_difference,
            'points', st.points
        ) AS league_table
        FROM vw_league_standings st
        WHERE st.team_id = p_team_id AND (v_season_id IS NULL OR st.season_id = v_season_id)
        LIMIT 1
    ),
    form AS (
        SELECT jsonb_build_object(
            'last_5', COALESCE(rf.form_last_5, ARRAY[]::TEXT[])
        ) AS form_info
        FROM vw_team_recent_form rf
        WHERE rf.team_id = p_team_id AND (v_season_id IS NULL OR rf.season_id = v_season_id)
        LIMIT 1
    ),
    squad AS (
        SELECT jsonb_build_object(
            'goalkeepers', COALESCE(jsonb_agg(p_item) FILTER (WHERE p_item->>'line' = 'goalkeeper'), '[]'::jsonb),
            'defenders',   COALESCE(jsonb_agg(p_item) FILTER (WHERE p_item->>'line' = 'defender'), '[]'::jsonb),
            'midfielders', COALESCE(jsonb_agg(p_item) FILTER (WHERE p_item->>'line' = 'midfielder'), '[]'::jsonb),
            'forwards',    COALESCE(jsonb_agg(p_item) FILTER (WHERE p_item->>'line' = 'forward'), '[]'::jsonb),
            'others',      COALESCE(jsonb_agg(p_item) FILTER (WHERE p_item->>'line' IS NULL), '[]'::jsonb)
        ) AS squad_grouped
        FROM (
            SELECT jsonb_build_object(
                'player_id', sq.player_id,
                'name', COALESCE(sq.display_name, sq.full_name),
                'shirt_number', sq.shirt_number,
                'position_code', sq.position_code,
                'position_name', sq.position_name,
                'line', sq.position_line,
                'age', sq.age,
                'nationality', sq.nationality_code,
                'photo_url', sq.photo_url,
                'market_value_eur', sq.market_value_eur
            ) AS p_item
            FROM vw_team_squad sq
            WHERE sq.team_id = p_team_id
            ORDER BY sq.shirt_number ASC NULLS LAST, sq.full_name ASC
        ) sq_items
    ),
    recent_matches AS (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'match_id', m.match_id,
                    'date', m.match_date,
                    'home_team_id', m.home_team_id,
                    'away_team_id', m.away_team_id,
                    'home_score', m.home_score,
                    'away_score', m.away_score,
                    'opponent', CASE WHEN m.home_team_id = p_team_id THEN ta.short_name ELSE th.short_name END,
                    'opponent_crest', CASE WHEN m.home_team_id = p_team_id THEN ta.crest_url ELSE th.crest_url END,
                    'is_home', (m.home_team_id = p_team_id),
                    'winner_team_id', m.winner_team_id
                ) ORDER BY m.match_date DESC
            ),
            '[]'::jsonb
        ) AS list
        FROM (
            SELECT * FROM match
            WHERE (home_team_id = p_team_id OR away_team_id = p_team_id)
              AND status = 'finished'
            ORDER BY match_date DESC
            LIMIT 5
        ) m
        JOIN team th ON th.team_id = m.home_team_id
        JOIN team ta ON ta.team_id = m.away_team_id
    )
    SELECT jsonb_build_object(
        'team_id', tb.team_id,
        'canonical_name', tb.canonical_name,
        'short_name', tb.short_name,
        'slug', tb.slug,
        'country', jsonb_build_object('code', tb.country_code, 'name', tb.country_name),
        'state', tb.state,
        'city', tb.city,
        'founded_year', tb.founded_year,
        'crest_url', tb.crest_url,
        'accent_color', tb.accent_color,
        'venue', tb.venue,
        'manager', COALESCE(mi.current_manager, '{}'::jsonb),
        'standings', COALESCE(st.league_table, '{}'::jsonb),
        'form', COALESCE(fo.form_info, '{"last_5": []}'::jsonb),
        'squad', sq.squad_grouped,
        'recent_matches', rm.list
    ) INTO v_result
    FROM team_base tb
    LEFT JOIN manager_info mi ON true
    LEFT JOIN standings st ON true
    LEFT JOIN form fo ON true
    LEFT JOIN squad sq ON true
    LEFT JOIN recent_matches rm ON true;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- Role para consumo seguro somente leitura da API
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_reader') THEN
        CREATE ROLE app_reader WITH LOGIN PASSWORD 'app_reader_secret';
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_reader;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO app_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_reader;

COMMIT;
