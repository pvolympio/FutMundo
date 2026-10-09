import { Crest } from '../ui/Crest';

/** Tabela de classificação editorial com escudos de clubes */
export function StandingsTable({
  data,
  title = 'TABELA OFICIAL',
  round = '',
  className,
}: {
  data: Array<{
    position: number;
    team: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    gd: number;
    pts: number;
    xG?: number;
    xA?: number;
    focus?: boolean;
  }>;
  title?: string;
  round?: string;
  className?: string;
}) {
  return (
    <div className={`standings-table ${className || ''}`}>
      <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="title" style={{ fontFamily: 'var(--serif)', margin: 0 }}>{title}</h3>
        {round && <div className="label" style={{ color: 'var(--accent)' }}>RODADA {round} DE 38</div>}
      </div>

      <table role="table" aria-label="Classificação da liga" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ width: '40px', textAlign: 'center' }}>#</th>
            <th style={{ textAlign: 'left' }}>Equipe</th>
            <th style={{ textAlign: 'center' }}>J</th>
            <th style={{ textAlign: 'center' }}>V</th>
            <th style={{ textAlign: 'center' }}>E</th>
            <th style={{ textAlign: 'center' }}>D</th>
            <th style={{ textAlign: 'center' }}>GF</th>
            <th style={{ textAlign: 'center' }}>GC</th>
            <th style={{ textAlign: 'center' }}>SG</th>
            <th style={{ textAlign: 'right' }}>PTS</th>
          </tr>
        </thead>
        <tbody>
          {data.map((team) => {
            const isTop4 = team.position <= 4;
            const isRelegation = team.position >= 18;

            return (
              <tr key={team.team} className={team.focus ? 'focus' : ''}>
                <td style={{ textAlign: 'center', fontWeight: isTop4 ? 700 : 400, color: isTop4 ? 'var(--accent)' : isRelegation ? 'var(--down)' : 'var(--ink-3)' }}>
                  {team.position}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Crest name={team.team} alt={team.team} size={22} />
                    <span style={{ fontWeight: isTop4 ? 600 : 400, color: 'var(--ink)' }}>{team.team}</span>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>{team.played}</td>
                <td style={{ textAlign: 'center' }}>{team.won}</td>
                <td style={{ textAlign: 'center' }}>{team.drawn}</td>
                <td style={{ textAlign: 'center' }}>{team.lost}</td>
                <td style={{ textAlign: 'center' }}>{team.gf}</td>
                <td style={{ textAlign: 'center' }}>{team.ga}</td>
                <td style={{ textAlign: 'center', color: team.gd > 0 ? 'var(--up)' : team.gd < 0 ? 'var(--down)' : 'var(--ink-3)' }}>
                  {team.gd > 0 ? '+' + team.gd : team.gd < 0 ? team.gd : '0'}
                </td>
                <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: isTop4 ? 'var(--accent)' : 'var(--ink)' }}>
                  {team.pts}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}