'use client';

import { useEffect, useState } from 'react';
import type { FarmObjective } from '@/lib/domain/farm-objective';
import type { TodayWeekBed } from '@/lib/domain/today/week';
import type { WaterDashboardDay } from '@/lib/domain/water-management';
import type { WaterDashboard } from '@/lib/services/water-dashboard';

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

/** Ce que le premier niveau lit du tableau de l'eau de la semaine ; « Comprendre ces chiffres » en lit les totaux et les objectifs (PR 3). */
export type WeekWater = Pick<WaterDashboard, 'weekStart' | 'weekEnd' | 'totals' | 'goals'> & {
  days: WaterDashboardDay[];
  todayWater: WaterDashboardDay;
};

/** Ce que le premier niveau lit du tableau des besoins de la semaine. */
export type WeekNeeds = {
  weekStart: string;
  weekEnd: string;
  gardens: readonly { beds: readonly TodayWeekBed[] }[];
  /** L'eau visée de la ferme, celle d'« Aujourd'hui » (S1, PR 3). */
  farmObjective: FarmObjective;
};

export function notifyWeekWaterRead(water: WeekWater) {
  window.dispatchEvent(new CustomEvent<WeekWater>(WEEK_WATER_READ, { detail: water }));
}

/**
 * Une pluie notée par « Noter la pluie » de la page (S4, PR 3, section 8.3) :
 * le tableau de l'eau se relit, puis les besoins, le plan et la ligne
 * « Calcul approximatif » (leur signal, sans semaine : chacun relit la
 * sienne, jamais celle du jour noté).
 */
export const WEEK_RAIN_NOTED = 'irrigation-week-rain-noted';

export function notifyRainNoted() {
  window.dispatchEvent(new CustomEvent(WEEK_RAIN_NOTED));
  window.dispatchEvent(new CustomEvent('irrigation-needs-source-changed'));
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
