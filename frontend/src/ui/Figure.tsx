/** Container para figuras com legendas e numeração */
export function Figure({
  children,
  caption,
  figureNumber,
  className,
}: {
  children: React.ReactNode;
  caption?: string;
  figureNumber?: string;
  className?: string;
}) {
  return (
    <figure className={`figure ${className || ''}`}>
      {figureNumber && <div className="figure-number">{figureNumber}</div>}
      {children}
      {caption && <figcaption className="caption">{caption}</figcaption>}
    </figure>
  );
}