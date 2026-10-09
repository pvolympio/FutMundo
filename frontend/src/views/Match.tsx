import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useFocus } from '../store/focus';
import { Pitch } from '../charts/Pitch';
import { ShotMarkers } from '../charts/ShotMarkers';
import { XgRace } from '../charts/XgRace';
import { Scrubber } from '../ui/Scrubber';
import { Tabs } from '../ui/Tabs';
import { ShotContours } from '../charts/ShotContours';
import { VirtualizedShotList } from '../lib/VirtualizedShotList';
import { usePageTitle } from '../lib/usePageTitle';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useMatchViewer } from './hooks/useMatchViewer';
import { MatchRoundSelector } from './match/MatchRoundSelector';
import { MatchScoreHero } from './match/MatchScoreHero';
import { MatchStatsGrid } from './match/MatchStatsGrid';

// Lazy load heavy components for better performance
const ShotTempo = lazy(() => import('../charts/ShotTempo'));
const TacticalLineup = lazy(() => import('../charts/TacticalLineup'));

export function Match() {
  const { focus, toggleFocus } = useFocus();

  const {
    selectedRound,
    setSelectedRound,
    selectedMatchId,
    handleSelectMatch,
    roundMatches,
    matchData,
    loading,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    activeTab,
    setActiveTab,
    allShots,
    visibleShots,
    themeHome,
    themeAway,
  } = useMatchViewer();

  // Page title dynamic based on teams
  const matchTitle = matchData?.home_team?.short_name && matchData?.away_team?.short_name
    ? `${matchData.home_team.short_name} ${matchData.score.home} × ${matchData.score.away} ${matchData.away_team.short_name} (R${matchData.matchday})`
    : 'Análise de Partida';
  usePageTitle(matchTitle);

  // Filtros interativos para o mapa de chutes
  const [shotTeamFilter, setShotTeamFilter] = useState<'all' | 'home' | 'away'>('all');
  const [shotPeriodFilter, setShotPeriodFilter] = useState<'all' | '1h' | '2h'>('all');
  const [shotResultFilter, setShotResultFilter] = useState<'all' | 'goal' | 'saved' | 'miss'>('all');

  const isHome = focus === 'home';

  // Keyboard shortcut to switch tactical focus (F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'f' || e.key === 'F') toggleFocus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFocus]);

  // Apply visual filters on shots
  const pitchShots = useMemo(() => {
    return visibleShots.filter((s) => {
      if (shotTeamFilter === 'home' && !s.home) return false;
      if (shotTeamFilter === 'away' && s.home) return false;

      if (shotPeriodFilter === '1h' && s.minute > 45) return false;
      if (shotPeriodFilter === '2h' && s.minute <= 45) return false;

      if (shotResultFilter === 'goal' && s.result !== 'goal') return false;
      if (shotResultFilter === 'saved' && s.result !== 'saved') return false;
      if (shotResultFilter === 'miss' && (s.result === 'goal' || s.result === 'saved')) return false;

      return true;
    });
  }, [visibleShots, shotTeamFilter, shotPeriodFilter, shotResultFilter]);

  const homeShots = pitchShots.filter((s) => s.home);
  const awayShots = pitchShots.filter((s) => !s.home);

  // Shots for xG race
  const shotsA = useMemo(() => allShots.filter((s) => s.home).map((s) => ({ minute: s.minute, xG: s.xG })), [allShots]);
  const shotsB = useMemo(() => allShots.filter((s) => !s.home).map((s) => ({ minute: s.minute, xG: s.xG })), [allShots]);

  // Odds calculation
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
      <MatchRoundSelector
        selectedRound={selectedRound}
        onRoundChange={setSelectedRound}
        roundMatches={roundMatches}
        selectedMatchId={selectedMatchId}
        onSelectMatch={handleSelectMatch}
        focusName={isHome ? matchData?.home_team?.short_name : matchData?.away_team?.short_name}
        isHomeFocus={isHome}
      />

      {/* Score Hero com Escudos Oficiais Vetoriais */}
      <MatchScoreHero
        loading={loading}
        matchData={matchData}
        homeTheme={themeHome}
        awayTheme={themeAway}
        isHomeFocus={isHome}
        homeScore={homeScore}
        awayScore={awayScore}
        homeXG={homeXG}
        awayXG={awayXG}
        homePoss={homePoss}
        awayPoss={awayPoss}
        impliedOdds={impliedOdds}
      />

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
          onChange={(tab) => setActiveTab(tab as 'pitch' | 'lineups' | 'xgrace' | 'tempo')}
        />
        <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
          {pitchShots.length} finalizações filtradas • até {currentTime}'
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

              <ErrorBoundary fallbackTitle="Erro ao carregar o campo tático">
                <Pitch>
                  {/* Isolinhas de xG para os chutes visíveis */}
                  {pitchShots.length >= 3 && (
                    <ShotContours
                      shots={pitchShots.map((s) => ({ x: s.x, y: s.y, xG: s.xG }))}
                      color={isHome ? 'var(--accent)' : 'var(--opp)'}
                    />
                  )}

                  {/* Marcadores de chute com Tooltip Interativo */}
                  <ShotMarkers
                    shots={pitchShots}
                    className="pitch-shots"
                  />
                </Pitch>
              </ErrorBoundary>
            </div>
          )}

          {activeTab === 'lineups' && (
            <ErrorBoundary fallbackTitle="Erro ao carregar as escalações">
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
            </ErrorBoundary>
          )}

          {activeTab === 'xgrace' && (
            <ErrorBoundary fallbackTitle="Erro ao carregar a corrida de xG">
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
            </ErrorBoundary>
          )}

          {activeTab === 'tempo' && (
            <ErrorBoundary fallbackTitle="Erro ao carregar o gráfico de ritmo">
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
            </ErrorBoundary>
          )}
        </div>

        {/* Painel Direito: Scrubber + Diário de Bordo da Partida */}
        <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Scrubber do Relógio */}
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--rule)', padding: '16px', borderRadius: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div className="label">MINUTO DO JOGO: {currentTime}'</div>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="header-btn"
                style={{ padding: '2px 8px', fontSize: '9px' }}
              >
                {isPlaying ? 'PAUSAR' : 'PLAY ▶'}
              </button>
            </div>
            <Scrubber
              min={0}
              max={95}
              value={currentTime}
              onChange={setCurrentTime}
              playing={isPlaying}
              onPlay={() => setIsPlaying(!isPlaying)}
            />
          </div>

          {/* Diário de Chutes e Gols Sincronizado - Virtualizado para performance */}
          <ErrorBoundary fallbackTitle="Erro ao carregar o diário de lances">
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--rule)', padding: '16px', borderRadius: '2px' }}>
              <div className="label" style={{ marginBottom: '12px' }}>
                DIÁRIO DE LANCES ({pitchShots.length})
              </div>
              <VirtualizedShotList
                shots={allShots}
                currentTime={currentTime}
                matchData={matchData}
              />
            </div>
          </ErrorBoundary>
        </div>
      </div>

      {/* Estatísticas Consolidadas da Camada Gold */}
      <MatchStatsGrid
        homeTeamShort={matchData?.home_team?.short_name}
        awayTeamShort={matchData?.away_team?.short_name}
        homeShotsCount={homeShots.length}
        awayShotsCount={awayShots.length}
        homeScore={homeScore}
        awayScore={awayScore}
        homePoss={homePoss}
        awayPoss={awayPoss}
        homeXG={homeXG}
        awayXG={awayXG}
      />
    </div>
  );
}