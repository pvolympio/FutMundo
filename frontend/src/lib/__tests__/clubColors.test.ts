import { describe, it, expect } from 'vitest';
import { getClubTheme } from '../clubColors';

describe('clubColors theme resolver', () => {
  it('resolves club theme for known Premier League clubs', () => {
    const arsenal = getClubTheme('Arsenal');
    expect(arsenal.primary).toBe('#EF0107');
    expect(arsenal.accent).toBe('#FF4D4D');
    expect(arsenal.wash).toBeTruthy();

    const chelsea = getClubTheme('Chelsea');
    expect(chelsea.primary).toBe('#034694');
    expect(chelsea.accent).toBe('#5C9DF5');

    const liverpool = getClubTheme('Liverpool');
    expect(liverpool.primary).toBe('#C8102E');
  });

  it('matches club themes case-insensitively or via partial match', () => {
    const manCity = getClubTheme('manchester city');
    expect(manCity.primary).toBe('#6CABDD');
    expect(manCity.accent).toBe('#82C1F5');

    const wolves = getClubTheme('Wolverhampton Wanderers');
    expect(wolves.primary).toBe('#FDB913');
  });

  it('falls back to default neutral theme for empty or unknown team names', () => {
    const fallbackEmpty = getClubTheme('');
    expect(fallbackEmpty.accent).toBe('var(--accent, #E5A93C)');
    expect(fallbackEmpty.wash).toBe('var(--accent-wash, rgba(229,169,60,0.08))');

    const fallbackUnknown = getClubTheme('Time Desconhecido FC');
    expect(fallbackUnknown.accent).toBe('var(--accent, #E5A93C)');
  });
});
