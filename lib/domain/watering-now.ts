import { clockText, countText, durationMinutesText } from './clock-text.ts';
import { millimetersNumber, volumeText } from './display-numbers.ts';
import type { EquipmentKind } from './irrigation-domain.ts';
import type { IrrigationCoverageResult } from './irrigation-coverage.ts';
import { EQUIPMENT_KIND_LABELS } from './planning/presentation.ts';
import { timeText } from './today/today-irrigations.ts';
import { farmDateKey } from './today/today-text.ts';
import { cubicMetersFromLiters, millisecondsFromMinutes, millisecondsFromSeconds, MINUTES_PER_HOUR, minutesFromSeconds } from './units.ts';

/**
 * « Arroser maintenant » en trois champs : où, combien de temps, démarrer
 * (simplification, lot S5, PR 1, docs/simplification-s5-contract.md,
 * sections 3 et 10 ; D-332, F894 à F901).
 *
 * Des règles d'écran seulement : la durée tirée d'une quantité, l'apport par
 * planche, le volume, la faisabilité hydraulique et la dose du jour sont les
 * fonctions existantes, que l'écran appelle telles quelles ; rien n'est
 * recalculé ici. Ce module dit quelles durées proposer, comment écrire le
 * résultat, ce que dit le bouton et ce qui reste au premier niveau.
 */

/** Le pas des boutons « − » et « + » (S5-h) : une durée plus fine se règle dans « Plus d'options ». */
const DURATION_STEP_MINUTES = 5;
/** Le plancher du réglage (S5-h). */
export const MINIMUM_DURATION_MINUTES = 5;
/** Le plafond : 744 h, celui des champs Heures et Minutes et de la validation serveur. */
export const MAXIMUM_DURATION_MINUTES = 744 * MINUTES_PER_HOUR;
/** Le premier « + » sur une durée qui n'est pas choisie (S5-i). */
export const FIRST_PLUS_MINUTES = 30;
/** Au-delà de six lignes, « Où ? » devient la liste déroulante groupée (S5-c). */
export const WHERE_RADIO_LIMIT = 6;

/** Les pastilles fixes (S5-h) ; « Conseillé » s'y ajoute avec une dose du jour. */
const FIXED_CHIPS = [
  { id: 'thirty', minutes: 30 },
  { id: 'hour', minutes: MINUTES_PER_HOUR },
] as const;

export type DurationChipId = (typeof FIXED_CHIPS)[number]['id'] | 'advised';

export type DurationChip = {
  id: DurationChipId;
  label: string;
  /** Les minutes d'une pastille fixe ; `null` pour « Conseillé », qui écrit une quantité en mm. */
  minutes: number | null;
};

/**
 * Les pastilles de durée (section 3.2) : « 30 min », « 1 h » et, quand le jour
 * a une dose pour ce matériel, « Conseillé : *durée* », la durée qui apporte
 * cette dose par le mode « Objectif en mm ». Sans dose, aucune pastille
 * « Conseillé » et rien à sa place.
 */
export function durationChips(advisedDurationSeconds: number | null): DurationChip[] {
  const fixed: DurationChip[] = FIXED_CHIPS.map((chip) => ({ id: chip.id, label: durationMinutesText(chip.minutes), minutes: chip.minutes }));
  if (advisedDurationSeconds === null || !(advisedDurationSeconds > 0)) return fixed;
  return [...fixed, { id: 'advised', label: `Conseillé : ${durationText(advisedDurationSeconds)}`, minutes: null }];
}

/** Ce que le formulaire porte, sans rien recalculer : le mode, la quantité et la durée tapées. */
export type DurationFormState = {
  mode: 'amount' | 'duration';
  /** La quantité en mm du mode « Objectif en mm », telle qu'elle est tapée. */
  targetMillimeters: string;
  /** Les minutes entières du mode « Durée d'irrigation ». */
  durationMinutes: number;
};

/** La pastille choisie, lue sur le formulaire ; `null` quand aucune ne correspond (une durée réglée au « + », une quantité tapée). */
export function chosenChip(state: DurationFormState, dose: number | null): DurationChipId | null {
  if (state.mode === 'amount') {
    return dose !== null && state.targetMillimeters !== '' && Number(state.targetMillimeters.replace(',', '.')) === dose ? 'advised' : null;
  }
  return FIXED_CHIPS.find((chip) => chip.minutes === state.durationMinutes)?.id ?? null;
}

/**
 * Le pas suivant du réglage (S5-h, S5-i) : de cinq en cinq minutes, sur la
 * grille de cinq minutes, entre le plancher et le plafond. Sur une durée non
 * choisie (`null`), « + » donne 30 min et « − » ne fait rien (`null`). Une
 * durée hors grille (« Conseillé : 1 h 23 ») rejoint la grille voisine.
 */
export function stepDuration(currentMinutes: number | null, direction: 1 | -1): number | null {
  if (currentMinutes === null || !(currentMinutes > 0)) return direction === 1 ? FIRST_PLUS_MINUTES : null;
  const onGrid = direction === 1
    ? Math.floor(currentMinutes / DURATION_STEP_MINUTES) * DURATION_STEP_MINUTES + DURATION_STEP_MINUTES
    : Math.ceil(currentMinutes / DURATION_STEP_MINUTES) * DURATION_STEP_MINUTES - DURATION_STEP_MINUTES;
  return Math.min(MAXIMUM_DURATION_MINUTES, Math.max(MINIMUM_DURATION_MINUTES, onGrid));
}

/** « − » est inactif sur une durée non choisie et au plancher ; « + », au plafond. */
export function stepAvailable(currentMinutes: number | null, direction: 1 | -1): boolean {
  if (currentMinutes === null || !(currentMinutes > 0)) return direction === 1;
  return direction === 1 ? currentMinutes < MAXIMUM_DURATION_MINUTES : currentMinutes > MINIMUM_DURATION_MINUTES;
}

/** « 1 h 20 », « 45 min » ; « — » pour une durée inconnue ou nulle, jamais une durée inventée (D-028). */
export function durationText(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  return durationMinutesText(Math.max(1, Math.round(minutesFromSeconds(seconds))));
}

/** Une durée en minutes, sur la grille du réglage ou non : `null` quand elle est inconnue ou nulle. */
export function durationMinutesOf(seconds: number | null): number | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.round(minutesFromSeconds(seconds));
}

/** « 1 h » ou « 1 h 20 » en heures et minutes entières, pour les champs du mode « Durée d'irrigation ». */
export function hoursAndMinutes(totalMinutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(totalMinutes / MINUTES_PER_HOUR), minutes: totalMinutes % MINUTES_PER_HOUR };
}

/**
 * La ligne de « Où ? » (section 3.1) : « Goutte-à-goutte · 3 planches », le
 * type du matériel et le nombre de planches que sa position enregistrée
 * atteint, lu sur la couverture de la ferme.
 */
export function whereRowDetail(kind: EquipmentKind, reachedBeds: number): string {
  return `${EQUIPMENT_KIND_LABELS[kind]} · ${countText(reachedBeds, 'planche')}`;
}

/** Le nombre de planches qu'un matériel atteint depuis sa position enregistrée, sur la couverture calculée. */
export function reachedBedCount(coverage: IrrigationCoverageResult, equipmentId: string): number {
  return coverage.beds.filter((bed) => bed.contributions.some((contribution) => contribution.equipmentId === equipmentId)).length;
}

/** Cases rondes jusqu'à six matériels utilisables ; au-delà, la liste déroulante groupée d'aujourd'hui (S5-c). */
export function whereListKind(usableCount: number): 'radios' | 'select' {
  return usableCount > WHERE_RADIO_LIMIT ? 'select' : 'radios';
}

/** Un seul matériel utilisable est choisi d'office (S5-b) ; avec plusieurs, rien (lot 3 de l'audit, point 6, cas 3). */
export function preselectedEquipmentId(usable: readonly { id: string }[]): string | null {
  return usable.length === 1 ? usable[0].id : null;
}

export type ResultSentence = {
  /** « 8 mm », « de 6 à 9 mm » ; `null` quand aucun apport ne se lit. */
  amount: string | null;
  /** « sur les 3 planches », « sur la planche », « selon les planches », « sur 2 planches » (les autres inconnues). */
  scope: string | null;
  /** « apport inconnu sur 2 planches » (D-003 : jamais zéro faute de donnée). */
  unknownBeds: string | null;
  /** « 470 L » ; `null` quand le volume est inconnu, dit par `UNKNOWN_VOLUME_TEXT`. */
  liters: string | null;
  /** « pris à « Bassin » », seulement quand l'origine de l'eau est connue. */
  origin: string | null;
  /** « Avec la pompe P1. » : un réglage qui s'applique se dit (S5-k). */
  pump: string | null;
};

/** Le volume inconnu se dit avec sa raison, comme dans l'ancien encart : jamais « 0 L ». */
export const UNKNOWN_VOLUME_TEXT = 'volume inconnu : passe-pied non renseigné';

/**
 * La phrase du résultat (section 3.3), à partir des chiffres que le
 * formulaire calcule déjà : l'apport de chaque planche atteinte, le volume
 * estimé, le nom de l'origine de l'eau et de la pompe réglées. Une seule
 * valeur quand toutes les planches reçoivent la même au dixième près, sinon
 * la fourchette (un asperseur n'arrose pas toutes ses planches pareil, S5-l).
 */
export function resultSentence({ amountsMm, volumeLiters, originName, pumpName }: {
  amountsMm: readonly (number | null)[];
  volumeLiters: number | null;
  originName: string | null;
  pumpName: string | null;
}): ResultSentence {
  const known = amountsMm.filter((amount): amount is number => amount !== null && Number.isFinite(amount));
  const unknownCount = amountsMm.length - known.length;
  const unknownBeds = unknownCount > 0 ? `apport inconnu sur ${countText(unknownCount, 'planche')}` : null;
  const pump = pumpName ? `Avec la pompe ${pumpName}.` : null;
  if (known.length === 0) return { amount: null, scope: null, unknownBeds, liters: null, origin: null, pump };
  const low = millimetersNumber(Math.min(...known));
  const high = millimetersNumber(Math.max(...known));
  const scope = low !== high ? 'selon les planches'
    : unknownCount > 0 ? `sur ${countText(known.length, 'planche')}`
      : amountsMm.length === 1 ? 'sur la planche' : `sur les ${amountsMm.length} planches`;
  const liters = volumeLiters === null ? null : volumeText(cubicMetersFromLiters(volumeLiters));
  return {
    amount: low === high ? `${low} mm` : `de ${low} à ${high} mm`,
    scope,
    unknownBeds,
    liters,
    origin: liters !== null && originName ? `pris à « ${originName} »` : null,
    pump,
  };
}

/** La phrase entière, telle qu'un lecteur d'écran et les tests la lisent ; `null` quand il n'y a rien à dire. */
export function resultSentenceText(sentence: ResultSentence): string | null {
  const water = [sentence.amount === null ? null : `${sentence.amount} ${sentence.scope}`, sentence.unknownBeds].filter(Boolean).join(', ');
  if (water === '') return sentence.pump;
  const volume = sentence.amount === null ? '' : sentence.liters === null ? `, ${UNKNOWN_VOLUME_TEXT}` : `, et ${sentence.liters}${sentence.origin ? ` ${sentence.origin}` : ''}`;
  return `Soit ${water}${volume}.${sentence.pump ? ` ${sentence.pump}` : ''}`;
}

/**
 * « 10 h 50 » : l'heure de fin, l'heure du formulaire plus la durée, à
 * l'heure de la ferme (S5-j) ; `null` sans durée.
 */
export function endClockText(now: Date, durationSeconds: number | null): string | null {
  if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  return clockText(new Date(now.getTime() + millisecondsFromSeconds(durationSeconds)));
}

/**
 * La fin estimée d'un arrosage en cours, sur sa carte d'« Arroser ou noter »
 * (budget de hauteur tenu, D-337, F984) : les mots de la carte
 * d'« Aujourd'hui » (« fin prévue à 13 h 50 »), l'heure seule le jour même,
 * le jour devant l'heure sinon (« ven. 27 nov. à 0 h 20 »). À l'heure de la ferme.
 */
export function runningEndText(endAt: string, now: Date): string {
  return timeText(endAt, farmDateKey(now));
}

export type StartButton = {
  /** « Démarrer · fin vers 10 h 50 », ou « Démarrer » tant qu'il manque quelque chose. */
  label: string;
  /** Le nom complet lu par un lecteur d'écran : « Démarrer l'arrosage de Goutte nord, fin vers 10 h 50 ». */
  accessibleName: string;
  disabled: boolean;
  /** La seule chose qui manque, dans l'ordre : où, puis combien de temps (S5-d). */
  missing: string | null;
};

export const MISSING_WHERE = 'Choisissez où arroser.';
export const MISSING_DURATION = 'Choisissez une durée.';
export const MISSING_BEDS = 'Ce matériel n’atteint aucune planche depuis sa position : vérifiez sa pose.';

/**
 * Le bouton (section 3.4) : il dit ce qu'il fait. Inactif aux mêmes
 * conditions qu'avant (aucun matériel, durée inconnue ou nulle, aucune
 * planche atteinte) ; la ligne dessous dit ce qui manque. « Vers », parce que
 * le minuteur démarre à l'appui, pas à l'ouverture de la page.
 */
export function startButton({ equipmentName, durationSeconds, reachedBeds, now }: {
  equipmentName: string | null;
  durationSeconds: number | null;
  reachedBeds: number;
  now: Date;
}): StartButton {
  const missing = equipmentName === null ? MISSING_WHERE
    : durationSeconds === null || !(durationSeconds > 0) ? MISSING_DURATION
      : reachedBeds === 0 ? MISSING_BEDS : null;
  const end = missing === null ? endClockText(now, durationSeconds) : null;
  return {
    label: end ? `Démarrer · fin vers ${end}` : 'Démarrer',
    accessibleName: equipmentName === null
      ? 'Démarrer'
      : `Démarrer l’arrosage de ${equipmentName}${end ? `, fin vers ${end}` : ''}`,
    disabled: missing !== null,
    missing,
  };
}

/** Le rythme auquel l'écran relit l'heure de fin du bouton : chaque minute (S5-j). */
export const END_CLOCK_REFRESH_MILLISECONDS = millisecondsFromMinutes(1);

/**
 * Ce qui reste au premier niveau (section 3.4) : des précautions, pas des
 * réglages. Le créneau protégé et une pompe dépassée se lisent toujours sous
 * la phrase du résultat ; les états « ok » et « inconnu » de la faisabilité
 * hydraulique, eux, se lisent dans « Plus d'options ».
 */
export function precautionLevel(precaution: { kind: 'protected-slot' } | { kind: 'hydraulic'; tone: 'exceeded' | 'ok' | 'unknown' }): 'first-level' | 'more-options' {
  if (precaution.kind === 'protected-slot') return 'first-level';
  return precaution.tone === 'exceeded' ? 'first-level' : 'more-options';
}

/** Le lien-pli de « Plus d'options », ce qu'il range dit dans son nom. */
export const MORE_OPTIONS_LABEL = 'Plus d’options (pompe, note, saisir en mm)';

/**
 * Le nom du pli selon l'onglet (section 4) : « Déjà fait » n'a ni saisie en
 * mm ni durée exacte, sa durée se lit des dates ; le pli ne range que la
 * pompe et la note.
 */
export function moreOptionsLabel(kind: 'running' | 'planned' | 'completed'): string {
  return kind === 'completed' ? 'Plus d’options (pompe, note)' : MORE_OPTIONS_LABEL;
}

/**
 * « Plus d'options » s'ouvre seul quand une valeur y est déjà posée par une
 * autre voie (section 3.4) : une pompe choisie qui n'est pas celle du
 * matériel, une note, la saisie en mm demandée. Fermé sinon.
 */
export function moreOptionsOpenAtFirst({ pumpChosen, pumpIsDefault, note, millimetersEntry }: {
  pumpChosen: boolean;
  pumpIsDefault: boolean;
  note: string;
  millimetersEntry: boolean;
}): boolean {
  return (pumpChosen && !pumpIsDefault) || note.trim() !== '' || millimetersEntry;
}
