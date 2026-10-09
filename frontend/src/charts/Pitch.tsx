/** Campo de futebol com coordenadas */
export interface PitchProps {
  width?: number;
  height?: number;
  showCoordinates?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function Pitch({
  width = 105,
  height = 68,
  showCoordinates = true,
  className,
  children,
}: PitchProps) {
  // Escala de 0 a 100 para coordenadas
  const pitchStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: 1050,
    aspectRatio: width / height,
    backgroundColor: 'var(--bg-2)',
    border: '1px solid var(--rule)',
    borderRadius: 2,
    overflow: 'hidden',
  };

  return (
    <div className={`pitch ${className || ''}`} style={pitchStyle}>
      {/* Borda do campo */}
      <svg
        viewBox="0 0 105 68"
        className="pitch-svg"
        style={{
          position: 'absolute',
        }}
      >
        {/* Marcações completas do campo tático */}
        <g className="pitch-markings" stroke="var(--ink-4)" strokeWidth={0.5} fill="none">
          {/* Linhas externas */}
          <rect x={2} y={2} width={101} height={64} />
          
          {/* Linha de meio-campo */}
          <line x1={52.5} y1={2} x2={52.5} y2={66} strokeDasharray="1 1" />
          
          {/* Círculo central e ponto */}
          <circle cx={52.5} cy={34} r={9.15} />
          <circle cx={52.5} cy={34} r={0.6} fill="var(--ink-4)" />

          {/* Área grande esquerda */}
          <rect x={2} y={13.84} width={16.5} height={40.32} />
          {/* Área pequena esquerda */}
          <rect x={2} y={24.84} width={5.5} height={18.32} />
          {/* Marca do pênalti esquerda */}
          <circle cx={13} cy={34} r={0.5} fill="var(--ink-4)" />
          {/* Meia lua esquerda */}
          <path d="M 18.5 27.5 A 9.15 9.15 0 0 1 18.5 40.5" />

          {/* Área grande direita */}
          <rect x={86.5} y={13.84} width={16.5} height={40.32} />
          {/* Área pequena direita */}
          <rect x={97.5} y={24.84} width={5.5} height={18.32} />
          {/* Marca do pênalti direita */}
          <circle cx={92} cy={34} r={0.5} fill="var(--ink-4)" />
          {/* Meia lua direita */}
          <path d="M 86.5 27.5 A 9.15 9.15 0 0 0 86.5 40.5" />
        </g>
      </svg>

      {/* Coordenadas */}
      {showCoordinates && (
        <div className="pitch-coordinates">
          <div className="pitch-x-axis">
            {Array.from({ length: 11 }).map((_, i) => (
              <span key={i} className="pitch-coord-x">
                {i * 10}
              </span>
            ))}
          </div>
          <div className="pitch-y-axis">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className="pitch-coord-y">
                {i * 10}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo (chutes, isolinhas, etc.) */}
      <div className="pitch-content" style={{ position: 'absolute', inset: 0 }}>
        {children}
      </div>
    </div>
  );
}