'use client';

import { useEffect, useState } from 'react';
import type { IrrigationPageId } from '@/lib/domain/features/pages';
import { readTodayBadgeAction } from '../today-actions';

/**
 * La pastille de « Aujourd'hui » au menu et dans la barre du bas (audit
 * ergonomique, point 3, 3.8 quater lot 2, précision F12) : le nombre de
 * lignes de « Fiabilité du calcul » et d'irrigations en retard ; zéro, pas de
 * pastille. La page « Aujourd'hui » la donne avec son modèle ; les autres
 * pages la demandent après leur affichage, pour ne pas l'attendre. Un geste
 * sur « Aujourd'hui » qui la change la diffuse par un événement.
 */
const TODAY_BADGE_CHANGED = 'today-badge-changed';

export function announceTodayBadge(badge: number | null): void {
  window.dispatchEvent(new CustomEvent<number | null>(TODAY_BADGE_CHANGED, { detail: badge }));
}

/** `initial` : le nombre déjà connu ; absent, il est lu après l'affichage. */
export function useTodayBadge(menu: readonly IrrigationPageId[], initial: number | null | undefined): number | null {
  const wanted = menu.includes('aujourdhui');
  const [badge, setBadge] = useState<number | null>(initial ?? null);

  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    if (initial === undefined) {
      readTodayBadgeAction().then((value) => {
        if (alive) setBadge(value);
      }, () => undefined);
    }
    const receive = (event: Event) => setBadge((event as CustomEvent<number | null>).detail ?? null);
    window.addEventListener(TODAY_BADGE_CHANGED, receive);
    return () => {
      alive = false;
      window.removeEventListener(TODAY_BADGE_CHANGED, receive);
    };
  }, [wanted, initial]);

  return wanted && badge !== null && badge > 0 ? badge : null;
}

/** Le nom du lien qui porte la pastille, pour un lecteur d'écran : « Aujourd'hui, 3 à regarder ». */
export function todayBadgeLabel(label: string, count: number | null): string {
  return count === null ? label : `${label}, ${count} à regarder`;
}

/** Le nombre affiché ; le nom du lien le dit déjà en mots. Rien sans nombre. */
export function TodayBadge({ count }: { count: number | null }) {
  if (count === null) return null;
  return <span className="today-badge" aria-hidden="true" data-today-badge={count}>{count}</span>;
}
