'use client';

import { useEffect } from 'react';
import type { FeatureId } from '@/lib/domain/features/catalogue';
import { legacyRedirect, pageHref } from '@/lib/domain/features/pages';

/**
 * `/irrigation` seule (3.8, docs/feature-selection-contract.md, section 5,
 * P10 et P14) : conduit à la page d'arrivée (« Aujourd'hui » quand elle
 * existe, audit ergonomique, lot 2, F1), ou, pour une ancienne
 * adresse de notification, à la page qui porte le bloc que désigne son ancre.
 * L'ancre ne parvient jamais au serveur : la conduite se fait ici.
 */
export function LegacyRedirect({
  enabled,
  season,
  week,
  refresh,
}: {
  enabled: readonly FeatureId[];
  season: number | null;
  week: string | null;
  refresh: boolean;
}) {
  useEffect(() => {
    const target = legacyRedirect(window.location.hash, enabled);
    window.location.replace(pageHref(target.page, { season, week, refresh, absent: target.notEnabled }, window.location.hash || undefined));
  }, [enabled, season, week, refresh]);

  return (
    <main className="app-shell">
      <p className="legacy-redirect" role="status">Ouverture du module d’irrigation…</p>
    </main>
  );
}
