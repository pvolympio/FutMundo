#!/usr/bin/env python3
"""
ingest_epl.py — Ingestão da Premier League (soccerdata -> PostgreSQL, schema v3.0)

Fontes (nesta ordem): FBref, Football-Data.co.uk, Understat, ClubElo.
Cada fonte roda em transação própria e é registrada em ingestion_sync_log.
Se uma fonte falhar (ex.: FBref bloqueado), as demais continuam.

Uso:
    export DATABASE_URL="postgresql://user:pass@localhost:5432/futebol"
    pip install "soccerdata>=1.9" "psycopg[binary]>=3.1" pandas numpy
    python ingest_epl.py --seasons 2425 2526 2627
    python ingest_epl.py --seasons 2526 --sources football_data understat

Temporadas usam o formato de 4 dígitos do soccerdata ("2425" = 2024/25).
O script é idempotente: pode rodar de novo sem duplicar dados.

FBref: a versão 1.9 usa selenium para passar pelo Cloudflare, então é preciso ter
Chrome/Chromium instalado. Respeite o rate limit e os termos do site; não rode
em CI. Toda resposta fica em cache local (~/soccerdata).
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import os
import re
import sys
import unicodedata
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
import psycopg
from psycopg.types.json import Jsonb

log = logging.getLogger("ingest_epl")

LEAGUE = "ENG-Premier League"
COMP_NAME = "Premier League"
COMP_SLUG = "premier-league"
COUNTRY = "ENG"

# Fuso dos horários "ingênuos" de cada fonte. CONFIRME comparando um jogo conhecido:
# se o kickoff sair 1h deslocado no verão, ajuste aqui.
SOURCE_TZ = {"understat": "UTC", "fbref": "Europe/London", "football_data_co_uk": "Europe/London"}

PLACEHOLDER_US = 1  # microssegundo que marca "só temos a data" (meio-dia UTC + 1µs)

FBREF_TEAM_STATS = ["standard", "keeper", "shooting", "playing_time", "misc"]
FBREF_PLAYER_STATS = ["standard", "keeper", "shooting", "playing_time", "misc"]

FIFA_TO_ISO = {
    "NED": "NLD", "GER": "DEU", "POR": "PRT", "SUI": "CHE", "CRO": "HRV",
    "DEN": "DNK", "URU": "URY", "PAR": "PRY", "CHI": "CHL", "RSA": "ZAF",
    "ALG": "DZA", "ANG": "AGO", "BUL": "BGR", "CZE": "CZE", "GRE": "GRC"
}

SOURCE_PRIORITY = {"understat": 1, "fbref": 2, "football_data_co_uk": 3}  # p/ stat_type 'standard'

# ----------------------------------------------------------------------------
# Clubes: canônico -> (nome curto, variações vistas nas fontes)
# ----------------------------------------------------------------------------
TEAMS = {
    "Arsenal": ("Arsenal", []),
    "Aston Villa": ("Aston Villa", []),
    "Bournemouth": ("Bournemouth", ["AFC Bournemouth"]),
    "Brentford": ("Brentford", []),
    "Brighton & Hove Albion": ("Brighton", ["Brighton", "Brighton and Hove Albion"]),
    "Burnley": ("Burnley", []),
    "Cardiff City": ("Cardiff", ["Cardiff"]),
    "Chelsea": ("Chelsea", []),
    "Crystal Palace": ("Crystal Palace", []),
    "Everton": ("Everton", []),
    "Fulham": ("Fulham", []),
    "Huddersfield Town": ("Huddersfield", ["Huddersfield"]),
    "Hull City": ("Hull", ["Hull"]),
    "Ipswich Town": ("Ipswich", ["Ipswich"]),
    "Leeds United": ("Leeds", ["Leeds", "Leeds Utd"]),
    "Leicester City": ("Leicester", ["Leicester"]),
    "Liverpool": ("Liverpool", []),
    "Luton Town": ("Luton", ["Luton"]),
    "Manchester City": ("Man City", ["Man City", "Man. City"]),
    "Manchester United": ("Man United", ["Man United", "Man Utd", "Manchester Utd"]),
    "Middlesbrough": ("Middlesbrough", ["Middlesbrough"]),
    "Newcastle United": ("Newcastle", ["Newcastle", "Newcastle Utd"]),
    "Norwich City": ("Norwich", ["Norwich"]),
    "Nottingham Forest": ("Nott'm Forest", ["Nott'm Forest", "Nott'ham Forest", "Nottm Forest", "Forest", "Nottingham"]),
    "Sheffield United": ("Sheffield Utd", ["Sheffield Utd"]),
    "Southampton": ("Southampton", []),
    "Stoke City": ("Stoke", ["Stoke"]),
    "Sunderland": ("Sunderland", []),
    "Swansea City": ("Swansea", ["Swansea"]),
    "Tottenham Hotspur": ("Tottenham", ["Tottenham", "Spurs"]),
    "Watford": ("Watford", []),
    "West Bromwich Albion": ("West Brom", ["West Brom", "West Bromwich", "WBA"]),
    "West Ham United": ("West Ham", ["West Ham"]),
    "Wolverhampton Wanderers": ("Wolves", ["Wolves", "Wolverhampton"]),
}

# Posições do Understat -> dim_position
UNDERSTAT_POS = {
    "GK": "GK", "DC": "CB", "DL": "LB", "DR": "RB", "DMC": "DM", "DML": "DM", "DMR": "DM",
    "MC": "CM", "ML": "LW", "MR": "RW", "AMC": "AM", "AML": "LW", "AMR": "RW",
    "FW": "CF", "FWL": "LW", "FWR": "RW",
}

ODDS_BOOKS = {
    "B365": "bet365", "BW": "bwin", "IW": "interwetten", "PS": "pinnacle", "WH": "williamhill",
    "VC": "vcbet", "Max": "market_max", "Avg": "market_avg",
    "B365C": "bet365_closing", "PSC": "pinnacle_closing", "MaxC": "market_max_closing",
    "AvgC": "market_avg_closing",
}

SHOT_RESULT = {"Goal": "goal", "SavedShot": "saved", "BlockedShot": "blocked",
               "MissedShots": "off_target", "ShotOnPost": "post", "OwnGoal": "goal"}
BODY_PART = {"Right Foot": "right_foot", "Left Foot": "left_foot", "Head": "head"}

FBREF_PROMOTE = {  # colunas achatadas do FBref -> chaves usadas nas views do schema
    "performance_gls": "goals", "performance_ast": "assists", "playing_time_min": "minutes",
    "expected_xg": "xg", "expected_xag": "xa",
}


# ----------------------------------------------------------------------------
# Utilitários
# ----------------------------------------------------------------------------
def norm(txt) -> str:
    s = unicodedata.normalize("NFKD", str(txt or "")).encode("ascii", "ignore").decode()
    s = s.lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


ALIAS2CANON = {norm(a): canon for canon, (_, al) in TEAMS.items() for a in [canon, *al]}


def py(v):
    """Converte para tipos Python/JSON-safe recursivamente; NaN/NaT/None -> None."""
    if v is None:
        return None
    if isinstance(v, dict):
        return {k: py(val) for k, val in v.items() if py(val) is not None}
    if isinstance(v, (list, tuple)):
        return [py(item) for item in v]
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.floating):
        v = float(v)
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, (pd.Timestamp, datetime, date)):
        return v.isoformat()
    if isinstance(v, np.bool_):
        return bool(v)
    return v


def clean(d: dict) -> dict:
    return {k: py(v) for k, v in d.items() if py(v) is not None}


def ext(x) -> str:
    """ID externo como texto estável (1234.0 -> '1234')."""
    try:
        f = float(x)
        if f.is_integer():
            return str(int(f))
    except (TypeError, ValueError):
        pass
    return str(x)


def to_int(v):
    v = py(v)
    if v is None:
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def to_float(v):
    v = py(v)
    if v is None:
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def flatten_cols(df: pd.DataFrame) -> pd.DataFrame:
    out, seen = [], {}
    for c in df.columns:
        parts = c if isinstance(c, tuple) else (c,)
        parts = [str(p) for p in parts if p not in ("", None) and not str(p).startswith("Unnamed")]
        name = re.sub(r"[^a-z0-9]+", "_", "_".join(parts).lower()).strip("_") or "col"
        seen[name] = seen.get(name, 0) + 1
        out.append(name if seen[name] == 1 else f"{name}_{seen[name]}")
    df = df.copy()
    df.columns = out
    return df


def require_cols(df: pd.DataFrame, cols, label: str):
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise KeyError(f"{label}: colunas ausentes {missing}. Colunas recebidas: {list(df.columns)[:40]}")


def to_utc(value, tz: str, has_time: bool = True):
    """Timestamp ingênuo da fonte -> datetime UTC. Sem hora: meio-dia UTC + 1µs (placeholder)."""
    if value is None or pd.isna(value):
        return None
    ts = pd.Timestamp(value)
    if not has_time:
        ts = ts.normalize() + pd.Timedelta(hours=12, microseconds=PLACEHOLDER_US)
        return ts.tz_localize("UTC").to_pydatetime() if ts.tzinfo is None else ts.tz_convert("UTC").to_pydatetime()
    if ts.tzinfo is None:
        ts = ts.tz_localize(tz, ambiguous=True, nonexistent="shift_forward")
    return ts.tz_convert("UTC").to_pydatetime()


def is_placeholder(dt: datetime | None) -> bool:
    if dt is None:
        return False
    u = dt.astimezone(timezone.utc)
    return u.hour == 12 and u.minute == 0 and u.second == 0 and u.microsecond == PLACEHOLDER_US


def season_info(code: str):
    y0 = 2000 + int(code[:2])
    y1 = 2000 + int(code[2:])
    return f"{y0}-{code[2:]}", date(y0, 8, 1), date(y1, 7, 31)


# ----------------------------------------------------------------------------
# Banco de dados
# ----------------------------------------------------------------------------
class DB:
    def __init__(self, dsn: str):
        self.conn = psycopg.connect(dsn)
        self.logconn = psycopg.connect(dsn, autocommit=True)  # log sobrevive a rollbacks
        with self.conn.cursor() as cur:
            cur.execute("SELECT code, source_id FROM dim_source")
            self.sources = dict(cur.fetchall())
            cur.execute("SELECT country_code FROM country")
            self.valid_countries = set(r[0].strip() for r in cur.fetchall())
        self.team_cache, self.player_cache, self.ref_cache, self.venue_cache = {}, {}, {}, {}
        self.failures: list[str] = []


@contextmanager
def sync_job(db: DB, source: str, job: str):
    """Transação por (fonte, temporada) + linha em ingestion_sync_log."""
    with db.logconn.cursor() as c:
        c.execute("INSERT INTO ingestion_sync_log (source_id, job_name, status) VALUES (%s,%s,'running') "
                  "RETURNING sync_id", (db.sources[source], job))
        sync_id = c.fetchone()[0]
    stats = {"ingested": 0, "processed": 0}
    status, err = "success", None
    try:
        yield stats
        db.conn.commit()
    except Exception as e:  # noqa: BLE001 - queremos seguir para a próxima fonte
        db.conn.rollback()
        db.team_cache.clear(); db.player_cache.clear(); db.ref_cache.clear(); db.venue_cache.clear()
        status, err = "failed", f"{type(e).__name__}: {e}"[:1500]
        log.error("FALHA em %s: %s", job, err)
        db.failures.append(job)
    finally:
        with db.logconn.cursor() as c:
            c.execute("UPDATE ingestion_sync_log SET status=%s, records_ingested=%s, records_processed=%s, "
                      "error_message=%s, finished_at=now() WHERE sync_id=%s",
                      (status, stats["ingested"], stats["processed"], err, sync_id))


def stage(db: DB, cur, source: str, entity: str, items):
    """Grava o payload cru em staging_raw (dedupe por hash)."""
    items = list(items)
    if not items:
        return
    sid = db.sources[source]
    cur.executemany(
        "INSERT INTO staging_raw (source_id, entity_type, native_id, payload, processed_at) "
        "VALUES (%s,%s,%s,%s, now()) ON CONFLICT DO NOTHING",
        [(sid, entity, str(n), Jsonb(clean(p))) for n, p in items])


def seed_reference(db: DB, cur, seasons: list[str]):
    cur.execute("""INSERT INTO competition (canonical_name, slug, country_code, tier, competition_type)
                   VALUES (%s,%s,%s,1,'league')
                   ON CONFLICT (canonical_name, country_code) DO UPDATE SET tier = EXCLUDED.tier
                   RETURNING competition_id""", (COMP_NAME, COMP_SLUG, COUNTRY))
    comp_id = cur.fetchone()[0]
    for code in db.sources:
        cur.execute("INSERT INTO competition_external_id (source_id, external_id, competition_id) VALUES (%s,%s,%s) "
                    "ON CONFLICT DO NOTHING", (db.sources[code], LEAGUE, comp_id))
    season_ids = {}
    for sc in seasons:
        name, start, end = season_info(sc)
        cur.execute("""INSERT INTO season (competition_id, name, start_date, end_date)
                       VALUES (%s,%s,%s,%s)
                       ON CONFLICT (competition_id, name) DO UPDATE SET start_date=EXCLUDED.start_date,
                                                                        end_date=EXCLUDED.end_date
                       RETURNING season_id""", (comp_id, name, start, end))
        season_ids[sc] = cur.fetchone()[0]
    cur.execute("UPDATE season SET is_current = (start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE) "
                "WHERE competition_id=%s", (comp_id,))
    for stat_source, prio in SOURCE_PRIORITY.items():
        cur.execute("INSERT INTO stat_source_priority (stat_type, source_id, priority) VALUES ('standard',%s,%s) "
                    "ON CONFLICT DO NOTHING", (db.sources[stat_source], prio))
    for txt, code in UNDERSTAT_POS.items():
        cur.execute("INSERT INTO position_alias (source_id, source_position_text, position_code) VALUES (%s,%s,%s) "
                    "ON CONFLICT DO NOTHING", (db.sources["understat"], txt, code))
    return comp_id, season_ids


# ----------------------------------------------------------------------------
# Resolução de identidades
# ----------------------------------------------------------------------------
def resolve_team(db: DB, cur, source: str, ext_id, raw_name: str) -> int:
    key = (source, ext(ext_id))
    if key in db.team_cache:
        return db.team_cache[key]
    canon = ALIAS2CANON.get(norm(raw_name))
    short = TEAMS[canon][0] if canon else None
    confidence = 1.0
    if canon is None:
        cur.execute("SELECT canonical_name, similarity(normalized_name, normalize_name(%s)) AS s FROM team "
                    "WHERE country_code=%s ORDER BY s DESC LIMIT 1", (raw_name, COUNTRY))
        row = cur.fetchone()
        if row and row[1] >= 0.6:
            canon, confidence = row[0], float(row[1])
        else:
            canon, confidence = str(raw_name).strip(), 0.5
            log.warning("Clube desconhecido '%s' (%s): criado como novo. Adicione ao dicionário TEAMS.",
                        raw_name, source)
    cur.execute("SELECT get_or_create_team(%s,%s,%s,%s,%s::numeric,%s,%s)",
                (source, ext(ext_id), canon, COUNTRY, confidence, "ingest_epl", short))
    team_id = cur.fetchone()[0]
    if norm(raw_name) != norm(canon):
        cur.execute("INSERT INTO team_alias (team_id, alias, source_id) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                    (team_id, str(raw_name), db.sources[source]))
    db.team_cache[key] = team_id
    return team_id


def resolve_player(db: DB, cur, source: str, ext_id, name: str, team_id=None, season_id=None,
                   payload=None, nationality=None, birth_date=None) -> int:
    """Crosswalk -> match aproximado no elenco/temporada -> match direto alta confiança -> get_or_create_player."""
    key = (source, ext(ext_id))
    if key in db.player_cache:
        return db.player_cache[key]
    sid = db.sources[source]
    cur.execute("SELECT player_id FROM player_external_id WHERE source_id=%s AND external_id=%s", (sid, ext(ext_id)))
    row = cur.fetchone()
    pid = row[0] if row else None
    if pid is None and season_id is not None:
        tiers = []
        if team_id is not None:
            tiers.append(("team", 0.55))
        tiers.append(("season", 0.72))
        for scope, threshold in tiers:
            sql = ("""
                WITH candidates AS (
                    SELECT pss.player_id, pss.team_id
                    FROM player_season_stats pss
                    WHERE pss.season_id = %s AND pss.source_id <> %s
                    UNION
                    SELECT pa.player_id, pa.team_id
                    FROM player_appearance pa
                    JOIN match m ON m.match_id = pa.match_id
                    WHERE m.season_id = %s AND pa.source_id <> %s
                )
                SELECT p.player_id, similarity(p.normalized_name, normalize_name(%s)) AS s
                FROM candidates c
                JOIN player p ON p.player_id = c.player_id
            """)
            args = [season_id, sid, season_id, sid, name]
            if scope == "team":
                sql += " WHERE c.team_id = %s"
                args.append(team_id)
            cur.execute(sql + " ORDER BY s DESC LIMIT 1", args)
            cand = cur.fetchone()
            if cand and cand[1] >= threshold:
                pid = cand[0]
                cur.execute("INSERT INTO player_external_id (source_id, external_id, player_id, match_confidence, "
                            "matched_by) VALUES (%s,%s,%s,%s::numeric,%s) ON CONFLICT DO NOTHING",
                            (sid, ext(ext_id), pid, float(cand[1]), f"trgm_{scope}_season"))
                cur.execute("INSERT INTO player_alias (player_id, alias, source_id) VALUES (%s,%s,%s) "
                            "ON CONFLICT DO NOTHING", (pid, name, sid))
                break
            if cand and 0.35 <= cand[1] < threshold and scope == "team":
                cur.execute("INSERT INTO entity_match_review (entity_type, source_id, external_id, raw_payload, "
                            "candidate_entity_id, score) VALUES ('player',%s,%s,%s,%s,%s::numeric)",
                            (sid, ext(ext_id), Jsonb(clean(payload or {"name": name})), cand[0], float(cand[1])))

    # Fallback: atleta já existente na tabela global com altíssima similaridade (>= 0.85)
    if pid is None:
        cur.execute("SELECT player_id, similarity(normalized_name, normalize_name(%s)) AS s "
                    "FROM player WHERE similarity(normalized_name, normalize_name(%s)) >= 0.85 "
                    "ORDER BY s DESC LIMIT 1", (name, name))
        cand = cur.fetchone()
        if cand:
            pid = cand[0]
            cur.execute("INSERT INTO player_external_id (source_id, external_id, player_id, match_confidence, "
                        "matched_by) VALUES (%s,%s,%s,%s::numeric,'trgm_player_direct') ON CONFLICT DO NOTHING",
                        (sid, ext(ext_id), pid, float(cand[1])))
            cur.execute("INSERT INTO player_alias (player_id, alias, source_id) VALUES (%s,%s,%s) "
                        "ON CONFLICT DO NOTHING", (pid, name, sid))

    if pid is None:
        cur.execute("SELECT get_or_create_player(%s,%s,%s,%s,%s,%s::numeric,%s,%s,%s)",
                    (source, ext(ext_id), name, birth_date, nationality, 1.0, "ingest_epl", name,
                     Jsonb(clean(payload or {"name": name}))))
        pid = cur.fetchone()[0]
    db.player_cache[key] = pid
    return pid


def get_or_create_referee(db: DB, cur, source: str, name) -> int | None:
    name = py(name)
    if not name:
        return None
    key = norm(name)
    if key in db.ref_cache:
        return db.ref_cache[key]
    sid = db.sources[source]
    cur.execute("SELECT referee_id FROM referee_external_id WHERE source_id=%s AND external_id=%s", (sid, key))
    row = cur.fetchone()
    if row is None:
        cur.execute("SELECT referee_id FROM referee WHERE normalized_name = normalize_name(%s) LIMIT 1", (name,))
        row = cur.fetchone()
        if row is None:
            cur.execute("INSERT INTO referee (full_name) VALUES (%s) RETURNING referee_id", (name,))
            row = cur.fetchone()
        cur.execute("INSERT INTO referee_external_id (source_id, external_id, referee_id, matched_by) "
                    "VALUES (%s,%s,%s,'ingest_epl') ON CONFLICT DO NOTHING", (sid, key, row[0]))
    db.ref_cache[key] = row[0]
    return row[0]


def get_or_create_venue(db: DB, cur, name) -> int | None:
    name = py(name)
    if not name:
        return None
    if name in db.venue_cache:
        return db.venue_cache[name]
    cur.execute("SELECT venue_id FROM venue WHERE name=%s AND country_code=%s LIMIT 1", (name, COUNTRY))
    row = cur.fetchone()
    if row is None:
        cur.execute("INSERT INTO venue (name, country_code) VALUES (%s,%s) RETURNING venue_id", (name, COUNTRY))
        row = cur.fetchone()
    db.venue_cache[name] = row[0]
    return row[0]


# ----------------------------------------------------------------------------
# Partidas
# ----------------------------------------------------------------------------
def upsert_match(cur, comp_id, season_id, home, away, *, when=None, has_time=False, matchday=None,
                 hs=None, as_=None, venue_id=None, referee_id=None) -> int:
    """Na liga, (temporada, mandante, visitante) é único -> serve de chave natural entre fontes."""
    cur.execute("SELECT match_id, match_date FROM match WHERE season_id=%s AND home_team_id=%s AND away_team_id=%s",
                (season_id, home, away))
    row = cur.fetchone()
    scored = hs is not None and as_ is not None
    winner = None if (not scored or hs == as_) else (home if hs > as_ else away)
    if row is None:
        cur.execute(
            "INSERT INTO match (competition_id, season_id, matchday, home_team_id, away_team_id, match_date, "
            "venue_id, referee_id, home_score, away_score, winner_team_id, status) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING match_id",
            (comp_id, season_id, matchday, home, away, when, venue_id, referee_id,
             hs if scored else None, as_ if scored else None, winner, "finished" if scored else "scheduled"))
        return cur.fetchone()[0]
    mid, old = row
    sets, vals = [], []
    if scored:
        sets += ["home_score=%s", "away_score=%s", "winner_team_id=%s", "status='finished'"]
        vals += [hs, as_, winner]
    if matchday is not None:
        sets.append("matchday = COALESCE(matchday, %s)"); vals.append(matchday)
    if venue_id is not None:
        sets.append("venue_id = COALESCE(venue_id, %s)"); vals.append(venue_id)
    if referee_id is not None:
        sets.append("referee_id = COALESCE(referee_id, %s)"); vals.append(referee_id)
    if when is not None and (old is None or (has_time and is_placeholder(old))):
        sets.append("match_date=%s"); vals.append(when)
    if sets:
        cur.execute(f"UPDATE match SET {', '.join(sets)} WHERE match_id=%s", (*vals, mid))
    return mid


def link_match(db: DB, cur, source: str, external_id, match_id: int):
    cur.execute("INSERT INTO match_external_id (source_id, external_id, match_id) VALUES (%s,%s,%s) "
                "ON CONFLICT (source_id, external_id) DO NOTHING", (db.sources[source], ext(external_id), match_id))


def fill_matchdays(cur, season_id: int):
    """Rodada = nº de jogos do time até a data (aprox.; adiados podem distorcer)."""
    cur.execute("""
        WITH x AS (
            SELECT match_id, team_id,
                   row_number() OVER (PARTITION BY team_id ORDER BY match_date, match_id) AS rn
            FROM (SELECT match_id, home_team_id AS team_id, match_date FROM match WHERE season_id=%(s)s
                  UNION ALL
                  SELECT match_id, away_team_id, match_date FROM match WHERE season_id=%(s)s) u),
        md AS (SELECT match_id, max(rn) AS rn FROM x GROUP BY match_id)
        UPDATE match m SET matchday = md.rn FROM md
        WHERE m.match_id = md.match_id AND m.matchday IS NULL AND m.season_id = %(s)s""", {"s": season_id})


# ----------------------------------------------------------------------------
# Fetchers (soccerdata) — isolados para facilitar teste e troca de fonte
# ----------------------------------------------------------------------------
def fetch_football_data(code):
    import soccerdata as sd
    return sd.MatchHistory(LEAGUE, code).read_games().reset_index()


def fetch_understat(code):
    import soccerdata as sd
    us = sd.Understat(LEAGUE, code)
    return (us.read_schedule().reset_index(), us.read_player_match_stats().reset_index(),
            us.read_shot_events().reset_index())


def fetch_fbref_schedule(code):
    import soccerdata as sd
    return sd.FBref(LEAGUE, code).read_schedule().reset_index()


def fetch_fbref_team_stats(code, stat_type):
    import soccerdata as sd
    return sd.FBref(LEAGUE, code).read_team_season_stats(stat_type=stat_type).reset_index()


def fetch_fbref_player_stats(code, stat_type):
    import soccerdata as sd
    return sd.FBref(LEAGUE, code).read_player_season_stats(stat_type=stat_type).reset_index()


def fetch_clubelo(day: date):
    import soccerdata as sd
    return sd.ClubElo().read_by_date(day.isoformat()).reset_index()


# ----------------------------------------------------------------------------
# FBref
# ----------------------------------------------------------------------------
def process_fbref_schedule(db, cur, comp_id, season_id, df, stats):
    require_cols(df, ["home_team", "away_team", "date", "game_id"], "FBref schedule")
    stage(db, cur, "fbref", "match", ((r["game_id"], r) for r in df.to_dict("records") if py(r.get("game_id"))))
    for r in df.to_dict("records"):
        if not py(r.get("home_team")) or not py(r.get("away_team")) or not py(r.get("game_id")):
            continue  # linhas de "fim de rodada"
        home = resolve_team(db, cur, "fbref", r["home_team"], r["home_team"])
        away = resolve_team(db, cur, "fbref", r["away_team"], r["away_team"])
        d, t = py(r.get("date")), py(r.get("time"))
        has_time = isinstance(t, str) and re.match(r"^\d{1,2}:\d{2}", t) is not None
        when = None
        if d is not None:
            ts = pd.Timestamp(d).normalize()
            if has_time:
                h, m = (int(x) for x in t[:5].split(":"))
                ts += pd.Timedelta(hours=h, minutes=m)
            when = to_utc(ts, SOURCE_TZ["fbref"], has_time)
        hs = as_ = None
        m = re.match(r"\s*(\d+)\D+(\d+)", str(py(r.get("score")) or ""))
        if m:
            hs, as_ = int(m.group(1)), int(m.group(2))
        wk = re.search(r"(\d+)", str(py(r.get("week")) or ""))
        venue_id = get_or_create_venue(db, cur, r.get("venue"))
        ref_id = get_or_create_referee(db, cur, "fbref", r.get("referee"))
        mid = upsert_match(cur, comp_id, season_id, home, away, when=when, has_time=has_time,
                           matchday=int(wk.group(1)) if wk else None, hs=hs, as_=as_,
                           venue_id=venue_id, referee_id=ref_id)
        link_match(db, cur, "fbref", r["game_id"], mid)
        if venue_id:
            cur.execute("UPDATE team SET venue_id = COALESCE(venue_id, %s) WHERE team_id=%s", (venue_id, home))
        if ref_id:
            cur.execute("SELECT 1 FROM match_official WHERE match_id=%s AND role='main_referee'", (mid,))
            if not cur.fetchone():
                cur.execute("INSERT INTO match_official (match_id, referee_id, role) VALUES (%s,%s,'main_referee') "
                            "ON CONFLICT DO NOTHING", (mid, ref_id))
        if hs is not None:
            for tid, gf, xg in ((home, hs, r.get("home_xg")), (away, as_, r.get("away_xg"))):
                cur.execute("SELECT insert_team_match_stat(%s,%s,'fbref','standard',%s)",
                            (mid, tid, Jsonb(clean({"goals": gf, "xg": to_float(xg)}))))
        stats["processed"] += 1
    stats["ingested"] += len(df)


def _fbref_promote(d: dict, stat_type: str) -> dict:
    if stat_type == "standard":
        for src, dst in FBREF_PROMOTE.items():
            if src in d:
                d[dst] = d[src]
    return d


def process_fbref_team_stats(db, cur, comp_id, season_id, stat_type, df, stats):
    df = flatten_cols(df)
    require_cols(df, ["team"], f"FBref team stats '{stat_type}'")
    stage(db, cur, "fbref", "team_stat", ((f"{season_id}:{stat_type}:{r['team']}", r) for r in df.to_dict("records")))
    for r in df.to_dict("records"):
        team_id = resolve_team(db, cur, "fbref", r["team"], r["team"])
        payload = _fbref_promote(clean({k: v for k, v in r.items() if k not in ("league", "season")}), stat_type)
        cur.execute("""INSERT INTO team_season_stats (team_id, competition_id, season_id, source_id, stat_type, stats)
                       VALUES (%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (team_id, competition_id, season_id, source_id, stat_type)
                       DO UPDATE SET stats=EXCLUDED.stats, ingested_at=now()""",
                    (team_id, comp_id, season_id, db.sources["fbref"], stat_type, Jsonb(payload)))
        stats["processed"] += 1
    stats["ingested"] += len(df)


def process_fbref_player_stats(db, cur, comp_id, season_id, stat_type, df, stats):
    df = flatten_cols(df)
    require_cols(df, ["team", "player"], f"FBref player stats '{stat_type}'")
    stage(db, cur, "fbref", "player_stat",
          ((f"{season_id}:{stat_type}:{r['team']}:{r['player']}", r) for r in df.to_dict("records")))
    for r in df.to_dict("records"):
        born = to_int(r.get("born"))
        ext_id = f"{norm(r['player'])}|{born or ''}"
        team_id = resolve_team(db, cur, "fbref", r["team"], r["team"])
        raw_nation = py(r.get("nation"))
        nation_code = None
        if raw_nation:
            m_nat = re.search(r"\b([A-Z]{3})\b", str(raw_nation))
            if m_nat:
                code_cand = m_nat.group(1)
                if code_cand in db.valid_countries:
                    nation_code = code_cand
                elif FIFA_TO_ISO.get(code_cand) in db.valid_countries:
                    nation_code = FIFA_TO_ISO[code_cand]
        pid = resolve_player(db, cur, "fbref", ext_id, r["player"], team_id, season_id,
                             nationality=nation_code,
                             payload={"player": r["player"], "born": born, "nation": raw_nation})
        payload = _fbref_promote(clean({k: v for k, v in r.items() if k not in ("league", "season")}), stat_type)
        cur.execute("""INSERT INTO player_season_stats (player_id, team_id, competition_id, season_id, source_id,
                                                        stat_type, stats)
                       VALUES (%s,%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (player_id, competition_id, season_id, source_id, stat_type)
                       DO UPDATE SET stats=EXCLUDED.stats, team_id=EXCLUDED.team_id, ingested_at=now()""",
                    (pid, team_id, comp_id, season_id, db.sources["fbref"], stat_type, Jsonb(payload)))
        stats["processed"] += 1
    stats["ingested"] += len(df)


# ----------------------------------------------------------------------------
# Football-Data.co.uk
# ----------------------------------------------------------------------------
def process_football_data(db, cur, comp_id, season_id, df, stats):
    require_cols(df, ["date", "home_team", "away_team", "FTHG", "FTAG"], "Football-Data")
    src = "football_data_co_uk"
    stage(db, cur, src, "match", ((f"{r['date']}:{r['home_team']}:{r['away_team']}", r) for r in df.to_dict("records")))
    for r in df.to_dict("records"):
        home = resolve_team(db, cur, src, r["home_team"], r["home_team"])
        away = resolve_team(db, cur, src, r["away_team"], r["away_team"])
        ts = pd.Timestamp(r["date"])
        has_time = bool(ts.hour or ts.minute)
        hs, as_ = to_int(r.get("FTHG")), to_int(r.get("FTAG"))
        ref_id = get_or_create_referee(db, cur, src, r.get("Referee"))
        when = to_utc(ts, SOURCE_TZ[src], has_time)
        mid = upsert_match(cur, comp_id, season_id, home, away, when=when, has_time=has_time,
                           hs=hs, as_=as_, referee_id=ref_id)
        link_match(db, cur, src, f"{season_id}:{home}:{away}", mid)
        if ref_id:
            cur.execute("SELECT 1 FROM match_official WHERE match_id=%s AND role='main_referee'", (mid,))
            if not cur.fetchone():
                cur.execute("INSERT INTO match_official (match_id, referee_id, role) VALUES (%s,%s,'main_referee') "
                            "ON CONFLICT DO NOTHING", (mid, ref_id))
        if hs is not None and as_ is not None:
            sides = ((home, hs, "H"), (away, as_, "A"))
            for tid, goals, s in sides:
                o = "A" if s == "H" else "H"
                std = clean({"goals": goals, "shots": to_int(r.get(f"{s}S")), "shots_on_target": to_int(r.get(f"{s}ST"))})
                ext_stats = clean({"corners": to_int(r.get(f"{s}C")), "fouls": to_int(r.get(f"{s}F")),
                                   "yellow_cards": to_int(r.get(f"{s}Y")), "red_cards": to_int(r.get(f"{s}R")),
                                   "goals_against": to_int(r.get("FTAG" if s == "H" else "FTHG"))})
                cur.execute("SELECT insert_team_match_stat(%s,%s,%s,'standard',%s)", (mid, tid, src, Jsonb(std)))
                if ext_stats:
                    cur.execute("SELECT insert_team_match_stat(%s,%s,%s,'extras',%s)", (mid, tid, src, Jsonb(ext_stats)))
        kickoff = when
        for prefix, book in ODDS_BOOKS.items():
            h, d, a = (to_float(r.get(f"{prefix}{k}")) for k in "HDA")
            if None in (h, d, a):
                continue
            cur.execute("INSERT INTO match_odds (match_id, source_id, bookmaker, market, home_odds, draw_odds, "
                        "away_odds, collected_at) VALUES (%s,%s,%s,'1x2',%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                        (mid, db.sources[src], book, h, d, a, kickoff))
        stats["processed"] += 1
    stats["ingested"] += len(df)


# ----------------------------------------------------------------------------
# Understat
# ----------------------------------------------------------------------------
def process_understat(db, cur, comp_id, season_id, sched, players, shots, stats):
    require_cols(sched, ["game_id", "date", "home_team_id", "away_team_id", "home_team", "away_team",
                         "home_goals", "away_goals", "home_xg", "away_xg", "is_result"], "Understat schedule")
    require_cols(players, ["game_id", "team_id", "player_id", "player", "minutes", "goals", "assists"],
                 "Understat player_match_stats")
    require_cols(shots, ["game_id", "team_id", "player_id", "player", "xg", "location_x", "location_y", "minute",
                         "result", "situation", "body_part"], "Understat shots")
    src, sid = "understat", db.sources["understat"]
    stage(db, cur, src, "match", ((r["game_id"], r) for r in sched.to_dict("records")))

    # 1) partidas
    gid2m = {}
    for r in sched.to_dict("records"):
        home = resolve_team(db, cur, src, r["home_team_id"], r["home_team"])
        away = resolve_team(db, cur, src, r["away_team_id"], r["away_team"])
        played = bool(py(r.get("is_result")))
        hs, as_ = (to_int(r["home_goals"]), to_int(r["away_goals"])) if played else (None, None)
        mid = upsert_match(cur, comp_id, season_id, home, away, when=to_utc(r["date"], SOURCE_TZ[src], True),
                           has_time=True, hs=hs, as_=as_)
        link_match(db, cur, src, r["game_id"], mid)
        gid2m[ext(r["game_id"])] = {
            "match_id": mid, "home": home, "away": away,
            "home_ext": ext(r["home_team_id"]), "away_ext": ext(r["away_team_id"]),
            "played": played, "hxg": to_float(r["home_xg"]), "axg": to_float(r["away_xg"]),
            "hs": hs, "as": as_
        }
        stats["processed"] += 1
    stats["ingested"] += len(sched)

    # 2) agregados de chutes (por time e por jogador)
    shots = shots.copy()
    shots["on_target"] = shots["result"].isin(["Goal", "SavedShot"])
    shots["is_pen"] = shots["situation"].eq("Penalty")
    shots["pen_goal"] = shots["is_pen"] & shots["result"].eq("Goal")
    for c in ("game_id", "team_id", "player_id"):
        shots[c] = shots[c].map(ext)
    t_agg = shots.groupby(["game_id", "team_id"]).agg(shots=("result", "size"), sot=("on_target", "sum")).to_dict("index")
    p_agg = shots.groupby(["game_id", "player_id"]).agg(sot=("on_target", "sum"), pen_att=("is_pen", "sum"),
                                                        pen_goals=("pen_goal", "sum")).to_dict("index")

    # 3) estatísticas de time
    for gid, m in gid2m.items():
        if not m["played"]:
            continue
        for side, tid, ext_team, gf, xg in (
            ("home", m["home"], m["home_ext"], m["hs"], m["hxg"]),
            ("away", m["away"], m["away_ext"], m["as"], m["axg"])
        ):
            agg = t_agg.get((gid, ext_team), {})
            payload = clean({"goals": gf, "xg": xg, "shots": agg.get("shots"), "shots_on_target": agg.get("sot")})
            cur.execute("SELECT insert_team_match_stat(%s,%s,%s,'standard',%s)", (m["match_id"], tid, src, Jsonb(payload)))

    # 4) jogadores: estatísticas + súmula
    stage(db, cur, src, "player_stat", ((f"{r['game_id']}:{r['player_id']}", r) for r in players.to_dict("records")))
    for r in players.to_dict("records"):
        m = gid2m.get(ext(r["game_id"]))
        if not m or not m["played"]:
            continue
        team_ext = ext(r["team_id"])
        team_id = db.team_cache.get((src, team_ext))
        if team_id is None:
            cur.execute("SELECT team_id FROM team_external_id WHERE source_id=%s AND external_id=%s", (sid, team_ext))
            row = cur.fetchone()
            if row:
                team_id = row[0]
                db.team_cache[(src, team_ext)] = team_id
            else:
                continue
        pid = resolve_player(db, cur, src, r["player_id"], r["player"], team_id, season_id,
                             payload={"name": r["player"], "understat_id": ext(r["player_id"])})
        extra = p_agg.get((ext(r["game_id"]), ext(r["player_id"])), {})
        payload = clean({
            "goals": r.get("goals"), "assists": r.get("assists"), "minutes": r.get("minutes"), "xg": r.get("xg"),
            "xa": r.get("xa"), "shots": r.get("shots"), "key_passes": r.get("key_passes"),
            "own_goals": r.get("own_goals"), "yellow_cards": r.get("yellow_cards"), "red_cards": r.get("red_cards"),
            "xg_chain": r.get("xg_chain"), "xg_buildup": r.get("xg_buildup"), "position": r.get("position"),
            "shots_on_target": extra.get("sot", 0), "penalty_attempts": extra.get("pen_att", 0),
            "penalty_goals": extra.get("pen_goals", 0)})
        cur.execute("SELECT insert_player_match_stat(%s,%s,%s,%s,'standard',%s)",
                    (m["match_id"], pid, team_id, src, Jsonb(payload)))
        pos = py(r.get("position"))
        cur.execute("""INSERT INTO player_appearance (match_id, player_id, team_id, source_id, is_starter, position_raw,
                                                     position_code, minutes_played, yellow_cards, red_cards)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (match_id, player_id, source_id) DO UPDATE SET
                           is_starter=EXCLUDED.is_starter, position_raw=EXCLUDED.position_raw,
                           position_code=EXCLUDED.position_code, minutes_played=EXCLUDED.minutes_played,
                           yellow_cards=EXCLUDED.yellow_cards, red_cards=EXCLUDED.red_cards""",
                    (m["match_id"], pid, team_id, sid, None if pos is None else pos != "Sub", pos,
                     UNDERSTAT_POS.get(pos), to_int(r.get("minutes")), to_int(r.get("yellow_cards")) or 0,
                     to_int(r.get("red_cards")) or 0))
        stats["processed"] += 1
    stats["ingested"] += len(players)

    # 5) chutes -> match_event (apaga e recarrega por partida p/ ser idempotente)
    stage(db, cur, src, "event", ((f"{r['game_id']}:{i}", r) for i, r in enumerate(shots.to_dict("records"))))
    match_ids = [m["match_id"] for m in gid2m.values() if m["played"]]
    mdate = {}
    if match_ids:
        cur.execute("SELECT match_id, (match_date AT TIME ZONE 'UTC')::date FROM match WHERE match_id = ANY(%s::bigint[])", (match_ids,))
        mdate = dict(cur.fetchall())
        cur.execute("DELETE FROM match_event WHERE match_id = ANY(%s::bigint[]) AND source_id=%s", (match_ids, sid))
    rows, seq = [], {}
    for r in shots.sort_values(["game_id", "minute"], kind="stable").to_dict("records"):
        m = gid2m.get(r["game_id"])
        team_ext = ext(r["team_id"])
        team_id = db.team_cache.get((src, team_ext))
        if team_id is None:
            cur.execute("SELECT team_id FROM team_external_id WHERE source_id=%s AND external_id=%s", (sid, team_ext))
            row = cur.fetchone()
            if row:
                team_id = row[0]
                db.team_cache[(src, team_ext)] = team_id
            else:
                continue
        if not m or not m["played"]:
            continue
        pid = resolve_player(db, cur, src, r["player_id"], r["player"], team_id, season_id,
                             payload={"name": r["player"], "understat_id": r["player_id"]})
        apid = None
        if py(r.get("assist_player_id")) is not None and py(r.get("assist_player")):
            apid = resolve_player(db, cur, src, ext(r["assist_player_id"]), r["assist_player"], team_id, season_id,
                                  payload={"name": r["assist_player"], "understat_id": ext(r["assist_player_id"])})
        seq[m["match_id"]] = seq.get(m["match_id"], 0) + 1
        x, y = to_float(r["location_x"]), to_float(r["location_y"])
        rows.append((m["match_id"], mdate.get(m["match_id"]) or date.today(), sid, team_id, pid, apid,
                     to_int(r["minute"]), "shot", r["result"] == "OwnGoal", r["situation"] == "Penalty",
                     BODY_PART.get(py(r["body_part"]), "other"), SHOT_RESULT.get(py(r["result"]), "miss"),
                     None if x is None else round(x * 100, 2), None if y is None else round(y * 100, 2),  # 0-1 -> 0-100
                     Jsonb(clean({"xg": r.get("xg"), "situation": r.get("situation"), "result_raw": r.get("result")})),
                     seq[m["match_id"]]))
    cur.executemany("""INSERT INTO match_event (match_id, event_date, source_id, team_id, player_id, assist_player_id,
                          minute, event_type, is_own_goal, is_penalty, body_part, shot_result, x, y, qualifiers,
                          sequence_no)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", rows)
    stats["ingested"] += len(shots)


# ----------------------------------------------------------------------------
# ClubElo
# ----------------------------------------------------------------------------
def process_clubelo(db, cur, season_code, step_days, stats):
    _, start, end = season_info(season_code)
    day, last = start, min(end, date.today())
    sid = db.sources["clubelo"]
    while day <= last:
        try:
            df = fetch_clubelo(day)
        except Exception as e:
            log.warning("Falha ao coletar ClubElo para data %s: %s. Interrompendo coleta desta temporada.", day, e)
            break
        require_cols(df, ["team", "elo", "country", "level"], "ClubElo")
        df = df[(df["country"] == COUNTRY) & (df["level"] == 1)]
        stage(db, cur, "clubelo", "elo", ((f"{day}:{r['team']}", r) for r in df.to_dict("records")))
        for r in df.to_dict("records"):
            team_id = resolve_team(db, cur, "clubelo", r["team"], r["team"])
            cur.execute("""INSERT INTO team_elo_rating (team_id, source_id, rating_date, elo, rank)
                           VALUES (%s,%s,%s,%s,%s)
                           ON CONFLICT (team_id, source_id, rating_date)
                           DO UPDATE SET elo=EXCLUDED.elo, rank=EXCLUDED.rank""",
                        (team_id, sid, day, to_float(r["elo"]), to_int(r.get("rank"))))
            stats["processed"] += 1
        stats["ingested"] += len(df)
        day += timedelta(days=step_days)


# ----------------------------------------------------------------------------
# Orquestração
# ----------------------------------------------------------------------------
def run_season(db: DB, comp_id: int, season_id: int, code: str, sources: list[str], args):
    cur = db.conn.cursor()
    tag = f"{code}"
    if "fbref" in sources:
        sched_job = f"epl:{tag}:schedule"
        with sync_job(db, "fbref", sched_job) as st:
            process_fbref_schedule(db, cur, comp_id, season_id, fetch_fbref_schedule(code), st)
        if sched_job in db.failures:
            log.warning("FBref schedule falhou para temporada %s. Pulando estatísticas do FBref "
                        "(Dica: FBref requer Chrome/Chromium; use --sources football_data understat clubelo para rodar sem FBref).", tag)
        else:
            for kind, stat_types, fetch, proc in (
                    ("team", args.fbref_team_stats, fetch_fbref_team_stats, process_fbref_team_stats),
                    ("player", args.fbref_player_stats, fetch_fbref_player_stats, process_fbref_player_stats)):
                for stype in stat_types:
                    with sync_job(db, "fbref", f"epl:{tag}:{kind}_{stype}") as st:
                        proc(db, cur, comp_id, season_id, stype, fetch(code, stype), st)
    if "football_data" in sources:
        with sync_job(db, "football_data_co_uk", f"epl:{tag}:matches") as st:
            process_football_data(db, cur, comp_id, season_id, fetch_football_data(code), st)
    if "understat" in sources:
        with sync_job(db, "understat", f"epl:{tag}:matches_players_shots") as st:
            sched, players, shots = fetch_understat(code)
            process_understat(db, cur, comp_id, season_id, sched, players, shots, st)
    if "clubelo" in sources:
        with sync_job(db, "clubelo", f"epl:{tag}:elo") as st:
            process_clubelo(db, cur, code, args.elo_step_days, st)
    fill_matchdays(cur, season_id)
    db.conn.commit()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Ingestão da Premier League via soccerdata")
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL"), help="ou defina DATABASE_URL")
    ap.add_argument("--seasons", nargs="+", default=["2425", "2526", "2627"], help="formato 2425 = 2024/25")
    ap.add_argument("--sources", nargs="+", default=["fbref", "football_data", "understat", "clubelo"],
                    choices=["fbref", "football_data", "understat", "clubelo"])
    ap.add_argument("--fbref-team-stats", nargs="*", default=FBREF_TEAM_STATS)
    ap.add_argument("--fbref-player-stats", nargs="*", default=FBREF_PLAYER_STATS)
    ap.add_argument("--elo-step-days", type=int, default=7)
    ap.add_argument("--no-gold-refresh", action="store_true")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    if not args.dsn:
        ap.error("informe --dsn ou a variável DATABASE_URL")

    db = DB(args.dsn)
    with db.conn.cursor() as cur:
        comp_id, season_ids = seed_reference(db, cur, args.seasons)
    db.conn.commit()

    for code in args.seasons:
        log.info("=== Temporada %s ===", code)
        run_season(db, comp_id, season_ids[code], code, args.sources, args)

    if not args.no_gold_refresh:
        with db.conn.cursor() as cur:
            cur.execute("SELECT refresh_gold_views(false)")
        db.conn.commit()

    with db.logconn.cursor() as c:
        c.execute("SELECT source_code, last_sync_status, total_records_processed FROM vw_source_health "
                  "WHERE total_records_processed > 0 OR last_sync_status IS NOT NULL ORDER BY 1")
        for row in c.fetchall():
            log.info("saúde da fonte: %s", row)
    if db.failures:
        log.error("Jobs com falha (%d): %s", len(db.failures), ", ".join(db.failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
