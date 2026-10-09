import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFocus } from '../store/focus';
import { Pitch } from '../charts/Pitch';
import { ShotMarkers } from '../charts/ShotMarkers';
import { XgRace } from '../charts/XgRace';
import { Crest } from '../ui/Crest';
import { Scrubber } from '../ui/Scrubber';
import { Stat } from '../ui/Stat';
import { Tabs } from '../ui/Tabs';
import { Skeleton } from '../ui/Skeleton';
import { useMatchesByRound, useMatchDetails } from '../lib/queries';
import type { MatchSummary } from '../lib/api';
import { ShotContours } from '../charts/ShotContours';
import { VirtualizedShotList } from '../lib/VirtualizedShotList';
import { usePageTitle } from '../lib/usePageTitle';
import { getClubTheme } from '../lib/clubColors';

// Lazy load heavy components for better performance
const ShotTempo = lazy(() => import('../charts/ShotTempo'));
const TacticalLineup = lazy(() => import('../charts/TacticalLineup'));

export function Match() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const initialMatchId = id ? parseInt(id, 10) : 50;
  const pendingDeepLink = useRef<boolean>(!!id);

  const { focus, toggleFocus } = useFocus();
  const [selectedRound, setSelectedRound] = useState<number>(5);
  const [selectedMatchId, setSelectedMatchId] = useState<number>(initialMatchId);

  // Sync if route :id changes
  useEffect(() => {
    if (id) {
      const parsed = parseInt(id, 10);
      if (!isNaN(parsed) && parsed !== selectedMatchId) {
        pendingDeepLink.current = true;
        setSelectedMatchId(parsed);
      }
    }
  }, [id]);

  const { data: roundMatchesRaw } = useMatchesByRound(selectedRound);
  const roundMatches = useMemo<MatchSummary[]>(() => {
    if (Array.isArray(roundMatchesRaw)) return roundMatchesRaw;
    if (roundMatchesRaw && Array.isArray((roundMatchesRaw as any).items)) return (roundMatchesRaw as any).items;
    return [];
  }, [roundMatchesRaw]);

  const { data: matchData, isLoading: loadingMatch } = useMatchDetails(selectedMatchId);
  const loading = loadingMatch || !matchData;

  const matchTitle = matchData?.home_team?.short_name && matchData?.away_team?.short_name
    ? `${matchData.home_team.short_name} ${matchData.score.home} × ${matchData.score.away} ${matchData.away_team.short_name} (R${matchData.matchday})`
    : 'Análise de Partida';
  usePageTitle(matchTitle);

  // When matchData loads for a deep-linked match, sync the round
  useEffect(() => {
    if (matchData && matchData.match_id === selectedMatchId) {
      if (matchData.matchday && matchData.matchday !== selectedRound) {
        setSelectedRound(matchData.matchday);
      }
      pendingDeepLink.current = false;
    }
  }, [matchData, selectedMatchId]);

  const [currentTime, setCurrentTime] = useState<number>(97);
  const [activeTab, setActiveTab] = useState<'pitch' | 'lineups' | 'xgrace' | 'tempo'>('pitch');
  const [playing, setPlaying] = useState<boolean>(false);

  // Filtros interativos para o mapa de chutes
  const [shotTeamFilter, setShotTeamFilter] = useState<'all' | 'home' | 'away'>('all');
  const [shotPeriodFilter, setShotPeriodFilter] = useState<'all' | '1h' | '2h'>('all');
  const [shotResultFilter, setShotResultFilter] = useState<'all' | 'goal' | 'saved' | 'miss'>('all');

  const isHome = focus === 'home';

  const homeTheme = useMemo(() => getClubTheme(matchData?.home_team?.name), [matchData?.home_team?.name]);
  const awayTheme = useMemo(() => getClubTheme(matchData?.away_team?.name), [matchData?.away_team?.name]);

  // Sincronizar seleção ao carregar partidas da rodada (apenas se não estiver aguardando deep link)
  useEffect(() => {
    if (pendingDeepLink.current) return;
    if (roundMatches.length > 0) {
      const matchInRound = roundMatches.find((m) => m.match_id === selectedMatchId);
      if (!matchInRound) {
        setSelectedMatchId(roundMatches[0].match_id);
      }
    }
  }, [roundMatches, selectedMatchId]);

  // Resetar scrub de tempo ao trocar partida
  useEffect(() => {
    if (matchData) {
      setCurrentTime(95);
    }
  }, [selectedMatchId, matchData]);

  // Atalho de teclado para alternar foco
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'f' || e.key === 'F') toggleFocus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFocus]);

  // Normalizar eventos de chute da timeline com xG e situation enriquecidos
  const allShots = useMemo(() => {
    if (!matchData || !matchData.timeline) return [];
    return matchData.timeline
      .filter((ev) => ev.event_type === 'shot' && ev.x != null && ev.y != null)
      .map((ev) => {
        const isHomeShot = ev.team_id === matchData.home_team.id;
        const result = (ev.shot_result || 'miss').toLowerCase();

        // Usar xG real do banco se disponível, ou calcular aproximação
        let xgVal = (ev as any).xg;
        if (xgVal == null) {
          const distFromGoal = Math.sqrt(Math.pow(100 - (ev.x || 80), 2) + Math.pow(50 - (ev.y || 50), 2));
          xgVal = result === 'goal' ? 0.38 : Math.max(0.04, Math.min(0.45, 1 / (distFromGoal * 0.15 + 1.5)));
        }

        return {
          id: ev.event_id,
          x: ev.x || 80,
          y: ev.y || 50,
          xG: Number(Number(xgVal).toFixed(3)),
          result: (result === 'goal' ? 'goal' : result === 'saved' ? 'saved' : result === 'blocked' ? 'blocked' : 'off_target') as any,
          situation: (ev as any).situation || (ev.is_penalty ? 'penalty' : 'open_play'),
          bodyPart: (ev.body_part === 'head' ? 'head' : ev.body_part === 'left_foot' ? 'left_foot' : 'right_foot') as any,
          minute: ev.minute,
          player: ev.player?.name || (isHomeShot ? matchData.home_team.short_name : matchData.away_team.short_name),
          assist: ev.assist_player?.name,
          home: isHomeShot,
        };
      });
  }, [matchData]);

  // Filtrar chutes pelo minuto do scrubber e pelos filtros analíticos
  const visibleShots = useMemo(() => {
    return allShots.filter((s) => {
      // Scrubber de tempo
      if (s.minute > currentTime) return false;

      // Filtro de equipe
      if (shotTeamFilter === 'home' && !s.home) return false;
      if (shotTeamFilter === 'away' && s.home) return false;

      // Filtro de período
      if (shotPeriodFilter === '1h' && s.minute > 45) return false;
      if (shotPeriodFilter === '2h' && s.minute <= 45) return false;

      // Filtro de desfecho
      if (shotResultFilter === 'goal' && s.result !== 'goal') return false;
      if (shotResultFilter === 'saved' && s.result !== 'saved') return false;
      if (shotResultFilter === 'miss' && (s.result === 'goal' || s.result === 'saved')) return false;

      return true;
    });
  }, [allShots, currentTime, shotTeamFilter, shotPeriodFilter, shotResultFilter]);

  const homeShots = visibleShots.filter((s) => s.home);
  const awayShots = visibleShots.filter((s) => !s.home);

  // Chutes de cada equipe para o xG race
  const shotsA = useMemo(() => allShots.filter((s) => s.home).map((s) => ({ minute: s.minute, xG: s.xG })), [allShots]);
  const shotsB = useMemo(() => allShots.filter((s) => !s.home).map((s) => ({ minute: s.minute, xG: s.xG })), [allShots]);

  // Cálculo de probabilidades implícitas das Odds
  const odds = matchData?.odds;
  const impliedOdds = useMemo(() => {
    if (!odds || !odds.home_win || !odds.draw || !odds.away_win) return null;
    const invH = 1 / odds.home_win;
    const invD = 1 / odds.draw;
    const invA = 1 / odds.away_win;
    const sum = invH + invD + invA;
    return {
      home: Math.round((invH / sum) * 100),
      draw: Math.round((invD / sum) * 100),
      away: Math.round((invA / sum) * 100),
      bookmaker: odds.bookmaker || 'Consolidado',
    };
  }, [odds]);

  if (!matchData && loading) {
    return (
      <div className="match-container" style={{ textAlign: 'center', padding: '100px 0' }}>
        <div style={{ fontFamily: 'var(--mono)', color: 'var(--ink-2)' }}>Carregando dados da partida...</div>
      </div>
    );
  }

  const homeScore = matchData?.score?.home ?? 0;
  const awayScore = matchData?.score?.away ?? 0;
  const homeXG = matchData?.stats?.home?.xg ?? (homeShots.reduce((acc, s) => acc + s.xG, 0) || 1.8);
  const awayXG = matchData?.stats?.away?.xg ?? (awayShots.reduce((acc, s) => acc + s.xG, 0) || 1.2);
  const homePoss = matchData?.stats?.home?.possession_pct ?? 55;
  const awayPoss = matchData?.stats?.away?.possession_pct ?? (100 - homePoss);

  return (
    <div className="match-container">
      {/* Seletor de Rodadas & Carrossel de Jogos com Escudos */}
      <div style={{ gridColumn: '1 / -1', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="editorial-badge">PREMIER LEAGUE 2024/25</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
              RODADA:
            </span>
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(Number(e.target.value))}
              style={{
                background: 'var(--bg-1)',
                border: '1px solid var(--rule)',
                color: 'var(--accent)',
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '2px',
                cursor: 'pointer',
              }}
            >
              {Array.from({ length: 38 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Rodada {i + 1}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
            FOCO TÁTICO: <span style={{ color: isHome ? 'var(--accent)' : 'var(--opp)', fontWeight: 600 }}>{isHome ? matchData?.home_team?.short_name : matchData?.away_team?.short_name}</span> (Atalho: F)
          </div>
        </div>

        {/* Faixa horizontal de partidas da rodada */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '8px',
            scrollbarWidth: 'thin',
          }}
        >
          {roundMatches.map((m) => {
            const isSelected = m.match_id === selectedMatchId;
            return (
              <button
                key={m.match_id}
                onClick={() => {
                  setSelectedMatchId(m.match_id);
                  navigate(`/match/${m.match_id}`);
                }}
                role="button"
                aria-pressed={isSelected}
                style={{
                  flex: '0 0 auto',
                  background: isSelected ? 'var(--accent-wash)' : 'var(--bg-1)',
                  border: isSelected ? '1px solid var(--accent)' : '1px solid var(--rule)',
                  borderRadius: '2px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  minWidth: '155px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)' }}>
                  <span>{m.match_date ? m.match_date.split('T')[0].slice(5) : ''}</span>
                  <span style={{ color: isSelected ? 'var(--accent)' : 'var(--ink)', fontWeight: 700 }}>
                    {m.home_score != null ? `${m.home_score} - ${m.away_score}` : 'vs'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--mono)', fontSize: '11px', color: isSelected ? 'var(--ink)' : 'var(--ink-2)' }}>
                  <Crest name={m.home_team_short} alt={m.home_team_name} size={16} />
                  <span>{m.home_team_short}</span>
                  <span style={{ color: 'var(--ink-3)', fontSize: '9px' }}>×</span>
                  <Crest name={m.away_team_short} alt={m.away_team_name} size={16} />
                  <span>{m.away_team_short}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Score Hero com Escudos Oficiais Vetoriais */}
      {loading ? (
        <div
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '40px 20px',
            background: 'var(--bg-1)',
            border: '1px solid var(--rule)',
            borderRadius: '2px',
            marginBottom: '16px',
          }}
          role="status"
          aria-busy="true"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
              <Skeleton variant="text" />
              <Skeleton variant="text" />
            </div>
            <Skeleton variant="circle" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Skeleton variant="circle" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Skeleton variant="text" />
              <Skeleton variant="text" />
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          gridColumn: '1 / -1',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '32px 24px',
          background: `radial-gradient(ellipse at 12% 50%, ${homeTheme.wash} 0%, transparent 60%), radial-gradient(ellipse at 88% 50%, ${awayTheme.wash} 0%, transparent 60%), var(--bg-1)`,
          border: '1px solid var(--rule)',
          borderRadius: '4px',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}>
          {/* Mandante */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, justifyContent: 'flex-end', paddingRight: '20px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '26px', color: isHome ? homeTheme.accent : 'var(--ink)', fontWeight: 600 }}>
                {matchData?.home_team?.name}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '11.5px', color: 'var(--ink-2)', marginTop: '4px' }}>
                xG <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{Number(homeXG).toFixed(2)}</span> • Posse <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{homePoss}%</span>
              </div>
            </div>
            <Crest name={matchData?.home_team?.name} alt={matchData?.home_team?.name || 'Mandante'} size={68} />
            <span style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(56px, 8vw, 96px)',
              lineHeight: 0.9,
              color: isHome ? homeTheme.accent : 'var(--ink)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 300,
            }}>
              {homeScore}
            </span>
          </div>

          {/* Divisor x com Metadados Centrais */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '0 20px' }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: '32px', color: 'var(--rule)', fontWeight: 300 }}>×</span>
            <span className="editorial-badge" style={{ fontSize: '9px' }}>
              {matchData?.venue?.name || 'Estádio Oficial'}
            </span>
            {matchData?.officials && matchData.officials.length > 0 && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)' }}>
                Árb: {matchData.officials[0].name}
              </span>
            )}
          </div>

          {/* Visitante */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, justifyContent: 'flex-start', paddingLeft: '20px' }}>
            <span style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(56px, 8vw, 96px)',
              lineHeight: 0.9,
              color: !isHome ? awayTheme.accent : 'var(--ink)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 300,
            }}>
              {awayScore}
            </span>
            <Crest name={matchData?.away_team?.name} alt={matchData?.away_team?.name || 'Visitante'} size={68} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '26px', color: !isHome ? awayTheme.accent : 'var(--ink)', fontWeight: 600 }}>
                {matchData?.away_team?.name}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '11.5px', color: 'var(--ink-2)', marginTop: '4px' }}>
                xG <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{Number(awayXG).toFixed(2)}</span> • Posse <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{awayPoss}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Widget de Probabilidade Implícita das Odds */}
      {impliedOdds && (
        <div style={{ gridColumn: '1 / -1', background: 'var(--bg-1)', border: '1px solid var(--rule)', padding: '12px 20px', borderRadius: '2px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)', marginBottom: '6px' }}>
            <span>PROBABILIDADES PRÉ-JOGO (Cotações {impliedOdds.bookmaker})</span>
            <span>Vitória {matchData?.home_team?.short_name} ({impliedOdds.home}%) • Empate ({impliedOdds.draw}%) • Vitória {matchData?.away_team?.short_name} ({impliedOdds.away}%)</span>
          </div>
          <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', width: '100%' }}>
            <div style={{ width: `${impliedOdds.home}%`, background: homeTheme.accent }} title={`Vitória ${matchData?.home_team?.short_name}: ${impliedOdds.home}%`} />
            <div style={{ width: `${impliedOdds.draw}%`, background: 'var(--rule)' }} title={`Empate: ${impliedOdds.draw}%`} />
            <div style={{ width: `${impliedOdds.away}%`, background: awayTheme.accent }} title={`Vitória ${matchData?.away_team?.short_name}: ${impliedOdds.away}%`} />
          </div>
        </div>
      )}

      {/* Abas Analíticas Superiores */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--rule)', paddingBottom: '8px', marginBottom: '20px' }}>
        <Tabs
          tabs={[
            { id: 'pitch', label: 'CAMPO TÁTICO & CHUTES' },
            { id: 'lineups', label: 'ESCALAÇÕES' },
            { id: 'xgrace', label: 'CORRIDA xG' },
            { id: 'tempo', label: 'RITMO & INTENSIDADE' },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as any)}
        />
        <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
          {visibleShots.length} finalizações filtradas • até {currentTime}'
        </div>
      </div>

      {/* Conteúdo Principal de acordo com a aba ativa */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '32px' }}>
        {/* Painel Esquerdo: Visualização Central */}
        <div style={{ flex: 1, position: 'relative' }}>
          {activeTab === 'pitch' && (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Filtros Analíticos de Chute */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-1)', padding: '8px 14px', border: '1px solid var(--rule)', borderRadius: '2px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)', marginRight: '4px' }}>EQUIPE:</span>
                  <button
                    onClick={() => setShotTeamFilter('all')}
                    className={`header-btn ${shotTeamFilter === 'all' ? 'active' : ''}`}
                    style={{ fontSize: '10px', padding: '3px 8px' }}
                  >
                    AMBOS
                  </button>
                  <button
                    onClick={() => setShotTeamFilter('home')}
                    className={`header-btn ${shotTeamFilter === 'home' ? 'active' : ''}`}
                    style={{ fontSize: '10px', padding: '3px 8px', color: 'var(--accent)' }}
                  >
                    {matchData?.home_team?.short_name}
                  </button>
                  <button
                    onClick={() => setShotTeamFilter('away')}
                    className={`header-btn ${shotTeamFilter === 'away' ? 'active' : ''}`}
                    style={{ fontSize: '10px', padding: '3px 8px', color: 'var(--opp)' }}
                  >
                    {matchData?.away_team?.short_name}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)', marginRight: '4px' }}>DESFECHO:</span>
                  <button
                    onClick={() => setShotResultFilter('all')}
                    className={`header-btn ${shotResultFilter === 'all' ? 'active' : ''}`}
                    style={{ fontSize: '10px', padding: '3px 8px' }}
                  >
                    TODOS
                  </button>
                  <button
                    onClick={() => setShotResultFilter('goal')}
                    className={`header-btn ${shotResultFilter === 'goal' ? 'active' : ''}`}
                    style={{ fontSize: '10px', padding: '3px 8px', color: 'var(--accent)' }}
                  >
                    GOLS ⚽
                  </button>
                  <button
                    onClick={() => setShotResultFilter('saved')}
                    className={`header-btn ${shotResultFilter === 'saved' ? 'active' : ''}`}
                    style={{ fontSize: '10px', padding: '3px 8px', color: 'var(--opp)' }}
                  >
                    DEFESAS 🧤
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)', marginRight: '4px' }}>PERÍODO:</span>
                  <button
                    onClick={() => setShotPeriodFilter('all')}
                    className={`header-btn ${shotPeriodFilter === 'all' ? 'active' : ''}`}
                    style={{ fontSize: '10px', padding: '3px 8px' }}
                  >
                    90M
                  </button>
                  <button
                    onClick={() => setShotPeriodFilter('1h')}
                    className={`header-btn ${shotPeriodFilter === '1h' ? 'active' : ''}`}
                    style={{ fontSize: '10px', padding: '3px 8px' }}
                  >
                    1ºT
                  </button>
                  <button
                    onClick={() => setShotPeriodFilter('2h')}
                    className={`header-btn ${shotPeriodFilter === '2h' ? 'active' : ''}`}
                    style={{ fontSize: '10px', padding: '3px 8px' }}
                  >
                    2ºT
                  </button>
                </div>
              </div>

              <Pitch>
                {/* Isolinhas de xG para os chutes visíveis */}
                {visibleShots.length >= 3 && (
                  <ShotContours
                    shots={visibleShots.map((s) => ({ x: s.x, y: s.y, xG: s.xG }))}
                    color={isHome ? 'var(--accent)' : 'var(--opp)'}
                  />
                )}

                {/* Marcadores de chute com Tooltip Interativo */}
                <ShotMarkers
                  shots={visibleShots}
                  className="pitch-shots"
                />
              </Pitch>
            </div>
          )}

          {activeTab === 'lineups' && (
            <Suspense fallback={<div className="skeleton" style={{ padding: '20px' }}>Carregando escalações...</div>}>
              <TacticalLineup
                homeTeamName={matchData?.home_team?.name || 'Mandante'}
                awayTeamName={matchData?.away_team?.name || 'Visitante'}
                homeStarters={matchData?.lineups?.home?.starters || []}
                homeBench={matchData?.lineups?.home?.bench || []}
                awayStarters={matchData?.lineups?.away?.starters || []}
                awayBench={matchData?.lineups?.away?.bench || []}
                homeFormation={matchData?.lineups?.home?.formation}
                awayFormation={matchData?.lineups?.away?.formation}
              />
            </Suspense>
          )}

          {activeTab === 'xgrace' && (
            <div style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--rule)',
              borderRadius: '2px',
              padding: '24px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span className="label">CORRIDA ACUMULADA DE xG (0' A 90')</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-2)' }}>
                  <span style={{ color: 'var(--accent)' }}>■ {matchData?.home_team?.short_name} ({homeXG.toFixed(2)})</span>
                  {'  •  '}
                  <span style={{ color: 'var(--opp)' }}>■ {matchData?.away_team?.short_name} ({awayXG.toFixed(2)})</span>
                </span>
              </div>
              <XgRace shotsA={shotsA} shotsB={shotsB} matchDuration={90} />
            </div>
          )}

          {activeTab === 'tempo' && (
            <div style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--rule)',
              borderRadius: '2px',
              padding: '24px',
            }}>
              <div className="label" style={{ marginBottom: '16px' }}>
                INTENSIDADE E VOLUME DE FINALIZAÇÕES (BLOCOS DE 5 MINUTOS)
              </div>
              <Suspense fallback={<div style={{ opacity: 0.5 }}>Carregando ritmo...</div>}>
                <ShotTempo shots={allShots} matchDuration={90} windowSize={5} />
              </Suspense>
            </div>
          )}
        </div>

        {/* Painel Direito: Scrubber + Diário de Bordo da Partida */}
        <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Scrubber do Relógio */}
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--rule)', padding: '16px', borderRadius: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div className="label">MINUTO DO JOGO: {currentTime}'</div>
              <button
                onClick={() => setPlaying(!playing)}
                className="header-btn"
                style={{ padding: '2px 8px', fontSize: '9px' }}
              >
                {playing ? 'PAUSAR' : 'PLAY ▶'}
              </button>
            </div>
            <Scrubber
              min={0}
              max={95}
              value={currentTime}
              onChange={setCurrentTime}
              playing={playing}
              onPlay={() => setPlaying(!playing)}
            />
          </div>

          {/* Diário de Chutes e Gols Sincronizado - Virtualizado para performance */}
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--rule)', padding: '16px', borderRadius: '2px' }}>
            <div className="label" style={{ marginBottom: '12px' }}>
              DIÁRIO DE LANCES ({visibleShots.length})
            </div>
            <VirtualizedShotList
              shots={allShots}
              currentTime={currentTime}
              matchData={matchData}
            />
          </div>
        </div>
      </div>

      {/* Estatísticas Consolidadas da Camada Gold */}
      <div style={{ gridColumn: '1 / -1', marginTop: '24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          background: 'var(--bg-1)',
          border: '1px solid var(--rule)',
          padding: '20px',
          borderRadius: '2px',
        }}>
          <Stat value={homeShots.length} label={`Chutes ${matchData?.home_team?.short_name}`} />
          <Stat value={awayShots.length} label={`Chutes ${matchData?.away_team?.short_name}`} />
          <Stat value={homeScore} label={`Gols ${matchData?.home_team?.short_name}`} />
          <Stat value={awayScore} label={`Gols ${matchData?.away_team?.short_name}`} />
          <Stat value={`${homePoss}%`} label={`Posse ${matchData?.home_team?.short_name}`} />
          <Stat value={`${awayPoss}%`} label={`Posse ${matchData?.away_team?.short_name}`} />
          <Stat value={homeXG.toFixed(2)} label={`xG ${matchData?.home_team?.short_name}`} />
          <Stat value={awayXG.toFixed(2)} label={`xG ${matchData?.away_team?.short_name}`} />
        </div>
      </div>
    </div>
  );
}