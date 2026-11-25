import { pageLabel, type IrrigationPageId } from '../features/pages.ts';
import type { TodayIrrigationLine } from './today-irrigations.ts';

/**
 * La carte à un bouton d'« Aujourd'hui » (simplification, lot S2,
 * docs/simplification-s2-contract.md, section 3) : pour chaque carte de
 * « Votre journée », son bouton principal, son lien d'appoint au plus et ses
 * « Autres choix », avec leurs mots. Le composant les dessine sans rien
 * décider. Chaque geste est une action serveur qui existe déjà : la
 * validation et le refus du planning, le démarrage d'« Arrosages » ; rien ne
 * se fait sans appui (D-028).
 *
 * PR 1 du lot : une proposition du plan (« Valider ») et une irrigation
 * planifiée à venir (« Démarrer »). Les irrigations en retard ou non faites
 * gardent leurs gestes jusqu'à la PR 3 : la fonction ne leur donne pas de
 * carte à un bouton (`null`).
 */

/** Ce que fait un choix de la carte : un geste existant, ou un lien vers une autre page. */
export type TodayCardGesture =
  | { kind: 'validate'; proposalId: string }
  | { kind: 'validate-and-start'; proposalId: string }
  | { kind: 'refuse'; proposalId: string; confirmation: TodayCardConfirmation }
  | { kind: 'start'; eventEquipmentId: string }
  | { kind: 'open'; page: IrrigationPageId; anchor: string };

/** La confirmation d'une ligne qui précède un geste qui ne se défait pas. */
export type TodayCardConfirmation = { title: string; text: string; confirmLabel: string; cancelLabel: string };

export type TodayCardChoice = {
  /** Le mot écrit : « Valider », « Démarrer »… */
  label: string;
  /** Le nom complet lu par un lecteur d'écran : « Démarrer : Goutte-à-goutte B · Réglage 1, 7 h ». */
  accessibleName: string;
  gesture: TodayCardGesture;
};

export type TodayCardActions = {
  /** Le geste qui fait avancer l'arrosage d'un cran : un seul par carte. */
  primary: TodayCardChoice;
  /** Un lien d'appoint sous le bouton, au plus. */
  secondary: TodayCardChoice | null;
  /** Le reste, rangé derrière « Autres choix » ; vide : pas de « Autres choix ». */
  others: TodayCardChoice[];
};

export const OTHER_CHOICES_LABEL = 'Autres choix';

/** « Pas à cette heure » se confirme : le plan cherche une autre place (D-030, S2-b). */
export const REFUSE_CONFIRMATION: TodayCardConfirmation = {
  title: 'Pas à cette heure ?',
  text: 'Le module cherchera une autre place pour cet arrosage.',
  confirmLabel: 'Chercher une autre place',
  cancelLabel: 'Garder la proposition',
};

function choice(line: TodayIrrigationLine, label: string, gesture: TodayCardGesture): TodayCardChoice {
  return { label, accessibleName: `${label} : ${line.title}, ${line.time}`, gesture };
}

/** « Modifier ou annuler sur « Arrosages » », ou « Ouvrir sur « Planning » » quand les arrosages ne sont pas cochés. */
function openLabel(page: IrrigationPageId): string {
  return page === 'arrosages' ? `Modifier ou annuler sur « ${pageLabel(page)} »` : `Ouvrir sur « ${pageLabel(page)} »`;
}

/**
 * Les gestes d'une carte de « Votre journée » (contrat, section 3, tableau) ;
 * `null` pour une carte dont la PR qui la change n'est pas encore venue.
 */
export function todayCardActions(line: TodayIrrigationLine): TodayCardActions | null {
  if (line.tone === 'proposed') {
    if (!line.proposalId) return null;
    const proposalId = line.proposalId;
    return {
      primary: choice(line, 'Valider', { kind: 'validate', proposalId }),
      secondary: choice(line, 'Démarrer tout de suite', { kind: 'validate-and-start', proposalId }),
      others: [
        // « Ajuster » reste le formulaire du planning, avec ses gardes (S2-d).
        choice(line, 'Changer l’heure ou la dose', { kind: 'open', page: line.open.page, anchor: line.open.anchor }),
        choice(line, 'Pas à cette heure', { kind: 'refuse', proposalId, confirmation: REFUSE_CONFIRMATION }),
      ],
    };
  }
  if (line.tone === 'planned') {
    if (!line.eventEquipmentId || !line.canStart) return null;
    return {
      primary: choice(line, 'Démarrer', { kind: 'start', eventEquipmentId: line.eventEquipmentId }),
      secondary: null,
      others: [choice(line, openLabel(line.open.page), { kind: 'open', page: line.open.page, anchor: line.open.anchor })],
    };
  }
  return null;
}

/** La réponse d'un geste de la carte, telle qu'elle s'écrit sous elle. */
export type TodayCardReply = {
  tone: 'notice' | 'error';
  text: string;
  /**
   * L'irrigation que le geste a créée ou démarrée : la réponse suit sa carte
   * (L4, règle 2). `null` : la réponse reste à l'endroit du geste.
   */
  eventEquipmentId: string | null;
};

/** Le résultat d'une validation, tel que le service le rend (`ProposalValidationResult`). */
export type TodayValidation =
  | { ok: true; eventEquipmentId: string; warning?: string }
  | { ok: false; message: string };

/** Le résultat d'un démarrage, tel que l'action le rend (`IrrigationEventActionResult`). */
export type TodayStart = { ok: true; message: string; warning?: string } | { ok: false; message: string };

function sentences(...parts: (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(' ');
}

/** « Valider » : la proposition devient une irrigation planifiée ; une réserve se dit à côté (contrat, section 5). */
export function validationReply(validation: TodayValidation): TodayCardReply {
  if (!validation.ok) return { tone: 'error', text: validation.message, eventEquipmentId: null };
  return { tone: 'notice', text: sentences('Validé : l’arrosage est planifié.', validation.warning), eventEquipmentId: validation.eventEquipmentId };
}

/**
 * « Démarrer tout de suite » : valider, puis démarrer (S2-c). Un démarrage
 * refusé après une validation réussie le dit sans détour ; rien n'est
 * annulé, l'arrosage reste planifié.
 */
export function validateAndStartReply(validation: TodayValidation, start: TodayStart | null): TodayCardReply {
  if (!validation.ok) return validationReply(validation);
  if (!start) return validationReply(validation);
  if (!start.ok) {
    return {
      tone: 'error',
      text: sentences(`Validé, mais pas démarré : ${withoutFinalStop(start.message)}. L’arrosage reste planifié.`, validation.warning),
      eventEquipmentId: validation.eventEquipmentId,
    };
  }
  return { tone: 'notice', text: sentences('Validé.', start.message, validation.warning, start.warning), eventEquipmentId: validation.eventEquipmentId };
}

/** « Pas à cette heure » : le refus du planning ; `false` quand la proposition avait déjà été décidée. */
export function refusalReply(refused: boolean): TodayCardReply {
  return refused
    ? { tone: 'notice', text: 'Heure refusée : le module cherche une autre place pour cet arrosage.', eventEquipmentId: null }
    : { tone: 'notice', text: 'Cette proposition avait déjà été décidée.', eventEquipmentId: null };
}

function withoutFinalStop(text: string): string {
  return text.trim().replace(/[.\s]+$/u, '');
}
