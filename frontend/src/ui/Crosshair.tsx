/** Cruz de registro no canto do campo */
export function Crosshair({
  x,
  y,
  color = 'var(--ink-3)',
  size = 12,
}: {
  x?: number;
  y?: number;
  color?: string;
  size?: number;
}) {
  if (x === undefined || y === undefined) return null;

  return (
    <div
      className="crosshair"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        backgroundColor: color,
      }}
      role="presentation"
    />
  );
}