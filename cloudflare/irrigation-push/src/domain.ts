export function compareAlarmRevisions(left: string, right: string) {
  return left === right ? 0 : left > right ? 1 : -1;
}

export function shouldRetryDelivery(
  transientCount: number,
  nextAttempt: number,
  maximumAttempts: number,
) {
  return transientCount > 0 && nextAttempt < maximumAttempts;
}

export function deliveryRetryDelay(
  attempt: number,
  initialDelayMs: number,
  maximumDelayMs: number,
) {
  return Math.min(
    maximumDelayMs,
    initialDelayMs * 2 ** Math.max(0, attempt - 1),
  );
}

export type ImmediateDeliveryCounts = {
  /** Abonnements du destinataire au moment de l'envoi. */
  subscriptions: number;
  delivered: number;
  /** Déjà reçue par cet abonnement sous la même révision : pas de doublon. */
  alreadyDelivered: number;
  expired: number;
  /**
   * Appareils qui ne sont plus inscrits dans cet espace (passés à une autre
   * personne, ou réservés à un autre espace) : retirés de sa liste, rien ne
   * leur est envoyé (docs/tranche-4-contract.md, F371).
   */
  reassigned: number;
  transient: number;
  permanent: number;
};

export type ImmediateDeliveryStatus = 'sent' | 'no-subscriber' | 'retrying' | 'failed';

/**
 * Le résultat d'un envoi immédiat, tel que l'application l'enregistre :
 * envoyée dès qu'un appareil l'a reçue ; aucun appareil abonné quand il n'y
 * en a pas, ou plus (abonnements expirés, appareils passés à un autre
 * espace) ; en cours de nouvelle tentative après un échec transitoire ; en
 * échec sinon.
 */
export function immediateDeliveryStatus(counts: ImmediateDeliveryCounts): ImmediateDeliveryStatus {
  if (counts.delivered > 0 || counts.alreadyDelivered > 0) return 'sent';
  if (counts.subscriptions - counts.expired - counts.reassigned <= 0) return 'no-subscriber';
  if (counts.transient > 0) return 'retrying';
  return 'failed';
}

/**
 * Le nom de l'alarme qui retente un envoi immédiat (constat D1 de la revue
 * de l'isolation, F377) : l'espace et l'identifiant de la notification
 * ensemble. Deux espaces qui envoient sous le même identifiant (le gel du
 * même jour, `crop-frost:<jour>:suite`) ont chacun la leur : la nouvelle
 * tentative de l'un ne remplace jamais celle de l'autre.
 */
export function retryAlarmName(recipientKey: string, notificationId: string): string {
  return `send:${recipientKey}:${notificationId}`;
}
