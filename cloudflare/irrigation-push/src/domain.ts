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
  transient: number;
  permanent: number;
};

export type ImmediateDeliveryStatus = 'sent' | 'no-subscriber' | 'retrying' | 'failed';

/**
 * Le résultat d'un envoi immédiat, tel que l'application l'enregistre :
 * envoyée dès qu'un appareil l'a reçue ; aucun appareil abonné quand il n'y
 * en a pas, ou plus (abonnements expirés) ; en cours de nouvelle tentative
 * après un échec transitoire ; en échec sinon.
 */
export function immediateDeliveryStatus(counts: ImmediateDeliveryCounts): ImmediateDeliveryStatus {
  if (counts.delivered > 0 || counts.alreadyDelivered > 0) return 'sent';
  if (counts.subscriptions - counts.expired <= 0) return 'no-subscriber';
  if (counts.transient > 0) return 'retrying';
  return 'failed';
}
