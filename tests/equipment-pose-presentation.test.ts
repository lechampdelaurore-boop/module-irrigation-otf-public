import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlacementPose } from '../lib/domain/equipment-placement-periods.ts';
import {
  closedPoseLabel,
  placementsOpenAt,
  plannedIrrigationSignal,
  poseCounts,
  posePlaceLabel,
  poseStateLabel,
} from '../lib/domain/equipment-pose-presentation.ts';

// Ce que la carte d'un matériel dit de sa pose (2.11, PR 3b ;
// docs/equipment-placement-periods-contract.md, « L'écran »). Novembre 2026,
// heure d'hiver : Paris = UTC + 1.
const LUNDI_9H = '2026-11-02T08:00:00.000Z';
const MARDI_9H = '2026-11-03T08:00:00.000Z';
const MERCREDI_8H = '2026-11-04T07:00:00.000Z';
const VENDREDI_8H = '2026-11-06T07:00:00.000Z';

const NAMES = new Map([['p1', 'P1'], ['p2', 'P2'], ['p3', 'P3'], ['p4', 'P4'], ['p7', 'P7']]);
const bedName = (bedId: string) => NAMES.get(bedId) ?? null;

const goutteAGoutte = (dates: { placedAt: string | null; removedAt: string | null }, beds = ['p1', 'p2'], equipmentId = 'gag'): PlacementPose => ({
  id: `pose-${equipmentId}`,
  equipmentId,
  settingId: 'reglage-1',
  season: 2026,
  gardenGroupId: null,
  otfZoneId: 'zone',
  otfPlotId: 'jardin',
  anchor: { type: 'bed_center', anchorBedOtfId: beds[0] },
  selectedBeds: beds.map((otfBedId) => ({ otfZoneId: 'zone', otfPlotId: 'jardin', otfBedId })),
  ...dates,
});

const rampe = (dates: { placedAt: string | null; removedAt: string | null }): PlacementPose => ({
  ...goutteAGoutte(dates, [], 'rampe'),
  anchor: { type: 'between_beds', beforeBedOtfId: 'p3', afterBedOtfId: 'p4' },
  selectedBeds: [],
});

test('l’état en clair : posé depuis le…, date de pose non renseignée, stocké depuis le…, jamais posé', () => {
  const pose = goutteAGoutte({ placedAt: LUNDI_9H, removedAt: null });
  assert.equal(poseStateLabel(pose, bedName), 'Posé sur P1, P2 depuis le 2 novembre à 9 h 00');
  assert.equal(poseStateLabel(goutteAGoutte({ placedAt: null, removedAt: null }), bedName), 'Posé sur P1, P2 · date de pose non renseignée');
  assert.equal(poseStateLabel(goutteAGoutte({ placedAt: LUNDI_9H, removedAt: MARDI_9H }), bedName), 'Stocké depuis le 3 novembre à 9 h 00');
  assert.equal(poseStateLabel(null, bedName), 'Jamais posé cette saison');
  assert.equal(poseStateLabel(rampe({ placedAt: LUNDI_9H, removedAt: null }), bedName), 'Posé entre P3 et P4 depuis le 2 novembre à 9 h 00');
});

test('l’endroit d’une pose : les planches du goutte-à-goutte, la planche ou l’espace de l’aspersion', () => {
  assert.equal(posePlaceLabel(goutteAGoutte({ placedAt: null, removedAt: null }), bedName), 'P1, P2');
  assert.equal(posePlaceLabel(rampe({ placedAt: null, removedAt: null }), bedName), 'entre P3 et P4');
  assert.equal(posePlaceLabel({ ...rampe({ placedAt: null, removedAt: null }), anchor: { type: 'bed_center', anchorBedOtfId: 'p3' } }, bedName), 'P3');
  assert.equal(posePlaceLabel(goutteAGoutte({ placedAt: null, removedAt: null }, ['p1', 'inconnue']), bedName), 'P1, une planche absente de cette saison');
});

test('l’historique des poses : du…, au…, l’endroit et le réglage', () => {
  const fermee = { ...goutteAGoutte({ placedAt: LUNDI_9H, removedAt: MARDI_9H }), removedAt: MARDI_9H, settingName: 'Réglage 1' };
  assert.equal(closedPoseLabel(fermee, bedName), 'Du 2 novembre à 9 h 00 au 3 novembre à 9 h 00 · P1, P2 · Réglage 1');
  assert.equal(
    closedPoseLabel({ ...fermee, placedAt: null }, bedName),
    'Jusqu’au 3 novembre à 9 h 00, date de pose non renseignée · P1, P2 · Réglage 1',
  );
});

test('le compte de l’inventaire distingue posés et stockés, parmi les matériels actifs seulement', () => {
  const poses = [
    goutteAGoutte({ placedAt: null, removedAt: null }, ['p1'], 'a'),
    goutteAGoutte({ placedAt: null, removedAt: MARDI_9H }, ['p2'], 'b'),
    goutteAGoutte({ placedAt: null, removedAt: null }, ['p3'], 'archive'),
  ];
  assert.deepEqual(poseCounts(['a', 'b', 'c'], poses), { posed: 1, stored: 1 });
});

test('une irrigation planifiée bloquée porte son signal ; démarrable, aucun', () => {
  const prevue = {
    season: 2026,
    status: 'planned' as const,
    equipment: { equipmentId: 'gag', placementSnapshot: goutteAGoutte({ placedAt: null, removedAt: null }), timerState: null },
  };
  assert.equal(
    plannedIrrigationSignal(prevue, goutteAGoutte({ placedAt: null, removedAt: MERCREDI_8H })),
    'Matériel stocké depuis le 4 novembre à 8 h 00 : reposez-le ou annulez cette irrigation.',
  );
  assert.equal(
    plannedIrrigationSignal(prevue, goutteAGoutte({ placedAt: VENDREDI_8H, removedAt: null }, ['p7'])),
    'Matériel reposé ailleurs : annulez cette irrigation et planifiez-en une nouvelle.',
  );
  assert.equal(plannedIrrigationSignal(prevue, goutteAGoutte({ placedAt: VENDREDI_8H, removedAt: null })), null);
  assert.equal(plannedIrrigationSignal({ ...prevue, status: 'completed' }, null), null);
});

test('règle 12 à l’écran : la saisie après coup propose le matériel posé à l’heure de début, même retiré depuis', () => {
  const poses = [
    goutteAGoutte({ placedAt: LUNDI_9H, removedAt: MARDI_9H }),
    goutteAGoutte({ placedAt: VENDREDI_8H, removedAt: null }, ['p7']),
    goutteAGoutte({ placedAt: null, removedAt: null }, ['p3'], 'autre'),
  ];
  const lundi = placementsOpenAt(poses, '2026-11-02T09:00:00.000Z');
  assert.deepEqual(lundi.map((placement) => [placement.equipmentId, placement.selectedBeds.map((bed) => bed.otfBedId)]), [['gag', ['p1', 'p2']], ['autre', ['p3']]]);
  assert.ok(lundi.every((placement) => !('placedAt' in placement)), 'une position, sans les dates de la pose');
  assert.deepEqual(placementsOpenAt(poses, MERCREDI_8H).map((placement) => placement.equipmentId), ['autre'], 'mercredi, il était stocké');
});
