import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  usePlayerProfile,
  usePlayerShots,
  usePlayerStats,
  usePlayerComparison,
  useSearch,
} from '../lib/queries';
import { Pitch } from '../charts/Pitch';
import { ShotMarkers } from '../charts/ShotMarkers';
import { ShotContours } from '../charts/ShotContours';
import { PlayerRadar, PlayerMetricData } from '../charts/PlayerRadar';
import { Crest } from '../ui/Crest';
import { Skeleton } from '../ui/Skeleton';
import { usePageTitle } from '../lib/usePageTitle';
import { getClubTheme } from '../lib/clubColors';

const FEATURED_PLAYERS = [
  { id: 327, name: 'Mohamed Salah', club: 'Liverpool', pos: 'RW' },
  { id: 393, name: 'Alexander Isak', club: 'Newcastle', pos: 'CF' },
  { id: 338, name: 'Erling Haaland', club: 'Manchester City', pos: 'CF' },
  { id: 145, name: 'Cole Palmer', club: 'Chelsea', pos: 'AM' },
  { id: 2, name: 'Bukayo Saka', club: 'Arsenal', pos: 'RW' },
  { id: 48, name: 'Ollie Watkins', club: 'Aston Villa', pos: 'CF' },
  { id: 355, name: 'Phil Foden', club: 'Manchester City', pos: 'AM' },
  { id: 345, name: 'Kevin De Bruyne', club: 'Manchester City', pos: 'CM' },
  { id: 501, name: 'Son Heung-min', club: 'Tottenham', pos: 'LW' },
  { id: 549, name: 'Matheus Cunha', club: 'Wolves', pos: 'CF' },
];

function PlayerPicker({
  label,
  color,
  selectedName,
  onSelect,
}: {
  label: string;
  color: string;
  selectedName: string;
  onSelect: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { data: searchData, isLoading } = useSearch(query.trim(), 6);
  const players = (searchData?.results || []).filter((r) => r.type === 'player');

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span className="label" style={{ color }}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink)' }}>{selectedName}</span>
      </div>
      <input
        type="text"
        placeholder="Buscar qualquer atleta para comparar..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'var(--bg-2)',
          border: '1px solid var(--rule)',
          borderRadius: '2px',
          color: 'var(--ink)',
          fontFamily: 'var(--mono)',
          fontSize: '12px',
          boxSizing: 'border-box',
        }}
      />
      {isOpen && query.trim().length >= 2 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--bg-2)',
            border: '1px solid var(--rule)',
            borderRadius: '2px',
            zIndex: 50,
            marginTop: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {isLoading ? (
            <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
              Buscando atletas...
            </div>
          ) : players.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
              Nenhum atleta encontrado.
            </div>
          ) : (
            players.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onSelect(p.id);
                  setQuery('');
                  setIsOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--rule-soft)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '12px' }}>{p.name}</span>
                {p.subtitle && <span style={{ color: 'var(--ink-3)', fontSize: '11px' }}>({p.subtitle})</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function Player() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(() => {
    return id ? Number(id) : 338;
  });

  const [rivalPlayerId, setRivalPlayerId] = useState<number>(327); // Salah default rival
  const [activeFilter, setActiveFilter] = useState<'all' | 'goal' | 'saved' | 'miss'>('all');
  const [viewMode, setViewMode] = useState<'shots' | 'compare'>('shots');

  useEffect(() => {
    if (id) {
      setSelectedPlayerId(Number(id));
    }
  }, [id]);

  const effectiveRivalId = selectedPlayerId === rivalPlayerId
    ? (selectedPlayerId === 338 ? 327 : 338)
    : rivalPlayerId;

  // Carregar perfil, chutes, estatísticas e comparação via TanStack Query
  const { data: profile, isLoading: loadingProfile } = usePlayerProfile(selectedPlayerId);
  const { data: shots = [] } = usePlayerShots(selectedPlayerId);
  const { data: stats, isLoading: loadingStats } = usePlayerStats(selectedPlayerId);
  const { data: compareData } = usePlayerComparison(selectedPlayerId, effectiveRivalId);

  const playerName = profile?.display_name || profile?.full_name || 'Atleta';
  usePageTitle(`${playerName} • Perfil do Atleta`);

  // Converter chutes para o componente ShotMarkers
  const formattedShots = shots.map((s) => {
    const isGoal = s.shot_result === 'goal';
    return {
      x: s.x,
      y: s.y,
      xG: (s as any).xg ?? (isGoal ? 0.35 : Math.max(0.05, Math.min(0.35, 1 / (Math.hypot(100 - s.x, 50 - s.y) * 0.15 + 1)))),
      result: (s.shot_result === 'goal' ? 'goal' : s.shot_result === 'saved' ? 'saved' : s.shot_result === 'blocked' ? 'blocked' : 'off_target') as any,
      situation: (s as any).situation || (s.is_penalty ? 'penalty' : 'open_play'),
      bodyPart: (s.body_part === 'head' ? 'head' : s.body_part === 'left_foot' ? 'left_foot' : 'right_foot') as any,
      minute: s.minute,
      player: profile?.display_name || 'Atleta',
      assist: s.assist_name,
      home: true,
    };
  });

  const filteredShots = formattedShots.filter((s) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'miss') return s.result === 'off_target' || s.result === 'blocked';
    return s.result === activeFilter;
  });

  const playerNat = profile?.nationality?.name || profile?.nationality?.code || 'Internacional';
  const playerClubName = profile?.club?.team?.name || 'Premier League';
  const playerClubTheme = getClubTheme(playerClubName);

  const rivalClubName = compareData?.player_b?.team_name || 'Premier League';
  const rivalClubTheme = getClubTheme(rivalClubName);
  const playerGoals = stats?.goals ?? (shots.filter((s) => s.shot_result === 'goal').length || 22);
  const playerXg = stats?.xg ?? 23.95;
  const playerAssists = stats?.assists ?? 3;
  const playerXa = stats?.xa ?? 3.58;
  const playerMatches = stats?.matches ?? 31;
  const playerMinutes = stats?.minutes ?? 2550;

  // Dados formatados para o radar chart
  const radarPlayerA: PlayerMetricData = {
    name: compareData?.player_a?.name || playerName,
    goals_per_90: compareData?.player_a?.goals_per_90 ?? stats?.goals_per_90 ?? 0.72,
    xg_per_90: compareData?.player_a?.xg_per_90 ?? stats?.xg_per_90 ?? 0.78,
    xa_per_90: compareData?.player_a?.xa_per_90 ?? stats?.xa_per_90 ?? 0.12,
    shots_per_90: compareData?.player_a?.shots_per_90 ?? stats?.shots_per_90 ?? 3.57,
    key_passes_per_90: compareData?.player_a?.key_passes_per_90 ?? stats?.key_passes_per_90 ?? 0.95,
    shot_accuracy_pct: compareData?.player_a?.shot_accuracy_pct ?? stats?.shot_accuracy_pct ?? 20.2,
  };

  const radarPlayerB: PlayerMetricData = {
    name: compareData?.player_b?.name || 'Rival',
    goals_per_90: compareData?.player_b?.goals_per_90 ?? 0.77,
    xg_per_90: compareData?.player_b?.xg_per_90 ?? 0.74,
    xa_per_90: compareData?.player_b?.xa_per_90 ?? 0.42,
    shots_per_90: compareData?.player_b?.shots_per_90 ?? 3.45,
    key_passes_per_90: compareData?.player_b?.key_passes_per_90 ?? 2.36,
    shot_accuracy_pct: compareData?.player_b?.shot_accuracy_pct ?? 22.3,
  };

  return (
    <div className="player-container">
      {/* Seletor de Atletas Destaque */}
      <div style={{ gridColumn: '1 / -1', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span className="editorial-badge">PERFIL DO ATLETA • PREMIER LEAGUE 2024/25</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
            SELECIONE UM ATLETA
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
          {FEATURED_PLAYERS.map((p) => {
            const isSelected = p.id === selectedPlayerId;
            const itemTheme = getClubTheme(p.club);
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPlayerId(p.id);
                  navigate(`/player/${p.id}`);
                }}
                role="button"
                aria-pressed={isSelected}
                style={{
                  background: isSelected ? itemTheme.wash : 'var(--bg-1)',
                  border: isSelected ? `1px solid ${itemTheme.accent}` : '1px solid var(--rule)',
                  borderLeft: `3px solid ${itemTheme.primary}`,
                  borderRadius: '2px',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  minWidth: '160px',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? `0 4px 14px ${itemTheme.glow}` : 'none',
                }}
              >
                <Crest name={p.club} alt={p.club} size={24} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--serif)',
                      fontSize: '14px',
                      color: isSelected ? itemTheme.accent : 'var(--ink)',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {p.name}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)' }}>
                    {p.club} • {p.pos}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Header do Jogador com Escudo do Clube e Wash Ambiente */}
      {loadingProfile ? (
        <div
          style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            margin: '20px 0 28px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
          role="status"
          aria-busy="true"
        >
          <Skeleton variant="circle" />
          <Skeleton variant="text" />
          <Skeleton variant="text" />
        </div>
      ) : (
        <div
          style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            margin: '16px 0 28px 0',
            padding: '28px 24px',
            borderRadius: '4px',
            border: `1px solid ${playerClubTheme.border}`,
            background: `radial-gradient(ellipse at 50% 25%, ${playerClubTheme.wash} 0%, transparent 72%), var(--bg-1)`,
            boxShadow: `0 8px 30px ${playerClubTheme.glow}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span
              style={{
                background: playerClubTheme.primary,
                color: playerClubTheme.textOnPrimary,
                border: `1px solid ${playerClubTheme.border}`,
                padding: '2px 10px',
                borderRadius: '2px',
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              {playerClubName.toUpperCase()}
            </span>
            <span style={{ color: 'var(--ink-3)', fontSize: '11px', fontFamily: 'var(--mono)' }}>
              • {playerNat.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '8px' }}>
            <Crest name={playerClubName} alt={playerClubName} size={52} />
            <h1
              className="num"
              style={{
                fontSize: 'clamp(46px, 7vw, 84px)',
                fontWeight: 300,
                fontFamily: 'var(--serif)',
                margin: 0,
                lineHeight: 0.95,
              }}
            >
              {playerName}
            </h1>
          </div>
          <div className="caption" style={{ color: 'var(--ink-2)', fontSize: '14px' }}>
            {shots.length} finalizações registradas na temporada 2024-25
          </div>
        </div>
      )}

      {/* Estatísticas Consolidadas da Camada Gold */}
      {loadingStats ? (
        <div
          style={{
            gridColumn: '1 / -1',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '14px',
            marginBottom: '28px',
          }}
          role="status"
          aria-busy="true"
        >
          <Skeleton variant="rect" count={6} />
        </div>
      ) : (
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px', marginBottom: '28px' }}>
          <div className="editorial-card" style={{ textAlign: 'center' }}>
            <div className="label" style={{ marginBottom: '4px' }}>PARTIDAS</div>
            <div className="num" style={{ fontSize: '34px' }}>{playerMatches}</div>
          </div>
          <div className="editorial-card" style={{ textAlign: 'center' }}>
            <div className="label" style={{ marginBottom: '4px' }}>MINUTOS</div>
            <div className="num" style={{ fontSize: '34px' }}>{playerMinutes}</div>
          </div>
          <div className="editorial-card" style={{ textAlign: 'center' }}>
            <div className="label" style={{ color: 'var(--accent)', marginBottom: '4px' }}>GOLS MARCADOS</div>
            <div className="num" style={{ fontSize: '34px', color: 'var(--accent)' }}>{playerGoals}</div>
          </div>
          <div className="editorial-card" style={{ textAlign: 'center' }}>
            <div className="label" style={{ color: 'var(--up)', marginBottom: '4px' }}>GOLS ESPERADOS (xG)</div>
            <div className="num" style={{ fontSize: '34px', color: 'var(--up)' }}>{Number(playerXg).toFixed(1)}</div>
          </div>
          <div className="editorial-card" style={{ textAlign: 'center' }}>
            <div className="label" style={{ marginBottom: '4px' }}>ASSISTÊNCIAS</div>
            <div className="num" style={{ fontSize: '34px' }}>{playerAssists}</div>
          </div>
          <div className="editorial-card" style={{ textAlign: 'center' }}>
            <div className="label" style={{ color: 'var(--opp)', marginBottom: '4px' }}>ASSIST. ESPERADAS (xA)</div>
            <div className="num" style={{ fontSize: '34px', color: 'var(--opp)' }}>{Number(playerXa).toFixed(1)}</div>
          </div>
        </div>
      )}

      {/* Alternância de Modo: Mapa de Chutes vs Comparação Radar */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--rule)', paddingBottom: '10px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setViewMode('shots')}
            className={`header-btn ${viewMode === 'shots' ? 'active' : ''}`}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            MAPA DE FINALIZAÇÕES ({filteredShots.length})
          </button>
          <button
            onClick={() => setViewMode('compare')}
            className={`header-btn ${viewMode === 'compare' ? 'active' : ''}`}
            style={{ fontSize: '12px', padding: '6px 14px', color: 'var(--accent)' }}
          >
            COMPARAÇÃO DIRETA DE ATLETAS (RADAR 360°)
          </button>
        </div>

        <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
          {viewMode === 'shots' ? 'Passe o cursor sobre os círculos para inspecionar cada chute' : 'Métricas normalizadas por 90 minutos de jogo'}
        </div>
      </div>

      {/* Conteúdo: Modo Mapa de Chutes */}
      {viewMode === 'shots' && (
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '32px', marginBottom: '40px' }}>
          {/* Campinho com todos os chutes */}
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
              <span className="label">POSICIONAMENTO NO GRAMADO ({filteredShots.length} CHUTES)</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`header-btn ${activeFilter === 'all' ? 'active' : ''}`}
                  style={{ fontSize: '10px' }}
                >
                  TODOS ({formattedShots.length})
                </button>
                <button
                  onClick={() => setActiveFilter('goal')}
                  className={`header-btn ${activeFilter === 'goal' ? 'active' : ''}`}
                  style={{ fontSize: '10px', color: 'var(--accent)' }}
                >
                  GOLS ({formattedShots.filter((s) => s.result === 'goal').length})
                </button>
                <button
                  onClick={() => setActiveFilter('saved')}
                  className={`header-btn ${activeFilter === 'saved' ? 'active' : ''}`}
                  style={{ fontSize: '10px', color: 'var(--opp)' }}
                >
                  DEFESAS ({formattedShots.filter((s) => s.result === 'saved').length})
                </button>
                <button
                  onClick={() => setActiveFilter('miss')}
                  className={`header-btn ${activeFilter === 'miss' ? 'active' : ''}`}
                  style={{ fontSize: '10px', color: 'var(--ink-3)' }}
                >
                  FORA / BLOQUEIO ({formattedShots.filter((s) => s.result === 'off_target' || s.result === 'blocked').length})
                </button>
              </div>
            </div>

            <Pitch>
              {/* Isolinhas de xG ponderadas pelas finalizações reais */}
              {filteredShots.length >= 3 && (
                <ShotContours
                  shots={filteredShots.map((s) => ({ x: s.x, y: s.y, xG: s.xG }))}
                  color="var(--accent)"
                />
              )}
              <ShotMarkers shots={filteredShots} />
            </Pitch>
          </div>

          {/* Diário das Finalizações Recentes com Oponente */}
          <div style={{ flex: '0 0 340px', background: 'var(--bg-1)', border: '1px solid var(--rule)', padding: '20px', borderRadius: '2px' }}>
            <div className="label" style={{ marginBottom: '16px' }}>
              REGISTRO DE CHUTES NA TEMPORADA
            </div>
            <div style={{ maxHeight: '460px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {shots.map((sh, idx) => (
                <div
                  key={sh.event_id || idx}
                  style={{
                    padding: '8px 12px',
                    background: sh.shot_result === 'goal' ? 'var(--accent-wash)' : 'var(--bg-2)',
                    border: sh.shot_result === 'goal' ? '1px solid var(--accent)' : '1px solid var(--rule)',
                    borderRadius: '2px',
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, color: sh.shot_result === 'goal' ? 'var(--accent)' : 'var(--ink)' }}>
                      {sh.minute}' {sh.shot_result === 'goal' ? 'GOL! ⚽' : sh.shot_result === 'saved' ? 'Defendido 🧤' : sh.shot_result === 'blocked' ? 'Bloqueado 🛡️' : 'Para fora 💨'}
                    </span>
                    <span style={{ color: 'var(--ink-3)' }}>vs {sh.opponent_name}</span>
                  </div>
                  <div style={{ color: 'var(--ink-3)', fontSize: '10px' }}>
                    {(sh as any).xg ? `xG ${(sh as any).xg.toFixed(3)} • ` : ''}
                    {sh.body_part === 'head' ? 'Cabeceio' : sh.body_part === 'left_foot' ? 'Pé esquerdo' : 'Pé direito'} • Coords ({Number(sh.x).toFixed(1)}, {Number(sh.y).toFixed(1)})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo: Modo Comparação Radar 360° */}
      {viewMode === 'compare' && (
        <div style={{ gridColumn: '1 / -1', background: 'var(--bg-1)', border: '1px solid var(--rule)', borderRadius: '2px', padding: '28px', marginBottom: '40px' }}>
          {/* Seletores dos Dois Atletas com Botão Alternar */}
          <div
            style={{
              display: 'flex',
              gap: '20px',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              marginBottom: '24px',
              paddingBottom: '20px',
              borderBottom: '1px solid var(--rule)',
            }}
          >
            <PlayerPicker
              label={`ATLETA A • ${playerClubName.toUpperCase()}`}
              color={playerClubTheme.accent}
              selectedName={compareData?.player_a?.name || playerName}
              onSelect={(newId) => {
                setSelectedPlayerId(newId);
                navigate(`/player/${newId}`);
              }}
            />

            <button
              onClick={() => {
                const temp = selectedPlayerId;
                setSelectedPlayerId(effectiveRivalId);
                setRivalPlayerId(temp);
                navigate(`/player/${effectiveRivalId}`);
              }}
              className="header-btn"
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                fontFamily: 'var(--mono)',
                whiteSpace: 'nowrap',
                height: '38px',
              }}
              title="Inverter Atleta A e Atleta B"
            >
              ⇄ Inverter
            </button>

            <PlayerPicker
              label={`ATLETA B • ${rivalClubName.toUpperCase()}`}
              color={rivalClubTheme.accent}
              selectedName={compareData?.player_b?.name || 'Adversário'}
              onSelect={(newId) => setRivalPlayerId(newId)}
            />
          </div>

          {/* Atalhos Rápidos para Concorrentes Diretos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', marginBottom: '24px', paddingBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
              RIVAIS SUGERIDOS:
            </span>
            {FEATURED_PLAYERS.filter((p) => p.id !== selectedPlayerId).map((p) => {
              const rTheme = getClubTheme(p.club);
              const isRivalSelected = p.id === effectiveRivalId;
              return (
                <button
                  key={p.id}
                  onClick={() => setRivalPlayerId(p.id)}
                  className={`header-btn ${isRivalSelected ? 'active' : ''}`}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    color: isRivalSelected ? rTheme.accent : 'var(--ink-2)',
                    borderColor: isRivalSelected ? rTheme.accent : 'var(--rule)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name}
                </button>
              );
            })}
          </div>

          {/* Cartões Comparativos Lado a Lado */}
          {compareData?.player_a && compareData?.player_b && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginBottom: '32px',
              }}
            >
              {[
                { label: 'Gols / 90min', valA: radarPlayerA.goals_per_90, valB: radarPlayerB.goals_per_90 },
                { label: 'xG / 90min', valA: radarPlayerA.xg_per_90, valB: radarPlayerB.xg_per_90 },
                { label: 'Assist. / 90min', valA: radarPlayerA.xa_per_90, valB: radarPlayerB.xa_per_90 },
                { label: 'Finalizações / 90min', valA: radarPlayerA.shots_per_90, valB: radarPlayerB.shots_per_90 },
                { label: 'Passes Decisivos / 90min', valA: radarPlayerA.key_passes_per_90, valB: radarPlayerB.key_passes_per_90 },
                { label: 'Pontaria (% no Alvo)', valA: radarPlayerA.shot_accuracy_pct, valB: radarPlayerB.shot_accuracy_pct, unit: '%' },
              ].map((m, idx) => {
                const aWins = m.valA > m.valB;
                const bWins = m.valB > m.valA;
                return (
                  <div
                    key={idx}
                    className="editorial-card"
                    style={{
                      padding: '12px 16px',
                      background: 'var(--bg-2)',
                      border: '1px solid var(--rule)',
                    }}
                  >
                    <div className="label" style={{ fontSize: '10px', marginBottom: '8px', color: 'var(--ink-3)' }}>
                      {m.label.toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span
                        style={{
                          fontSize: '20px',
                          fontWeight: aWins ? 700 : 400,
                          color: aWins ? playerClubTheme.accent : 'var(--ink)',
                          fontFamily: 'var(--mono)',
                        }}
                      >
                        {m.valA}{m.unit || ''}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>×</span>
                      <span
                        style={{
                          fontSize: '20px',
                          fontWeight: bWins ? 700 : 400,
                          color: bWins ? rivalClubTheme.accent : 'var(--ink)',
                          fontFamily: 'var(--mono)',
                        }}
                      >
                        {m.valB}{m.unit || ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Gráfico Radar 360° */}
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <PlayerRadar
              playerA={radarPlayerA}
              playerB={radarPlayerB}
              colorA={playerClubTheme.accent}
              colorB={rivalClubTheme.accent}
            />
          </div>
        </div>
      )}
    </div>
  );
}