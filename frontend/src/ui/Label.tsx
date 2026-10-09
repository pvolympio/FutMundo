/** Rótulo em caixa alta com espaçamento */
export function Label({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`label ${className || ''}`}>
      {children}
    </span>
  );
}