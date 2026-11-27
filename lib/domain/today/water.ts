import { waterText } from '../figure-origin.ts';
import { percentFromFraction } from '../units.ts';
import { FARM_TIME_ZONE } from '../water-management.ts';
import { actualWithdrawalsByResourceAndDate, latestResourceLimit, type WaterInfrastructure } from '../water-resources.ts';
import { RESERVOIR_VOLUME_MAX_AGE_DAYS, reservoirAnchor } from './reliability.ts';
import { countText, dateWithYearText, daysBetween, farmDateKey } from './today-text.ts';
import { compareNamesNaturally } from '../bed-order.ts';

/**
 * Le bloc « Eau disponible » de la page « Aujourd'hui » (audit ergonomique,
 * point 1, docs/audit-ergonomie-lot2-contract.md, section 5, bloc d), et
 * ses jauges (docs/aujourdhui-tableau-de-bord-contract.md, section 3.2) :
 * chaque réserve active avec son volume, sa capacité et sa date, chaque
 * ressource limitée avec ce qui reste à prélever aujourd'hui. Un relevé de
 * plus de sept jours est dit vieux, avec le seuil de la zone « Fiabilité du
 * calcul » (F8) : un seul seuil, au même endroit.
 */

type ReservoirGauge = {
  id: string;
  name: string;
  volumeCubicMeters: number | null;
  capacityCubicMeters: number;
  /** « 14 m³ », ou `null` quand le volume n'a jamais été saisi. */
  volumeText: string | null;
  /** « sur 20 m³ ». */
  capacityText: string;
  /** Le remplissage dessiné, de 0 à 100 % ; `null` quand le volume est inconnu (D-003). */
  fillPercent: number | null;
  /** « observé aujourd’hui », « observé le 10 avr. 2026 (11 jours) », « volume jamais saisi ». */
  observedText: string;
  /** Le relevé date de plus de sept jours, ou n'existe pas : la cuve se dessine grisée. */
  stale: boolean;
  /**
   * « sous son minimum de 2 m³ » quand le volume connu est sous le minimum de
   * sécurité déjà saisi de la réserve (lot A, R1, F279) : la cuve se dessine
   * en orange, et le mot le dit ; `null` sinon.
   */
  belowMinimumText: string | null;
  /** La phrase lue de la cuve, nom de son lien (6 nonies, L2) : celle de `lines`. */
  label: string;
  /** La carte de la réserve sur « Ressources et pompes », où son volume se corrige. */
  anchor: string;
};

type LimitGauge = {
  id: string;
  name: string;
  limitCubicMeters: number;
  takenCubicMeters: number;
  remainingCubicMeters: number;
  /** La part déjà prélevée de la limite du jour, de 0 à 100 %. */
  takenPercent: number;
  /** « 8 m³ restants aujourd’hui sur 12 m³ ». */
  text: string;
  /** « 4 m³ prélevés ». */
  takenText: string;
  /** La phrase lue de la ressource, nom de son lien : celle de `lines`. */
  label: string;
  /**
   * Où mène la ressource (L2) : la liste des ressources de « Ressources et
   * pompes » ; ses cartes n'ont pas d'ancre chacune, et le contrat ne change
   * pas les pages d'arrivée (F759).
   */
  anchor: string;
};

/** Le titre de « Ressources et pompes », au-dessus de la liste des ressources. */
const WATER_RESOURCES_ANCHOR = 'water-resources-title';

export type TodayWaterBlock = {
  kind: 'water';
  lines: string[];
  empty: string | null;
  reservoirs: ReservoirGauge[];
  limits: LimitGauge[];
};

export const NO_WATER_TRACKED = 'Aucune réserve ni ressource limitée suivie.';

function fillPercent(volume: number, capacity: number): number {
  if (!(capacity > 0)) return 0;
  return Math.round(percentFromFraction(Math.min(1, Math.max(0, volume / capacity))));
}

function byName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareNamesNaturally(a.name, b.name));
}

/** Ce qu'une réserve dit d'elle : son nom, sa capacité, son volume et sa date. */
export type ReservoirState = Pick<WaterInfrastructure['reservoirs'][number], 'id' | 'name' | 'capacityCubicMeters' | 'currentVolumeCubicMeters' | 'currentVolumeObservedAt' | 'minimumSafetyCubicMeters'>;

function reservoirGauge(reservoir: ReservoirState, today: string): { gauge: Omit<ReservoirGauge, 'label' | 'anchor'>; line: string } {
  const capacityText = `sur ${waterText(reservoir.capacityCubicMeters, 'm³')}`;
  const base = { id: reservoir.id, name: reservoir.name, capacityCubicMeters: reservoir.capacityCubicMeters, capacityText, belowMinimumText: null };
  if (reservoir.currentVolumeCubicMeters === null) {
    return {
      gauge: { ...base, volumeCubicMeters: null, volumeText: null, fillPercent: null, observedText: 'volume jamais saisi', stale: true },
      line: `${reservoir.name} : volume jamais saisi.`,
    };
  }
  const volume = reservoir.currentVolumeCubicMeters;
  const volumeText = waterText(volume, 'm³');
  // Un volume inconnu n'est jamais dit sous le minimum (D-003) ; un minimum nul ne l'est jamais non plus.
  const belowMinimumText = volume < reservoir.minimumSafetyCubicMeters ? `sous son minimum de ${waterText(reservoir.minimumSafetyCubicMeters, 'm³')}` : null;
  const filled = { ...base, volumeCubicMeters: volume, volumeText, fillPercent: fillPercent(volume, reservoir.capacityCubicMeters), belowMinimumText };
  const both = `${volumeText} ${capacityText}${belowMinimumText ? `, ${belowMinimumText}` : ''}`;
  if (reservoir.currentVolumeObservedAt === null) {
    return {
      gauge: { ...filled, observedText: 'date d’observation inconnue', stale: true },
      line: `${reservoir.name} : ${both}, date d’observation inconnue.`,
    };
  }
  const observedOn = farmDateKey(reservoir.currentVolumeObservedAt);
  const age = daysBetween(observedOn, today);
  const observedText = age === 0 ? 'observé aujourd’hui' : `observé le ${dateWithYearText(observedOn)} (${countText(age, 'jour', 'jours')})`;
  return {
    gauge: { ...filled, observedText, stale: age > RESERVOIR_VOLUME_MAX_AGE_DAYS },
    line: `${reservoir.name} : ${both}, ${observedText}.`,
  };
}

/**
 * La phrase d'une réserve, sans point : « Bassin : 14 m³ sur 20 m³, observé
 * aujourd’hui », « Cuve : volume jamais saisi ». Celle du bloc « Eau
 * disponible », reprise par la fiche « Ressources et pompes » de « Ma
 * ferme » (simplification, lot S6, section 7.2) : les mêmes mots.
 */
export function reservoirStateText(reservoir: ReservoirState, now: Date): string {
  return reservoirGauge(reservoir, farmDateKey(now)).line.replace(/\.$/u, '');
}

/** Bloc d : chaque réserve active avec son volume et sa date, chaque ressource limitée avec ce qui reste à prélever aujourd'hui. */
export function waterBlock(infrastructure: WaterInfrastructure, now: Date): TodayWaterBlock {
  const today = farmDateKey(now);
  const lines: string[] = [];
  const reservoirs: ReservoirGauge[] = [];
  for (const reservoir of byName(infrastructure.reservoirs.filter((item) => item.status === 'active'))) {
    const { gauge, line } = reservoirGauge(reservoir, today);
    reservoirs.push({ ...gauge, label: line, anchor: reservoirAnchor(reservoir.id) });
    lines.push(line);
  }
  const limits: LimitGauge[] = [];
  const withdrawn = actualWithdrawalsByResourceAndDate(infrastructure.movements, FARM_TIME_ZONE);
  for (const resource of byName(infrastructure.resources.filter((item) => item.status === 'active'))) {
    const limit = latestResourceLimit(infrastructure.resourceLimits.filter((item) => item.resourceId === resource.id), today);
    if (!limit?.enabled || limit.maxCubicMetersPerDay === null) continue;
    const taken = withdrawn.get(`${resource.id}:${today}`) ?? 0;
    const remaining = Math.max(0, limit.maxCubicMetersPerDay - taken);
    const text = `${waterText(remaining, 'm³')} restants aujourd’hui sur ${waterText(limit.maxCubicMetersPerDay, 'm³')}`;
    const takenText = `${waterText(taken, 'm³')} prélevés`;
    const line = `${resource.name} : ${text} (${takenText}).`;
    limits.push({
      id: resource.id,
      name: resource.name,
      limitCubicMeters: limit.maxCubicMetersPerDay,
      takenCubicMeters: taken,
      remainingCubicMeters: remaining,
      takenPercent: fillPercent(taken, limit.maxCubicMetersPerDay),
      text,
      takenText,
      label: line,
      anchor: WATER_RESOURCES_ANCHOR,
    });
    lines.push(line);
  }
  return { kind: 'water', lines, empty: lines.length === 0 ? NO_WATER_TRACKED : null, reservoirs, limits };
}
