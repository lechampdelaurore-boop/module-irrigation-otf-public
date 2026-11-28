import { DEMO_FARMS, demoFarmSnapshot } from '../adapters/demo/farms.ts';
import { DEMO_FROST_COMMON_KEYS, DEMO_SPECIES_REFERENCES, DEMO_WEATHER_ALERT_TEMPLATES } from '../adapters/demo/module-data.ts';
import { adoptionRevision } from '../domain/crop-water/proposal.ts';
import type { DemoChoice } from '../domain/demo/catalogue.ts';
import type { IrrigationSnapshot } from '../domain/domain.ts';
import { weatherAlertTemplates } from '../domain/weather/weather-alert-templates.ts';
import { saveAdoptedGoalsForUser } from '@/db/crop-water/adoptions';
import { readFeatureSelectionForUser, saveFeatureSelectionForUser } from '@/db/feature-selection-repository';
import { createWeatherAlertCriterionForUser } from '@/db/weather-alert-repository';
import { createWorkspaceIfAbsent } from '@/db/workspace-repository';
import { saveDemoSpeciesForUser } from '@/db/demo-seed-repository';
import { archiveStaleDemoPreparation } from '@/db/demo-space-repository';
import { getBedWeekProposalsForUser } from './crop-water-bed.ts';
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
 * semaines passées, les alertes météo qu'elle a posées, les objectifs
 * proposés par le module et adoptés, le plan
 * de la semaine calculé), par les dépôts ordinaires, comme si la ferme l'avait
 * saisi ; les arrosages passés, l'archive des prévisions, les objectifs
 * adoptés et les espèces en quelques lots, les mêmes lignes qu'une à une
 * (accélérer le site, A2, D-359). La ferme vierge n'a pas d'espace tant que
 * l'invité n'a rien choisi : c'est ainsi qu'une ferme qui n'a jamais ouvert
 * le module arrive sur les trois façons de commencer (lot S6, D-336 ; R5).
 * Le plan de la ferme vient de `lib/adapters/demo/farms.ts`, la météo du
 * fournisseur de la démonstration.
 *
 * Deux requêtes simultanées ne préparent l'espace qu'une fois : seule celle
 * qui le crée l'écrit ; l'autre attend qu'il soit prêt, deux secondes au
 * plus, puis dit qu'il se prépare (`DemoSpacePreparingError`) plutôt que de
 * montrer un espace à moitié écrit. Une préparation interrompue, commencée
 * depuis plus de deux minutes sans avoir fini, est reprise par la requête
 * suivante, et une seule : l'espace est mis de côté, puis préparé de nouveau
 * jusqu'au bout (audit du 19 novembre 2026, lot I, n° 11, F450). Un espace
 * déjà ouvert n'est jamais réécrit : les essais de l'invité restent jusqu'à
 * la remise à zéro (D4). Refusé hors démonstration : le module en
 * production n'a aucun peuplement.
 */
export async function prepareDemoSpace(ownerUserId: string, choice: DemoChoice): Promise<void> {
  if (!isDemoDeployment()) throw new Error('Un espace de démonstration ne se prépare qu’en démonstration.');
  if (choice.profile.features.length === 0) return;
  if ((await readFeatureSelectionForUser(ownerUserId)).kind === 'stored') return;
  if (await createWorkspaceIfAbsent(ownerUserId)) {
    await seedDemoSpace(ownerUserId, choice);
    return;
  }
  // Une préparation interrompue : cette requête, seule à la mettre de côté, la reprend jusqu'au bout.
  if (await archiveStaleDemoPreparation(ownerUserId, `${new Date().toISOString()}-reprise-${crypto.randomUUID().slice(0, 8)}`, STALE_PREPARATION_MINUTES)
    && await createWorkspaceIfAbsent(ownerUserId)) {
    await seedDemoSpace(ownerUserId, choice);
    return;
  }
  if (!(await waitUntilPrepared(ownerUserId))) throw new DemoSpacePreparingError();
}

/** Au-delà, une préparation sans ses cases cochées est tenue pour interrompue (F450). */
const STALE_PREPARATION_MINUTES = 2;

/** L'espace de l'invité se prépare dans une autre requête : la page le dit, et se relit seule (F450). */
export class DemoSpacePreparingError extends Error {
  constructor() {
    super('Préparation de votre démonstration en cours.');
    this.name = 'DemoSpacePreparingError';
  }
}

async function seedDemoSpace(ownerUserId: string, choice: DemoChoice): Promise<void> {
  const now = new Date();
  const snapshot = demoFarmSnapshot(choice.profile.id, choice.moment.dateKey);
  await saveSpecies(ownerUserId, choice, now);
  await seedDemoEquipment(ownerUserId, choice, snapshot);
  await seedDemoWeather(ownerUserId, snapshot, choice.moment.dateKey, now);
  await saveWeatherAlerts(ownerUserId, choice, now);
  if (choice.profile.features.includes('cultures')) await adoptProposals(ownerUserId, snapshot, now);
  // Le calcul du matin, que la tâche de nuit aurait fait pour une vraie ferme.
  if (choice.profile.features.includes('planning')) {
    await computeWeeklyPlanForUser({ ownerUserId, season: snapshot.configuration.seasonFirst, snapshot, now, trigger: 'daily' });
  }
  // Les cases cochées en dernier : elles disent aux autres requêtes que l'espace est prêt.
  await saveFeatureSelectionForUser(ownerUserId, choice.profile.features, now);
}

const WAIT_STEP_MS = 100;
const WAIT_STEPS = 20;

/**
 * Une autre requête prépare l'espace (la page et ses données partent
 * ensemble à la première ouverture) : on attend qu'elle ait fini, au plus
 * deux secondes. Les cases cochées, écrites en dernier, disent qu'il est
 * prêt. Dit s'il l'est ; sinon, la page dit que la démonstration se prépare
 * (F450), au lieu de montrer un espace à moitié écrit.
 */
async function waitUntilPrepared(ownerUserId: string): Promise<boolean> {
  for (let step = 0; step < WAIT_STEPS; step += 1) {
    if ((await readFeatureSelectionForUser(ownerUserId)).kind === 'stored') return true;
    await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
  }
  return false;
}

/**
 * Les objectifs de la semaine : la proposition du module pour chaque planche
 * cultivée (Kc du catalogue × ETP de la météo de la démonstration), adoptée
 * comme la ferme le ferait d'un clic dans « Besoin par culture ». Aucun
 * chiffre saisi : une planche sans proposition complète reste sans objectif.
 *
 * Recensé au code (lot F, F296) : à chacun des quatre moments du maraîchage,
 * toute planche cultivée reçoit sa proposition ; seules restent sans
 * objectif les planches où rien ne pousse cette semaine-là. Le module ne
 * propose aucun objectif pour la ferme entière : en poser un demanderait un
 * chiffre saisi, une valeur agronomique, et il s'appliquerait aussi aux
 * planches vides. Aucun n'est inventé.
 *
 * Les propositions de toutes les planches se lisent ensemble, puis les
 * adoptions s'écrivent d'un coup (accélérer le site, A2, D-359) : les mêmes
 * que planche après planche, dans le même ordre ; l'adoption d'une planche ne
 * change ni la proposition ni l'objectif d'une autre.
 */
async function adoptProposals(ownerUserId: string, snapshot: IrrigationSnapshot, now: Date): Promise<void> {
  const season = snapshot.configuration.seasonFirst;
  const proposals = await getBedWeekProposalsForUser({ ownerUserId, season, snapshot, now });
  const revisions = proposals.flatMap(({ bed, weekOpen, proposal }) => {
    const revision = weekOpen ? adoptionRevision(proposal, bed, now.toISOString()) : null;
    return revision ? [revision] : [];
  });
  await saveAdoptedGoalsForUser(ownerUserId, season, revisions);
}

/**
 * Les alertes météo que la ferme a posées d'avance (F295) : le modèle de la
 * page « Alertes météo », enregistré tel quel, comme la ferme le ferait d'un
 * clic sur le modèle puis « Enregistrer l'alerte ».
 */
async function saveWeatherAlerts(ownerUserId: string, choice: DemoChoice, now: Date): Promise<void> {
  if (!choice.profile.features.includes('alertes-meteo')) return;
  const keys = DEMO_WEATHER_ALERT_TEMPLATES[choice.profile.id] ?? [];
  for (const template of weatherAlertTemplates(0).filter((item) => keys.includes(item.key))) {
    await createWeatherAlertCriterionForUser(ownerUserId, template.settings, now);
  }
}

/**
 * Les espèces de la ferme, rattachées comme la ferme le ferait dans Réglages
 * et dans Alertes cultures : chacune à sa culture de référence, puis à son
 * seuil de gel quand la ferme a coché les alertes cultures, écrites ensemble
 * en quelques lots (accélérer le site, A2, D-359).
 */
async function saveSpecies(ownerUserId: string, choice: DemoChoice, now: Date): Promise<void> {
  const plantIds = [...new Set(DEMO_FARMS[choice.profile.id].series.map((series) => series.plantId))];
  const frost = choice.profile.features.includes('alertes-cultures');
  const saved = await saveDemoSpeciesForUser(ownerUserId, plantIds.map((plantId) => ({
    plantId,
    referenceCropId: DEMO_SPECIES_REFERENCES[plantId] ?? null,
    frostCommonKey: frost ? DEMO_FROST_COMMON_KEYS[plantId] ?? null : null,
  })), now);
  if (!saved.ok) throw new Error(`Démonstration : espèces refusées (${saved.problems.join(' ; ')}).`);
}
