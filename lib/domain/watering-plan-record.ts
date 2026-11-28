import { clockText } from './clock-text.ts';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from './water-management.ts';
import { type AmountEntry, MISSING_BEDS, MISSING_WHERE, missingHowMuch, type StartButton } from './watering-now.ts';

/**
 * « Planifier » et « Déjà fait » sur le squelette d'« Arroser maintenant »
 * (simplification, lot S5, PR 2, docs/simplification-s5-contract.md,
 * sections 4, 5, 6 et 10 ; D-333). Des règles d'écran seulement : le même
 * « Où ? », le même « Plus d'options » ; seul le deuxième bloc et le bouton
 * changent. Aucune règle d'écriture, aucun calcul : les gardes du bouton sont
 * celles d'avant (début lisible pour « Planifier », point ouvert 46 ; dates
 * lisibles et dans l'ordre pour « Déjà fait », point ouvert 45).
 */

export type WateringTab = 'running' | 'planned' | 'completed';

/** Les noms des trois onglets (section 6, S5-a, S5-e) ; leur phrase de description ne se montre plus au téléphone. */
export const WATERING_TAB_LABELS: Record<WateringTab, string> = {
  running: 'Arroser maintenant',
  planned: 'Planifier',
  completed: 'Déjà fait',
};

/** Un bloc du formulaire : « Où ? », « Quand ? », « Combien de mm ? » (ou « Combien de temps ? », D-354), « De quand à quand ? ». */
export type WateringBlock = 'where' | 'when' | 'duration' | 'period';

/**
 * L'ordre des blocs, numérotés dans cet ordre (section 4) : « Planifier » ajoute
 * « Quand ? » avant « Combien de temps ? » ; « Déjà fait » met « De quand à
 * quand ? » avant « Où ? », parce que le matériel listé est celui qui était
 * posé à l'heure de début (règle 12), et n'a pas de « Combien de temps ? ».
 */
export function wateringBlocks(kind: WateringTab): readonly WateringBlock[] {
  if (kind === 'planned') return ['where', 'when', 'duration'];
  if (kind === 'completed') return ['period', 'where'];
  return ['where', 'duration'];
}

export const MISSING_START = 'Choisissez quand arroser.';
export const MISSING_PERIOD = 'Choisissez une fin après le début.';

const dayFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * Le jour d'un début planifié, à la ferme : « aujourd'hui », « demain », « le
 * vendredi 27 » dans la semaine qui vient et le même mois, « le mardi 1er
 * décembre » sinon (et pour un jour passé, qu'on peut planifier pour le
 * noter, P31).
 */
export function plannedDayText(start: Date, now: Date, timeZone = FARM_TIME_ZONE): string {
  const startKey = dateKeyInTimeZone(start, timeZone);
  const today = dateKeyInTimeZone(now, timeZone);
  if (startKey === today) return 'aujourd’hui';
  if (startKey === addDaysToDateKey(today, 1)) return 'demain';
  let format = dayFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone });
    dayFormats.set(timeZone, format);
  }
  const parts = Object.fromEntries(format.formatToParts(start).map((part) => [part.type, part.value]));
  const day = parts.day === '1' ? '1er' : parts.day;
  const close = startKey > today && startKey <= addDaysToDateKey(today, 6) && startKey.slice(0, 7) === today.slice(0, 7);
  return close ? `le ${parts.weekday} ${day}` : `le ${parts.weekday} ${day} ${parts.month}`;
}

/**
 * Le bouton de « Planifier » (section 4, section 6) : « Planifier · demain à
 * 6 h », lu « Planifier l'arrosage de Goutte nord, demain à 6 h ». Ce qui
 * manque se dit dans l'ordre des blocs : où, quand, combien (F1090).
 */
export function planButton({ equipmentName, start, durationSeconds, reachedBeds, now, entry = 'duration' }: {
  equipmentName: string | null;
  /** Le début tapé, `null` tant qu'il ne se lit pas. */
  start: Date | null;
  durationSeconds: number | null;
  reachedBeds: number;
  now: Date;
  /** La façon de dire « combien » : elle choisit les mots de ce qui manque (F1090). */
  entry?: AmountEntry;
}): StartButton {
  const startKnown = start !== null && Number.isFinite(start.getTime());
  const missing = equipmentName === null ? MISSING_WHERE
    : !startKnown ? MISSING_START
      : durationSeconds === null || !(durationSeconds > 0) ? missingHowMuch(entry)
        : reachedBeds === 0 ? MISSING_BEDS : null;
  const when = startKnown ? `${plannedDayText(start, now)} à ${clockText(start)}` : null;
  return {
    label: missing === null && when ? `Planifier · ${when}` : 'Planifier',
    accessibleName: equipmentName === null ? 'Planifier' : `Planifier l’arrosage de ${equipmentName}${missing === null && when ? `, ${when}` : ''}`,
    disabled: missing !== null,
    missing,
  };
}

/**
 * Le bouton de « Déjà fait » (section 4, section 6) : « Enregistrer cet
 * arrosage ». Les dates viennent avant « Où ? » (règle 12) : ce qui manque se
 * dit dans cet ordre. Un arrosage réel s'enregistre toujours, même au-delà
 * d'une restriction : rien de ce qui est signalé ne le bloque.
 */
export function recordButton({ equipmentName, durationSeconds, reachedBeds }: {
  equipmentName: string | null;
  /** La durée tirée des dates ; `null` tant qu'elles ne se lisent pas ou que la fin ne suit pas le début. */
  durationSeconds: number | null;
  reachedBeds: number;
}): StartButton {
  const missing = durationSeconds === null || !(durationSeconds > 0) ? MISSING_PERIOD
    : equipmentName === null ? MISSING_WHERE
      : reachedBeds === 0 ? MISSING_BEDS : null;
  return {
    label: 'Enregistrer cet arrosage',
    accessibleName: equipmentName === null ? 'Enregistrer cet arrosage' : `Enregistrer l’arrosage de ${equipmentName}`,
    disabled: missing !== null,
    missing,
  };
}

/**
 * Un matériel choisi qui n'était pas posé à l'heure de début de « Déjà fait »
 * (section 4, règle 12) : il n'est plus coché, et la phrase le dit.
 */
export function unplacedChoiceText(equipmentName: string): string {
  return `${equipmentName} n’était pas posé à cette heure de début : choisissez où vous avez arrosé.`;
}
