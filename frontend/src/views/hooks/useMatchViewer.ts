import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMatchesByRound, useMatchDetails, useLatestMatch } from '../../lib/queries';
import type { MatchSummary, MatchEvent } from '../../lib/api';
import type { Shot } from '../../charts/ShotMarkers';
import { getClubTheme } from '../../lib/clubColors';

export type MatchTab = 'pitch' | 'lineups' | 'xgrace' | 'tempo';
export type ShotFilter = 'all' | 'goal' | 'on_target' | 'saved' | 'blocked' | 'open_play' | 'set_piece';

export function useMatchViewer() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const pendingDeepLink = useRef<boolean>(!!id);

  // Consulta dados mais recentes da liga para inicialização dinâmica (sem fixar rodada 5 ou partida 50)
  const { data: latestInfo } = useLatestMatch();

  const [selectedRound, setSelectedRound] = useState<number>(() => {
    return latestInfo?.round || 5;
  });

  const [selectedMatchId, setSelectedMatchId] = useState<number>(() => {
    if (id) {
      const parsed = parseInt(id, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return latestInfo?.match_id || 50;
  });

  // Atualiza para a última partida dinâmica quando ela carregar e não houver ID na URL
  useEffect(() => {
    if (!id && latestInfo?.match_id && selectedMatchId === 50 && selectedRound === 5) {
      setSelectedRound(latestInfo.round);
      setSelectedMatchId(latestInfo.match_id);
    }
  }, [id, latestInfo]);

  // Sincroniza se o parâmetro :id da rota mudar
  useEffect(() => {
    if (id) {
      const parsed = parseInt(id, 10);
      if (!isNaN(parsed) && parsed !== selectedMatchId) {
        pendingDeepLink.current = true;
        setSelectedMatchId(parsed);
      }
    }
  }, [id, selectedMatchId]);

  const { data: roundMatchesRaw } = useMatchesByRound(selectedRound);
  const roundMatches = useMemo<MatchSummary[]>(() => {
    if (Array.isArray(roundMatchesRaw)) return roundMatchesRaw;
    return [];
  }, [roundMatchesRaw]);

  const { data: matchData, isLoading: loadingMatch } = useMatchDetails(selectedMatchId);
  const loading = loadingMatch || !matchData;

  // Quando os dados da partida chegarem de um deep-link, sincroniza a rodada selecionada
  useEffect(() => {
    if (matchData && matchData.match_id === selectedMatchId) {
      if (matchData.matchday && matchData.matchday !== selectedRound) {
        setSelectedRound(matchData.matchday);
      }
      pendingDeepLink.current = false;
    }
  }, [matchData, selectedMatchId, selectedRound]);

  // Se o usuário trocar a rodada e a partida atual não pertencer a ela, seleciona a primeira da nova rodada
  useEffect(() => {
    if (roundMatches.length > 0 && !pendingDeepLink.current) {
      const isCurrentInRound = roundMatches.some((m) => m.match_id === selectedMatchId);
      if (!isCurrentInRound) {
        const nextId = roundMatches[0].match_id;
        setSelectedMatchId(nextId);
        navigate(`/match/${nextId}`, { replace: true });
      }
    }
  }, [roundMatches, selectedMatchId, navigate]);

  // Ticker temporal / Scrubber
  const [currentTime, setCurrentTime] = useState<number>(90);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<MatchTab>('pitch');
  const [shotFilter, setShotFilter] = useState<ShotFilter>('all');
  const [activeViewMode, setActiveViewMode] = useState<'markers' | 'contours' | 'both'>('both');

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= 95) {
            setIsPlaying(false);
            return 95;
          }
          return prev + 1;
        });
      }, 300);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  // Transformar eventos de timeline em objetos Shot tipados
  const allShots = useMemo<Shot[]>(() => {
    if (!matchData?.timeline) return [];

    return (matchData.timeline as MatchEvent[])
      .filter((ev) => ev.event_type === 'shot' && ev.x != null && ev.y != null)
      .map((ev) => {
        const isHomeShot = ev.team_id === matchData.home_team.id;
        const resultRaw = (ev.shot_result || 'miss').toLowerCase();

        let xgVal = ev.xg;
        if (xgVal == null) {
          const distFromGoal = Math.sqrt(Math.pow(100 - (ev.x || 80), 2) + Math.pow(50 - (ev.y || 50), 2));
          xgVal = resultRaw === 'goal' ? 0.38 : Math.max(0.04, Math.min(0.45, 1 / (distFromGoal * 0.15 + 1.5)));
        }

        const result: Shot['result'] =
          resultRaw === 'goal' ? 'goal' :
          resultRaw === 'saved' ? 'saved' :
          resultRaw === 'blocked' ? 'blocked' : 'off_target';

        const bodyPart: Shot['bodyPart'] =
          ev.body_part === 'head' ? 'head' :
          ev.body_part === 'left_foot' ? 'left_foot' : 'right_foot';

        return {
          id: ev.event_id,
          x: ev.x || 80,
          y: ev.y || 50,
          xG: Number(Number(xgVal).toFixed(3)),
          result,
          situation: ev.situation || (ev.is_penalty ? 'penalty' : 'open_play'),
          bodyPart,
          minute: ev.minute,
          player: ev.player?.name || (isHomeShot ? matchData.home_team.short_name : matchData.away_team.short_name),
          assist: ev.assist_player?.name,
          home: isHomeShot,
        };
      });
  }, [matchData]);

  // Filtrar chutes pelo scrubber temporal e filtros analíticos
  const visibleShots = useMemo(() => {
    return allShots.filter((s) => {
      if (s.minute > currentTime) return false;
      if (shotFilter === 'goal') return s.result === 'goal';
      if (shotFilter === 'on_target') return s.result === 'goal' || s.result === 'saved';
      if (shotFilter === 'saved') return s.result === 'saved';
      if (shotFilter === 'blocked') return s.result === 'blocked';
      if (shotFilter === 'open_play') return s.situation === 'open_play';
      if (shotFilter === 'set_piece') return s.situation === 'set_piece' || s.situation === 'corner';
      return true;
    });
  }, [allShots, currentTime, shotFilter]);

  const shotsA = useMemo(() => visibleShots.filter((s) => s.home), [visibleShots]);
  const shotsB = useMemo(() => visibleShots.filter((s) => !s.home), [visibleShots]);

  const xgA = useMemo(() => shotsA.reduce((sum, s) => sum + s.xG, 0), [shotsA]);
  const xgB = useMemo(() => shotsB.reduce((sum, s) => sum + s.xG, 0), [shotsB]);

  const themeHome = getClubTheme(matchData?.home_team?.short_name || '');
  const themeAway = getClubTheme(matchData?.away_team?.short_name || '');

  const handleSelectMatch = (mId: number) => {
    setSelectedMatchId(mId);
    navigate(`/match/${mId}`);
  };

  return {
    selectedRound,
    setSelectedRound,
    selectedMatchId,
    handleSelectMatch,
    roundMatches,
    matchData,
    loading,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    activeTab,
    setActiveTab,
    shotFilter,
    setShotFilter,
    activeViewMode,
    setActiveViewMode,
    allShots,
    visibleShots,
    shotsA,
    shotsB,
    xgA,
    xgB,
    themeHome,
    themeAway,
  };
}
