import { linkSpeciesForUser } from '@/db/crop-water/entries';
import { confirmSpeciesStepForUser } from '@/db/onboarding-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import { linkedSpeciesCount } from '../domain/onboarding/species';
import { getCropCoefficientsViewForUser } from './crop-water-coefficients';

/**
 * L'étape « Rattachez vos espèces » d'une ferme neuve (4.4,
 * docs/tranche-4-contract.md, F423 ; PR 4c, F587) : rattacher d'un geste les
 * propositions gardées, puis confirmer l'étape. Le serveur relit lui-même
 * les propositions : seule une espèce encore proposée se rattache, à la
 * culture proposée. La ferme du porteur (espace d'avant l'accueil) et la
 * démonstration n'ont pas cette étape (F426).
 */

type StepInput = { ownerUserId: string; season: number; snapshot: IrrigationSnapshot; now?: Date };
type StepResult = { ok: true; count: number } | { ok: false; message: string };

const NOT_ONBOARDING = 'Cette étape ne concerne qu’une ferme qui fait l’accueil.';

export async function linkProposedSpeciesForUser(input: StepInput & { plantIds: readonly string[] }): Promise<StepResult> {
  const view = await getCropCoefficientsViewForUser(input);
  if (!view.available) return { ok: false, message: 'Le plan de culture n’est pas encore lu : actualisez la lecture.' };
  if (view.speciesStep === null) return { ok: false, message: NOT_ONBOARDING };
  const wanted = new Set(input.plantIds);
  if (wanted.size === 0) return { ok: false, message: 'Cochez au moins une espèce à rattacher.' };
  const chosen = view.speciesStep.proposals.filter((proposal) => wanted.has(proposal.plantId));
  if (chosen.length !== wanted.size) return { ok: false, message: 'Une espèce cochée n’a plus de proposition : la liste est remise à jour.' };
  const saved = await linkSpeciesForUser(input.ownerUserId, chosen.map(({ plantId, referenceCropId, analogy }) => ({ plantId, referenceCropId, analogy })), input.now);
  return saved.ok ? { ok: true, count: saved.value } : { ok: false, message: saved.problems.join(' ') };
}

export async function confirmSpeciesStepOfUser(input: StepInput): Promise<StepResult> {
  const view = await getCropCoefficientsViewForUser(input);
  if (!view.available) return { ok: false, message: 'Le plan de culture n’est pas encore lu : actualisez la lecture.' };
  if (view.speciesStep === null) return { ok: false, message: NOT_ONBOARDING };
  const count = linkedSpeciesCount(view.species);
  await confirmSpeciesStepForUser(input.ownerUserId, count, input.now);
  return { ok: true, count: count.linked };
}
