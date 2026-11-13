import { FARM_TIME_ZONE, localDateTimeUtc } from '../water-management.ts';

/**
 * L'horloge simulée de la démonstration (docs/demo-guided-contract.md, C3) :
 * un moment se joue toujours le même jour, à l'heure réelle de la ferme. Le
 * jour de la visite ne change donc rien à ce que la démonstration montre ;
 * l'heure, elle, avance comme d'habitude, pour que les minuteurs, les
 * créneaux passés et « dans 2 h » gardent leur sens.
 *
 * Fonction pure : le service `lib/services/demo-clock.ts` en tire le décalage
 * à appliquer à chaque requête d'un invité.
 */

const wallTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: FARM_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function wallTimeAtFarm(instantMs: number): { hour: number; minute: number; second: number } {
  const parts = Object.fromEntries(wallTimeFormatter.formatToParts(instantMs).map((part) => [part.type, part.value]));
  return { hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second) };
}

/** L'instant simulé : le jour du moment, à l'heure qu'il est réellement à la ferme (millisecondes gardées). */
export function simulatedInstantMs(realNowMs: number, momentDateKey: string): number {
  const wallTime = wallTimeAtFarm(realNowMs);
  const milliseconds = ((realNowMs % 1000) + 1000) % 1000;
  return localDateTimeUtc(momentDateKey, wallTime, FARM_TIME_ZONE).getTime() + milliseconds;
}

/** Le décalage à ajouter à l'horloge réelle pour lire l'horloge simulée, fixé pour toute une requête. */
export function simulatedOffsetMs(realNowMs: number, momentDateKey: string): number {
  return simulatedInstantMs(realNowMs, momentDateKey) - realNowMs;
}
