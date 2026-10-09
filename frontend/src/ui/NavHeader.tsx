import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../store/theme';
import { useFocus } from '../store/focus';
import { CommandPalette } from './CommandPalette';

export function NavHeader() {
  const { theme, toggleTheme } = useTheme();
  const { focus, toggleFocus } = useFocus();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Atalho global Ctrl+K / Cmd+K para abrir a paleta de comandos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="header-left">
          <NavLink to="/" className="brand-title">
            <span className="brand-main">FUTMUNDO</span>
            <span className="brand-sub">PREMIER LEAGUE • ANALYTICS</span>
          </NavLink>

          <nav className="nav-menu">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              Partida
            </NavLink>
            <NavLink
              to="/player"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              Jogador
            </NavLink>
            <NavLink
              to="/team"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              Clubes
            </NavLink>
            <NavLink
              to="/league"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              Classificação
            </NavLink>
            <NavLink
              to="/h2h"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              H2H
            </NavLink>
          </nav>
        </div>

        <div className="header-right">
          {/* Botão de Busca Rápida com Atalho Ctrl+K */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="header-btn"
            title="Buscar clube, atleta ou métrica (Atalho: Ctrl+K)"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span style={{ fontSize: '13px', color: 'var(--accent)' }}>⌕</span>
            <span className="btn-label">BUSCA</span>
            <kbd className="kbd"><kbd className="kbd-key">^K</kbd></kbd>
          </button>

          <button
            type="button"
            onClick={toggleFocus}
            className="header-btn"
            title="Alternar foco entre mandante e visitante (Atalho: F)"
          >
            <span className="btn-label">FOCO:</span>
            <span className="btn-val">{focus === 'home' ? 'CASA' : 'FORA'}</span>
            <kbd className="kbd"><kbd className="kbd-key">F</kbd></kbd>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="header-btn"
            title="Alternar entre modo escuro e papel editorial (Atalho: T)"
          >
            <span className="btn-label">TEMA:</span>
            <span className="btn-val">{theme === 'paper' ? 'PAPEL' : 'DARK'}</span>
            <kbd className="kbd"><kbd className="kbd-key">T</kbd></kbd>
          </button>
        </div>
      </header>

      {/* Modal da Paleta de Comandos Global */}
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
