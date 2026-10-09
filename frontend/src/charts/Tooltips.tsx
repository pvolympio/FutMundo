import { useState, useRef, useEffect } from 'react';

/** Tooltip para coordenadas no campo */
export function CoordinateTooltip({
  x,
  y,
  area,
  situation,
  isOpen,
}: {
  x: number;
  y: number;
  area: string;
  situation: string;
  isOpen: boolean;
}) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Posicionar tooltip acima ou abaixo dependendo da posição y
    setPosition({
      left: x > 50 ? -100 : 0,
      top: y > 50 ? -40 : 'auto' as unknown as number,
    });
  }, [x, y, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={tooltipRef}
      className="coordinate-tooltip"
      style={{
        position: 'absolute',
        left: `calc(${x}% + ${typeof position.left === 'number' ? position.left : 0}px)`,
        top: typeof position.top === 'number' ? `${position.top}px` : 'auto',
        transform: isOpen && typeof position.top === 'number'
          ? 'translateX(-50%) translateY(-100%)'
          : 'translateX(-50%)',
        zIndex: 100,
      }}
      role="tooltip"
    >
      <div className="coordinate-value">
        X {x.toFixed(1)} · Y {y.toFixed(1)}
      </div>
      <div className="coordinate-area">
        {area}
      </div>
      {situation && (
        <div className="coordinate-situation">
          {situation}
        </div>
      )}
    </div>
  );
}