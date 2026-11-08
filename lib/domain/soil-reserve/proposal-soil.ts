import { effectiveProposalStatus, type StoredProposal } from '../planning/contract.ts';
import { dateKeyInTimeZone, FARM_TIME_ZONE } from '../water-management.ts';
import type { IrrigationInterval, SoilReserveDay } from './gauge.ts';
import { doseBeyondSoilMm } from './signals.ts';

/**
 * La dose au-delà de ce que le sol retient, sur les propositions du plan de
 * la semaine (docs/soil-reserve-contract.md, « Les signaux », 5 ter, PR 3d) :
 * pour chaque planche d'une proposition encore proposée, les mm qui
 * dépassent ce qui peut encore entrer dans le sol au début de l'arrosage,
 * perdus en drainage. Rien quand la jauge de la planche est inconnue, ni
 * quand tout tient dans le sol. Une information : la dose du plan ne change
 * pas (D-028, D-047).
 */

export type ProposalSoilNote = { bedId: string; bedName: string; beyondMm: number };

/** Sous un dixième de mm, l'écart tient de l'arrondi : rien n'est dit. */
const NEGLIGIBLE_MM = 0.1;

export function proposalSoilNotes(input: {
  proposals: readonly Pick<StoredProposal, 'storedId' | 'status' | 'startAt' | 'endAt' | 'bedApplications'>[];
  now: Date;
  daysByBed: ReadonlyMap<string, readonly SoilReserveDay[]>;
  intervalsByBed: ReadonlyMap<string, readonly IrrigationInterval[]>;
}): Record<string, ProposalSoilNote[]> {
  const notes: Record<string, ProposalSoilNote[]> = {};
  for (const proposal of input.proposals) {
    if (effectiveProposalStatus(proposal, input.now) !== 'proposed') continue;
    const date = dateKeyInTimeZone(new Date(proposal.startAt), FARM_TIME_ZONE);
    const beyond: ProposalSoilNote[] = [];
    for (const application of proposal.bedApplications) {
      const intervals = input.intervalsByBed.get(application.bedId) ?? [];
      // L'apport de la proposition tel que la jauge l'a compté, pour l'écarter des arrosages d'avant.
      const interval = intervals.find((candidate) => candidate.nature === 'proposed'
        && candidate.startAt === proposal.startAt && candidate.endAt === proposal.endAt && candidate.mm === application.appliedMm);
      const day = input.daysByBed.get(application.bedId)?.find((candidate) => candidate.date === date);
      if (!interval || !day) continue;
      const mm = doseBeyondSoilMm(day, interval, intervals);
      if (mm !== null && mm >= NEGLIGIBLE_MM) beyond.push({ bedId: application.bedId, bedName: application.bedName, beyondMm: mm });
    }
    if (beyond.length > 0) notes[proposal.storedId] = beyond;
  }
  return notes;
}
