'use client';

import { automaticRefreshStatus, type AutomaticRefreshRecord } from '@/lib/domain/weather/automatic-refresh-status';
import { dateClockText } from '@/lib/domain/clock-text';

// « 16/06/2026 à 8 h 50 » (audit du 19 novembre 2026, lot K, n° 22, F474).
const dateTimeFormatter = { format: (value: Date | number) => dateClockText(new Date(value)) };

/**
 * La ligne de la mise à jour automatique de la météo (correctif météo, PR 2,
 * D-165) : la date de la dernière réussite en vert tant qu'elle a moins de
 * 36 heures ; au-delà, un avertissement qui dit le retard et la dernière
 * erreur, au lieu d'une date verte qui cachait la panne.
 */
export function AutomaticWeatherRefresh({ preference }: { preference: AutomaticRefreshRecord }) {
  const status = automaticRefreshStatus(preference, new Date());
  if (status.kind === 'none') return null;
  if (status.kind === 'fresh') {
    return <p className="weather-fresh">Dernière synchronisation automatique : {dateTimeFormatter.format(new Date(status.succeededAt))}</p>;
  }
  return (
    <p className="weather-stale" role="status">
      <strong>Mise à jour automatique de la météo en retard</strong>
      {status.succeededAt ? ` : dernière réussite le ${dateTimeFormatter.format(new Date(status.succeededAt))}.` : ' : aucune réussite enregistrée.'}
      {status.lastError ? ` Dernière erreur : ${status.lastError}` : ''}
      {' '}Les valeurs déjà enregistrées restent affichées.
    </p>
  );
}
