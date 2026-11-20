import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { readOnboardingStepsForUser } from '../../db/onboarding-repository';
import { saveWeatherPreferenceForUser } from '../../db/water-management-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { locationConfirmed, unfinishedSteps, verificationLine } from '../../lib/domain/onboarding/steps';
import type { WeatherProvider } from '../../lib/domain/weather/weather-provider';
import { getOnboardingForUser } from '../../lib/services/onboarding-service';
import { UNCONFIRMED_LOCATION_MESSAGE, getWaterDashboardForUser } from '../../lib/services/water-dashboard';
import { readWeatherPreference } from '../../lib/services/weather-preference';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * « Où est la ferme » (4.4, docs/tranche-4-contract.md, F419, F582 ; preuves
 * 1, 2 et 3 de la section 8 bis.6) : une ferme neuve n'a pas de commune tant
 * que la personne ne l'a pas choisie, le siège de sa structure n'est jamais
 * pris en silence, et choisir confirme l'étape avec ce qui a été choisi.
 */

let database: TestDatabase;
const savedDemoMode = process.env.DEMO_MODE;
beforeEach(() => {
  database = installTestDatabase();
  delete process.env.DEMO_MODE;
});
afterEach(() => {
  database.dispose();
  if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = savedDemoMode;
});

const NOW = new Date('2026-11-20T09:00:00.000Z');

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2026, seasonLast: 2026 },
  structure: { id: '4394', name: 'Ferme v2', legalCity: 'Saint-Aubin', legalPostcode: '03160', legalCountry: 'FR' },
  zones: [],
  plots: [],
  beds: [],
  source: 'cache',
  lastSuccessfulReadAt: '2026-11-20T08:00:00.000Z',
};

/** Un fournisseur qui compte chaque appel : une ferme neuve ne doit en faire aucun. */
class CountingProvider implements WeatherProvider {
  readonly id = 'compteur';
  calls: string[] = [];
  async searchLocations(query: string) {
    this.calls.push(`geocodage:${query}`);
    return [{ displayName: 'Saint-Aubin · 03160', city: 'Saint-Aubin', postcode: '03160', latitude: 46.5, longitude: 3.3, timezone: 'Europe/Paris', countryCode: 'FR' }];
  }
  async readForecast() {
    this.calls.push('prevision');
    return [];
  }
  async readReanalysis() {
    this.calls.push('reanalyse');
    return [];
  }
}

test('ferme neuve : aucune commune, ni le siège de la structure ; la page le dit et rien n’est demandé à la météo (défaut n° 19)', async () => {
  await ensureWorkspaceForUser(ALICE);
  const preference = await readWeatherPreference(ALICE);
  assert.equal(preference.locationConfirmed, false);
  assert.equal(preference.locationMode, 'otf', 'le mode enregistré par défaut ne change pas ; c’est la confirmation qui manque');

  const provider = new CountingProvider();
  const dashboard = await getWaterDashboardForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW, provider });
  assert.equal(dashboard.weather.locationKey, null);
  assert.equal(dashboard.weather.location, null);
  assert.equal(dashboard.weather.requestedLocationLabel, null, 'le siège n’est pas nommé comme lieu de la météo');
  assert.equal(dashboard.weather.error, UNCONFIRMED_LOCATION_MESSAGE);
  assert.deepEqual(provider.calls, []);
});

test('le siège pris d’un geste, en dernier recours, confirme l’étape et le dit ; la météo suit', async () => {
  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'otf', customCity: null, customPostcode: null, legalCity: 'Saint-Aubin', legalPostcode: '03160' });
  const onboarding = await getOnboardingForUser(ALICE);
  assert.equal(locationConfirmed(onboarding), true);
  const step = onboarding.kind === 'onboarding' ? onboarding.steps.find((item) => item.id === 'location')! : null;
  assert.ok(step);
  assert.equal(step.state, 'confirmed');
  assert.equal(step.origin, 'onboarding');
  assert.deepEqual(step.proposedValue, { source: 'otf', city: 'Saint-Aubin', postcode: '03160' });
  assert.match(verificationLine(step).text, /^Confirmé le \d+ \S+ \d{4} : Saint-Aubin \(03160\), siège de la structure dans Ouvre ta ferme, pris en dernier recours\.$/);

  const provider = new CountingProvider();
  const dashboard = await getWaterDashboardForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW, provider });
  assert.equal(dashboard.weather.locationKey, 'otf:saint-aubin:03160');
  assert.equal(dashboard.weather.requestedLocationLabel, 'Saint-Aubin · 03160');
  assert.ok(provider.calls.includes('geocodage:Saint-Aubin'));
});

test('une commune choisie confirme l’étape avec la commune, et en changer garde la dernière', async () => {
  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'custom', customCity: 'Tronget', customPostcode: '03240' });
  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'custom', customCity: 'Rennes', customPostcode: '35000' });
  const rows = await readOnboardingStepsForUser(ALICE);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].step, 'location');
  assert.equal(rows[0].state, 'confirmed');
  assert.deepEqual(rows[0].proposedValue, { source: 'custom', city: 'Rennes', postcode: '35000' });
  const step = (await getOnboardingForUser(ALICE));
  assert.equal(step.kind, 'onboarding');
  const location = step.kind === 'onboarding' ? step.steps[0] : null;
  assert.match(verificationLine(location!).text, /: Rennes \(35000\), commune choisie\.$/);
});

test('la commune choisie par Alice ne confirme rien pour Bob (isolation des fermes et des personnes)', async () => {
  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'custom', customCity: 'Tronget', customPostcode: '03240' });
  await ensureWorkspaceForUser(BOB);
  assert.equal((await readWeatherPreference(ALICE)).locationConfirmed, true);
  assert.equal((await readWeatherPreference(BOB)).locationConfirmed, false);
  assert.deepEqual(await readOnboardingStepsForUser(BOB), []);
});

test('un espace d’avant l’accueil garde sa commune sans rien confirmer de nouveau (F426)', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  for (const step of ['location', 'plots', 'soil', 'crops', 'settings']) {
    database.sqlite.prepare(
      'INSERT INTO irrigation_onboarding_steps (workspace_id, step, state, origin, proposed_value, confirmed_at, updated_at) VALUES (?, ?, \'confirmed\', \'before-onboarding\', NULL, ?, ?)',
    ).run(workspaceId, step, NOW.toISOString(), NOW.toISOString());
  }
  const preference = await readWeatherPreference(ALICE);
  assert.equal(preference.locationConfirmed, true);
  const dashboard = await getWaterDashboardForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW, provider: new CountingProvider() });
  assert.equal(dashboard.weather.locationKey, 'otf:saint-aubin:03160');
  assert.equal(unfinishedSteps(await getOnboardingForUser(ALICE), { weather: true }).length, 0);
});

test('le bandeau « À finir » nomme la commune seulement quand une case lit la météo, et part quand elle est choisie', async () => {
  await ensureWorkspaceForUser(ALICE);
  const before = await getOnboardingForUser(ALICE);
  assert.deepEqual(unfinishedSteps(before, { weather: true }), [{ id: 'location', text: 'commune de la ferme', anchor: 'water-weather-title' }]);
  assert.deepEqual(unfinishedSteps(before, { weather: false }), []);
  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'custom', customCity: 'Tronget', customPostcode: '03240' });
  assert.deepEqual(unfinishedSteps(await getOnboardingForUser(ALICE), { weather: true }), []);
});

test('la démonstration n’a pas d’accueil : sa commune est tenue pour confirmée, sans bandeau', async () => {
  process.env.DEMO_MODE = 'true';
  assert.equal((await readWeatherPreference(ALICE)).locationConfirmed, true);
  assert.deepEqual(unfinishedSteps(await getOnboardingForUser(ALICE), { weather: true }), []);
});
