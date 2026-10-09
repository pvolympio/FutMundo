import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchEntities, SearchResult } from '../lib/api';
import { Crest } from './Crest';

export function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Foco automático ao abrir
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Busca com debounce
  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      searchEntities(query.trim(), 8)
        .then((res) => {
          setResults(res.results || []);
          setSelectedIndex(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 180);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Navegação por teclado
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter') {
        if (results[selectedIndex]) {
          e.preventDefault();
          handleSelect(results[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const handleSelect = (item: SearchResult) => {
    onClose();
    if (item.type === 'player') {
      navigate(`/player/${item.id}`);
    } else if (item.type === 'team') {
      navigate(`/team/${item.id}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-1, #0B191E)',
          border: '1px solid var(--rule, #243E36)',
          borderRadius: '4px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.85)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Entrada de Busca */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--rule, #243E36)',
          }}
        >
          <span style={{ fontSize: '18px', color: 'var(--accent, #E5A93C)' }}>⌕</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar clube, jogador ou métrica... (Ex: Haaland, Arsenal, Salah)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--mono, monospace)',
              fontSize: '14px',
              color: 'var(--ink, #F3EFE6)',
            }}
          />
          <kbd
            style={{
              padding: '2px 6px',
              fontSize: '10px',
              fontFamily: 'var(--mono, monospace)',
              background: 'var(--bg-2, #07161A)',
              border: '1px solid var(--rule, #243E36)',
              borderRadius: '2px',
              color: 'var(--ink-3, #708090)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Lista de Resultados */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
          {loading && (
            <div style={{ padding: '16px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-3)' }}>
              Consultando banco de dados...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-3)' }}>
              Nenhum resultado encontrado para "{query}".
            </div>
          )}

          {!loading && !query && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span className="label" style={{ fontSize: '10px' }}>ATALHOS RÁPIDOS</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Haaland', 'Salah', 'Arsenal', 'Man City', 'Liverpool', 'Palmer'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="header-btn"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const isClub = item.type === 'team';

            return (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--accent-wash, rgba(229, 169, 60, 0.12))' : 'transparent',
                  border: isSelected ? '1px solid var(--accent, #E5A93C)' : '1px solid transparent',
                  transition: 'all 0.1s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isClub ? (
                    <Crest name={item.name} alt={item.name} size={24} />
                  ) : (
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'var(--bg-2)',
                        border: '1px solid var(--rule)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--mono)',
                        fontSize: '10px',
                        color: 'var(--accent)',
                        fontWeight: 700,
                      }}
                    >
                      ⚽
                    </div>
                  )}

                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '15px', color: isSelected ? 'var(--accent)' : 'var(--ink)' }}>
                      {item.name}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)' }}>
                      {item.subtitle || (isClub ? 'Clube • Premier League' : 'Atleta')}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    color: isSelected ? 'var(--accent)' : 'var(--ink-3)',
                    border: '1px solid var(--rule)',
                    padding: '2px 6px',
                    borderRadius: '2px',
                  }}
                >
                  {isClub ? 'Clube' : 'Atleta'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Rodapé de Instrução */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 16px',
            borderTop: '1px solid var(--rule)',
            background: 'var(--bg-2, #07161A)',
            fontFamily: 'var(--mono)',
            fontSize: '10px',
            color: 'var(--ink-3)',
          }}
        >
          <div>
            Navegar: <kbd>↑</kbd> <kbd>↓</kbd> • Abrir: <kbd>↵ Enter</kbd>
          </div>
          <div>Busca Global FUTFUT</div>
        </div>
      </div>
    </div>
  );
}
