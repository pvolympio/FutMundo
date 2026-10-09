import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTeams, useTeamH2H } from '../lib/queries';
import type { TeamItem } from '../lib/api';
import { Crest } from '../ui/Crest';
import { Skeleton } from '../ui/Skeleton';
import { usePageTitle } from '../lib/usePageTitle';
import { getClubTheme } from '../lib/clubColors';

export function Head2Head() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramA = searchParams.get('t1');
  const paramB = searchParams.get('t2');

  const teamAId = paramA ? Number(paramA) : 18; // Man City default
  const teamBId = paramB ? Number(paramB) : 3;  // Arsenal default

  const setTeamAId = (newA: number) => {
    setSearchParams({ t1: String(newA), t2: String(teamBId) });
  };
  const setTeamBId = (newB: number) => {
    setSearchParams({ t1: String(teamAId), t2: String(newB) });
  };

  const { data: teamsRaw } = useTeams();
  const teams = useMemo<TeamItem[]>(() => {
    if (Array.isArray(teamsRaw)) return teamsRaw;
    return [];
  }, [teamsRaw]);
  const { data: h2hData, isLoading: loading } = useTeamH2H(teamAId, teamBId);

  const teamAName = h2hData?.team_a?.name || teams.find((t) => t.team_id === teamAId)?.canonical_name || 'Equipe A';
  const teamBName = h2hData?.team_b?.name || teams.find((t) => t.team_id === teamBId)?.canonical_name || 'Equipe B';
  const summary = h2hData?.summary || { total_matches: 0, team_a_wins: 0, team_b_wins: 0, draws: 0 };
  const recentMatches = h2hData?.recent_matches || [];

  const themeA = getClubTheme(teamAName);
  const themeB = getClubTheme(teamBName);

  usePageTitle(`${teamAName} × ${teamBName} • Raio-X H2H`);

  return (
    <div className="h2h-container">
      {/* Seletores Dinâmicos de Clubes com Escudos */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-1)',
        border: '1px solid var(--rule)',
        padding: '16px 24px',
        borderRadius: '2px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Crest name={teamAName} alt={teamAName} size={36} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span className="label" style={{ color: themeA.accent, fontWeight: 700 }}>CLUBE A (MANDANTE):</span>
            <select
              value={teamAId}
              onChange={(e) => setTeamAId(Number(e.target.value))}
              style={{
                background: 'var(--bg-2)',
                border: `1px solid ${themeA.border}`,
                color: 'var(--ink)',
                fontFamily: 'var(--mono)',
                fontSize: '13px',
                padding: '6px 12px',
                borderRadius: '2px',
                cursor: 'pointer',
              }}
            >
              {teams.map((t) => (
                <option key={t.team_id} value={t.team_id} disabled={t.team_id === teamBId}>
                  {t.canonical_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ fontFamily: 'var(--serif)', fontSize: '28px', color: 'var(--rule)', fontWeight: 300 }}>×</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
            <span className="label" style={{ color: themeB.accent, fontWeight: 700 }}>CLUBE B (ADVERSÁRIO):</span>
            <select
              value={teamBId}
              onChange={(e) => setTeamBId(Number(e.target.value))}
              style={{
                background: 'var(--bg-2)',
                border: `1px solid ${themeB.border}`,
                color: 'var(--ink)',
                fontFamily: 'var(--mono)',
                fontSize: '13px',
                padding: '6px 12px',
                borderRadius: '2px',
                cursor: 'pointer',
              }}
            >
              {teams.map((t) => (
                <option key={t.team_id} value={t.team_id} disabled={t.team_id === teamAId}>
                  {t.canonical_name}
                </option>
              ))}
            </select>
          </div>
          <Crest name={teamBName} alt={teamBName} size={36} />
        </div>
      </div>

      {/* Header do Confronto com Escudos Grandes e Wash Split Dual-Club */}
      <div
        style={{
          gridColumn: '1 / -1',
          textAlign: 'center',
          marginBottom: '32px',
          padding: '36px 20px',
          borderRadius: '4px',
          border: '1px solid var(--rule)',
          background: `radial-gradient(ellipse at 15% 45%, ${themeA.wash} 0%, transparent 60%), radial-gradient(ellipse at 85% 45%, ${themeB.wash} 0%, transparent 60%), var(--bg-1)`,
          boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div className="label" style={{ color: 'var(--ink-2)', marginBottom: '12px', letterSpacing: '0.08em' }}>
          RAIO-X DO CONFRONTO DIRETO OFICIAL
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '12px' }}>
          <Crest name={teamAName} alt={teamAName} size={64} />
          <h1 className="title" style={{ fontSize: 'clamp(32px, 5.5vw, 56px)', margin: 0, fontFamily: 'var(--serif)' }}>
            <span style={{ color: themeA.accent }}>{teamAName}</span>
            <span style={{ color: 'var(--rule)', margin: '0 16px' }}>×</span>
            <span style={{ color: themeB.accent }}>{teamBName}</span>
          </h1>
          <Crest name={teamBName} alt={teamBName} size={64} />
        </div>
        <div className="label" style={{ color: 'var(--ink-3)' }}>
          {summary.total_matches} CONFRONTOS DIRETOS REGISTRADOS
        </div>
      </div>

      {/* Cartões de Histórico com Top-Border de Cada Clube */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '24px',
        textAlign: 'center',
        marginBottom: '36px',
      }}>
        <div
          className="editorial-card"
          style={{
            borderTop: `3px solid ${themeA.primary}`,
            boxShadow: `0 4px 20px ${themeA.glow}`,
          }}
        >
          <div className="label" style={{ color: themeA.accent, marginBottom: '8px', fontWeight: 700 }}>
            VITÓRIAS {teamAName.toUpperCase()}
          </div>
          <div className="num" style={{ fontSize: '56px', color: themeA.accent }}>
            {summary.team_a_wins}
          </div>
          <div className="caption" style={{ color: 'var(--ink-3)' }}>
            {summary.total_matches > 0 ? `${((summary.team_a_wins / summary.total_matches) * 100).toFixed(0)}% de aproveitamento` : '0%'}
          </div>
        </div>

        <div className="editorial-card" style={{ borderTop: '3px solid var(--rule)' }}>
          <div className="label" style={{ color: 'var(--ink-2)', marginBottom: '8px' }}>EMPATES</div>
          <div className="num" style={{ fontSize: '56px', color: 'var(--ink)' }}>{summary.draws}</div>
          <div className="caption" style={{ color: 'var(--ink-3)' }}>
            {summary.total_matches > 0 ? `${((summary.draws / summary.total_matches) * 100).toFixed(0)}% das partidas` : '0%'}
          </div>
        </div>

        <div
          className="editorial-card"
          style={{
            borderTop: `3px solid ${themeB.primary}`,
            boxShadow: `0 4px 20px ${themeB.glow}`,
          }}
        >
          <div className="label" style={{ color: themeB.accent, marginBottom: '8px', fontWeight: 700 }}>
            VITÓRIAS {teamBName.toUpperCase()}
          </div>
          <div className="num" style={{ fontSize: '56px', color: themeB.accent }}>
            {summary.team_b_wins}
          </div>
          <div className="caption" style={{ color: 'var(--ink-3)' }}>
            {summary.total_matches > 0 ? `${((summary.team_b_wins / summary.total_matches) * 100).toFixed(0)}% de aproveitamento` : '0%'}
          </div>
        </div>
      </div>

      {/* Lista de Partidas Recentes */}
      <div style={{ gridColumn: '1 / -1', background: 'var(--bg-1)', border: '1px solid var(--rule)', padding: '24px', borderRadius: '2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px', borderBottom: '1px solid var(--rule)', paddingBottom: '8px' }}>
          <h2 className="title" style={{ fontSize: '20px', margin: 0 }}>Histórico de Duelos Oficiais</h2>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
            Fonte: Banco de Dados PostgreSQL FUTFUT
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} role="status" aria-busy="true">
            <Skeleton variant="rect" count={3} />
          </div>
        ) : recentMatches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>
            Nenhum confronto histórico recente registrado entre os dois clubes.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentMatches.map((m: any, idx: number) => {
              const dateStr = m.match_date ? m.match_date.split('T')[0] : 'Data N/D';
              const isWinA = m.winner_team_id === teamAId;
              const isWinB = m.winner_team_id === teamBId;

              return (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr 140px 150px',
                    alignItems: 'center',
                    padding: '12px 18px',
                    background: idx === 0 ? 'var(--accent-wash)' : 'var(--bg-2)',
                    border: '1px solid var(--rule)',
                    borderRadius: '2px',
                    fontFamily: 'var(--mono)',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ color: 'var(--ink-3)' }}>{dateStr}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                    <Crest name={m.home_team?.name} alt={m.home_team?.name} size={20} />
                    <span>{m.home_team?.name}</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700, margin: '0 4px' }}>
                      {m.home_score} × {m.away_score}
                    </span>
                    <span>{m.away_team?.name}</span>
                    <Crest name={m.away_team?.name} alt={m.away_team?.name} size={20} />
                  </div>
                  <div style={{ color: 'var(--ink-2)', fontSize: '11px' }}>{m.venue || 'Estádio Oficial'}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: isWinA ? themeA.accent : isWinB ? themeB.accent : 'var(--ink-3)' }}>
                    {isWinA ? `Vitória ${teamAName}` : isWinB ? `Vitória ${teamBName}` : 'Empate'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}