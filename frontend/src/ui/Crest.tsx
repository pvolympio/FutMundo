import React from 'react';

export type TeamSlug =
  | 'arsenal'
  | 'aston-villa'
  | 'bournemouth'
  | 'brentford'
  | 'brighton'
  | 'chelsea'
  | 'crystal-palace'
  | 'everton'
  | 'fulham'
  | 'ipswich'
  | 'leicester'
  | 'liverpool'
  | 'man-city'
  | 'man-united'
  | 'newcastle'
  | 'nott-m-forest'
  | 'southampton'
  | 'tottenham'
  | 'west-ham'
  | 'wolves';

export function normalizeTeamKey(name?: string, alt?: string): TeamSlug | null {
  const raw = (name || alt || '').toLowerCase().trim();
  if (!raw) return null;

  if (raw.includes('arsenal')) return 'arsenal';
  if (raw.includes('aston') || raw.includes('villa')) return 'aston-villa';
  if (raw.includes('bournemouth')) return 'bournemouth';
  if (raw.includes('brentford')) return 'brentford';
  if (raw.includes('brighton')) return 'brighton';
  if (raw.includes('chelsea')) return 'chelsea';
  if (raw.includes('palace')) return 'crystal-palace';
  if (raw.includes('everton')) return 'everton';
  if (raw.includes('fulham')) return 'fulham';
  if (raw.includes('ipswich')) return 'ipswich';
  if (raw.includes('leicester')) return 'leicester';
  if (raw.includes('liverpool')) return 'liverpool';
  if (raw.includes('city') || raw.includes('manchester city')) return 'man-city';
  if (raw.includes('united') || raw.includes('manchester united') || raw.includes('man united')) return 'man-united';
  if (raw.includes('newcastle')) return 'newcastle';
  if (raw.includes('forest') || raw.includes('nott')) return 'nott-m-forest';
  if (raw.includes('southampton')) return 'southampton';
  if (raw.includes('tottenham') || raw.includes('spurs')) return 'tottenham';
  if (raw.includes('west ham') || raw.includes('whu') || raw === 'ham') return 'west-ham';
  if (raw.includes('wolves') || raw.includes('wolverhampton')) return 'wolves';

  return null;
}

export const CREST_DATA: Record<TeamSlug, { bg: string; border: string; text: string; sub: string; symbol: React.ReactNode }> = {
  arsenal: {
    bg: '#EF0107',
    border: '#063672',
    text: '#FFFFFF',
    sub: '#9C824A',
    symbol: (
      // Cannon motif
      <g fill="currentColor">
        <path d="M12 28h16v3H12zM28 27l8-2v5l-8-1zM18 31a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        <rect x="14" y="24" width="10" height="2" rx="1" />
        <circle cx="28" cy="27" r="1.5" />
      </g>
    ),
  },
  'aston-villa': {
    bg: '#670E36',
    border: '#95BFE5',
    text: '#FEE505',
    sub: '#95BFE5',
    symbol: (
      // Rampant lion silhouette
      <g fill="currentColor">
        <path d="M22 17c1-2 3-3 5-3s3 2 4 4c1 2-1 4-2 6 2 1 4 3 3 6-1 2-3 3-5 3-2 3-1 6-2 9-1 1-3 1-3-1 0-3 1-5 2-8-3 1-5-1-6-3 2-2 4-2 6-3-1-3-1-6-2-8 0-1 1-2 3-2z" />
        <circle cx="28" cy="15" r="1.5" />
      </g>
    ),
  },
  bournemouth: {
    bg: '#DA020E',
    border: '#000000',
    text: '#FFFFFF',
    sub: '#B28E35',
    symbol: (
      <g fill="currentColor">
        <path d="M14 18h20v4H14zM14 26h20v4H14zM14 34h20v4H14z" opacity="0.3" />
        <circle cx="24" cy="28" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M24 20v16M16 28h16" stroke="currentColor" strokeWidth="2" />
      </g>
    ),
  },
  brentford: {
    bg: '#D20000',
    border: '#FBB800',
    text: '#000000',
    sub: '#FFFFFF',
    symbol: (
      // Bee silhouette
      <g fill="currentColor">
        <ellipse cx="24" cy="28" rx="5" ry="9" />
        <path d="M19 22c-5-4-9-1-7 4s7 3 7 3M29 22c5-4 9-1 7 4s-7 3-7 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="21" y1="26" x2="27" y2="26" stroke="#FBB800" strokeWidth="1.5" />
        <line x1="20" y1="30" x2="28" y2="30" stroke="#FBB800" strokeWidth="1.5" />
      </g>
    ),
  },
  brighton: {
    bg: '#0057B8',
    border: '#FFCD00',
    text: '#FFFFFF',
    sub: '#FFCD00',
    symbol: (
      // Seagull in flight
      <g fill="currentColor">
        <path d="M12 26c6-4 12-2 15 2 3-4 9-6 15-2-4-2-9-1-12 1-3-2-6-3-9-3-4 0-7 1-9 2z" />
        <circle cx="27" cy="25" r="1.5" />
      </g>
    ),
  },
  chelsea: {
    bg: '#034694',
    border: '#DBA111',
    text: '#FFFFFF',
    sub: '#EE242C',
    symbol: (
      // Heraldic lion with staff
      <g fill="currentColor">
        <path d="M22 16c2-1 4 0 5 2 2 3 1 6-1 8 3 1 5 3 4 7-1 3-4 4-7 4-1 2-1 5-2 8-1 1-3 0-3-2 0-3 1-5 2-8-3 0-5-2-5-5 2-1 4-1 5-2-1-3 0-6 1-9 0-1 1-2 1-3z" />
        <line x1="30" y1="14" x2="30" y2="38" stroke="#DBA111" strokeWidth="2" />
        <circle cx="30" cy="14" r="2" fill="#DBA111" />
      </g>
    ),
  },
  'crystal-palace': {
    bg: '#1B458F',
    border: '#C4122E',
    text: '#FFFFFF',
    sub: '#C4122E',
    symbol: (
      // Eagle over ball
      <g fill="currentColor">
        <path d="M14 20c4-4 9-3 12 1 3-4 8-5 12-1-3-1-6 0-8 2-2 2-2 5-3 8-1-3-2-5-4-7-3-2-6-3-9-3z" />
        <circle cx="25" cy="33" r="5" fill="#C4122E" stroke="#FFFFFF" strokeWidth="1" />
      </g>
    ),
  },
  everton: {
    bg: '#003399',
    border: '#FFFFFF',
    text: '#FFFFFF',
    sub: '#003399',
    symbol: (
      // Rupert's Tower
      <g fill="currentColor">
        <path d="M24 16l-7 7v14h14V23l-7-7z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M20 23h8v14h-8zM22 19h4v3h-4z" />
        <circle cx="24" cy="30" r="1.5" fill="#003399" />
      </g>
    ),
  },
  fulham: {
    bg: '#000000',
    border: '#CC0000',
    text: '#FFFFFF',
    sub: '#CC0000',
    symbol: (
      // Stylized FFC monogram
      <g fill="currentColor" stroke="none" fontWeight="900" fontSize="16" fontFamily="sans-serif">
        <text x="24" y="32" textAnchor="middle" fill="#CC0000" letterSpacing="1">FFC</text>
      </g>
    ),
  },
  ipswich: {
    bg: '#004494',
    border: '#C4122E',
    text: '#FFFFFF',
    sub: '#DDA02A',
    symbol: (
      // Rampant horse
      <g fill="currentColor">
        <path d="M22 17c2-2 5-1 6 1s0 5-2 6c3 2 4 5 3 8-1 3-3 4-6 4-1 2-1 5-2 7-1 1-3 0-3-2 0-3 1-5 2-7-3-1-4-3-4-6 2-1 4-1 5-2-1-3-1-6 1-9z" />
        <line x1="16" y1="36" x2="32" y2="36" stroke="#DDA02A" strokeWidth="2" />
      </g>
    ),
  },
  leicester: {
    bg: '#003090',
    border: '#FDBE11',
    text: '#FFFFFF',
    sub: '#FDBE11',
    symbol: (
      // Fox face
      <g fill="currentColor">
        <polygon points="24,35 15,22 20,20 24,25 28,20 33,22" />
        <circle cx="21" cy="24" r="1.5" fill="#003090" />
        <circle cx="27" cy="24" r="1.5" fill="#003090" />
      </g>
    ),
  },
  liverpool: {
    bg: '#C8102E',
    border: '#00A398',
    text: '#FFFFFF',
    sub: '#F6EB61',
    symbol: (
      // Liverbird silhouette
      <g fill="currentColor">
        <path d="M21 16c2-2 4-1 5 1 1 2 0 4-1 5 3 2 4 4 3 7-1 3-3 4-5 4-1 2-1 4-2 7-1 1-2 0-2-2 0-2 1-4 1-6-2 0-3-1-4-3 1-1 3-1 4-2-1-2 0-5 1-8 0-1 0-2 0-3z" />
        <path d="M26 19l4-2-2 4z" />
      </g>
    ),
  },
  'man-city': {
    bg: '#6CABDD',
    border: '#1C2C5B',
    text: '#1C2C5B',
    sub: '#FFFFFF',
    symbol: (
      // Ship and rose shield
      <g fill="currentColor">
        <path d="M16 23l8-6 8 6v8a8 8 0 0 1-16 0v-8z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M18 24h12l-2 5h-8l-2-5z" />
        <circle cx="24" cy="34" r="2.5" fill="#C8102E" />
      </g>
    ),
  },
  'man-united': {
    bg: '#DA291C',
    border: '#FBE122',
    text: '#FBE122',
    sub: '#000000',
    symbol: (
      // Red devil motif / trident
      <g fill="currentColor">
        <path d="M24 16v18M18 20v6M30 20v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 20c4-1 12-1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="14" r="2" />
        <polygon points="18,17 19,19 17,19" />
        <polygon points="30,17 31,19 29,19" />
      </g>
    ),
  },
  newcastle: {
    bg: '#000000',
    border: '#41B6E6',
    text: '#FFFFFF',
    sub: '#DDA02A',
    symbol: (
      // Vertical black and white stripes with gold crest
      <g fill="currentColor">
        <rect x="17" y="16" width="3" height="20" fill="#FFFFFF" />
        <rect x="23" y="16" width="3" height="20" fill="#FFFFFF" />
        <rect x="29" y="16" width="3" height="20" fill="#FFFFFF" />
        <path d="M18 16c3-3 9-3 12 0l-2 3h-8l-2-3z" fill="#DDA02A" />
      </g>
    ),
  },
  'nott-m-forest': {
    bg: '#DD0000',
    border: '#FFFFFF',
    text: '#FFFFFF',
    sub: '#DD0000',
    symbol: (
      // Sherwood tree
      <g fill="currentColor">
        <circle cx="24" cy="23" r="7" />
        <path d="M24 28v8M20 36h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M15 32c4-2 6-2 9 0 3-2 5-2 9 0" stroke="#DD0000" strokeWidth="1" fill="none" />
      </g>
    ),
  },
  southampton: {
    bg: '#D71920',
    border: '#130C0E',
    text: '#FFFFFF',
    sub: '#FFC20E',
    symbol: (
      // Tree and halo
      <g fill="currentColor">
        <ellipse cx="24" cy="18" rx="6" ry="2.5" fill="none" stroke="#FFC20E" strokeWidth="2" />
        <circle cx="24" cy="27" r="5" />
        <path d="M24 31v5M21 36h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
    ),
  },
  tottenham: {
    bg: '#132257',
    border: '#FFFFFF',
    text: '#FFFFFF',
    sub: '#132257',
    symbol: (
      // Cockerel on football
      <g fill="currentColor">
        <path d="M23 15c2-2 4-1 4 1 0 2-1 4-2 5 2 2 3 4 2 7-1 2-2 3-4 3-1 2-1 4-1 6-1 1-2 0-2-1 0-2 1-4 1-5-2 0-3-1-3-3 1-1 2-1 3-2-1-2 0-4 1-6 0-1 0-3 1-5z" />
        <circle cx="24" cy="34" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </g>
    ),
  },
  'west-ham': {
    bg: '#7A263A',
    border: '#1BB1E7',
    text: '#F3D459',
    sub: '#1BB1E7',
    symbol: (
      // Crossed hammers
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <line x1="16" y1="16" x2="32" y2="34" />
        <line x1="32" y1="16" x2="16" y2="34" />
        <rect x="13" y="14" width="6" height="4" rx="1" fill="currentColor" stroke="none" transform="rotate(-45 16 16)" />
        <rect x="29" y="14" width="6" height="4" rx="1" fill="currentColor" stroke="none" transform="rotate(45 32 16)" />
      </g>
    ),
  },
  wolves: {
    bg: '#FDB913',
    border: '#231F20',
    text: '#231F20',
    sub: '#FFFFFF',
    symbol: (
      // Geometric wolf head
      <g fill="currentColor">
        <polygon points="24,34 16,21 19,19 24,24 29,19 32,21" />
        <polygon points="24,31 19,23 29,23" fill="#FDB913" />
        <circle cx="21" cy="24" r="1.5" />
        <circle cx="27" cy="24" r="1.5" />
      </g>
    ),
  },
};

/** Escudo profissional de clube com vetorização de alta fidelidade para os 20 clubes */
export function Crest({
  name,
  alt,
  size = 40,
  className,
}: {
  name?: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  const teamKey = normalizeTeamKey(name, alt);
  const initials = (name || alt || '???')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .substring(0, 3)
    .toUpperCase();

  if (teamKey && CREST_DATA[teamKey]) {
    const data = CREST_DATA[teamKey];
    return (
      <svg
        className={`crest crest-${teamKey} ${className || ''}`}
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={alt || name}
        style={{
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
        }}
      >
        <defs>
          <linearGradient id={`grad-${teamKey}`} x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={data.bg} stopOpacity="1" />
            <stop offset="100%" stopColor={data.bg} stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Traditional curved football shield base */}
        <path
          d="M8 8C16 8 20 6 24 4C28 6 32 8 40 8C40 24 36 38 24 44C12 38 8 24 8 8Z"
          fill={`url(#grad-${teamKey})`}
          stroke={data.border}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Inner border line */}
        <path
          d="M11 10C17 10 21 8.5 24 6.8C27 8.5 31 10 37 10C37 23 33.5 35 24 40.5C14.5 35 11 23 11 10Z"
          fill="none"
          stroke={data.sub}
          strokeWidth="1"
          strokeOpacity="0.75"
        />

        {/* Club Symbol Icon */}
        <g color={data.text}>{data.symbol}</g>
      </svg>
    );
  }

  // Fallback para outros times / inicial estilizada
  return (
    <div
      className={`crest crest-fallback ${className || ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
        border: '1px solid var(--line-subtle, rgba(255,255,255,0.15))',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(10, Math.floor(size * 0.35)),
        fontWeight: 700,
        fontFamily: 'var(--font-mono, monospace)',
        color: 'var(--fg-muted, #888)',
        letterSpacing: '0.05em',
        flexShrink: 0,
      }}
      role="img"
      aria-label={alt}
    >
      {initials}
    </div>
  );
}

export function getTeamColors(name?: string, alt?: string) {
  const key = normalizeTeamKey(name, alt);
  if (key && CREST_DATA[key]) {
    return CREST_DATA[key];
  }
  return {
    bg: 'var(--accent)',
    border: 'var(--rule)',
    text: '#ffffff',
    sub: 'var(--ink-2)',
  };
}