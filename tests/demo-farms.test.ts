import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test, { afterEach } from 'node:test';
import { DEMO_FARMS, demoFarmSnapshot } from '../lib/adapters/demo/farms.ts';
import { DEMO_FROST_COMMON_KEYS, DEMO_SPECIES_REFERENCES } from '../lib/adapters/demo/module-data.ts';
import { demoSeasonWeatherProvider } from '../lib/adapters/weather/demo-season-provider.ts';
import { demonstrationWeatherProvider } from '../lib/adapters/weather/demonstration-provider.ts';
import {
  cookieValue,
  DEMO_PROFILES,
  demoChoiceOfOwner,
  demoOwnerUserId,
  resolveDemoChoice,
} from '../lib/domain/demo/catalogue.ts';
import { browserClockScript } from '../lib/domain/demo/browser-clock.ts';
import { simulatedInstantMs } from '../lib/domain/demo/simulated-clock.ts';
import { isCompleteSelection } from '../lib/domain/features/selection.ts';
import { addDaysToDateKey, dateKeyInTimeZone } from '../lib/domain/water-management.ts';
import { weekKeyFromDateKey, compareWeekKeys } from '../lib/domain/week-keys.ts';
import { currentSimulatedOffsetMs, installSimulatedDate, runOnSimulatedDay, uninstallSimulatedDate } from '../lib/services/demo-clock.ts';
import { farm, largeFarm } from './support/planning-fixtures.ts';

/**
 * Les fermes fictives et leurs moments de saison (docs/demo-guided-contract.md,
 * section 6 ; D2 de la sous-tranche 4.0) : le catalogue, l'horloge simulée,
 * les plans d'Ouvre ta ferme de chaque ferme au jour de chaque moment, la
 * météo des moments, et la couche 4 : aucun nom de la ferme réelle.
 */

const ALL_CHOICES = DEMO_PROFILES.flatMap((profile) => profile.moments.map((moment) => ({ profile, moment })));

afterEach(() => uninstallSimulatedDate());

// --- Le catalogue ------------------------------------------------------------

test('trois profils et une ferme vierge ; quatre moments par profil, un seul pour la ferme vierge', () => {
  assert.deepEqual(DEMO_PROFILES.map((profile) => profile.id), ['maraichage', 'petite-ferme', 'vannes-alertes', 'vierge']);
  for (const profile of DEMO_PROFILES.slice(0, 3)) {
    assert.deepEqual(profile.moments.map((moment) => moment.id), ['gel-printemps', 'ete', 'penurie', 'automne'], profile.id);
  }
  assert.deepEqual(DEMO_PROFILES[3].moments.map((moment) => moment.id), ['ete']);
});

test('les cases cochées d’avance forment un choix complet, et la ferme vierge n’en coche aucune', () => {
  for (const profile of DEMO_PROFILES.slice(0, 3)) assert.equal(isCompleteSelection(profile.features), true, profile.id);
  assert.deepEqual(DEMO_PROFILES[3].features, []);
  assert.deepEqual(DEMO_PROFILES[1].features, ['arrosages', 'besoins', 'materiel', 'calculateur']);
  assert.deepEqual(DEMO_PROFILES[2].features, ['materiel', 'alertes-meteo']);
});

test('un choix illisible revient au premier profil et à son premier moment ; un moment absent du profil, à son premier', () => {
  assert.deepEqual(ids(resolveDemoChoice(undefined, undefined)), ['maraichage', 'gel-printemps']);
  assert.deepEqual(ids(resolveDemoChoice('inconnu', 'penurie')), ['maraichage', 'penurie']);
  assert.deepEqual(ids(resolveDemoChoice('vierge', 'penurie')), ['vierge', 'ete']);
  assert.deepEqual(ids(resolveDemoChoice('petite-ferme', 'automne')), ['petite-ferme', 'automne']);
});

test('les témoins se lisent dans l’en-tête, sans confondre deux noms voisins', () => {
  const header = 'autre=1; demo-profil=petite-ferme; demo-moment=penurie; demo-profil-x=vierge';
  assert.equal(cookieValue(header, 'demo-profil'), 'petite-ferme');
  assert.equal(cookieValue(header, 'demo-moment'), 'penurie');
  assert.equal(cookieValue(header, 'absent'), undefined);
  assert.equal(cookieValue(null, 'demo-profil'), undefined);
});

// --- Couche 5 : un espace par invité, par ferme et par moment ------------------

test('couche 5 : chaque invité, chaque ferme et chaque moment a son espace, et l’identité se relit', () => {
  const owners = new Set<string>();
  for (const guest of ['invite-a', 'invite-b']) {
    for (const choice of ALL_CHOICES) {
      const owner = demoOwnerUserId(guest, choice);
      assert.equal(owners.has(owner), false, owner);
      owners.add(owner);
      assert.deepEqual(ids(demoChoiceOfOwner(owner)!), [choice.profile.id, choice.moment.id]);
    }
  }
  assert.equal(owners.size, 2 * 13);
  // Une identité hors démonstration, ou forgée, ne se lit pas comme un espace de démonstration.
  for (const forged of ['invite-a', 'invite-a·demo·maraichage', 'invite-a·demo·maraichage·penurie·x', 'invite-a·demo·vierge·penurie', 'x·demo·inconnu·ete']) {
    assert.equal(demoChoiceOfOwner(forged), null, forged);
  }
});

// --- L'horloge simulée -------------------------------------------------------

test('le jour du moment, à l’heure réelle de la ferme, même d’une heure d’hiver à une heure d’été', () => {
  const realNow = Date.parse('2026-11-13T09:52:07.250Z'); // vendredi 10 h 52 à la ferme (UTC+1)
  assert.equal(new Date(simulatedInstantMs(realNow, '2026-07-21')).toISOString(), '2026-07-21T08:52:07.250Z'); // 10 h 52 en été (UTC+2)
  assert.equal(new Date(simulatedInstantMs(realNow, '2026-04-14')).toISOString(), '2026-04-14T08:52:07.250Z');
  const lateEvening = Date.parse('2026-11-13T22:30:00.000Z'); // samedi 23 h 30 à la ferme : le jour du moment, pas le lendemain
  assert.equal(new Date(simulatedInstantMs(lateEvening, '2026-10-20')).toISOString(), '2026-10-20T21:30:00.000Z');
  // Samedi 0 h 03 à la ferme : le 14 avril à 0 h 03 tombe encore le 13 avril en UTC ; son texte, relu à l'heure de la
  // ferme, dit bien le 14 (point ouvert 67 : le test suivant le lisait au fuseau du processus et échouait de 0 h à 2 h).
  const afterMidnight = simulatedInstantMs(Date.parse('2026-11-13T23:03:00.000Z'), '2026-04-14');
  assert.equal(new Date(afterMidnight).toISOString(), '2026-04-13T22:03:00.000Z');
  assert.equal(dateKeyInTimeZone(new Date(new Date(afterMidnight).toString())), '2026-04-14');
});

test('l’horloge simulée ne vaut que dans la requête de l’invité : deux moments à la fois ne se gênent pas', async () => {
  installSimulatedDate();
  const realDay = dateKeyInTimeZone(new Date());
  const seen = await Promise.all(['2026-04-14', '2026-07-21'].map((day) => runOnSimulatedDay(day, async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const viaConstructor = dateKeyInTimeZone(new Date());
    await new Promise((resolve) => setTimeout(resolve, 5));
    return [viaConstructor, dateKeyInTimeZone(new Date(Date.now()))];
  })));
  assert.deepEqual(seen, [['2026-04-14', '2026-04-14'], ['2026-07-21', '2026-07-21']]);
  assert.equal(dateKeyInTimeZone(new Date()), realDay, 'hors requête, l’horloge réelle');
  runOnSimulatedDay('2026-04-14', () => {
    assert.equal(new Date('2026-01-01T00:00:00.000Z').toISOString(), '2026-01-01T00:00:00.000Z', 'une date donnée reste la même');
    assert.equal(new Date(0).getTime(), 0);
    assert.ok(new Date() instanceof Date);
    // Le texte de `Date()` est écrit au fuseau du processus (UTC sur la CI) : son jour se lit à l'heure de la ferme (point ouvert 67).
    assert.equal(dateKeyInTimeZone(new Date(Date())), '2026-04-14', 'Date() sans new : le texte du jour du moment');
    assert.equal(Date.UTC(2026, 0, 1), Date.parse('2026-01-01T00:00:00.000Z'));
  });
});

// --- Les plans des fermes fictives -------------------------------------------

test('chaque ferme, à chaque moment : un plan cohérent, des surfaces calculées, des cultures sur ses planches', () => {
  for (const { profile, moment } of ALL_CHOICES) {
    const snapshot = demoFarmSnapshot(profile.id, moment.dateKey);
    const label = `${profile.id} · ${moment.id}`;
    const zoneIds = new Set(snapshot.zones.map((zone) => zone.id));
    const plotIds = new Set(snapshot.plots.map((plot) => plot.id));
    const bedIds = new Set(snapshot.beds.map((bed) => bed.id));
    assert.ok(snapshot.beds.length >= 4, label);
    assert.equal(bedIds.size, snapshot.beds.length, `${label} : identifiants uniques`);
    for (const plot of snapshot.plots) assert.ok(zoneIds.has(plot.zoneId), label);
    for (const bed of snapshot.beds) {
      assert.ok(plotIds.has(bed.plotId) && zoneIds.has(bed.zoneId), label);
      assert.equal(bed.area, Math.round(bed.length * bed.width * 100) / 100, label);
    }
    const plan = snapshot.cropPlan!;
    const seriesIds = new Set(plan.series.map((series) => series.id));
    for (const place of plan.places) assert.ok(bedIds.has(place.bedId) && seriesIds.has(place.seriesId), label);
    assert.equal(snapshot.source, 'mock');
    assert.equal(snapshot.lastSuccessfulReadAt.slice(0, 10), moment.dateKey);
  }
  assert.equal(demoFarmSnapshot('vierge', '2026-06-16').cropPlan!.series.length, 0);
});

test('le plan se lit au jour du moment : implanté et récolté avant, à faire après', () => {
  const momentWeek = (dateKey: string) => weekKeyFromDateKey(dateKey);
  for (const { profile, moment } of ALL_CHOICES) {
    const plan = demoFarmSnapshot(profile.id, moment.dateKey).cropPlan!;
    for (const task of plan.implantationTasks) {
      const before = compareWeekKeys(task.plannedWeek!, momentWeek(moment.dateKey)) <= 0;
      assert.equal(task.status, before ? 'done' : 'todo', `${profile.id} ${moment.id} ${task.id}`);
      assert.equal(task.doneWeek, before ? task.plannedWeek : null);
    }
    for (const series of plan.series) {
      for (const week of series.cultivations[0].harvestWeeks) assert.ok(compareWeekKeys(week, momentWeek(moment.dateKey)) <= 0);
    }
  }
  const tomatoes = (dateKey: string) => demoFarmSnapshot('maraichage', dateKey).cropPlan!.series.find((series) => series.id === 'serie-tomates')!.cultivations[0];
  assert.deepEqual(tomatoes('2026-04-14').harvestWeeks, []);
  assert.equal(tomatoes('2026-10-20').harvestWeeks.length, 13, 'à l’automne, toutes les semaines de récolte sont passées');
});

test('uniquement des espèces du catalogue Kc validé (migration 0023)', () => {
  const catalogue = readFileSync('drizzle/0023_crop_water_need.sql', 'utf8');
  for (const definition of Object.values(DEMO_FARMS)) {
    for (const series of definition.series) {
      const reference = DEMO_SPECIES_REFERENCES[series.plantId];
      assert.ok(reference, `${series.plantId} sans culture de référence`);
      assert.ok(catalogue.includes(`'${reference}'`), `${reference} absent du catalogue`);
    }
  }
});

test('les seuils de gel viennent du jeu commun (migration 0026), sans valeur propre', () => {
  const common = readFileSync('drizzle/0026_crop_alerts.sql', 'utf8');
  for (const [plantId, key] of Object.entries(DEMO_FROST_COMMON_KEYS)) {
    assert.ok(DEMO_SPECIES_REFERENCES[plantId], `${plantId} n’est pas une espèce des fermes fictives`);
    assert.ok(common.includes(`('${key}', `), `${key} absent du jeu commun`);
  }
});

test('chaque ferme a sa commune, que la météo de la démonstration connaît', async () => {
  const cities = Object.values(DEMO_FARMS).filter((definition) => definition.series.length > 0).map((definition) => definition.city);
  assert.equal(new Set(cities).size, 3);
  for (const definition of Object.values(DEMO_FARMS)) {
    const found = await demoSeasonWeatherProvider.searchLocations(definition.city, definition.postcode);
    assert.equal(found.length, 1, definition.city);
  }
});

// --- Couche 4 : aucun nom de la ferme réelle -----------------------------------

function namesIn(value: unknown, into = new Set<string>(), key = ''): Set<string> {
  if (typeof value === 'string') {
    if (/name$/i.test(key)) into.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) namesIn(item, into, key);
  } else if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) namesIn(child, into, childKey);
  }
  return into;
}

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();

test('couche 4 : aucun nom de lieu, de planche, de parcelle ni de matériel de la ferme réelle n’est repris', () => {
  const real = new Set<string>();
  namesIn(farm({ extraTunnels: true }), real);
  namesIn(largeFarm(), real);
  real.add('Clémentière');
  real.add('Champ de l’Aurore');
  const realNames = [...real].map(normalize).filter((name) => name.length > 0);
  assert.ok(realNames.length > 40, `les jeux de la ferme réelle sont lus (${realNames.length} noms)`);

  const demo = new Set<string>();
  for (const profile of DEMO_PROFILES) {
    for (const moment of profile.moments) namesIn(demoFarmSnapshot(profile.id, moment.dateKey), demo);
  }
  const offending = [...demo].filter((name) => {
    const text = normalize(name);
    const words = new Set(text.split(/[\s-]+/));
    return realNames.some((realName) => text === realName || (realName.includes(' ') ? text.includes(realName) : words.has(realName) && realName.length > 3));
  });
  assert.deepEqual(offending, []);
});

// --- Un test par moment ------------------------------------------------------

async function forecastFrom(dateKey: string, days: number) {
  return demoSeasonWeatherProvider.readForecast({ latitude: 47.2181, longitude: -1.5528, startDate: dateKey, endDate: addDaysToDateKey(dateKey, days - 1), timezone: 'Europe/Paris' } as Parameters<typeof demoSeasonWeatherProvider.readForecast>[0]);
}

for (const moment of DEMO_PROFILES[0].moments) {
  test(`moment « ${moment.label} » : la démonstration se joue le ${moment.dateKey}, et montre ce qu’elle annonce`, async () => {
    installSimulatedDate();
    await runOnSimulatedDay(moment.dateKey, async () => {
      assert.equal(dateKeyInTimeZone(new Date()), moment.dateKey);
      const forecast = await forecastFrom(dateKeyInTimeZone(new Date()), 7);
      const plan = demoFarmSnapshot('maraichage', dateKeyInTimeZone(new Date())).cropPlan!;
      const inPlace = plan.implantationTasks.filter((task) => task.status === 'done').map((task) => task.seriesId);
      if (moment.id === 'gel-printemps') {
        assert.ok(forecast.slice(1, 3).some((day) => (day.minimumTemperatureCelsius ?? 99) < 0), 'une nuit de gel annoncée dans les deux jours');
        assert.ok(inPlace.includes('serie-tomates') && inPlace.includes('serie-radis'), 'des cultures en place pour l’alerte');
      } else if (moment.id === 'penurie') {
        assert.ok(forecast.every((day) => day.precipitationMm === 0 && (day.et0Mm ?? 0) >= 5.5), 'une semaine sèche et chaude');
      } else {
        const plain = await demonstrationWeatherProvider.readForecast({ latitude: 0, longitude: 0, startDate: moment.dateKey, endDate: addDaysToDateKey(moment.dateKey, 6), timezone: 'Europe/Paris' } as Parameters<typeof demonstrationWeatherProvider.readForecast>[0]);
        // La météo des parcours, réchauffée selon le mois : la même pluie, des nuits sans gel.
        assert.deepEqual(forecast.map((day) => day.precipitationMm), plain.map((day) => day.precipitationMm), 'la pluie ordinaire de la démonstration');
        assert.ok(forecast.every((day) => (day.minimumTemperatureCelsius ?? 0) >= 3.5), 'aucune nuit froide');
        if (moment.id === 'ete') assert.ok(forecast.every((day) => (day.minimumTemperatureCelsius ?? 0) >= 9), 'des nuits d’été');
        if (moment.id === 'ete') assert.ok(inPlace.length >= 6, 'la saison bat son plein');
        if (moment.id === 'automne') {
          const harvested = plan.series.filter((series) => series.cultivations[0].harvestWeeks.length > 0);
          assert.ok(harvested.length >= 6, 'des récoltes faites, pour l’historique');
        }
      }
    });
  });
}

function ids(choice: { profile: { id: string }; moment: { id: string } }) {
  return [choice.profile.id, choice.moment.id];
}

// --- L'horloge du navigateur ---------------------------------------------------

test('l’horloge du navigateur se décale du même écart que le serveur, et ne porte qu’un nombre', () => {
  const offset = simulatedInstantMs(Date.now(), '2026-07-21') - Date.now();
  const window: { Date?: DateConstructor } = {};
  vm.runInNewContext(browserClockScript(offset), { window, Date, Reflect, Array });
  const Simulated = window.Date!;
  assert.ok(Math.abs(Simulated.now() - (Date.now() + offset)) < 1000);
  assert.equal(dateKeyInTimeZone(new Simulated(), 'Europe/Paris'), '2026-07-21');
  assert.equal(new Simulated(0).getTime(), 0, 'une date donnée reste cette date');
  assert.equal(new Simulated('2026-04-14T06:00:00.000Z').toISOString(), '2026-04-14T06:00:00.000Z');
  assert.ok(new Simulated() instanceof Date);
  assert.match(String((Simulated as unknown as () => string)()), /2026/);
  for (const unreadable of [Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
    assert.throws(() => browserClockScript(unreadable), RangeError);
  }
});

test('hors d’une requête de démonstration, aucun écart : la page n’écrit aucun script d’horloge', () => {
  assert.equal(currentSimulatedOffsetMs(), null);
  const inside = runOnSimulatedDay('2026-10-20', () => currentSimulatedOffsetMs());
  assert.equal(typeof inside, 'number');
  assert.equal(currentSimulatedOffsetMs(), null);
  assert.match(readFileSync('app/layout.tsx', 'utf8'), /offset === null \? null :/);
});
