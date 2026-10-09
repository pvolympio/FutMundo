import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TeamSeasonMatch } from '../lib/api';

interface TeamTrendProps {
  matches: TeamSeasonMatch[];
  accentColor?: string;
  className?: string;
}

export function TeamTrend({ matches, accentColor = 'var(--accent)', className }: TeamTrendProps) {
  const navigate = useNavigate();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Compute 5-match rolling averages
  const { points, maxY } = useMemo(() => {
    if (!matches || matches.length === 0) return { points: [], maxY: 3.5 };

    const pts = matches.map((m, idx) => {
      const windowStart = Math.max(0, idx - 4);
      const windowMatches = matches.slice(windowStart, idx + 1);

      const rollXgFor =
        windowMatches.reduce((acc, curr) => acc + (curr.xg_for ?? 0), 0) / windowMatches.length;
      const rollXgAgainst =
        windowMatches.reduce((acc, curr) => acc + (curr.xg_against ?? 0), 0) / windowMatches.length;

      return {
        match: m,
        matchday: m.matchday ?? idx + 1,
        xgFor: m.xg_for ?? 0,
        xgAgainst: m.xg_against ?? 0,
        rollXgFor,
        rollXgAgainst,
      };
    });

    const maxVal = Math.max(
      3.0,
      ...pts.map(p => Math.max(p.xgFor, p.xgAgainst, p.rollXgFor, p.rollXgAgainst))
    );
    return { points: pts, maxY: Math.ceil(maxVal * 1.15) };
  }, [matches]);

  if (!matches || matches.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
        Nenhuma partida registrada nesta temporada.
      </div>
    );
  }

  // Dimensions
  const width = 760;
  const height = 220;
  const padding = { top: 25, right: 30, bottom: 35, left: 42 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const n = points.length;
  const getX = (idx: number) => padding.left + (n > 1 ? (idx / (n - 1)) * chartW : chartW / 2);
  const getY = (val: number) => padding.top + chartH - (Math.min(val, maxY) / maxY) * chartH;

  // Path generators
  const rollForPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.rollXgFor).toFixed(1)}`)
    .join(' ');

  const rollAgainstPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.rollXgAgainst).toFixed(1)}`)
    .join(' ');

  const areaForPath = points.length > 0
    ? `${rollForPath} L ${getX(points.length - 1).toFixed(1)} ${(padding.top + chartH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padding.top + chartH).toFixed(1)} Z`
    : '';

  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className={`team-trend-chart ${className || ''}`} style={{ position: 'relative', width: '100%' }}>
      {/* Header / Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div>
          <div className="label" style={{ fontSize: '11px', color: 'var(--ink-2)' }}>
            EVOLUÇÃO TÁTICA • 38 RODADAS
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: '18px', fontWeight: 600 }}>
            Qualidade das Chances (xG Pró vs xG Contra)
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '11px', fontFamily: 'var(--mono)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '3px', background: accentColor, borderRadius: '1px' }} />
            <span style={{ color: 'var(--ink)' }}>xG Pró (Média 5J)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '14px',
                height: '0px',
                borderTop: '2px dashed var(--opp)',
              }}
            />
            <span style={{ color: 'var(--ink-2)' }}>xG Contra (Média 5J)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--ink-3)' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} />
            <span>V / E / D</span>
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="rollForGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 1.0, 2.0, 3.0].filter(v => v <= maxY).map(val => {
          const y = getY(val);
          return (
            <g key={val}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartW}
                y2={y}
                stroke="var(--rule)"
                strokeDasharray={val === 0 ? 'none' : '3,3'}
                strokeWidth={val === 0 ? 1.2 : 0.8}
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                fill="var(--ink-3)"
                fontSize="10"
                fontFamily="var(--mono)"
                textAnchor="end"
              >
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Area fill under xG For */}
        {areaForPath && <path d={areaForPath} fill="url(#rollForGrad)" />}

        {/* Rolling against path (dashed) */}
        {rollAgainstPath && (
          <path
            d={rollAgainstPath}
            fill="none"
            stroke="var(--opp)"
            strokeWidth="1.8"
            strokeDasharray="4,4"
            opacity="0.8"
          />
        )}

        {/* Rolling for path (solid) */}
        {rollForPath && (
          <path
            d={rollForPath}
            fill="none"
            stroke={accentColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        )}

        {/* Vertical crosshair on hover */}
        {hoveredIdx !== null && (
          <line
            x1={getX(hoveredIdx)}
            y1={padding.top}
            x2={getX(hoveredIdx)}
            y2={padding.top + chartH}
            stroke="var(--ink-2)"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        )}

        {/* Match points & interaction areas */}
        {points.map((p, idx) => {
          const x = getX(idx);
          const y = getY(p.xgFor);
          const isHovered = hoveredIdx === idx;
          const resultColor =
            p.match.result === 'V'
              ? '#10b981'
              : p.match.result === 'E'
              ? '#f59e0b'
              : '#ef4444';

          return (
            <g
              key={p.match.match_id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onClick={() => navigate(`/match/${p.match.match_id}`)}
            >
              {/* Invisible large touch target */}
              <rect
                x={x - (chartW / n) / 2}
                y={padding.top}
                width={chartW / n}
                height={chartH}
                fill="transparent"
              />

              {/* Matchday tick label at bottom every 5 matches or end */}
              {(p.matchday % 5 === 0 || p.matchday === 1 || p.matchday === 38) && (
                <text
                  x={x}
                  y={padding.top + chartH + 18}
                  fill={isHovered ? 'var(--ink)' : 'var(--ink-3)'}
                  fontSize="10"
                  fontFamily="var(--mono)"
                  textAnchor="middle"
                  fontWeight={isHovered ? 700 : 400}
                >
                  R{p.matchday}
                </text>
              )}

              {/* Raw xG point */}
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 5.5 : 3.5}
                fill={resultColor}
                stroke="var(--bg-1)"
                strokeWidth={1.5}
                style={{ transition: 'r 0.15s ease' }}
              />

              {/* Result letter badge above on hover */}
              {isHovered && (
                <circle
                  cx={x}
                  cy={y}
                  r={8}
                  fill="none"
                  stroke={resultColor}
                  strokeWidth={1.5}
                  opacity={0.6}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Floating tooltip */}
      {hoveredPoint && hoveredIdx !== null && (
        <div
          style={{
            position: 'absolute',
            top: `${Math.max(10, getY(hoveredPoint.xgFor) - 60)}px`,
            left: `${Math.min(width - 200, Math.max(20, getX(hoveredIdx) - 80))}px`,
            background: 'var(--bg-2, #18191c)',
            border: '1px solid var(--rule, #333)',
            borderRadius: '4px',
            padding: '8px 12px',
            fontSize: '11px',
            fontFamily: 'var(--mono)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: '160px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', borderBottom: '1px solid var(--rule)', paddingBottom: '3px' }}>
            <span style={{ color: 'var(--ink-3)' }}>R{hoveredPoint.matchday} • {hoveredPoint.match.is_home ? 'CASA' : 'FORA'}</span>
            <span
              style={{
                fontWeight: 700,
                color:
                  hoveredPoint.match.result === 'V'
                    ? '#10b981'
                    : hoveredPoint.match.result === 'E'
                    ? '#f59e0b'
                    : '#ef4444',
              }}
            >
              {hoveredPoint.match.result === 'V' ? 'VITÓRIA' : hoveredPoint.match.result === 'E' ? 'EMPATE' : 'DERROTA'} ({hoveredPoint.match.goals_for} - {hoveredPoint.match.goals_against})
            </span>
          </div>
          <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
            vs {hoveredPoint.match.opponent}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-2)' }}>
            <span>xG Pró / Contra:</span>
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
              {hoveredPoint.xgFor.toFixed(2)} - {hoveredPoint.xgAgainst.toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-2)' }}>
            <span>Finalizações:</span>
            <span style={{ color: 'var(--ink)' }}>
              {hoveredPoint.match.shots_for ?? '-'} vs {hoveredPoint.match.shots_against ?? '-'}
            </span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '9px', color: 'var(--accent)', textAlign: 'right' }}>
            Clique para ver a partida →
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamTrend;
