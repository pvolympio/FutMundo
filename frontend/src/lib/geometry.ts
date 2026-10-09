/** Funções de geometria para cálculos de campo */

export interface Point {
  x: number;
  y: number;
}

/** Converter coordenadas 0-100 para pixels */
export function toPixels(coord: number, max: number): number {
  return (coord / 100) * max;
}

/** Converter pixels para coordenadas 0-100 */
export function fromPixels(pixel: number, max: number): number {
  return (pixel / max) * 100;
}

/** Calcular distância entre dois pontos */
export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Verificar se um ponto está dentro do campo (0-100) */
export function inBounds(point: Point): boolean {
  return point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100;
}

/** Converter array de pontos 0-100 para pixels */
export function pointsToPixels(points: Point[], width: number, height: number): Point[] {
  return points.map(p => ({
    x: toPixels(p.x, width),
    y: height - toPixels(p.y, height), // Inverter Y
  }));
}