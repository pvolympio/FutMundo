/**
 * Hooks de query personalizados para TanStack Query
 * Centraliza toda a lógica de fetching e cache
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMatchesByRound,
  getMatchDetails,
  getLatestMatch,
  getTeams,
  getTeamProfile,
  getTeamSeason,
  getTeamH2H,
  getStandings,
  getPlayerProfile,
  getPlayerShots,
  getPlayerStats,
  comparePlayers,
  getPlayerRankings,
  searchEntities,
} from './api';

// ============================================================================
// Matches Queries
// ============================================================================

export function useLatestMatch(options?: Record<string, any>) {
  return useQuery({
    queryKey: ['latest-match'],
    queryFn: () => getLatestMatch(),
    staleTime: 60_000,
    ...options,
  });
}

export function useMatchesByRound(
  round: number = 7,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['matches', round],
    queryFn: () => getMatchesByRound(round),
    ...options,
  });
}

export function useMatchDetails(
  matchId: number,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['match', matchId],
    queryFn: () => getMatchDetails(matchId),
    enabled: matchId > 0,
    ...options,
  });
}

// ============================================================================
// Teams Queries
// ============================================================================

export function useTeams(
  search?: string,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['teams', search],
    queryFn: () => getTeams(),
    ...options,
  });
}

export function useTeamProfile(
  teamId: number,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeamProfile(teamId),
    enabled: teamId > 0,
    ...options,
  });
}

export function useTeamSeason(
  teamId: number,
  seasonId?: number,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['team-season', teamId, seasonId],
    queryFn: () => getTeamSeason(teamId, seasonId),
    enabled: teamId > 0,
    ...options,
  });
}

export function useTeamH2H(
  teamA: number,
  teamB: number,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['h2h', teamA, teamB],
    queryFn: () => getTeamH2H(teamA, teamB),
    enabled: teamA > 0 && teamB > 0 && teamA !== teamB,
    ...options,
  });
}

// ============================================================================
// Standings Queries
// ============================================================================

export function useStandings(
  maxRound?: number,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['standings', maxRound],
    queryFn: () => getStandings(maxRound),
    ...options,
  });
}

// ============================================================================
// Players Queries
// ============================================================================

export function usePlayerProfile(
  playerId: number,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['player', playerId],
    queryFn: () => getPlayerProfile(playerId),
    enabled: playerId > 0,
    ...options,
  });
}

export function usePlayerShots(
  playerId: number,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['player', playerId, 'shots'],
    queryFn: () => getPlayerShots(playerId),
    enabled: playerId > 0,
    staleTime: 10 * 60 * 1000, // Shots don't change often
    ...options,
  });
}

export function usePlayerStats(
  playerId: number,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['player', playerId, 'stats'],
    queryFn: () => getPlayerStats(playerId),
    enabled: playerId > 0,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function usePlayerComparison(
  playerA: number,
  playerB: number,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['player-comparison', playerA, playerB],
    queryFn: () => comparePlayers(playerA, playerB),
    enabled: playerA > 0 && playerB > 0 && playerA !== playerB,
    ...options,
  });
}

export function usePlayerRankings(
  metric: string = 'goals',
  limit: number = 20,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['player-rankings', metric, limit],
    queryFn: () => getPlayerRankings(metric, limit),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// Search Queries
// ============================================================================

export function useSearch(
  query: string,
  limit: number = 10,
  options?: Record<string, any>
) {
  return useQuery({
    queryKey: ['search', query, limit],
    queryFn: () => searchEntities(query, limit),
    enabled: query.length >= 2, // Only search after 2+ characters
    staleTime: 1 * 60 * 1000, // Cache searches for 1 minute
    ...options,
  });
}

// ============================================================================
// Mutations (for future use when API supports writes)
// ============================================================================

export function useInvalidateMatch() {
  const queryClient = useQueryClient();
  return (matchId: number) => {
    queryClient.invalidateQueries({ queryKey: ['match', matchId] });
    queryClient.invalidateQueries({ queryKey: ['matches'] });
  };
}

export function useInvalidatePlayer() {
  const queryClient = useQueryClient();
  return (playerId: number) => {
    queryClient.invalidateQueries({ queryKey: ['player', playerId] });
    queryClient.invalidateQueries({
      queryKey: ['player', playerId, 'shots'],
    });
    queryClient.invalidateQueries({
      queryKey: ['player', playerId, 'stats'],
    });
  };
}