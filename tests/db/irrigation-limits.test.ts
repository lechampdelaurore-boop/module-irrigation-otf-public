import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { enforceDailyLimitForStart } from '../../app/irrigation/irrigation-event/limits';
import { handledError } from '../../app/irrigation/irrigation-event/messages';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { saveDailyWaterLimitForUser } from '../../db/water-management-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { IrrigationBedApplicationDraft, IrrigationEventCreationKind } from '../../lib/domain/irrigation-event-record';
import { IrrigationDailyLimitExceededError, enforceDailyLimitForCreation, type IrrigationTiming } from '../../lib/services/irrigation-limits';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, createDripFixture, plannedDraft } from '../support/irrigation-fixtures';

/**
 * La garde de la limite journalière à la création (2.8,
 * docs/wetted-surface-contract.md, « Une irrigation sans surface mouillée
 * connue ») : une irrigation planifiée ou démarrée dont le volume ne peut pas
 * être vérifié sous une limite active est refusée — refus levé, jamais rendu
 * en avertissement (point ouvert 12, corrigé le 4 octobre 2026).
 */

const ALICE = 'alice';
/** Lundi 5 octobre 2026, de 6 h à 7 h, heure de Paris. */
const START = '2026-10-05T04:00:00.000Z';
const END = '2026-10-05T05:00:00.000Z';
const PLANNED: IrrigationTiming = { plannedStartAt: START, plannedEndAt: END, actualStartAt: null, actualEndAt: null, plannedDurationSeconds: 3600, actualDurationSeconds: 0 };
const RUNNING: IrrigationTiming = { ...PLANNED, actualStartAt: START };
const COMPLETED: IrrigationTiming = { plannedStartAt: null, plannedEndAt: null, actualStartAt: START, actualEndAt: END, plannedDurationSeconds: 0, actualDurationSeconds: 3600 };

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

function application(otfBedId: string, wettedAreaSquareMeters: number | null): IrrigationBedApplicationDraft {
  return { otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, otfBedId, rateMmPerHour: 10, bedAreaSquareMeters: 30, wettedAreaSquareMeters };
}

/** Une aspersion sur deux planches dont une sans passe-pied connu : son volume ne se vérifie pas. */
const UNVERIFIABLE = [application('bed-1', 45), application('bed-2', null)];
/** La même sur deux planches connues : 10 mm sur 75 m², 0,75 m³. */
const KNOWN = [application('bed-1', 45), application('bed-2', 30)];

async function dailyLimit(maxCubicMetersPerDay: number, enabled = true) {
  await ensureWorkspaceForUser(ALICE);
  await saveDailyWaterLimitForUser(ALICE, { season: 2026, enabled, maxCubicMetersPerDay, validFrom: '2026-09-01', validUntil: null, note: 'arrêté' });
}

function refusedUnverifiable(error: unknown) {
  return error instanceof IrrigationDailyLimitExceededError
    && /^Irrigation refusée : une limite journalière s’applique le 5 oct\. 2026 et le volume de cette aspersion ne peut pas être vérifié/.test(error.message);
}

test('une irrigation planifiée ou démarrée au volume invérifiable sous une limite active est refusée : la garde lève le refus, elle ne le rend pas', async () => {
  await dailyLimit(5);
  const kinds: IrrigationEventCreationKind[] = ['planned', 'running'];
  for (const kind of kinds) {
    await assert.rejects(
      enforceDailyLimitForCreation(ALICE, kind, kind === 'planned' ? PLANNED : RUNNING, UNVERIFIABLE),
      refusedUnverifiable,
      `${kind} : le refus est levé, pas rendu`,
    );
  }
});

test('sans limite active, l’irrigation planifiée est acceptée avec son volume inconnu', async () => {
  await ensureWorkspaceForUser(ALICE);
  assert.equal(await enforceDailyLimitForCreation(ALICE, 'planned', PLANNED, UNVERIFIABLE), undefined, 'aucune limite');
  await dailyLimit(5, false);
  assert.equal(await enforceDailyLimitForCreation(ALICE, 'planned', PLANNED, UNVERIFIABLE), undefined, 'limite désactivée');
});

test('le dépassement par un volume connu reste refusé pour une irrigation planifiée et seulement signalé pour une irrigation réelle, qui reste enregistrable même au volume inconnu', async () => {
  await dailyLimit(0.5);
  await assert.rejects(
    enforceDailyLimitForCreation(ALICE, 'planned', PLANNED, KNOWN),
    (error: unknown) => error instanceof IrrigationDailyLimitExceededError && /^Limite journalière dépassée le 5 oct\. 2026 : /.test(error.message),
  );
  assert.match(
    await enforceDailyLimitForCreation(ALICE, 'completed', COMPLETED, KNOWN) ?? '',
    /^Limite journalière dépassée le 5 oct\. 2026 : .* L’enregistrement réel a été conservé\.$/,
  );
  assert.equal(await enforceDailyLimitForCreation(ALICE, 'completed', COMPLETED, UNVERIFIABLE), undefined, 'réelle : ses millimètres sont la vérité');
});

test('l’action traduit ce refus en échec, pas en avertissement', () => {
  const error = new IrrigationDailyLimitExceededError('Irrigation refusée : une limite journalière s’applique le 5 oct. 2026.');
  assert.deepEqual(handledError(error), { ok: false, message: error.message });
});


/**
 * La garde du démarrage et de la reprise (point ouvert 24, corrigé le
 * 9 octobre 2026) : une irrigation planifiée avant toute limite, dont une
 * planche n’a pas de passe-pied connu, ne démarre pas sous une limite activée
 * entre-temps. L’horloge est arrêtée à son début prévu, le 5 octobre à 6 h.
 */
async function plannedBeforeAnyLimit(wettedAreas: (number | null)[]) {
  mock.timers.enable({ apis: ['Date'], now: new Date(START) });
  const fixture = await createDripFixture(ALICE, { beds: wettedAreas.map((_, index) => `bed-${index + 1}`) });
  const applications = fixture.applications.map((item, index) => ({ ...item, wettedAreaSquareMeters: wettedAreas[index] }));
  const { eventEquipmentId } = await createIrrigationEventForUser(
    ALICE,
    plannedDraft(fixture, { startAt: START, endAt: END, durationSeconds: 3600 }, { applications }),
  );
  return eventEquipmentId;
}

function startRefusedUnverifiable(error: unknown) {
  return error instanceof IrrigationDailyLimitExceededError
    && /^Démarrage bloqué : une limite journalière s’applique le 5 oct\. 2026 et le volume de cette aspersion ne peut pas être vérifié/.test(error.message);
}

test('planifiée avant la limite, une irrigation au volume invérifiable ne démarre pas sous une limite activée entre-temps', async () => {
  const eventEquipmentId = await plannedBeforeAnyLimit([45, null]);
  await dailyLimit(5);
  await assert.rejects(enforceDailyLimitForStart(ALICE, eventEquipmentId), startRefusedUnverifiable);
});

test('toutes ses planches inconnues, elle ne démarre pas non plus : le volume connu, nul, ne décide pas', async () => {
  const eventEquipmentId = await plannedBeforeAnyLimit([null, null]);
  await dailyLimit(5);
  await assert.rejects(enforceDailyLimitForStart(ALICE, eventEquipmentId), startRefusedUnverifiable);
});

test('sans limite active, le démarrage au volume invérifiable est accepté', async () => {
  const eventEquipmentId = await plannedBeforeAnyLimit([45, null]);
  await assert.doesNotReject(enforceDailyLimitForStart(ALICE, eventEquipmentId), 'aucune limite');
  await dailyLimit(5, false);
  await assert.doesNotReject(enforceDailyLimitForStart(ALICE, eventEquipmentId), 'limite désactivée');
});

test('au volume connu, le démarrage reste jugé sur son volume : 0,75 m³ passent sous 5 m³', async () => {
  const eventEquipmentId = await plannedBeforeAnyLimit([45, 30]);
  await dailyLimit(5);
  await assert.doesNotReject(enforceDailyLimitForStart(ALICE, eventEquipmentId));
});

test('au volume connu, le démarrage reste bloqué au-dessus de la limite, comme avant', async () => {
  const eventEquipmentId = await plannedBeforeAnyLimit([45, 30]);
  await dailyLimit(0.5);
  await assert.rejects(
    enforceDailyLimitForStart(ALICE, eventEquipmentId),
    (error: unknown) => error instanceof IrrigationDailyLimitExceededError
      && /^Démarrage bloqué : limite journalière dépassée le 5 oct\. 2026\./.test(error.message),
  );
});
/**
 * La modification d’une irrigation planifiée et non démarrée (point ouvert 13,
 * corrigé le 9 octobre 2026) : jugée comme une création, son propre volume
 * planifié retiré du déjà engagé de ses jours. L’aspersion connue de 0,75 m³
 * est planifiée le 5 octobre de 6 h à 7 h, avant toute limite.
 */
function exceededWithPlanned(plannedCubicMeters: string) {
  return (error: unknown) => error instanceof IrrigationDailyLimitExceededError
    && error.message.startsWith('Limite journalière dépassée le 5 oct. 2026 : ')
    && error.message.includes(`, ${plannedCubicMeters} m³ planifiés, `);
}

test('modifiée sans changer de volume sous une limite de 1 m³, elle est acceptée : ses 0,75 m³ ne comptent pas deux fois', async () => {
  const eventEquipmentId = await plannedBeforeAnyLimit([45, 30]);
  await dailyLimit(1);
  assert.equal(await enforceDailyLimitForCreation(ALICE, 'planned', PLANNED, KNOWN, eventEquipmentId), undefined);
});

test('la même aspersion créée en plus, sans exclusion, reste refusée : la planifiée compte', async () => {
  await plannedBeforeAnyLimit([45, 30]);
  await dailyLimit(1);
  await assert.rejects(enforceDailyLimitForCreation(ALICE, 'planned', PLANNED, KNOWN), exceededWithPlanned('0,75'));
});

test('modifiée vers deux heures, 1,5 m³, elle est refusée sur son seul volume nouveau, l’ancien retiré', async () => {
  const eventEquipmentId = await plannedBeforeAnyLimit([45, 30]);
  await dailyLimit(1);
  const twoHours: IrrigationTiming = { ...PLANNED, plannedEndAt: '2026-10-05T06:00:00.000Z', plannedDurationSeconds: 7200 };
  await assert.rejects(enforceDailyLimitForCreation(ALICE, 'planned', twoHours, KNOWN, eventEquipmentId), exceededWithPlanned('0'));
});
