import { pageLabel, type IrrigationPageId } from '../features/pages.ts';
import { remainingTimerSeconds } from '../irrigation-timer.ts';
import { MINUTES_PER_HOUR, SECONDS_PER_HOUR } from '../units.ts';
import type { TodayNowLine } from './now-irrigations.ts';
import { addDaysToDateKey } from '../water-management.ts';
import { durationText, type TodayIrrigationLine } from './today-irrigations.ts';
import { shortDayText } from './today-text.ts';

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
 * planifiée à venir (« Démarrer »). PR 2 : ce qui coule ou attend d'être
 * repris (« Terminer », « Reprendre », « Mettre en pause », « Reprendre ce qui
 * reste »), par la fenêtre de fin et les actions d'« Arrosages ». PR 3 :
 * l'arrosage à rattraper, en retard ou non fait, où la carte pose la
 * question au lieu de deviner : « Je le fais maintenant » et « C'est fait »,
 * de même taille, « Ne pas le faire » rangé (contrat, section 4).
 */

/** Ce que fait un choix de la carte : un geste existant, ou un lien vers une autre page. */
export type TodayCardGesture =
  | { kind: 'validate'; proposalId: string }
  | { kind: 'validate-and-start'; proposalId: string }
  | { kind: 'refuse'; proposalId: string; confirmation: TodayCardConfirmation }
  | { kind: 'start'; eventEquipmentId: string }
  | { kind: 'pause'; eventEquipmentId: string }
  | { kind: 'resume'; eventEquipmentId: string }
  /**
   * « Terminer » ouvre la fenêtre de fin d'« Arrosages » : la vanne à
   * vérifier, l'heure réelle à confirmer, pré-remplie à l'heure de la pause
   * ou, `null`, à maintenant (contrat, section 6).
   */
  | { kind: 'finish'; eventEquipmentId: string; equipmentName: string; suggestedEndAt: string | null }
  /**
   * « C'est fait » : l'enregistrement « tel que prévu » de « Fait comme
   * prévu » et « Tout est fait », après sa confirmation (D-006, T15) ;
   * `otherwise` : où noter un arrosage fait autrement, quand « Arrosages »
   * est cochée.
   */
  | { kind: 'done-as-planned'; eventEquipmentId: string; confirmation: string; otherwise: { page: IrrigationPageId; anchor: string } | null }
  /** « Ne pas le faire » : l'annulation d'« Arrosages », après une confirmation d'une ligne. */
  | { kind: 'cancel'; eventEquipmentId: string; confirmation: TodayCardConfirmation }
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
  /**
   * Le second geste a la taille du premier : le seul cas est l'arrosage à
   * rattraper, où le module ne sait pas lequel est vrai (contrat, section 4,
   * S2-a). Absent : un lien d'appoint.
   */
  twin?: true;
  /** Le reste, rangé derrière « Autres choix » ; vide : pas de « Autres choix ». */
  others: TodayCardChoice[];
};

export const OTHER_CHOICES_LABEL = 'Autres choix';

/** « Ne pas le faire » se confirme : une annulation ne se défait pas, et le plan se recalcule (contrat, section 4). */
export const CANCEL_CONFIRMATION: TodayCardConfirmation = {
  title: 'Ne pas le faire ?',
  text: 'Cet arrosage ne sera pas fait. Le module recalcule la semaine.',
  confirmLabel: 'Ne pas le faire',
  cancelLabel: 'Le garder',
};

/** La ligne que la confirmation de « C'est fait » gagne, avec son lien vers « Arrosages » (contrat, section 4). */
export const DONE_OTHERWISE = { text: 'Fait autrement (une autre durée, un autre moment) ?', link: 'Notez-le sur « Arrosages »' };

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

function nowChoice(line: TodayNowLine, label: string, gesture: TodayCardGesture): TodayCardChoice {
  return { label, accessibleName: `${label} : ${line.title}`, gesture };
}

/** « Modifier ou annuler sur « Arrosages » », ou « Ouvrir sur « Planning » » quand les arrosages ne sont pas cochés. */
function openLabel(page: IrrigationPageId): string {
  return page === 'arrosages' ? `Modifier ou annuler sur « ${pageLabel(page)} »` : `Ouvrir sur « ${pageLabel(page)} »`;
}

/**
 * Les gestes d'une carte de « Votre journée » (contrat, section 3, tableau) ;
 * `null` pour une carte dont la PR qui la change n'est pas encore venue.
 */
export function todayCardActions(line: TodayIrrigationLine, options: {
  /**
   * La confirmation de « C'est fait », quand la règle de `doneAsPlanned`
   * accepte l'irrigation (heure de fin prévue passée, T15) ; `null` : pas
   * de « C'est fait ».
   */
  doneAsPlanned?: string | null;
} = {}): TodayCardActions | null {
  if (line.tone === 'missed' || line.tone === 'late') {
    if (!line.eventEquipmentId) return null;
    const id = line.eventEquipmentId;
    const confirmation = options.doneAsPlanned ?? null;
    const open = choice(line, `Ouvrir sur « ${pageLabel(line.open.page)} »`, { kind: 'open', page: line.open.page, anchor: line.open.anchor });
    return {
      // « Je le fais maintenant » n'écrit rien que le chrono ne tienne : c'est le principal (section 4).
      primary: choice(line, 'Je le fais maintenant', { kind: 'start', eventEquipmentId: id }),
      secondary: confirmation === null ? null : choice(line, 'C’est fait', {
        kind: 'done-as-planned',
        eventEquipmentId: id,
        confirmation,
        otherwise: line.open.page === 'arrosages' ? { page: line.open.page, anchor: line.open.anchor } : null,
      }),
      ...(confirmation === null ? {} : { twin: true as const }),
      others: [choice(line, 'Ne pas le faire', { kind: 'cancel', eventEquipmentId: id, confirmation: CANCEL_CONFIRMATION }), open],
    };
  }
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

/**
 * La phrase d'un arrosage à rattraper, qui dit le jour et pose la question
 * (contrat, section 4) : « Prévu à 7 h, pas encore démarré. » pour un
 * créneau en cours ; « Prévu hier à 7 h. L’avez-vous fait ? » pour un
 * créneau passé, « avant-hier », ou le jour (« mer. 11 nov. »). `null` pour
 * une autre carte.
 */
export function lateQuestion(line: TodayIrrigationLine, today: string): string | null {
  if (line.tone !== 'missed' && line.tone !== 'late') return null;
  const day = line.day === today
    ? null
    : line.day === addDaysToDateKey(today, -1)
      ? 'hier'
      : line.day === addDaysToDateKey(today, -2) ? 'avant-hier' : shortDayText(line.day);
  const when = `${day ? `${day} ` : ''}à ${line.hour}`;
  return line.tone === 'late' ? `Prévu ${when}, pas encore démarré.` : `Prévu ${when}. L’avez-vous fait ?`;
}

/**
 * Les gestes d'une carte de ce qui coule ou attend d'être repris (contrat,
 * section 3, tableau ; section 6) : « Terminer » quand l'arrosage coule ou a
 * atteint sa durée, « Reprendre » en pause, avec « Terminer » en lien
 * d'appoint, « Reprendre ce qui reste » pour le reste d'un arrosage arrêté
 * (le mot de S1, F836). La pause est rangée dans « Autres choix » (S2-i) ;
 * l'abandon de ce qui reste et tout le reste se font sur « Arrosages ».
 */
export function todayNowActions(line: TodayNowLine): TodayCardActions {
  const id = line.eventEquipmentId;
  const open = nowChoice(line, `Ouvrir sur « ${pageLabel(line.open.page)} »`, { kind: 'open', page: line.open.page, anchor: line.open.anchor });
  const finish = nowChoice(line, 'Terminer', { kind: 'finish', eventEquipmentId: id, equipmentName: line.equipmentName, suggestedEndAt: line.suggestedEndAt });
  switch (line.tone) {
    case 'running':
      return { primary: finish, secondary: null, others: [nowChoice(line, 'Mettre en pause', { kind: 'pause', eventEquipmentId: id }), open] };
    case 'paused':
      return { primary: nowChoice(line, 'Reprendre', { kind: 'resume', eventEquipmentId: id }), secondary: finish, others: [open] };
    case 'finished':
      return { primary: finish, secondary: null, others: [open] };
    case 'remainder':
      return { primary: nowChoice(line, 'Reprendre ce qui reste', { kind: 'start', eventEquipmentId: id }), secondary: null, others: [open] };
  }
}

const SECONDS_PER_MINUTE = SECONDS_PER_HOUR / MINUTES_PER_HOUR;

/** Ce que dit une durée atteinte : l'état « fermer la vanne » du minuteur, en consigne (contrat, section 6). */
export const CLOSE_THE_VALVE = 'Fermez la vanne, puis appuyez sur « Terminer ».';

/**
 * Le compte à rebours d'une irrigation qui coule, lu sur le minuteur
 * existant à l'heure donnée, jamais recalculé par la page : « Reste 52 min »,
 * à la minute supérieure ; la durée atteinte, la consigne de fermer la vanne ;
 * en pause ou pour ce qui reste d'un arrosage arrêté, rien.
 */
export function nowCountdownText(line: TodayNowLine, now: Date): string | null {
  if (line.tone === 'finished') return CLOSE_THE_VALVE;
  if (line.tone !== 'running' || !line.timer) return null;
  const remaining = remainingTimerSeconds(line.timer, now);
  if (remaining <= 0) return CLOSE_THE_VALVE;
  return `Reste ${durationText(Math.ceil(remaining / SECONDS_PER_MINUTE) * SECONDS_PER_MINUTE)}`;
}

/**
 * La réponse de « Terminer », « Mettre en pause », « Reprendre » : le
 * message de l'action d'« Arrosages », sous la carte de l'irrigation ; une
 * irrigation partielle devient « ce qui reste », la réponse la suit.
 */
export function eventReply(eventEquipmentId: string, result: TodayStart): TodayCardReply {
  return result.ok
    ? { tone: 'notice', text: sentences(result.message, result.warning), eventEquipmentId }
    : { tone: 'error', text: result.message, eventEquipmentId };
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

/** Le résultat d'une action d'« Arrosages » (démarrer, mettre en pause, reprendre, terminer), tel qu'elle le rend (`IrrigationEventActionResult`). */
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
