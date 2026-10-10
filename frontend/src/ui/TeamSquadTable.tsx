import type { TeamSeasonPlayer } from '../lib/api';

export interface TeamSquadTableProps {
  squad: TeamSeasonPlayer[];
  isLoading: boolean;
  squadFilter: string;
  onFilterChange: (filter: string) => void;
  onSelectPlayer: (playerId: number) => void;
  accentColor: string;
}

const POSITION_TABS = [
  { id: 'all', label: 'Todos' },
  { id: 'gk', label: 'Goleiros' },
  { id: 'def', label: 'Defensores' },
  { id: 'mid', label: 'Meio-campo' },
  { id: 'att', label: 'Atacantes' },
];

export function TeamSquadTable({
  squad,
  isLoading,
  squadFilter,
  onFilterChange,
  onSelectPlayer,
  accentColor,
}: TeamSquadTableProps) {
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div className="label" style={{ color: accentColor, marginBottom: '4px' }}>
            ELENCO DA TEMPORADA ({squad.length} ATLETAS)
          </div>
          <div style={{ color: 'var(--ink-2)', fontSize: '13px' }}>
            Dados reais agregados das súmulas oficiais da Premier League
          </div>
        </div>

        {/* Filtros de Posição com atributos de acessibilidade */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="tablist" aria-label="Filtrar elenco por posição">
          {POSITION_TABS.map((tab) => {
            const isSelected = squadFilter === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => onFilterChange(tab.id)}
                className={`header-btn ${isSelected ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: '11px', fontFamily: 'var(--mono)' }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="editorial-card table-responsive" style={{ padding: 0 }}>
        <table className="standings-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: '20px' }}>Atleta</th>
              <th style={{ textAlign: 'left' }}>Posição</th>
              <th style={{ textAlign: 'center' }}>Nacionalidade</th>
              <th style={{ textAlign: 'right' }}>Jogos (Titular)</th>
              <th style={{ textAlign: 'right' }}>Minutos</th>
              <th style={{ textAlign: 'right' }}>Gols</th>
              <th style={{ textAlign: 'right' }}>Assist.</th>
              <th style={{ textAlign: 'right' }}>xG</th>
              <th style={{ textAlign: 'right', paddingRight: '20px' }}>xA</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} style={{ padding: '30px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: '12px' }}>
                    Carregando elenco oficial...
                  </div>
                </td>
              </tr>
            ) : squad.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-3)' }}>
                  Nenhum atleta encontrado para este filtro.
                </td>
              </tr>
            ) : (
              squad.map((player) => (
                <tr
                  key={player.player_id}
                  onClick={() => onSelectPlayer(player.player_id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ paddingLeft: '20px', fontWeight: 600, color: 'var(--ink)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {player.photo_url ? (
                        <img
                          src={player.photo_url}
                          alt={player.name}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            background: 'var(--bg-2)',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            width: '28px',
                            height: '28px',
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
                          {player.name.substring(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span>{player.name}</span>
                    </div>
                  </td>
                  <td style={{ color: accentColor, fontSize: '12px', fontWeight: 600 }}>
                    {player.position_code || player.position_name || '-'}
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: '11px' }}>
                    {player.nationality || '-'}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--ink)' }}>
                    {player.appearances} <span style={{ color: 'var(--ink-3)', fontSize: '11px' }}>({player.starts})</span>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--ink-2)' }}>
                    {player.minutes}'
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: player.goals > 0 ? 700 : 400,
                      color: player.goals > 0 ? 'var(--ink)' : 'var(--ink-3)',
                    }}
                  >
                    {player.goals}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: player.assists > 0 ? 700 : 400,
                      color: player.assists > 0 ? 'var(--ink)' : 'var(--ink-3)',
                    }}
                  >
                    {player.assists}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--ink-2)' }}>
                    {player.xg.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '20px', color: 'var(--ink-2)' }}>
                    {player.xa.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
