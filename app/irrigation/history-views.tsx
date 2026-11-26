'use client';

import { useEffect, useState } from 'react';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import { SERIES_WATER_ANCHOR } from '@/lib/domain/features/week-page';
import type { IrrigationHistoryDashboard } from '@/lib/services/irrigation-history-service';
import { IrrigationHistoryDashboardView } from './irrigation-history-dashboard';
import { SeriesWaterView } from './series-water-view';

type HistoryView = 'scope' | 'series';

const viewLabels: Record<HistoryView, { label: string; hint: string }> = {
  scope: { label: 'Par lieu', hint: 'Ferme, parcelle, jardin ou planche, sur une période' },
  series: { label: 'Par série', hint: 'Chaque culture, de son implantation à sa dernière récolte' },
};

/**
 * Les deux lectures des cumuls (docs/series-contract.md, « Interface ») : par
 * périmètre et période, comme depuis la tranche 2, ou par série culturale.
 * Le commutateur vit ici pour que chaque vue garde son propre état.
 */
export function HistoryViews({
  season,
  snapshot,
  initialDashboard,
  cropWater,
  rainHref,
}: {
  season: number;
  snapshot: IrrigationSnapshot;
  initialDashboard: IrrigationHistoryDashboard;
  /** La fiche de la série montre le besoin de la culture si « Besoin par culture » est cochée (3.8, R1). */
  cropWater: boolean;
  /** Où saisir la pluie mesurée : la page « Objectifs et besoins », si elle est cochée. */
  rainHref: string | null;
}) {
  const [view, setView] = useState<HistoryView>('scope');
  // L'ancre du suivi par série ouvre sa lecture, au chargement comme à un lien suivi dans la page (lot S4, section 7.4) :
  // les anciennes notifications d'arrêt avant la récolte la visent (P14).
  useEffect(() => {
    const openTargetedView = () => {
      if (decodeURIComponent(window.location.hash.slice(1)) === SERIES_WATER_ANCHOR) setView('series');
    };
    openTargetedView();
    window.addEventListener('hashchange', openTargetedView);
    return () => window.removeEventListener('hashchange', openTargetedView);
  }, []);
  const tabs = (
    <div className="history-view-tabs" role="tablist" aria-label="Vue des cumuls">
      {(Object.keys(viewLabels) as HistoryView[]).map((candidate) => (
        <button
          key={candidate}
          type="button"
          role="tab"
          aria-selected={view === candidate}
          data-active={view === candidate}
          onClick={() => setView(candidate)}
        >
          <strong>{viewLabels[candidate].label}</strong>
          <small>{viewLabels[candidate].hint}</small>
        </button>
      ))}
    </div>
  );

  return view === 'scope'
    ? <IrrigationHistoryDashboardView season={season} snapshot={snapshot} initialDashboard={initialDashboard} viewTabs={tabs} rainHref={rainHref} />
    : <SeriesWaterView season={season} viewTabs={tabs} cropWater={cropWater} />;
}
