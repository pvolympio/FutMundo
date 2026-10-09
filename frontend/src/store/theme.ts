import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'paper';

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('carta_tatica_theme') as Theme;
  return saved === 'paper' ? 'paper' : 'dark';
}

export function applyTheme(theme: Theme) {
  if (theme === 'paper') {
    document.documentElement.setAttribute('data-theme', 'paper');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('carta_tatica_theme', theme);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'paper' : 'dark'));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't toggle when typing in input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 't' || e.key === 'T') {
        toggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { theme, toggleTheme, isPaper: theme === 'paper' };
}
