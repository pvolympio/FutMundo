/** Store de relógio para animações de tempo */
import { useState, useEffect } from 'react';

export function useClock(startTime = 0, playing = false, speed = 1) {
  const [time, setTime] = useState(startTime);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);

  useEffect(() => {
    if (!playing) {
      setLastTimestamp(null);
      return;
    }

    const tick = (timestamp: number) => {
      if (lastTimestamp === null) {
        setLastTimestamp(timestamp);
        requestAnimationFrame(tick);
        return;
      }

      const elapsed = (timestamp - lastTimestamp) / 1000;
      setTime(prev => prev + elapsed * speed);
      setLastTimestamp(timestamp);
      requestAnimationFrame(tick);
    };

    const frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, lastTimestamp, speed]);

  return time;
}