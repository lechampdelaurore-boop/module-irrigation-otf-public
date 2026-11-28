import type { IrrigationPageId } from '../features/pages.ts';
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
  /** La valeur proposée ou confirmée gardée (JSON lu), pour dire d'où vient ce qui est en place. */
  proposedValue?: unknown;
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
  proposedValue: unknown;
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
    if (!row) return { id, label: LABELS[id], state: 'todo', origin: 'onboarding', confirmedAt: null, proposedValue: null };
    const state = row.state as OnboardingStepState;
    return {
      id,
      label: LABELS[id],
      state,
      origin: row.origin as OnboardingOrigin,
      confirmedAt: state === 'confirmed' ? row.confirmedAt : null,
      proposedValue: row.proposedValue ?? null,
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

/** Ce qu'un espace garde de la commune choisie à l'accueil (F419) : sa provenance et son nom. */
type ChosenLocation = { source: 'custom' | 'otf'; city: string; postcode: string | null };

function chosenLocationText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const { source, city, postcode } = value as Partial<ChosenLocation>;
  if (typeof city !== 'string' || city.trim() === '') return null;
  const place = typeof postcode === 'string' && postcode.trim() ? `${city} (${postcode})` : city;
  if (source === 'otf') return `${place}, siège de la structure dans Ouvre ta ferme, pris en dernier recours`;
  if (source === 'custom') return `${place}, commune choisie`;
  return null;
}

/** Le nombre de parcelles dont le sol est saisi, gardé à la confirmation de l'étape (F584). */
function enteredSoilText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const { parcels } = value as { parcels?: unknown };
  if (typeof parcels !== 'number' || parcels < 1) return null;
  return `${soilParcelsText(parcels)} saisi`;
}

/**
 * « sol de 4 parcelles » : le sol des parcelles en une expression, la même
 * dans le bandeau « À finir », à la vérification de l'accueil et dans
 * l'étape « Mon sol » de la mise en route (lot S6, section 5.1, S6-i).
 */
export function soilParcelsText(parcels: number): string {
  return `sol de ${parcels} parcelle${parcels > 1 ? 's' : ''}`;
}

/** Les groupes des « Réglages à relire » validés et passés, gardés avec l'étape (F588). */
function reviewedSettingsText(value: unknown): string | null {
  const groups = value && typeof value === 'object' ? (value as { groups?: unknown }).groups : null;
  if (!groups || typeof groups !== 'object') return null;
  const answers = Object.values(groups as Record<string, unknown>);
  const validated = answers.filter((answer) => answer === 'validated').length;
  const skipped = answers.filter((answer) => answer === 'skipped').length;
  if (validated + skipped === 0) return null;
  const plural = (count: number, word: string) => `${count} groupe${count > 1 ? 's' : ''} ${word}${count > 1 ? 's' : ''}`;
  return skipped === 0 ? plural(validated, 'validé') : `${plural(validated, 'validé')}, ${plural(skipped, 'passé')}`;
}

/** Le compte des espèces rattachées, gardé à la confirmation de l'étape (F587). */
function linkedSpeciesText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const { linked, total } = value as { linked?: unknown; total?: unknown };
  if (typeof linked !== 'number' || typeof total !== 'number' || total < 1) return null;
  return `${linked} espèce${linked > 1 ? 's' : ''} rattachée${linked > 1 ? 's' : ''} sur ${total}`;
}

/** Le compte des jardins classés, gardé à la confirmation de l'étape (F583). */
function classifiedPlotsText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const { sheltered, openField } = value as { sheltered?: unknown; openField?: unknown };
  if (typeof sheltered !== 'number' || typeof openField !== 'number') return null;
  const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;
  return `${plural(sheltered, 'abri', 'abris')}, ${plural(openField, 'jardin de plein champ', 'jardins de plein champ')}`;
}

/**
 * La commune de la météo est-elle confirmée (F419) ? Oui pour un espace
 * d'avant l'accueil (son réglage est gardé tel quel) et pour la
 * démonstration ; sinon seulement si l'étape « Où est la ferme » l'est.
 */
export function locationConfirmed(resolved: ResolvedOnboarding): boolean {
  if (resolved.kind !== 'onboarding') return true;
  return resolved.steps.some((step) => step.id === 'location' && step.state === 'confirmed');
}

/** Ce qu'une étape confirmée à l'accueil dit de ce qui a été confirmé. */
const CONFIRMED_DETAIL: Partial<Record<OnboardingStepId, (value: unknown) => string | null>> = {
  location: chosenLocationText,
  plots: classifiedPlotsText,
  soil: enteredSoilText,
  crops: linkedSpeciesText,
  settings: reviewedSettingsText,
};

/**
 * La ligne de vérification d'une étape (F427) : ce qui a été confirmé et
 * d'où cela vient, ce qui a été passé et ce que cela laisse de côté, ce qui
 * reste à faire. Un réglage d'avant l'accueil dit sa provenance (F426).
 */
export function verificationLine(step: OnboardingStep): VerificationLine {
  const base = { id: step.id, label: step.label };
  switch (step.state) {
    case 'confirmed': {
      if (step.origin === 'before-onboarding') return { ...base, tone: 'confirmed', text: 'Réglage d’avant l’accueil, gardé tel quel.' };
      const when = step.confirmedAt ? `Confirmé le ${dateFormat.format(new Date(step.confirmedAt))}` : 'Confirmé';
      const detail = CONFIRMED_DETAIL[step.id]?.(step.proposedValue) ?? null;
      return { ...base, tone: 'confirmed', text: detail ? `${when} : ${detail}.` : `${when}.` };
    }
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

/** L'ancre de l'étape « Rattachez vos espèces », dans Réglages (F587). */
export const SPECIES_STEP_ANCHOR = 'rattachez-vos-especes';

/** L'ancre de l'étape « Réglages à relire », dans Réglages (F588). */
export const SETTINGS_STEP_ANCHOR = 'reglages-a-relire';

/** Une étape à finir, dite sur chaque page (section 8 bis.3) : son nom court, la page et l'ancre où la faire. */
export type UnfinishedStep = { id: OnboardingStepId; text: string; page: IrrigationPageId; anchor: string; count?: number };

/**
 * Ce que le bandeau « À finir » nomme (section 8 bis.3, F582) : seulement
 * une étape que la personne peut faire dès maintenant et dont une case
 * cochée a besoin. La 4.4 l'étend étape par étape, avec l'écran de chacune
 * (F581) : la commune de la ferme (PR 2a), pour les cases qui lisent la
 * météo ; les jardins à classer (PR 2b), pour les cases qui calculent un
 * besoin ; le sol des parcelles (PR 3), pour la réserve du sol ; les espèces
 * à rattacher (PR 4c), tant que l'étape « Cultures » n'est pas confirmée ;
 * les réglages du planning à valider (PR 5a), sans quoi aucun planning. Une étape
 * passée n'est pas rappelée : elle est dite à la vérification (F427).
 */
export function unfinishedSteps(resolved: ResolvedOnboarding, needs: {
  weather: boolean;
  /** Les jardins de la saison encore à classer, quand une case calcule un besoin (F583) ; 0 sinon. */
  plotsToClassify: number;
  /** Les parcelles de la saison sans sol, quand la réserve du sol est cochée (F584), et l'ancre de la première ; `null` sinon. */
  soilToEnter?: { parcels: number; anchor: string } | null;
  /** Les espèces de la saison à rattacher, quand une case lit la correspondance des espèces (F587) ; 0 sinon. */
  speciesToLink?: number;
  /** Le Planning est coché et son groupe des « Réglages à relire » n'est pas validé : aucun planning (F588). */
  planningToValidate?: boolean;
}): UnfinishedStep[] {
  if (resolved.kind !== 'onboarding') return [];
  const remaining = new Set(resolved.remaining.map((step) => step.id));
  const unfinished: UnfinishedStep[] = [];
  if (needs.weather && remaining.has('location')) {
    unfinished.push({ id: 'location', text: 'commune de la ferme', page: 'reglages', anchor: 'water-weather-title' });
  }
  // Un jardin apparu dans Ouvre ta ferme après la confirmation de l'étape est à classer lui aussi : le compte suit le plan.
  if (needs.plotsToClassify > 0) {
    const count = needs.plotsToClassify;
    unfinished.push({ id: 'plots', text: `${count} jardin${count > 1 ? 's' : ''} à classer`, page: 'reglages', anchor: 'parcelles-et-abris' });
  }
  // Comme les jardins : une parcelle apparue après la confirmation de l'étape a besoin de son sol, et le bandeau la nomme.
  const soil = needs.soilToEnter;
  if (soil && soil.parcels > 0) {
    unfinished.push({ id: 'soil', text: soilParcelsText(soil.parcels), page: 'sol', anchor: soil.anchor, count: soil.parcels });
  }
  // Une espèce peut rester sans référence par choix : l'étape confirmée, le bandeau ne la rappelle plus.
  const species = needs.speciesToLink ?? 0;
  if (species > 0 && remaining.has('crops')) {
    unfinished.push({ id: 'crops', text: `${species} espèce${species > 1 ? 's' : ''} à rattacher`, page: 'reglages', anchor: SPECIES_STEP_ANCHOR });
  }
  // Le seul groupe sans lequel un calcul ne se fait pas : le planning attend sa validation (réponse Q10).
  if (needs.planningToValidate) {
    unfinished.push({ id: 'settings', text: 'réglages du planning à valider', page: 'reglages', anchor: SETTINGS_STEP_ANCHOR });
  }
  return unfinished;
}
