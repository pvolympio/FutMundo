import { useState } from 'react';
import { Crest } from '../ui/Crest';

export interface LineupPlayer {
  player_id: number;
  name: string;
  shirt_number?: number | null;
  position?: string | null;
  captain?: boolean;
}

export interface TacticalLineupProps {
  homeTeamName: string;
  awayTeamName: string;
  homeStarters: LineupPlayer[];
  homeBench: LineupPlayer[];
  awayStarters: LineupPlayer[];
  awayBench: LineupPlayer[];
  homeFormation?: string | null;
  awayFormation?: string | null;
}

// Mapeamento dinâmico de coordenadas táticas (0 a 100) para cada posição
function getPlayerCoordinates(
  pos: string,
  indexInLine: number,
  totalInLine: number,
  _side: 'home' | 'away'
): { x: number; y: number } {
  const p = (pos || '').toUpperCase().trim();

  // Determinar a linha tática base (1 = Goleiro, 2 = Defesa, 3 = Volantes, 4 = Meias/Pontas, 5 = Ataque)
  let line = 3;
  if (p === 'GK') line = 1;
  else if (['CB', 'LB', 'RB', 'DF', 'LWB', 'RWB'].includes(p)) line = 2;
  else if (['DM', 'CDM', 'VOL'].includes(p)) line = 3;
  else if (['CM', 'AM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'AML', 'AMR'].includes(p)) line = 4;
  else if (['CF', 'ST', 'FW', 'CA'].includes(p)) line = 5;

  // Linhas no eixo X para o time Mandante (atacando da esquerda para a direita, x: 8 -> 88)
  const xByLineHome: Record<number, number> = {
    1: 8,
    2: 26,
    3: 45,
    4: 68,
    5: 88,
  };

  // Linhas no eixo X para o time Visitante (atacando da direita para a esquerda se dual, ou mesmo campo invertido)
  const xVal = xByLineHome[line] || 50;

  // Espaçamento no eixo Y (12% a 88% do campo)
  let yVal = 50;
  if (p === 'GK') {
    yVal = 50;
  } else if (p === 'LB') {
    yVal = 18;
  } else if (p === 'RB') {
    yVal = 82;
  } else if (p === 'LW' || p === 'AML') {
    yVal = 18;
  } else if (p === 'RW' || p === 'AMR') {
    yVal = 82;
  } else if (p === 'AM' || p === 'CAM') {
    yVal = 50;
  } else if (p === 'CF' || p === 'ST') {
    yVal = 50;
  } else {
    // Espalhar uniformemente na linha
    const step = 68 / (totalInLine + 1);
    yVal = 16 + step * (indexInLine + 1);
  }

  return { x: xVal, y: yVal };
}

export function TacticalLineup({
  homeTeamName,
  awayTeamName,
  homeStarters = [],
  homeBench = [],
  awayStarters = [],
  awayBench = [],
  homeFormation,
  awayFormation,
}: TacticalLineupProps) {
  const [activeSide, setActiveSide] = useState<'home' | 'away'>('home');
  const [hoveredPlayer, setHoveredPlayer] = useState<LineupPlayer | null>(null);

  const isHome = activeSide === 'home';
  const currentTeamName = isHome ? homeTeamName : awayTeamName;
  const currentStarters = isHome ? homeStarters : awayStarters;
  const currentBench = isHome ? homeBench : awayBench;
  const currentFormation = isHome ? (homeFormation || '4-3-3') : (awayFormation || '4-3-3');
  const teamColor = isHome ? 'var(--accent)' : 'var(--opp)';

  // Agrupar titulares por linha para cálculo de espaçamento
  const positionGroups: Record<string, LineupPlayer[]> = {};
  currentStarters.forEach((p) => {
    const code = p.position || 'CM';
    if (!positionGroups[code]) positionGroups[code] = [];
    positionGroups[code].push(p);
  });

  return (
    <div className="tactical-lineup-board" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Seletor de Equipe Mandante/Visitante */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-1)', padding: '12px 18px', border: '1px solid var(--rule)', borderRadius: '2px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setActiveSide('home')}
            style={{
              background: isHome ? 'var(--accent-wash)' : 'transparent',
              border: isHome ? '1px solid var(--accent)' : '1px solid var(--rule)',
              color: isHome ? 'var(--accent)' : 'var(--ink-2)',
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: '2px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Crest name={homeTeamName} alt={homeTeamName} size={16} />
            {homeTeamName} ({homeFormation || '4-3-3'})
          </button>

          <button
            onClick={() => setActiveSide('away')}
            style={{
              background: !isHome ? 'var(--opp-wash, rgba(100, 180, 240, 0.12))' : 'transparent',
              border: !isHome ? '1px solid var(--opp)' : '1px solid var(--rule)',
              color: !isHome ? 'var(--opp)' : 'var(--ink-2)',
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: '2px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Crest name={awayTeamName} alt={awayTeamName} size={16} />
            {awayTeamName} ({awayFormation || '4-3-3'})
          </button>
        </div>

        <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
          ESQUEMA TÁTICO: <span style={{ color: teamColor, fontWeight: 700 }}>{currentFormation}</span>
        </div>
      </div>

      {/* Campo Tático com Jogadores Posicionados */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '105 / 68', background: 'var(--bg-2)', border: '1px solid var(--rule)', borderRadius: '2px', overflow: 'hidden' }}>
        {/* Marcações do gramado */}
        <svg viewBox="0 0 105 68" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
          <g stroke="var(--ink-4)" strokeWidth={0.5} fill="none" opacity={0.6}>
            <rect x={2} y={2} width={101} height={64} />
            <line x1={52.5} y1={2} x2={52.5} y2={66} strokeDasharray="1 1" />
            <circle cx={52.5} cy={34} r={9.15} />
            <circle cx={52.5} cy={34} r={0.6} fill="var(--ink-4)" />
            {/* Área grande esquerda */}
            <rect x={2} y={13.84} width={16.5} height={40.32} />
            <rect x={2} y={24.84} width={5.5} height={18.32} />
            <circle cx={13} cy={34} r={0.5} fill="var(--ink-4)" />
            <path d="M 18.5 27.5 A 9.15 9.15 0 0 1 18.5 40.5" />
            {/* Área grande direita */}
            <rect x={86.5} y={13.84} width={16.5} height={40.32} />
            <rect x={97.5} y={24.84} width={5.5} height={18.32} />
            <circle cx={92} cy={34} r={0.5} fill="var(--ink-4)" />
            <path d="M 86.5 27.5 A 9.15 9.15 0 0 0 86.5 40.5" />
          </g>
        </svg>

        {/* Nós dos 11 Atletas Titulares */}
        {currentStarters.map((player, idx) => {
          const group = positionGroups[player.position || 'CM'] || [player];
          const indexInGroup = group.indexOf(player);
          const coords = getPlayerCoordinates(player.position || 'CM', indexInGroup, group.length, activeSide);

          const isHovered = hoveredPlayer?.player_id === player.player_id;

          return (
            <div
              key={player.player_id || idx}
              onMouseEnter={() => setHoveredPlayer(player)}
              onMouseLeave={() => setHoveredPlayer(null)}
              style={{
                position: 'absolute',
                left: `${coords.x}%`,
                top: `${coords.y}%`,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                zIndex: isHovered ? 20 : 10,
                transition: 'transform 0.15s ease',
              }}
            >
              {/* Círculo do Jogador com Camisa/Posição */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isHovered ? 'var(--ink)' : 'var(--bg-1)',
                  color: isHovered ? 'var(--bg)' : teamColor,
                  border: `2px solid ${teamColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  fontWeight: 700,
                  boxShadow: isHovered ? `0 0 12px ${teamColor}` : '0 2px 6px rgba(0,0,0,0.5)',
                  position: 'relative',
                }}
              >
                {player.shirt_number || player.position || idx + 1}
                {player.captain && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      background: 'var(--accent)',
                      color: '#000',
                      fontSize: '8px',
                      fontWeight: 900,
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    C
                  </span>
                )}
              </div>

              {/* Nome do Jogador */}
              <div
                style={{
                  marginTop: '4px',
                  padding: '2px 6px',
                  background: 'rgba(7, 22, 26, 0.85)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid var(--rule)',
                  borderRadius: '2px',
                  fontFamily: 'var(--mono)',
                  fontSize: '10px',
                  color: 'var(--ink)',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                  pointerEvents: 'none',
                }}
              >
                {player.name}
              </div>
            </div>
          );
        })}

        {/* Hover Card Flutuante com Detalhes do Jogador */}
        {hoveredPlayer && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              background: 'var(--bg-1)',
              border: `1px solid ${teamColor}`,
              padding: '10px 14px',
              borderRadius: '2px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{hoveredPlayer.name}</span>
              <span style={{ color: teamColor, fontWeight: 600 }}>#{hoveredPlayer.shirt_number || '—'}</span>
            </div>
            <div style={{ color: 'var(--ink-3)', fontSize: '10px' }}>
              Posição: <span style={{ color: 'var(--ink)' }}>{hoveredPlayer.position || 'Titular'}</span>
              {hoveredPlayer.captain && ' • Capitão da Equipe'}
            </div>
          </div>
        )}
      </div>

      {/* Banco de Reservas */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--rule)', borderRadius: '2px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span className="label">BANCO DE RESERVAS ({currentBench.length} ATLETAS)</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)' }}>{currentTeamName}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
          {currentBench.map((sub, idx) => (
            <div
              key={sub.player_id || idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px',
                background: 'var(--bg-2)',
                border: '1px solid var(--rule)',
                borderRadius: '2px',
                fontFamily: 'var(--mono)',
                fontSize: '11px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                <span style={{ color: teamColor, fontWeight: 600, fontSize: '10px' }}>
                  #{sub.shirt_number || idx + 12}
                </span>
                <span style={{ color: 'var(--ink)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {sub.name}
                </span>
              </div>
              <span style={{ color: 'var(--ink-3)', fontSize: '10px' }}>{sub.position || 'SUB'}</span>
            </div>
          ))}
          {currentBench.length === 0 && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)', gridColumn: '1 / -1' }}>
              Nenhum reserva cadastrado na súmula oficial.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TacticalLineup;
