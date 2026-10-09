import { Crest } from '../../ui/Crest';
import type { MatchSummary } from '../../lib/api';

interface MatchRoundSelectorProps {
  selectedRound: number;
  onRoundChange: (round: number) => void;
  roundMatches: MatchSummary[];
  selectedMatchId: number;
  onSelectMatch: (matchId: number) => void;
  focusName?: string;
  isHomeFocus?: boolean;
}

export function MatchRoundSelector({
  selectedRound,
  onRoundChange,
  roundMatches,
  selectedMatchId,
  onSelectMatch,
  focusName,
  isHomeFocus,
}: MatchRoundSelectorProps) {
  return (
    <div style={{ gridColumn: '1 / -1', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="editorial-badge">PREMIER LEAGUE 2024/25</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
            RODADA:
          </span>
          <select
            value={selectedRound}
            onChange={(e) => onRoundChange(Number(e.target.value))}
            aria-label="Selecionar rodada do campeonato"
            style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--rule)',
              color: 'var(--accent)',
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: '2px',
              cursor: 'pointer',
            }}
          >
            {Array.from({ length: 38 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                Rodada {i + 1}
              </option>
            ))}
          </select>
        </div>

        {focusName && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
            FOCO TÁTICO: <span style={{ color: isHomeFocus ? 'var(--accent)' : 'var(--opp)', fontWeight: 600 }}>{focusName}</span> (Atalho: F)
          </div>
        )}
      </div>

      {/* Faixa horizontal de partidas da rodada */}
      <div
        role="region"
        aria-label="Partidas da rodada"
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          scrollbarWidth: 'thin',
        }}
      >
        {roundMatches.map((m) => {
          const isSelected = m.match_id === selectedMatchId;
          return (
            <button
              key={m.match_id}
              onClick={() => onSelectMatch(m.match_id)}
              role="button"
              aria-pressed={isSelected}
              style={{
                flex: '0 0 auto',
                background: isSelected ? 'var(--accent-wash)' : 'var(--bg-1)',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--rule)',
                borderRadius: '2px',
                padding: '8px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                minWidth: '155px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)' }}>
                <span>{m.match_date ? m.match_date.split('T')[0].slice(5) : ''}</span>
                <span style={{ color: isSelected ? 'var(--accent)' : 'var(--ink)', fontWeight: 700 }}>
                  {m.home_score != null ? `${m.home_score} - ${m.away_score}` : 'vs'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--mono)', fontSize: '11px', color: isSelected ? 'var(--ink)' : 'var(--ink-2)' }}>
                <Crest name={m.home_team_short} alt={m.home_team_name} size={16} />
                <span>{m.home_team_short}</span>
                <span style={{ color: 'var(--ink-3)', fontSize: '9px' }}>×</span>
                <Crest name={m.away_team_short} alt={m.away_team_name} size={16} />
                <span>{m.away_team_short}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
