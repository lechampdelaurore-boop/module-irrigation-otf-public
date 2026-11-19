import assert from 'node:assert/strict';
import test from 'node:test';
import { OtfShapeError, type OtfReadRoute, type OtfShapeProblem } from '../lib/domain/otf/api-contract.ts';
import { mapCropPlan } from '../lib/domain/otf/crop-plan-mapper.ts';
import { mapOtfConfiguration, mapOtfSnapshot } from '../lib/domain/otf/mapper.ts';
import { checkListShape, checkMeShape, type OtfListRoute } from '../lib/domain/otf/route-shapes.ts';
import { typicalOtfResponses } from './support/otf-typical-responses.ts';

/**
 * La vérification de forme de chaque route lue (4.3, PR 5 ; docs/tranche-4-contract.md,
 * T4-15, F370 point 5, section 6.3 ter, F391 à F396), éprouvée sur les
 * réponses types : chaque écart nomme la route et le champ, jamais une valeur.
 */

const LIST_ROUTES: OtfListRoute[] = ['/zoneList', '/plotList', '/bedList', '/actionList', '/plantList', '/seriesList', '/placeList', '/taskList'];

/** Une valeur qu'aucun message ni aucun journal ne doit jamais porter. */
const SECRET = 'valeur-secrete-7319';

type Elements = Record<string, unknown>[];

function elementsOf(route: OtfListRoute): Elements {
  return typicalOtfResponses()[route] as Elements;
}

function assertDeviation(run: () => void, route: OtfReadRoute, field: string, problem: OtfShapeProblem) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof OtfShapeError, `écart de forme attendu, reçu ${String(error)}`);
    assert.deepEqual({ route: error.route, field: error.field, problem: error.problem }, { route, field, problem });
    assert.ok(!error.message.includes(SECRET), 'le message ne porte aucune valeur');
    assert.match(error.message, /^Ouvre ta ferme a changé la forme de ses données : /);
    return true;
  });
}

/** La traduction de l'instantané, sur des réponses types dont une route est remplacée. */
function translate(replaced: Partial<Record<OtfReadRoute, unknown>> = {}) {
  const responses = { ...typicalOtfResponses(), ...replaced };
  const snapshot = mapOtfSnapshot(
    responses['/configuration'],
    responses['/zoneList'] as unknown[],
    responses['/plotList'] as unknown[],
    responses['/bedList'] as unknown[],
    new Date('2026-11-19T06:00:00.000Z'),
    [2026],
    responses['/me'],
  );
  const cropPlan = mapCropPlan({
    rawActions: responses['/actionList'] as unknown[],
    rawPlants: responses['/plantList'] as unknown[],
    rawSeries: responses['/seriesList'] as unknown[],
    rawPlaces: responses['/placeList'] as unknown[],
    rawTasks: responses['/taskList'] as unknown[],
    season: 2026,
    beds: snapshot.beds,
  });
  return { ...snapshot, cropPlan };
}

test('les réponses types passent la vérification de chaque route, et leur traduction aussi (F395)', () => {
  const responses = typicalOtfResponses();
  checkMeShape(responses['/me']);
  mapOtfConfiguration(responses['/configuration']);
  for (const route of LIST_ROUTES) checkListShape(route, responses[route] as unknown[]);
  const snapshot = translate();
  assert.equal(snapshot.structure.id, '17');
  assert.deepEqual(snapshot.beds.map((bed) => bed.alleyWidth), [0.45, null], 'un passe-pied nul reste « non renseigné »');
  assert.equal(snapshot.plots.length, 1, 'le remplissage de parcelle reste masqué');
  assert.equal(snapshot.cropPlan.implantationTasks.length, 3);
});

test('une réponse vide n’est pas un écart, sur chaque route (F393)', () => {
  for (const route of LIST_ROUTES) checkListShape(route, []);
});

test('sur chaque route de liste, un élément qui n’est pas un objet, ou sans identifiant lisible, est un écart (F391)', () => {
  for (const route of LIST_ROUTES) {
    assertDeviation(() => checkListShape(route, [...elementsOf(route), SECRET]), route, 'element', 'not-object');
    for (const id of [undefined, '', '/', true, { nom: SECRET }]) {
      const elements = elementsOf(route);
      delete elements[0]['@id'];
      if (id === undefined) delete elements[0].id;
      else elements[0].id = id;
      elements[0].name = SECRET;
      assertDeviation(() => checkListShape(route, elements), route, 'id', 'unreadable-id');
    }
    const byAddress = elementsOf(route);
    byAddress[0] = { ...byAddress[0], id: undefined, '@id': `/0.1beta${route}/77` };
    checkListShape(route, byAddress);
  }
});

test('les relations que la traduction lit sur chaque élément : un jardin sa parcelle, une planche son jardin, une série sa saison (F391)', () => {
  const plots = elementsOf('/plotList');
  delete plots[1].zone;
  assertDeviation(() => checkListShape('/plotList', plots), '/plotList', 'zone', 'unreadable-relation');

  const fill = elementsOf('/plotList');
  delete fill[0].zone;
  checkListShape('/plotList', fill);
  assert.doesNotThrow(() => translate({ '/plotList': fill }), 'la traduction ne lit pas la parcelle d’un remplissage : la vérification non plus');

  const beds = elementsOf('/bedList');
  beds[1].plot = { nom: SECRET };
  assertDeviation(() => checkListShape('/bedList', beds), '/bedList', 'plot', 'unreadable-relation');

  const series = elementsOf('/seriesList');
  series[2].season = SECRET;
  assertDeviation(() => checkListShape('/seriesList', series), '/seriesList', 'season', 'not-integer');
});

test('les mises en culture d’une série : chacune un objet, avec son identifiant, son espèce et des semaines ISO (F391)', () => {
  const notObject = elementsOf('/seriesList');
  (notObject[0].cultivations as unknown[]).push(SECRET);
  assertDeviation(() => checkListShape('/seriesList', notObject), '/seriesList', 'cultivations[]', 'not-object');

  const noPlant = elementsOf('/seriesList');
  delete (noPlant[1].cultivations as Elements)[0].plant;
  assertDeviation(() => checkListShape('/seriesList', noPlant), '/seriesList', 'cultivations[].plant', 'unreadable-relation');

  const badWeek = elementsOf('/seriesList');
  (badWeek[0].cultivations as Elements)[0].harvestWeeks = [SECRET];
  assertDeviation(() => checkListShape('/seriesList', badWeek), '/seriesList', 'cultivations[].harvestWeeks', 'not-week');

  const notAList = elementsOf('/seriesList');
  (notAList[0].cultivations as Elements)[0].harvestWeeksExpected = SECRET;
  assertDeviation(() => checkListShape('/seriesList', notAList), '/seriesList', 'cultivations[].harvestWeeksExpected', 'not-list');

  // Une liste de mises en culture qui n'en est pas une se lit vide, comme avant : ni la vérification ni la traduction ne la refusent.
  const objectCultivations = elementsOf('/seriesList');
  objectCultivations[2].cultivations = { premiere: SECRET };
  checkListShape('/seriesList', objectCultivations);
  assert.doesNotThrow(() => translate({ '/seriesList': objectCultivations }));
});

test('un emplacement ou une tâche : une série nulle est permise, une série illisible est un écart (F391)', () => {
  for (const route of ['/placeList', '/taskList'] as const) {
    const elements = elementsOf(route);
    elements[0].series = { nom: SECRET };
    assertDeviation(() => checkListShape(route, elements), route, 'series', 'unreadable-relation');
  }
});

test('ce que la traduction ne lit pas n’est pas vérifié : la semaine d’une tâche écartée, la planche d’un emplacement sans série (F391)', () => {
  const tasks = elementsOf('/taskList');
  tasks[3].plannedWeek = SECRET; // une irrigation (fqn nul) : la traduction l'écarte avant de lire ses semaines
  checkListShape('/taskList', tasks);
  assert.doesNotThrow(() => translate({ '/taskList': tasks }));

  const places = elementsOf('/placeList');
  delete places[2].bed; // sans série
  checkListShape('/placeList', places);
  assert.doesNotThrow(() => translate({ '/placeList': places }));
});

const SEEN_ON_THE_FARM: [OtfListRoute, string][] = [
  ['/bedList', 'length'],
  ['/bedList', 'width'],
  ['/bedList', 'alleyWidth'],
  ['/actionList', 'fqn'],
  ['/seriesList', 'use'],
  ['/seriesList', 'cycle'],
  ['/seriesList', 'cultivations'],
  ['/placeList', 'length'],
  ['/taskList', 'action'],
  ['/taskList', 'series'],
  ['/taskList', 'cultivation'],
  ['/taskList', 'plannedWeek'],
  ['/taskList', 'doneWeek'],
  ['/taskList', 'status'],
];

test('un champ lu avec une valeur par défaut, absent de tous les éléments, a changé de nom : écart, au lieu de données fausses (F393)', () => {
  for (const [route, field] of SEEN_ON_THE_FARM) {
    const renamed = elementsOf(route).map((element) => {
      const { [field]: value, ...rest } = element;
      return { ...rest, [`${field}Renamed`]: value };
    });
    assertDeviation(() => checkListShape(route, renamed), route, field, 'missing-everywhere');
  }
});

test('le même champ, nul partout ou absent d’une partie des éléments seulement, n’est pas un écart (F393)', () => {
  for (const [route, field] of SEEN_ON_THE_FARM) {
    const nulls = elementsOf(route).map((element) => ({ ...element, [field]: null }));
    checkListShape(route, nulls);
    const partly = elementsOf(route);
    delete partly[0][field];
    checkListShape(route, partly);
  }
});

test('les semaines de récolte, absentes de toutes les mises en culture, ont changé de nom (F393)', () => {
  for (const field of ['harvestWeeks', 'harvestWeeksExpected']) {
    const series = elementsOf('/seriesList');
    for (const item of series) for (const cultivation of item.cultivations as Elements) delete cultivation[field];
    assertDeviation(() => checkListShape('/seriesList', series), '/seriesList', `cultivations[].${field}`, 'missing-everywhere');
  }
  const noCultivation = elementsOf('/seriesList').map((item) => ({ ...item, cultivations: [] }));
  checkListShape('/seriesList', noCultivation);
});

test('`GET /me` qui porte plusieurs structures est refusé, à la vérification comme à la traduction (point D2, F392)', () => {
  for (const me of [[{ id: 17 }, { id: 18, name: SECRET }], { count: 2, list: [{ id: 17 }, { id: 18 }] }]) {
    assertDeviation(() => checkMeShape(me), '/me', 'structure', 'several-structures');
    assertDeviation(() => translate({ '/me': me }), '/me', 'structure', 'several-structures');
  }
  for (const me of [[{ id: 17 }], { id: 17 }, [], { list: [] }, null]) checkMeShape(me);
  assert.equal(translate({ '/me': [] }).structure.id, 'unknown', 'sans structure, le remplaçant d’affichage, jamais une identité');
});

test('la traduction nomme aussi la route et le champ de ce qu’elle seule peut voir : la planche d’un emplacement d’une série connue (F391)', () => {
  const places = elementsOf('/placeList');
  delete places[0].bed;
  places[0].name = SECRET;
  checkListShape('/placeList', places);
  assertDeviation(() => translate({ '/placeList': places }), '/placeList', 'bed', 'unreadable-relation');

  assertDeviation(() => mapOtfConfiguration({ seasonFirst: SECRET, seasonLast: 2026 }), '/configuration', 'seasonFirst', 'not-integer');
  assertDeviation(() => mapOtfConfiguration(SECRET), '/configuration', 'configuration', 'not-object');
});
