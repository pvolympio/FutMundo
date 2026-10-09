/** Tecla de teclado */
export function Kbd({
  keys,
  className,
}: {
  keys: string;
  className?: string;
}) {
  return (
    <kbd className={`kbd ${className || ''}`}>
      {keys.split('').map((key, i) => (
        <span key={i} className="kbd-key">{key}</span>
      ))}
    </kbd>
  );
}