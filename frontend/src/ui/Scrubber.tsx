import { useState, useRef, useEffect } from 'react';

/** Controlador de tempo/minutos com arraste */
export function Scrubber({
  min = 0,
  max = 90,
  value,
  onChange,
  onPlay,
  playing,
  className,
}: {
  min?: number;
  max?: number;
  value: number;
  onChange: (v: number) => void;
  onPlay?: () => void;
  playing?: boolean;
  className?: string;
}) {
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startValue = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body && e.target !== scrubberRef.current) return;

      if (e.key === ' ') {
        e.preventDefault();
        onPlay?.();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        onChange(Math.min(value + step, max));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        onChange(Math.max(value - step, min));
      } else if (e.key === 'Home') {
        e.preventDefault();
        onChange(min);
      } else if (e.key === 'End') {
        e.preventDefault();
        onChange(max);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [value, onChange, onPlay, min, max]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = scrubberRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsDragging(true);
    startValue.current = value;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, newX / rect.width));
      const newValue = min + percentage * (max - min);
      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const percentage = (value - min) / (max - min);
  const currentMinute = Math.floor(value);

  return (
    <div
      ref={scrubberRef}
      role="slider"
      tabIndex={0}
      aria-label="Linha do tempo da partida"
      aria-valuenow={currentMinute}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={`Minuto ${currentMinute}${value >= 90 ? '+' : ''}`}
      className={`scrubber ${isDragging ? 'is-dragging' : ''} ${className || ''}`}
      onMouseDown={handleMouseDown}
    >
      <div className="scrubber-track">
        <div className="scrubber-fill" style={{ width: `${percentage * 100}%` }} />
        <div className="scrubber-handle" style={{ left: `${percentage * 100}%` }}>
          <div className="scrubber-minute">
            {currentMinute}{value >= 90 ? "+" : ""}
          </div>
        </div>
        {playing && <div className="scrubber-playing">PLAY</div>}
      </div>
    </div>
  );
}