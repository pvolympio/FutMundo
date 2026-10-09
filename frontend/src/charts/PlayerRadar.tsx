
export interface PlayerMetricData {
  player_id?: number;
  name: string;
  club?: string;
  goals_per_90: number;
  xg_per_90: number;
  xa_per_90: number;
  shots_per_90: number;
  key_passes_per_90: number;
  shot_accuracy_pct: number;
  conversion_rate_pct?: number;
  matches?: number;
  minutes?: number;
}

interface PlayerRadarProps {
  playerA: PlayerMetricData;
  playerB: PlayerMetricData;
  colorA?: string;
  colorB?: string;
}

interface AxisConfig {
  key: keyof PlayerMetricData;
  label: string;
  max: number;
  unit: string;
}

const RADAR_AXES: AxisConfig[] = [
  { key: 'goals_per_90', label: 'Gols / 90', max: 1.0, unit: '' },
  { key: 'xg_per_90', label: 'xG / 90', max: 1.0, unit: '' },
  { key: 'xa_per_90', label: 'xA / 90', max: 0.5, unit: '' },
  { key: 'shots_per_90', label: 'Chutes / 90', max: 4.5, unit: '' },
  { key: 'shot_accuracy_pct', label: 'Pontaria %', max: 40, unit: '%' },
  { key: 'key_passes_per_90', label: 'Passes Decisivos / 90', max: 3.0, unit: '' },
];

export function PlayerRadar({
  playerA,
  playerB,
  colorA = 'var(--accent, #E5A93C)',
  colorB = 'var(--opp, #4AA3DF)',
}: PlayerRadarProps) {
  const size = 380;
  const center = size / 2;
  const radius = center - 50;
  const numAxes = RADAR_AXES.length;
  const angleStep = (Math.PI * 2) / numAxes;

  // Função para converter valor e índice de eixo em coordenadas (X, Y)
  const getCoordinates = (value: number, max: number, axisIndex: number) => {
    const normalized = Math.min(1, Math.max(0.08, value / max));
    const angle = axisIndex * angleStep - Math.PI / 2;
    const x = center + radius * normalized * Math.cos(angle);
    const y = center + radius * normalized * Math.sin(angle);
    return { x, y };
  };

  // Gerar path SVG para polígono
  const getPolygonPoints = (data: PlayerMetricData) => {
    return RADAR_AXES.map((axis, i) => {
      const val = Number(data[axis.key] ?? 0);
      const { x, y } = getCoordinates(val, axis.max, i);
      return `${x},${y}`;
    }).join(' ');
  };

  const pointsA = getPolygonPoints(playerA);
  const pointsB = getPolygonPoints(playerB);

  return (
    <div className="player-radar-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Legenda de Atletas */}
      <div style={{ display: 'flex', gap: '32px', marginBottom: '16px', fontFamily: 'var(--mono)', fontSize: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: colorA }} />
          <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{playerA.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: colorB }} />
          <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{playerB.name}</span>
        </div>
      </div>

      {/* SVG Radar Chart */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        {/* Níveis Concêntricos (25%, 50%, 75%, 100%) */}
        {[0.25, 0.5, 0.75, 1.0].map((level, lvlIdx) => {
          const levelPoints = RADAR_AXES.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x = center + radius * level * Math.cos(angle);
            const y = center + radius * level * Math.sin(angle);
            return `${x},${y}`;
          }).join(' ');

          return (
            <polygon
              key={lvlIdx}
              points={levelPoints}
              fill="none"
              stroke="var(--rule, #333)"
              strokeWidth={0.75}
              strokeDasharray={lvlIdx < 3 ? '2 2' : 'none'}
              opacity={0.6}
            />
          );
        })}

        {/* Linhas Radiais dos Eixos */}
        {RADAR_AXES.map((axis, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const endX = center + radius * Math.cos(angle);
          const endY = center + radius * Math.sin(angle);
          const labelX = center + (radius + 24) * Math.cos(angle);
          const labelY = center + (radius + 24) * Math.sin(angle);

          return (
            <g key={i}>
              <line
                x1={center}
                y1={center}
                x2={endX}
                y2={endY}
                stroke="var(--rule, #333)"
                strokeWidth={0.75}
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--ink-2, #888)"
                fontSize={10}
                fontFamily="var(--mono, monospace)"
                fontWeight={600}
              >
                {axis.label}
              </text>
            </g>
          );
        })}

        {/* Polígono do Jogador B (Fundo) */}
        <polygon
          points={pointsB}
          fill={colorB}
          fillOpacity={0.25}
          stroke={colorB}
          strokeWidth={2}
        />

        {/* Polígono do Jogador A (Frente) */}
        <polygon
          points={pointsA}
          fill={colorA}
          fillOpacity={0.35}
          stroke={colorA}
          strokeWidth={2.5}
        />

        {/* Vértices Jogador A */}
        {RADAR_AXES.map((axis, i) => {
          const val = Number(playerA[axis.key] ?? 0);
          const { x, y } = getCoordinates(val, axis.max, i);
          return <circle key={`A-${i}`} cx={x} cy={y} r={3.5} fill={colorA} stroke="#07161A" strokeWidth={1} />;
        })}

        {/* Vértices Jogador B */}
        {RADAR_AXES.map((axis, i) => {
          const val = Number(playerB[axis.key] ?? 0);
          const { x, y } = getCoordinates(val, axis.max, i);
          return <circle key={`B-${i}`} cx={x} cy={y} r={3.5} fill={colorB} stroke="#07161A" strokeWidth={1} />;
        })}
      </svg>

      {/* Tabela Comparativa de Diferenciais */}
      <div style={{ width: '100%', marginTop: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: '11px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--rule)', color: 'var(--ink-3)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>MÉTRICA NORMALIZADA</th>
              <th style={{ padding: '8px 12px', color: colorA, textAlign: 'right' }}>{playerA.name}</th>
              <th style={{ padding: '8px 12px', color: colorB, textAlign: 'right' }}>{playerB.name}</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>DIFERENÇA</th>
            </tr>
          </thead>
          <tbody>
            {RADAR_AXES.map((axis) => {
              const valA = Number(playerA[axis.key] ?? 0);
              const valB = Number(playerB[axis.key] ?? 0);
              const diff = valA - valB;
              const isDiffPositive = diff > 0.001;
              const isDiffZero = Math.abs(diff) <= 0.001;

              return (
                <tr key={axis.key} style={{ borderBottom: '1px solid var(--rule)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--ink-2)' }}>{axis.label}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>
                    {valA.toFixed(2)}{axis.unit}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>
                    {valB.toFixed(2)}{axis.unit}
                  </td>
                  <td
                    style={{
                      padding: '8px 12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: isDiffZero ? 'var(--ink-3)' : isDiffPositive ? colorA : colorB,
                    }}
                  >
                    {isDiffZero ? '=' : `${diff > 0 ? '+' : ''}${diff.toFixed(2)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
