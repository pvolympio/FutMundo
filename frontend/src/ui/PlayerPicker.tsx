import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useSearch } from '../lib/queries';

export interface PlayerPickerProps {
  label: string;
  color: string;
  selectedName: string;
  onSelect: (id: number) => void;
  placeholder?: string;
}

export function PlayerPicker({
  label,
  color,
  selectedName,
  onSelect,
  placeholder = 'Buscar qualquer atleta para comparar...',
}: PlayerPickerProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: searchData, isLoading } = useSearch(query.trim(), 8);
  const players = (searchData?.results || []).filter((r) => r.type === 'player');

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset do índice destacado quando a lista de atletas mudar
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [players.length]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < players.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : players.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < players.length) {
        const selected = players[highlightedIndex];
        onSelect(selected.id);
        setQuery('');
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const isListboxVisible = isOpen && query.trim().length >= 2;

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span className="label" style={{ color }}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink)' }}>{selectedName}</span>
      </div>

      <div
        role="combobox"
        aria-expanded={isListboxVisible}
        aria-haspopup="listbox"
        aria-controls={`player-picker-listbox-${label.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0 && players[highlightedIndex]
              ? `player-opt-${players[highlightedIndex].id}`
              : undefined
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'var(--bg-2)',
            border: '1px solid var(--rule)',
            borderRadius: '2px',
            color: 'var(--ink)',
            fontFamily: 'var(--mono)',
            fontSize: '12px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {isListboxVisible && (
        <div
          id={`player-picker-listbox-${label.replace(/\s+/g, '-').toLowerCase()}`}
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--bg-2)',
            border: '1px solid var(--rule)',
            borderRadius: '2px',
            zIndex: 50,
            marginTop: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {isLoading ? (
            <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
              Buscando atletas...
            </div>
          ) : players.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
              Nenhum atleta encontrado.
            </div>
          ) : (
            players.map((p, idx) => {
              const isHighlighted = idx === highlightedIndex;
              return (
                <div
                  id={`player-opt-${p.id}`}
                  key={p.id}
                  role="option"
                  aria-selected={isHighlighted}
                  onClick={() => {
                    onSelect(p.id);
                    setQuery('');
                    setIsOpen(false);
                    setHighlightedIndex(-1);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    background: isHighlighted ? 'var(--bg-1)' : 'transparent',
                    borderBottom: '1px solid var(--rule-soft)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '12px' }}>{p.name}</span>
                  {p.subtitle && <span style={{ color: 'var(--ink-3)', fontSize: '11px' }}>({p.subtitle})</span>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
