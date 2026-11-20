import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../water-management.ts';
import { frenchDay, GESTURE_OLDEST_DAYS } from './operator-gesture.ts';

/**
 * Le journal d'accès du support (4.5, PR 5 ; docs/tranche-4-contract.md,
 * F567, et 10 bis.21, F660 et F661). Chaque fois que l'exploitant regarde
 * les données d'une ferme pour l'aider ou corriger une panne, il le note sur
 * la page d'état : le jour, la ferme et la raison en une ligne, **jamais ce
 * qu'il a vu**. La note est gardée 12 mois, puis la purge du matin l'efface ;
 * elle part aussi avec le dernier espace de la ferme.
 *
 * - la ferme : une de celles de la page d'état, par son identifiant d'Ouvre
 *   ta ferme ;
 * - le jour : d'aujourd'hui à 30 jours avant, à l'heure de Paris, comme les
 *   autres gestes ;
 * - la raison : de 3 à 200 caractères, sur une ligne (les retours à la
 *   ligne deviennent des espaces).
 */

const SUPPORT_REASON_MIN = 3;
export const SUPPORT_REASON_MAX = 200;

/** Combien de temps une note est gardée, en mois. */
export const SUPPORT_ACCESS_KEPT_MONTHS = 12;

export type SupportAccess = { otfFarmId: string; accessedOn: string; reason: string };

export type SupportAccessDecision = { ok: true; access: SupportAccess } | { ok: false; message: string };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_KEY.test(value)
    && new Date(`${value}T12:00:00.000Z`).toISOString().slice(0, 10) === value;
}

/** La raison sur une ligne : espaces et retours à la ligne ramenés à un seul espace. */
export function supportReason(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function supportAccessDecision(
  input: { otfFarmId?: unknown; day?: unknown; reason?: unknown },
  now: Date,
  knownFarms: readonly string[],
): SupportAccessDecision {
  const farm = input.otfFarmId;
  if (typeof farm !== 'string' || !knownFarms.includes(farm)) return { ok: false, message: 'Choisissez la ferme dont vous avez regardé les données.' };
  if (!isDateKey(input.day)) return { ok: false, message: 'Choisissez le jour où vous les avez regardées.' };
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  if (input.day > today) return { ok: false, message: 'Ce jour est à venir : notez l’accès une fois fait.' };
  if (input.day < addDaysToDateKey(today, -GESTURE_OLDEST_DAYS)) {
    return { ok: false, message: `Un accès de plus de ${GESTURE_OLDEST_DAYS} jours ne se note plus ici : notez-le le jour même.` };
  }
  const reason = supportReason(input.reason);
  if (reason.length < SUPPORT_REASON_MIN) return { ok: false, message: 'Écrivez la raison en une ligne : la demande de la ferme, ou la panne.' };
  if (reason.length > SUPPORT_REASON_MAX) return { ok: false, message: `La raison tient en ${SUPPORT_REASON_MAX} caractères au plus : une ligne, sans ce que vous avez vu.` };
  return { ok: true, access: { otfFarmId: farm, accessedOn: input.day, reason } };
}

/** « L’accès du 20/11/2026 aux données de la ferme 4394 est noté. » */
export function supportAccessRecordedMessage(access: SupportAccess): string {
  return `L’accès du ${frenchDay(access.accessedOn)} aux données de la ferme ${access.otfFarmId} est noté.`;
}

/**
 * Le premier jour gardé : le même jour, douze mois plus tôt (le 29 février
 * devient le 28). Les notes d'avant partent à la purge du matin.
 */
export function oldestKeptSupportDay(parisDay: string): string {
  const [year, month, day] = parisDay.split('-').map(Number);
  const earlier = year - SUPPORT_ACCESS_KEPT_MONTHS / 12;
  const lastDay = new Date(Date.UTC(earlier, month, 0)).getUTCDate();
  return `${String(earlier).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/** Une ligne du journal sur la page d'état : « 20/11/2026 · ferme 4394 : la ferme demande pourquoi… ». */
export type SupportAccessLine = { key: string; day: string; farm: string; reason: string };

export function supportAccessLines(rows: readonly (SupportAccess & { id: string })[]): SupportAccessLine[] {
  return rows.map((row) => ({ key: row.id, day: frenchDay(row.accessedOn), farm: `ferme ${row.otfFarmId}`, reason: row.reason }));
}
