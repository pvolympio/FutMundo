import { Stat } from '../../ui/Stat';

interface MatchStatsGridProps {
  homeTeamShort?: string;
  awayTeamShort?: string;
  homeShotsCount: number;
  awayShotsCount: number;
  homeScore: number;
  awayScore: number;
  homePoss: number;
  awayPoss: number;
  homeXG: number;
  awayXG: number;
}

export function MatchStatsGrid({
  homeTeamShort = 'Mandante',
  awayTeamShort = 'Visitante',
  homeShotsCount,
  awayShotsCount,
  homeScore,
  awayScore,
  homePoss,
  awayPoss,
  homeXG,
  awayXG,
}: MatchStatsGridProps) {
  return (
    <div style={{ gridColumn: '1 / -1', marginTop: '24px' }}>
      <div
        role="region"
        aria-label="Estatísticas consolidadas da partida"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          background: 'var(--bg-1)',
          border: '1px solid var(--rule)',
          padding: '20px',
          borderRadius: '2px',
        }}
      >
        <Stat value={homeShotsCount} label={`Chutes ${homeTeamShort}`} />
        <Stat value={awayShotsCount} label={`Chutes ${awayTeamShort}`} />
        <Stat value={homeScore} label={`Gols ${homeTeamShort}`} />
        <Stat value={awayScore} label={`Gols ${awayTeamShort}`} />
        <Stat value={`${homePoss}%`} label={`Posse ${homeTeamShort}`} />
        <Stat value={`${awayPoss}%`} label={`Posse ${awayTeamShort}`} />
        <Stat value={homeXG.toFixed(2)} label={`xG ${homeTeamShort}`} />
        <Stat value={awayXG.toFixed(2)} label={`xG ${awayTeamShort}`} />
      </div>
    </div>
  );
}
