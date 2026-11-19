import { FARM_TIME_ZONE, dateKeyInTimeZone, weekStartDateKey } from './water-management.ts';

/**
 * Ce que le formulaire d'irrigation sait d'avance (audit ergonomique du
 * 19 novembre 2026, lot G, n° 9 ; docs/audit-ergonomie-2026-11-19-lot-g-contract.md,
 * section 4) : la dose que le planning propose pour un matériel un jour donné
 * (F409), et l'objectif de la semaine de chaque planche (F410).
 */

/** Une proposition du planning, réduite à ce que le formulaire lit. */
export type DayDose = { equipmentId: string; startAt: string; doseMm: number };

/** Les objectifs adoptés d'une semaine, par planche ; une planche sans objectif est absente. */
export type WeekObjectives = { weekStart: string; objectiveMmByBed: Record<string, number> };

export type IrrigationFormHints = { doses: DayDose[]; weeks: WeekObjectives[] };

export const NO_FORM_HINTS: IrrigationFormHints = { doses: [], weeks: [] };

/** Seules les propositions encore valables donnent une dose : proposées ou validées. */
export function dayDosesFromProposals(proposals: readonly (DayDose & { status: string })[]): DayDose[] {
  return proposals
    .filter((proposal) => proposal.status === 'proposed' || proposal.status === 'validated')
    .filter((proposal) => Number.isFinite(proposal.doseMm) && proposal.doseMm > 0)
    .map(({ equipmentId, startAt, doseMm }) => ({ equipmentId, startAt, doseMm }));
}

/**
 * La dose proposée pour ce matériel ce jour-là, la première du jour s'il y en
 * a plusieurs ; nulle sans proposition : le champ reste alors vide (F409).
 */
export function proposedDoseFor(doses: readonly DayDose[], equipmentId: string, dateKey: string, timeZone = FARM_TIME_ZONE): number | null {
  const first = doses
    .filter((dose) => dose.equipmentId === equipmentId && dateKeyInTimeZone(dose.startAt, timeZone) === dateKey)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
  return first ? Math.round(first.doseMm * 10) / 10 : null;
}

export type ObjectiveExcess = {
  bedName: string;
  amountMm: number;
  objectiveMm: number;
  /** Les autres planches atteintes au-delà de leur objectif. */
  otherBeds: number;
};

/**
 * La planche la plus au-delà de l'objectif de sa semaine, si l'apport estimé
 * d'une planche atteinte dépasse cet objectif ; nulle sinon, et toujours
 * nulle pour une planche sans objectif adopté (F410). L'apport de cette
 * irrigation seule est comparé, comme le porteur l'a choisi le 19 novembre 2026.
 */
export function objectiveExcess(
  applications: readonly { bed: { id: string; name: string }; amountMm: number | null }[],
  weeks: readonly WeekObjectives[],
  irrigationDate: string,
  timeZone = FARM_TIME_ZONE,
): ObjectiveExcess | null {
  const weekStart = weekStartDateKey(irrigationDate, timeZone);
  const objectives = weeks.find((week) => week.weekStart === weekStart)?.objectiveMmByBed ?? {};
  const beyond = applications
    .flatMap(({ bed, amountMm }) => {
      const objectiveMm = objectives[bed.id];
      return amountMm !== null && objectiveMm !== undefined && amountMm > objectiveMm + 0.05
        ? [{ bedName: bed.name, amountMm, objectiveMm }]
        : [];
    })
    .sort((a, b) => (b.amountMm - b.objectiveMm) - (a.amountMm - a.objectiveMm));
  if (beyond.length === 0) return null;
  return { ...beyond[0], otherBeds: beyond.length - 1 };
}
