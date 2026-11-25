'use client';

import { useSyncExternalStore } from 'react';
import { millisecondsFromSeconds } from '@/lib/domain/units';

/** Le compte à rebours se lit à la minute : un pas de quinze secondes suffit, sans faire tourner la page à la seconde. */
const STEP_MS = millisecondsFromSeconds(15);

function subscribe(onChange: () => void): () => void {
  const interval = window.setInterval(onChange, STEP_MS);
  // Un téléphone verrouillé suspend les minuteries : l'heure se remet à jour au retour.
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  };
}

/** Stable sur un pas : React ne redessine que quand le pas change. */
function snapshot(): number {
  return Math.floor(Date.now() / STEP_MS) * STEP_MS;
}

function serverSnapshot(): null {
  return null;
}

/**
 * L'heure du navigateur pour le compte à rebours d'une carte d'« Aujourd'hui »
 * (simplification, lot S2, section 6). `null` au rendu du serveur et à
 * l'hydratation : la carte ne dit son « Reste » qu'une fois dans le
 * navigateur, sans écart entre les deux rendus.
 */
export function useCardClock(): Date | null {
  const now = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return now === null ? null : new Date(now);
}
