import { DEMO_FARMS, demoFarmSnapshot } from '../adapters/demo/farms.ts';
import { DEMO_FROST_COMMON_KEYS, DEMO_SPECIES_REFERENCES } from '../adapters/demo/module-data.ts';
import { adoptionRevision } from '../domain/crop-water/proposal.ts';
import type { DemoChoice } from '../domain/demo/catalogue.ts';
import type { IrrigationSnapshot } from '../domain/domain.ts';
import { saveFrostLinkForUser } from '@/db/crop-alerts/inputs';
import { saveAdoptedGoalForUser } from '@/db/crop-water/adoptions';
import { saveSpeciesCorrespondenceForUser } from '@/db/crop-water/entries';
import { readFeatureSelectionForUser, saveFeatureSelectionForUser } from '@/db/feature-selection-repository';
import { createWorkspaceIfAbsent } from '@/db/workspace-repository';
import { getBedCropWaterSheetForUser } from './crop-water-bed.ts';
import { isDemoDeployment } from './deployment-mode.ts';
import { seedDemoEquipment } from './demo-equipment-seed.ts';
import { seedDemoWeather } from './demo-weather-seed.ts';
import { computeWeeklyPlanForUser } from './planning-service.ts';

/**
 * L'espace d'un invité de la démonstration, pour une ferme fictive et un
 * moment (docs/demo-guided-contract.md, sections 5 et 6) : créé à sa première
 * ouverture avec ce que la ferme a déjà réglé (ses cases cochées, ses
 * espèces rattachées aux cultures de référence et aux seuils de gel du jeu
 * commun, son matériel et son eau, ses arrosages passés, la météo des
 * semaines passées, les objectifs proposés par le module et adoptés, le plan
 * de la semaine calculé), par les dépôts ordinaires, comme si la ferme l'avait
 * saisi. La ferme vierge n'a pas d'espace tant que l'invité n'a rien coché :
 * c'est ainsi qu'une ferme qui n'a jamais ouvert le module arrive sur la
 * liste à cocher (R5). Le plan de la ferme vient de
 * `lib/adapters/demo/farms.ts`, la météo du fournisseur de la démonstration.
 *
 * Deux requêtes simultanées ne préparent l'espace qu'une fois : seule celle
 * qui le crée l'écrit ; l'autre attend qu'il soit prêt. Un espace déjà ouvert
 * n'est jamais réécrit : les essais de l'invité restent jusqu'à la remise à
 * zéro (D4). Refusé hors démonstration : le module en production n'a aucun
 * peuplement.
 */
export async function prepareDemoSpace(ownerUserId: string, choice: DemoChoice): Promise<void> {
  if (!isDemoDeployment()) throw new Error('Un espace de démonstration ne se prépare qu’en démonstration.');
  if (choice.profile.features.length === 0) return;
  if ((await readFeatureSelectionForUser(ownerUserId)).kind === 'stored') return;
  if (await createWorkspaceIfAbsent(ownerUserId)) {
    await seedDemoSpace(ownerUserId, choice);
    return;
  }
  await waitUntilPrepared(ownerUserId);
}

async function seedDemoSpace(ownerUserId: string, choice: DemoChoice): Promise<void> {
  const now = new Date();
  const snapshot = demoFarmSnapshot(choice.profile.id, choice.moment.dateKey);
  await saveSpecies(ownerUserId, choice, now);
  await seedDemoEquipment(ownerUserId, choice, snapshot);
  await seedDemoWeather(ownerUserId, snapshot, choice.moment.dateKey, now);
  if (choice.profile.features.includes('cultures')) await adoptProposals(ownerUserId, snapshot, now);
  // Le calcul du matin, que la tâche de nuit aurait fait pour une vraie ferme.
  if (choice.profile.features.includes('planning')) {
    await computeWeeklyPlanForUser({ ownerUserId, season: snapshot.configuration.seasonFirst, snapshot, now, trigger: 'daily' });
  }
  // Les cases cochées en dernier : elles disent aux autres requêtes que l'espace est prêt.
  await saveFeatureSelectionForUser(ownerUserId, choice.profile.features, now);
}

const WAIT_STEP_MS = 100;
const WAIT_STEPS = 50;

/**
 * Une autre requête prépare l'espace (la page et ses données partent
 * ensemble à la première ouverture) : on attend qu'elle ait fini, au plus
 * cinq secondes, plutôt que de montrer un espace à moitié écrit. Les cases
 * cochées, écrites en dernier, disent qu'il est prêt.
 */
async function waitUntilPrepared(ownerUserId: string): Promise<void> {
  for (let step = 0; step < WAIT_STEPS; step += 1) {
    if ((await readFeatureSelectionForUser(ownerUserId)).kind === 'stored') return;
    await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
  }
}

/**
 * Les objectifs de la semaine : la proposition du module pour chaque planche
 * cultivée (Kc du catalogue × ETP de la météo de la démonstration), adoptée
 * comme la ferme le ferait d'un clic dans « Besoin par culture ». Aucun
 * chiffre saisi : une planche sans proposition complète reste sans objectif.
 */
async function adoptProposals(ownerUserId: string, snapshot: IrrigationSnapshot, now: Date): Promise<void> {
  const season = snapshot.configuration.seasonFirst;
  for (const bed of snapshot.beds) {
    const sheet = await getBedCropWaterSheetForUser({ ownerUserId, season, snapshot, bedId: bed.id, now });
    if (!sheet.available || !sheet.weekOpen) continue;
    const revision = adoptionRevision(sheet.bed.week, bed, now.toISOString());
    if (revision) await saveAdoptedGoalForUser(ownerUserId, season, revision);
  }
}

/** Les espèces de la ferme, rattachées comme la ferme le ferait dans Réglages et dans Alertes cultures. */
async function saveSpecies(ownerUserId: string, choice: DemoChoice, now: Date): Promise<void> {
  const plantIds = [...new Set(DEMO_FARMS[choice.profile.id].series.map((series) => series.plantId))];
  const frost = choice.profile.features.includes('alertes-cultures');
  for (const plantId of plantIds) {
    const referenceCropId = DEMO_SPECIES_REFERENCES[plantId];
    if (referenceCropId) {
      const saved = await saveSpeciesCorrespondenceForUser(
        ownerUserId,
        { plantId, seriesId: null, target: { kind: 'reference', referenceCropId, analogy: false } },
        now,
      );
      if (!saved.ok) throw new Error(`Démonstration : ${plantId} non rattachée (${saved.problems.join(' ; ')}).`);
    }
    const commonKey = DEMO_FROST_COMMON_KEYS[plantId];
    if (frost && commonKey) {
      const saved = await saveFrostLinkForUser(ownerUserId, { plantId, seriesId: null, commonKey }, now);
      if (!saved.ok) throw new Error(`Démonstration : seuil de gel de ${plantId} refusé (${saved.problems.join(' ; ')}).`);
    }
  }
}
