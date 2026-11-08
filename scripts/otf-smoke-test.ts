import {
  OTF_MINIMUM_REQUEST_INTERVAL_MS,
  OtfReadClient,
} from '../lib/adapters/otf/read-client.ts';
import { OtfApiError } from '../lib/domain/otf/api-contract.ts';
import {
  OtfSeasonUnavailableError,
  readOtfSeasonSnapshot,
} from '../lib/adapters/otf/snapshot-reader.ts';

const baseUrl = process.env.OTF_API_BASE_URL;
const token = process.env.OTF_API_TOKEN;

if (!baseUrl || !token) {
  throw new Error('Configuration OTF locale absente.');
}

const client = new OtfReadClient({
  baseUrl,
  token,
  minimumRequestIntervalMs: OTF_MINIMUM_REQUEST_INTERVAL_MS,
});

try {
  const seasonArgumentIndex = process.argv.indexOf('--season');
  const configuredSeason = Number(
    seasonArgumentIndex >= 0
      ? process.argv[seasonArgumentIndex + 1]
      : process.env.OTF_TEST_SEASON,
  );
  const season = Number.isInteger(configuredSeason)
    ? configuredSeason
    : new Date().getFullYear();
  const snapshot = await readOtfSeasonSnapshot(client, season);

  console.log(`Connexion API OTF réussie (10 routes GET, saison ${season}).`);
  console.log(`Saisons : ${snapshot.configuration.seasonFirst} à ${snapshot.configuration.seasonLast}`);
  console.log(`Parcelles : ${snapshot.zones.length}`);
  console.log(`Jardins et abris : ${snapshot.plots.length}`);
  console.log(`Planches : ${snapshot.beds.length}`);
  const plan = snapshot.cropPlan;
  if (plan) {
    console.log(`Séries de la saison : ${plan.series.length} sur ${plan.readSummary.seriesRead} lues, dont ${plan.series.filter((item) => item.use === 'block').length} en bloc`);
    console.log(`Emplacements : ${plan.places.length} sur ${plan.readSummary.placesRead} lus (sans série ${plan.readSummary.placesWithoutSeries}, série inconnue ${plan.readSummary.placesOfUnknownSeries}, planche absente ${plan.readSummary.placesWithUnknownBed})`);
    console.log(`Tâches d'implantation retenues : ${plan.readSummary.tasksRetained} sur ${plan.readSummary.tasksRead} lues`);
  }

  if (process.argv.includes('--verify-errors')) {
    await verifyRealErrorStates(snapshot.configuration.seasonFirst);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Erreur OTF inconnue.';
  console.error(`Échec du test de lecture : ${message}`);
  process.exitCode = 1;
}

async function verifyRealErrorStates(seasonFirst: number) {
  const unavailableSeason = seasonFirst - 1;
  try {
    await readOtfSeasonSnapshot(client, unavailableSeason);
    throw new Error(`La saison hors plage ${unavailableSeason} a été acceptée.`);
  } catch (error) {
    if (
      !(error instanceof OtfSeasonUnavailableError) ||
      error.requestedSeason !== unavailableSeason
    ) {
      throw error;
    }
    console.log(
      `Saison hors plage rejetée avant les listes : ${unavailableSeason}.`,
    );
  }

  const invalidClient = new OtfReadClient({
    baseUrl: baseUrl as string,
    token: 'invalid-read-token-for-contract-test',
    minimumRequestIntervalMs: OTF_MINIMUM_REQUEST_INTERVAL_MS,
  });
  try {
    await invalidClient.getConfiguration();
    throw new Error('La clé volontairement invalide a été acceptée par OTF.');
  } catch (error) {
    if (
      !(error instanceof OtfApiError) ||
      (error.status !== 401 && error.status !== 403)
    ) {
      throw error;
    }
    console.log(
      `Authentification invalide rejetée par OTF : statut ${error.status}, sans nouvel essai.`,
    );
  }
}
