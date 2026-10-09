import { describe, it, expect } from 'vitest';
import { toPixels, fromPixels, distance, inBounds, pointsToPixels } from '../geometry';

describe('geometry utilities', () => {
  it('converts normalized 0-100 coordinates to pixels correctly', () => {
    expect(toPixels(0, 1000)).toBe(0);
    expect(toPixels(50, 1000)).toBe(500);
    expect(toPixels(100, 1000)).toBe(1000);
    expect(toPixels(25, 680)).toBe(170);
  });

  it('converts pixels back to normalized 0-100 coordinates', () => {
    expect(fromPixels(0, 1000)).toBe(0);
    expect(fromPixels(500, 1000)).toBe(50);
    expect(fromPixels(1000, 1000)).toBe(100);
  });

  it('calculates euclidean distance between two points', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 3, y: 4 };
    expect(distance(p1, p2)).toBe(5);

    const same = { x: 50, y: 50 };
    expect(distance(same, same)).toBe(0);
  });

  it('verifies whether a point is within pitch boundaries (0-100)', () => {
    expect(inBounds({ x: 50, y: 50 })).toBe(true);
    expect(inBounds({ x: 0, y: 0 })).toBe(true);
    expect(inBounds({ x: 100, y: 100 })).toBe(true);
    expect(inBounds({ x: -1, y: 50 })).toBe(false);
    expect(inBounds({ x: 50, y: 105 })).toBe(false);
  });

  it('maps an array of normalized points to pixel coordinates with inverted Y', () => {
    const raw = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 100 },
    ];
    const mapped = pointsToPixels(raw, 1000, 600);

    expect(mapped).toEqual([
      { x: 0, y: 600 },
      { x: 500, y: 300 },
      { x: 1000, y: 0 },
    ]);
  });
});
