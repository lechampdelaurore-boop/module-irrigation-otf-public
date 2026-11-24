import { HOURS_PER_DAY, millisecondsFromHours, millisecondsFromMinutes } from '../units.ts';

/**
 * Les alertes non délivrées d'une ferme (alertes sur le téléphone, C2,
 * D-304 ; docs/tranche-4-contract.md, 10 bis.13, F616 étendu) : les alertes
 * météo et par culture (gel, séchage, aspersions) parties sans atteindre un
 * appareil. Jusqu'au 24 novembre 2026, elles n'étaient qu'enregistrées
 * (« Aucun appareil abonné ») dans l'historique de la page des alertes et
 * journalisées au niveau info : l'exploitant n'en voyait rien.
 *
 * Des nombres seulement, jamais le contenu d'une alerte, une culture ni un
 * nom de ferme.
 */

/** Ce qu'un envoi a laissé, par état, pour une ferme et une période. */
export type UndeliveredAlertCounts = {
  /** Aucun appareil inscrit, ou plus aucun (abonnements expirés, appareils passés à une autre personne). */
  noDevice: number;
  /** Refusée par chaque appareil, ou service de notification injoignable ou non configuré. */
  failed: number;
  /** Prise avant l'envoi, sans résultat enregistré depuis plus d'une heure : l'envoi s'est interrompu. */
  interrupted: number;
};

export type FarmAlertDeliveries = {
  /** Les 24 dernières heures. */
  undelivered24h: UndeliveredAlertCounts;
  /** Les 7 derniers jours, les 24 dernières heures comprises. */
  undelivered7d: UndeliveredAlertCounts;
  /**
   * En nouvelle tentative, sur 7 jours : le service de notification a eu un
   * échec passager et réessaie seul (douze essais, environ 1 h 45). Leur
   * issue n'est pas rapportée : elles se comptent à part, sans être un
   * problème.
   */
  retrying7d: number;
};

export const NO_UNDELIVERED_ALERTS: UndeliveredAlertCounts = { noDevice: 0, failed: 0, interrupted: 0 };

export const EMPTY_FARM_ALERT_DELIVERIES: FarmAlertDeliveries = {
  undelivered24h: NO_UNDELIVERED_ALERTS,
  undelivered7d: NO_UNDELIVERED_ALERTS,
  retrying7d: 0,
};

/**
 * Une alerte prise avant l'envoi et sans résultat après ce délai est comptée
 * comme interrompue. L'envoi enregistre son résultat dès que le service de
 * notification répond (quelques secondes) : une heure laisse une large marge.
 */
export const INTERRUPTED_ALERT_AFTER_MINUTES = 60;

/** Les instants qui bornent le compte (`sent_at` est un instant ISO) : 24 heures, 7 jours, et le seuil d'une alerte interrompue. */
export function undeliveredAlertWindows(now: Date): { dayStart: string; weekStart: string; interruptedBefore: string } {
  return {
    dayStart: new Date(now.getTime() - millisecondsFromHours(HOURS_PER_DAY)).toISOString(),
    weekStart: new Date(now.getTime() - millisecondsFromHours(UNDELIVERED_WINDOW_DAYS * HOURS_PER_DAY)).toISOString(),
    interruptedBefore: new Date(now.getTime() - millisecondsFromMinutes(INTERRUPTED_ALERT_AFTER_MINUTES)).toISOString(),
  };
}

/** Les alertes non délivrées se comptent sur 7 jours, comme les erreurs d'Ouvre ta ferme. */
const UNDELIVERED_WINDOW_DAYS = 7;

export function undeliveredTotal(counts: UndeliveredAlertCounts): number {
  return counts.noDevice + counts.failed + counts.interrupted;
}

/**
 * Le ton d'une ferme pour ses alertes : rouge quand une alerte n'a atteint
 * aucun appareil dans les 24 dernières heures (un gel annoncé n'a peut-être
 * été vu par personne), orange pour une alerte plus ancienne, sur 7 jours ;
 * rien sinon. Une alerte en nouvelle tentative ne change pas le ton.
 */
export function undeliveredAlertsProblem(deliveries: FarmAlertDeliveries): { tone: 'warn' | 'danger'; text: string } | null {
  const day = undeliveredTotal(deliveries.undelivered24h);
  if (day > 0) return { tone: 'danger', text: `${alertWords(day)} non délivrée${day > 1 ? 's' : ''} en 24 heures (${causeWords(deliveries.undelivered24h)}).` };
  const week = undeliveredTotal(deliveries.undelivered7d);
  if (week > 0) return { tone: 'warn', text: `${alertWords(week)} non délivrée${week > 1 ? 's' : ''} sur 7 jours (${causeWords(deliveries.undelivered7d)}).` };
  return null;
}

/** La ligne « Alertes non délivrées » de la ferme, en mots. */
export function undeliveredAlertsWords(deliveries: FarmAlertDeliveries): string {
  const week = undeliveredTotal(deliveries.undelivered7d);
  const day = undeliveredTotal(deliveries.undelivered24h);
  const retrying = deliveries.retrying7d > 0
    ? ` ; ${alertWords(deliveries.retrying7d)} en nouvelle tentative par le service de notification`
    : '';
  if (week === 0) return `aucune sur 7 jours${retrying}`;
  const today = day > 0 ? `, dont ${day} en 24 heures` : '';
  return `${week} sur 7 jours${today} : ${causeWords(deliveries.undelivered7d)}${retrying}`;
}

function alertWords(count: number): string {
  return `${count} alerte${count > 1 ? 's' : ''}`;
}

function causeWords(counts: UndeliveredAlertCounts): string {
  return [
    counts.noDevice > 0 ? `aucun appareil inscrit : ${counts.noDevice}` : null,
    counts.failed > 0 ? `échec de l’envoi : ${counts.failed}` : null,
    counts.interrupted > 0 ? `envoi interrompu : ${counts.interrupted}` : null,
  ].filter((part): part is string => part !== null).join(', ');
}
