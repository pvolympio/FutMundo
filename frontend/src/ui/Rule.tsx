/** Régua horizontal ou vertical para dividers */
export function Rule({
  orientation = 'horizontal',
  thickness = '1px',
  color = 'var(--rule)',
  className,
}: {
  orientation?: 'horizontal' | 'vertical';
  thickness?: string;
  color?: string;
  className?: string;
}) {
  const style: React.CSSProperties = {
    [orientation]: orientation === 'horizontal' ? '1px 0' : '0 1px',
    width: orientation === 'horizontal' ? '100%' : thickness,
    height: orientation === 'vertical' ? '100%' : thickness,
    backgroundColor: color,
  };

  return <div style={style} className={className} />;
}