import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listChangeJournalForUser } from '../../db/change-journal/read';
import {
  addKcOverrideForUser,
  deleteSpeciesCorrespondenceForUser,
  linkSpeciesForUser,
  saveSpeciesCorrespondenceForUser,
} from '../../db/crop-water/entries';
import { deleteFarmReferenceCropForUser, saveFarmReferenceCropForUser } from '../../db/crop-water/references';
import {
  addShadeNetForUser,
  addShelterFactorForUser,
  removeShadeNetForUser,
  saveBedMulchForUser,
  saveCropWaterOptionsForUser,
} from '../../db/crop-water/settings';
import { deleteGardenGroupForUser, saveGardenGroupForUser } from '../../db/garden-group-repository';
import { savePlotSheltersForUser } from '../../db/plot-shelter-repository';
import { saveWeatherPreferenceForUser } from '../../db/water-management-repository';
import { changeJournalCard } from '../../lib/domain/change-journal/card';
import type { ChangeJournalEntry } from '../../lib/domain/change-journal/entry';
import type { NameOf } from '../../lib/domain/change-journal/fields';
import type { ReferenceCrop, StepCurve } from '../../lib/domain/crop-water/reference';
import { fieldsWithoutWords } from '../support/change-journal-words';
import { ARTICHOKE, ASPARAGUS, BROCCOLI, TOMATO } from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { crossSpaceReferences } from '../support/space-coherence';
import { ALICE, BOB } from '../support/spaces';

/**
 * Les réglages que la liste du contrat ne nommait pas, branchés au journal
 * des modifications (amélioration n° 7, F718 ; D-289, F725 à F729) : les
 * réglages du besoin par culture, les jardins sous abri, les groupes de
 * jardins et le lieu de la météo. Chaque geste écrit sa ligne dans son lot,
 * avec les seuls champs qui changent ; un geste refusé ou sans changement
 * n'écrit rien ; chaque ferme ne lit que son journal.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

/** Le journal d'une ferme, dans l'ordre des gestes ; chaque champ écrit a ses mots à l'écran (F722). */
async function journal(spaceKey = ALICE): Promise<ChangeJournalEntry[]> {
  const order = (database.sqlite.prepare('SELECT id FROM irrigation_change_journal ORDER BY rowid').all() as { id: string }[]).map(({ id }) => id);
  const entries = (await listChangeJournalForUser(spaceKey, { limit: 200 })).sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id));
  assert.deepEqual(fieldsWithoutWords(entries), []);
  return entries;
}

const summary = (entry: ChangeJournalEntry) => ({ subject: entry.subject, action: entry.action, before: entry.before, after: entry.after });
const NAMES: NameOf = (id) => ({ 'plot-nord': 'Tunnel nord', 'plot-sud': 'Plein champ sud', 'bed-1': 'B1' } as Record<string, string>)[id] ?? null;
const card = (entry: ChangeJournalEntry) => changeJournalCard(entry, { viewerUserId: ALICE, nameOf: NAMES });
const AT = new Date('2026-11-21T09:00:00.000Z');

test('un Kc corrigé : créé, inchangé sans ligne, rendu à la source ; un Kc de la FAO ; une culture inconnue refusée', async () => {
  assert.ok((await addKcOverrideForUser(ALICE, { referenceCropId: TOMATO.id, target: { rank: 2 }, kc: 0.65, effectiveFrom: '2026-05-01' }, AT)).ok);
  assert.ok((await addKcOverrideForUser(ALICE, { referenceCropId: TOMATO.id, target: { rank: 2 }, kc: 0.65, effectiveFrom: '2026-05-01' }, AT)).ok);
  assert.ok((await addKcOverrideForUser(ALICE, { referenceCropId: TOMATO.id, target: { rank: 2 }, kc: null, effectiveFrom: '2026-07-01' }, AT)).ok);
  assert.ok((await addKcOverrideForUser(ALICE, { referenceCropId: BROCCOLI.id, target: { fao: 'mid' }, kc: 0.95, effectiveFrom: '2026-05-01' }, AT)).ok);
  assert.equal((await addKcOverrideForUser(ALICE, { referenceCropId: 'inconnue', target: { rank: 1 }, kc: 0.5, effectiveFrom: '2026-05-01' }, AT)).ok, false);
  const entries = await journal();
  assert.deepEqual(entries.map(summary), [
    { subject: 'kc-corrige', action: 'cree', before: null, after: { kc: 0.65, effectiveFrom: '2026-05-01' } },
    { subject: 'kc-corrige', action: 'modifie', before: { kc: 0.65, effectiveFrom: '2026-05-01' }, after: { kc: null, effectiveFrom: '2026-07-01' } },
    { subject: 'kc-corrige', action: 'cree', before: null, after: { kc: 0.95, effectiveFrom: '2026-05-01' } },
  ]);
  assert.equal(entries[0].family, 'reglage');
  assert.equal(card(entries[0]).object, 'Tomate, stade 2');
  assert.deepEqual(card(entries[1]).lines, [
    { label: 'Kc de la ferme', text: '0,65 → celui de la source' },
    { label: 'À partir du', text: '01/05/2026 → 01/07/2026' },
  ]);
  assert.equal(card(entries[2]).object, 'Brocoli, Kc pleine saison');
  assert.deepEqual(await journal(BOB), []);
});

test('une culture de référence de la ferme : chaque forme de Kc se relit à l’identique, un changement de dates, puis retirée', async () => {
  const crops = [TOMATO, BROCCOLI, ASPARAGUS, ARTICHOKE];
  for (const crop of crops) assert.ok((await saveFarmReferenceCropForUser(ALICE, crop, { sourceUrl: null, datesSource: null }, AT)).ok, crop.id);
  // La même culture, enregistrée de nouveau : rien ne change, aucune ligne (le texte relu en SQL est celui que le code écrit).
  for (const crop of crops) assert.ok((await saveFarmReferenceCropForUser(ALICE, crop, { sourceUrl: null, datesSource: null }, AT)).ok, crop.id);
  const curve = TOMATO.curve as StepCurve;
  const earlierFlowering: ReferenceCrop = {
    ...TOMATO,
    curve: { ...curve, sets: [{ months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], value: curve.sets[0].value.map((start, index) => (index === 2 ? { anchor: { from: 'implantation', days: 25 }, estimated: false } : start)) }] },
  };
  assert.ok((await saveFarmReferenceCropForUser(ALICE, earlierFlowering, { sourceUrl: null, datesSource: 'Observation de la ferme, 2026' }, AT)).ok);
  assert.equal(await deleteFarmReferenceCropForUser(BOB, TOMATO.id, AT), false);
  assert.equal(await deleteFarmReferenceCropForUser(ALICE, TOMATO.id, AT), true);
  const entries = await journal();
  assert.deepEqual(entries.map((entry) => [entry.subject, entry.action, entry.objectId]), [
    ['culture-de-reference', 'cree', TOMATO.id],
    ['culture-de-reference', 'cree', BROCCOLI.id],
    ['culture-de-reference', 'cree', ASPARAGUS.id],
    ['culture-de-reference', 'cree', ARTICHOKE.id],
    ['culture-de-reference', 'modifie', TOMATO.id],
    ['culture-de-reference', 'supprime', TOMATO.id],
  ]);
  assert.deepEqual(Object.keys(entries[4].after ?? {}).sort(), ['datesSource', 'starts']);
  const change = card(entries[4]);
  assert.equal(change.object, 'Tomate');
  assert.match(change.lines.find((line) => line.label === 'Débuts des stades')?.text ?? '', /jeu 1, stade \d+ : 30 j après l’implantation \(estimé\).* → .*jeu 1, stade \d+ : 25 j après l’implantation/);
  assert.equal(change.lines.find((line) => line.label === 'Source des dates')?.text, 'aucune → Observation de la ferme, 2026');
  const broccoli = card(entries[1]);
  assert.match(broccoli.lines.find((line) => line.label === 'Jeux de saison')?.text ?? '', /^toute l’année : 20, 30, 20 et 10 jours$/);
  assert.equal(broccoli.lines.find((line) => line.label === 'Kc pleine saison')?.text, '1,05');
  assert.equal(entries[5].context.name, 'Tomate');
  assert.deepEqual(await journal(BOB), []);
});

test('la correspondance d’une espèce : rattachée, inchangée, par analogie, sans référence, d’un geste pour plusieurs, puis retirée', async () => {
  const tomato = { plantId: 'plant-tomate', seriesId: null };
  await saveSpeciesCorrespondenceForUser(ALICE, { ...tomato, target: { kind: 'reference', referenceCropId: TOMATO.id, analogy: false } }, AT);
  await saveSpeciesCorrespondenceForUser(ALICE, { ...tomato, target: { kind: 'reference', referenceCropId: TOMATO.id, analogy: false } }, AT);
  await saveSpeciesCorrespondenceForUser(ALICE, { ...tomato, target: { kind: 'reference', referenceCropId: TOMATO.id, analogy: true } }, AT);
  await saveSpeciesCorrespondenceForUser(ALICE, { ...tomato, target: { kind: 'without-reference' } }, AT);
  assert.deepEqual(await linkSpeciesForUser(ALICE, [{ plantId: 'plant-brocoli', referenceCropId: BROCCOLI.id, analogy: true }], AT), { ok: true, value: 1 });
  assert.equal(await deleteSpeciesCorrespondenceForUser(BOB, 'plant-tomate', null, AT), false);
  assert.equal(await deleteSpeciesCorrespondenceForUser(ALICE, 'plant-tomate', null, AT), true);
  const entries = await journal();
  assert.deepEqual(entries.map(summary), [
    { subject: 'correspondance-d-espece', action: 'cree', before: null, after: { targetKind: 'reference', referenceCrop: 'Tomate', analogy: 0 } },
    { subject: 'correspondance-d-espece', action: 'modifie', before: { analogy: 0 }, after: { analogy: 1 } },
    {
      subject: 'correspondance-d-espece',
      action: 'modifie',
      before: { targetKind: 'reference', referenceCrop: 'Tomate', analogy: 1 },
      after: { targetKind: 'without-reference', referenceCrop: null, analogy: 0 },
    },
    { subject: 'correspondance-d-espece', action: 'cree', before: null, after: { targetKind: 'reference', referenceCrop: 'Brocoli', analogy: 1 } },
    { subject: 'correspondance-d-espece', action: 'supprime', before: { targetKind: 'without-reference', referenceCrop: null, analogy: 0 }, after: null },
  ]);
  assert.deepEqual(card(entries[2]).lines.map((line) => line.text), ['une culture de référence → sans référence Kc', 'Tomate → aucune', 'oui → non']);
  assert.deepEqual(await journal(BOB), []);
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('l’effet d’un abri, le paillage d’une planche, un filet d’ombrage et les options : chaque geste, sa ligne', async () => {
  assert.ok((await addShelterFactorForUser(ALICE, { shelterId: 'plot-nord', value: 0.7, effectiveFrom: '2026-11-01' }, AT)).ok);
  assert.ok((await addShelterFactorForUser(ALICE, { shelterId: 'plot-nord', value: 0.8, effectiveFrom: '2026-12-01' }, AT)).ok);
  await saveBedMulchForUser(ALICE, { bedId: 'bed-1', season: 2026, plasticMulch: false }, AT);
  await saveBedMulchForUser(ALICE, { bedId: 'bed-1', season: 2026, plasticMulch: true }, AT);
  const net = await addShadeNetForUser(ALICE, { bedId: 'bed-1', rate: 0.25, from: '2026-06-01', to: null }, AT);
  assert.ok(net.ok);
  assert.equal(await removeShadeNetForUser(BOB, net.value.id, '2026-08-31', AT), null);
  assert.equal((await removeShadeNetForUser(ALICE, net.value.id, '2026-08-31', AT))?.ok, true);
  await saveCropWaterOptionsForUser(ALICE, { smoothing: false, shading: false }, AT);
  await saveCropWaterOptionsForUser(ALICE, { smoothing: true, shading: false }, AT);
  const entries = await journal();
  assert.deepEqual(entries.map(summary), [
    { subject: 'k-abri', action: 'cree', before: null, after: { factor: 0.7, effectiveFrom: '2026-11-01' } },
    { subject: 'k-abri', action: 'modifie', before: { factor: 0.7, effectiveFrom: '2026-11-01' }, after: { factor: 0.8, effectiveFrom: '2026-12-01' } },
    { subject: 'paillage-plastique', action: 'modifie', before: { plasticMulch: 0 }, after: { plasticMulch: 1 } },
    { subject: 'filet-d-ombrage', action: 'cree', before: null, after: { rate: 0.25, placedOn: '2026-06-01', removedOn: null } },
    { subject: 'filet-d-ombrage', action: 'modifie', before: { removedOn: null }, after: { removedOn: '2026-08-31' } },
    { subject: 'options-du-besoin', action: 'modifie', before: { smoothing: 0 }, after: { smoothing: 1 } },
  ]);
  assert.equal(card(entries[0]).object, 'Jardin / abri · Tunnel nord');
  assert.equal(card(entries[2]).object, 'saison 2026, Planche · B1');
  assert.deepEqual(card(entries[3]).lines.map((line) => line.text), ['25 %', '01/06/2026', 'toujours posé']);
  assert.equal(card(entries[3]).object, 'Planche · B1');
  assert.deepEqual(card(entries[5]).lines, [{ label: 'Lissage des passages de stade', text: 'non → oui' }]);
  assert.deepEqual(await journal(BOB), []);
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('un jardin classé sous abri, reclassé, remis à classer ; un groupe de jardins créé, changé, supprimé ; le lieu de la météo', async () => {
  const planPlotIds = ['plot-nord', 'plot-sud'];
  const at = AT.toISOString();
  await savePlotSheltersForUser(ALICE, { answers: [{ plotId: 'plot-nord', sheltered: true, proposedSheltered: true }], planPlotIds, at });
  await savePlotSheltersForUser(ALICE, { answers: [{ plotId: 'plot-nord', sheltered: true, proposedSheltered: false }], planPlotIds, at });
  await savePlotSheltersForUser(ALICE, { answers: [{ plotId: 'plot-nord', sheltered: false, proposedSheltered: true }], planPlotIds, at });
  await savePlotSheltersForUser(ALICE, { answers: [{ plotId: 'plot-nord', sheltered: null, proposedSheltered: true }], planPlotIds, at });

  const member = (otfPlotId: string, position: number, gapBeforeMeters = 0, bedOrder: 'normal' | 'reversed' = 'normal') =>
    ({ otfZoneId: 'zone-1', otfPlotId, position, bedOrder, gapBeforeMeters });
  const groupId = await saveGardenGroupForUser(ALICE, null, { name: 'Serres', season: 2026, members: [member('plot-nord', 1), member('plot-sud', 2, 1.5)] });
  assert.ok(groupId);
  await saveGardenGroupForUser(ALICE, groupId, { name: 'Serres', season: 2026, members: [member('plot-nord', 1), member('plot-sud', 2, 1.5)] });
  await saveGardenGroupForUser(ALICE, groupId, { name: 'Tunnels', season: 2026, members: [member('plot-sud', 1, 0, 'reversed'), member('plot-nord', 2, 2)] });
  assert.equal(await deleteGardenGroupForUser(BOB, 2026, groupId), false);
  assert.equal(await deleteGardenGroupForUser(ALICE, 2026, groupId), true);

  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'otf', customCity: null, customPostcode: null });
  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'custom', customCity: 'Vannes', customPostcode: '56000' });
  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'otf', customCity: 'Vannes', customPostcode: '56000' });

  const entries = await journal();
  const members = JSON.stringify([['plot-nord', 'normal', 0], ['plot-sud', 'normal', 1.5]]);
  const changed = JSON.stringify([['plot-sud', 'reversed', 0], ['plot-nord', 'normal', 2]]);
  assert.deepEqual(entries.map(summary), [
    { subject: 'jardin-sous-abri', action: 'cree', before: null, after: { sheltered: 1 } },
    { subject: 'jardin-sous-abri', action: 'modifie', before: { sheltered: 1 }, after: { sheltered: 0 } },
    { subject: 'jardin-sous-abri', action: 'supprime', before: { sheltered: 0 }, after: null },
    { subject: 'groupe-de-jardins', action: 'cree', before: null, after: { name: 'Serres', members } },
    { subject: 'groupe-de-jardins', action: 'modifie', before: { name: 'Serres', members }, after: { name: 'Tunnels', members: changed } },
    { subject: 'groupe-de-jardins', action: 'supprime', before: { name: 'Tunnels', members: changed }, after: null },
    {
      subject: 'lieu-meteo',
      action: 'modifie',
      before: { locationMode: 'otf', customCity: null, customPostcode: null },
      after: { locationMode: 'custom', customCity: 'Vannes', customPostcode: '56000' },
    },
    { subject: 'lieu-meteo', action: 'modifie', before: { locationMode: 'custom', customCity: 'Vannes', customPostcode: '56000' }, after: { locationMode: 'otf', customCity: null, customPostcode: null } },
  ]);
  assert.deepEqual(card(entries[1]).lines, [{ label: 'Classement', text: 'sous abri → plein champ' }]);
  assert.equal(card(entries[1]).object, 'Jardin / abri · Tunnel nord');
  assert.deepEqual(card(entries[4]).lines.find((line) => line.label === 'Jardins'), {
    label: 'Jardins',
    text: 'Tunnel nord ; Plein champ sud, à 1,5 m du précédent → Plein champ sud, sens inversé ; Tunnel nord, à 2 m du précédent',
  });
  assert.equal(card(entries[4]).object, 'Serres, saison 2026');
  assert.equal(card(entries[6]).lines[0].text, 'l’adresse de la ferme dans Ouvre ta ferme → une commune choisie');
  assert.deepEqual(await journal(BOB), []);
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});
