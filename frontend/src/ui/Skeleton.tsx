/** Container para estados de loading com shimmer */
export function Skeleton({
  className,
  variant = 'text',
  count = 1,
}: {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  count?: number;
}) {
  const baseClass = `skeleton ${variant} ${className || ''}`;

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={baseClass} />
      ))}
    </>
  );
}