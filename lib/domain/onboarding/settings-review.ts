import { DEFAULT_CROP_ALERT_SETTINGS } from '../crop-alerts/settings.ts';
import { DEFAULT_FROST_MARGINS, FROST_OFFSET_CELSIUS } from '../crop-alerts/thresholds.ts';
import { ET0_BOUNDS, PLASTIC_MULCH_FACTOR, SHELTER_FACTOR } from '../crop-water/etm.ts';
import type { FeatureId } from '../features/catalogue.ts';
import type { IrrigationPageId } from '../features/pages.ts';
import { DEFAULT_PLANNING_SETTINGS, type PlanningSettings } from '../planning/settings.ts';
import { DEFAULT_SOIL_SETTINGS, FARM_THRESHOLD } from '../soil-reserve/soil.ts';
import type { ResolvedOnboarding } from './steps.ts';

/**
 * L'étape « Réglages à relire » d'une ferme neuve (4.4,
 * docs/tranche-4-contract.md, F424 ; PR 5a, F588) : chaque groupe de
 * valeurs de départ, avec sa source et le mot « proposé, à ajuster ». La
 * personne valide ou passe chaque groupe ; ajuster se fait dans la page du
 * groupe. Aucun planning n'est calculé tant que le groupe « Planning » n'est
 * pas validé (réponse Q10). Les valeurs dites sont lues des constantes du
 * calcul : le texte ne peut pas dire autre chose que ce que le module fait.
 */

const SETTINGS_GROUP_IDS = ['abris', 'calcul', 'sol', 'gel', 'alertes', 'planning'] as const;
export type SettingsGroupId = (typeof SETTINGS_GROUP_IDS)[number];
export type SettingsGroupAnswer = 'validated' | 'skipped';

type SettingsLine = { label: string; value: string; source: string };

export type SettingsGroup = {
  id: SettingsGroupId;
  label: string;
  lines: SettingsLine[];
  /** La page où l'on ajuste ces valeurs. */
  page: IrrigationPageId;
  /** Le pli de la page qui les porte, quand elles n'y sont pas en tête : « Réglages de la semaine » pour le planning (lot S4, PR 4). */
  anchor?: string;
  /** Ce que passer le groupe laisse de côté. */
  skippedConsequence: string;
};

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const n = (value: number) => number.format(value);
const hour = (minutes: number) => `${Math.floor(minutes / 60)} h${minutes % 60 === 0 ? '' : String(minutes % 60).padStart(2, '0')}`;

const PORTEUR = 'choix du porteur';
/** Le pli « Réglages de la semaine » de « Semaine », l'ancre du pli « Réglages de cette page » d'avant (lot S4, section 7.4). */
const WEEK_SETTINGS_ANCHOR = 'reglages-de-la-page';

/** Les groupes, chacun avec les cases qui s'en servent : un groupe sans case cochée n'est pas à relire. */
const GROUPS: readonly (SettingsGroup & { features: readonly FeatureId[] })[] = [
  {
    id: 'abris',
    label: 'Abris',
    features: ['besoins', 'planning', 'sol', 'cultures'],
    page: 'cultures',
    lines: [{
      label: 'Coefficient d’abri (K_abri)',
      value: `${n(SHELTER_FACTOR.default)} sous abri, réglable de ${n(SHELTER_FACTOR.setting.minimum)} à ${n(SHELTER_FACTOR.setting.maximum)}, à confirmer pour chaque abri`,
      source: 'CRIIAM, tunnel',
    }],
    skippedConsequence: 'Le coefficient d’abri reste celui proposé, sans confirmation.',
  },
  {
    id: 'calcul',
    label: 'Calcul du besoin',
    features: ['besoins', 'planning', 'cultures'],
    page: 'cultures',
    lines: [
      { label: 'Paillage plastique', value: `Kc × ${n(PLASTIC_MULCH_FACTOR)}`, source: PORTEUR },
      { label: 'ET0 du jour admise', value: `de ${n(ET0_BOUNDS.minimum)} à ${n(ET0_BOUNDS.maximum)} mm par jour`, source: 'borne de sécurité' },
    ],
    skippedConsequence: 'Le besoin se calcule avec les valeurs proposées.',
  },
  {
    id: 'sol',
    label: 'Sol et surface',
    features: ['sol'],
    page: 'sol',
    lines: [
      { label: 'Bâche perméable', value: `évaporation × ${n(DEFAULT_SOIL_SETTINGS.surface.permeableTarpEvaporation)}`, source: PORTEUR },
      { label: 'Paillage', value: `évaporation × ${n(DEFAULT_SOIL_SETTINGS.surface.mulchedEvaporation)}`, source: PORTEUR },
      {
        label: 'Engrais verts',
        value: `Kc ${n(DEFAULT_SOIL_SETTINGS.surface.greenManureEmergenceKc)} à la levée, ${n(DEFAULT_SOIL_SETTINGS.surface.greenManurePartialKc)} en partie couvrant, ${n(DEFAULT_SOIL_SETTINGS.surface.greenManureFullKc)} couvrant`,
        source: PORTEUR,
      },
      { label: 'Planche enherbée', value: `Kc ${n(DEFAULT_SOIL_SETTINGS.surface.grassKc)}`, source: PORTEUR },
      {
        label: 'Seuil de la ferme',
        value: `${FARM_THRESHOLD.proposedPercent} % du plein, réglable de ${FARM_THRESHOLD.minimumPercent} à ${FARM_THRESHOLD.maximumPercent} %`,
        source: PORTEUR,
      },
    ],
    skippedConsequence: 'La réserve du sol se calcule avec les valeurs proposées.',
  },
  {
    id: 'gel',
    label: 'Gel',
    features: ['alertes-cultures'],
    page: 'alertes-cultures',
    lines: [
      {
        label: 'Marges de gel',
        value: `${n(DEFAULT_FROST_MARGINS.sensitiveCelsius)} °C pour une culture sensible, ${n(DEFAULT_FROST_MARGINS.hardyCelsius)} °C pour une rustique`,
        source: 'retour du porteur',
      },
      { label: 'Curseur de microclimat', value: `${n(FROST_OFFSET_CELSIUS.default)} °C`, source: PORTEUR },
      { label: 'Seuils par culture', value: 'choix prudent, gardés en commun', source: 'FRAB AuRA, ITAB' },
    ],
    skippedConsequence: 'Les alertes de gel suivent les valeurs proposées.',
  },
  {
    id: 'alertes',
    label: 'Alerte d’aspersion',
    features: ['alertes-cultures'],
    page: 'alertes-cultures',
    lines: [{
      label: 'Aspersion déconseillée',
      value: `au-dessus de ${n(DEFAULT_CROP_ALERT_SETTINGS.sprinklerMaxTemperatureCelsius)} °C ou de ${n(DEFAULT_CROP_ALERT_SETTINGS.sprinklerRadiationWattsPerSquareMeter)} W/m², sur ${DEFAULT_CROP_ALERT_SETTINGS.horizonDays} jours`,
      source: PORTEUR,
    }],
    skippedConsequence: 'Les alertes suivent les valeurs proposées.',
  },
  {
    id: 'planning',
    label: 'Planning',
    features: ['planning'],
    page: 'semaine',
    anchor: WEEK_SETTINGS_ANCHOR,
    lines: planningLines(DEFAULT_PLANNING_SETTINGS),
    skippedConsequence: 'Vous n’avez pas validé les réglages du planning : aucun planning n’est calculé.',
  },
];

function planningLines(settings: PlanningSettings): SettingsLine[] {
  const source = 'décisions du 29 septembre 2026 (D-024)';
  const { sprinkler, drip } = settings.windows;
  return [
    { label: 'Plages horaires', value: `aspersion de ${hour(sprinkler.startMinute)} à ${hour(sprinkler.endMinute)}, goutte-à-goutte de ${hour(drip.startMinute)} à ${hour(drip.endMinute)}`, source },
    {
      label: 'Doses',
      value: `aspersion de ${n(settings.doses.sprinkler.minimumMm)} à ${n(settings.doses.sprinkler.maximumMm)} mm, goutte-à-goutte de ${n(settings.doses.drip.minimumMm)} à ${n(settings.doses.drip.maximumMm)} mm`,
      source,
    },
    { label: 'Pluie prévue', value: `comptée à ${n(settings.forecastRainShare * 100)} %, arrosage après une pluie de plus de ${n(settings.waitForForecastRainAboveMm)} mm`, source },
    { label: 'Pénurie', value: settings.shortageStrategy === 'priority-then-equal-share' ? 'priorité, puis part égale' : 'part égale', source },
    { label: 'Matériel préféré', value: settings.preferredKindWhenBoth === 'drip' ? 'goutte-à-goutte' : 'aspersion', source },
    { label: 'Part du débit qui commande', value: n(settings.commandingRateShare), source },
    { label: 'Retard toléré', value: `${settings.lateToleranceMinutes} min`, source },
  ];
}

/** Les groupes à relire pour les cases cochées, dans l'ordre. */
export function settingsGroupsFor(enabled: readonly FeatureId[]): SettingsGroup[] {
  return GROUPS.filter((group) => group.features.some((feature) => enabled.includes(feature)))
    .map((group): SettingsGroup => ({ id: group.id, label: group.label, lines: group.lines, page: group.page, ...(group.anchor ? { anchor: group.anchor } : {}), skippedConsequence: group.skippedConsequence }));
}

/** Les réponses gardées dans la valeur de l'étape ; ce qui n'est pas lisible est sans réponse. */
export function settingsAnswers(value: unknown): Partial<Record<SettingsGroupId, SettingsGroupAnswer>> {
  const groups = value && typeof value === 'object' ? (value as { groups?: unknown }).groups : null;
  if (!groups || typeof groups !== 'object') return {};
  const answers: Partial<Record<SettingsGroupId, SettingsGroupAnswer>> = {};
  for (const id of SETTINGS_GROUP_IDS) {
    const answer = (groups as Record<string, unknown>)[id];
    if (answer === 'validated' || answer === 'skipped') answers[id] = answer;
  }
  return answers;
}

export function isSettingsGroupId(value: unknown): value is SettingsGroupId {
  return typeof value === 'string' && (SETTINGS_GROUP_IDS as readonly string[]).includes(value);
}

/**
 * Le planning se calcule-t-il ? Toujours pour la ferme d'avant l'accueil et
 * la démonstration (F426) ; pour une ferme qui fait l'accueil, seulement
 * quand le groupe « Planning » est validé (réponse Q10).
 */
export function planningAllowed(onboarding: ResolvedOnboarding): boolean {
  if (onboarding.kind !== 'onboarding') return true;
  const step = onboarding.steps.find((item) => item.id === 'settings');
  if (step?.origin === 'before-onboarding' && step.state === 'confirmed') return true;
  return settingsAnswers(step?.proposedValue ?? null).planning === 'validated';
}

/** Ce que dit un planning refusé, faute du groupe « Planning » validé. */
export const PLANNING_AWAITS_SETTINGS = 'Aucun planning avant que vous ayez validé les réglages du planning, dans Réglages, « Réglages à relire ».';

