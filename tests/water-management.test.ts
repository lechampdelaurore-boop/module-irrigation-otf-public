import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDailyWaterLedger,
  dailyLimitViolationPolicy,
  dateKeyInTimeZone,
  evaluateDailyWaterLimit,
  firstLimitedDay,
  irrigationVolumeCubicMeters,
  irrigationVolumeIncomplete,
  isValidDateKey,
  latestApplicableLimit,
  remainingIrrigationForStart,
  localDateStartUtc,
  localDateTimeUtc,
  manualRainInput,
  splitVolumeAcrossLocalDays,
  weekDateKeys,
  weekStartDateKey,
  type DailyWaterLimit,
} from '../lib/domain/water-management.ts';

test('une semaine va toujours du lundi au dimanche', () => {
  assert.equal(weekStartDateKey('2026-09-02'), '2026-08-31');
  assert.deepEqual(weekDateKeys('2026-09-02'), [
    '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
    '2026-09-04', '2026-09-05', '2026-09-06',
  ]);
});

test('les dates civiles impossibles sont refusées', () => {
  assert.equal(isValidDateKey('2026-02-30'), false);
  assert.equal(isValidDateKey('2026-02-29'), false);
  assert.equal(isValidDateKey('2028-02-29'), true);
  assert.throws(() => weekStartDateKey('2026-02-30'));
});

test('une pause traversant minuit n’attribue aucune eau à la période arrêtée', () => {
  const irrigation = event({ id: 'paused-midnight', status: 'completed',
    actualStartAt: '2026-09-01T21:00:00Z', actualEndAt: '2026-09-02T01:00:00Z',
    actualAmountMm: 20 });
  const eventEquipmentId = irrigation.equipment.id;
  irrigation.timerHistory = [
    { at: '2026-09-01T21:00:00Z', action: 'created', payload: { eventEquipmentId, kind: 'running' } },
    { at: '2026-09-01T21:30:00Z', action: 'updated', payload: { eventEquipmentId, timerAction: 'paused' } },
    { at: '2026-09-02T00:00:00Z', action: 'updated', payload: { eventEquipmentId, timerAction: 'resumed' } },
    { at: '2026-09-02T01:05:00Z', action: 'completed', payload: { eventEquipmentId, actualEndAt: '2026-09-02T01:00:00Z' } },
  ];
  const ledger = buildDailyWaterLedger([irrigation]);
  assert.ok(Math.abs(ledger[0].realizedCubicMeters - 2 / 3) < 1e-9);
  assert.ok(Math.abs(ledger[1].realizedCubicMeters - 4 / 3) < 1e-9);
});

test('un minuteur non confirmé reste une estimation réservée et jamais du réalisé', () => {
  const running = event({ id: 'running', status: 'planned', plannedAmountMm: 10 });
  running.equipment.timerState = 'running';
  running.equipment.timerStartedAt = '2026-09-02T08:00:00Z';
  running.equipment.timerResumedAt = '2026-09-02T08:00:00Z';
  const ledger = buildDailyWaterLedger([running], new Date('2026-09-02T10:00:00Z'));
  assert.equal(ledger[0].realizedCubicMeters, 0);
  assert.equal(ledger[0].estimatedOngoingCubicMeters, 2);
  const violations = evaluateDailyWaterLimit({ ledger,
    limits: [{ id: 'l', season: 2026, enabled: true, maxCubicMetersPerDay: 2,
      validFrom: '2026-01-01', validUntil: null, note: null, createdAt: '2026-01-01T00:00:00Z' }],
    candidateByDate: new Map([['2026-09-02', 1]]),
  });
  assert.equal(violations[0].exceededByCubicMeters, 1);
  assert.equal(violations[0].alreadyEstimatedCubicMeters, 2);
});

test('la conversion des jours respecte le changement d’heure français', () => {
  const springDay = localDateStartUtc('2026-03-29').getTime();
  const nextDay = localDateStartUtc('2026-03-30').getTime();
  assert.equal((nextDay - springDay) / 3_600_000, 23);
});

test('une heure d’horloge de la ferme devient l’instant qu’elle désigne', () => {
  // Minuit n'est qu'un cas particulier : c'est la même conversion qui sert aux
  // heures saisies à la main, et elle doit tenir en été comme en hiver.
  assert.equal(
    localDateTimeUtc('2026-09-25', { hour: 18, minute: 48, second: 0 }).toISOString(),
    '2026-09-25T16:48:00.000Z',
  );
  assert.equal(
    localDateTimeUtc('2026-01-15', { hour: 18, minute: 48, second: 0 }).toISOString(),
    '2026-01-15T17:48:00.000Z',
  );
  assert.equal(
    localDateStartUtc('2026-09-25').toISOString(),
    localDateTimeUtc('2026-09-25', { hour: 0, minute: 0, second: 0 }).toISOString(),
  );
});

test('un fuseau reste le sien, formateurs réutilisés compris', () => {
  // Les formateurs de fuseau sont construits une fois par fuseau (point
  // ouvert 28) : deux fuseaux, deux formateurs, jamais l'un pour l'autre.
  const instant = new Date('2026-10-05T23:30:00.000Z');
  assert.equal(dateKeyInTimeZone(instant, 'Europe/Paris'), '2026-10-06');
  assert.equal(dateKeyInTimeZone(instant, 'America/Los_Angeles'), '2026-10-05');
  assert.equal(dateKeyInTimeZone(instant, 'Europe/Paris'), '2026-10-06');
  const six = { hour: 6, minute: 0, second: 0 };
  assert.equal(localDateTimeUtc('2026-10-06', six, 'Europe/Paris').toISOString(), '2026-10-06T04:00:00.000Z');
  assert.equal(localDateTimeUtc('2026-10-06', six, 'Pacific/Auckland').toISOString(), '2026-10-05T17:00:00.000Z');
  assert.equal(localDateTimeUtc('2026-10-06', six, 'Europe/Paris').toISOString(), '2026-10-06T04:00:00.000Z');
});

test('un volume traversant minuit est réparti au prorata entre les deux jours', () => {
  const split = splitVolumeAcrossLocalDays({
    startAt: '2026-09-01T21:30:00.000Z',
    endAt: '2026-09-01T22:30:00.000Z',
    cubicMeters: 2,
  });
  assert.equal(split.get('2026-09-01'), 1);
  assert.equal(split.get('2026-09-02'), 1);
});

test('une planche sans surface mouillée connue est laissée hors du volume, et le volume se dit incomplet', () => {
  const applications = [
    { wettedAreaSquareMeters: 100, plannedAmountMm: 10, actualAmountMm: 10 },
    { wettedAreaSquareMeters: null, plannedAmountMm: 10, actualAmountMm: 10 },
  ];
  // Un mètre cube connu, pas un mètre cube et demi inventé sur la planche seule.
  assert.equal(irrigationVolumeCubicMeters(applications, 'actual'), 1);
  assert.equal(irrigationVolumeIncomplete(applications, 'actual'), true);
  // Une planche inconnue qui n'a rien reçu ne rend rien incomplet.
  assert.equal(irrigationVolumeIncomplete([{ wettedAreaSquareMeters: null, plannedAmountMm: 0, actualAmountMm: 0 }], 'actual'), false);
});

test('un millimètre sur un mètre carré vaut un litre', () => {
  const volume = irrigationVolumeCubicMeters([{
    wettedAreaSquareMeters: 100,
    plannedAmountMm: 0,
    actualAmountMm: 20,
  }], 'actual');
  assert.equal(volume, 2);
});

test('le réalisé exclut les événements annulés et le planifié reste distinct', () => {
  const completed = event({
    id: 'completed',
    status: 'completed',
    actualStartAt: '2026-09-02T08:00:00.000Z',
    actualEndAt: '2026-09-02T09:00:00.000Z',
    actualAmountMm: 20,
  });
  const canceled = event({
    id: 'canceled',
    status: 'canceled',
    actualStartAt: '2026-09-02T10:00:00.000Z',
    actualEndAt: '2026-09-02T11:00:00.000Z',
    actualAmountMm: 30,
  });
  const planned = event({
    id: 'planned',
    status: 'planned',
    plannedStartAt: '2026-09-02T12:00:00.000Z',
    plannedEndAt: '2026-09-02T13:00:00.000Z',
    plannedAmountMm: 10,
  });
  const [day] = buildDailyWaterLedger([completed, canceled, planned], new Date('2026-09-02T07:00:00Z'));
  assert.equal(day.date, '2026-09-02');
  assert.equal(day.realizedCubicMeters, 2);
  assert.equal(day.plannedCubicMeters, 1);
});

test('une irrigation partielle compte son réalisé et conserve seulement son reliquat planifié', () => {
  const partial = event({
    id: 'partial',
    status: 'partially_completed',
    plannedStartAt: '2026-09-02T08:00:00.000Z',
    plannedEndAt: '2026-09-02T10:00:00.000Z',
    actualStartAt: '2026-09-02T08:00:00.000Z',
    actualEndAt: '2026-09-02T09:00:00.000Z',
    plannedAmountMm: 20,
    actualAmountMm: 10,
  });
  const [day] = buildDailyWaterLedger([partial], new Date('2026-09-02T09:30:00Z'));
  assert.equal(day.realizedCubicMeters, 1);
  assert.equal(day.plannedCubicMeters, 1);
});

test('une limite active bloque seulement quand le cumul la dépasse', () => {
  const limits: DailyWaterLimit[] = [{
    id: 'limit', season: 2026, enabled: true,
    maxCubicMetersPerDay: 5, validFrom: '2026-09-01', validUntil: '2026-09-30',
    note: null, createdAt: '2026-09-01T00:00:00Z',
  }];
  const violations = evaluateDailyWaterLimit({
    ledger: [{ date: '2026-09-02', realizedCubicMeters: 2, plannedCubicMeters: 1 }],
    candidateByDate: new Map([['2026-09-02', 2.5]]),
    limits,
  });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].exceededByCubicMeters, 0.5);
  assert.equal(evaluateDailyWaterLimit({
    ledger: [],
    candidateByDate: new Map([['2026-09-02', 4]]),
    limits: [{ ...limits[0], id: 'off', enabled: false, maxCubicMetersPerDay: null }],
  }).length, 0);
});

test('une limite ne s’applique pas hors période et peut rester valable sans date de fin', () => {
  const dated: DailyWaterLimit = {
    id: 'dated', season: 2026, enabled: true,
    maxCubicMetersPerDay: 5, validFrom: '2026-09-01', validUntil: '2026-09-30',
    note: null, createdAt: '2026-09-01T00:00:00Z',
  };
  assert.equal(latestApplicableLimit([dated], '2026-08-31'), null);
  assert.equal(latestApplicableLimit([dated], '2026-10-01'), null);
  assert.equal(latestApplicableLimit([{
    ...dated,
    id: 'open-ended',
    validUntil: null,
    createdAt: '2026-10-01T00:00:00Z',
  }], '2030-01-01')?.id, 'open-ended');
});

test('le premier jour limité d’une période se cherche dans le fuseau de la ferme, limite active seulement', () => {
  // Point ouvert 24 : la règle que partagent la garde à la création et celle du démarrage.
  const limit: DailyWaterLimit = {
    id: 'from-2nd', season: 2026, enabled: true,
    maxCubicMetersPerDay: 5, validFrom: '2026-09-02', validUntil: null,
    note: null, createdAt: '2026-09-01T00:00:00Z',
  };
  // Du 1er septembre 23 h 30 au 2 septembre 0 h 30, heure de Paris : seul le 2 est limité.
  const startAt = '2026-09-01T21:30:00Z';
  const endAt = '2026-09-01T22:30:00Z';
  assert.equal(firstLimitedDay([limit], startAt, endAt), '2026-09-02');
  assert.equal(firstLimitedDay([limit], new Date(startAt), new Date(endAt)), '2026-09-02', 'dates aussi bien que chaînes');
  assert.equal(firstLimitedDay([limit], '2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z'), null, 'la veille n’est pas limitée');
  assert.equal(firstLimitedDay([{ ...limit, enabled: false }], startAt, endAt), null, 'limite désactivée');
  assert.equal(firstLimitedDay([limit], endAt, startAt), null, 'période vide');
});

test('un dépassement bloque le futur mais avertit sans falsifier une irrigation déjà réalisée', () => {
  assert.equal(dailyLimitViolationPolicy('planned'), 'block');
  assert.equal(dailyLimitViolationPolicy('running'), 'block');
  assert.equal(dailyLimitViolationPolicy('completed'), 'warn');
});

test('une reprise conserve le volume déjà réalisé dans le budget, sans compter deux fois son reliquat', () => {
  const partial = event({ id: 'partial', status: 'partially_completed', plannedAmountMm: 20, actualAmountMm: 10,
    actualStartAt: '2026-09-02T08:00:00Z', actualEndAt: '2026-09-02T09:00:00Z',
    plannedStartAt: '2026-09-02T08:00:00Z', plannedEndAt: '2026-09-02T10:00:00Z' });
  partial.equipment.plannedDurationSeconds = 7200;
  const now = new Date('2026-09-02T09:30:00Z');
  const [day] = buildDailyWaterLedger([partial], now, 'Europe/Paris', partial.equipment.id);
  assert.equal(day.realizedCubicMeters, 1);
  assert.equal(day.plannedCubicMeters, 0);
  assert.deepEqual(remainingIrrigationForStart(partial, now), { cubicMeters: 1, seconds: 3600 });
});

function event(input: {
  id: string;
  status: 'planned' | 'partially_completed' | 'completed' | 'canceled';
  plannedStartAt?: string;
  plannedEndAt?: string;
  actualStartAt?: string;
  actualEndAt?: string;
  plannedAmountMm?: number;
  actualAmountMm?: number;
  wettedAreaSquareMeters?: number | null;
}): IrrigationEventRecord {
  return {
    id: input.id,
    season: 2026,
    status: input.status,
    note: null,
    remainingCanceledAt: null,
    canceledAt: input.status === 'canceled' ? '2026-09-02T11:01:00Z' : null,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-02T00:00:00Z',
    equipment: {
      id: `equipment-${input.id}`,
      equipmentId: 'equipment',
      settingId: 'setting',
      placementId: 'placement',
      status: input.status,
      plannedStartAt: input.plannedStartAt ?? null,
      plannedEndAt: input.plannedEndAt ?? null,
      actualStartAt: input.actualStartAt ?? null,
      actualEndAt: input.actualEndAt ?? null,
      plannedDurationSeconds: input.plannedAmountMm ? 3600 : 0,
      actualDurationSeconds: input.actualAmountMm ? 3600 : 0,
      equipmentSnapshot: { id: 'equipment', name: 'Rampe', kind: 'sprinkler', mobility: 'mobile' },
      settingSnapshot: { id: 'setting', name: 'Standard', position: 1, kind: 'sprinkler', leftProfile: [{ distanceMeters: 0, rateMmPerHour: 10 }], rightProfile: [{ distanceMeters: 0, rateMmPerHour: 10 }] },
      placementSnapshot: { id: 'placement', equipmentId: 'equipment', settingId: 'setting', season: 2026, gardenGroupId: null, otfZoneId: 'zone', otfPlotId: 'plot', anchor: { type: 'bed_center', anchorBedOtfId: 'bed' }, selectedBeds: [{ otfZoneId: 'zone', otfPlotId: 'plot', otfBedId: 'bed' }] },
      timerState: null,
      timerStartedAt: null,
      timerResumedAt: null,
      timerPausedAt: null,
      timerTheoreticalEndAt: null,
      timerAccumulatedSeconds: 0,
      timerAlarmRevision: null,
      timerAlarmStatus: null,
      timerAlarmSyncedAt: null,
      remainingCanceledAt: null,
      canceledAt: input.status === 'canceled' ? '2026-09-02T11:01:00Z' : null,
      applications: [{
        otfZoneId: 'zone', otfPlotId: 'plot', otfBedId: 'bed',
        rateMmPerHour: 10, bedAreaSquareMeters: 100,
        wettedAreaSquareMeters: input.wettedAreaSquareMeters === undefined ? 100 : input.wettedAreaSquareMeters,
        plannedAmountMm: input.plannedAmountMm ?? 0,
        actualAmountMm: input.actualAmountMm ?? 0,
      }],
    },
  };
}

test('le champ « Millimètres » montre la mesure déjà saisie du jour choisi', () => {
  // Choix du porteur, 7 novembre 2026 (détail de la recette 3.7) : la mesure du jour, vide s'il n'y en a pas.
  const days = [
    { date: '2026-11-02', manualRainMm: 3.5 },
    { date: '2026-11-03', manualRainMm: 0 },
    { date: '2026-11-04', manualRainMm: null },
  ];

  assert.equal(manualRainInput(days, '2026-11-02'), '3,5', 'à la virgule, comme on l’écrit');
  assert.equal(manualRainInput(days, '2026-11-03'), '0', 'une mesure de 0 mm reste une mesure, jamais un champ vide');
  assert.equal(manualRainInput(days, '2026-11-04'), '', 'sans mesure saisie, le champ est vide');
  assert.equal(manualRainInput(days, '2026-11-09'), null, 'un jour hors de la semaine chargée : sa semaine est à charger');
});
