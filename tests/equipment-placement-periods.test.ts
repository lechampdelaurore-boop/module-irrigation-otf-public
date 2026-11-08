import assert from 'node:assert/strict';
import test from 'node:test';
import type { EquipmentPlacementRecord } from '../lib/domain/equipment-placement-record.ts';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import {
  checkPlacementDate,
  checkRemovalDate,
  completedIrrigationPoseRefusalMessage,
  equipmentPoseState,
  irrigationsThatCount,
  irrigationUseOfPlacement,
  plannedIrrigationStartBlock,
  plannedStartBlockMessage,
  poseAt,
  poseDateAt,
  poseDateRefusalMessage,
  poseForCompletedIrrigation,
  posedPlacements,
  proposalValidationBlock,
  proposalValidationBlockMessage,
  storedGapAround,
  storedGapMessage,
  type PlacementPose,
} from '../lib/domain/equipment-placement-periods.ts';

// Scénarios de docs/equipment-placement-periods-contract.md (2.11, D-043).
// Semaine du lundi 2 au dimanche 8 novembre 2026, heure d'hiver : Paris = UTC + 1.
const SAISON = 2026;
const LUNDI_9H = '2026-11-02T08:00:00.000Z';
const LUNDI_10H = '2026-11-02T09:00:00.000Z';
const LUNDI_11H = '2026-11-02T10:00:00.000Z';
const MARDI_9H = '2026-11-03T08:00:00.000Z';
const MERCREDI_8H = '2026-11-04T07:00:00.000Z';
const VENDREDI_8H = '2026-11-06T07:00:00.000Z';
const VENDREDI_MIDI = new Date('2026-11-06T11:00:00.000Z');

const goutteAGoutte = (
  dates: { placedAt: string | null; removedAt: string | null },
  beds = ['planche-1', 'planche-2'],
): PlacementPose => ({
  id: 'pose-gag',
  equipmentId: 'gag-1',
  settingId: 'reglage-1',
  season: SAISON,
  gardenGroupId: null,
  otfZoneId: 'zone-1',
  otfPlotId: 'jardin-1',
  anchor: { type: 'bed_center', anchorBedOtfId: beds[0] },
  selectedBeds: beds.map((otfBedId) => ({ otfZoneId: 'zone-1', otfPlotId: 'jardin-1', otfBedId })),
  ...dates,
});

const rampe = (dates: { placedAt: string | null; removedAt: string | null }, entre: [string, string]): PlacementPose => ({
  id: 'pose-rampe',
  equipmentId: 'rampe-3',
  settingId: 'minimal',
  season: SAISON,
  gardenGroupId: null,
  otfZoneId: 'zone-1',
  otfPlotId: 'bloc-3',
  anchor: { type: 'between_beds', beforeBedOtfId: entre[0], afterBedOtfId: entre[1] },
  selectedBeds: [],
  ...dates,
});

const irrigation = (
  placementId: string,
  moments: { start: string | null; end: string | null },
  status: IrrigationEventRecord['status'] = 'completed',
  timerState: IrrigationEventRecord['equipment']['timerState'] = null,
): IrrigationEventRecord => ({
  id: `irrigation-${moments.start}`,
  season: SAISON,
  status,
  note: null,
  remainingCanceledAt: null,
  canceledAt: null,
  createdAt: LUNDI_9H,
  updatedAt: LUNDI_9H,
  equipment: {
    placementId,
    actualStartAt: moments.start,
    actualEndAt: moments.end,
    timerState,
  } as IrrigationEventRecord['equipment'],
});

test('scénario 1 : un goutte-à-goutte qui a déjà arrosé se retire, et devient stocké', () => {
  const pose = goutteAGoutte({ placedAt: null, removedAt: null });
  const usage = irrigationUseOfPlacement([irrigation('pose-gag', { start: LUNDI_9H, end: LUNDI_10H })], 'pose-gag');
  assert.deepEqual(usage, { lastEndAt: LUNDI_10H, inProgress: false });
  assert.equal(
    checkRemovalDate({ removedAt: MARDI_9H, now: VENDREDI_MIDI, season: SAISON, current: pose, irrigations: usage }),
    null,
  );
  assert.deepEqual(equipmentPoseState({ ...pose, removedAt: MARDI_9H }), { kind: 'stored', removedAt: MARDI_9H });
});

test('scénario 2 : un retrait daté avant la fin de la dernière irrigation est refusé, et la nomme', () => {
  const pose = goutteAGoutte({ placedAt: null, removedAt: null });
  const usage = irrigationUseOfPlacement([irrigation('pose-gag', { start: LUNDI_9H, end: LUNDI_10H })], 'pose-gag');
  const refus = checkRemovalDate({ removedAt: LUNDI_9H, now: VENDREDI_MIDI, season: SAISON, current: pose, irrigations: usage });
  assert.deepEqual(refus, { code: 'before_last_irrigation', irrigationEndAt: LUNDI_10H });
  assert.equal(
    poseDateRefusalMessage(refus!),
    'Une irrigation sur ce matériel s’est terminée le 2 novembre à 10 h 00 : il ne peut pas avoir été retiré avant.',
  );
});

test('scénario 3 : un retrait est refusé tant qu’une irrigation est en cours', () => {
  const pose = goutteAGoutte({ placedAt: LUNDI_9H, removedAt: null });
  // Démarrée au minuteur depuis une irrigation planifiée : pas encore de début
  // réel enregistré, seul le minuteur dit qu'elle arrose.
  const usage = irrigationUseOfPlacement([irrigation('pose-gag', { start: null, end: null }, 'planned', 'running')], 'pose-gag');
  assert.equal(usage.inProgress, true);
  assert.deepEqual(
    checkRemovalDate({ removedAt: LUNDI_11H, now: VENDREDI_MIDI, season: SAISON, current: pose, irrigations: usage }),
    { code: 'irrigation_in_progress' },
  );
});

test('une irrigation planifiée non démarrée, ou annulée avant de commencer, ne retient pas le retrait', () => {
  const usage = irrigationUseOfPlacement([
    irrigation('pose-gag', { start: null, end: null }, 'planned'),
    irrigation('pose-gag', { start: null, end: null }, 'canceled'),
    irrigation('autre-pose', { start: null, end: null }, 'planned', 'running'),
  ], 'pose-gag');
  assert.deepEqual(usage, { lastEndAt: null, inProgress: false });
});

test('une irrigation reprise après une partie, ou en pause, est en cours ; la partie faite compte', () => {
  const reprise = irrigationUseOfPlacement(
    [irrigation('pose-gag', { start: LUNDI_9H, end: LUNDI_10H }, 'partially_completed', 'running')],
    'pose-gag',
  );
  assert.deepEqual(reprise, { lastEndAt: LUNDI_10H, inProgress: true });
  const enPause = irrigationUseOfPlacement(
    [irrigation('pose-gag', { start: null, end: null }, 'planned', 'paused')],
    'pose-gag',
  );
  assert.equal(enPause.inProgress, true);
});

test('scénario 4 : stocké mardi, reposé vendredi ailleurs ; deux poses, chacune à sa place', () => {
  const fermee = goutteAGoutte({ placedAt: LUNDI_9H, removedAt: MARDI_9H });
  assert.equal(
    checkPlacementDate({ placedAt: VENDREDI_8H, now: VENDREDI_MIDI, season: SAISON, current: fermee }),
    null,
  );
  const ouverte = goutteAGoutte({ placedAt: VENDREDI_8H, removedAt: null }, ['planche-7']);
  const poses = [fermee, ouverte];
  assert.equal(poseAt(poses, LUNDI_11H), fermee);
  assert.equal(poseAt(poses, MERCREDI_8H), null);
  assert.equal(poseAt(poses, VENDREDI_MIDI.toISOString()), ouverte);
  assert.deepEqual(posedPlacements(poses), [ouverte]);
});

test('scénario 5 : dates incohérentes refusées, retrait ancien accepté', () => {
  const ouverte = goutteAGoutte({ placedAt: '2026-10-01T08:00:00.000Z', removedAt: null });
  const sansIrrigation = { lastEndAt: null, inProgress: false };
  assert.deepEqual(
    checkRemovalDate({ removedAt: '2026-11-07T08:00:00.000Z', now: VENDREDI_MIDI, season: SAISON, current: ouverte, irrigations: sansIrrigation }),
    { code: 'future', now: VENDREDI_MIDI.toISOString() },
  );
  assert.deepEqual(
    checkPlacementDate({ placedAt: '2025-12-31T08:00:00.000Z', now: VENDREDI_MIDI, season: SAISON, current: null }),
    { code: 'outside_season', season: SAISON },
  );
  assert.deepEqual(
    checkPlacementDate({ placedAt: LUNDI_9H, now: VENDREDI_MIDI, season: SAISON, current: goutteAGoutte({ placedAt: null, removedAt: MARDI_9H }) }),
    { code: 'before_previous_removal', previousRemovedAt: MARDI_9H },
  );
  assert.deepEqual(
    checkRemovalDate({ removedAt: '2026-09-30T08:00:00.000Z', now: VENDREDI_MIDI, season: SAISON, current: ouverte, irrigations: sansIrrigation }),
    { code: 'before_placement', placedAt: '2026-10-01T08:00:00.000Z' },
  );
  // Trois semaines en arrière, après la dernière irrigation : accepté, pas de limite de jours.
  const usage = { lastEndAt: '2026-10-10T08:00:00.000Z', inProgress: false };
  assert.equal(
    checkRemovalDate({ removedAt: '2026-10-16T08:00:00.000Z', now: VENDREDI_MIDI, season: SAISON, current: ouverte, irrigations: usage }),
    null,
  );
});

test('point ouvert 47 : une date en avance de deux minutes au plus sur l’heure du serveur vaut maintenant', () => {
  const ouverte = goutteAGoutte({ placedAt: '2026-10-01T08:00:00.000Z', removedAt: null });
  const sansIrrigation = { lastEndAt: null, inProgress: false };
  // L'horloge de l'ordinateur avance de quelques secondes : « maintenant »,
  // saisi à la minute, 12 h 01, dépasse l'heure du serveur, 12 h 00 min 20 s.
  const serveur = new Date('2026-11-06T11:00:20.000Z');
  const maintenantSurLOrdinateur = '2026-11-06T11:01:00.000Z';
  assert.equal(poseDateAt(maintenantSurLOrdinateur, serveur), serveur.toISOString(), 'enregistrée à l’heure du serveur');
  assert.equal(
    checkRemovalDate({ removedAt: poseDateAt(maintenantSurLOrdinateur, serveur), now: serveur, season: SAISON, current: ouverte, irrigations: sansIrrigation }),
    null,
  );
  assert.equal(poseDateAt('2026-11-06T11:02:20.000Z', serveur), serveur.toISOString(), 'deux minutes pile : encore maintenant');
  // Au-delà, la date reste telle quelle et le refus tient.
  const auDela = '2026-11-06T11:03:00.000Z';
  assert.equal(poseDateAt(auDela, serveur), auDela);
  assert.deepEqual(
    checkRemovalDate({ removedAt: poseDateAt(auDela, serveur), now: serveur, season: SAISON, current: ouverte, irrigations: sansIrrigation }),
    { code: 'future', now: serveur.toISOString() },
  );
  // Une date passée, ou illisible, ne change pas.
  assert.equal(poseDateAt(LUNDI_9H, serveur), LUNDI_9H);
  assert.equal(poseDateAt('pas une date', serveur), 'pas une date');
});

test('une seule pose ouverte : on ne pose pas un matériel posé, on ne retire pas un matériel stocké', () => {
  const sansIrrigation = { lastEndAt: null, inProgress: false };
  assert.deepEqual(
    checkPlacementDate({ placedAt: MARDI_9H, now: VENDREDI_MIDI, season: SAISON, current: goutteAGoutte({ placedAt: LUNDI_9H, removedAt: null }) }),
    { code: 'already_posed' },
  );
  assert.deepEqual(
    checkRemovalDate({ removedAt: MARDI_9H, now: VENDREDI_MIDI, season: SAISON, current: goutteAGoutte({ placedAt: null, removedAt: LUNDI_9H }), irrigations: sansIrrigation }),
    { code: 'already_stored' },
  );
  assert.deepEqual(
    checkRemovalDate({ removedAt: 'pas une date', now: VENDREDI_MIDI, season: SAISON, current: goutteAGoutte({ placedAt: null, removedAt: null }), irrigations: sansIrrigation }),
    { code: 'invalid_date' },
  );
});

test('scénario 6 : les calculs ne voient que le matériel posé', () => {
  const posé = goutteAGoutte({ placedAt: null, removedAt: null });
  const stocké = { ...goutteAGoutte({ placedAt: null, removedAt: MARDI_9H }), id: 'pose-stockee', equipmentId: 'gag-2' };
  assert.deepEqual(posedPlacements([posé, stocké]), [posé]);
});

test('scénario 7 : une irrigation planifiée ne démarre pas sur un matériel stocké, ni reposé ailleurs', () => {
  const prevue = goutteAGoutte({ placedAt: null, removedAt: null });
  const stocke = plannedIrrigationStartBlock(prevue, goutteAGoutte({ placedAt: null, removedAt: MERCREDI_8H }));
  assert.deepEqual(stocke, { code: 'equipment_stored', removedAt: MERCREDI_8H });
  assert.equal(
    plannedStartBlockMessage(stocke!),
    'Matériel stocké depuis le 4 novembre à 8 h 00 : reposez-le ou annulez cette irrigation.',
  );
  // Reposé sur les mêmes planches, dans un autre ordre : démarrable.
  assert.equal(
    plannedIrrigationStartBlock(prevue, goutteAGoutte({ placedAt: VENDREDI_8H, removedAt: null }, ['planche-2', 'planche-1'])),
    null,
  );
  // Une planche de plus, même première planche : ce n'est plus le même endroit.
  assert.deepEqual(
    plannedIrrigationStartBlock(prevue, goutteAGoutte({ placedAt: VENDREDI_8H, removedAt: null }, ['planche-1', 'planche-2', 'planche-3'])),
    { code: 'equipment_moved' },
  );
  // Reposé ailleurs : bloqué.
  const ailleurs = plannedIrrigationStartBlock(prevue, goutteAGoutte({ placedAt: VENDREDI_8H, removedAt: null }, ['planche-7']));
  assert.deepEqual(ailleurs, { code: 'equipment_moved' });
  assert.equal(
    plannedStartBlockMessage(ailleurs!),
    'Matériel reposé ailleurs : annulez cette irrigation et planifiez-en une nouvelle.',
  );
});

test('D-044 : une irrigation planifiée que la règle 13 empêche de démarrer ne compte plus dans les calculs', () => {
  const prevue = (id: string, status: IrrigationEventRecord['status'], timerState: IrrigationEventRecord['equipment']['timerState'] = null) => ({
    id,
    season: SAISON,
    status,
    equipment: {
      equipmentId: 'gag-1',
      placementSnapshot: goutteAGoutte({ placedAt: null, removedAt: null }) as EquipmentPlacementRecord,
      timerState,
    },
  });
  const planifiee = prevue('planifiee', 'planned');
  const enCours = prevue('en-cours', 'planned', 'running');
  const faite = prevue('faite', 'completed');
  const toutes = [planifiee, enCours, faite];

  // Posé au même endroit : tout compte.
  assert.deepEqual(irrigationsThatCount(toutes, [goutteAGoutte({ placedAt: null, removedAt: null })]), toutes);
  // Stocké : la planifiée non démarrée ne compte plus ; celle qui tourne et celle qui est faite, si.
  const stocke = [goutteAGoutte({ placedAt: null, removedAt: MERCREDI_8H })];
  assert.deepEqual(irrigationsThatCount(toutes, stocke).map((event) => event.id), ['en-cours', 'faite']);
  // Reposé ailleurs : de même.
  const ailleurs = [goutteAGoutte({ placedAt: VENDREDI_8H, removedAt: null }, ['planche-7'])];
  assert.deepEqual(irrigationsThatCount(toutes, ailleurs).map((event) => event.id), ['en-cours', 'faite']);
  // Reposé au même endroit : elle recompte.
  const repose = [goutteAGoutte({ placedAt: VENDREDI_8H, removedAt: null }, ['planche-2', 'planche-1'])];
  assert.deepEqual(irrigationsThatCount(toutes, repose), toutes);
  // Une pose d'une autre saison ne dit rien de celle-ci : sans pose de la saison, la planifiée ne démarre pas.
  assert.deepEqual(
    irrigationsThatCount([planifiee], [{ ...goutteAGoutte({ placedAt: null, removedAt: null }), season: SAISON + 1 }]),
    [],
  );
});

test('scénario 8 : une proposition dont le matériel a été retiré depuis le calcul est refusée, avec son explication', () => {
  const calcul = '2026-10-28T05:15:00.000Z';
  const bloc = proposalValidationBlock({
    equipmentName: 'rampe bloc 3',
    calculatedAt: calcul,
    current: { placedAt: null, removedAt: '2026-10-28T17:40:00.000Z' },
  });
  assert.equal(
    proposalValidationBlockMessage(bloc!),
    'Validation impossible : le matériel « rampe bloc 3 » a été retiré et stocké le 28 octobre à 18 h 40, '
      + 'après le calcul de ce plan (28 octobre, 6 h 15). Recalculez le plan pour obtenir des propositions à jour.',
  );
  // Reposé après le calcul : la proposition a été calculée sur l'ancienne pose.
  const deplace = proposalValidationBlock({
    equipmentName: 'rampe bloc 3',
    calculatedAt: calcul,
    current: { placedAt: '2026-10-28T09:00:00.000Z', removedAt: null },
  });
  assert.equal(deplace?.code, 'moved_since_calculation');
  // Posé avant le calcul, ou depuis une date inconnue : rien ne bloque.
  assert.equal(proposalValidationBlock({ equipmentName: 'x', calculatedAt: calcul, current: { placedAt: '2026-10-27T09:00:00.000Z', removedAt: null } }), null);
  assert.equal(proposalValidationBlock({ equipmentName: 'x', calculatedAt: calcul, current: { placedAt: null, removedAt: null } }), null);
});

test('scénario 9 : une irrigation saisie sur une période de stockage est refusée, avec les dates qui l’entourent', () => {
  const poses = [
    goutteAGoutte({ placedAt: LUNDI_9H, removedAt: MARDI_9H }),
    goutteAGoutte({ placedAt: VENDREDI_8H, removedAt: null }, ['planche-7']),
  ];
  assert.equal(poseAt(poses, MERCREDI_8H), null);
  const trou = storedGapAround(poses, MERCREDI_8H);
  assert.deepEqual(trou, { removedAt: MARDI_9H, nextPlacedAt: VENDREDI_8H });
  assert.equal(
    storedGapMessage(trou),
    'Ce matériel était stocké à cette heure (retiré le 3 novembre à 9 h 00, reposé le 6 novembre à 8 h 00) : '
      + 'corrigez l’heure de l’irrigation ou les dates de pose.',
  );
});

test('règle 12 : une irrigation saisie après coup prend la pose ouverte à son heure de début, même retirée depuis', () => {
  const premiere = goutteAGoutte({ placedAt: LUNDI_9H, removedAt: MARDI_9H });
  const seconde = goutteAGoutte({ placedAt: VENDREDI_8H, removedAt: null }, ['planche-7']);
  const lundi = poseForCompletedIrrigation([premiere, seconde], LUNDI_10H, LUNDI_11H);
  assert.deepEqual(lundi, { ok: true, pose: premiere }, 'retiré mardi : l’irrigation de lundi garde les planches de lundi');
  const vendredi = poseForCompletedIrrigation([premiere, seconde], VENDREDI_8H, '2026-11-06T08:00:00.000Z');
  assert.deepEqual(vendredi, { ok: true, pose: seconde });
});

test('scénario 9 bis : saisie sur une période de stockage refusée par la même règle, son message selon les dates connues', () => {
  const premiere = goutteAGoutte({ placedAt: LUNDI_9H, removedAt: MARDI_9H });
  const seconde = goutteAGoutte({ placedAt: VENDREDI_8H, removedAt: null }, ['planche-7']);
  const mercredi = poseForCompletedIrrigation([premiere, seconde], MERCREDI_8H, '2026-11-04T08:00:00.000Z');
  if (mercredi.ok) assert.fail('mercredi, le matériel était stocké');
  assert.equal(
    completedIrrigationPoseRefusalMessage(mercredi.refusal),
    'Ce matériel était stocké à cette heure (retiré le 3 novembre à 9 h 00, reposé le 6 novembre à 8 h 00) : '
      + 'corrigez l’heure de l’irrigation ou les dates de pose.',
  );
  // Avant la première pose de la saison, après un retrait sans repose, sans aucune pose.
  assert.equal(
    storedGapMessage(storedGapAround([seconde], MERCREDI_8H)),
    'Ce matériel était stocké à cette heure (posé seulement le 6 novembre à 8 h 00) : '
      + 'corrigez l’heure de l’irrigation ou les dates de pose.',
  );
  assert.equal(
    storedGapMessage(storedGapAround([premiere], MERCREDI_8H)),
    'Ce matériel était stocké à cette heure (retiré le 3 novembre à 9 h 00, pas reposé depuis) : '
      + 'corrigez l’heure de l’irrigation ou les dates de pose.',
  );
  assert.equal(
    storedGapMessage(storedGapAround([], MERCREDI_8H)),
    'Ce matériel n’a jamais été posé cette saison : posez-le avant de saisir une irrigation.',
  );
});

test('règle 12 et règle 5 : une irrigation commencée sur une pose ne se termine pas après son retrait', () => {
  const premiere = goutteAGoutte({ placedAt: LUNDI_9H, removedAt: MARDI_9H });
  const debordante = poseForCompletedIrrigation([premiere], LUNDI_10H, MERCREDI_8H);
  assert.deepEqual(debordante, { ok: false, refusal: { code: 'removed_before_end', removedAt: MARDI_9H } });
  if (debordante.ok) assert.fail('retiré avant la fin');
  assert.equal(
    completedIrrigationPoseRefusalMessage(debordante.refusal),
    'Ce matériel a été retiré le 3 novembre à 9 h 00 : une irrigation commencée avant ne peut pas se terminer après. '
      + 'Corrigez l’heure de fin de l’irrigation.',
  );
  // Terminée à l'instant même du retrait : acceptée, comme un retrait daté à la fin de la dernière irrigation.
  assert.equal(poseForCompletedIrrigation([premiere], LUNDI_10H, MARDI_9H).ok, true);
});

test('scénario 10 : une pose ancienne, sans date de pose, reste posée depuis toujours et se retire', () => {
  const ancienne = goutteAGoutte({ placedAt: null, removedAt: null });
  assert.deepEqual(equipmentPoseState(ancienne), { kind: 'posed', placedAt: null });
  assert.equal(poseAt([ancienne], '2026-01-02T08:00:00.000Z'), ancienne);
  assert.equal(
    checkRemovalDate({ removedAt: MARDI_9H, now: VENDREDI_MIDI, season: SAISON, current: ancienne, irrigations: { lastEndAt: null, inProgress: false } }),
    null,
  );
  assert.deepEqual(equipmentPoseState(null), { kind: 'never' });
});

test('scénario 11 : une rampe mobile suit les mêmes règles, son ancrage entre deux planches comparé tel quel', () => {
  const avant = rampe({ placedAt: null, removedAt: null }, ['planche-3', 'planche-4']);
  const usage = irrigationUseOfPlacement([irrigation('pose-rampe', { start: LUNDI_9H, end: LUNDI_10H })], 'pose-rampe');
  assert.equal(
    checkRemovalDate({ removedAt: MARDI_9H, now: VENDREDI_MIDI, season: SAISON, current: avant, irrigations: usage }),
    null,
  );
  const memeEndroit = rampe({ placedAt: VENDREDI_8H, removedAt: null }, ['planche-3', 'planche-4']);
  const ailleurs = rampe({ placedAt: VENDREDI_8H, removedAt: null }, ['planche-5', 'planche-6']);
  assert.equal(plannedIrrigationStartBlock(avant as EquipmentPlacementRecord, memeEndroit), null);
  assert.deepEqual(plannedIrrigationStartBlock(avant, ailleurs), { code: 'equipment_moved' });
});
