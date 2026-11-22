import { saveAdoptedGoalForUser } from '@/db/crop-water/adoptions';
import { saveEquipmentSettingForUser } from '@/db/equipment/settings';
import { heldProposal, type FlowCause, type GapAdoption, type ObjectiveCause, type SettingRates } from '../domain/applied-water-gap';
import { settingRatesText } from '../domain/applied-water-gap-text';
import { adoptionRevision } from '../domain/crop-water/proposal';
import { millimetersText } from '../domain/display-numbers';
import type { IrrigationSnapshot } from '../domain/domain';
import { validateEquipmentSettingInput, type EquipmentSettingInput } from '../domain/irrigation-domain';
import { getAppliedWaterGapsForUser, type AppliedWaterGapView } from './applied-water-gap';
import { getBedCropWaterSheetForUser } from './crop-water-bed';
import { recalculatePlanAfterEvent } from './planning-recalculation';

/**
 * « Adopter » une proposition du bloc « L'eau apportée s'écarte du prévu »
 * (amélioration n° 5, docs/ameliorations-4-5-contract.md, §4.3, F735, D-291) :
 * jamais appliquée seule. L'écart est d'abord recalculé : une semaine changée
 * est refusée, une proposition qui ne tient plus n'écrit rien et la réponse
 * le dit avec l'écart à jour.
 *
 * Le débit s'enregistre comme un réglage changé à la main, provenance
 * « saisi » (le module ne mesure pas le débit, D-003) ; l'objectif, comme
 * l'adoption d'un objectif proposé de la 5 quater, origine « proposition
 * adoptée ». Les irrigations passées gardent leur copie du réglage, l'objectif
 * garde ses révisions (D-006). Le plan de la semaine se recalcule : après un
 * objectif comme après sa saisie, après un débit comme après un réglage
 * appliqué changé (3.7, règle 4).
 */

const STALE = 'Cette proposition ne tient plus : rien n’a été changé. Voici l’écart à jour.';

export type GapAdoptionResult = { adopted: boolean; message: string } & AppliedWaterGapView;

export async function adoptAppliedWaterGapForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  weekStart: string;
  adoption: GapAdoption;
  now?: Date;
}): Promise<GapAdoptionResult> {
  const now = input.now ?? new Date();
  const context = { ownerUserId: input.ownerUserId, season: input.season, snapshot: input.snapshot, now };
  const view = await getAppliedWaterGapsForUser(context);
  if (view.weekStart !== input.weekStart) throw new Error('La semaine a changé. Rechargez le planning.');
  const cause = heldProposal(view.gaps, input.adoption);
  if (!cause) return { adopted: false, message: STALE, ...view };
  const message = cause.kind === 'flow'
    ? await adoptFlow(input, cause, now)
    : await adoptObjective(input, cause, view.weekStart, now);
  if (message === null) return { adopted: false, message: STALE, ...view };
  return { adopted: true, message, ...await getAppliedWaterGapsForUser(context) };
}

/** Le réglage prend les débits proposés, sous son nom ; seul le serveur les a recalculés. */
async function adoptFlow(input: { ownerUserId: string; season: number }, cause: FlowCause, now: Date): Promise<string | null> {
  if (!cause.proposed) return null;
  const validation = validateEquipmentSettingInput(settingInput(cause.settingName, cause.proposed));
  if (!validation.value) return null;
  const saved = await saveEquipmentSettingForUser(input.ownerUserId, cause.equipmentId, cause.settingId, validation.value);
  if (!saved) return null;
  await recalculatePlanAfterEvent(input.ownerUserId, { kind: 'equipment-setting-changed', season: input.season, at: now, lasting: true }, { now });
  return `Le réglage « ${cause.settingName} » de ${cause.equipmentName} est enregistré : ${settingRatesText(cause.proposed)}. Les irrigations passées gardent l’ancien débit ; le plan se recalcule.`;
}

/** Le geste de la 5 quater : la proposition de la semaine en cours, relue par sa fiche, devient l'objectif de la planche dès aujourd'hui. */
async function adoptObjective(
  input: { ownerUserId: string; season: number; snapshot: IrrigationSnapshot; adoption: GapAdoption },
  cause: ObjectiveCause,
  weekStart: string,
  now: Date,
): Promise<string | null> {
  const sheet = await getBedCropWaterSheetForUser({ ownerUserId: input.ownerUserId, season: input.season, snapshot: input.snapshot, bedId: input.adoption.bedId, weekStart, now });
  if (!sheet.available || !sheet.weekOpen) return null;
  const bed = input.snapshot.beds.find((candidate) => candidate.id === sheet.bedId);
  if (!bed) return null;
  const revision = adoptionRevision(sheet.bed.week, bed, now.toISOString());
  if (!revision || revision.amountMm !== cause.proposedMm) return null;
  await saveAdoptedGoalForUser(input.ownerUserId, input.season, revision);
  await recalculatePlanAfterEvent(input.ownerUserId, { kind: 'objective-changed', season: input.season, at: revision.weekStart, lasting: true }, { now });
  return `L’objectif proposé est adopté : ${millimetersText(revision.amountMm)} par semaine deviennent l’objectif de ${bed.name} à partir d’aujourd’hui ; le plan se recalcule.`;
}

function settingInput(name: string, rates: SettingRates): EquipmentSettingInput {
  return rates.kind === 'drip'
    ? { name, kind: 'drip', rateMmPerHour: rates.rateMmPerHour }
    : { name, kind: 'sprinkler', leftProfile: rates.leftProfile, rightProfile: rates.rightProfile };
}
