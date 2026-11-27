import { waterText } from '../figure-origin.ts';
import type { FarmCardPage } from '../features/places.ts';
import type { FeatureSelection } from '../features/selection.ts';
import { equipmentKindsText } from '../onboarding/route.ts';
import { countText, farmDateKey } from '../today/today-text.ts';
import { reservoirStateText, type ReservoirState } from '../today/water.ts';
import { weekStartDateKey } from '../water-management.ts';

/**
 * Les lignes d'état des fiches de « Ma ferme » (simplification, lot S6,
 * PR 3, docs/simplification-s6-contract.md, section 7) : une fiche dit son
 * état en une ligne, à la place de la ligne fixe de S3, quand la donnée est
 * connue ; la ligne fixe revient quand elle est inconnue, indisponible ou
 * vide (jamais un « 0 » pour un inconnu, D-003). Chaque nombre est une
 * valeur que la page de la fiche montre déjà, sous son mot : « posé »,
 * « observé », « Vos cultures cette saison », « Active » ou « Inactive ».
 *
 * Rien n'est lu ici : les comptes viennent du service de la mise en route
 * (`lib/services/start-route.ts`), qui les lit une fois pour la carte et pour
 * les fiches (section 7.1 : une seule lecture, plusieurs phrases).
 */

export type FarmHomeCounts = {
  /** Les matériels actifs par sorte, comme l'inventaire, et ceux qui sont posés cette saison (`poseCounts`). */
  equipment: { drip: number; sprinkler: number; posed: number } | null;
  /** Les ressources et les réserves actives de la ferme, les deux listes de « Ressources et pompes ». */
  water: {
    resources: readonly { name: string; nominalFlowCubicMetersPerHour: number }[];
    reservoirs: readonly ReservoirState[];
  } | null;
  /**
   * Les cultures de la saison, celles du titre de « Besoin par culture » (`seasonCropCount`), et les espèces des
   * séries de la saison (`seasonSpecies`).
   */
  crops: { inUse: number; species: number } | null;
  /** Les parcelles de la saison (`parcelsWithoutSoil`) : celles sans sol, sur toutes. */
  soil: { withoutSoil: number; total: number } | null;
  /** Les alertes météo réglées de la ferme, et celles qui sont actives. */
  weatherAlerts: { total: number; active: number } | null;
  /** La commune de la météo (`weatherLocationQuery`), `null` sans commune ; et si elle est confirmée. */
  weather: { city: string | null; confirmed: boolean } | null;
};

/** Le texte des lignes d'état, une fiche à la fois ; absente, la fiche garde sa ligne fixe. */
export type FarmCardLines = Partial<Record<FarmCardPage, string>>;

/** « 4 goutte-à-goutte, tous posés », « 4 goutte-à-goutte, 1 pas posé », « 2 goutte-à-goutte, aucun posé ». */
function equipmentLine(count: NonNullable<FarmHomeCounts['equipment']>): string | null {
  const active = count.drip + count.sprinkler;
  if (active === 0) return null;
  const notPosed = Math.max(0, active - count.posed);
  const state = notPosed === 0 ? (active === 1 ? 'posé' : 'tous posés')
    : notPosed === active ? (active === 1 ? 'pas posé' : 'aucun posé')
      : `${notPosed} pas posé${notPosed > 1 ? 's' : ''}`;
  return `${equipmentKindsText(count.drip, count.sprinkler)}, ${state}`;
}

/** Une réserve est observée cette semaine quand son volume a été relevé depuis le lundi (D-004). */
function observedThisWeek(reservoir: ReservoirState, now: Date): boolean {
  return reservoir.currentVolumeCubicMeters !== null && reservoir.currentVolumeObservedAt !== null
    && farmDateKey(reservoir.currentVolumeObservedAt) >= weekStartDateKey(now);
}

/**
 * Une seule ressource : son nom et son débit ; une seule réserve : la phrase
 * du bloc « Eau disponible » (« Bassin : 30 m³ sur 40 m³, observé
 * aujourd’hui ») ; plusieurs : leur nombre, et les réserves observées cette
 * semaine. Les volumes ne s'additionnent jamais d'une réserve à l'autre
 * dans la ligne (section 7.2).
 */
function waterLine(water: NonNullable<FarmHomeCounts['water']>, now: Date): string | null {
  const resources = water.resources.length;
  const reservoirs = water.reservoirs.length;
  if (resources + reservoirs === 0) return null;
  if (resources + reservoirs === 1) {
    if (reservoirs === 1) return reservoirStateText(water.reservoirs[0], now);
    const resource = water.resources[0];
    return `${resource.name} : débit de ${waterText(resource.nominalFlowCubicMetersPerHour, 'm³/h')}`;
  }
  const counted = [
    ...(resources > 0 ? [countText(resources, 'ressource', 'ressources')] : []),
    ...(reservoirs > 0 ? [countText(reservoirs, 'réserve', 'réserves')] : []),
  ].join(' et ');
  if (reservoirs === 0) return counted;
  const observed = water.reservoirs.filter((reservoir) => observedThisWeek(reservoir, now)).length;
  const state = reservoirs === 1
    ? (observed === 1 ? 'observée cette semaine' : 'pas observée cette semaine')
    : observed === reservoirs ? 'toutes observées cette semaine'
      : observed === 0 ? 'aucune observée cette semaine'
        : `${observed} observée${observed > 1 ? 's' : ''} cette semaine`;
  return `${counted}, ${state}`;
}

/**
 * « 4 cultures cette saison », le titre de la page (« Vos cultures cette
 * saison (4) ») ; « Aucune culture ne sert à vos séries cette saison », sa
 * phrase, quand des espèces sont plantées mais qu'aucune n'est rattachée. Les
 * espèces à rattacher se comptent dans Réglages, où elles se rattachent : la
 * marque « À faire » de la fiche « Réglages » le dit, pas cette ligne.
 */
function cropsLine(crops: NonNullable<FarmHomeCounts['crops']>): string | null {
  if (crops.species === 0) return null;
  if (crops.inUse === 0) return 'Aucune culture ne sert à vos séries cette saison';
  return `${countText(crops.inUse, 'culture', 'cultures')} cette saison`;
}

/** « Sol connu pour 6 parcelles sur 6 », « À renseigner pour 3 parcelles ». */
function soilLine(soil: NonNullable<FarmHomeCounts['soil']>): string | null {
  if (soil.total === 0) return null;
  if (soil.withoutSoil === 0) return `Sol connu pour ${countText(soil.total, 'parcelle', 'parcelles')} sur ${soil.total}`;
  return `À renseigner pour ${countText(soil.withoutSoil, 'parcelle', 'parcelles')}`;
}

/** « 2 alertes réglées », « 2 alertes réglées, 1 inactive », « Aucune alerte réglée ». */
function weatherAlertsLine(alerts: NonNullable<FarmHomeCounts['weatherAlerts']>): string {
  if (alerts.total === 0) return 'Aucune alerte réglée';
  const set = countText(alerts.total, 'alerte réglée', 'alertes réglées');
  const inactive = alerts.total - alerts.active;
  return inactive === 0 ? set : `${set}, ${inactive} inactive${inactive > 1 ? 's' : ''}`;
}

/**
 * « Météo de Nantes · 11 fonctionnalités cochées » ; « Commune à confirmer ·
 * 3 fonctionnalités cochées » tant que l'accueil attend la commune et qu'une
 * case lit la météo (la marque « À faire : commune de la ferme » le dit
 * aussi ; « de la météo » ôté : deux lignes au plus à 320 px, mesuré).
 * Les messages du téléphone n'y sont pas : leur autorisation vit dans le
 * navigateur (S6-g).
 */
function settingsLine(weather: NonNullable<FarmHomeCounts['weather']>, enabled: FeatureSelection, usesWeather: boolean): string | null {
  const features = countText(enabled.length, 'fonctionnalité cochée', 'fonctionnalités cochées');
  if (weather.city !== null) return `Météo de ${weather.city} · ${features}`;
  if (!weather.confirmed) return usesWeather ? `Commune à confirmer · ${features}` : features.charAt(0).toUpperCase() + features.slice(1);
  // Une commune confirmée mais introuvable (siège vide) : la ligne fixe reste.
  return null;
}

/**
 * Les lignes d'état d'une ferme (section 7.2), pour les fiches qui en ont
 * une. « Alertes cultures » garde sa ligne fixe : le gel suivi demande le
 * calcul de la page (espèces de la saison, jeu commun, liens de gel), hors
 * du budget de la page (section 7.2, « repli gardé »).
 */
export function farmCardLines(input: {
  enabled: FeatureSelection;
  usesWeather: boolean;
  counts: FarmHomeCounts;
  now: Date;
}): FarmCardLines {
  const { counts, now } = input;
  const lines: FarmCardLines = {};
  const set = (page: FarmCardPage, line: string | null) => {
    if (line !== null) lines[page] = line;
  };
  if (counts.equipment) set('materiel', equipmentLine(counts.equipment));
  if (counts.water) set('ressources', waterLine(counts.water, now));
  if (counts.crops) set('cultures', cropsLine(counts.crops));
  if (counts.soil) set('sol', soilLine(counts.soil));
  if (counts.weatherAlerts) set('alertes-meteo', weatherAlertsLine(counts.weatherAlerts));
  if (counts.weather) set('reglages', settingsLine(counts.weather, input.enabled, input.usesWeather));
  return lines;
}
