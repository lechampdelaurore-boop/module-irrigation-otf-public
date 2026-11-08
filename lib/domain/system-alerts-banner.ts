/**
 * Le bandeau « Alertes système non disponibles » au téléphone (audit
 * ergonomique, point 2, 3.8 quater lot 2, docs/audit-ergonomie-lot2-contract.md,
 * section 4, précision F10) : montré en entier une première fois, il se replie
 * ensuite en un point sur la cloche de la barre du haut ; le rappel complet
 * reste dans Réglages, au bloc des notifications. Ce que l'appareil a déjà vu
 * est gardé sur l'appareil, jamais en base. Le bandeau revient quand l'état
 * change, du « non pris en charge » au « refusé » par exemple, et un souvenir
 * illisible le laisse déplié.
 */

/** Les états où les alertes système ne peuvent pas partir de cet appareil. */
const LIMITED_ALERT_STATUSES = ['denied', 'unsupported', 'unavailable'] as const;

type LimitedAlertStatus = (typeof LIMITED_ALERT_STATUSES)[number];

export function isLimitedAlertStatus(status: string | null): status is LimitedAlertStatus {
  return (LIMITED_ALERT_STATUSES as readonly (string | null)[]).includes(status);
}

/** Le bandeau se replie quand l'appareil a déjà montré ce même état limité. */
export function isSystemAlertsBannerFolded(status: string, seenStatus: string | null): boolean {
  return isLimitedAlertStatus(status) && seenStatus === status;
}

/**
 * Ce que l'appareil retient une fois l'état connu : l'état limité montré, ou
 * plus rien quand les alertes peuvent partir (activées ou à activer) ;
 * `undefined` tant que l'état se vérifie, pour ne rien effacer à tort.
 */
export function systemAlertsMemoryAfter(status: string): string | null | undefined {
  if (isLimitedAlertStatus(status)) return status;
  return status === 'enabled' || status === 'default' ? null : undefined;
}
