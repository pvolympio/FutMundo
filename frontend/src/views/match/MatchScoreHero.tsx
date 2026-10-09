import { Crest } from '../../ui/Crest';
import { Skeleton } from '../../ui/Skeleton';
import type { MatchDetails } from '../../lib/api';

interface MatchScoreHeroProps {
  loading: boolean;
  matchData?: MatchDetails;
  homeTheme: { accent: string; wash: string };
  awayTheme: { accent: string; wash: string };
  isHomeFocus: boolean;
  homeScore: number;
  awayScore: number;
  homeXG: number;
  awayXG: number;
  homePoss: number;
  awayPoss: number;
  impliedOdds: { home: number; draw: number; away: number; bookmaker: string } | null;
}

export function MatchScoreHero({
  loading,
  matchData,
  homeTheme,
  awayTheme,
  isHomeFocus,
  homeScore,
  awayScore,
  homeXG,
  awayXG,
  homePoss,
  awayPoss,
  impliedOdds,
}: MatchScoreHeroProps) {
  if (loading) {
    return (
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '40px 20px',
          background: 'var(--bg-1)',
          border: '1px solid var(--rule)',
          borderRadius: '2px',
          marginBottom: '16px',
        }}
        role="status"
        aria-busy="true"
        aria-label="Carregando placar da partida"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </div>
          <Skeleton variant="circle" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Skeleton variant="text" />
          <Skeleton variant="text" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Skeleton variant="circle" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '32px 24px',
          background: `radial-gradient(ellipse at 12% 50%, ${homeTheme.wash} 0%, transparent 60%), radial-gradient(ellipse at 88% 50%, ${awayTheme.wash} 0%, transparent 60%), var(--bg-1)`,
          border: '1px solid var(--rule)',
          borderRadius: '4px',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}
      >
        {/* Mandante */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, justifyContent: 'flex-end', paddingRight: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '26px', color: isHomeFocus ? homeTheme.accent : 'var(--ink)', fontWeight: 600 }}>
              {matchData?.home_team?.name}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '11.5px', color: 'var(--ink-2)', marginTop: '4px' }}>
              xG <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{Number(homeXG).toFixed(2)}</span> • Posse <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{homePoss}%</span>
            </div>
          </div>
          <Crest name={matchData?.home_team?.name} alt={matchData?.home_team?.name || 'Mandante'} size={68} />
          <span
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(56px, 8vw, 96px)',
              lineHeight: 0.9,
              color: isHomeFocus ? homeTheme.accent : 'var(--ink)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 300,
            }}
          >
            {homeScore}
          </span>
        </div>

        {/* Divisor x com Metadados Centrais */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '0 20px' }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: '32px', color: 'var(--rule)', fontWeight: 300 }}>×</span>
          <span className="editorial-badge" style={{ fontSize: '9px' }}>
            {matchData?.venue?.name || 'Estádio Oficial'}
          </span>
          {matchData?.officials && matchData.officials.length > 0 && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)' }}>
              Árb: {matchData.officials[0].name}
            </span>
          )}
        </div>

        {/* Visitante */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, justifyContent: 'flex-start', paddingLeft: '20px' }}>
          <span
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(56px, 8vw, 96px)',
              lineHeight: 0.9,
              color: !isHomeFocus ? awayTheme.accent : 'var(--ink)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 300,
            }}
          >
            {awayScore}
          </span>
          <Crest name={matchData?.away_team?.name} alt={matchData?.away_team?.name || 'Visitante'} size={68} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '26px', color: !isHomeFocus ? awayTheme.accent : 'var(--ink)', fontWeight: 600 }}>
              {matchData?.away_team?.name}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '11.5px', color: 'var(--ink-2)', marginTop: '4px' }}>
              xG <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{Number(awayXG).toFixed(2)}</span> • Posse <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{awayPoss}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Widget de Probabilidade Implícita das Odds */}
      {impliedOdds && (
        <div
          role="region"
          aria-label="Probabilidades pré-jogo das odds"
          style={{ gridColumn: '1 / -1', background: 'var(--bg-1)', border: '1px solid var(--rule)', padding: '12px 20px', borderRadius: '2px', marginBottom: '20px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)', marginBottom: '6px' }}>
            <span>PROBABILIDADES PRÉ-JOGO (Cotações {impliedOdds.bookmaker})</span>
            <span>Vitória {matchData?.home_team?.short_name} ({impliedOdds.home}%) • Empate ({impliedOdds.draw}%) • Vitória {matchData?.away_team?.short_name} ({impliedOdds.away}%)</span>
          </div>
          <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', width: '100%' }}>
            <div style={{ width: `${impliedOdds.home}%`, background: homeTheme.accent }} title={`Vitória ${matchData?.home_team?.short_name}: ${impliedOdds.home}%`} />
            <div style={{ width: `${impliedOdds.draw}%`, background: 'var(--rule)' }} title={`Empate: ${impliedOdds.draw}%`} />
            <div style={{ width: `${impliedOdds.away}%`, background: awayTheme.accent }} title={`Vitória ${matchData?.away_team?.short_name}: ${impliedOdds.away}%`} />
          </div>
        </div>
      )}
    </>
  );
}
