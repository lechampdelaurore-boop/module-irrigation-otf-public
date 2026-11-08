'use client';
import { useEffect, useState } from 'react';
import { millisecondsFromSeconds } from '@/lib/domain/units';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';

/**
 * L'heure de la ferme, telle que l'écran la voit.
 *
 * Elle avance de seconde en seconde tant qu'une irrigation tourne, et se remet
 * à l'heure dès que la page redevient visible : un téléphone verrouillé
 * suspend les minuteries du navigateur, et le minuteur affiché retarderait
 * sans cela d'autant.
 */
export function useFarmClock(initialNowIso: string, activeEvents: readonly IrrigationEventRecord[]) {
  const [now, setNow] = useState(() => new Date(initialNowIso));

  useEffect(() => {
    if (!activeEvents.some((event) => event.equipment.timerState === 'running')) return;
    const interval = window.setInterval(() => setNow(new Date()), millisecondsFromSeconds(1));
    return () => window.clearInterval(interval);
  }, [activeEvents]);

  useEffect(() => {
    const updateClock = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', updateClock);
    window.addEventListener('focus', updateClock);
    window.addEventListener('pageshow', updateClock);
    return () => {
      document.removeEventListener('visibilitychange', updateClock);
      window.removeEventListener('focus', updateClock);
      window.removeEventListener('pageshow', updateClock);
    };
  }, []);

  return now;
}
