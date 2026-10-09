/** Linha de estatísticas horizontal */
export function StatsRow({
  label,
  value,
  unit,
  trend,
  compare,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down';
  compare?: number; // percentual de variação
  className?: string;
}) {
  return (
    <div className={`stats-row ${className || ''}`}>
      <div className="stats-label">{label}</div>
      <div className="stats-value">
        {value}
        {unit && <span className="stats-unit">{unit}</span>}
        {trend && (
          <span className={`stats-trend ${trend}`}>{trend === 'up' ? '▲' : '▼'}</span>
        )}
        {compare !== undefined && (
          <span className="stats-compare">
            ({compare > 0 ? '+' : ''}{compare}%)
          </span>
        )}
      </div>
    </div>
  );
}