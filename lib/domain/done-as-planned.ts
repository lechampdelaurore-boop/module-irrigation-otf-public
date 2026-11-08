import type { IrrigationEventRecord } from './irrigation-event-record.ts';
import { isWaitingPlannedIrrigation } from './planned-irrigation.ts';

/**
 * « Fait comme prévu » (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.4, précisions T15 et T16 ; audit ergonomique, point 6.5) : une
 * irrigation planifiée faite hors du module s'enregistre réalisée **telle que
 * prévue**, à son heure de début prévue, avec sa durée, son matériel, son
 * réglage et sa dose prévus (choix du porteur, 8 novembre 2026). Le bouton
 * « Tout est fait » de « Aujourd'hui » s'en sert pour toutes à la fois ; le
 * geste d'une ligne du lot 3 reprendra la même fonction.
 *
 * Seule une irrigation planifiée qui attend encore s'enregistre ainsi : ni
 * démarrée au chrono (elle se termine par son bouton), ni déjà enregistrée,
 * ni annulée. Son heure de fin prévue doit être passée (T15) : une irrigation
 * réalisée ne se termine pas dans le futur, la règle de la saisie « Déjà
 * réalisée ». Une fois enregistrée, elle ne se modifie plus (D-006, T16).
 */

export type DoneAsPlannedRefusal = 'not-waiting' | 'not-over' | 'no-slot';

/** La raison d'un refus, dite après le nom de l'irrigation. */
export const DONE_AS_PLANNED_REFUSAL_TEXT: Record<DoneAsPlannedRefusal, string> = {
  'not-waiting': 'Elle a déjà été démarrée, enregistrée ou annulée.',
  'not-over': 'Son heure de fin prévue n’est pas encore passée.',
  'no-slot': 'Son heure ou sa durée prévue manque.',
};

export type DoneAsPlannedRecord = {
  eventEquipmentId: string;
  /** Les heures réelles : les heures prévues. */
  actualStartAt: string;
  actualEndAt: string;
  /** La durée réelle : la durée prévue ; la dose reçue par planche en découle, la dose prévue. */
  actualDurationSeconds: number;
  /**
   * L'irrigation telle qu'elle a été lue : la base ne l'enregistre que si elle
   * la trouve encore ainsi, sans quoi l'heure ou la durée « prévues » ne
   * seraient plus celles que l'utilisateur a vues.
   */
  expected: { plannedStartAt: string; plannedEndAt: string; plannedDurationSeconds: number };
};

export type DoneAsPlannedResult =
  | { ok: true; record: DoneAsPlannedRecord }
  | { ok: false; refusal: DoneAsPlannedRefusal };

export function doneAsPlanned(event: IrrigationEventRecord, now: Date): DoneAsPlannedResult {
  if (!isWaitingPlannedIrrigation(event)) return { ok: false, refusal: 'not-waiting' };
  const equipment = event.equipment;
  const plannedStartAt = equipment.plannedStartAt ?? '';
  const plannedEndAt = equipment.plannedEndAt ?? '';
  const start = Date.parse(plannedStartAt);
  const end = Date.parse(plannedEndAt);
  const seconds = equipment.plannedDurationSeconds;
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(end > start) || !Number.isInteger(seconds) || seconds <= 0) {
    return { ok: false, refusal: 'no-slot' };
  }
  if (end > now.getTime()) return { ok: false, refusal: 'not-over' };
  return {
    ok: true,
    record: {
      eventEquipmentId: equipment.id,
      actualStartAt: new Date(start).toISOString(),
      actualEndAt: new Date(end).toISOString(),
      actualDurationSeconds: seconds,
      expected: { plannedStartAt, plannedEndAt, plannedDurationSeconds: seconds },
    },
  };
}
