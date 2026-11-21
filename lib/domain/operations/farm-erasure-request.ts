import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../water-management.ts';
import { frenchDay } from './operator-gesture.ts';
import { FARM_ERASURE_DELAY_DAYS } from './farm-erasure.ts';
import { millisecondsFromHours, millisecondsFromMinutes, millisecondsFromSeconds } from '../units.ts';

/**
 * Ce que la personne voit de l'effacement de sa ferme (4.5, PR 3, troisième
 * partie ; docs/tranche-4-contract.md, F563, et 10 bis.22, F665 à F669) : la
 * demande dans « Réglages », après avoir tapé le nom de la ferme ; l'espace
 * figé jusqu'à l'effacement ; l'annulation ; l'effacement sans attendre,
 * sur demande écrite, par l'exploitant.
 */

/**
 * Le matin efface à 6 h 15, heure de Paris : le déclencheur du matin du
 * registre ne passe qu'à cette heure-là (`isParisDailyWeatherWindow`), en
 * millisecondes depuis minuit.
 */
const MORNING_MILLISECONDS = millisecondsFromHours(6) + millisecondsFromMinutes(15);

/** Un nom tel qu'on le tape : sans espaces en trop, sans majuscules. */
function comparableName(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr-FR');
}

/** Le nom tapé est-il celui de la ferme ? Les espaces en trop et les majuscules ne comptent pas. */
export function sameFarmName(typed: unknown, farmName: string): boolean {
  return typeof typed === 'string' && comparableName(farmName) !== '' && comparableName(typed) === comparableName(farmName);
}

export type FarmErasureRequestDecision = { ok: true } | { ok: false; message: string };

export function farmErasureRequestDecision(typed: unknown, farmName: string | null): FarmErasureRequestDecision {
  if (farmName === null) return { ok: false, message: 'Le nom de la ferme n’est pas lu : rechargez la page, puis recommencez.' };
  if (!sameFarmName(typed, farmName)) return { ok: false, message: `Tapez le nom de la ferme tel qu’il est écrit : « ${farmName} ».` };
  return { ok: true };
}

/**
 * Le jour de Paris où le matin efface une demande échue à `eraseAfter` : le
 * premier passage de 6 h 15 qui la trouve échue (`erase_after <= maintenant`).
 */
export function erasureMorningDay(eraseAfter: string): string {
  const instant = new Date(eraseAfter);
  const day = dateKeyInTimeZone(instant, FARM_TIME_ZONE);
  const [hour, minute, second] = new Intl.DateTimeFormat('fr-FR', { timeZone: FARM_TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .format(instant).split(':').map(Number);
  const sinceMidnight = millisecondsFromHours(hour) + millisecondsFromMinutes(minute) + millisecondsFromSeconds(second) + instant.getUTCMilliseconds();
  return sinceMidnight <= MORNING_MILLISECONDS ? day : addDaysToDateKey(day, 1);
}

export type OpenErasure = { state: 'pending' | 'erasing'; requestedAt: string; eraseAfter: string };

/** L'écran de l'espace figé : ce qui est demandé, quand, et si l'annulation est encore possible. */
export type FrozenFarmView = {
  title: string;
  lines: string[];
  cancellable: boolean;
};

export function frozenFarmView(erasure: OpenErasure): FrozenFarmView {
  const requestedOn = frenchDay(dateKeyInTimeZone(new Date(erasure.requestedAt), FARM_TIME_ZONE));
  const frozen = 'Jusque-là, la ferme est figée dans le module : aucun calcul, aucune notification, aucune lecture d’Ouvre ta ferme, aucune saisie.';
  const authorization = 'L’autorisation donnée au module dans Ouvre ta ferme se retire par un administrateur de la ferme, dans Ouvre ta ferme : le module ne peut pas le faire.';
  if (erasure.state === 'erasing') {
    return {
      title: 'L’effacement de votre ferme est en cours',
      lines: [
        `Vous avez demandé le ${requestedOn} la suppression de votre ferme et de vos données dans le module. L’effacement a commencé : il ne peut plus être annulé, et se termine au plus tard au prochain passage du matin.`,
        authorization,
      ],
      cancellable: false,
    };
  }
  return {
    title: `Votre ferme sera effacée du module le ${frenchDay(erasureMorningDay(erasure.eraseAfter))} vers 6 h 15`,
    lines: [
      `Vous avez demandé le ${requestedOn} la suppression de votre ferme et de vos données dans le module. ${frozen}`,
      'Vous pouvez annuler jusqu’à l’effacement : la ferme reprend aussitôt, et les calculs du matin le lendemain.',
      authorization,
    ],
    cancellable: true,
  };
}

/** Ce que la section de « Réglages » explique avant la demande (F563). */
export const FARM_ERASURE_EXPLANATION: readonly string[] = [
  'Tout ce que vous avez saisi ou réglé dans le module pour cette ferme est effacé : réglages, matériel, ressources en eau, planches, arrosages, pluie, observations, alertes et notifications de vos appareils, et le raccordement de la ferme à Ouvre ta ferme, sauf si une autre personne de la ferme s’en sert encore. Vos données dans Ouvre ta ferme ne changent pas : le module ne fait que les lire.',
  `L’effacement a lieu ${FARM_ERASURE_DELAY_DAYS} jours après la demande ; jusque-là, vous pouvez annuler. Pendant ce temps, la ferme est figée dans le module : aucun calcul, aucune notification, aucune lecture d’Ouvre ta ferme, aucune saisie.`,
  'Après l’effacement, une donnée effacée reste récupérable dans l’historique de l’hébergeur jusqu’à 30 jours, et dans la copie chiffrée de la semaine jusqu’à cinq semaines. Il ne reste qu’une note de la demande, sans nom, sans ferme et sans contenu, pour prouver qu’elle a été faite.',
  'L’autorisation donnée au module dans Ouvre ta ferme doit être retirée par un administrateur de la ferme, dans Ouvre ta ferme : le module ne peut pas le faire lui-même.',
  'Pour un effacement sans attendre les sept jours, faites la demande ici, puis écrivez-le au responsable du module.',
];

/** « La demande est enregistrée : la ferme sera effacée le 27/11/2026 vers 6 h 15. » */
export function farmErasureRequestedMessage(eraseAfter: string): string {
  return `La demande est enregistrée : la ferme sera effacée du module le ${frenchDay(erasureMorningDay(eraseAfter))} vers 6 h 15.`;
}

/** Une demande ouverte vue par l'exploitant : la ferme, le jour de la demande, le jour prévu. */
export type OperatorErasureRequest = { id: string; otfFarmId: string | null; state: 'pending' | 'erasing'; requestedAt: string; eraseAfter: string };

export type OperatorErasureLine = { id: string; farm: string; text: string; immediate: boolean };

export function operatorErasureLines(requests: readonly OperatorErasureRequest[]): OperatorErasureLine[] {
  return requests.map((request) => {
    const farm = request.otfFarmId === null ? 'espace sans ferme' : `ferme ${request.otfFarmId}`;
    const requestedOn = frenchDay(dateKeyInTimeZone(new Date(request.requestedAt), FARM_TIME_ZONE));
    const text = request.state === 'erasing'
      ? `${farm} : demandée le ${requestedOn}, effacement en cours`
      : `${farm} : demandée le ${requestedOn}, effacement prévu le ${frenchDay(erasureMorningDay(request.eraseAfter))}`;
    return { id: request.id, farm, text, immediate: request.state === 'pending' };
  });
}

export type ImmediateErasureDecision = { ok: true; request: OperatorErasureRequest } | { ok: false; message: string };

/**
 * L'effacement sans attendre, sur demande écrite (F563) : l'exploitant choisit
 * la demande et retape le numéro de sa ferme, pour ne jamais effacer la
 * mauvaise.
 */
export function immediateErasureDecision(input: { requestId?: unknown; typedFarm?: unknown }, requests: readonly OperatorErasureRequest[]): ImmediateErasureDecision {
  const request = requests.find((candidate) => candidate.id === input.requestId && candidate.state === 'pending');
  if (!request) return { ok: false, message: 'Choisissez une demande en attente : celle-ci n’y est plus.' };
  const expected = request.otfFarmId ?? 'sans ferme';
  if (typeof input.typedFarm !== 'string' || input.typedFarm.trim() !== expected) {
    return { ok: false, message: `Retapez le numéro de la ferme de la demande (« ${expected} ») pour confirmer.` };
  }
  return { ok: true, request };
}
