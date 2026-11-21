import { isChangeFamily, isChangeSubject, type ChangeAction, type ChangeFamily, type ChangeSubject } from './subjects.ts';

/**
 * Une ligne du journal des modifications, telle que la base la rend
 * (amélioration n° 7, §5.2 ; D-285) : l'avant et l'après ne portent que les
 * champs qui ont changé ; l'avant manque à une création, l'après à une
 * suppression.
 */

/** Une valeur gardée : un nombre, un texte, un drapeau (0 ou 1), ou inconnue (`null`, D-003). */
type ChangeValue = string | number | boolean | null;

export type ChangeValues = Readonly<Record<string, ChangeValue>>;

export type ChangeJournalEntry = {
  id: string;
  family: ChangeFamily;
  subject: ChangeSubject;
  objectId: string | null;
  /** Le repère de l'objet au moment du changement : son nom, sa planche, sa semaine. */
  context: ChangeValues;
  action: ChangeAction;
  before: ChangeValues | null;
  after: ChangeValues | null;
  actorUserId: string;
  createdAt: string;
  /** L'ordre d'écriture, qui départage deux lignes du même instant (docs/revision-order-contract.md). */
  sequence: number;
};

/** Où reprendre la lecture : la dernière ligne lue (« Voir plus »). */
export type ChangeJournalCursor = { createdAt: string; sequence: number };

/** Les lignes lues d'un coup ; « Voir plus » en relit autant (§5.5). */
export const CHANGE_JOURNAL_PAGE_SIZE = 50;

/**
 * Les valeurs gardées en JSON, lues sans jamais lever : un objet de valeurs
 * simples, sinon rien. Une valeur composée (liste, objet) est gardée en
 * texte JSON, telle quelle.
 */
export function parseChangeValues(json: string | null): ChangeValues | null {
  if (json === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, simpleValue(value)]));
}

function simpleValue(value: unknown): ChangeValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
}

/** La famille et le sujet d'une ligne, s'ils sont connus de cette version ; sinon la ligne n'est pas montrée. */
export function knownFamilyAndSubject(family: string, subject: string): { family: ChangeFamily; subject: ChangeSubject } | null {
  return isChangeFamily(family) && isChangeSubject(subject) ? { family, subject } : null;
}
