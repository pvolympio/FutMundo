import { normalizeTeamKey, CREST_DATA, TeamSlug } from '../ui/Crest';

export interface ClubTheme {
  slug: TeamSlug | null;
  primary: string;       // Cor principal do clube
  secondary: string;     // Cor secundária / detalhe
  textOnPrimary: string; // Cor de texto legível sobre o fundo primary
  accent: string;        // Cor vibrante para textos, badges e bordas em tema escuro/papel
  wash: string;          // Fundo suave translúcido
  glow: string;          // Sombra suave / iluminação ambiente
  border: string;        // Borda sutil da cor do clube
  gradient: string;      // Gradiente linear característico
}

// Mapeamento afinado com alto contraste editorial e legibilidade WCAG
const CLUB_PALETTES: Record<TeamSlug, { primary: string; secondary: string; accent: string; darkReadable: string }> = {
  arsenal: {
    primary: '#EF0107',
    secondary: '#063672',
    accent: '#FF4D4D',
    darkReadable: '#FF4D4D',
  },
  'aston-villa': {
    primary: '#670E36',
    secondary: '#95BFE5',
    accent: '#95BFE5',
    darkReadable: '#B3D4F5',
  },
  bournemouth: {
    primary: '#DA020E',
    secondary: '#B28E35',
    accent: '#FF3B47',
    darkReadable: '#FF5C66',
  },
  brentford: {
    primary: '#D20000',
    secondary: '#FBB800',
    accent: '#FBB800',
    darkReadable: '#FFC833',
  },
  brighton: {
    primary: '#0057B8',
    secondary: '#FFCD00',
    accent: '#2B82E4',
    darkReadable: '#5CA6FA',
  },
  chelsea: {
    primary: '#034694',
    secondary: '#DBA111',
    accent: '#2673D6',
    darkReadable: '#5C9DF5',
  },
  'crystal-palace': {
    primary: '#1B458F',
    secondary: '#C4122E',
    accent: '#4578D6',
    darkReadable: '#6C9BF0',
  },
  everton: {
    primary: '#003399',
    secondary: '#FFFFFF',
    accent: '#3366CC',
    darkReadable: '#6699FF',
  },
  fulham: {
    // Fulham usa preto e branco; em dark theme, acentuamos com o vermelho e branco elegante
    primary: '#111111',
    secondary: '#CC0000',
    accent: '#FF3333',
    darkReadable: '#F5F5F7',
  },
  ipswich: {
    primary: '#004494',
    secondary: '#DDA02A',
    accent: '#3377CC',
    darkReadable: '#5C9EF5',
  },
  leicester: {
    primary: '#003090',
    secondary: '#FDBE11',
    accent: '#FDBE11',
    darkReadable: '#FFD04D',
  },
  liverpool: {
    primary: '#C8102E',
    secondary: '#00A398',
    accent: '#E62E48',
    darkReadable: '#FF4D66',
  },
  'man-city': {
    primary: '#6CABDD',
    secondary: '#1C2C5B',
    accent: '#6CABDD',
    darkReadable: '#82C1F5',
  },
  'man-united': {
    primary: '#DA291C',
    secondary: '#FBE122',
    accent: '#FBE122',
    darkReadable: '#FF4233',
  },
  newcastle: {
    // Newcastle usa listras alvinegras com detalhes em azul celeste e dourado
    primary: '#141414',
    secondary: '#41B6E6',
    accent: '#41B6E6',
    darkReadable: '#6CD1FC',
  },
  'nott-m-forest': {
    primary: '#DD0000',
    secondary: '#FFFFFF',
    accent: '#FF3838',
    darkReadable: '#FF5C5C',
  },
  southampton: {
    primary: '#D71920',
    secondary: '#FFC20E',
    accent: '#FFC20E',
    darkReadable: '#FF3841',
  },
  tottenham: {
    // Spurs navy escuro -> clareado para legibilidade
    primary: '#132257',
    secondary: '#FFFFFF',
    accent: '#6C83CC',
    darkReadable: '#9BB0F0',
  },
  'west-ham': {
    primary: '#7A263A',
    secondary: '#1BB1E7',
    accent: '#1BB1E7',
    darkReadable: '#4DC8F5',
  },
  wolves: {
    primary: '#FDB913',
    secondary: '#231F20',
    accent: '#FDB913',
    darkReadable: '#FFC83B',
  },
};

/** Converter hex em RGB */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/** Calcular contraste de texto com base na luminância relativa */
function getContrastTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#0A0A0A' : '#FFFFFF';
}

/** Obter tema de cores afinado para qualquer clube da Premier League */
export function getClubTheme(nameOrSlug?: string, alt?: string): ClubTheme {
  const slug = normalizeTeamKey(nameOrSlug, alt);

  if (slug && CLUB_PALETTES[slug]) {
    const pal = CLUB_PALETTES[slug];
    const crest = CREST_DATA[slug];
    const accentRgb = hexToRgb(pal.accent);

    return {
      slug,
      primary: pal.primary,
      secondary: pal.secondary,
      textOnPrimary: getContrastTextColor(pal.primary),
      accent: pal.darkReadable,
      wash: `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.10)`,
      glow: `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.22)`,
      border: `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.35)`,
      gradient: `linear-gradient(135deg, ${pal.primary} 0%, ${crest.bg} 100%)`,
    };
  }

  // Fallback neutro com tokens do design system
  return {
    slug: null,
    primary: 'var(--accent, #E5A93C)',
    secondary: 'var(--opp, #4AA3DF)',
    textOnPrimary: '#0A0A0A',
    accent: 'var(--accent, #E5A93C)',
    wash: 'var(--accent-wash, rgba(229,169,60,0.08))',
    glow: 'rgba(229,169,60,0.20)',
    border: 'var(--rule, #26292e)',
    gradient: 'linear-gradient(135deg, var(--bg-1) 0%, var(--bg-2) 100%)',
  };
}

export default getClubTheme;
