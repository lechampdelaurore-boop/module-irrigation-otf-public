import { dateClockText } from '../clock-text.ts';
import { millisecondsFromHours } from '../units.ts';

/**
 * Ce que les pages d'alertes disent de la dernière lecture de la météo
 * (alertes sur le téléphone, C5, D-307) : les alertes se calculent à chaque
 * lecture, pas en continu. Le 24 novembre 2026, une alerte de gel n'est
 * arrivée qu'à la réouverture du module ; rien à l'écran ne disait pourquoi.
 */

/**
 * Au-delà, une ouverture du module relit la météo (`WEATHER_REFRESH_INTERVAL_MS`,
 * `lib/services/water-dashboard.ts`) : une lecture plus ancienne veut dire
 * qu'une alerte apparue depuis dans les prévisions n'a pas encore pu partir.
 */
const FRESH_READING_HOURS = 3;

/** Pourquoi une alerte peut arriver en retard, en une phrase pour la ferme. */
export const ALERT_TIMING_EXPLANATION =
  'Les alertes se calculent à chaque lecture de la météo : à 6 h 15 chaque matin, à 9 h 30, 12 h 30, 15 h 30, 18 h 30 et 21 h 30 '
  + 'quand une alerte est active, et à l’ouverture du module quand la dernière lecture a plus de 3 heures. Une prévision qui change '
  + 'entre deux lectures n’alerte qu’à la suivante : jusqu’à 3 heures plus tard dans la journée, le lendemain à 6 h 15 pour un '
  + 'changement de la nuit.';

/**
 * La ligne de la dernière lecture. Sans `now` (le rendu du serveur, avant
 * que la page soit prête), l'heure seule, la même partout ; avec, l'âge
 * jugé : plus de 3 heures, la ligne passe en orange et dit ce que cela veut
 * dire pour les alertes.
 */
export function alertReadingNote(lastReadingAt: string | null, now: Date | null): { tone: 'ok' | 'warn'; text: string } {
  if (lastReadingAt === null) {
    return { tone: 'warn', text: 'Aucune lecture de la météo enregistrée : les alertes se calculeront à la première.' };
  }
  const moment = dateClockText(lastReadingAt);
  const age = now === null ? 0 : now.getTime() - Date.parse(lastReadingAt);
  if (age > millisecondsFromHours(FRESH_READING_HOURS)) {
    return {
      tone: 'warn',
      text: `Dernière lecture de la météo : le ${moment}, il y a plus de 3 heures. Une alerte apparue depuis dans les prévisions n’a pas encore pu partir.`,
    };
  }
  return { tone: 'ok', text: `Dernière lecture de la météo : le ${moment}.` };
}
