'use client';

import { useEffect } from 'react';
import { millisecondsFromSeconds } from '@/lib/domain/units';
import { pageHref, type IrrigationPageId } from '@/lib/domain/features/pages';
import { closestAvailableSeason } from '@/lib/domain/irrigation-navigation';
import {
  DAY_LIMIT_MESSAGE,
  FARM_CHANGED_MESSAGE,
  FARM_UNIDENTIFIED_MESSAGE,
  READ_TOO_LONG_MESSAGE,
  type IrrigationUnavailableReason,
} from '@/lib/domain/snapshot-policy';
import type { DemoSelection } from '@/lib/domain/demo/catalogue';
import type { FrozenFarmView } from '@/lib/domain/operations/farm-erasure-request';
import { FrozenFarm } from './frozen-farm';
import { Topbar } from './topbar';

export type UnavailableStateProps = {
  page: IrrigationPageId;
  signOutPath: string;
  userName: string;
  season: number;
  reason: IrrigationUnavailableReason | 'season-unavailable' | 'demo-preparing' | 'farm-frozen';
  seasonFirst?: number;
  seasonLast?: number;
  /** Un déploiement de démonstration : la bannière permanente (docs/demo-guided-contract.md). */
  demo: boolean;
  demoSelection: DemoSelection | null;
  /** L'espace figé par une demande d'effacement (4.5, F666) : ce que son écran dit. */
  frozen?: FrozenFarmView;
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
  // La limite du jour d'OTF est atteinte pour la ferme (F363) : aucun appel ne part avant l'heure qu'OTF a donnée.
  'day-limit': {
    eyebrow: 'Limite du jour atteinte',
    title: 'Ouvre ta ferme ne répond plus aujourd’hui pour cette ferme',
    body: `${DAY_LIMIT_MESSAGE} Aucune lecture précédente n’est encore enregistrée ; aucune donnée n’a été modifiée.`,
    action: 'Recharger la page',
    refresh: false,
  },
  // Une autre lecture de la ferme était en cours (F362) : recharger trouve ce qu'elle a rangé.
  'read-in-progress': {
    eyebrow: 'Lecture en cours',
    title: 'Une lecture d’Ouvre ta ferme est déjà en cours',
    body: 'Une autre lecture de cette ferme est en cours et aucune lecture précédente n’est encore enregistrée. Rechargez la page dans un instant ; aucune donnée n’a été modifiée.',
    action: 'Recharger la page',
    refresh: false,
  },
  // Plus de 30 appels : la lecture ne se fait qu'au calcul du matin (F362).
  'read-too-long': {
    eyebrow: 'Lecture au calcul du matin',
    title: 'La lecture de cette ferme se fait le matin',
    body: `${READ_TOO_LONG_MESSAGE} Aucune lecture précédente n’est encore enregistrée ; aucune donnée n’a été modifiée.`,
    action: 'Recharger la page',
    refresh: false,
  },
  // Une route lue a changé de forme (T4-15, F394) : rien n'est lu ni rangé tant que le module ne sait pas la lire.
  'shape-changed': {
    eyebrow: 'Données d’Ouvre ta ferme illisibles',
    title: 'Ouvre ta ferme a changé la forme de ses données',
    body: 'Le module ne sait plus les lire sans risque d’erreur et aucune lecture précédente n’est encore enregistrée. Rien n’est affiché plutôt que des données fausses ; aucune donnée n’a été modifiée.',
    action: 'Réessayer',
    refresh: true,
  },
};

/** La démonstration se prépare dans une autre requête (audit du 19 novembre 2026, lot I, n° 11, F450). */
const DEMO_PREPARING: StateText = {
  eyebrow: 'Démonstration',
  title: 'Préparation de votre démonstration…',
  body: 'La ferme fictive se prépare : ses cultures, son matériel, sa météo et le plan de la semaine. La page s’ouvrira d’elle-même dans un instant.',
  action: 'Recharger la page',
  refresh: false,
};

/** Toutes les deux secondes, la page se relit tant que la démonstration se prépare (F450). */
const PREPARING_RELOAD_SECONDS = 2;

/** Ouvre ta ferme n'a pas répondu et rien n'est encore enregistré : aucune page ne peut s'afficher. */
export function UnavailableState({ page, signOutPath, userName, season, reason, seasonFirst, seasonLast, demo, demoSelection, frozen }: UnavailableStateProps) {
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
    : reason === 'demo-preparing' ? DEMO_PREPARING : TEXTS[reason === 'season-unavailable' || reason === 'farm-frozen' ? 'unavailable' : reason];
  const preparing = reason === 'demo-preparing';
  useEffect(() => {
    if (!preparing) return;
    const timer = setTimeout(() => window.location.reload(), millisecondsFromSeconds(PREPARING_RELOAD_SECONDS));
    return () => clearTimeout(timer);
  }, [preparing]);

  return (
    <main className="app-shell">
      <Topbar userName={userName} signOutPath={signOutPath} demo={demo} demoSelection={demoSelection} />
      {reason === 'farm-frozen' && frozen
        ? <FrozenFarm view={frozen} reopenHref={pageHref(page, { season })} />
        : (
          <section className="fatal-state" role={preparing ? 'status' : 'alert'} aria-busy={preparing || undefined}>
            <p className="eyebrow">{text.eyebrow}</p>
            <h1>{text.title}</h1>
            <p>{text.body}</p>
            <a className="primary-link" href={pageHref(page, { season: fallbackSeason, refresh: text.refresh })}>
              {text.action}
            </a>
          </section>
        )}
    </main>
  );
}
