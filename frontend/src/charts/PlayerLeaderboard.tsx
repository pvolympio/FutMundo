import { Link } from 'react-router-dom';
import type { PlayerRankingItem } from '../lib/api';
import { Crest } from '../ui/Crest';
import { Skeleton } from '../ui/Skeleton';

interface PlayerLeaderboardProps {
  items: PlayerRankingItem[];
  metric: 'goals' | 'assists' | 'xg' | 'xa';
  isLoading?: boolean;
}

export function PlayerLeaderboard({ items, metric, isLoading }: PlayerLeaderboardProps) {
  const metricLabel =
    metric === 'goals'
      ? 'Gols'
      : metric === 'assists'
      ? 'Assistências'
      : metric === 'xg'
      ? 'Gols Esperados (xG)'
      : 'Assist. Esperadas (xA)';

  const metricPer90Label =
    metric === 'goals'
      ? 'Gols / 90'
      : metric === 'assists'
      ? 'Assist / 90'
      : metric === 'xg'
      ? 'xG / 90'
      : 'xA / 90';

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
        <Skeleton variant="rect" count={8} />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
        Nenhum atleta encontrado no ranking.
      </div>
    );
  }

  return (
    <div className="standings-table" style={{ width: '100%', overflowX: 'auto' }}>
      <table role="table" aria-label={`Ranking de ${metricLabel}`} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ width: '44px', textAlign: 'center' }}>#</th>
            <th style={{ textAlign: 'left', paddingLeft: '16px' }}>Atleta</th>
            <th style={{ textAlign: 'left' }}>Clube</th>
            <th style={{ textAlign: 'center' }}>Partidas (Min)</th>
            <th style={{ textAlign: 'right' }}>{metricLabel}</th>
            <th style={{ textAlign: 'right' }}>{metricPer90Label}</th>
            <th style={{ textAlign: 'right', paddingRight: '16px' }}>
              {metric === 'goals' ? 'xG Total' : metric === 'assists' ? 'xA Total' : 'Gols'}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const isPodium = p.rank <= 3;
            const podiumColor = p.rank === 1 ? '#FEE505' : p.rank === 2 ? '#E2E8F0' : '#F97316';
            const metricVal =
              metric === 'goals'
                ? p.goals
                : metric === 'assists'
                ? p.assists
                : metric === 'xg'
                ? p.xg.toFixed(2)
                : p.xa.toFixed(2);

            const per90Val =
              metric === 'goals'
                ? p.goals_per_90.toFixed(2)
                : metric === 'assists'
                ? (p.assists / (p.minutes > 0 ? p.minutes / 90 : 1)).toFixed(2)
                : metric === 'xg'
                ? p.xg_per_90.toFixed(2)
                : p.xa_per_90.toFixed(2);

            const secondaryVal =
              metric === 'goals'
                ? p.xg.toFixed(2)
                : metric === 'assists'
                ? p.xa.toFixed(2)
                : p.goals;

            return (
              <tr key={p.player_id}>
                <td style={{ textAlign: 'center', fontWeight: isPodium ? 700 : 400 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: isPodium ? 'var(--bg-2)' : 'transparent',
                      color: isPodium ? podiumColor : 'var(--ink-3)',
                      border: isPodium ? `1px solid ${podiumColor}` : 'none',
                      fontSize: '11px',
                    }}
                  >
                    {p.rank}
                  </span>
                </td>
                <td style={{ paddingLeft: '16px' }}>
                  <Link
                    to={`/player/${p.player_id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      textDecoration: 'none',
                      color: 'var(--ink)',
                      fontWeight: 600,
                    }}
                  >
                    {p.photo_url ? (
                      <img
                        src={p.photo_url}
                        alt={p.name}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          background: 'var(--bg-2)',
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: 'var(--bg-2)',
                          border: '1px solid var(--rule)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          color: 'var(--ink-3)',
                        }}
                      >
                        {p.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span>{p.name}</span>
                  </Link>
                </td>
                <td>
                  <Link
                    to={p.team_id ? `/team/${p.team_id}` : '/team'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      textDecoration: 'none',
                      color: 'var(--ink-2)',
                      fontSize: '12px',
                    }}
                  >
                    <Crest name={p.team_name || p.team_short} alt={p.team_name || ''} size={18} />
                    <span>{p.team_short || p.team_name || '-'}</span>
                  </Link>
                </td>
                <td style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: '12px' }}>
                  {p.matches}J <span style={{ fontSize: '10px' }}>({p.minutes}')</span>
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontSize: '16px',
                    fontWeight: 700,
                    color: isPodium ? 'var(--accent)' : 'var(--ink)',
                  }}
                >
                  {metricVal}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--ink-2)', fontSize: '12px' }}>
                  {per90Val}
                </td>
                <td style={{ textAlign: 'right', paddingRight: '16px', color: 'var(--ink-3)', fontSize: '12px' }}>
                  {secondaryVal}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PlayerLeaderboard;
