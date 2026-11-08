import type { EquipmentKind } from '../irrigation-domain.ts';
import { HOURS_PER_DAY, MINUTES_PER_DAY, MINUTES_PER_HOUR } from '../units.ts';

/**
 * Les réglages du planning hebdomadaire, R2 à R14 de
 * `docs/planning-contract.md` (D-024, D-025). Chacun a une valeur de départ
 * tranchée par le porteur le 29 septembre 2026 et se règle à l'écran ; le
 * moteur les relit à chaque calcul et n'en connaît aucun en dur. R1, l'heure
 * du recalcul quotidien, est retiré (D-029) : le recalcul du matin suit la
 * synchronisation météo et ne se règle pas ; une heure encore enregistrée
 * n'est plus lue.
 */

/** R4 à R7, par nature de matériel. */
type DoseSettings = {
  /** R4 — en dessous, l'arrosage attend que le besoin grandisse, sauf le dernier jour. */
  minimumMm: number;
  /** R5 — au-delà, l'eau ne sert plus la culture : le besoin se fractionne. */
  maximumMm: number;
  /** R6 — arrosages au plus par jour civil et par planche. */
  irrigationsPerDay: number;
  /** R7 — jours au moins entre deux débuts d'arrosage d'une même planche (1 = 24 h). */
  spacingDays: number;
};

/** R8 — une plage dans la journée, en minutes depuis minuit ; `end < start` : elle passe minuit. */
export type TimeWindow = {
  startMinute: number;
  endMinute: number;
};

/** R9 — les trois conduites du cahier des charges (section 27). */
type ShortageStrategy = 'priority-then-equal-share' | 'equal-share' | 'defer';

/** R11 — la dose d'un matériel qui arrose plusieurs planches. */
type CollectiveDoseRule = 'highest-need' | 'lowest-need';

export type PlanningSettings = {
  /** R2 — part de la pluie prévue déduite du besoin, de 0 à 1. */
  forecastRainShare: number;
  /** R3 — une pluie prévue au-dessus fait placer les arrosages après elle. */
  waitForForecastRainAboveMm: number;
  doses: Record<EquipmentKind, DoseSettings>;
  windows: Record<EquipmentKind, TimeWindow>;
  shortageStrategy: ShortageStrategy;
  /** R10 — reporter le déficit sur la semaine suivante. */
  carryOverDeficit: boolean;
  collectiveDoseRule: CollectiveDoseRule;
  /** R12 — le matériel qui sert d'abord quand deux arrosent la même planche. */
  preferredKindWhenBoth: EquipmentKind;
  /** R13 — part du débit le plus fort d'un matériel en dessous de laquelle une planche ne commande pas l'arrosage, de 0 à 1 (D-025). */
  commandingRateShare: number;
  /** R14 — minutes après son heure de début au bout desquelles une irrigation planifiée non démarrée est « en retard » (3.7, règle 18, D-051). */
  lateToleranceMinutes: number;
};

/** Minutes depuis minuit d'une heure d'horloge. */
export function minutesOfDay(hour: number, minute = 0): number {
  return hour * MINUTES_PER_HOUR + minute;
}

/** Valeurs de départ tranchées le 29 septembre 2026 (D-024). */
export const DEFAULT_PLANNING_SETTINGS: PlanningSettings = {
  forecastRainShare: 1,
  waitForForecastRainAboveMm: 5,
  doses: {
    sprinkler: { minimumMm: 5, maximumMm: 15, irrigationsPerDay: 1, spacingDays: 1 },
    drip: { minimumMm: 3, maximumMm: 10, irrigationsPerDay: 1, spacingDays: 1 },
  },
  windows: {
    sprinkler: { startMinute: minutesOfDay(21), endMinute: minutesOfDay(8) },
    drip: { startMinute: minutesOfDay(6), endMinute: minutesOfDay(22) },
  },
  shortageStrategy: 'priority-then-equal-share',
  carryOverDeficit: false,
  collectiveDoseRule: 'highest-need',
  preferredKindWhenBoth: 'drip',
  commandingRateShare: 0.5,
  lateToleranceMinutes: 30,
};

export type PlanningSettingsIssue = { path: string; message: string };

/**
 * Vérifie des réglages venus de l'écran ou du cache. Une valeur absurde est
 * refusée avec son chemin ; rien n'est corrigé en silence.
 */
export function validatePlanningSettings(value: unknown): { settings: PlanningSettings; issues: [] } | { settings: null; issues: PlanningSettingsIssue[] } {
  const issues: PlanningSettingsIssue[] = [];
  if (typeof value !== 'object' || value === null) {
    return { settings: null, issues: [{ path: '', message: 'Réglages absents.' }] };
  }
  const raw = value as Record<string, unknown>;
  if (!isNumber(raw.forecastRainShare, 0, 1)) issues.push({ path: 'forecastRainShare', message: 'La part de pluie prévue va de 0 à 1.' });
  if (!isNumber(raw.waitForForecastRainAboveMm, 0, Number.POSITIVE_INFINITY)) issues.push({ path: 'waitForForecastRainAboveMm', message: 'Le seuil de pluie prévue est un nombre positif ou nul.' });
  for (const kind of ['sprinkler', 'drip'] as const) {
    const dose = (raw.doses as Record<string, unknown> | undefined)?.[kind] as Record<string, unknown> | undefined;
    if (!dose || !isNumber(dose.minimumMm, 0, Number.POSITIVE_INFINITY) || !isNumber(dose.maximumMm, 0, Number.POSITIVE_INFINITY)
      || Number(dose.minimumMm) > Number(dose.maximumMm) || Number(dose.maximumMm) <= 0
      || !isInteger(dose.irrigationsPerDay, 1, HOURS_PER_DAY) || !isInteger(dose.spacingDays, 0, 7)) {
      issues.push({ path: `doses.${kind}`, message: 'Doses invalides : minimum ≤ maximum, maximum > 0, 1 à 24 arrosages par jour, 0 à 7 jours d’espacement.' });
    }
    const window = (raw.windows as Record<string, unknown> | undefined)?.[kind] as Record<string, unknown> | undefined;
    if (!window || !isInteger(window.startMinute, 0, MINUTES_PER_DAY - 1) || !isInteger(window.endMinute, 0, MINUTES_PER_DAY - 1)
      || window.startMinute === window.endMinute) {
      issues.push({ path: `windows.${kind}`, message: 'Plage horaire invalide : deux heures de la journée, différentes.' });
    }
  }
  if (!['priority-then-equal-share', 'equal-share', 'defer'].includes(String(raw.shortageStrategy))) {
    issues.push({ path: 'shortageStrategy', message: 'Conduite en pénurie inconnue.' });
  }
  if (typeof raw.carryOverDeficit !== 'boolean') issues.push({ path: 'carryOverDeficit', message: 'Le report est oui ou non.' });
  if (!['highest-need', 'lowest-need'].includes(String(raw.collectiveDoseRule))) {
    issues.push({ path: 'collectiveDoseRule', message: 'Règle de dose collective inconnue.' });
  }
  if (!['sprinkler', 'drip'].includes(String(raw.preferredKindWhenBoth))) {
    issues.push({ path: 'preferredKindWhenBoth', message: 'Matériel préféré inconnu.' });
  }
  if (!isNumber(raw.commandingRateShare, 0, 1)) issues.push({ path: 'commandingRateShare', message: 'La part du débit qui commande l’arrosage va de 0 à 1.' });
  if (!isInteger(raw.lateToleranceMinutes, 0, MINUTES_PER_DAY)) issues.push({ path: 'lateToleranceMinutes', message: 'La tolérance du retard est un nombre entier de minutes, de 0 à 1440.' });
  if (issues.length > 0) return { settings: null, issues };
  return { settings: value as PlanningSettings, issues: [] };
}

function isNumber(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isInteger(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
