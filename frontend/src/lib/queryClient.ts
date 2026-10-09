/**
 * Query Client para TanStack Query
 * Gerenciamento de cache, stale time e retry para queries do frontend
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache por 5 minutos - dados de futebol mudam com frequência
      staleTime: 5 * 60 * 1000,
      // Mantém cache por 10 minutos após desvanecimento
      gcTime: 10 * 60 * 1000,
      // Retry automático em falhas
      retry: 2,
      // Não refetche ao focar a janela (melhor UX para dados de jogos)
      refetchOnWindowFocus: false,
      // Refetch quando a página é visível novamente
      refetchOnReconnect: true,
      // Timeout de requisição
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

export default queryClient;