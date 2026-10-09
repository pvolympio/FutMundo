import { useEffect } from 'react';

/**
 * Hook utilitário para atualizar o título da página e manter padrão editorial
 */
export function usePageTitle(title?: string) {
  useEffect(() => {
    const base = 'CARTA / TÁTICA • Premier League 2024/25';
    if (!title || !title.trim()) {
      document.title = base;
    } else {
      document.title = `${title} | ${base}`;
    }
  }, [title]);
}

export default usePageTitle;
