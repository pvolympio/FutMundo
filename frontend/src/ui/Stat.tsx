/** Dado numérico com título */
export function Stat({
  value,
  label,
  trend,
  className,
}: {
  value: string | number;
  label: string;
  trend?: 'up' | 'down';
  className?: string;
}) {
  const baseClassName = `stat ${className || ''}`;

  return (
    <div className={baseClassName}>
      <div className="num">{value}</div>
      <div className="label">{label}</div>
      {trend && (
        <div className={`trend ${trend === 'up' ? 'up' : 'down'}`}>
          {trend === 'up' ? '▲' : '▼'}
        </div>
      )}
    </div>
  );
}