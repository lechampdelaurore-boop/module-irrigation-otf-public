import { clockFromMinutes, countText, dateClockText } from '../clock-text.ts';
import { kcSourceLabel, monthsLabel, stageAnchorLabel } from '../crop-water/presentation.ts';
import type { KcSource, StageAnchor } from '../crop-water/reference.ts';
import { celsiusText } from '../crop-alerts/text.ts';
import { featureLabel, FEATURE_IDS } from '../features/catalogue.ts';
import { decimalText, mmText, percentText, rateText, waterText } from '../figure-origin.ts';
import { priorityLabel } from '../irrigation-feasibility.ts';
import { COLLECTIVE_DOSE_RULE_LABELS, EQUIPMENT_KIND_LABELS, SHORTAGE_STRATEGY_LABELS } from '../planning/presentation.ts';
import { WEEKDAY_LABELS } from '../planning/protected-slots-view.ts';
import { SOIL_TEXTURES, soilTextureLabel } from '../soil-reserve/texture.ts';
import { RESERVOIR_TYPE_LABELS, RESOURCE_TYPE_LABELS } from '../water-resource-labels.ts';
import { WEATHER_ALERT_FIELD_CHOICES } from '../weather/weather-alerts.ts';
import type { ChangeSubject } from './subjects.ts';

/**
 * Les mots du journal des modifications (amélioration n° 7, §5.5 ; D-288,
 * F722) : pour chaque champ qu'un écrivain garde, son nom à l'écran et
 * l'écriture de sa valeur, avec son unité. Une règle, un endroit : l'écran ne
 * fait qu'afficher ce que ces fonctions composent.
 *
 * Une valeur désignée par un identifiant d'Ouvre ta ferme (un jardin, une
 * planche, une culture) se lit par son nom quand l'instantané le connaît,
 * sinon par sa sorte (« une planche ») : jamais un identifiant à l'écran.
 */

/** Une valeur gardée : un nombre, un texte, un drapeau (0 ou 1), ou inconnue (`null`). */
type Value = string | number | boolean | null;

/** Le nom d'un lieu ou d'une culture d'Ouvre ta ferme, par son identifiant ; `null` s'il n'est pas connu. */
export type NameOf = (id: string) => string | null;

type Format = (value: Exclude<Value, null>, nameOf: NameOf) => string;

type FieldWords = {
  label: string;
  format: Format;
  /** Ce que dit une valeur vide ; « non renseigné » par défaut (D-003). */
  empty?: string;
};

const NOT_GIVEN = 'non renseigné';

// --- Les écritures ----------------------------------------------------------

const number = (value: Exclude<Value, null>): number => Number(value);
const text: Format = (value) => String(value);
const decimal: Format = (value) => decimalText(number(value));
const mm: Format = (value) => mmText(number(value));
const mmPerMeter: Format = (value) => `${decimalText(number(value))} mm/m`;
const cubicMeters: Format = (value) => `${decimalText(number(value))} m³`;
const cubicMetersPerDay: Format = (value) => `${decimalText(number(value))} m³ par jour`;
const cubicMetersPerHour: Format = (value) => waterText(number(value), 'm³/h');
const squareMeters: Format = (value) => `${decimalText(number(value))} m²`;
const meters: Format = (value) => `${decimalText(number(value))} m`;
const centimeters: Format = (value) => `${decimalText(number(value))} cm`;
const celsius: Format = (value) => celsiusText(number(value));
const signedCelsius: Format = (value) => celsiusText(number(value), true);
const wattsPerSquareMeter: Format = (value) => `${decimalText(number(value))} W/m²`;
const percent: Format = (value) => percentText(number(value));
/** Une part de 0 à 1, écrite en pourcentage. */
const share: Format = (value) => percentText(number(value) * 100);
const days: Format = (value) => countText(number(value), 'jour');
const minutes: Format = (value) => countText(number(value), 'minute');
const perDay: Format = (value) => `${decimalText(number(value))} par jour`;
const clock: Format = (value) => clockFromMinutes(number(value));
/** « 19:30 » : une heure d'horloge saisie. */
const timeOfDay: Format = (value) => {
  const [hour, minute] = String(value).split(':').map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute) ? clockFromMinutes(hour * 60 + minute) : String(value);
};
/** « 2026-06-01 » : un jour civil, écrit « 01/06/2026 ». */
export function dayKeyText(dateKey: string): string {
  const [year, month, date] = dateKey.split('-');
  return year && month && date ? `${date}/${month}/${year}` : dateKey;
}
const day: Format = (value) => dayKeyText(String(value));
const instant: Format = (value) => dateClockText(String(value));
const flag: Format = (value) => (value === true || Number(value) === 1 ? 'oui' : 'non');
const checked: Format = (value) => (value === true || Number(value) === 1 ? 'cochée' : 'non cochée');

function words(labels: Readonly<Record<string, string>>): Format {
  return (value) => labels[String(value)] ?? String(value);
}

/** Un lieu ou une culture d'Ouvre ta ferme : son nom, sinon sa sorte. */
function named(kind: string): Format {
  return (value, nameOf) => nameOf(String(value)) ?? kind;
}

/** Une liste gardée en texte JSON ; `null` si le texte n'en est pas une. */
function list(value: Exclude<Value, null>): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Le profil d'une aspersion, `[[distance, débit], …]` : « à 2 m, 8 mm/h ; à 4 m, 6 mm/h ». */
const profile: Format = (value) => {
  const points = list(value);
  if (points === null) return String(value);
  if (points.length === 0) return 'aucun point';
  return points.map((point) => (Array.isArray(point) ? `à ${decimalText(Number(point[0]))} m, ${rateText(Number(point[1]))}` : '?')).join(' ; ');
};

/** Les origines d'une pompe, `[[sorte, nom, par défaut], …]` : « Forage (par défaut) ; Cuve ». */
const origins: Format = (value) => {
  const items = list(value);
  if (items === null) return String(value);
  if (items.length === 0) return 'aucune';
  return items.map((item) => (Array.isArray(item) ? `${String(item[1])}${Number(item[2]) === 1 ? ' (par défaut)' : ''}` : '?')).join(' ; ');
};

/** Les stades d'un profil racinaire, `[[rang, profondeur, fin, jours], …]` : « 0,2 m ; puis 0,3 m à 0,5 m en 30 jours ». */
const stages: Format = (value) => {
  const items = list(value);
  if (items === null) return String(value);
  if (items.length === 0) return 'aucun stade';
  return items.map((item) => {
    if (!Array.isArray(item)) return '?';
    const [, depth, end, progression] = item.map((part) => (part === null ? null : Number(part)));
    const reach = end === null ? `${decimalText(depth ?? 0)} m` : `${decimalText(depth ?? 0)} m à ${decimalText(end)} m`;
    return progression === null ? reach : `${reach} en ${countText(progression, 'jour')}`;
  }).join(' ; ');
};

/** Les planches d'une pose, dans leur ordre : leurs noms. */
const beds: Format = (value, nameOf) => {
  const ids = list(value);
  if (ids === null) return String(value);
  if (ids.length === 0) return 'aucune planche';
  const names = ids.map((id) => nameOf(String(id)));
  return names.every((name) => name !== null) ? names.join(', ') : countText(ids.length, 'planche');
};

/** « 03-15 » : un jour de l'année, écrit « 15/03 ». */
function monthDayText(value: unknown): string {
  const [month, date] = String(value).split('-');
  return month && date ? `${date}/${month}` : String(value);
}

/** Les stades d'une culture de référence, `[[rang, libellé, Kc, début, estimé, mois], …]` : « Levée : Kc 0,4 dès le 15/03 ». */
const referenceStages: Format = (value) => {
  const items = list(value);
  if (items === null) return String(value);
  if (items.length === 0) return 'aucun stade';
  return items.map((item) => {
    if (!Array.isArray(item)) return '?';
    const [, label, kc, start, estimated, months] = item;
    const from = start === null ? '' : ` dès le ${monthDayText(start)}${Number(estimated) === 1 ? ' (estimé)' : ''}`;
    const installation = months === null ? '' : `, ${countText(Number(months), 'mois')} d’installation`;
    return `${String(label)} : Kc ${decimalText(Number(kc))}${from}${installation}`;
  }).join(' ; ');
};

/** Les jeux de saison, `[[jeu, début, développement, pleine saison, fin, [mois]], …]` : « mars à août : 20, 30, 40 et 20 jours ». */
const referenceSeasons: Format = (value) => {
  const items = list(value);
  if (items === null) return String(value);
  if (items.length === 0) return 'aucun';
  return items.map((item) => {
    if (!Array.isArray(item)) return '?';
    const [, initial, development, mid, late, months] = item;
    const label = monthsLabel(Array.isArray(months) ? months.map(Number) : []);
    if (initial === null) return label;
    return `${label} : ${[initial, development, mid].map((length) => decimalText(Number(length))).join(', ')} et ${countText(Number(late), 'jour')}`;
  }).join(' ; ');
};

/** Les débuts des stades, `[[jeu, rang, ancrage, durée, estimé], …]` : « jeu 1, stade 2 : 15 j après l'implantation ». */
const referenceStarts: Format = (value) => {
  const items = list(value);
  if (items === null) return String(value);
  if (items.length === 0) return 'aucun';
  return items.map((item) => {
    if (!Array.isArray(item)) return '?';
    const [set, rank, from, duration, estimated] = item;
    const anchor = (from === 'first-harvest' || from === 'mid-harvest' ? { from } : { from, days: Number(duration ?? 0) }) as StageAnchor;
    return `jeu ${String(set)}, stade ${String(rank)} : ${stageAnchorLabel(anchor)}${Number(estimated) === 1 ? ' (estimé)' : ''}`;
  }).join(' ; ');
};

/** Les jardins d'un groupe, dans leur ordre, `[[jardin, sens, écart], …]` : « Nord ; Sud, sens inversé, à 1,5 m ». */
const gardens: Format = (value, nameOf) => {
  const items = list(value);
  if (items === null) return String(value);
  if (items.length === 0) return 'aucun jardin';
  return items.map((item) => {
    if (!Array.isArray(item)) return '?';
    const [plotId, order, gap] = item;
    const parts = [nameOf(String(plotId)) ?? 'un jardin'];
    if (order === 'reversed') parts.push('sens inversé');
    if (Number(gap) > 0) parts.push(`à ${decimalText(Number(gap))} m du précédent`);
    return parts.join(', ');
  }).join(' ; ');
};

// --- Les champs -------------------------------------------------------------

const STATUS_WORDS = { active: 'en service', archived: 'rangé', inactive: 'hors service' } as const;
const LINK_MODE_WORDS = { automatic: 'automatique', manual: 'manuel' } as const;

/** Les champs que plusieurs sujets partagent, avec le même sens. */
const SHARED: Readonly<Record<string, FieldWords>> = {
  name: { label: 'Nom', format: text },
  label: { label: 'Libellé', format: text, empty: 'aucun' },
  note: { label: 'Note', format: text, empty: 'aucune' },
  notes: { label: 'Notes', format: text, empty: 'aucune' },
  source: { label: 'Source', format: text },
  status: { label: 'État', format: words(STATUS_WORDS) },
  active: { label: 'Actif', format: flag },
  enabled: { label: 'Activé', format: flag },
  effectiveFrom: { label: 'À partir du', format: day },
  validFrom: { label: 'À partir du', format: day },
  validUntil: { label: 'Jusqu’au', format: day, empty: 'sans fin' },
  maxCubicMetersPerDay: { label: 'Limite', format: cubicMetersPerDay, empty: 'aucune' },
  referenceNote: { label: 'Référence', format: text, empty: 'aucune' },
};

const KIND_WORDS = Object.fromEntries(Object.entries(EQUIPMENT_KIND_LABELS).map(([kind, label]) => [kind, label.toLowerCase()]));

/** Les réglages du planning, aplatis comme l'écrivain les garde (D-286, F719) : `dosesDripMaximumMm`. */
function planningFields(): Record<string, FieldWords> {
  const fields: Record<string, FieldWords> = {
    forecastRainShare: { label: 'Part de la pluie prévue déduite', format: share },
    waitForForecastRainAboveMm: { label: 'Attendre une pluie prévue de plus de', format: mm },
    shortageStrategy: { label: 'Conduite en pénurie', format: words(SHORTAGE_STRATEGY_LABELS) },
    carryOverDeficit: { label: 'Reporter le déficit sur la semaine suivante', format: flag },
    collectiveDoseRule: { label: 'Dose d’un matériel sur plusieurs planches', format: words(COLLECTIVE_DOSE_RULE_LABELS) },
    preferredKindWhenBoth: { label: 'Matériel d’abord quand deux arrosent une planche', format: words(KIND_WORDS) },
    commandingRateShare: { label: 'Part du débit qui commande l’arrosage', format: share },
    lateToleranceMinutes: { label: 'En retard après', format: minutes },
  };
  for (const [kind, kindLabel] of Object.entries(KIND_WORDS)) {
    const key = kind[0].toUpperCase() + kind.slice(1);
    fields[`doses${key}MinimumMm`] = { label: `Dose minimale, ${kindLabel}`, format: mm };
    fields[`doses${key}MaximumMm`] = { label: `Dose maximale, ${kindLabel}`, format: mm };
    fields[`doses${key}IrrigationsPerDay`] = { label: `Arrosages par jour au plus, ${kindLabel}`, format: perDay };
    fields[`doses${key}SpacingDays`] = { label: `Jours entre deux arrosages, ${kindLabel}`, format: days };
    fields[`windows${key}StartMinute`] = { label: `Début de la plage, ${kindLabel}`, format: clock };
    fields[`windows${key}EndMinute`] = { label: `Fin de la plage, ${kindLabel}`, format: clock };
  }
  return fields;
}

/** `alertes-meteo` → `alertesMeteo` : le champ d'une fonctionnalité, comme l'écrivain le nomme. */
function featureFields(): Record<string, FieldWords> {
  return Object.fromEntries(FEATURE_IDS.map((feature) => [
    feature.replaceAll(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
    { label: `Case « ${featureLabel(feature)} »`, format: checked },
  ]));
}

function slotFields(): Record<string, FieldWords> {
  const fields: Record<string, FieldWords> = {
    startMinute: { label: 'Début', format: clock },
    endMinute: { label: 'Fin', format: clock },
  };
  for (const [weekday, label] of Object.entries(WEEKDAY_LABELS)) {
    fields[weekday] = { label: label[0].toUpperCase() + label.slice(1), format: flag };
  }
  return fields;
}

const WEATHER_FIELD_WORDS = Object.fromEntries(WEATHER_ALERT_FIELD_CHOICES.map(({ field, label }) => [field, label]));
const TEXTURE_WORDS = Object.fromEntries(SOIL_TEXTURES.map((texture) => [texture, soilTextureLabel(texture)]));

/** Les champs propres à chaque sujet ; un champ absent d'ici est lu dans les champs partagés. */
const BY_SUBJECT: Readonly<Record<ChangeSubject, Readonly<Record<string, FieldWords>>>> = {
  'objectif-hydrique': { amountMm: { label: 'Objectif', format: mm } },
  'objectif-adopte': { amountMm: { label: 'Objectif', format: mm } },
  'seuil-de-besoin': { thresholdMm: { label: 'Seuil minimal', format: mm } },
  'decision-de-planche': {
    priority: { label: 'Priorité', format: (value) => priorityLabel(String(value) as Parameters<typeof priorityLabel>[0]) },
    manualOverrideMm: { label: 'Besoin forcé', format: mm, empty: 'aucun' },
    overrideReason: { label: 'Raison', format: text, empty: 'aucune' },
  },
  'reglages-du-planning': planningFields(),
  'creneau-protege': slotFields(),
  'limite-d-eau-du-jour': {},
  'limite-de-ressource': {},
  'sol-de-parcelle': {
    labRfuMmPerMeter: { label: 'RFU du laboratoire', format: mmPerMeter },
    stoneSharePercent: { label: 'Part de cailloux', format: percent },
    referenceShare: { label: 'Part de la réserve utile', format: share },
    provenance: { label: 'Provenance', format: words({ analysis: 'analyse', estimate: 'estimation', default: 'valeur de départ' }) },
    sampledDepthCm: { label: 'Profondeur de l’échantillon', format: centimeters },
    tewMm: { label: 'Eau évaporable (TEW)', format: mm },
    rewMm: { label: 'Eau facilement évaporable (REW)', format: mm },
    surfaceLayerCm: { label: 'Couche de surface (Ze)', format: centimeters },
    soilDepthCeilingM: { label: 'Profondeur de sol', format: meters, empty: 'aucune limite' },
    texture: { label: 'Texture', format: words(TEXTURE_WORDS), empty: 'non dite' },
  },
  'reglages-du-sol': {
    thresholdMode: { label: 'Seuil d’arrosage', format: words({ crop: 'selon la culture', farm: 'réglé par la ferme' }) },
    thresholdPercent: { label: 'Seuil de la ferme', format: percent, empty: 'aucun' },
    permeableTarpEvaporation: { label: 'Évaporation sous bâche perméable', format: share },
    mulchedEvaporation: { label: 'Évaporation sous paillage', format: share },
    greenManureEmergenceKc: { label: 'Kc d’un engrais vert, levée', format: decimal },
    greenManurePartialKc: { label: 'Kc d’un engrais vert, couverture partielle', format: decimal },
    greenManureFullKc: { label: 'Kc d’un engrais vert, couverture totale', format: decimal },
    grassKc: { label: 'Kc d’une planche enherbée', format: decimal },
    plasticMulchRainShare: { label: 'Pluie comptée sous paillage plastique', format: share },
    effectiveFrom: { label: 'À partir du', format: day, empty: 'le départ' },
  },
  'profil-racinaire': {
    p: { label: 'Fraction p', format: decimal, empty: 'celle de la culture' },
    stages: { label: 'Profondeurs des racines', format: stages },
  },
  'critere-meteo': {
    field: { label: 'Valeur suivie', format: words(WEATHER_FIELD_WORDS) },
    direction: { label: 'Sens', format: words({ above: 'au-dessus de', below: 'en dessous de' }) },
    threshold: { label: 'Seuil', format: decimal },
    horizonDays: { label: 'Horizon', format: days },
  },
  'alertes-de-culture': {
    frostActive: { label: 'Alerte de gel', format: flag },
    dryingActive: { label: 'Alerte de dessèchement', format: flag },
    sprinklerActive: { label: 'Aspersions à reconsidérer', format: flag },
    horizonDays: { label: 'Horizon du gel', format: days },
    frostOffsetCelsius: { label: 'Microclimat', format: signedCelsius },
    frostMarginSensitiveCelsius: { label: 'Marge d’une culture sensible', format: celsius },
    frostMarginHardyCelsius: { label: 'Marge d’une culture rustique', format: celsius },
    sprinklerMaxTemperatureCelsius: { label: 'Aspersion signalée sous une maximale de', format: celsius },
    sprinklerRadiationWattsPerSquareMeter: { label: 'Aspersion signalée sous un rayonnement de', format: wattsPerSquareMeter },
  },
  'seuil-de-gel': {
    commonKey: { label: 'Culture de référence', format: text, empty: 'aucune' },
    damageCelsius: { label: 'Dégâts à', format: celsius, empty: 'selon la culture de référence' },
  },
  'jours-de-sechage': { dryingDays: { label: 'Délai de séchage', format: days, empty: 'celui de départ' } },
  fonctionnalites: featureFields(),
  'message-du-matin': { enabled: { label: 'Message du matin', format: flag } },
  'rappel-du-soir': { enabled: { label: 'Rappel du soir', format: flag }, time: { label: 'Heure', format: timeOfDay } },
  'kc-corrige': { kc: { label: 'Kc de la ferme', format: decimal, empty: 'celui de la source' } },
  'culture-de-reference': {
    source: { label: 'Source des Kc', format: (value) => kcSourceLabel(String(value) as KcSource) },
    curveShape: { label: 'Forme des Kc', format: words({ trapezoid: 'trois Kc (FAO-56)', steps: 'un Kc par stade', calendar: 'au calendrier' }) },
    kcInitial: { label: 'Kc début', format: decimal, empty: 'aucun' },
    kcMid: { label: 'Kc pleine saison', format: decimal, empty: 'aucun' },
    kcEnd: { label: 'Kc fin', format: decimal, empty: 'aucun' },
    abatement: { label: 'Coefficient d’abattement', format: decimal, empty: 'aucun' },
    calendarEnd: { label: 'Fin du calendrier', format: (value) => monthDayText(value), empty: 'aucune' },
    emergenceSowingDays: { label: 'Levée après un semis', format: days },
    emergencePlantingDays: { label: 'Reprise après une plantation', format: days },
    sourceUrl: { label: 'Lien de la source', format: text, empty: 'aucun' },
    datesSource: { label: 'Source des dates', format: text, empty: 'aucune' },
    stages: { label: 'Stades', format: referenceStages },
    seasons: { label: 'Jeux de saison', format: referenceSeasons },
    starts: { label: 'Débuts des stades', format: referenceStarts },
  },
  'correspondance-d-espece': {
    targetKind: {
      label: 'Rattachement',
      format: words({ reference: 'une culture de référence', 'without-reference': 'sans référence Kc', 'surface-state': 'engrais vert : état de la surface du sol' }),
    },
    referenceCrop: { label: 'Culture de référence', format: text, empty: 'aucune' },
    analogy: { label: 'Par analogie', format: flag },
  },
  'k-abri': { factor: { label: 'K_abri', format: decimal } },
  'paillage-plastique': { plasticMulch: { label: 'Paillage plastique', format: flag } },
  'filet-d-ombrage': {
    rate: { label: 'Ombrage', format: share },
    placedOn: { label: 'Posé le', format: day },
    removedOn: { label: 'Retiré le', format: day, empty: 'toujours posé' },
  },
  'options-du-besoin': {
    smoothing: { label: 'Lissage des passages de stade', format: flag },
    shading: { label: 'Ombrage compté', format: flag },
  },
  'jardin-sous-abri': { sheltered: { label: 'Classement', format: words({ 1: 'sous abri', 0: 'plein champ' }) } },
  'groupe-de-jardins': { members: { label: 'Jardins', format: gardens } },
  'lieu-meteo': {
    locationMode: { label: 'Lieu', format: words({ otf: 'l’adresse de la ferme dans Ouvre ta ferme', custom: 'une commune choisie' }) },
    customCity: { label: 'Commune', format: text, empty: 'aucune' },
    customPostcode: { label: 'Code postal', format: text, empty: 'aucun' },
  },
  materiel: {
    kind: { label: 'Nature', format: words(KIND_WORDS) },
    mobility: { label: 'Installation', format: words({ fixed: 'fixe', mobile: 'mobile' }) },
  },
  'reglage-de-materiel': {
    rateMmPerHour: { label: 'Débit', format: (value) => rateText(number(value)), empty: 'aucun' },
    leftProfile: { label: 'Profil à gauche', format: profile },
    rightProfile: { label: 'Profil à droite', format: profile },
  },
  pompe: {
    maximumFlowCubicMetersPerHour: { label: 'Débit maximal', format: cubicMetersPerHour },
    origins: { label: 'Origines de l’eau', format: origins },
  },
  'pompe-par-defaut': { pump: { label: 'Pompe', format: text, empty: 'aucune' } },
  ressource: {
    type: { label: 'Nature', format: words(RESOURCE_TYPE_LABELS) },
    nominalFlowCubicMetersPerHour: { label: 'Débit', format: cubicMetersPerHour },
    availableFrom: { label: 'Disponible à partir du', format: day, empty: 'toujours' },
    availableUntil: { label: 'Disponible jusqu’au', format: day, empty: 'sans fin' },
  },
  reserve: {
    type: { label: 'Nature', format: words(RESERVOIR_TYPE_LABELS) },
    capacityCubicMeters: { label: 'Capacité', format: cubicMeters },
    minimumSafetyCubicMeters: { label: 'Réserve de sécurité', format: cubicMeters },
    exposedSurfaceSquareMeters: { label: 'Surface exposée', format: squareMeters },
    receivesRain: { label: 'Reçoit la pluie', format: flag },
    evaporationEnabled: { label: 'Évaporation comptée', format: flag },
    evaporationCoefficient: { label: 'Coefficient d’évaporation', format: decimal },
  },
  'liaison-ressource-reserve': {
    resource: { label: 'Ressource', format: text },
    reservoir: { label: 'Réserve', format: text },
    fillMode: { label: 'Remplissage', format: words(LINK_MODE_WORDS) },
  },
  'liaison-entre-reserves': {
    upstream: { label: 'Réserve source', format: text },
    downstream: { label: 'Réserve destinataire', format: text },
    transferMode: { label: 'Transfert', format: words(LINK_MODE_WORDS) },
  },
  'alimentation-par-defaut': {
    sourceKind: { label: 'Origine', format: words({ resource: 'une ressource', reservoir: 'une réserve' }), empty: 'aucune' },
    source: { label: 'Source', format: text, empty: 'aucune' },
  },
  pose: {
    setting: { label: 'Réglage', format: text },
    gardenGroup: { label: 'Groupe de jardins', format: text, empty: 'aucun' },
    zoneId: { label: 'Parcelle', format: named('une parcelle') },
    plotId: { label: 'Jardin', format: named('un jardin') },
    anchorType: { label: 'Placement', format: words({ bed_center: 'au milieu d’une planche', between_beds: 'entre deux planches' }) },
    anchorBedId: { label: 'Planche du milieu', format: named('une planche'), empty: 'aucune' },
    beforeBedId: { label: 'Planche d’un côté', format: named('une planche'), empty: 'aucune' },
    afterBedId: { label: 'Planche de l’autre côté', format: named('une planche'), empty: 'aucune' },
    placedAt: { label: 'Posé le', format: instant },
    removedAt: { label: 'Retiré le', format: instant, empty: 'en place' },
    beds: { label: 'Planches', format: beds },
  },
};

/** Les mots d'un champ d'un sujet ; `null` pour un champ que cette version ne connaît pas. */
export function changeFieldWords(subject: ChangeSubject, key: string): FieldWords | null {
  return BY_SUBJECT[subject][key] ?? SHARED[key] ?? null;
}

/** Une valeur écrite, avec son unité ; une valeur vide dit ce qu'elle veut dire pour ce champ. */
export function changeValueText(words: FieldWords, value: Value, nameOf: NameOf): string {
  return value === null ? (words.empty ?? NOT_GIVEN) : words.format(value, nameOf);
}
