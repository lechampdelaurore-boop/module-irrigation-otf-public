import { countText, dateClockText } from '../clock-text.ts';
import { FAO_POINTS } from '../crop-water/settings-view.ts';
import type { IrrigationSnapshot } from '../domain.ts';
import type { ChangeJournalEntry, ChangeValues } from './entry.ts';
import { changeFieldWords, changeValueText, dayKeyText, type NameOf } from './fields.ts';
import { changeSubjectLabel, type ChangeAction, type ChangeFamily } from './subjects.ts';

/**
 * Une ligne du journal des modifications, telle que l'écran la montre
 * (amélioration n° 7, §5.2 et §5.5 ; D-288, F722) : quand, qui, ce qui a
 * changé et sur quel objet, puis l'avant et l'après de chaque champ changé,
 * avec leur unité. Composée ici, une fois ; l'écran ne fait que l'afficher.
 */

/** Un champ de la carte : « Objectif : 30 mm → 35 mm ». */
type ChangeJournalCardLine = { label: string; text: string };

export type ChangeJournalCard = {
  id: string;
  family: ChangeFamily;
  /** L'instant du changement (UTC). */
  at: string;
  /** « 21/11/2026 à 14 h 12 », à l'heure de la ferme (D-004). */
  when: string;
  /** « Vous » ou « Une autre personne connectée » : jamais une adresse (F708). */
  who: string;
  /** Le sujet : « Objectif hydrique ». */
  subject: string;
  /** « Création », « Modification » ou « Suppression ». */
  action: string;
  /** L'objet touché, par son nom ou son repère : « Rampe nord », « semaine du 16/11/2026, planche B1 ». */
  object: string | null;
  lines: ChangeJournalCardLine[];
};

export const CHANGE_AUTHOR_SELF = 'Vous';
export const CHANGE_AUTHOR_OTHER = 'Une autre personne connectée';

const ACTION_WORDS: Readonly<Record<ChangeAction, string>> = { cree: 'Création', modifie: 'Modification', supprime: 'Suppression' };

/** La carte d'une ligne, pour la personne qui la lit. */
export function changeJournalCard(entry: ChangeJournalEntry, reader: { viewerUserId: string; nameOf: NameOf }): ChangeJournalCard {
  return {
    id: entry.id,
    family: entry.family,
    at: entry.createdAt,
    when: dateClockText(entry.createdAt),
    who: entry.actorUserId === reader.viewerUserId ? CHANGE_AUTHOR_SELF : CHANGE_AUTHOR_OTHER,
    subject: changeSubjectLabel(entry.subject),
    action: ACTION_WORDS[entry.action],
    object: objectText(entry.context, reader.nameOf),
    lines: cardLines(entry, reader.nameOf),
  };
}

/**
 * Les champs : une modification dit l'avant et l'après de chaque champ
 * changé ; une création, ce qui a été créé ; une suppression, ce qui a été
 * supprimé. Un champ que cette version ne sait pas lire est compté, jamais
 * tu ni montré par son code.
 */
function cardLines(entry: ChangeJournalEntry, nameOf: NameOf): ChangeJournalCardLine[] {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const keys = [...new Set([...Object.keys(after), ...Object.keys(before)])];
  const lines: ChangeJournalCardLine[] = [];
  let unknown = 0;
  for (const key of keys) {
    const words = changeFieldWords(entry.subject, key);
    if (words === null) {
      unknown += 1;
      continue;
    }
    const valueOf = (values: ChangeValues) => changeValueText(words, values[key] ?? null, nameOf);
    const text = entry.action === 'modifie' ? `${valueOf(before)} → ${valueOf(after)}` : valueOf(entry.action === 'cree' ? after : before);
    lines.push({ label: words.label, text });
  }
  if (unknown > 0) lines.push({ label: 'Autres champs', text: `${countText(unknown, 'champ')} que cette version ne sait pas lire` });
  return lines;
}

/**
 * L'objet touché, d'après le repère gardé avec la ligne : son nom (un
 * matériel, une ressource, un créneau), sa semaine et son lieu (un objectif),
 * sa culture (un seuil de gel). Un lieu ou une culture d'Ouvre ta ferme se lit
 * par son nom quand l'instantané le connaît.
 */
function objectText(context: ChangeValues, nameOf: NameOf): string | null {
  const textOf = (key: string): string | null => (typeof context[key] === 'string' ? (context[key] as string) : null);
  /** « Planche · B1 », comme le choix d'un objectif ; sans nom connu, la sorte seule. */
  const named = (key: string, prefix: string, kind: string): string | null => {
    const id = textOf(key);
    if (id === null) return null;
    const name = nameOf(id);
    return name === null ? kind : `${prefix} · ${name}`;
  };
  const parts: string[] = [];
  const equipment = textOf('equipment');
  const name = textOf('name') ?? textOf('label');
  if (equipment !== null) parts.push(name === null ? equipment : `${equipment} › ${name}`);
  else if (name !== null) parts.push(name);
  // Le Kc corrigé d'une culture de référence : l'un des trois Kc de la FAO, ou un stade par son rang (D-289).
  const faoPoint = FAO_POINTS.find((point) => point.fao === textOf('faoPoint'));
  if (faoPoint !== undefined) parts.push(faoPoint.label);
  else if (typeof context.stageRank === 'number') parts.push(`stade ${context.stageRank}`);
  const weekStart = textOf('weekStart');
  if (weekStart !== null) parts.push(`semaine du ${dayKeyText(weekStart)}`);
  else if (context.season !== undefined && context.season !== null) parts.push(`saison ${String(context.season)}`);
  const place = named('bedId', 'Planche', 'une planche') ?? named('plotId', 'Jardin / abri', 'un jardin') ?? named('zoneId', 'Parcelle', 'une parcelle');
  if (place !== null) parts.push(place);
  else if (textOf('scopeType') === 'farm') parts.push('toute la ferme');
  const crop = named('seriesId', 'Série', 'une série') ?? named('plantId', 'Culture', 'une culture');
  if (crop !== null) parts.push(crop);
  const copiedFrom = textOf('copiedFrom');
  if (copiedFrom !== null) parts.push(`copie de ${copiedFrom}`);
  if (textOf('origin') === 'debit-mesure') parts.push('débit mesuré');
  return parts.length === 0 ? null : parts.join(', ');
}

/**
 * Les noms d'Ouvre ta ferme que la carte peut lire, d'après l'instantané :
 * parcelles, jardins, planches, séries et cultures. Sans instantané, aucun.
 */
export function snapshotNames(snapshot: IrrigationSnapshot | null): NameOf {
  const names = new Map<string, string>();
  if (snapshot !== null) {
    for (const place of [...snapshot.zones, ...snapshot.plots, ...snapshot.beds]) names.set(place.id, place.name);
    for (const series of snapshot.cropPlan?.series ?? []) {
      names.set(series.id, series.name);
      for (const cultivation of series.cultivations) names.set(cultivation.plantId, cultivation.plantName);
    }
  }
  return (id) => names.get(id) ?? null;
}
