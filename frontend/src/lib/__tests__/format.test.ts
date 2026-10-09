import { describe, it, expect } from 'vitest';
import { format } from '../format';

describe('format utilities', () => {
  it('formats numbers with maximum decimals according to pt-BR', () => {
    const formatted = format.number(1234.567, 2);
    // pt-BR uses comma or period depending on environment, typically 1.234,57
    expect(formatted).toMatch(/1[.,]234[.,]57/);
  });

  it('formats percentages correctly', () => {
    expect(format.percentage(65.4)).toBe('65%');
    expect(format.percentage(100)).toBe('100%');
    expect(format.percentage(0)).toBe('0%');
  });

  it('formats match minutes with tick mark', () => {
    expect(format.minutes(45)).toBe("45'");
    expect(format.minutes(93.4)).toBe("93'");
  });

  it('formats currencies with abbreviation suffixes (mi, bi)', () => {
    const mi = format.currency(25000000, 'EUR');
    expect(mi).toContain('mi EUR');

    const bi = format.currency(1500000000, 'EUR');
    expect(bi).toContain('bi EUR');
  });

  it('formats dates in pt-BR format', () => {
    const dateStr = '2024-05-19T15:00:00Z';
    const formatted = format.date(dateStr);
    expect(formatted).toContain('2024');
  });
});
