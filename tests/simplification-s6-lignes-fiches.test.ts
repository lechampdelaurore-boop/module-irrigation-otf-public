import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FEATURE_IDS } from '../lib/domain/features/catalogue.ts';
import { FARM_CARD_LINES, farmCards } from '../lib/domain/features/farm-cards.ts';
import { farmCardPages } from '../lib/domain/features/places.ts';
import { startWaySelection } from '../lib/domain/features/start.ts';
import { farmCardLines, type FarmHomeCounts } from '../lib/domain/farm-home/lines.ts';
import { startRoute, type RouteCounts } from '../lib/domain/onboarding/route.ts';
import type { UnfinishedStep } from '../lib/domain/onboarding/steps.ts';
import { TECHNICAL_WORDS } from '../lib/domain/simple-words.ts';
import type { ReservoirState } from '../lib/domain/today/water.ts';

/**
 * Simplifier l'usage du module, lot S6, PR 3 : les lignes d'état des fiches
 * de « Ma ferme » (docs/simplification-s6-contract.md, section 7). Les règles
 * qui se lisent sans base : chaque ligne, chaque repli vers la ligne fixe de
 * S3, la marque « À faire » à côté de la ligne d'état. La lecture et les deux
 * fermes sont dans `tests/db/simplification-s6-lignes-fiches.test.ts`.
 */

/** Un mercredi : la semaine commence le lundi 7 septembre. */
const NOW = new Date('2026-09-09T08:00:00.000Z');
const ALL = [...FEATURE_IDS];

/** Une ferme dont rien n'est lu : toutes les fiches gardent leur ligne fixe. */
const UNKNOWN: FarmHomeCounts = { equipment: null, water: null, crops: null, soil: null, weatherAlerts: null, weather: null };

function reservoir(name: string, volume: number | null, observedAt: string | null): ReservoirState {
  return { id: `r-${name}`, name, capacityCubicMeters: 40, currentVolumeCubicMeters: volume, currentVolumeObservedAt: observedAt, minimumSafetyCubicMeters: 0 };
}

function lines(counts: Partial<FarmHomeCounts>, options: { enabled?: readonly (typeof FEATURE_IDS)[number][]; usesWeather?: boolean } = {}) {
  return farmCardLines({ enabled: options.enabled ?? ALL, usesWeather: options.usesWeather ?? true, counts: { ...UNKNOWN, ...counts }, now: NOW });
}

test('section 7.2 : « Matériel et placement » compte les matériels par sorte, posés ou non', () => {
  const line = (drip: number, sprinkler: number, posed: number) => lines({ equipment: { drip, sprinkler, posed } }).materiel;
  assert.equal(line(4, 0, 4), '4 goutte-à-goutte, tous posés');
  assert.equal(line(4, 0, 3), '4 goutte-à-goutte, 1 pas posé');
  assert.equal(line(4, 0, 1), '4 goutte-à-goutte, 3 pas posés');
  assert.equal(line(2, 1, 3), '2 goutte-à-goutte et 1 aspersion, tous posés');
  assert.equal(line(0, 2, 0), '2 aspersions, aucun posé');
  assert.equal(line(1, 0, 1), '1 goutte-à-goutte, posé');
  assert.equal(line(1, 0, 0), '1 goutte-à-goutte, pas posé');
  // Aucun matériel : la ligne fixe, jamais « 0 goutte-à-goutte ».
  assert.equal(line(0, 0, 0), undefined);
});

test('section 7.2 : « Ressources et pompes » dit une ressource, une réserve à sa date, ou compte, sans additionner les volumes', () => {
  const water = (resources: { name: string; nominalFlowCubicMetersPerHour: number }[], reservoirs: ReservoirState[]) => lines({ water: { resources, reservoirs } }).ressources;
  const puits = { name: 'Puits', nominalFlowCubicMetersPerHour: 2 };
  assert.equal(water([puits], []), 'Puits : débit de 2 m³/h');
  // Une réserve : la phrase du bloc « Eau disponible » d'« Aujourd'hui », le volume à sa date.
  assert.equal(water([], [reservoir('Bassin des noues', 30, '2026-09-09T06:00:00.000Z')]), 'Bassin des noues : 30 m³ sur 40 m³, observé aujourd’hui');
  assert.equal(water([], [reservoir('Cuve', null, null)]), 'Cuve : volume jamais saisi');
  assert.match(water([], [reservoir('Cuve', 12, '2026-09-04T06:00:00.000Z')]) ?? '', /^Cuve : 12 m³ sur 40 m³, observé le 4 sept\. 2026 \(5 jours\)$/u);
  // Plusieurs : un compte ; les réserves observées depuis le lundi.
  const thisWeek = reservoir('Bassin', 30, '2026-09-07T06:00:00.000Z');
  const lastWeek = reservoir('Cuve', 10, '2026-09-06T18:00:00.000Z');
  const never = reservoir('Citerne', null, null);
  assert.equal(water([puits], [thisWeek]), '1 ressource et 1 réserve, observée cette semaine');
  assert.equal(water([puits], [lastWeek]), '1 ressource et 1 réserve, pas observée cette semaine');
  assert.equal(water([puits], [thisWeek, lastWeek]), '1 ressource et 2 réserves, 1 observée cette semaine');
  assert.equal(water([], [thisWeek, { ...thisWeek, id: 'r2', name: 'Mare' }]), '2 réserves, toutes observées cette semaine');
  assert.equal(water([], [lastWeek, never]), '2 réserves, aucune observée cette semaine');
  assert.equal(water([puits, { name: 'Forage', nominalFlowCubicMetersPerHour: 4 }, { name: 'Rivière', nominalFlowCubicMetersPerHour: 8 }], []), '3 ressources');
  // Jamais une somme de volumes ni de débits entre plusieurs ressources.
  assert.doesNotMatch(water([puits], [thisWeek, lastWeek]) ?? '', /m³/u);
  assert.equal(water([], []), undefined);
});

test('section 7.2 : « Besoin par culture » compte ses cultures de la saison, le titre et la phrase de la page', () => {
  const line = (inUse: number, species: number) => lines({ crops: { inUse, species } }).cultures;
  // « Vos cultures cette saison (6) » : six cultures servent à huit espèces.
  assert.equal(line(6, 8), '6 cultures cette saison');
  assert.equal(line(1, 2), '1 culture cette saison');
  // Des espèces plantées, aucune rattachée : la phrase de la page, jamais « 0 culture ».
  assert.equal(line(0, 4), 'Aucune culture ne sert à vos séries cette saison');
  // Aucune espèce plantée : la ligne fixe.
  assert.equal(line(0, 0), undefined);
  // Les espèces à rattacher se comptent dans Réglages, où elles se rattachent : la ligne n'en dit rien.
  assert.doesNotMatch(line(1, 8) ?? '', /rattach|espèce/u);
});

test('section 7.2 : « Réserve du sol » compte les parcelles de la saison', () => {
  const line = (withoutSoil: number, total: number) => lines({ soil: { withoutSoil, total } }).sol;
  assert.equal(line(0, 6), 'Sol connu pour 6 parcelles sur 6');
  assert.equal(line(3, 6), 'À renseigner pour 3 parcelles');
  assert.equal(line(1, 1), 'À renseigner pour 1 parcelle');
  assert.equal(line(0, 1), 'Sol connu pour 1 parcelle sur 1');
  assert.equal(line(0, 0), undefined);
});

test('section 7.2 : « Alertes météo » compte les alertes réglées, et les inactives sous le mot de la page', () => {
  const line = (total: number, active: number) => lines({ weatherAlerts: { total, active } })['alertes-meteo'];
  assert.equal(line(0, 0), 'Aucune alerte réglée');
  assert.equal(line(1, 1), '1 alerte réglée');
  assert.equal(line(2, 2), '2 alertes réglées');
  assert.equal(line(2, 1), '2 alertes réglées, 1 inactive');
  assert.equal(line(3, 0), '3 alertes réglées, 3 inactives');
  // Lecture indisponible : la ligne fixe.
  assert.equal(lines({})['alertes-meteo'], undefined);
});

test('section 7.2 : « Réglages » dit la commune de la météo et les cases cochées ; les messages du téléphone n’y sont pas (S6-g)', () => {
  assert.equal(lines({ weather: { city: 'Nantes', confirmed: true } }).reglages, 'Météo de Nantes · 11 fonctionnalités cochées');
  assert.equal(lines({ weather: { city: null, confirmed: false } }).reglages, 'Commune à confirmer · 11 fonctionnalités cochées');
  const notes = startWaySelection('notes');
  assert.equal(lines({ weather: { city: null, confirmed: false } }, { enabled: notes, usesWeather: false }).reglages, `${notes.length} fonctionnalités cochées`.replace(/^./u, (first) => first.toUpperCase()));
  // Une commune confirmée mais introuvable (siège vide) : la ligne fixe, pas un lieu inventé.
  assert.equal(lines({ weather: { city: null, confirmed: true } }).reglages, undefined);
  assert.doesNotMatch(Object.values(lines({ weather: { city: 'Nantes', confirmed: true } })).join(' '), /message|téléphone|notification/iu);
});

test('section 7.2 : « Alertes cultures » garde sa ligne fixe (repli gardé)', () => {
  const full = lines({
    equipment: { drip: 4, sprinkler: 0, posed: 4 },
    water: { resources: [{ name: 'Puits', nominalFlowCubicMetersPerHour: 2 }], reservoirs: [] },
    crops: { inUse: 6, species: 8 },
    soil: { withoutSoil: 0, total: 6 },
    weatherAlerts: { total: 2, active: 2 },
    weather: { city: 'Nantes', confirmed: true },
  });
  assert.deepEqual(Object.keys(full).sort(), ['alertes-meteo', 'cultures', 'materiel', 'reglages', 'ressources', 'sol']);
  const cards = farmCards(ALL, [], full);
  assert.deepEqual(cards.find((card) => card.page === 'alertes-cultures'), { page: 'alertes-cultures', line: FARM_CARD_LINES['alertes-cultures'], lineKind: 'fixed', todo: null });
});

test('section 7.1 : la ligne d’état remplace la ligne fixe, la marque « À faire » reste à côté', () => {
  const unfinished: UnfinishedStep[] = [{ id: 'soil', text: 'sol de 3 parcelles à saisir', page: 'sol', anchor: 'soil-parcel-z1' }];
  const cards = farmCards(ALL, unfinished, lines({ soil: { withoutSoil: 3, total: 6 } }));
  assert.deepEqual(cards.find((card) => card.page === 'sol'), {
    page: 'sol', line: 'À renseigner pour 3 parcelles', lineKind: 'state', todo: 'À faire : sol de 3 parcelles à saisir',
  });
  // Les autres fiches, sans donnée lue : leur ligne fixe, sans marque.
  for (const card of cards.filter((item) => item.page !== 'sol')) {
    assert.equal(card.line, FARM_CARD_LINES[card.page], card.page);
    assert.equal(card.lineKind, 'fixed', card.page);
  }
  // Sans lignes du tout (une autre page, une lecture absente) : les fiches de S3, telles quelles.
  assert.deepEqual(farmCards(ALL, []).map((card) => [card.line, card.lineKind]), farmCardPages(ALL).map((page) => [FARM_CARD_LINES[page], 'fixed']));
});

test('section 7.1 : jamais un « 0 » ni un trou pour un inconnu, aucun mot du calcul (D-003, S1)', () => {
  const samples: Partial<FarmHomeCounts>[] = [
    UNKNOWN,
    { equipment: { drip: 0, sprinkler: 0, posed: 0 }, water: { resources: [], reservoirs: [] }, crops: { inUse: 0, species: 0 }, soil: { withoutSoil: 0, total: 0 } },
    { equipment: { drip: 2, sprinkler: 1, posed: 1 }, water: { resources: [{ name: 'Puits', nominalFlowCubicMetersPerHour: 2 }], reservoirs: [reservoir('Bassin', null, null)] }, crops: { inUse: 0, species: 3 }, soil: { withoutSoil: 2, total: 2 }, weatherAlerts: { total: 1, active: 0 }, weather: { city: 'Rennes', confirmed: true } },
  ];
  for (const counts of samples) {
    for (const card of farmCards(ALL, [], lines(counts))) {
      assert.doesNotMatch(card.line, /(^|\s)0(\s|$)|undefined|null|NaN/u, `${card.page} : ${card.line}`);
      for (const word of TECHNICAL_WORDS) assert.ok(!card.line.includes(word), `${card.page} : « ${word} »`);
    }
  }
  // Ce qui est inconnu ou vide garde la ligne fixe : aucune ligne d'état.
  assert.deepEqual(lines(samples[1]), {});
  assert.deepEqual(lines(UNKNOWN), {});
});

test('section 7.1 : une seule lecture, plusieurs phrases ; la ligne du matériel et l’étape 1 disent les mêmes sortes', () => {
  const routeCounts: RouteCounts = {
    equipment: { drip: 2, sprinkler: 1, withoutSetting: 0 },
    placement: { watered: 4, total: 18 },
    water: { names: ['Puits'], total: 1 },
    objective: { withObjective: 0, total: 18 },
    soil: { withoutSoil: 3, total: 6, anchor: 'soil-parcel-z1' },
  };
  const route = startRoute({ startMode: 'all', routeState: null, enabled: ALL, counts: routeCounts });
  assert.equal(route.kind, 'card');
  if (route.kind !== 'card') return;
  const home = lines({ equipment: { drip: 2, sprinkler: 1, posed: 3 }, soil: { withoutSoil: 3, total: 6 } });
  const equipmentStep = route.steps.find((step) => step.id === 'equipment');
  assert.equal(equipmentStep?.line, '2 goutte-à-goutte et 1 aspersion');
  assert.ok(home.materiel?.startsWith(`${equipmentStep?.line}, `), home.materiel);
  // La ligne du sol et l'étape 5 comptent les mêmes parcelles.
  assert.match(home.sol ?? '', /3 parcelles/u);
  assert.match(route.steps.find((step) => step.id === 'soil')?.line ?? '', /3 parcelles/u);
});

test('section 7 : la page lit les lignes avec la carte, une seule lecture ; la fiche dit aux parcours quelle ligne elle porte', () => {
  const page = readFileSync('app/irrigation/ma-ferme/page.tsx', 'utf8');
  assert.match(page, /farmCards\(context\.enabled, context\.shell\.unfinished, context\.farmCardLines\)/u);
  const context = readFileSync('app/irrigation/page-context.ts', 'utf8');
  assert.match(context, /cards: page === 'ma-ferme'/u);
  // Une seule lecture : la carte et les fiches partagent `startRouteReads`, jamais deux appels.
  assert.equal(context.match(/startRouteReads\(/gu)?.length, 1);
  assert.match(readFileSync('app/irrigation/pages/ma-ferme-page.tsx', 'utf8'), /data-line=\{card\.lineKind\}/u);
});
