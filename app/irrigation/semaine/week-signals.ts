'use client';

import { useEffect, useState } from 'react';
import type { TodayWeekBed } from '@/lib/domain/today/week';
import type { WaterDashboardDay } from '@/lib/domain/water-management';

/**
 * Les tableaux de la semaine relus par leurs sections (simplification, lot
 * S4, PR 2) : le tableau de l'eau et celui des besoins par planche se
 * relisent après chaque geste dans « Le détail » (une pluie, un objectif, un
 * seuil, une irrigation) ; le premier niveau de la page « Semaine » reprend
 * ce qu'ils ont lu, tel quel, sans relire lui-même. Le signal porte la
 * semaine : une réponse d'une autre semaine ne s'affiche pas.
 */

export const WEEK_WATER_READ = 'irrigation-week-water-read';
export const WEEK_NEEDS_READ = 'irrigation-week-needs-read';

/** Ce que le premier niveau lit du tableau de l'eau de la semaine. */
export type WeekWater = {
  weekStart: string;
  days: WaterDashboardDay[];
  totals: { realizedIrrigationCubicMeters: number };
  todayWater: WaterDashboardDay;
};

/** Ce que le premier niveau lit du tableau des besoins de la semaine. */
export type WeekNeeds = {
  weekStart: string;
  weekEnd: string;
  gardens: readonly { beds: readonly TodayWeekBed[] }[];
};

export function notifyWeekWaterRead(water: WeekWater) {
  window.dispatchEvent(new CustomEvent<WeekWater>(WEEK_WATER_READ, { detail: water }));
}

export function notifyWeekNeedsRead(needs: WeekNeeds) {
  window.dispatchEvent(new CustomEvent<WeekNeeds>(WEEK_NEEDS_READ, { detail: needs }));
}

/** Le dernier tableau lu pour la semaine affichée, d'abord celui de la page. */
export function useWeekReading<T extends { weekStart: string }>(signal: string, initial: T): T {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const read = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as T | null;
      if (detail && detail.weekStart === initial.weekStart) setValue(detail);
    };
    window.addEventListener(signal, read);
    return () => window.removeEventListener(signal, read);
  }, [signal, initial.weekStart]);
  return value;
}
