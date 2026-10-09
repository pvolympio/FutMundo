import { useMemo } from 'react';

/** Histograma de chutes por intervalo de tempo */
export function ShotTempo({
  shots,
  matchDuration = 90,
  windowSize = 5,
  className,
}: {
  shots: Array<{ minute: number; xG: number; result: string; home?: boolean }>;
  matchDuration?: number;
  windowSize?: number;
  className?: string;
}) {
  const bins = useMemo(() => {
    const numBins = Math.ceil(matchDuration / windowSize);
    const data: Array<{ start: number; end: number; count: number; xg: number; homeGoals: number; awayGoals: number }> = [];

    for (let i = 0; i < numBins; i++) {
      const start = i * windowSize;
      const end = Math.min((i + 1) * windowSize, matchDuration);
      const binShots = shots.filter(s => s.minute >= start && s.minute < end);

      data.push({
        start,
        end,
        count: binShots.length,
        xg: binShots.reduce((sum, s) => sum + s.xG, 0),
        homeGoals: binShots.filter(s => s.result === 'goal' && s.home).length,
        awayGoals: binShots.filter(s => s.result === 'goal' && !s.home).length,
      });
    }

    return data;
  }, [shots, matchDuration, windowSize]);

  if (bins.length === 0) {
    return null;
  }

  const maxCount = Math.max(...bins.map(b => b.count));

  return (
    <div className={`shot-tempo ${className || ''}`}>
      <svg viewBox={`0 0 180 90`} style={{ width: '100%', height: 'auto' }}>
        {bins.map((bin, i) => (
          <g key={i}>
            {/* Barra de chutes */}
            <rect
              x={i * (windowSize === 5 ? 3 : 2.4)}
              y={90 - (bin.xg / maxCount / windowSize * 90 * 0.7)}
              width={windowSize === 5 ? 3 : 2.4}
              height={bin.xg / maxCount / windowSize * 90 * 0.7}
              fill="var(--accent-dim)"
            />

            {/* Gols */}
            {bin.homeGoals > 0 && (
              <line
                x1={i * (windowSize === 5 ? 3 : 2.4) - 2}
                x2={i * (windowSize === 5 ? 3 : 2.4) + (windowSize === 5 ? 3 : 2.4) + 2}
                y1={90 - (bin.xg / maxCount / windowSize * 90 * 0.7)}
                y2={90 - (bin.xg / maxCount / windowSize * 90 * 0.7)}
                stroke="var(--accent)"
                strokeWidth={1}
              />
            )}
          </g>
        ))}

        {/* Eixo inferior */}
        <line x1={0} y1={90} x2={180} y2={90} stroke="var(--rule)" strokeWidth={0.5} />

        {/* Marcações do tempo */}
        {Array.from({ length: 19 }).map((_, i) => (
          <g key={i}>
            <line x1={i * 9} y1={88} x2={i * 9} y2={90} stroke="var(--ink-4)" strokeWidth={0.5} />
            <text x={i * 9} y={86} textAnchor="middle" fontSize={7} fill="var(--ink-4)">
              {i * 5}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default ShotTempo;