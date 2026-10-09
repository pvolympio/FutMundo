import { useMemo } from 'react';

export interface ShotPoint {
  minute: number;
  xG: number;
}

/** Corrida acumulada de xG entre dois times */
export function XgRace({
  shotsA,
  shotsB,
  matchDuration = 90,
  className,
}: {
  shotsA: Array<{ minute: number; xG: number }>;
  shotsB: Array<{ minute: number; xG: number }>;
  matchDuration?: number;
  className?: string;
}) {
  // Calcular xG acumulado simplificado por minuto e eventos de chute
  const { stepsA, stepsB } = useMemo(() => {
    const simplifiedA: ShotPoint[] = [];
    const simplifiedB: ShotPoint[] = [];
    let runningA = 0;
    let runningB = 0;

    for (let m = 0; m <= matchDuration; m++) {
      shotsA.forEach(s => { if (s.minute === m) runningA += s.xG; });
      shotsB.forEach(s => { if (s.minute === m) runningB += s.xG; });
      if (m % 5 === 0 || shotsA.some(s => s.minute === m) || shotsB.some(s => s.minute === m)) {
        simplifiedA.push({ minute: m, xG: runningA });
        simplifiedB.push({ minute: m, xG: runningB });
      }
    }

    return { stepsA: simplifiedA, stepsB: simplifiedB };
  }, [shotsA, shotsB, matchDuration]);

  if (stepsA.length === 0 && stepsB.length === 0) {
    return null;
  }

  return (
    <div className={`xg-race ${className || ''}`}>
      <svg
        role="img"
        aria-labelledby="xgrace-title xgrace-desc"
        viewBox={`0 0 300 ${(matchDuration / 90) * 200}`}
        style={{ width: '100%', height: 'auto' }}
      >
        <title id="xgrace-title">Gráfico de Corrida de xG</title>
        <desc id="xgrace-desc">Evolução minuto a minuto dos gols esperados acumulados de ambas as equipes durante o confronto.</desc>
        {/* Linhas de referência */}
        <g className="xg-grid" stroke="var(--rule)" strokeWidth={0.5}>
          {Array.from({ length: 19 }).map((_, i) => (
            <line key={i} x1={0} y1={i * 10} x2={300} y2={i * 10} />
          ))}
        </g>

        {/* Limite de 90 minutos */}
        <line x1={280} y1={0} x2={280} y2={180} stroke="var(--ink-4)" strokeWidth={1} strokeDasharray="2,2" />

        {/* Linha de xG A */}
        <path
          d={`M 0 ${stepsA.length > 0 ? 180 - stepsA[0].xG * 15 : 0} ${stepsA.slice(1).map(s =>
            `${s.minute * (300 / 90)} ${180 - s.xG * 15}`
          ).join(' ')}`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
        />

        {/* Linha de xG B */}
        <path
          d={`M 0 ${stepsB.length > 0 ? 180 - stepsB[0].xG * 15 : 0} ${stepsB.slice(1).map(s =>
            `${s.minute * (300 / 90)} ${180 - s.xG * 15}`
          ).join(' ')}`}
          fill="none"
          stroke="var(--opp)"
          strokeWidth={1.5}
        />

        {/* Pontos de chutes */}
        {shotsA.map((sh, idx) => {
          const step = stepsA.find(s => s.minute >= sh.minute);
          const y = 180 - (step ? step.xG : 0) * 15;
          return (
            <circle
              key={`shot-a-${idx}`}
              cx={sh.minute * (300 / 90)}
              cy={y}
              r={Math.max(2, Math.min(6, (sh.xG || 0.1) * 8))}
              fill="var(--accent)"
              stroke="#fff"
              strokeWidth={0.5}
            />
          );
        })}
        {shotsB.map((sh, idx) => {
          const step = stepsB.find(s => s.minute >= sh.minute);
          const y = 180 - (step ? step.xG : 0) * 15;
          return (
            <circle
              key={`shot-b-${idx}`}
              cx={sh.minute * (300 / 90)}
              cy={y}
              r={Math.max(2, Math.min(6, (sh.xG || 0.1) * 8))}
              fill="var(--opp)"
              stroke="#fff"
              strokeWidth={0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}