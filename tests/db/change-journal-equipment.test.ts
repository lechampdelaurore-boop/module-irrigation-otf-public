import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listChangeJournalForUser } from '../../db/change-journal/read';
import { removeEquipmentPlacementForUser, saveEquipmentPlacementForUser, updateEquipmentPlacementSettingForUser } from '../../db/equipment-placement-repository';
import { duplicateEquipmentForUser } from '../../db/equipment/duplication';
import { createEquipmentForUser, deleteEquipmentForUser, setEquipmentArchivedForUser, updateEquipmentForUser } from '../../db/equipment/equipment';
import { deleteEquipmentSettingForUser, saveEquipmentSettingForUser } from '../../db/equipment/settings';
import { saveEquipmentDefaultPumpForUser, savePumpForUser, setPumpArchivedForUser } from '../../db/pump-repository';
import { applyResourceFlowForUser } from '../../db/water-resource-flow-repository';
import {
  saveDefaultWaterSupplyForUser,
  saveReservoirLinkForUser,
  saveResourceReservoirLinkForUser,
  saveWaterReservoirForUser,
  saveWaterResourceForUser,
} from '../../db/water-resource-repository';
import type { ChangeJournalEntry } from '../../lib/domain/change-journal/entry';
import type { PumpDraft } from '../../lib/domain/pumps';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID } from '../support/irrigation-fixtures';
import { crossSpaceReferences } from '../support/space-coherence';
import { ALICE, BOB } from '../support/spaces';

/**
 * Les écrivains du matériel et des ressources branchés au journal des
 * modifications (amélioration n° 7, PR 6 ; docs/ameliorations-6-2-3-7-contract.md,
 * §5.1 et §5.2 ; D-287) : chaque geste écrit sa ligne dans son lot, avec les
 * seuls champs qui changent ; une valeur désignée par un identifiant se lit
 * par son nom, avant comme après ; un geste refusé ou sans changement
 * n'écrit rien ; chaque ferme ne lit que son journal.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

/** Le journal d'une ferme, dans l'ordre des gestes (l'ordre d'écriture). */
async function journal(spaceKey = ALICE): Promise<ChangeJournalEntry[]> {
  const order = (database.sqlite.prepare('SELECT id FROM irrigation_change_journal ORDER BY rowid').all() as { id: string }[]).map(({ id }) => id);
  return (await listChangeJournalForUser(spaceKey, { limit: 200 })).sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id));
}

const summary = (entry: ChangeJournalEntry) => ({ subject: entry.subject, action: entry.action, before: entry.before, after: entry.after });

test('un matériel créé, modifié, inchangé, rangé, ressorti, copié puis effacé', async () => {
  const id = await createEquipmentForUser(ALICE, { name: 'Rampe 1', kind: 'sprinkler', mobility: 'mobile' });
  assert.equal(await updateEquipmentForUser(ALICE, id, { name: 'Rampe nord', kind: 'sprinkler', mobility: 'mobile' }), true);
  assert.equal(await updateEquipmentForUser(ALICE, id, { name: 'Rampe nord', kind: 'sprinkler', mobility: 'mobile' }), true);
  assert.equal(await updateEquipmentForUser(BOB, id, { name: 'Volée', kind: 'sprinkler', mobility: 'fixed' }), false);
  assert.equal(await setEquipmentArchivedForUser(ALICE, id, true), true);
  assert.equal(await setEquipmentArchivedForUser(ALICE, id, false), true);
  const copy = await duplicateEquipmentForUser(ALICE, id, { name: 'Rampe sud', kind: 'sprinkler', mobility: 'fixed' });
  assert.equal(await deleteEquipmentForUser(ALICE, copy!.equipmentId), 'deleted');
  const entries = await journal();
  assert.deepEqual(entries.map(summary), [
    { subject: 'materiel', action: 'cree', before: null, after: { name: 'Rampe 1', kind: 'sprinkler', mobility: 'mobile' } },
    { subject: 'materiel', action: 'modifie', before: { name: 'Rampe 1' }, after: { name: 'Rampe nord' } },
    { subject: 'materiel', action: 'modifie', before: { status: 'active' }, after: { status: 'archived' } },
    { subject: 'materiel', action: 'modifie', before: { status: 'archived' }, after: { status: 'active' } },
    { subject: 'materiel', action: 'cree', before: null, after: { name: 'Rampe sud', kind: 'sprinkler', mobility: 'fixed' } },
    { subject: 'materiel', action: 'supprime', before: { name: 'Rampe sud', kind: 'sprinkler', mobility: 'fixed', status: 'active' }, after: null },
  ]);
  assert.equal(entries[0].family, 'materiel');
  assert.deepEqual(entries[4].context, { name: 'Rampe sud', copiedFrom: 'Rampe nord' });
  assert.deepEqual(await journal(BOB), []);
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('un réglage de matériel : débit d’un goutte-à-goutte, profil d’une aspersion, copie et effacement', async () => {
  const drip = await createEquipmentForUser(ALICE, { name: 'Goutte', kind: 'drip', mobility: 'fixed' });
  const dripSetting = await saveEquipmentSettingForUser(ALICE, drip, null, { name: 'Standard', kind: 'drip', rateMmPerHour: 10 });
  await saveEquipmentSettingForUser(ALICE, drip, dripSetting, { name: 'Standard', kind: 'drip', rateMmPerHour: 12.5 });
  await saveEquipmentSettingForUser(ALICE, drip, dripSetting, { name: 'Standard', kind: 'drip', rateMmPerHour: 12.5 });
  const sprinkler = await createEquipmentForUser(ALICE, { name: 'Asperseur', kind: 'sprinkler', mobility: 'mobile' });
  const profile = { leftProfile: [{ distanceMeters: 4, rateMmPerHour: 6 }, { distanceMeters: 2, rateMmPerHour: 8 }], rightProfile: [] };
  const sprinklerSetting = await saveEquipmentSettingForUser(ALICE, sprinkler, null, { name: 'Portée', kind: 'sprinkler', ...profile });
  // Les mêmes points dans un autre ordre : rien ne change.
  await saveEquipmentSettingForUser(ALICE, sprinkler, sprinklerSetting, { name: 'Portée', kind: 'sprinkler', leftProfile: [...profile.leftProfile].reverse(), rightProfile: [] });
  await saveEquipmentSettingForUser(ALICE, sprinkler, sprinklerSetting, { name: 'Portée', kind: 'sprinkler', ...profile, rightProfile: [{ distanceMeters: 3, rateMmPerHour: 7.5 }] });
  assert.equal(await deleteEquipmentSettingForUser(ALICE, drip, dripSetting!), 'deleted');
  const entries = (await journal()).filter((entry) => entry.subject === 'reglage-de-materiel');
  assert.deepEqual(entries.map(summary), [
    { subject: 'reglage-de-materiel', action: 'cree', before: null, after: { name: 'Standard', rateMmPerHour: 10, leftProfile: '[]', rightProfile: '[]' } },
    { subject: 'reglage-de-materiel', action: 'modifie', before: { rateMmPerHour: 10 }, after: { rateMmPerHour: 12.5 } },
    { subject: 'reglage-de-materiel', action: 'cree', before: null, after: { name: 'Portée', rateMmPerHour: null, leftProfile: '[[2,8],[4,6]]', rightProfile: '[]' } },
    { subject: 'reglage-de-materiel', action: 'modifie', before: { rightProfile: '[]' }, after: { rightProfile: '[[3,7.5]]' } },
    { subject: 'reglage-de-materiel', action: 'supprime', before: { name: 'Standard', rateMmPerHour: 12.5, leftProfile: '[]', rightProfile: '[]' }, after: null },
  ]);
  assert.deepEqual(entries[1].context, { equipment: 'Goutte', name: 'Standard' });
  const copy = await duplicateEquipmentForUser(ALICE, sprinkler, { name: 'Asperseur 2', kind: 'sprinkler', mobility: 'mobile' });
  const copied = (await journal()).filter((entry) => entry.subject === 'reglage-de-materiel').at(-1);
  assert.deepEqual(copied && summary(copied), { subject: 'reglage-de-materiel', action: 'cree', before: null, after: { name: 'Portée', rateMmPerHour: null, leftProfile: '[[2,8],[4,6]]', rightProfile: '[[3,7.5]]' } });
  assert.equal(copy?.settingsCount, 1);
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('les ressources, les réserves, leurs liaisons, l’alimentation par défaut : les bouts par leur nom', async () => {
  const resource = { name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 2, status: 'active', availableFrom: null, availableUntil: null, notes: null } as const;
  const forage = await saveWaterResourceForUser(ALICE, ALICE, null, resource);
  await saveWaterResourceForUser(ALICE, ALICE, forage, { ...resource, nominalFlowCubicMetersPerHour: 3 });
  await applyResourceFlowForUser(ALICE, ALICE, { resourceId: forage, flowCubicMetersPerHour: 2.6, fromReadingId: null, toReadingId: null, referenceNote: null });
  const reservoir = {
    name: 'Tampon', type: 'buffer', capacityCubicMeters: 60, currentVolumeCubicMeters: 40, minimumSafetyCubicMeters: 5,
    exposedSurfaceSquareMeters: 30, receivesRain: true, evaporationEnabled: false, evaporationCoefficient: 0, status: 'active', notes: null,
  } as const;
  const tampon = await saveWaterReservoirForUser(ALICE, ALICE, null, reservoir, '2026-06-01T06:00:00.000Z');
  const cuve = await saveWaterReservoirForUser(ALICE, ALICE, null, { ...reservoir, name: 'Cuve' }, '2026-06-01T06:00:00.000Z');
  await saveWaterReservoirForUser(ALICE, ALICE, tampon, { ...reservoir, capacityCubicMeters: 80, currentVolumeCubicMeters: 10 }, '2026-06-02T06:00:00.000Z');
  const link = await saveResourceReservoirLinkForUser(ALICE, ALICE, { resourceId: forage, reservoirId: tampon, fillMode: 'automatic', active: true });
  await saveResourceReservoirLinkForUser(ALICE, ALICE, { id: link, resourceId: forage, reservoirId: cuve, fillMode: 'automatic', active: true });
  await saveReservoirLinkForUser(ALICE, ALICE, { upstreamReservoirId: tampon, downstreamReservoirId: cuve, transferMode: 'manual', active: true });
  await saveDefaultWaterSupplyForUser(ALICE, ALICE, { sourceKind: 'resource', resourceId: forage, reservoirId: null });
  await saveDefaultWaterSupplyForUser(ALICE, ALICE, { sourceKind: 'reservoir', resourceId: null, reservoirId: cuve });
  await saveDefaultWaterSupplyForUser(ALICE, ALICE, null);
  const entries = await journal();
  assert.deepEqual(entries.map(summary), [
    { subject: 'ressource', action: 'cree', before: null, after: { ...resource } },
    { subject: 'ressource', action: 'modifie', before: { nominalFlowCubicMetersPerHour: 2 }, after: { nominalFlowCubicMetersPerHour: 3 } },
    { subject: 'ressource', action: 'modifie', before: { nominalFlowCubicMetersPerHour: 3 }, after: { nominalFlowCubicMetersPerHour: 2.6 } },
    {
      subject: 'reserve', action: 'cree', before: null,
      after: { name: 'Tampon', type: 'buffer', capacityCubicMeters: 60, minimumSafetyCubicMeters: 5, exposedSurfaceSquareMeters: 30, receivesRain: 1, evaporationEnabled: 0, evaporationCoefficient: 0, status: 'active', notes: null },
    },
    {
      subject: 'reserve', action: 'cree', before: null,
      after: { name: 'Cuve', type: 'buffer', capacityCubicMeters: 60, minimumSafetyCubicMeters: 5, exposedSurfaceSquareMeters: 30, receivesRain: 1, evaporationEnabled: 0, evaporationCoefficient: 0, status: 'active', notes: null },
    },
    { subject: 'reserve', action: 'modifie', before: { capacityCubicMeters: 60 }, after: { capacityCubicMeters: 80 } },
    { subject: 'liaison-ressource-reserve', action: 'cree', before: null, after: { resource: 'Forage', reservoir: 'Tampon', fillMode: 'automatic', active: 1 } },
    { subject: 'liaison-ressource-reserve', action: 'modifie', before: { reservoir: 'Tampon' }, after: { reservoir: 'Cuve' } },
    { subject: 'liaison-entre-reserves', action: 'cree', before: null, after: { upstream: 'Tampon', downstream: 'Cuve', transferMode: 'manual', active: 1 } },
    { subject: 'alimentation-par-defaut', action: 'modifie', before: { sourceKind: null, source: null }, after: { sourceKind: 'resource', source: 'Forage' } },
    { subject: 'alimentation-par-defaut', action: 'modifie', before: { sourceKind: 'resource', source: 'Forage' }, after: { sourceKind: 'reservoir', source: 'Cuve' } },
    { subject: 'alimentation-par-defaut', action: 'modifie', before: { sourceKind: 'reservoir', source: 'Cuve' }, after: { sourceKind: null, source: null } },
  ]);
  assert.deepEqual(entries[2].context, { name: 'Forage', origin: 'debit-mesure' });
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('les pompes : créée avec ses origines par leur nom, modifiée, rangée ; la pompe par défaut d’un matériel', async () => {
  const forage = await saveWaterResourceForUser(ALICE, ALICE, null, { name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 2, status: 'active', availableFrom: null, availableUntil: null, notes: null });
  const draft: PumpDraft = { name: 'Pompe 1', maximumFlowCubicMetersPerHour: 8, status: 'active', notes: null, origins: [{ sourceKind: 'resource', resourceId: forage, reservoirId: null, isDefault: true }] };
  const pump = await savePumpForUser(ALICE, ALICE, null, draft);
  await savePumpForUser(ALICE, ALICE, pump, draft);
  await savePumpForUser(ALICE, ALICE, pump, { ...draft, maximumFlowCubicMetersPerHour: 9, origins: [] });
  await setPumpArchivedForUser(ALICE, ALICE, pump, true);
  await setPumpArchivedForUser(ALICE, ALICE, pump, false);
  const rampe = await createEquipmentForUser(ALICE, { name: 'Rampe', kind: 'drip', mobility: 'fixed' });
  await saveEquipmentDefaultPumpForUser(ALICE, ALICE, rampe, pump);
  await saveEquipmentDefaultPumpForUser(ALICE, ALICE, rampe, null);
  const entries = (await journal()).filter((entry) => entry.subject === 'pompe' || entry.subject === 'pompe-par-defaut');
  assert.deepEqual(entries.map(summary), [
    { subject: 'pompe', action: 'cree', before: null, after: { name: 'Pompe 1', maximumFlowCubicMetersPerHour: 8, status: 'active', notes: null, origins: '[["resource","Forage",1]]' } },
    { subject: 'pompe', action: 'modifie', before: { maximumFlowCubicMetersPerHour: 8, origins: '[["resource","Forage",1]]' }, after: { maximumFlowCubicMetersPerHour: 9, origins: '[]' } },
    { subject: 'pompe', action: 'modifie', before: { status: 'active' }, after: { status: 'archived' } },
    { subject: 'pompe', action: 'modifie', before: { status: 'archived' }, after: { status: 'active' } },
    { subject: 'pompe-par-defaut', action: 'modifie', before: { pump: null }, after: { pump: 'Pompe 1' } },
    { subject: 'pompe-par-defaut', action: 'modifie', before: { pump: 'Pompe 1' }, after: { pump: null } },
  ]);
  assert.deepEqual(entries[4].context, { equipment: 'Rampe' });
  assert.equal(entries[4].objectId, rampe);
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('les poses : posée, réglage changé, planches changées, retirée puis reposée', async () => {
  const equipmentId = await createEquipmentForUser(ALICE, { name: 'Goutte', kind: 'drip', mobility: 'mobile' });
  const settingId = (await saveEquipmentSettingForUser(ALICE, equipmentId, null, { name: 'Réglage', kind: 'drip', rateMmPerHour: 10 }))!;
  const strong = (await saveEquipmentSettingForUser(ALICE, equipmentId, null, { name: 'Fort', kind: 'drip', rateMmPerHour: 20 }))!;
  const bed = (otfBedId: string) => ({ otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, otfBedId });
  const base = { equipmentId, settingId, season: 2026, gardenGroupId: null, otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, anchor: { type: 'bed_center' as const, anchorBedOtfId: 'bed-2' } };
  const placed = await saveEquipmentPlacementForUser(ALICE, { ...base, selectedBeds: [bed('bed-2'), bed('bed-1')] }, '2026-03-02T07:00:00.000Z');
  await updateEquipmentPlacementSettingForUser(ALICE, equipmentId, 2026, strong);
  await saveEquipmentPlacementForUser(ALICE, { ...base, settingId: strong, selectedBeds: [bed('bed-2')] }, '2026-03-02T07:00:00.000Z');
  assert.equal(await removeEquipmentPlacementForUser(ALICE, equipmentId, 2026, '2026-03-05T07:00:00.000Z'), 'removed');
  await saveEquipmentPlacementForUser(ALICE, { ...base, settingId: strong, selectedBeds: [bed('bed-2')] }, '2026-03-09T07:00:00.000Z');
  const entries = (await journal()).filter((entry) => entry.subject === 'pose');
  assert.deepEqual(entries.map((entry) => entry.action), ['cree', 'modifie', 'modifie', 'modifie', 'modifie']);
  assert.deepEqual(entries[0].after, {
    setting: 'Réglage', gardenGroup: null, zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, anchorType: 'bed_center',
    anchorBedId: 'bed-2', beforeBedId: null, afterBedId: null, placedAt: entries[0].after?.placedAt ?? null, removedAt: null, beds: '["bed-2","bed-1"]',
  });
  assert.deepEqual([entries[1].before, entries[1].after], [{ setting: 'Réglage' }, { setting: 'Fort' }]);
  assert.deepEqual([entries[2].before, entries[2].after], [{ beds: '["bed-2","bed-1"]' }, { beds: '["bed-2"]' }]);
  assert.deepEqual(Object.keys(entries[3].after ?? {}), ['removedAt']);
  assert.deepEqual(Object.keys(entries[4].after ?? {}).sort(), ['placedAt', 'removedAt']);
  assert.ok(entries.every((entry) => entry.objectId === placed?.id && entry.context.equipment === 'Goutte' && entry.context.season === 2026));
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});
