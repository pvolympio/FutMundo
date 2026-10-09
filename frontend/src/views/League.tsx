import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStandings, usePlayerRankings } from '../lib/queries';
import { StandingsTable } from '../charts/StandingsTable';
import { PlayerLeaderboard } from '../charts/PlayerLeaderboard';
import { Crest } from '../ui/Crest';
import { Skeleton } from '../ui/Skeleton';
import { usePageTitle } from '../lib/usePageTitle';

export function League() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramRound = searchParams.get('round');
  const initialRound = paramRound ? Math.max(1, Math.min(38, Number(paramRound))) : 38;

  const [round, setRoundState] = useState<number>(initialRound);
  const [animating, setAnimating] = useState<boolean>(false);

  const setRound = (val: number | ((prev: number) => number)) => {
    setRoundState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      setSearchParams({ round: String(next) });
      return next;
    });
  };

  usePageTitle(`Classificação & Rankings • Rodada ${round}`);

  const [activeTab, setActiveTab] = useState<'standings' | 'goals' | 'assists' | 'xg' | 'xa'>('standings');

  const { data: standings = [], isLoading: loading } = useStandings(round);
  const { data: topScorers = [], isLoading: loadingScorers } = usePlayerRankings('goals', 20);
  const { data: topAssists = [], isLoading: loadingAssists } = usePlayerRankings('assists', 20);
  const { data: topXg = [], isLoading: loadingXg } = usePlayerRankings('xg', 20);
  const { data: topXa = [], isLoading: loadingXa } = usePlayerRankings('xa', 20);

  // Animação da tabela evoluindo rodada a rodada
  useEffect(() => {
    if (!animating) return;
    const interval = setInterval(() => {
      setRound((prev) => {
        if (prev >= 38) {
          setAnimating(false);
          return 38;
        }
        return prev + 1;
      });
    }, 600);
    return () => clearInterval(interval);
  }, [animating]);

  // Formatar dados para StandingsTable
  const formattedData = standings.map((s, idx) => ({
    position: s.position || idx + 1,
    team: s.team_name || s.team || 'Clube',
    played: s.played,
    won: s.won,
    drawn: s.drawn,
    lost: s.lost,
    gf: s.goals_for ?? s.gf ?? 0,
    ga: s.goals_against ?? s.ga ?? 0,
    gd: s.goal_difference ?? s.gd ?? (s.goals_for ?? 0) - (s.goals_against ?? 0),
    pts: s.points ?? s.pts ?? 0,
  }));

  const leader = formattedData[0];
  const bestAttack = [...formattedData].sort((a, b) => b.gf - a.gf)[0];
  const bestDefense = [...formattedData].sort((a, b) => a.ga - b.ga)[0];

  return (
    <div className="league-container">
      {/* Header */}
      <div style={{ gridColumn: '1 / -1', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div className="label" style={{ color: 'var(--accent)' }}>
            TABELA OFICIAL DA PREMIER LEAGUE 2024/25
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => {
                if (animating) {
                  setAnimating(false);
                } else {
                  if (round >= 38) setRound(1);
                  setAnimating(true);
                }
              }}
              className="header-btn"
              style={{ fontSize: '10px' }}
            >
              {animating ? 'PAUSAR EVOLUÇÃO' : 'EVOLUÇÃO AUTOMÁTICA ▶'}
            </button>
            <span className="editorial-badge">RODADA {round} DE 38</span>
          </div>
        </div>

        <h1 className="title" style={{ fontSize: 'clamp(32px, 5vw, 48px)', margin: '0 0 8px 0', fontFamily: 'var(--serif)' }}>
          Classificação do Campeonato
        </h1>
        <p className="caption" style={{ margin: 0, color: 'var(--ink-2)' }}>
          Arraste o controle deslizante abaixo para conferir a tabela em qualquer momento da temporada.
        </p>
      </div>

      {/* Slider de Rodadas */}
      <div style={{
        gridColumn: '1 / -1',
        background: 'var(--bg-1)',
        border: '1px solid var(--rule)',
        borderRadius: '2px',
        padding: '16px 24px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)', marginBottom: '8px' }}>
          <span>RODADA 1 (INÍCIO)</span>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>RODADA SELECIONADA: {round}</span>
          <span>RODADA 38 (FINAL)</span>
        </div>
        <input
          type="range"
          min={1}
          max={38}
          value={round}
          onChange={(e) => {
            setAnimating(false);
            setRound(Number(e.target.value));
          }}
          style={{
            width: '100%',
            accentColor: 'var(--accent)',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Cards de Destaque da Rodada */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="editorial-card">
          <div className="label" style={{ color: 'var(--accent)', marginBottom: '8px' }}>LÍDER NA RODADA {round}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {leader && <Crest name={leader.team} alt={leader.team} size={36} />}
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', color: 'var(--ink)' }}>{leader ? leader.team : '...'}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-2)', marginTop: '2px' }}>
                {leader ? `${leader.pts} pts • ${leader.won}V ${leader.drawn}E ${leader.lost}D • Saldo ${leader.gd > 0 ? '+' : ''}${leader.gd}` : ''}
              </div>
            </div>
          </div>
        </div>

        <div className="editorial-card">
          <div className="label" style={{ color: 'var(--up)', marginBottom: '8px' }}>MELHOR ATAQUE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {bestAttack && <Crest name={bestAttack.team} alt={bestAttack.team} size={36} />}
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', color: 'var(--ink)' }}>{bestAttack ? bestAttack.team : '...'}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-2)', marginTop: '2px' }}>
                {bestAttack ? `${bestAttack.gf} gols pró (${(bestAttack.gf / (bestAttack.played || 1)).toFixed(2)} por jogo)` : ''}
              </div>
            </div>
          </div>
        </div>

        <div className="editorial-card">
          <div className="label" style={{ color: 'var(--opp)', marginBottom: '8px' }}>DEFESA MENOS VAZADA</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {bestDefense && <Crest name={bestDefense.team} alt={bestDefense.team} size={36} />}
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', color: 'var(--ink)' }}>{bestDefense ? bestDefense.team : '...'}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-2)', marginTop: '2px' }}>
                {bestDefense ? `${bestDefense.ga} gols sofridos (${(bestDefense.ga / (bestDefense.played || 1)).toFixed(2)} por jogo)` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Abas de Tabela Geral e Líderes Individuais */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '16px',
        }}
      >
        {[
          { id: 'standings', label: 'Tabela de Classificação' },
          { id: 'goals', label: 'Artilharia (Gols)' },
          { id: 'assists', label: 'Garçons (Assistências)' },
          { id: 'xg', label: 'Gols Esperados (xG)' },
          { id: 'xa', label: 'Assist. Esperadas (xA)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`header-btn ${activeTab === tab.id ? 'active' : ''}`}
            style={{ padding: '8px 16px', fontSize: '12px', fontFamily: 'var(--mono)' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div style={{ gridColumn: '1 / -1', background: 'var(--bg-1)', border: '1px solid var(--rule)', padding: '24px', borderRadius: '2px' }}>
        {activeTab === 'standings' && (
          loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} role="status" aria-busy="true">
              <Skeleton variant="rect" count={6} />
            </div>
          ) : (
            <StandingsTable data={formattedData} round={String(round)} />
          )
        )}

        {activeTab === 'goals' && (
          <PlayerLeaderboard items={topScorers} metric="goals" isLoading={loadingScorers} />
        )}

        {activeTab === 'assists' && (
          <PlayerLeaderboard items={topAssists} metric="assists" isLoading={loadingAssists} />
        )}

        {activeTab === 'xg' && (
          <PlayerLeaderboard items={topXg} metric="xg" isLoading={loadingXg} />
        )}

        {activeTab === 'xa' && (
          <PlayerLeaderboard items={topXa} metric="xa" isLoading={loadingXa} />
        )}
      </div>
    </div>
  );
}