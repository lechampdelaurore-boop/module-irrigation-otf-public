import type { ChangeJournalEntry } from '../../lib/domain/change-journal/entry';
import { changeFieldWords } from '../../lib/domain/change-journal/fields';

/**
 * Les champs écrits au journal des modifications que l'écran ne saurait pas
 * dire (amélioration n° 7, D-288, F722) : « sujet.champ ». Les essais des
 * écrivains (PR 5 et 6) relisent chaque ligne qu'ils écrivent : un champ
 * nouveau sans ses mots les fait échouer.
 */
export function fieldsWithoutWords(entries: readonly ChangeJournalEntry[]): string[] {
  return [...new Set(entries.flatMap((entry) => [...Object.keys(entry.before ?? {}), ...Object.keys(entry.after ?? {})]
    .filter((key) => changeFieldWords(entry.subject, key) === null)
    .map((key) => `${entry.subject}.${key}`)))];
}
