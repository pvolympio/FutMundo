import { useMemo } from 'react';
import { contourDensity } from 'd3-contour';

export interface Shot {
  x: number;
  y: number;
  xG: number;
}

/** Isolinhas de densidade de chutes ponderadas por xG */
export function ShotContours({
  shots,
  color = 'var(--accent)',
  width = 1050,
  height = 680,
  className,
}: {
  shots: Shot[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  // Preparar dados para KDE
  const data = useMemo(() => {
    return shots.map(s => ({
      x: (s.x / 100) * width,
      y: height - (s.y / 100) * height,
      weight: s.xG
    }));
  }, [shots, width, height]);

  // Gerar densidade contour
  const contours = useMemo(() => {
    if (data.length < 3) return [];

    // Criar array de pontos para d3-contour (replicar por peso)
    const points = data.flatMap(d =>
      Array.from({ length: Math.max(1, Math.ceil(d.weight * 50)) }, () => ({
        x: d.x,
        y: d.y
      }))
    );

    if (points.length === 0) return [];

    const density = contourDensity<{ x: number; y: number }>()
      .x(d => d.x)
      .y(d => d.y)
      .size([width, height])
      .bandwidth(9)
      .thresholds(6);

    const result = density(points);

    // Converter GeoJSON MultiPolygon para path SVG d
    return result.map(c => {
      const d = c.coordinates
        .map(polygon =>
          polygon
            .map(ring =>
              ring
                .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
                .join(' ') + ' Z'
            )
            .join(' ')
        )
        .join(' ');
      return { d, area: c.value };
    });
  }, [data, width, height]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`shot-contours ${className || ''}`}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {contours.map((contour, i) => (
        <path
          key={i}
          d={contour.d}
          fill={color}
          fillOpacity={0.08}
          stroke={color}
          strokeWidth={i === 0 ? 1 : 0.5}
          strokeOpacity={0.6}
        />
      ))}
    </svg>
  );
}

export default ShotContours;