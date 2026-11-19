'use client';

import { shownWeatherAlertDelivery, type WeatherAlertDeliveryStatus } from '@/lib/domain/weather/weather-alerts';

/**
 * Le résultat d'un envoi dans l'historique des alertes météo et cultures :
 * en démonstration, un envoi manqué se lit « Non envoyée : notifications
 * coupées dans la démonstration », en couleur neutre (F454).
 */
export function DeliveryStatus({ entry, demo }: {
  entry: { deliveryStatus: WeatherAlertDeliveryStatus; deliveryLabel: string };
  demo: boolean;
}) {
  const shown = shownWeatherAlertDelivery(entry, demo);
  return <span className="weather-alert-delivery" data-status={shown.status}>{shown.label}</span>;
}
