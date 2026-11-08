'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { isLimitedAlertStatus, isSystemAlertsBannerFolded, systemAlertsMemoryAfter } from '@/lib/domain/system-alerts-banner';

/**
 * Le souvenir, sur cet appareil, du bandeau « Alertes système non
 * disponibles » déjà montré (audit ergonomique, point 2, précision F10) : le
 * stockage du navigateur, jamais la base. Un stockage illisible (navigation
 * privée, réglages du navigateur) ne lève rien : le bandeau reste déplié et
 * la cloche sans point.
 */
const STORAGE_KEY = 'irrigation.alertes-systeme-vues';
const listeners = new Set<() => void>();

function readSeenStatus(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberStatus(status: string): void {
  const next = systemAlertsMemoryAfter(status);
  if (next === undefined) return;
  try {
    if (next === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Un autre onglet qui active les alertes efface le point de celui-ci.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** La cloche porte un point quand cet appareil a déjà montré un état limité. */
export function useSystemAlertsDot(): boolean {
  const seen = useSyncExternalStore(subscribe, readSeenStatus, () => null);
  return isLimitedAlertStatus(seen);
}

/**
 * Le bandeau de cet état est-il replié ? Le souvenir est lu une fois, à
 * l'ouverture de la page : le bandeau montré n'y disparaît pas sous les yeux,
 * il se replie à la page suivante. L'état connu est retenu pour la suite.
 */
export function useFoldedSystemAlerts(status: string, foldable: boolean): boolean {
  const [seenAtOpening] = useState(() => (typeof window === 'undefined' ? null : readSeenStatus()));
  useEffect(() => {
    rememberStatus(status);
  }, [status]);
  return foldable && isSystemAlertsBannerFolded(status, seenAtOpening);
}
