/**
 * Lista virtualizada de chutes para performance em timelines longos.
 * Usa react-window v2 para renderizar apenas os itens visíveis.
 */
import type { CSSProperties, FC, ReactElement } from 'react';
import { List } from 'react-window';
import { Shot } from '../charts/ShotMarkers';
import { MatchDetailsData } from '../lib/api';

interface RowCustomProps {
  shots: Shot[];
  currentTime: number;
  matchData: MatchDetailsData | null;
}

function ShotRow({
  shots,
  currentTime,
  matchData,
  index,
  style,
}: {
  shots: Shot[];
  currentTime: number;
  matchData: MatchDetailsData | null;
  index: number;
  style: CSSProperties;
}): ReactElement | null {
  const shot = shots[index];
  if (!shot) return null;
  const isPast = shot.minute <= currentTime;

  return (
    <div
      style={style}
      className={`shot-timeline-item ${isPast ? '' : 'past-event'}`}
    >
      <span style={{ color: shot.home ? 'var(--accent)' : 'var(--opp)', fontWeight: 600 }}>
        {shot.minute}'
      </span>{' '}
      <span style={{ fontWeight: 600, color: 'var(--ink)', opacity: isPast ? 1 : 0.6 }}>
        {shot.result === 'goal' ? 'GOL!' : shot.result === 'saved' ? 'DEFENDIDO' : shot.result === 'blocked' ? 'BLOQUEADO' : 'FORA'}
      </span>{' '}
      <span style={{ opacity: isPast ? 1 : 0.6 }}>{shot.player}</span>
      {shot.assist && (
        <span style={{ color: 'var(--ink-3)', opacity: isPast ? 1 : 0.6 }}> (assist {shot.assist})</span>
      )}
      <div style={{ fontSize: '9.5px', color: 'var(--ink-3)' }}>
        xG {shot.xG.toFixed(2)} • {shot.bodyPart === 'head' ? 'Cabeceio' : shot.bodyPart === 'left_foot' ? 'Pé esquerdo' : 'Pé direito'} • {shot.home ? matchData?.home_team?.short_name : matchData?.away_team?.short_name}
      </div>
    </div>
  );
}

interface VirtualizedShotListProps {
  shots: Shot[];
  currentTime: number;
  matchData: MatchDetailsData | null;
  itemHeight?: number;
  maxHeight?: number;
}

export const VirtualizedShotList: FC<VirtualizedShotListProps> = ({
  shots,
  currentTime,
  matchData,
  itemHeight = 32,
  maxHeight = 340,
}) => {
  return (
    <List<RowCustomProps>
      rowCount={shots.length}
      rowHeight={itemHeight}
      rowComponent={ShotRow}
      rowProps={{ shots, currentTime, matchData }}
      style={{ height: maxHeight, fontFamily: 'var(--mono)', fontSize: '11px' }}
    />
  );
};