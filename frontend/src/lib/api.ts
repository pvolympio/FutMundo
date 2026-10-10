/**
 * Client de API com dados reais do PostgreSQL/FastAPI e fallback gracioso.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface MatchSummary {
  match_id: number;
  matchday: number;
  match_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team_id: number;
  home_team_name: string;
  home_team_short: string;
  away_team_id: number;
  away_team_name: string;
  away_team_short: string;
  venue_name: string;
}

export interface MatchEvent {
  event_id: number;
  minute: number;
  second?: number | null;
  event_type: string;
  team_id: number;
  player?: { id: number; name: string } | null;
  assist_player?: { id: number; name: string } | null;
  is_own_goal?: boolean;
  is_penalty?: boolean;
  body_part?: 'head' | 'left_foot' | 'right_foot' | string;
  shot_result?: 'goal' | 'saved' | 'blocked' | 'off_target' | string;
  x?: number;
  y?: number;
  xg?: number;
  situation?: 'open_play' | 'set_piece' | 'corner' | 'penalty' | 'fast_break' | string;
}

export interface PlayerAppearanceItem {
  player_id: number;
  name: string;
  shirt_number?: number;
  position?: string;
  captain?: boolean;
}

export interface MatchDetailsData {
  match_id: number;
  match_date: string;
  status: string;
  stage?: string;
  matchday: number;
  score: {
    home: number;
    away: number;
    home_extra_time?: number;
    away_extra_time?: number;
    home_penalties?: number;
    away_penalties?: number;
  };
  home_team: { id: number; name: string; short_name: string; slug: string };
  away_team: { id: number; name: string; short_name: string; slug: string };
  venue?: { name: string; city: string; capacity?: number };
  officials?: Array<{ name: string; role: string }>;
  lineups?: {
    home: { starters: PlayerAppearanceItem[]; bench: PlayerAppearanceItem[]; formation?: string };
    away: { starters: PlayerAppearanceItem[]; bench: PlayerAppearanceItem[]; formation?: string };
  };
  timeline?: MatchEvent[];
  stats?: {
    home?: { goals: number; xg?: number; shots?: number; shots_on_target?: number; possession_pct?: number; raw?: any };
    away?: { goals: number; xg?: number; shots?: number; shots_on_target?: number; possession_pct?: number; raw?: any };
  };
  odds?: {
    bookmaker?: string;
    home_win?: number;
    draw?: number;
    away_win?: number;
  };
}

export interface TeamItem {
  team_id: number;
  canonical_name: string;
  short_name: string;
  slug: string;
  crest_url?: string;
  venue_name?: string;
  city?: string;
}

export interface TeamProfileData {
  team_id: number;
  canonical_name: string;
  short_name: string;
  slug: string;
  country_code?: string;
  founded_year?: number;
  crest_url?: string;
  accent_color?: string;
  venue?: {
    venue_id?: number;
    name?: string;
    city?: string;
    capacity?: number;
    surface?: string;
  };
  manager?: {
    name?: string;
    nationality?: string;
  };
  standings?: {
    position?: number;
    played?: number;
    won?: number;
    drawn?: number;
    lost?: number;
    goals_for?: number;
    goals_against?: number;
    goal_difference?: number;
    points?: number;
  };
  form?: {
    last_5?: string[];
  };
  squad?: Record<string, any>;
  recent_matches?: Array<{
    match_id: number;
    opponent: string;
    is_home: boolean;
    home_score: number;
    away_score: number;
    status: string;
  }>;
}

export interface TeamSeasonMatch {
  match_id: number;
  matchday?: number;
  date?: string;
  is_home: boolean;
  opponent_id: number;
  opponent: string;
  goals_for: number;
  goals_against: number;
  result: 'V' | 'E' | 'D';
  xg_for?: number;
  xg_against?: number;
  shots_for?: number;
  shots_against?: number;
}

export interface TeamSeasonSummary {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  clean_sheets: number;
  xg_for: number;
  xg_against: number;
  xg_difference: number;
  goals_minus_xg: number;
  avg_xg_for: number;
  avg_xg_against: number;
  shots_for: number;
  shots_against: number;
}

export interface TeamSeasonPlayer {
  player_id: number;
  name: string;
  nationality?: string;
  photo_url?: string;
  position_code?: string;
  position_name?: string;
  line?: string;
  appearances: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  xg: number;
  xa: number;
}

export interface TeamSeasonData {
  team_id: number;
  season_id?: number;
  season_name?: string;
  summary: TeamSeasonSummary;
  matches: TeamSeasonMatch[];
  squad: TeamSeasonPlayer[];
}

export interface StandingRow {
  position: number;
  team_id?: number;
  team_name: string;
  team_short_name?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for?: number;
  goals_against?: number;
  goal_difference?: number;
  points: number;
  gf?: number;
  ga?: number;
  gd?: number;
  pts?: number;
  team?: string;
}

export interface PlayerShotEvent {
  event_id: number;
  match_id: number;
  minute: number;
  second?: number;
  x: number;
  y: number;
  body_part: 'head' | 'left_foot' | 'right_foot' | string;
  shot_result: 'goal' | 'saved' | 'blocked' | 'off_target' | string;
  is_penalty?: boolean;
  is_own_goal?: boolean;
  assist_name?: string;
  match_date: string;
  opponent_name: string;
  xg?: number;
  situation?: 'open_play' | 'set_piece' | 'corner' | 'penalty' | 'fast_break' | string;
}

export interface PlayerSeasonStats {
  goals: number;
  assists: number;
  xg: number;
  xa: number;
  minutes: number;
  matches: number;
  shots?: number;
  shots_on_target?: number;
  key_passes?: number;
  goals_per_90?: number;
  xg_per_90?: number;
  xa_per_90?: number;
  shots_per_90?: number;
  key_passes_per_90?: number;
  shot_accuracy_pct?: number;
  conversion_rate_pct?: number;
}

export interface PlayerRankingItem {
  rank: number;
  player_id: number;
  name: string;
  photo_url?: string | null;
  nationality?: string | null;
  team_id?: number;
  team_name?: string;
  team_short?: string;
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  xg: number;
  xa: number;
  shots: number;
  shots_on_target: number;
  key_passes: number;
  goals_per_90: number;
  xg_per_90: number;
  xa_per_90: number;
  shots_per_90: number;
  key_passes_per_90: number;
  shot_accuracy_pct: number;
}

export interface SearchResult {
  type: 'player' | 'team';
  id: number;
  name: string;
  subtitle?: string;
  slug?: string;
  photo_url?: string | null;
  score?: number;
}

export interface HeadToHeadSummary {
  total_matches: number;
  team_a_wins: number;
  team_b_wins: number;
  draws: number;
  team_a_goals: number;
  team_b_goals: number;
}

export interface HeadToHeadResponse {
  team_a?: { team_id: number; name?: string; short_name?: string };
  team_b?: { team_id: number; name?: string; short_name?: string };
  summary?: HeadToHeadSummary;
  recent_matches?: Array<{
    match_id: number;
    match_date?: string;
    score?: { home: number; away: number };
    home_team_id?: number;
    away_team_id?: number;
  }>;
}

export interface PlayerProfileData {
  player_id: number;
  full_name: string;
  display_name?: string;
  birth_date?: string;
  age?: number;
  nationality?: { code?: string; name?: string };
  physical?: { height_cm?: number; weight_kg?: number; preferred_foot?: string };
  photo_url?: string;
  market_value?: { amount_eur?: number; formatted?: string };
  club?: { team?: { id: number; name: string; short_name: string }; shirt_number?: number; position?: string };
  career_teams?: Array<Record<string, unknown>>;
  injuries?: Array<Record<string, unknown>>;
  current_season_stats?: Record<string, unknown>;
}

export interface PlayerComparisonResponse {
  player_a: Partial<PlayerRankingItem> & Record<string, unknown>;
  player_b: Partial<PlayerRankingItem> & Record<string, unknown>;
}

export interface RequestOptions {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

// Client HTTP resiliente com timeout, retentativas exponenciais e cancelamento via AbortSignal
export async function apiFetch<T>(
  endpoint: string,
  fallback: T,
  options: RequestOptions = {}
): Promise<T> {
  const {
    timeoutMs = 4000,
    retries = 2,
    backoffMs = 250,
    signal,
    headers = {},
  } = options;

  let attempt = 0;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const onCallerAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        return fallback;
      }
      signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...headers,
        },
      });
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onCallerAbort);

      if (res.status === 304) {
        return fallback;
      }

      if (!res.ok) {
        // Erros de cliente (404, 400, etc.) não se beneficiam de retry imediato
        if (res.status >= 400 && res.status < 500) {
          console.warn(`[FutMundo API] HTTP ${res.status} em ${endpoint}`);
          return fallback;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      return (await res.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onCallerAbort);

      if (signal?.aborted) {
        return fallback;
      }

      attempt++;
      if (attempt <= retries) {
        await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt - 1)));
      } else {
        console.warn(`[FutMundo API] Fallback acionado em ${endpoint} após ${retries} tentativas:`, err);
        return fallback;
      }
    }
  }

  return fallback;
}

/** Listar partidas de uma rodada */
export async function getMatchesByRound(round: number = 7, options?: RequestOptions): Promise<MatchSummary[]> {
  const fallback: MatchSummary[] = [
    {
      match_id: 50,
      matchday: 5,
      match_date: '2024-09-22T12:30:00-03:00',
      status: 'finished',
      home_score: 2,
      away_score: 2,
      home_team_id: 18,
      home_team_name: 'Manchester City',
      home_team_short: 'Man City',
      away_team_id: 3,
      away_team_name: 'Arsenal',
      away_team_short: 'Arsenal',
      venue_name: 'Etihad Stadium',
    },
  ];

  const res = await apiFetch<PaginatedResponse<MatchSummary> | MatchSummary[]>(
    `/matches?round=${round}&page_size=20`,
    fallback,
    options
  );
  if (Array.isArray(res)) {
    return res;
  }
  if (res && Array.isArray((res as PaginatedResponse<MatchSummary>).items)) {
    return (res as PaginatedResponse<MatchSummary>).items;
  }
  return fallback;
}

/** Obter último jogo jogado e última rodada */
export async function getLatestMatch(options?: RequestOptions): Promise<{ match_id: number; round: number; match_date?: string }> {
  return apiFetch<{ match_id: number; round: number; match_date?: string }>(
    '/matches/latest',
    { match_id: 50, round: 5 },
    options
  );
}

const DEFAULT_FALLBACK_MATCH: MatchDetailsData = {
  match_id: 50,
  match_date: '2024-09-22T12:30:00-03:00',
  status: 'finished',
  matchday: 5,
  score: { home: 2, away: 2 },
  home_team: { id: 18, name: 'Manchester City', short_name: 'Man City', slug: 'man-city' },
  away_team: { id: 3, name: 'Arsenal', short_name: 'Arsenal', slug: 'arsenal' },
  venue: { name: 'Etihad Stadium', city: 'Manchester' },
  officials: [{ name: 'Michael Oliver', role: 'main_referee' }],
  stats: {
    home: { goals: 2, xg: 2.15, shots: 28, shots_on_target: 9, possession_pct: 68 },
    away: { goals: 2, xg: 0.88, shots: 6, shots_on_target: 3, possession_pct: 32 },
  },
  odds: { bookmaker: 'Bet365', home_win: 1.8, draw: 3.8, away_win: 4.5 },
  timeline: [
    { event_id: 1, minute: 9, event_type: 'shot', team_id: 18, player: { id: 10, name: 'Erling Haaland' }, body_part: 'left_foot', shot_result: 'goal', x: 88, y: 52, xg: 0.42, situation: 'open_play' },
    { event_id: 2, minute: 22, event_type: 'shot', team_id: 3, player: { id: 21, name: 'Riccardo Calafiori' }, body_part: 'left_foot', shot_result: 'goal', x: 74, y: 38, xg: 0.06, situation: 'open_play' },
    { event_id: 3, minute: 45, event_type: 'shot', team_id: 3, player: { id: 6, name: 'Gabriel Magalhães' }, body_part: 'head', shot_result: 'goal', x: 92, y: 48, xg: 0.28, situation: 'corner' },
    { event_id: 4, minute: 98, event_type: 'shot', team_id: 18, player: { id: 5, name: 'John Stones' }, body_part: 'right_foot', shot_result: 'goal', x: 94, y: 50, xg: 0.65, situation: 'corner' },
  ],
};

/** Obter detalhes completos da partida */
export async function getMatchDetails(matchId: number, options?: RequestOptions): Promise<MatchDetailsData> {
  const data = await apiFetch<MatchDetailsData | null>(`/matches/${matchId}`, null, options);
  if (data && data.home_team) return data;
  return { ...DEFAULT_FALLBACK_MATCH, match_id: matchId };
}

/** Listar todos os 20 times da Premier League */
export async function getTeams(options?: RequestOptions): Promise<TeamItem[]> {
  const fallback: TeamItem[] = [
    { team_id: 3, canonical_name: 'Arsenal', short_name: 'Arsenal', slug: 'arsenal', venue_name: 'Emirates Stadium' },
    { team_id: 14, canonical_name: 'Aston Villa', short_name: 'Aston Villa', slug: 'aston-villa', venue_name: 'Villa Park' },
    { team_id: 17, canonical_name: 'Chelsea', short_name: 'Chelsea', slug: 'chelsea', venue_name: 'Stamford Bridge' },
    { team_id: 1, canonical_name: 'Liverpool', short_name: 'Liverpool', slug: 'liverpool', venue_name: 'Anfield' },
    { team_id: 18, canonical_name: 'Manchester City', short_name: 'Man City', slug: 'man-city', venue_name: 'Etihad Stadium' },
    { team_id: 2, canonical_name: 'Manchester United', short_name: 'Man United', slug: 'man-united', venue_name: 'Old Trafford' },
    { team_id: 4, canonical_name: 'Tottenham Hotspur', short_name: 'Tottenham', slug: 'tottenham', venue_name: 'Tottenham Hotspur Stadium' },
  ];

  const res = await apiFetch<PaginatedResponse<TeamItem> | TeamItem[]>('/teams?page_size=30', fallback, options);
  if (Array.isArray(res)) return res;
  if (res && Array.isArray((res as PaginatedResponse<TeamItem>).items)) return (res as PaginatedResponse<TeamItem>).items;
  return fallback;
}

/** Obter perfil do clube via fn_api_team_profile */
export async function getTeamProfile(teamId: number, options?: RequestOptions): Promise<TeamProfileData | null> {
  return apiFetch<TeamProfileData | null>(`/teams/${teamId}`, null, {
    timeoutMs: 6000,
    ...options,
  });
}

/** Obter jogos da temporada, métricas consolidadas e elenco real */
export async function getTeamSeason(teamId: number, seasonId?: number, options?: RequestOptions): Promise<TeamSeasonData | null> {
  const query = seasonId ? `?season_id=${seasonId}` : '';
  return apiFetch<TeamSeasonData | null>(`/teams/${teamId}/season${query}`, null, {
    timeoutMs: 6000,
    ...options,
  });
}

/** Confronto direto (H2H) */
export async function getTeamH2H(teamA: number, teamB: number, options?: RequestOptions): Promise<HeadToHeadResponse | null> {
  return apiFetch<HeadToHeadResponse | null>(`/teams/${teamA}/head-to-head/${teamB}`, null, options);
}

/** Tabela de classificação na rodada max_round */
export async function getStandings(maxRound?: number, options?: RequestOptions): Promise<StandingRow[]> {
  const url = maxRound ? `/standings/1/1?max_round=${maxRound}` : '/standings/1/1';
  const data = await apiFetch<{ standings: StandingRow[] } | null>(url, null, options);
  if (data && data.standings && data.standings.length > 0) {
    return data.standings;
  }
  return [];
}

/** Perfil completo do jogador */
export async function getPlayerProfile(playerId: number, options?: RequestOptions): Promise<PlayerProfileData | null> {
  return apiFetch<PlayerProfileData | null>(`/players/${playerId}`, null, options);
}

/** Chutes individuais do jogador */
export async function getPlayerShots(playerId: number, options?: RequestOptions): Promise<PlayerShotEvent[]> {
  return apiFetch<PlayerShotEvent[]>(`/players/${playerId}/shots`, [], options);
}

/** Totais estatísticos do jogador na temporada */
export async function getPlayerStats(playerId: number, options?: RequestOptions): Promise<PlayerSeasonStats | null> {
  return apiFetch<PlayerSeasonStats | null>(`/players/${playerId}/stats`, null, options);
}

/** Comparação direta entre dois jogadores com métricas de radar */
export async function comparePlayers(
  p1: number,
  p2: number,
  options?: RequestOptions
): Promise<PlayerComparisonResponse> {
  return apiFetch<PlayerComparisonResponse>(
    `/players/compare?p1=${p1}&p2=${p2}`,
    { player_a: {}, player_b: {} },
    options
  );
}

/** Busca global com trigramas */
export async function searchEntities(
  query: string,
  limit: number = 10,
  options?: RequestOptions
): Promise<{ results: SearchResult[]; total: number }> {
  if (!query || query.trim().length === 0) return { results: [], total: 0 };
  return apiFetch<{ results: SearchResult[]; total: number }>(
    `/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    { results: [], total: 0 },
    options
  );
}

/** Ranking e líderes da Premier League (artilharia, assistências, xG) */
export async function getPlayerRankings(
  metric: string = 'goals',
  limit: number = 20,
  minMinutes: number = 200,
  options?: RequestOptions
): Promise<PlayerRankingItem[]> {
  return apiFetch<PlayerRankingItem[]>(
    `/players/rankings?metric=${metric}&limit=${limit}&min_minutes=${minMinutes}`,
    [],
    options
  );
}

// Re-export openapi types for schema consumers
export type { paths, operations, components } from './api-schema';



