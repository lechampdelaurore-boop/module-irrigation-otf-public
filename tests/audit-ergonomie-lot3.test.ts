import assert from 'node:assert/strict';
import test from 'node:test';
import { hydraulicMessage } from '../lib/domain/hydraulic-message';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record';
import { irrigationList, listDayTitle } from '../lib/domain/irrigation-list';
import type { HydraulicFeasibility } from '../lib/domain/pumps';
import { planActionCounts, planActionLine, planActionTiles, unplacedGroups, unplacedTileDetail } from '../lib/domain/planning/action-summary';
import type { DoseReason, PlanBedOutcome, StoredProposal, TimingReason, UnplacedReason } from '../lib/domain/planning/contract';
import { PLAN_EVENT_LABELS, doseReasonLabel, timingReasonLabel, unplacedReasonLabel, unplacedReasonsExpertNote } from '../lib/domain/planning/presentation';
import { allDone, doneAsPlannedConfirmation, doneAsPlannedConfirmations } from '../lib/domain/today/all-done';
import { lateIrrigationLines } from '../lib/domain/today/today-irrigations';
import { plannedIrrigation } from './support/planning-fixtures';

/**
 * Audit ergonomique, lot 3, PR 1 (docs/audit-ergonomie-lot3-contract.md,
 * sections 3 et 6, cas 1 à 7) : les cartes de tête du planning, les planches
 * non servies rangées par motif, la phrase de faisabilité hydraulique, la
 * liste des arrosages par jour et « Fait comme prévu ». Aujourd'hui = jeudi
 * 12 novembre 2026, 18 h 00 à la ferme. Aucune règle de calcul ne change :
 * ces tests ne lisent que des comptes et des phrases.
 */

const NOW = new Date('2026-11-12T17:00:00.000Z');
const TOLERANCE = 30;
const minutesAfter = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();

function validated(id: string, startAt: string, endAt: string, irrigationStatus: StoredProposal['irrigationStatus'] = 'planned'): StoredProposal {
  return {
    storedId: id, status: 'validated', startAt, endAt, irrigationStatus,
    irrigation: {
      status: irrigationStatus ?? 'planned',
      equipment: {
        status: irrigationStatus ?? 'planned', plannedStartAt: startAt, plannedEndAt: endAt,
        timerState: null, timerStartedAt: null, remainingCanceledAt: null, canceledAt: null,
      },
    },
  } as unknown as StoredProposal;
}

const counts = (overrides: Partial<Record<'proposed' | 'validated' | 'refused' | 'replaced' | 'expired', number>> = {}) => ({
  counts: { proposed: 0, validated: 0, refused: 0, replaced: 0, expired: 0, ...overrides },
});

test('cas 1 : trois irrigations « Non faite » et aucune proposition, les cartes disent À valider 0 · Faites 0 · En retard 3', () => {
  const proposals = ['p1', 'p2', 'p3'].map((id, index) => validated(id, `2026-11-1${index}T06:00:00.000Z`, `2026-11-1${index}T07:00:00.000Z`));
  const actions = planActionCounts({ proposals }, counts({ validated: 3 }), TOLERANCE, NOW);
  assert.deepEqual([actions.toValidate, actions.done, actions.late, actions.missed], [0, 0, 3, 3]);
  const tiles = planActionTiles(actions);
  assert.deepEqual(tiles.map((tile) => [tile.label, tile.value]), [['À valider', '0'], ['Faites', '0'], ['En retard', '3']], 'le gros chiffre est ce qui demande un geste, dans cet ordre');
  assert.equal(tiles[2]?.tone, 'deficit');
  assert.equal(tiles[2]?.detail, 'dont 3 non faites');
  assert.equal(tiles[1]?.detail, 'sur 3 validées');
  assert.deepEqual(planActionLine(actions), ['0 à valider', '0 faite', '3 en retard']);
});

test('cas 1 : les refusées et les expirées passent en détail sous « À valider » ; une faite en partie compte parmi les faites', () => {
  const proposals = [
    validated('p1', '2026-11-10T06:00:00.000Z', '2026-11-10T07:00:00.000Z', 'completed'),
    validated('p2', '2026-11-11T06:00:00.000Z', '2026-11-11T07:00:00.000Z', 'partially_completed'),
    validated('p3', '2026-11-13T06:00:00.000Z', '2026-11-13T07:00:00.000Z'),
  ];
  const actions = planActionCounts({ proposals }, counts({ proposed: 4, validated: 3, refused: 1, expired: 2 }), TOLERANCE, NOW);
  const tiles = planActionTiles(actions);
  assert.deepEqual(tiles.map((tile) => [tile.label, tile.value, tile.detail]), [
    ['À valider', '4', '1 refusée · 2 expirées'],
    ['Faites', '2', 'sur 3 validées · dont 1 en partie'],
    ['En retard', '0', 'Rien en retard'],
  ]);
  assert.equal(tiles[2]?.tone, undefined, 'rien en retard : pas de rouge');
  assert.deepEqual(planActionLine(actions), ['4 à valider', '2 faites'], 'sans retard, la ligne du téléphone n’en parle pas');
});

test('le retard d’une validée suit la tolérance R14 de la page des arrosages ; démarrée ou sans irrigation retrouvée, elle n’est pas en retard', () => {
  const start = '2026-11-12T16:20:00.000Z'; // 17 h 20 à la ferme : quarante minutes passées
  const late = validated('late', start, minutesAfter(start, 120));
  const notYet = validated('not-yet', '2026-11-12T16:45:00.000Z', minutesAfter('2026-11-12T16:45:00.000Z', 120));
  const started = validated('started', start, minutesAfter(start, 120));
  started.irrigation!.equipment.timerState = 'running';
  started.irrigation!.equipment.timerStartedAt = start;
  const unknown = { ...validated('unknown', start, minutesAfter(start, 120)), irrigation: null };
  const actions = planActionCounts({ proposals: [late, notYet, started, unknown] }, counts({ validated: 4 }), TOLERANCE, NOW);
  assert.deepEqual([actions.late, actions.missed], [1, 0], 'seule celle dont la tolérance de 30 min est passée');
  assert.equal(planActionTiles(actions)[2]?.detail, 'à démarrer sur « Arrosages »');
});

function bed(id: string, reasons: UnplacedReason[], deficitMm = 0): PlanBedOutcome {
  return {
    bedId: id, bedName: id, plotName: 'Jardin', priority: 'normal', needMm: 10, targetMm: 10, placedMm: 0, surplusMm: 0,
    deficitMm, reasons, proposalIds: [], equipmentId: reasons.includes('no-equipment') ? null : 'rampe',
  };
}

test('cas 2 : 38 planches sans matériel et 2 sans eau, « Sans matériel (38) » en tête avec l’action vers « Matériel », « Manque d’eau » à part', () => {
  const beds = [
    ...Array.from({ length: 38 }, (_, index) => bed(`S${index + 1}`, ['no-equipment'])),
    bed('E1', ['water-budget'], 6),
    bed('E2', ['water-budget'], 4),
  ];
  const grouped = unplacedGroups(beds);
  assert.deepEqual(grouped.groups.map((group) => [group.key, group.title, group.beds.length]), [
    ['no-equipment', 'Sans matériel (38)', 38],
    ['water-budget', 'Manque d’eau (2)', 2],
  ]);
  assert.deepEqual(grouped.noEquipment, { count: 38, lead: '38 planches n’ont aucun matériel', link: 'les rattacher' });
  assert.equal(unplacedTileDetail(grouped, 40), 'dont 38 sans matériel · 2 autres avec un manque chiffré', 'les planches sans matériel jamais comptées en manque d’eau');
  assert.equal(unplacedTileDetail(unplacedGroups(beds.slice(0, 38)), 38), 'dont 38 sans matériel');
  assert.deepEqual(unplacedGroups([bed('S1', ['no-equipment'])]).noEquipment, { count: 1, lead: '1 planche n’a aucun matériel', link: 'la rattacher' });
});

test('cas 2 : le plus gros groupe d’abord ; à taille égale, l’ordre des motifs ; sans planche sans matériel, pas d’action', () => {
  const grouped = unplacedGroups([
    bed('R1', ['insufficient-reach']),
    bed('E1', ['water-budget']),
    bed('T1', ['no-time-left']),
    bed('T2', ['no-time-left']),
    bed('P1', []),
  ]);
  assert.deepEqual(grouped.groups.map((group) => group.title), [
    'Plus de plage horaire (2)',
    'Manque d’eau (1)',
    'Réglage plus large que la planche (1)',
    'Servies en partie, faute de place (1)',
  ]);
  assert.equal(grouped.noEquipment, null);
  assert.equal(unplacedTileDetail(grouped, 1), '1 avec un manque chiffré', 'sans planche sans matériel, le détail d’avant');
});

test('point 5.3 : les libellés visibles parlent en phrases ; les identifiants des règles restent pour les experts (F48)', () => {
  const unplaced: UnplacedReason[] = ['no-objective', 'no-equipment', 'below-minimum-dose', 'water-budget', 'deferred', 'pump-time', 'daily-limit', 'withdrawal-limit', 'reserve-timing', 'volume-unknown-under-limit', 'supply-unavailable', 'no-time-left', 'insufficient-reach', 'spacing', 'refused-slot', 'protected-slot'];
  const doses: DoseReason[] = ['remaining-need', 'maximum-dose', 'window-fit', 'pump-gap', 'daily-limit', 'reserved-share', 'reserve-level', 'last-day-below-minimum', 'refused-slot-fit', 'protected-slot-fit', 'withdrawal-limit', 'shortage-share'];
  const timings: TimingReason[] = ['earliest', 'after-forecast-rain', 'spacing', 'window', 'pump-capacity', 'reserve-inflow', 'daily-limit', 'after-refused-slot', 'after-protected-slot', 'withdrawal-limit'];
  const visible = [
    ...unplaced.map(unplacedReasonLabel), ...doses.map(doseReasonLabel), ...timings.map(timingReasonLabel),
    ...Object.values(PLAN_EVENT_LABELS),
  ].join(' | ');
  assert.doesNotMatch(visible, /\bR\d+\b|D-\d{3}|arbitrage/, visible);
  assert.match(unplacedReasonLabel('insufficient-reach'), /^réglage plus large que la planche/);
  assert.equal(PLAN_EVENT_LABELS['arbitration-validated'], 'un choix entre deux demandes d’eau validé');
  assert.equal(unplacedReasonsExpertNote(['insufficient-reach']), 'Pour les experts : R13, D-025');
  assert.equal(unplacedReasonsExpertNote(['spacing', 'refused-slot']), 'Pour les experts : R6, R7 ; D-030');
  assert.equal(unplacedReasonsExpertNote(['no-equipment', 'water-budget']), null, 'sans règle numérotée, pas d’infobulle');
});

function feasibility(overrides: Partial<HydraulicFeasibility> = {}): HydraulicFeasibility {
  return {
    possible: false, hydraulicallyVerified: true, reasons: ['simultaneous_flow_exceeded'],
    requiredFlowCubicMetersPerHour: 2.26, alreadyEngagedFlowCubicMetersPerHour: 6, totalFlowCubicMetersPerHour: 8.26,
    pumpCapacityCubicMetersPerHour: 8, remainingCapacityCubicMetersPerHour: 2, excessFlowCubicMetersPerHour: 0.26,
    conflictingIrrigations: [{ eventEquipmentId: 'x', label: 'Rampe nord' }],
    originAvailability: { status: 'available', message: 'La réserve est disponible.' },
    ...overrides,
  };
}

test('cas 4 : pompe à 8,26 pour 8 m³/h, une phrase d’action avec « il manque 0,26 m³/h », sans solution proposée', () => {
  const message = hydraulicMessage(feasibility(), false);
  assert.equal(message.tone, 'exceeded');
  assert.equal(message.sentence, 'La pompe ne peut pas alimenter ce matériel en plus des autres (en même temps que Rampe nord) : il manque 0,26 m³/h. Raccourcissez, décalez ou changez de pompe.');
  assert.equal(message.detail, 'Débit demandé 8,26 m³/h pour 8 m³/h de capacité ; 2 m³/h restaient libres avant cette irrigation. La réserve est disponible.');
  assert.deepEqual(Object.keys(message).sort(), ['detail', 'sentence', 'tone'], 'le moteur ne calcule aucune solution : rien à appliquer, pas de bouton (F46)');
});

test('cas 4 : seul, déjà réalisé, origine indisponible, pompe suffisante ou absente : chaque phrase dit quoi faire', () => {
  assert.equal(
    hydraulicMessage(feasibility({ reasons: ['unit_flow_exceeded'], conflictingIrrigations: [] }), false).sentence,
    'La pompe ne peut pas alimenter ce matériel : il manque 0,26 m³/h. Changez de pompe ou de réglage.',
  );
  assert.equal(
    hydraulicMessage(feasibility(), true).sentence,
    'La pompe ne pouvait pas alimenter ce matériel en plus des autres (en même temps que Rampe nord) : il manquait 0,26 m³/h. L’irrigation s’enregistre quand même, avec son dépassement.',
    'une irrigation réalisée s’enregistre toujours, son dépassement dit',
  );
  const twoOthers = feasibility({ conflictingIrrigations: [{ eventEquipmentId: 'x', label: 'Rampe nord' }, { eventEquipmentId: 'y', label: 'Asperseur B' }, { eventEquipmentId: 'z', label: 'Asperseur B' }] });
  assert.match(hydraulicMessage(twoOthers, false).sentence, /\(en même temps que Rampe nord et Asperseur B\)/);
  assert.equal(
    hydraulicMessage(feasibility({ excessFlowCubicMetersPerHour: 0, totalFlowCubicMetersPerHour: 6.5, originAvailability: { status: 'unavailable', message: 'Le forage est fermé jusqu’au 15 novembre.' } }), false).sentence,
    'L’eau de cette origine n’est pas disponible : Le forage est fermé jusqu’au 15 novembre.',
  );
  const ok = hydraulicMessage(feasibility({ possible: true, reasons: ['capacity_sufficient'], excessFlowCubicMetersPerHour: 0, totalFlowCubicMetersPerHour: 6.5 }), false);
  assert.deepEqual([ok.tone, ok.sentence], ['ok', 'La pompe suffit : 6,5 m³/h sur 8 m³/h.']);
  assert.equal(hydraulicMessage(feasibility({ excessFlowCubicMetersPerHour: 1e-12, totalFlowCubicMetersPerHour: 8 }), false).tone, 'ok', 'un arrondi n’est pas un dépassement');
  const none = hydraulicMessage(feasibility({ hydraulicallyVerified: false, reasons: ['pump_missing'] }), false);
  assert.deepEqual([none.tone, none.sentence], ['unknown', 'Aucune pompe n’est choisie : la faisabilité n’est pas vérifiée. L’irrigation reste autorisée.']);
  assert.equal(hydraulicMessage(feasibility({ hydraulicallyVerified: false, reasons: ['pump_inactive'] }), false).sentence, 'La pompe choisie est désactivée : la faisabilité n’est pas vérifiée. Choisissez une pompe active.');
});

/** Une irrigation planifiée de `minutes` minutes, sur la planche P1. */
function irrigation(id: string, startAt: string, minutes = 60, equipmentName = 'Asperseur A'): IrrigationEventRecord {
  return plannedIrrigation(id, equipmentName, startAt, minutesAfter(startAt, minutes), ['b1']);
}

test('cas 5 : 28 irrigations sur 6 jours, « À traiter » en tête (non faites puis en retard), puis une ligne par irrigation groupée par jour', () => {
  const missed = [irrigation('m1', '2026-11-11T06:00:00.000Z', 90, 'Rampe nord'), irrigation('m2', '2026-11-10T18:00:00.000Z')];
  const late = [irrigation('l1', '2026-11-12T16:00:00.000Z', 120)];
  const days = ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'];
  const upcoming = Array.from({ length: 25 }, (_, index) => {
    const day = days[index % days.length]!;
    const hour = day === '2026-11-12' ? 18 + (index % 4) : 5 + (index % 12);
    return irrigation(`u${String(index).padStart(2, '0')}`, `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`);
  });
  const events = [...upcoming, ...late, ...missed];
  assert.equal(events.length, 28);
  const list = irrigationList(events, TOLERANCE, NOW);
  assert.deepEqual(list.toHandle.map((item) => [item.event.id, item.status, item.day]), [
    ['m2', 'Non faite', '2026-11-10'],
    ['m1', 'Non faite', '2026-11-11'],
    ['l1', 'En retard', '2026-11-12'],
  ], 'les non faites d’abord, les plus anciennes en tête, puis les en retard');
  assert.equal(list.toHandle[1]?.hour, '7 h');
  assert.deepEqual(list.days.map((day) => day.title), ['Aujourd’hui', 'Demain', 'Sam. 14 nov.', 'Dim. 15 nov.', 'Lun. 16 nov.', 'Mar. 17 nov.']);
  assert.equal(list.days.flatMap((day) => day.items).length, 25, 'une ligne par irrigation, aucune en double avec « À traiter »');
  for (const day of list.days) {
    assert.ok(day.items.every((item) => item.day === day.day && item.status === 'Planifiée' && item.lateness === null));
    const starts = day.items.map((item) => item.event.equipment.plannedStartAt ?? '');
    assert.deepEqual(starts, [...starts].sort(), `${day.title} : dans l’ordre de l’heure`);
  }
});

test('cas 5 : une partielle se range à son jour, à son heure réelle de début ; les titres de jour', () => {
  const partial = irrigation('p1', '2026-11-13T07:00:00.000Z');
  const started = { ...partial, status: 'partially_completed', equipment: { ...partial.equipment, status: 'partially_completed', plannedStartAt: null, plannedEndAt: null, actualStartAt: '2026-11-11T08:30:00.000Z' } } as IrrigationEventRecord;
  const list = irrigationList([started], TOLERANCE, NOW);
  assert.deepEqual(list.toHandle, []);
  assert.deepEqual(list.days.map((day) => [day.title, day.items.map((item) => [item.status, item.hour])]), [['Hier', [['Partielle', '9 h 30']]]]);
  assert.equal(listDayTitle('2026-11-12', '2026-11-12'), 'Aujourd’hui');
  assert.equal(listDayTitle('2026-11-13', '2026-11-12'), 'Demain');
  assert.equal(listDayTitle('2026-11-11', '2026-11-12'), 'Hier');
  assert.equal(listDayTitle('2026-11-09', '2026-11-12'), 'Lun. 9 nov.');
});

function confirmations(events: IrrigationEventRecord[], now = NOW) {
  const lines = lateIrrigationLines({ enabled: ['arrosages'], now, events, lateToleranceMinutes: TOLERANCE, bedNames: new Map([['b1', 'P1']]) });
  return doneAsPlannedConfirmations(allDone({ lines, events, now }));
}

test('cas 7 : « Fait comme prévu » sur une ligne passée, une confirmation d’une ligne qui répète l’heure et le volume et dit qu’elle ne se corrige plus', () => {
  const missed = irrigation('m1', '2026-11-11T06:00:00.000Z', 90, 'Rampe nord');
  const sentences = confirmations([missed]);
  assert.deepEqual([...sentences.keys()], ['m1-eq']);
  assert.equal(sentences.get('m1-eq'), 'Enregistrer comme faite Rampe nord · Standard, hier de 7 h à 8 h 30, 0,017 m³ ? Elle ne se corrigera plus dans le module.');
});

test('cas 7 : absent sur une ligne future, en retard mais pas finie, ou déjà démarrée ; le même jugement que « Tout est fait »', () => {
  const future = irrigation('f1', '2026-11-13T06:00:00.000Z');
  const lateNotOver = irrigation('l1', '2026-11-12T16:00:00.000Z', 120);
  const base = irrigation('s1', '2026-11-11T06:00:00.000Z');
  const started = { ...base, equipment: { ...base.equipment, timerState: 'running', timerStartedAt: '2026-11-11T06:10:00.000Z' } } as IrrigationEventRecord;
  const missed = irrigation('m1', '2026-11-11T09:00:00.000Z');
  assert.deepEqual([...confirmations([future, lateNotOver, started, missed]).keys()], ['m1-eq'], 'seule la non faite que la règle accepte');
  assert.deepEqual([...confirmations([lateNotOver], new Date('2026-11-12T18:01:00.000Z')).keys()], ['l1-eq'], 'son heure de fin passée, la en retard devient enregistrable');
  assert.equal(doneAsPlannedConfirmations(null).size, 0);
});

test('cas 7 : un volume inconnu se dit inconnu, jamais zéro (D-003) ; le jour s’écrit en minuscule dans la phrase', () => {
  assert.equal(
    doneAsPlannedConfirmation({ title: 'Asperseur A · Buse 2', hours: '6 h à 7 h', cubicMeters: null }, 'Lun. 9 nov.'),
    'Enregistrer comme faite Asperseur A · Buse 2, lun. 9 nov. de 6 h à 7 h, volume inconnu ? Elle ne se corrigera plus dans le module.',
  );
  assert.equal(
    doneAsPlannedConfirmation({ title: 'Rampe', hours: '5 h à 6 h', cubicMeters: 1.2 }, 'Aujourd’hui'),
    'Enregistrer comme faite Rampe, aujourd’hui de 5 h à 6 h, 1,20 m³ ? Elle ne se corrigera plus dans le module.',
  );
});
