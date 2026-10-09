import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearch } from '../lib/queries';
import { Skeleton } from '../ui/Skeleton';
import { usePageTitle } from '../lib/usePageTitle';

export function Index() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: searchData, isLoading: searching } = useSearch(searchTerm.trim(), 10);
  const searchResults = searchData?.results || [];

  usePageTitle(searchTerm ? `Busca: "${searchTerm}"` : 'Acervo & Índice');

  return (
    <div className="index-container">
      {/* Editorial Header */}
      <div style={{ gridColumn: '1 / -1', textAlign: 'center', margin: '24px 0 28px 0' }}>
        <div className="label" style={{ color: 'var(--accent)', marginBottom: '8px' }}>
          PLATAFORMA ANALÍTICA & ACERVO TÁTICO
        </div>
        <h1 className="title" style={{ fontSize: 'clamp(36px, 6vw, 64px)', margin: '0 0 16px 0', fontFamily: 'var(--serif)' }}>
          Índice & Acervo da Premier League
        </h1>
        <p className="caption" style={{ maxWidth: '640px', margin: '0 auto', color: 'var(--ink-2)' }}>
          Navegue pelas 380 partidas da temporada, consulte 696 atletas com mapas de finalizações, explore a evolução da tabela e consulte históricos de confrontos.
        </p>
      </div>

      {/* Caixa de Busca Fuzzy com pg_trgm */}
      <div style={{ gridColumn: '1 / -1', maxWidth: '720px', margin: '0 auto 36px auto', width: '100%' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por clube (ex: Arsenal, City), jogador (ex: Haaland, Salah) ou rodada..."
            style={{
              width: '100%',
              padding: '16px 20px',
              backgroundColor: 'var(--bg-1)',
              border: '1px solid var(--rule)',
              borderRadius: '2px',
              color: 'var(--ink)',
              fontFamily: 'var(--mono)',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--ink-3)',
                cursor: 'pointer',
                fontFamily: 'var(--mono)',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Resultados da Busca em Tempo Real */}
        {searchTerm && (
          <div style={{
            marginTop: '12px',
            background: 'var(--bg-1)',
            border: '1px solid var(--rule)',
            borderRadius: '2px',
            padding: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="label">
                {searching ? 'Buscando...' : `${searchResults.length} RESULTADO(S) NO BANCO POSTGRESQL`}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)' }}>
                Índice Trigramas (pg_trgm)
              </span>
            </div>

            {searching ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} role="status" aria-busy="true">
                <Skeleton variant="rect" count={3} />
              </div>
            ) : searchResults.length === 0 ? (
              <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-3)', textAlign: 'center', padding: '16px 0' }}>
                Nenhum resultado encontrado para "{searchTerm}".
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {searchResults.map((item, idx) => {
                  const targetLink = item.type === 'player' ? `/player/${item.id}` : `/team/${item.id}`;
                  return (
                    <Link
                      key={idx}
                      to={targetLink}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: 'var(--bg-2)',
                        border: '1px solid var(--rule)',
                        borderRadius: '2px',
                        textDecoration: 'none',
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: '15px', color: 'var(--ink)' }}>
                          {item.name}
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-2)' }}>
                          {item.subtitle || (item.type === 'player' ? 'Atleta Premier League' : 'Clube')}
                        </div>
                      </div>
                      <span className="editorial-badge">
                        {item.type === 'player' ? 'JOGADOR' : 'TIME'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cards de Navegação Editorial */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <Link to="/" style={{ textDecoration: 'none' }} className="editorial-card">
          <span className="editorial-badge" style={{ marginBottom: '12px' }}>380 PARTIDAS OFICIAIS</span>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: '24px', margin: '8px 0', color: 'var(--ink)' }}>
            Prancha Tática das Partidas
          </h2>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Selecione qualquer rodada de 1 a 38 e explore o mapa topográfico de chutes, isolinhas de densidade de xG e scrubber sincronizado.
          </p>
          <div style={{ color: 'var(--accent)', fontSize: '11px', fontFamily: 'var(--mono)', marginTop: '16px' }}>
            Abrir prancha tática →
          </div>
        </Link>

        <Link to="/player/338" style={{ textDecoration: 'none' }} className="editorial-card">
          <span className="editorial-badge" style={{ marginBottom: '12px' }}>696 ATLETAS CADASTRADOS</span>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: '24px', margin: '8px 0', color: 'var(--ink)' }}>
            Perfis de Atletas & Chutes
          </h2>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Consulte métricas da camada Gold (gols vs xG, assistências vs xA) e o mapa de chutes individual de cada jogador na temporada.
          </p>
          <div style={{ color: 'var(--accent)', fontSize: '11px', fontFamily: 'var(--mono)', marginTop: '16px' }}>
            Explorar atletas →
          </div>
        </Link>

        <Link to="/league" style={{ textDecoration: 'none' }} className="editorial-card">
          <span className="editorial-badge" style={{ marginBottom: '12px' }}>EVOLUÇÃO RODADA A RODADA</span>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: '24px', margin: '8px 0', color: 'var(--ink)' }}>
            Tabela Dinâmica da Liga
          </h2>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Arraste o controle de rodada (1 a 38) para conferir como a classificação se formou ao longo da Premier League 2024/25.
          </p>
          <div style={{ color: 'var(--accent)', fontSize: '11px', fontFamily: 'var(--mono)', marginTop: '16px' }}>
            Ver classificação com slider →
          </div>
        </Link>

        <Link to="/h2h" style={{ textDecoration: 'none' }} className="editorial-card">
          <span className="editorial-badge" style={{ marginBottom: '12px' }}>20 CLUBES DISPONÍVEIS</span>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: '24px', margin: '8px 0', color: 'var(--ink)' }}>
            Raio-X de Confrontos (H2H)
          </h2>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Selecione quaisquer 2 clubes da Premier League para analisar o retrospecto histórico, vitórias, empates e placares anteriores.
          </p>
          <div style={{ color: 'var(--accent)', fontSize: '11px', fontFamily: 'var(--mono)', marginTop: '16px' }}>
            Comparar equipes →
          </div>
        </Link>
      </div>
    </div>
  );
}