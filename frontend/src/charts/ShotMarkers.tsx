import { useState } from 'react';
import { scaleLinear } from 'd3-scale';

export interface Shot {
  x: number;
  y: number;
  xG: number;
  result: 'goal' | 'saved' | 'blocked' | 'off_target' | 'crossbar' | 'miss' | 'post';
  situation?: 'open_play' | 'set_piece' | 'counter' | 'penalty' | 'corner' | string;
  bodyPart?: 'right_foot' | 'left_foot' | 'head' | string;
  minute: number;
  player: string;
  assist?: string;
  home?: boolean;
}

/** Mapa de chutes no campo com tooltips interativos e legendas ricas */
export function ShotMarkers({
  shots,
  className,
}: {
  shots: Shot[];
  className?: string;
}) {
  const [hoveredShot, setHoveredShot] = useState<{ shot: Shot; pxX: number; pxY: number } | null>(null);

  // Converter coordenadas 0-100 para pixels (1050x680)
  const pitchWidth = 1050;
  const pitchHeight = 680;

  const scaleX = scaleLinear().domain([0, 100]).range([0, pitchWidth]);
  const scaleY = scaleLinear().domain([0, 100]).range([0, pitchHeight]);

  const colors: Record<string, string> = {
    goal: 'var(--accent, #E5A93C)',
    saved: 'var(--opp, #4AA3DF)',
    blocked: 'var(--rule, #888888)',
    off_target: 'var(--ink-4, #555555)',
    crossbar: 'var(--down, #E05252)',
    miss: 'var(--ink-4, #555555)',
    post: 'var(--ink-4, #555555)',
  };

  const getResultLabel = (res: string) => {
    switch (res) {
      case 'goal':
        return 'GOL ⚽';
      case 'saved':
        return 'DEFENDIDO 🧤';
      case 'blocked':
        return 'BLOQUEADO 🛡️';
      case 'crossbar':
      case 'post':
        return 'NA TRAVE 🥅';
      default:
        return 'FORA DO ALVO 💨';
    }
  };

  const getSituationLabel = (sit?: string) => {
    if (!sit) return 'Jogo Aberto';
    const s = sit.toLowerCase();
    if (s.includes('penalty')) return 'Pênalti';
    if (s.includes('corner')) return 'Escanteio';
    if (s.includes('set') || s.includes('free')) return 'Bola Parada';
    if (s.includes('counter')) return 'Contra-Ataque';
    return sit;
  };

  const getBodyPartLabel = (bp?: string) => {
    if (!bp) return 'Pé direito';
    if (bp.includes('head')) return 'Cabeceio';
    if (bp.includes('left')) return 'Pé esquerdo';
    if (bp.includes('right')) return 'Pé direito';
    return bp;
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        viewBox={`0 0 ${pitchWidth} ${pitchHeight}`}
        className={`shot-markers ${className || ''}`}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      >
        {shots.map((shot, idx) => {
          const pxX = scaleX(shot.x);
          const pxY = pitchHeight - scaleY(shot.y);
          // Área proporcional a xG
          const radius = Math.max(5, Math.min(24, Math.sqrt(shot.xG || 0.1) * 22));
          const isHovered = hoveredShot?.shot === shot;
          const strokeColor = colors[shot.result] || 'var(--ink-3)';

          return (
            <g
              key={`${shot.player}-${shot.minute}-${idx}`}
              className="shot-marker"
              style={{
                cursor: 'pointer',
                opacity: shot.result === 'miss' || shot.result === 'off_target' ? 0.45 : 1,
              }}
              onMouseEnter={() => setHoveredShot({ shot, pxX, pxY })}
              onMouseLeave={() => setHoveredShot(null)}
            >
              {/* Anel de destaque no hover */}
              {isHovered && (
                <circle
                  cx={pxX}
                  cy={pxY}
                  r={radius + 8}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  opacity={0.8}
                />
              )}

              {/* Círculo base com preenchimento translúcido */}
              <circle
                cx={pxX}
                cy={pxY}
                r={radius}
                fill={strokeColor + '33'}
                stroke={strokeColor}
                strokeWidth={isHovered ? 2.5 : 1.5}
              />

              {/* Símbolo do resultado no centro */}
              {shot.result === 'goal' && (
                <circle cx={pxX} cy={pxY} r={radius * 0.55} fill={colors.goal} />
              )}

              {shot.result === 'saved' && (
                <circle cx={pxX} cy={pxY} r={radius * 0.45} fill="none" stroke={colors.saved} strokeWidth={2} />
              )}

              {shot.result === 'blocked' && (
                <line
                  x1={pxX - radius * 0.5}
                  y1={pxY}
                  x2={pxX + radius * 0.5}
                  y2={pxY}
                  stroke={colors.blocked}
                  strokeWidth={2}
                />
              )}

              {/* Marcador de Minuto no Hover ou Chute de alto xG */}
              {(isHovered || (shot.xG > 0.4 && shot.result === 'goal')) && (
                <text
                  x={pxX}
                  y={pxY - radius - 6}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={700}
                  fontFamily="var(--mono, monospace)"
                  fill="var(--ink, #fff)"
                >
                  {shot.minute}'
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip Editorial Glassmorphic Flutuante */}
      {hoveredShot && (
        <div
          style={{
            position: 'absolute',
            left: `${(hoveredShot.pxX / pitchWidth) * 100}%`,
            top: `${(hoveredShot.pxY / pitchHeight) * 100}%`,
            transform: 'translate(-50%, -115%)',
            background: 'var(--bg-1, #0B191E)',
            border: `1px solid ${colors[hoveredShot.shot.result] || 'var(--rule)'}`,
            borderRadius: '4px',
            padding: '10px 14px',
            boxShadow: '0 10px 28px rgba(0,0,0,0.65)',
            pointerEvents: 'none',
            zIndex: 100,
            minWidth: '190px',
            fontFamily: 'var(--mono, monospace)',
          }}
        >
          {/* Header do Tooltip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ink)' }}>
              {hoveredShot.shot.player}
            </span>
            <span style={{ fontSize: '11px', color: colors[hoveredShot.shot.result], fontWeight: 700 }}>
              {hoveredShot.shot.minute}'
            </span>
          </div>

          {/* Desfecho */}
          <div style={{ fontSize: '10px', color: colors[hoveredShot.shot.result], fontWeight: 700, marginBottom: '6px' }}>
            {getResultLabel(hoveredShot.shot.result)}
          </div>

          {/* Barra e Valor de xG */}
          <div style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--ink-2)', marginBottom: '3px' }}>
              <span>Probabilidade de Gol:</span>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{(hoveredShot.shot.xG * 100).toFixed(1)}% ({hoveredShot.shot.xG.toFixed(3)} xG)</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'var(--bg-2)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, hoveredShot.shot.xG * 100)}%`,
                  height: '100%',
                  background: colors[hoveredShot.shot.result],
                }}
              />
            </div>
          </div>

          {/* Metadados Adicionais */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9.5px', color: 'var(--ink-3)' }}>
            <div>Situação: <span style={{ color: 'var(--ink-2)' }}>{getSituationLabel(hoveredShot.shot.situation)}</span></div>
            <div>Finalização: <span style={{ color: 'var(--ink-2)' }}>{getBodyPartLabel(hoveredShot.shot.bodyPart)}</span></div>
            {hoveredShot.shot.assist && (
              <div>Passe decisivo: <span style={{ color: 'var(--ink)' }}>{hoveredShot.shot.assist}</span></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}