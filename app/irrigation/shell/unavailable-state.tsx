'use client';

import { pageHref, type IrrigationPageId } from '@/lib/domain/features/pages';
import { closestAvailableSeason } from '@/lib/domain/irrigation-navigation';
import type { IrrigationUnavailableReason } from '@/lib/domain/snapshot-policy';
import type { DemoSelection } from '@/lib/domain/demo/catalogue';
import { Topbar } from './topbar';

export type UnavailableStateProps = {
  page: IrrigationPageId;
  signOutPath: string;
  userName: string;
  season: number;
  reason: IrrigationUnavailableReason | 'season-unavailable';
  seasonFirst?: number;
  seasonLast?: number;
  /** Un déploiement de démonstration : la bannière permanente (docs/demo-guided-contract.md). */
  demo: boolean;
  demoSelection: DemoSelection | null;
};

/** Ouvre ta ferme n'a pas répondu et rien n'est encore enregistré : aucune page ne peut s'afficher. */
export function UnavailableState({ page, signOutPath, userName, season, reason, seasonFirst, seasonLast, demo, demoSelection }: UnavailableStateProps) {
  const rateLimited = reason === 'rate-limit';
  const seasonUnavailable = reason === 'season-unavailable' && seasonFirst !== undefined && seasonLast !== undefined;
  const fallbackSeason = seasonUnavailable ? closestAvailableSeason(season, seasonFirst, seasonLast) : season;

  return (
    <main className="app-shell">
      <Topbar userName={userName} signOutPath={signOutPath} demo={demo} demoSelection={demoSelection} />
      <section className="fatal-state" role="alert">
        <p className="eyebrow">
          {seasonUnavailable
            ? 'Saison indisponible'
            : rateLimited
              ? 'Actualisation temporairement bloquée'
              : 'Connexion interrompue'}
        </p>
        <h1>
          {seasonUnavailable
            ? `La saison ${season} n’est pas disponible`
            : rateLimited
              ? 'Limite de requêtes OTF atteinte'
              : 'Les données ne sont pas disponibles'}
        </h1>
        <p>
          {seasonUnavailable
            ? `Ouvre ta ferme propose actuellement les saisons ${seasonFirst} à ${seasonLast}. Aucune donnée n’a été modifiée.`
            : rateLimited
              ? 'Ouvre ta ferme refuse temporairement de nouvelles lectures et aucune lecture précédente n’est encore enregistrée. Patientez quelques minutes avant de réessayer.'
              : 'Impossible de charger Ouvre ta ferme et aucune lecture précédente n’est encore enregistrée. Aucune donnée n’a été modifiée.'}
        </p>
        <a className="primary-link" href={pageHref(page, { season: fallbackSeason, refresh: !seasonUnavailable })}>
          {seasonUnavailable ? `Afficher la saison ${fallbackSeason}` : 'Réessayer'}
        </a>
      </section>
    </main>
  );
}
