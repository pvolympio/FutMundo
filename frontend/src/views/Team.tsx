import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTeamProfile, useTeamSeason, useTeams } from '../lib/queries';
import type { TeamItem } from '../lib/api';
import { Crest } from '../ui/Crest';
import { getClubTheme } from '../lib/clubColors';
import { TeamTrend } from '../charts/TeamTrend';
import { Skeleton } from '../ui/Skeleton';

export function Team() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const teamId = id ? parseInt(id, 10) : undefined;

  // Global teams list for selector & directory
  const { data: teamsListRaw, isLoading: isListLoading } = useTeams();
  const teamsList = useMemo<TeamItem[]>(() => {
    if (Array.isArray(teamsListRaw)) return teamsListRaw;
    if (teamsListRaw && Array.isArray((teamsListRaw as any).items)) return (teamsListRaw as any).items;
    return [];
  }, [teamsListRaw]);

  // If a specific team is selected, fetch its profile & season data
  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    refetch: refetchProfile,
  } = useTeamProfile(teamId || 0);

  const {
    data: season,
    isLoading: isSeasonLoading,
    isError: isSeasonError,
    refetch: refetchSeason,
  } = useTeamSeason(teamId || 0);

  // Position filter for squad table
  const [squadFilter, setSquadFilter] = useState<string>('all');
  // Match history view mode
  const [matchFilter, setMatchFilter] = useState<'all' | 'V' | 'E' | 'D'>('all');

  const isLoading = isProfileLoading || isSeasonLoading;
  const isError = isProfileError || isSeasonError;

  // Title update
  useEffect(() => {
    if (profile?.canonical_name) {
      document.title = `${profile.canonical_name} • FUTFUT Premier League`;
    } else if (!teamId) {
      document.title = 'Clubes • FUTFUT Premier League';
    }
  }, [profile?.canonical_name, teamId]);

  const clubTheme = useMemo(() => {
    return getClubTheme(profile?.canonical_name || '');
  }, [profile?.canonical_name]);

  // Filtered squad
  const filteredSquad = useMemo(() => {
    if (!season?.squad) return [];
    if (squadFilter === 'all') return season.squad;

    const lineMap: Record<string, string> = {
      gk: 'goalkeeper',
      def: 'defender',
      mid: 'midfielder',
      att: 'forward',
    };
    const targetLine = lineMap[squadFilter];
    return season.squad.filter(p => p.line === targetLine);
  }, [season?.squad, squadFilter]);

  // Filtered matches
  const filteredMatches = useMemo(() => {
    if (!season?.matches) return [];
    if (matchFilter === 'all') return season.matches;
    return season.matches.filter(m => m.result === matchFilter);
  }, [season?.matches, matchFilter]);

  // =========================================================================
  // VIEW 1: Directory of 20 clubs (when no :id in URL)
  // =========================================================================
  if (!teamId) {
    return (
      <div className="team-container" style={{ padding: '32px 0' }}>
        <div style={{ gridColumn: '1 / -1', marginBottom: '32px' }}>
          <div className="label" style={{ color: 'var(--accent)', marginBottom: '8px' }}>
            PREMIER LEAGUE 2024-25 • DIRETÓRIO DE CLUBES
          </div>
          <h1
            className="title"
            style={{
              fontSize: 'clamp(32px, 5vw, 48px)',
              margin: '0 0 12px 0',
              fontFamily: 'var(--serif)',
            }}
          >
            Clubes da Competição
          </h1>
          <p style={{ color: 'var(--ink-2)', maxWidth: '680px', margin: 0, fontSize: '15px', lineHeight: 1.5 }}>
            Selecione uma equipe para acessar o dossiê tático completo: qualidade ofensiva e defensiva em xG,
            desempenho rodada a rodada e elenco com minutagem real.
          </p>
        </div>

        {isListLoading ? (
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            <Skeleton variant="rect" count={8} className="skeleton-card" />
          </div>
        ) : (
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {teamsList?.map(team => {
              const cardTheme = getClubTheme(team.canonical_name);
              return (
                <Link
                  key={team.team_id}
                  to={`/team/${team.team_id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    className="editorial-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '20px',
                      height: '100%',
                      cursor: 'pointer',
                      borderTop: `3px solid ${cardTheme.primary}`,
                      transition: 'border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = cardTheme.accent;
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = `0 8px 24px ${cardTheme.glow}`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--rule)';
                      e.currentTarget.style.borderTopColor = cardTheme.primary;
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <Crest name={team.canonical_name} alt={team.canonical_name} size={48} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
                        {team.canonical_name}
                      </div>
                      <div style={{ color: 'var(--ink-3)', fontSize: '12px', fontFamily: 'var(--mono)', marginTop: '4px' }}>
                        {team.venue_name || 'Estádio Principal'} {team.city ? `• ${team.city}` : ''}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: Error State
  // =========================================================================
  if (isError) {
    return (
      <div className="team-container" style={{ padding: '60px 0', textAlign: 'center' }}>
        <div style={{ gridColumn: '1 / -1' }} className="editorial-card">
          <div className="label" style={{ color: 'var(--down)', marginBottom: '12px' }}>
            ERRO DE SINCRONIZAÇÃO
          </div>
          <h2 className="title" style={{ fontFamily: 'var(--serif)', marginBottom: '16px' }}>
            Não foi possível carregar os dados deste clube
          </h2>
          <p style={{ color: 'var(--ink-2)', maxWidth: '480px', margin: '0 auto 24px auto', fontSize: '14px' }}>
            Verifique se a API backend está ativa ou tente novamente.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                refetchProfile();
                refetchSeason();
              }}
              className="header-btn active"
              style={{ padding: '8px 20px' }}
            >
              Tentar Novamente
            </button>
            <Link to="/team" className="header-btn" style={{ padding: '8px 20px', textDecoration: 'none' }}>
              Voltar ao Diretório
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: Specific Team Dashboard
  // =========================================================================
  const summary = season?.summary;
  const standings = profile?.standings;
  const venue = profile?.venue;

  return (
    <div className="team-container" style={{ padding: '24px 0 60px 0' }}>
      {/* Quick Team Switcher Pills */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--rule-soft)',
          scrollbarWidth: 'thin',
        }}
      >
        <Link
          to="/team"
          className="header-btn"
          style={{
            padding: '6px 12px',
            fontSize: '11px',
            fontFamily: 'var(--mono)',
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
        >
          ← Todos os Clubes
        </Link>
        {teamsList?.map(t => {
          const isCurrent = t.team_id === teamId;
          return (
            <button
              key={t.team_id}
              onClick={() => navigate(`/team/${t.team_id}`)}
              className={`header-btn ${isCurrent ? 'active' : ''}`}
              style={{
                padding: '6px 14px',
                fontSize: '11px',
                fontFamily: 'var(--mono)',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                ...(isCurrent
                  ? {
                      background: clubTheme.primary,
                      color: clubTheme.textOnPrimary,
                      borderColor: clubTheme.primary,
                      boxShadow: `0 2px 10px ${clubTheme.glow}`,
                      fontWeight: 700,
                    }
                  : {}),
              }}
            >
              <Crest name={t.canonical_name} alt={t.canonical_name} size={16} />
              {t.short_name || t.canonical_name}
            </button>
          );
        })}
      </div>

      {/* Main Club Header with Ambient Wash */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '24px',
          marginBottom: '32px',
          padding: '28px',
          borderRadius: '4px',
          border: `1px solid ${clubTheme.border}`,
          background: `radial-gradient(ellipse at 12% 35%, ${clubTheme.wash} 0%, transparent 68%), var(--bg-1)`,
          boxShadow: `0 10px 32px ${clubTheme.glow}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {isLoading ? (
            <Skeleton variant="circle" className="skeleton-avatar" />
          ) : (
            <Crest
              name={profile?.canonical_name}
              alt={profile?.canonical_name || 'Clube'}
              size={68}
            />
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className="label" style={{ color: clubTheme.accent, fontWeight: 700 }}>
                PREMIER LEAGUE 2024-25
              </span>
              {standings?.position && (
                <span
                  style={{
                    background: clubTheme.primary,
                    color: clubTheme.textOnPrimary,
                    border: `1px solid ${clubTheme.border}`,
                    padding: '2px 8px',
                    borderRadius: '2px',
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {standings.position}º LUGAR
                </span>
              )}
            </div>

            <h1
              className="title"
              style={{
                fontSize: 'clamp(28px, 4.5vw, 44px)',
                margin: 0,
                fontFamily: 'var(--serif)',
                lineHeight: 1.1,
              }}
            >
              {isLoading ? <Skeleton variant="text" count={1} /> : profile?.canonical_name}
            </h1>

            <div
              style={{
                color: 'var(--ink-2)',
                fontSize: '13px',
                fontFamily: 'var(--mono)',
                marginTop: '8px',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <span>Estádio: {venue?.name || 'Não informado'}</span>
              {venue?.city && <span>• Cidade: {venue.city}</span>}
              {profile?.manager?.name && <span>• Treinador: {profile.manager.name}</span>}
            </div>
          </div>
        </div>

        {/* Form strip in header */}
        {profile?.form?.last_5 && profile.form.last_5.length > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div className="label" style={{ marginBottom: '8px' }}>FORMA RECENTE</div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              {/* Reverse so it reads chronological (oldest to newest) */}
              {[...profile.form.last_5].reverse().map((res, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    background: res === 'V' ? '#10b981' : res === 'E' ? '#f59e0b' : '#ef4444',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '12px',
                    fontFamily: 'var(--mono)',
                    borderRadius: '3px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  }}
                  title={res === 'V' ? 'Vitória' : res === 'E' ? 'Empate' : 'Derrota'}
                >
                  {res}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {/* Card 1: Campanha */}
        <div className="editorial-card">
          <div className="label" style={{ marginBottom: '6px' }}>CAMPANHA (38J)</div>
          <div className="num" style={{ fontSize: '28px', color: 'var(--ink)' }}>
            {summary ? `${summary.wins}V ${summary.draws}E ${summary.losses}D` : '-'}
          </div>
          <div style={{ color: 'var(--ink-3)', fontSize: '11px', fontFamily: 'var(--mono)', marginTop: '4px' }}>
            {summary ? `${summary.points} pts (${Math.round((summary.points / 114) * 100)}% aproveitamento)` : '-'}
          </div>
        </div>

        {/* Card 2: Gols */}
        <div className="editorial-card">
          <div className="label" style={{ marginBottom: '6px' }}>GOLS PRÓ / CONTRA</div>
          <div className="num" style={{ fontSize: '28px', color: 'var(--ink)' }}>
            {summary ? `${summary.goals_for} : ${summary.goals_against}` : '-'}
          </div>
          <div style={{ color: 'var(--ink-3)', fontSize: '11px', fontFamily: 'var(--mono)', marginTop: '4px' }}>
            Saldo: {summary ? `${summary.goal_difference > 0 ? '+' : ''}${summary.goal_difference}` : '-'} • Média: {summary ? (summary.goals_for / 38).toFixed(2) : '-'} / j
          </div>
        </div>

        {/* Card 3: xG Total */}
        <div className="editorial-card">
          <div className="label" style={{ marginBottom: '6px' }}>xG PRÓ / CONTRA</div>
          <div className="num" style={{ fontSize: '28px', color: clubTheme.accent }}>
            {summary ? `${summary.xg_for.toFixed(1)} : ${summary.xg_against.toFixed(1)}` : '-'}
          </div>
          <div style={{ color: 'var(--ink-3)', fontSize: '11px', fontFamily: 'var(--mono)', marginTop: '4px' }}>
            Saldo xG: {summary ? `${summary.xg_difference > 0 ? '+' : ''}${summary.xg_difference.toFixed(1)}` : '-'}
          </div>
        </div>

        {/* Card 4: Eficiência (Gols - xG) */}
        <div className="editorial-card">
          <div className="label" style={{ marginBottom: '6px' }}>EFICIÊNCIA (GOLS - xG)</div>
          <div
            className="num"
            style={{
              fontSize: '28px',
              color: summary && summary.goals_minus_xg >= 0 ? '#10b981' : '#ef4444',
            }}
          >
            {summary ? `${summary.goals_minus_xg > 0 ? '+' : ''}${summary.goals_minus_xg.toFixed(1)}` : '-'}
          </div>
          <div style={{ color: 'var(--ink-3)', fontSize: '11px', fontFamily: 'var(--mono)', marginTop: '4px' }}>
            {summary && summary.goals_minus_xg >= 0 ? 'Superou a expectativa em xG' : 'Abaixo da expectativa em xG'}
          </div>
        </div>

        {/* Card 5: Finalizações */}
        <div className="editorial-card">
          <div className="label" style={{ marginBottom: '6px' }}>FINALIZAÇÕES</div>
          <div className="num" style={{ fontSize: '28px', color: 'var(--ink)' }}>
            {summary ? `${summary.shots_for} : ${summary.shots_against}` : '-'}
          </div>
          <div style={{ color: 'var(--ink-3)', fontSize: '11px', fontFamily: 'var(--mono)', marginTop: '4px' }}>
            Média: {summary ? (summary.shots_for / 38).toFixed(1) : '-'} chutes pró / jogo
          </div>
        </div>

        {/* Card 6: Baliza a Zero */}
        <div className="editorial-card">
          <div className="label" style={{ marginBottom: '6px' }}>JOGOS SEM SOFRER GOL</div>
          <div className="num" style={{ fontSize: '28px', color: 'var(--ink)' }}>
            {summary ? `${summary.clean_sheets}` : '-'}
          </div>
          <div style={{ color: 'var(--ink-3)', fontSize: '11px', fontFamily: 'var(--mono)', marginTop: '4px' }}>
            {summary ? `${Math.round((summary.clean_sheets / 38) * 100)}% das partidas` : '-'}
          </div>
        </div>
      </div>

      {/* Tactical Trend Section */}
      <div
        className="editorial-card"
        style={{
          gridColumn: '1 / -1',
          marginBottom: '36px',
          padding: '24px',
        }}
      >
        {isLoading ? (
          <Skeleton variant="rect" count={1} className="skeleton-chart" />
        ) : (
          <TeamTrend
            matches={season?.matches || []}
            accentColor={clubTheme.accent}
          />
        )}
      </div>

      {/* Squad Table Section */}
      <div
        style={{
          gridColumn: '1 / -1',
          marginBottom: '40px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <div>
            <div className="label" style={{ color: clubTheme.accent, marginBottom: '4px' }}>
              ELENCO NA TEMPORADA • DADOS REAIS DE SÚMULA
            </div>
            <h2 className="title" style={{ fontSize: '24px', margin: 0, fontFamily: 'var(--serif)' }}>
              Atletas e Produção ({season?.squad?.length || 0} jogadores)
            </h2>
          </div>

          {/* Position filter buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'all', label: 'Todos' },
              { id: 'gk', label: 'Goleiros' },
              { id: 'def', label: 'Defensores' },
              { id: 'mid', label: 'Meio-campo' },
              { id: 'att', label: 'Atacantes' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSquadFilter(tab.id)}
                className={`header-btn ${squadFilter === tab.id ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: '11px', fontFamily: 'var(--mono)' }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="editorial-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="standings-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: '20px' }}>Atleta</th>
                <th style={{ textAlign: 'left' }}>Posição</th>
                <th style={{ textAlign: 'center' }}>Nacionalidade</th>
                <th style={{ textAlign: 'right' }}>Jogos (Titular)</th>
                <th style={{ textAlign: 'right' }}>Minutos</th>
                <th style={{ textAlign: 'right' }}>Gols</th>
                <th style={{ textAlign: 'right' }}>Assist.</th>
                <th style={{ textAlign: 'right' }}>xG</th>
                <th style={{ textAlign: 'right', paddingRight: '20px' }}>xA</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '30px', textAlign: 'center' }}>
                    <Skeleton variant="text" count={6} />
                  </td>
                </tr>
              ) : filteredSquad.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-3)' }}>
                    Nenhum atleta encontrado para este filtro.
                  </td>
                </tr>
              ) : (
                filteredSquad.map(player => (
                  <tr
                    key={player.player_id}
                    onClick={() => navigate(`/player/${player.player_id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ paddingLeft: '20px', fontWeight: 600, color: 'var(--ink)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {player.photo_url ? (
                          <img
                            src={player.photo_url}
                            alt={player.name}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              background: 'var(--bg-2)',
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'var(--bg-2)',
                              border: '1px solid var(--rule)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              color: 'var(--ink-3)',
                            }}
                          >
                            {player.name.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span>{player.name}</span>
                      </div>
                    </td>
                    <td style={{ color: clubTheme.accent, fontSize: '12px', fontWeight: 600 }}>
                      {player.position_code || player.position_name || '-'}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: '11px' }}>
                      {player.nationality || '-'}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--ink)' }}>
                      {player.appearances} <span style={{ color: 'var(--ink-3)', fontSize: '11px' }}>({player.starts})</span>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--ink-2)' }}>
                      {player.minutes}'
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: player.goals > 0 ? 700 : 400,
                        color: player.goals > 0 ? 'var(--ink)' : 'var(--ink-3)',
                      }}
                    >
                      {player.goals}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: player.assists > 0 ? 700 : 400,
                        color: player.assists > 0 ? 'var(--ink)' : 'var(--ink-3)',
                      }}
                    >
                      {player.assists}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--ink-2)' }}>
                      {player.xg.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '20px', color: 'var(--ink-2)' }}>
                      {player.xa.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Season Matches List Section */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <div>
            <div className="label" style={{ color: 'var(--ink-3)', marginBottom: '4px' }}>
              CALENDÁRIO & RESULTADOS
            </div>
            <h2 className="title" style={{ fontSize: '24px', margin: 0, fontFamily: 'var(--serif)' }}>
              Partidas da Temporada (38 Rodadas)
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'all', label: 'Todas' },
              { id: 'V', label: 'Vitórias' },
              { id: 'E', label: 'Empates' },
              { id: 'D', label: 'Derrotas' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMatchFilter(tab.id as any)}
                className={`header-btn ${matchFilter === tab.id ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: '11px', fontFamily: 'var(--mono)' }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="editorial-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="standings-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '60px' }}>Rnd</th>
                <th style={{ textAlign: 'left' }}>Mando</th>
                <th style={{ textAlign: 'left' }}>Adversário</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Resultado</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Placar</th>
                <th style={{ textAlign: 'right' }}>xG Pró</th>
                <th style={{ textAlign: 'right' }}>xG Contra</th>
                <th style={{ textAlign: 'right' }}>Finalizações</th>
                <th style={{ textAlign: 'right', paddingRight: '20px' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '30px', textAlign: 'center' }}>
                    <Skeleton variant="text" count={6} />
                  </td>
                </tr>
              ) : filteredMatches.map(m => {
                const resColor = m.result === 'V' ? '#10b981' : m.result === 'E' ? '#f59e0b' : '#ef4444';
                return (
                  <tr
                    key={m.match_id}
                    onClick={() => navigate(`/match/${m.match_id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ textAlign: 'center', color: 'var(--ink-3)', fontWeight: 600 }}>
                      R{m.matchday}
                    </td>
                    <td style={{ color: 'var(--ink-2)', fontSize: '12px' }}>
                      {m.is_home ? 'CASA' : 'FORA'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Crest name={m.opponent} alt={m.opponent} size={20} />
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{m.opponent}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '2px',
                          fontSize: '10px',
                          fontWeight: 700,
                          background: resColor,
                          color: '#ffffff',
                        }}
                      >
                        {m.result === 'V' ? 'VITÓRIA' : m.result === 'E' ? 'EMPATE' : 'DERROTA'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--ink)', fontSize: '14px' }}>
                      {m.goals_for} - {m.goals_against}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--ink)' }}>
                      {m.xg_for !== undefined ? m.xg_for.toFixed(2) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--ink-3)' }}>
                      {m.xg_against !== undefined ? m.xg_against.toFixed(2) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--ink-2)' }}>
                      {m.shots_for ?? '-'} vs {m.shots_against ?? '-'}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                      <span style={{ color: 'var(--accent)', fontSize: '11px', fontFamily: 'var(--mono)' }}>
                        Detalhes →
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Team;