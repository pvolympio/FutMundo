-- =============================================================================
-- futebol-db · esquema v1 (PostgreSQL 14+)
--
-- Núcleo: pessoa (base) -> jogador / treinador (papéis) -> vinculo (carreira)
--         equipe (clube ou seleção) · pais · posicao
-- Reservado para fases futuras: competicao, temporada (partidas e estatísticas)
--
-- Convenções
--   * Nomes em português, sem acento, snake_case.
--   * "equipe" em vez de "time": TIME é um tipo nativo do SQL e daria confusão.
--   * Datas com precisão: o Wikidata guarda "1998" como 1998-01-01 com precisão
--     de ano. Guardamos a precisão junto para não fingir que sabemos o dia.
--     Códigos: 9 = só o ano, 10 = ano e mês, 11 = dia completo.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- unaccent() não é IMMUTABLE, então não pode ser usada em índices.
-- Este invólucro resolve isso e permite busca sem acento e sem caixa.
CREATE OR REPLACE FUNCTION imm_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- -----------------------------------------------------------------------------
-- Tabelas de apoio
-- -----------------------------------------------------------------------------

CREATE TABLE pais (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wikidata_id  text UNIQUE,
    nome         text NOT NULL,
    codigo_iso2  char(2)
);
CREATE INDEX pais_iso2_idx ON pais (codigo_iso2);

CREATE TABLE posicao (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wikidata_id  text UNIQUE,
    nome         text NOT NULL
);

-- -----------------------------------------------------------------------------
-- Pessoas: uma linha por ser humano, seja jogador, treinador ou os dois
-- -----------------------------------------------------------------------------

CREATE TABLE pessoa (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wikidata_id          text NOT NULL UNIQUE,
    slug                 text NOT NULL UNIQUE,          -- para URLs: "neymar-q615"
    nome                 text NOT NULL,
    data_nascimento      date,
    precisao_nascimento  smallint CHECK (precisao_nascimento IN (9, 10, 11)),
    local_nascimento     text,
    data_falecimento     date,
    precisao_falecimento smallint CHECK (precisao_falecimento IN (9, 10, 11)),
    imagem_commons       text,                          -- nome do arquivo no Wikimedia Commons
    criado_em            timestamptz NOT NULL DEFAULT now(),
    atualizado_em        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pessoa_nascimento_ck  CHECK ((data_nascimento  IS NULL) = (precisao_nascimento  IS NULL)),
    CONSTRAINT pessoa_falecimento_ck CHECK ((data_falecimento IS NULL) = (precisao_falecimento IS NULL))
);
CREATE INDEX pessoa_nome_trgm_idx  ON pessoa USING gin (imm_unaccent(lower(nome)) gin_trgm_ops);
CREATE INDEX pessoa_nascimento_idx ON pessoa (data_nascimento);

CREATE TABLE jogador (
    pessoa_id    bigint PRIMARY KEY REFERENCES pessoa (id) ON DELETE CASCADE,
    altura_cm    smallint CHECK (altura_cm BETWEEN 120 AND 240),
    pe_preferido text CHECK (pe_preferido IN ('esquerdo', 'direito', 'ambidestro'))
);

-- Hoje só marca "esta pessoa é treinadora". Cresce depois (licenças, esquema
-- tático preferido, etc.) sem mexer na tabela pessoa.
CREATE TABLE treinador (
    pessoa_id    bigint PRIMARY KEY REFERENCES pessoa (id) ON DELETE CASCADE
);

CREATE TABLE jogador_posicao (
    pessoa_id    bigint  NOT NULL REFERENCES jogador (pessoa_id) ON DELETE CASCADE,
    posicao_id   integer NOT NULL REFERENCES posicao (id),
    PRIMARY KEY (pessoa_id, posicao_id)
);

CREATE TABLE pessoa_pais (            -- nacionalidades (uma pessoa pode ter várias)
    pessoa_id    bigint  NOT NULL REFERENCES pessoa (id) ON DELETE CASCADE,
    pais_id      integer NOT NULL REFERENCES pais (id),
    PRIMARY KEY (pessoa_id, pais_id)
);
CREATE INDEX pessoa_pais_pais_idx ON pessoa_pais (pais_id);

-- -----------------------------------------------------------------------------
-- Equipes: clubes e seleções
-- -----------------------------------------------------------------------------

CREATE TABLE equipe (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wikidata_id     text NOT NULL UNIQUE,
    slug            text NOT NULL UNIQUE,
    nome            text NOT NULL,
    nome_curto      text,
    tipo            text NOT NULL DEFAULT 'clube' CHECK (tipo IN ('clube', 'selecao', 'outro')),
    pais_id         integer REFERENCES pais (id),
    ano_fundacao    smallint,
    estadio         text,
    escudo_commons  text,
    criado_em       timestamptz NOT NULL DEFAULT now(),
    atualizado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX equipe_nome_trgm_idx ON equipe USING gin (imm_unaccent(lower(nome)) gin_trgm_ops);
CREATE INDEX equipe_pais_idx      ON equipe (pais_id);

-- -----------------------------------------------------------------------------
-- Vínculo: liga uma pessoa a uma equipe por um período, numa função.
-- É a tabela que guarda a carreira. Não existe "time atual" dentro de jogador.
-- -----------------------------------------------------------------------------

CREATE TABLE vinculo (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id        bigint NOT NULL REFERENCES pessoa (id) ON DELETE CASCADE,
    equipe_id        bigint NOT NULL REFERENCES equipe (id),
    funcao           text   NOT NULL CHECK (funcao IN ('jogador', 'treinador', 'auxiliar')),
    data_inicio      date,
    precisao_inicio  smallint CHECK (precisao_inicio IN (9, 10, 11)),
    data_fim         date,                               -- NULL = sem data de saída registrada
    precisao_fim     smallint CHECK (precisao_fim IN (9, 10, 11)),
    numero_camisa    smallint CHECK (numero_camisa BETWEEN 0 AND 999),
    jogos            integer  CHECK (jogos >= 0),
    gols             integer  CHECK (gols >= 0),
    situacao         text     CHECK (situacao IN ('contrato', 'emprestimo', 'base', 'interino')),
    fonte            text NOT NULL DEFAULT 'wikidata',
    fonte_id         text NOT NULL,                      -- id da declaração na fonte
    criado_em        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vinculo_fonte_uq   UNIQUE (fonte, fonte_id),
    CONSTRAINT vinculo_inicio_ck  CHECK ((data_inicio IS NULL) = (precisao_inicio IS NULL)),
    CONSTRAINT vinculo_fim_ck     CHECK ((data_fim    IS NULL) = (precisao_fim    IS NULL)),
    CONSTRAINT vinculo_periodo_ck CHECK (data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio)
);
CREATE INDEX vinculo_pessoa_idx  ON vinculo (pessoa_id, data_inicio);
CREATE INDEX vinculo_equipe_idx  ON vinculo (equipe_id, funcao, data_inicio);

-- -----------------------------------------------------------------------------
-- Reservadas para a fase de partidas e estatísticas (ainda sem carga)
-- -----------------------------------------------------------------------------

CREATE TABLE competicao (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wikidata_id  text UNIQUE,
    nome         text NOT NULL,
    pais_id      integer REFERENCES pais (id)
);

CREATE TABLE temporada (
    id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    competicao_id  integer NOT NULL REFERENCES competicao (id) ON DELETE CASCADE,
    rotulo         text NOT NULL,                        -- "2025", "2024/25"
    ano_inicio     smallint,
    ano_fim        smallint,
    UNIQUE (competicao_id, rotulo)
);

-- -----------------------------------------------------------------------------
-- Rastreabilidade
-- -----------------------------------------------------------------------------

-- Ids de outras fontes (StatsBomb, API-Football...) para a mesma entidade.
-- O id do Wikidata já mora na própria tabela; esta serve para as demais fontes.
CREATE TABLE identificador_externo (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entidade    text   NOT NULL CHECK (entidade IN ('pessoa', 'equipe', 'pais', 'competicao')),
    entidade_id bigint NOT NULL,
    fonte       text   NOT NULL,
    id_externo  text   NOT NULL,
    UNIQUE (entidade, fonte, id_externo)
);
CREATE INDEX identificador_externo_entidade_idx ON identificador_externo (entidade, entidade_id);

-- Um registro por execução do pipeline.
CREATE TABLE carga_ingestao (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fonte           text NOT NULL,
    escopo          text NOT NULL,
    iniciado_em     timestamptz NOT NULL DEFAULT now(),
    finalizado_em   timestamptz,
    pessoas         integer NOT NULL DEFAULT 0,
    equipes         integer NOT NULL DEFAULT 0,
    vinculos        integer NOT NULL DEFAULT 0,
    lotes_com_erro  integer NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- Views e funções de consulta (a API vai ler daqui)
-- -----------------------------------------------------------------------------

CREATE VIEW vw_jogador AS
SELECT p.id, p.slug, p.nome, p.data_nascimento, p.precisao_nascimento,
       p.local_nascimento, p.data_falecimento, p.imagem_commons,
       j.altura_cm, j.pe_preferido,
       (SELECT array_agg(pa.nome ORDER BY pa.nome)
          FROM pessoa_pais pp JOIN pais pa ON pa.id = pp.pais_id
         WHERE pp.pessoa_id = p.id) AS nacionalidades,
       (SELECT array_agg(po.nome ORDER BY po.nome)
          FROM jogador_posicao jp JOIN posicao po ON po.id = jp.posicao_id
         WHERE jp.pessoa_id = p.id) AS posicoes
  FROM pessoa p
  JOIN jogador j ON j.pessoa_id = p.id;

CREATE VIEW vw_treinador AS
SELECT p.id, p.slug, p.nome, p.data_nascimento, p.precisao_nascimento,
       p.local_nascimento, p.data_falecimento, p.imagem_commons,
       (SELECT array_agg(pa.nome ORDER BY pa.nome)
          FROM pessoa_pais pp JOIN pais pa ON pa.id = pp.pais_id
         WHERE pp.pessoa_id = p.id) AS nacionalidades
  FROM pessoa p
  JOIN treinador t ON t.pessoa_id = p.id;

CREATE VIEW vw_carreira AS
SELECT v.id AS vinculo_id, v.pessoa_id, p.nome AS pessoa, p.slug AS pessoa_slug,
       v.funcao, e.id AS equipe_id, e.nome AS equipe, e.slug AS equipe_slug,
       e.tipo AS tipo_equipe, v.data_inicio, v.precisao_inicio,
       v.data_fim, v.precisao_fim, v.numero_camisa, v.jogos, v.gols
  FROM vinculo v
  JOIN pessoa p ON p.id = v.pessoa_id
  JOIN equipe e ON e.id = v.equipe_id;

-- Busca tolerante a acento, caixa e pequenos erros de digitação.
CREATE OR REPLACE FUNCTION buscar_pessoas(termo text, limite integer DEFAULT 20)
RETURNS TABLE (id bigint, slug text, nome text, similaridade real)
LANGUAGE sql STABLE
AS $$
    SELECT p.id, p.slug, p.nome,
           similarity(imm_unaccent(lower(p.nome)), imm_unaccent(lower(termo)))
      FROM pessoa p
     WHERE imm_unaccent(lower(p.nome)) LIKE '%' || imm_unaccent(lower(termo)) || '%'
        OR imm_unaccent(lower(p.nome)) % imm_unaccent(lower(termo))
     ORDER BY 4 DESC, p.nome
     LIMIT limite
$$;

CREATE OR REPLACE FUNCTION buscar_equipes(termo text, limite integer DEFAULT 20)
RETURNS TABLE (id bigint, slug text, nome text, similaridade real)
LANGUAGE sql STABLE
AS $$
    SELECT e.id, e.slug, e.nome,
           similarity(imm_unaccent(lower(e.nome)), imm_unaccent(lower(termo)))
      FROM equipe e
     WHERE imm_unaccent(lower(e.nome)) LIKE '%' || imm_unaccent(lower(termo)) || '%'
        OR imm_unaccent(lower(e.nome)) % imm_unaccent(lower(termo))
     ORDER BY 4 DESC, e.nome
     LIMIT limite
$$;
