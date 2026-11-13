import type { FeatureId } from '../features/catalogue.ts';

/**
 * Les fermes fictives de la démonstration et leurs moments de saison
 * (docs/demo-guided-contract.md, section 6 ; D2 de la sous-tranche 4.0).
 * Trois profils et une ferme vierge, validés par le porteur le 8 novembre
 * 2026 (question 1 sur 4) ; quatre moments par profil (question 2 sur 4),
 * chacun daté : la démonstration se joue ce jour-là, à l'heure réelle de la
 * ferme, quel que soit le jour de la visite (C3).
 */

export type DemoProfileId = 'maraichage' | 'petite-ferme' | 'vannes-alertes' | 'vierge';

const DEMO_MOMENT_IDS = ['gel-printemps', 'ete', 'penurie', 'automne'] as const;
type DemoMomentId = (typeof DEMO_MOMENT_IDS)[number];

type DemoMoment = {
  id: DemoMomentId;
  label: string;
  /** Le jour simulé, `AAAA-MM-JJ`, à la ferme. */
  dateKey: string;
  /** Ce que le moment fait voir, en une phrase. */
  shows: string;
};

export type DemoProfile = {
  id: DemoProfileId;
  label: string;
  description: string;
  /** Les cases cochées d'avance ; vide pour la ferme vierge, qui s'ouvre sur la liste à cocher. */
  features: readonly FeatureId[];
  moments: readonly DemoMoment[];
};

/** Les quatre moments de la saison 2026, des mardis : une semaine entamée, ni lundi ni dimanche. */
const MOMENTS: Readonly<Record<DemoMomentId, DemoMoment>> = {
  'gel-printemps': {
    id: 'gel-printemps',
    label: 'Printemps, nuit de gel annoncée',
    dateKey: '2026-04-14',
    shows: 'Une nuit de gel est annoncée : l’alerte de la culture qui risque de geler.',
  },
  ete: {
    id: 'ete',
    label: 'Début d’été, semaine normale',
    dateKey: '2026-06-16',
    shows: 'Une semaine ordinaire : le planning propose et place tous les arrosages.',
  },
  penurie: {
    id: 'penurie',
    label: 'Pic d’été, l’eau manque',
    dateKey: '2026-07-21',
    shows: 'La réserve est basse : le budget de la semaine, les parts de chaque planche et ce qui n’est pas placé.',
  },
  automne: {
    id: 'automne',
    label: 'Automne, fin de saison',
    dateKey: '2026-10-20',
    shows: 'La saison s’achève : l’historique des arrosages et les cumuls.',
  },
};

const ALL_MOMENTS = DEMO_MOMENT_IDS.map((id) => MOMENTS[id]);

export const DEMO_PROFILES: readonly DemoProfile[] = [
  {
    id: 'maraichage',
    label: 'Maraîchage diversifié',
    description: 'Plein champ et abri, une réserve et une pompe : le besoin, le planning, la pénurie et la réserve.',
    features: ['arrosages', 'planning', 'besoins', 'sol', 'cultures', 'materiel', 'calculateur', 'ressources', 'alertes-meteo', 'alertes-cultures', 'historique'],
    moments: ALL_MOMENTS,
  },
  {
    id: 'petite-ferme',
    label: 'Petite exploitation, une seule ressource',
    description: 'L’arrosage sans réserve, et le calculateur des millimètres au temps.',
    features: ['arrosages', 'besoins', 'materiel', 'calculateur'],
    moments: ALL_MOMENTS,
  },
  {
    id: 'vannes-alertes',
    label: 'Le matériel et les alertes seulement',
    description: 'Le module à la carte : une ferme qui ne coche presque rien.',
    features: ['materiel', 'alertes-meteo'],
    moments: ALL_MOMENTS,
  },
  {
    id: 'vierge',
    label: 'Ferme vierge',
    description: 'La première ouverture : rien de coché, rien de réglé.',
    features: [],
    moments: [MOMENTS.ete],
  },
];

export type DemoChoice = { profile: DemoProfile; moment: DemoMoment };

function profileById(id: string | undefined): DemoProfile | undefined {
  return DEMO_PROFILES.find((profile) => profile.id === id);
}

/**
 * Le choix lu dans les témoins du navigateur : une valeur absente ou hors de
 * la liste revient au premier profil et à son premier moment ; un moment que
 * le profil n'a pas revient à son premier moment.
 */
export function resolveDemoChoice(profileId: string | undefined, momentId: string | undefined): DemoChoice {
  const profile = profileById(profileId) ?? DEMO_PROFILES[0];
  const moment = profile.moments.find((item) => item.id === momentId) ?? profile.moments[0];
  return { profile, moment };
}

const SEPARATOR = '·demo·';

/**
 * L'identité d'un espace de démonstration : un par invité, par profil et par
 * moment. Les essais d'un moment ne débordent ni sur un autre moment, ni sur
 * un autre invité (couche 5 du contrat).
 */
export function demoOwnerUserId(guestUserId: string, choice: DemoChoice): string {
  return `${guestUserId}${SEPARATOR}${choice.profile.id}·${choice.moment.id}`;
}

/** Le profil et le moment d'un espace de démonstration, ou `null` hors démonstration. */
export function demoChoiceOfOwner(ownerUserId: string): DemoChoice | null {
  const index = ownerUserId.lastIndexOf(SEPARATOR);
  if (index < 0) return null;
  const [profileId, momentId, extra] = ownerUserId.slice(index + SEPARATOR.length).split('·');
  const profile = profileById(profileId);
  const moment = profile?.moments.find((item) => item.id === momentId);
  return profile && moment && extra === undefined ? { profile, moment } : null;
}

/** Les témoins du navigateur qui portent le choix de l'invité ; rien de sensible. */
export const DEMO_PROFILE_COOKIE = 'demo-profil';
export const DEMO_MOMENT_COOKIE = 'demo-moment';

/** La valeur d'un témoin dans un en-tête `Cookie`, ou `undefined`. */
export function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

/** Ce que la bannière montre du choix de l'invité : la ferme et le moment. */
export type DemoSelection = { profile: DemoProfileId; moment: DemoMomentId };

export function demoSelectionOfOwner(ownerUserId: string): DemoSelection | null {
  const choice = demoChoiceOfOwner(ownerUserId);
  return choice ? { profile: choice.profile.id, moment: choice.moment.id } : null;
}
