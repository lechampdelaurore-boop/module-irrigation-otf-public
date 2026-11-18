'use client';

import { pageHref, type IrrigationPageId } from '@/lib/domain/features/pages';
import { closestAvailableSeason } from '@/lib/domain/irrigation-navigation';
import { FARM_CHANGED_MESSAGE, FARM_UNIDENTIFIED_MESSAGE, type IrrigationUnavailableReason } from '@/lib/domain/snapshot-policy';
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

type StateText = { eyebrow: string; title: string; body: string; action: string; refresh: boolean };

const TEXTS: Record<IrrigationUnavailableReason, StateText> = {
  'rate-limit': {
    eyebrow: 'Actualisation temporairement bloquée',
    title: 'Limite de requêtes OTF atteinte',
    body: 'Ouvre ta ferme refuse temporairement de nouvelles lectures et aucune lecture précédente n’est encore enregistrée. Patientez quelques minutes avant de réessayer.',
    action: 'Réessayer',
    refresh: true,
  },
  unavailable: {
    eyebrow: 'Connexion interrompue',
    title: 'Les données ne sont pas disponibles',
    body: 'Impossible de charger Ouvre ta ferme et aucune lecture précédente n’est encore enregistrée. Aucune donnée n’a été modifiée.',
    action: 'Réessayer',
    refresh: true,
  },
  // La clé du module mène à une autre ferme (docs/tranche-4-contract.md, F332) : recharger ouvre l'espace de celle-ci.
  'farm-changed': {
    eyebrow: 'Ferme changée',
    title: 'La clé mène à une autre ferme',
    body: FARM_CHANGED_MESSAGE,
    action: 'Recharger la page',
    refresh: false,
  },
  // Aucune ferme n'est connue pour la clé : rien n'est montré (F341).
  'farm-unidentified': {
    eyebrow: 'Ferme inconnue',
    title: 'La ferme n’est pas identifiée',
    body: FARM_UNIDENTIFIED_MESSAGE,
    action: 'Réessayer',
    refresh: true,
  },
};

/** Ouvre ta ferme n'a pas répondu et rien n'est encore enregistré : aucune page ne peut s'afficher. */
export function UnavailableState({ page, signOutPath, userName, season, reason, seasonFirst, seasonLast, demo, demoSelection }: UnavailableStateProps) {
  const seasonUnavailable = reason === 'season-unavailable' && seasonFirst !== undefined && seasonLast !== undefined;
  const fallbackSeason = seasonUnavailable ? closestAvailableSeason(season, seasonFirst, seasonLast) : season;
  const text: StateText = seasonUnavailable
    ? {
        eyebrow: 'Saison indisponible',
        title: `La saison ${season} n’est pas disponible`,
        body: `Ouvre ta ferme propose actuellement les saisons ${seasonFirst} à ${seasonLast}. Aucune donnée n’a été modifiée.`,
        action: `Afficher la saison ${fallbackSeason}`,
        refresh: false,
      }
    : TEXTS[reason === 'season-unavailable' ? 'unavailable' : reason];

  return (
    <main className="app-shell">
      <Topbar userName={userName} signOutPath={signOutPath} demo={demo} demoSelection={demoSelection} />
      <section className="fatal-state" role="alert">
        <p className="eyebrow">{text.eyebrow}</p>
        <h1>{text.title}</h1>
        <p>{text.body}</p>
        <a className="primary-link" href={pageHref(page, { season: fallbackSeason, refresh: text.refresh })}>
          {text.action}
        </a>
      </section>
    </main>
  );
}
