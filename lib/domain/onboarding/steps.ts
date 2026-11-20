import { FARM_TIME_ZONE } from '../water-management.ts';

/**
 * L'accueil d'une nouvelle ferme (4.4, docs/tranche-4-contract.md, section
 * 8 bis ; F417, F426, F427, F581) : les étapes que la personne confirme, et
 * ce que l'on en dit. La base garde une ligne par étape ; une étape sans
 * ligne est « à faire » : rien n'est confirmé à la place de la personne.
 *
 * Un espace qui existait avant la 4.4 a ses cinq étapes « confirmées »,
 * d'origine « avant l'accueil » (migration 0034) : ses réglages sont gardés
 * tels quels, et l'écran le dit (F426).
 */

/** Les étapes de l'accueil que la personne confirme, dans l'ordre du parcours (section 8 bis.3, étapes 2 à 6). */
export const ONBOARDING_STEP_IDS = ['location', 'plots', 'soil', 'crops', 'settings'] as const;
type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

const STATES = ['todo', 'proposed', 'confirmed', 'skipped'] as const;
/** À faire, proposé (à confirmer), confirmé, passé. */
type OnboardingStepState = (typeof STATES)[number];

const ORIGINS = ['onboarding', 'before-onboarding'] as const;
/** Confirmé à l'accueil, ou réglage d'avant l'accueil gardé tel quel (F426). */
type OnboardingOrigin = (typeof ORIGINS)[number];

/** Ce que la base garde d'une étape, tel quel : le domaine écarte ce qu'il ne connaît pas. */
export type StoredOnboardingStep = {
  step: unknown;
  state: unknown;
  origin: unknown;
  confirmedAt: string | null;
};

/** Ce que l'on sait de l'accueil d'un espace : ses lignes, ou la démonstration, dont les fermes fictives sont déjà réglées. */
export type StoredOnboarding =
  | { kind: 'demonstration' }
  | { kind: 'stored'; steps: readonly StoredOnboardingStep[] };

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  state: OnboardingStepState;
  origin: OnboardingOrigin;
  confirmedAt: string | null;
};

export type ResolvedOnboarding =
  | { kind: 'demonstration' }
  /** Un espace d'avant la 4.4 : tout est confirmé, d'origine « avant l'accueil » (F426). */
  | { kind: 'before-onboarding'; steps: OnboardingStep[] }
  /** Un espace qui fait l'accueil ; `remaining` : les étapes ni confirmées ni passées. */
  | { kind: 'onboarding'; steps: OnboardingStep[]; remaining: OnboardingStep[] };

const LABELS: Record<OnboardingStepId, string> = {
  location: 'Où est la ferme',
  plots: 'Parcelles et abris',
  soil: 'Sol',
  crops: 'Cultures',
  settings: 'Réglages à relire',
};

/**
 * Ce qu'une étape passée laisse de côté, dit en une phrase à la vérification
 * (F417, F427) : rien n'est calculé sur une valeur que la personne n'a pas
 * confirmée.
 */
const SKIPPED_CONSEQUENCES: Record<OnboardingStepId, string> = {
  location: 'Vous n’avez pas confirmé la commune de la ferme : ni météo, ni gel, ni ET0 pour cette ferme.',
  plots: 'Vous n’avez pas classé vos parcelles : le besoin en eau d’une parcelle à classer n’est pas calculé.',
  soil: 'Vous n’avez pas confirmé le sol : la réserve utile reste non calculable.',
  crops: 'Vous n’avez pas rattaché vos espèces : le besoin d’une espèce non rattachée reste inconnu.',
  settings: 'Vous n’avez pas validé les réglages du planning : aucun planning n’est calculé.',
};

function isStepId(value: unknown): value is OnboardingStepId {
  return typeof value === 'string' && (ONBOARDING_STEP_IDS as readonly string[]).includes(value);
}

function isState(value: unknown): value is OnboardingStepState {
  return typeof value === 'string' && (STATES as readonly string[]).includes(value);
}

function isOrigin(value: unknown): value is OnboardingOrigin {
  return typeof value === 'string' && (ORIGINS as readonly string[]).includes(value);
}

/**
 * L'accueil d'un espace, d'après ses lignes : chaque étape sans ligne lisible
 * est « à faire ». L'espace est « d'avant l'accueil » seulement si ses cinq
 * étapes le sont : une ligne qui manque le remet dans l'accueil, plutôt que de
 * tenir pour confirmé ce qui ne l'a pas été.
 */
export function resolveOnboarding(stored: StoredOnboarding): ResolvedOnboarding {
  if (stored.kind === 'demonstration') return { kind: 'demonstration' };
  const byId = new Map<OnboardingStepId, StoredOnboardingStep>();
  for (const row of stored.steps) {
    if (isStepId(row.step) && isState(row.state) && isOrigin(row.origin)) byId.set(row.step, row);
  }
  const steps = ONBOARDING_STEP_IDS.map((id): OnboardingStep => {
    const row = byId.get(id);
    if (!row) return { id, label: LABELS[id], state: 'todo', origin: 'onboarding', confirmedAt: null };
    const state = row.state as OnboardingStepState;
    return {
      id,
      label: LABELS[id],
      state,
      origin: row.origin as OnboardingOrigin,
      confirmedAt: state === 'confirmed' ? row.confirmedAt : null,
    };
  });
  if (steps.every((step) => step.origin === 'before-onboarding' && step.state === 'confirmed')) {
    return { kind: 'before-onboarding', steps };
  }
  return { kind: 'onboarding', steps, remaining: steps.filter((step) => step.state !== 'confirmed' && step.state !== 'skipped') };
}

/** Vert : confirmé ; orange : passé, conséquence dite ; rouge : manquant (F427). */
type VerificationTone = 'confirmed' | 'skipped' | 'missing';

export type VerificationLine = { id: OnboardingStepId; label: string; tone: VerificationTone; text: string };

const dateFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: FARM_TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' });

/**
 * La ligne de vérification d'une étape (F427) : ce qui a été confirmé et
 * d'où cela vient, ce qui a été passé et ce que cela laisse de côté, ce qui
 * reste à faire. Un réglage d'avant l'accueil dit sa provenance (F426).
 */
export function verificationLine(step: OnboardingStep): VerificationLine {
  const base = { id: step.id, label: step.label };
  switch (step.state) {
    case 'confirmed':
      return {
        ...base,
        tone: 'confirmed',
        text: step.origin === 'before-onboarding'
          ? 'Réglage d’avant l’accueil, gardé tel quel.'
          : step.confirmedAt ? `Confirmé le ${dateFormat.format(new Date(step.confirmedAt))}.` : 'Confirmé.',
      };
    case 'skipped':
      return { ...base, tone: 'skipped', text: SKIPPED_CONSEQUENCES[step.id] };
    case 'proposed':
      return { ...base, tone: 'missing', text: 'Proposé, à confirmer.' };
    case 'todo':
      return { ...base, tone: 'missing', text: 'À faire.' };
  }
}

/** La ligne du pli de l'accueil, dans Réglages : courte, pour tenir fermée sur une ligne ou deux au téléphone. */
export function onboardingSummary(resolved: Exclude<ResolvedOnboarding, { kind: 'demonstration' }>): string {
  if (resolved.kind === 'before-onboarding') return 'Fait avant l’accueil des nouvelles fermes.';
  const count = resolved.remaining.length;
  if (count === 0) return 'Accueil terminé.';
  return `${count} étape${count > 1 ? 's' : ''} sur ${resolved.steps.length} à finir.`;
}

/** Ce que l'accueil veut dire pour cette ferme, en tête du pli ouvert. */
export function onboardingExplanation(resolved: Exclude<ResolvedOnboarding, { kind: 'demonstration' }>): string {
  if (resolved.kind === 'before-onboarding') {
    return 'Votre ferme utilisait le module avant l’accueil des nouvelles fermes : ses réglages sont gardés tels quels.';
  }
  if (resolved.remaining.length === 0) return 'Chaque étape est confirmée ou passée.';
  return 'Les écrans de l’accueil arrivent avec les prochaines versions du module ; rien n’est confirmé à votre place.';
}
