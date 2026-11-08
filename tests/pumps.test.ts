import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateHydraulicFeasibility,
  findPumpCapacityConflicts,
  normalizePumpDraft,
  requestedFlowCubicMetersPerHour,
  resolvePumpOriginAvailability,
  type IrrigationPump,
  type PumpUsage,
} from '../lib/domain/pumps.ts';
import type { WaterInfrastructure } from '../lib/domain/water-resources.ts';

const pump = (id = 'pump-a', capacity = 8): IrrigationPump => ({
  id, name: id === 'pump-a' ? 'Pompe principale' : 'Pompe secondaire',
  maximumFlowCubicMetersPerHour: capacity, status: 'active', archivedAt: null,
  notes: null, origins: [],
});
const candidate = (flow = 5, start = '2026-09-08T10:00:00Z', end = '2026-09-08T12:00:00Z') => ({
  eventEquipmentId: 'candidate', label: 'Candidate', startsAt: start, endsAt: end,
  requestedFlowCubicMetersPerHour: flow,
});
const usage = (id: string, flow: number, start = '2026-09-08T11:00:00Z', end = '2026-09-08T13:00:00Z', pumpId = 'pump-a'): PumpUsage => ({
  eventEquipmentId: id, label: id, pumpId, startsAt: start, endsAt: end,
  requestedFlowCubicMetersPerHour: flow,
});
const check = (flow: number, usages: PumpUsage[] = [], selectedPump = pump()) =>
  evaluateHydraulicFeasibility({ pump: selectedPump, candidate: candidate(flow), usages });

test('une pompe accepte 5/8 et 8/8, mais refuse 9/8 avec une explication', () => {
  assert.equal(check(5).possible, true);
  assert.equal(check(8).possible, true);
  const refused = check(9);
  assert.equal(refused.possible, false);
  assert.equal(refused.excessFlowCubicMetersPerHour, 1);
  assert.ok(refused.reasons.includes('unit_flow_exceeded'));
});

test('les débits décimaux proviennent du moteur existant mm × m², sur la surface mouillée', () => {
  assert.equal(requestedFlowCubicMetersPerHour([
    { rateMmPerHour: 14, wettedAreaSquareMeters: 75 },
    { rateMmPerHour: 8.5, wettedAreaSquareMeters: 50 },
  ]), 1.475);
  assert.equal(check(7.999).possible, true);
});

test('une planche sans surface mouillée connue rend le débit demandé inconnu, pas plus léger', () => {
  // Un débit partiel ferait passer une aspersion sans passe-pied renseigné pour
  // une petite irrigation (docs/wetted-surface-contract.md).
  assert.equal(requestedFlowCubicMetersPerHour([
    { rateMmPerHour: 14, wettedAreaSquareMeters: 75 },
    { rateMmPerHour: 8.5, wettedAreaSquareMeters: null },
  ]), null);
  assert.equal(requestedFlowCubicMetersPerHour([]), 0);
});

test('5 + 3 sur 8 passe et 5 + 4 est refusé', () => {
  assert.equal(check(5, [usage('Irrigation B', 3)]).totalFlowCubicMetersPerHour, 8);
  const refused = check(5, [usage('Irrigation B', 4)]);
  assert.equal(refused.possible, false);
  assert.equal(refused.excessFlowCubicMetersPerHour, 1);
  assert.deepEqual(refused.conflictingIrrigations.map((item) => item.label), ['Irrigation B']);
});

test('trois irrigations sont additionnées uniquement sur leur intervalle commun', () => {
  const result = check(3, [
    usage('B', 2, '2026-09-08T10:15:00Z', '2026-09-08T11:30:00Z'),
    usage('C', 4, '2026-09-08T11:00:00Z', '2026-09-08T11:15:00Z'),
  ]);
  assert.equal(result.totalFlowCubicMetersPerHour, 9);
  assert.equal(result.possible, false);
  assert.equal(result.conflictingIrrigations.length, 2);
});

test('les irrigations sans chevauchement et les chevauchements de bord ne consomment rien ensemble', () => {
  assert.equal(check(8, [usage('avant', 8, '2026-09-08T08:00:00Z', '2026-09-08T10:00:00Z')]).possible, true);
  assert.equal(check(8, [usage('après', 8, '2026-09-08T12:00:00Z', '2026-09-08T13:00:00Z')]).possible, true);
});

test('un chevauchement partiel suffit à appliquer la contrainte', () => {
  assert.equal(check(5, [usage('partiel', 4, '2026-09-08T11:59:00Z', '2026-09-08T14:00:00Z')]).possible, false);
});

test('deux pompes distinctes fonctionnent simultanément à pleine capacité', () => {
  const resultA = check(8, [usage('pompe-b', 5, undefined, undefined, 'pump-b')], pump('pump-a', 8));
  const resultB = evaluateHydraulicFeasibility({ pump: pump('pump-b', 5), candidate: candidate(5), usages: [usage('pompe-a', 8, undefined, undefined, 'pump-a')] });
  assert.equal(resultA.possible, true);
  assert.equal(resultB.possible, true);
});

test('une irrigation sans pompe reste possible mais non vérifiée', () => {
  const result = evaluateHydraulicFeasibility({ pump: null, candidate: candidate(20), usages: [] });
  assert.equal(result.possible, true);
  assert.equal(result.hydraulicallyVerified, false);
  assert.ok(result.reasons.includes('pump_missing'));
});

test('une pompe peut avoir plusieurs origines avec une seule origine par défaut', () => {
  const draft = normalizePumpDraft({ name: ' Pompe A ', maximumFlowCubicMetersPerHour: 8, status: 'active', notes: null, origins: [
    { sourceKind: 'reservoir', resourceId: null, reservoirId: 'r1', isDefault: true },
    { sourceKind: 'reservoir', resourceId: null, reservoirId: 'r2', isDefault: false },
  ] });
  assert.equal(draft.origins.length, 2);
  assert.equal(draft.origins.find((item) => item.isDefault)?.reservoirId, 'r1');
  const override = draft.origins.find((item) => item.reservoirId === 'r2');
  assert.equal(override?.isDefault, false);
  assert.equal(draft.origins.find((item) => item.isDefault)?.reservoirId, 'r1');
});

test('une pompe sans origine contrôle son débit sans bloquer pour la seule absence d’origine', () => {
  const result = check(6);
  assert.equal(result.possible, true);
  assert.equal(result.originAvailability.status, 'unknown');
  assert.ok(result.reasons.includes('origin_missing'));
});

test('une réserve active de 60 m³ alimente la pompe 8 m³/h', () => {
  const infrastructure = waterInfrastructure(60);
  const origin = { id: 'o', pumpId: 'pump-a', sourceKind: 'reservoir' as const, resourceId: null, reservoirId: 'reserve', isDefault: true };
  const availability = resolvePumpOriginAvailability({ infrastructure, origin, startsAt: '2026-09-08T10:00:00Z', requiredVolumeCubicMeters: 6 });
  assert.equal(availability.status, 'available');
  assert.equal(check(6).possible, true);
  assert.equal(check(4, [usage('autre', 4)]).possible, true);
  assert.equal(check(5, [usage('autre', 4)]).possible, false);
  assert.equal(check(5, []).possible, true, 'un arrêt ou une pause libère la capacité en retirant l’usage actif');
});

test('un volume de réserve inconnu conserve un débit pompe vérifiable', () => {
  const infrastructure = waterInfrastructure(null);
  const origin = { id: 'o', pumpId: 'pump-a', sourceKind: 'reservoir' as const, resourceId: null, reservoirId: 'reserve', isDefault: true };
  const availability = resolvePumpOriginAvailability({ infrastructure, origin, startsAt: '2026-09-08T10:00:00Z', requiredVolumeCubicMeters: 6 });
  const result = evaluateHydraulicFeasibility({ pump: { ...pump(), origins: [origin] }, candidate: candidate(6), usages: [], originAvailability: availability });
  assert.equal(result.possible, true);
  assert.equal(result.originAvailability.status, 'unknown');
  assert.equal(result.hydraulicallyVerified, true);
});

test('une ressource directe inactive rend seulement cette origine indisponible', () => {
  const infrastructure = waterInfrastructure(60);
  infrastructure.resources[0].status = 'inactive';
  const origin = { id: 'direct', pumpId: 'pump-a', sourceKind: 'resource' as const, resourceId: 'source', reservoirId: null, isDefault: true };
  const availability = resolvePumpOriginAvailability({ infrastructure, origin, startsAt: '2026-09-08T10:00:00Z', requiredVolumeCubicMeters: 1 });
  assert.equal(availability.status, 'unavailable');
});

test('les snapshots historiques ne changent pas lorsque la pompe est modifiée', () => {
  const snapshot = { id: 'pump-a', name: 'Pompe principale', maximumFlowCubicMetersPerHour: 8 };
  const modified = { ...pump(), name: 'Pompe renommée', maximumFlowCubicMetersPerHour: 6 };
  assert.deepEqual(snapshot, { id: 'pump-a', name: 'Pompe principale', maximumFlowCubicMetersPerHour: 8 });
  assert.equal(modified.maximumFlowCubicMetersPerHour, 6);
});

test('réduire la capacité signale les planifications existantes sans les supprimer', () => {
  const usages = [
    usage('A', 4, '2026-09-08T10:00:00Z', '2026-09-08T12:00:00Z'),
    usage('B', 3, '2026-09-08T11:00:00Z', '2026-09-08T13:00:00Z'),
  ];
  assert.deepEqual(findPumpCapacityConflicts(pump('pump-a', 8), usages).conflictingEventEquipmentIds, []);
  const reduced = findPumpCapacityConflicts(pump('pump-a', 6), usages);
  assert.equal(reduced.maximumFlowCubicMetersPerHour, 7);
  assert.deepEqual(new Set(reduced.conflictingEventEquipmentIds), new Set(['A', 'B']));
  assert.equal(usages.length, 2, 'les planifications ne sont pas réécrites');
});

test('la limite quotidienne de la ressource directe reste distincte de la capacité pompe', () => {
  const infrastructure = waterInfrastructure(60);
  infrastructure.resourceLimits.push({ id: 'limit', resourceId: 'source', enabled: true, maxCubicMetersPerDay: 5, validFrom: '2026-01-01', validUntil: null, referenceNote: null, createdAt: '2026-01-01T00:00:00Z' });
  infrastructure.movements.push({ id: 'withdrawal', reservoirId: null, resourceId: 'source', kind: 'direct_irrigation_withdrawal', volumeDeltaCubicMeters: -4, occurredAt: '2026-09-08T08:00:00Z', previousVolumeCubicMeters: null, resultingVolumeCubicMeters: null, reason: null });
  const origin = { id: 'direct', pumpId: 'pump-a', sourceKind: 'resource' as const, resourceId: 'source', reservoirId: null, isDefault: true };
  const availability = resolvePumpOriginAvailability({ infrastructure, origin, startsAt: '2026-09-08T10:00:00Z', requiredVolumeCubicMeters: 2 });
  assert.equal(availability.status, 'unavailable');
  assert.match(availability.message, /1 m³ encore disponibles/);
});

test('la limite quotidienne et la disponibilité d’une ressource se jugent au jour de la ferme, pas en UTC', () => {
  // Point ouvert 14 (D-004) : un créneau de 0 h 30 heure de Paris est le 9 septembre, pas le 8.
  const origin = { id: 'direct', pumpId: 'pump-a', sourceKind: 'resource' as const, resourceId: 'source', reservoirId: null, isDefault: true };
  const limit = { id: 'limit', resourceId: 'source', enabled: true, maxCubicMetersPerDay: 5, validFrom: '2026-01-01', validUntil: null, referenceNote: null, createdAt: '2026-01-01T00:00:00Z' };
  const withdrawal = (occurredAt: string) => ({
    id: `w-${occurredAt}`, reservoirId: null, resourceId: 'source', kind: 'direct_irrigation_withdrawal' as const,
    volumeDeltaCubicMeters: -4, occurredAt, previousVolumeCubicMeters: null, resultingVolumeCubicMeters: null, reason: null,
  });
  const status = (infrastructure: WaterInfrastructure, startsAt: string) =>
    resolvePumpOriginAvailability({ infrastructure, origin, startsAt, requiredVolumeCubicMeters: 2 }).status;

  // Créneau du 9 septembre à 0 h 30 heure de Paris, 22 h 30 UTC la veille : les 4 m³ tirés le 9 au matin comptent.
  const slotAfterMidnight = waterInfrastructure(60);
  slotAfterMidnight.resourceLimits.push(limit);
  slotAfterMidnight.movements.push(withdrawal('2026-09-09T05:00:00Z'));
  assert.equal(status(slotAfterMidnight, '2026-09-08T22:30:00Z'), 'unavailable', 'le créneau est du 9 à la ferme');

  // Prélèvement du 9 septembre à 0 h 00 heure de Paris, 22 h UTC la veille : il compte pour le 9.
  const withdrawalAtMidnight = waterInfrastructure(60);
  withdrawalAtMidnight.resourceLimits.push(limit);
  withdrawalAtMidnight.movements.push(withdrawal('2026-09-08T22:00:00Z'));
  assert.equal(status(withdrawalAtMidnight, '2026-09-09T10:00:00Z'), 'unavailable', 'le prélèvement est du 9 à la ferme');

  // Ressource disponible à partir du 9 : le créneau du 9 à 0 h 30 heure de Paris est dans sa période.
  const availableFromThe9th = waterInfrastructure(60);
  availableFromThe9th.resources[0].availableFrom = '2026-09-09';
  assert.equal(status(availableFromThe9th, '2026-09-08T22:30:00Z'), 'available', 'la période se lit au jour de la ferme');
});

test('la limite de prélèvement compte aussi ce que la ressource verse dans une réserve (D-035)', () => {
  // Point ouvert 38 : un forage limité à 5 m³ qui a rempli la réserve de 4 m³ le matin n'en laisse que 1 à une irrigation directe, comme dans le planning.
  const infrastructure = waterInfrastructure(60);
  infrastructure.resourceLimits.push({ id: 'limit', resourceId: 'source', enabled: true, maxCubicMetersPerDay: 5, validFrom: '2026-01-01', validUntil: null, referenceNote: null, createdAt: '2026-01-01T00:00:00Z' });
  infrastructure.movements.push({ id: 'fill', reservoirId: 'reserve', resourceId: 'source', kind: 'resource_input', volumeDeltaCubicMeters: 4, occurredAt: '2026-09-08T08:00:00Z', previousVolumeCubicMeters: 50, resultingVolumeCubicMeters: 54, reason: null });
  const origin = { id: 'direct', pumpId: 'pump-a', sourceKind: 'resource' as const, resourceId: 'source', reservoirId: null, isDefault: true };
  const availability = resolvePumpOriginAvailability({ infrastructure, origin, startsAt: '2026-09-08T10:00:00Z', requiredVolumeCubicMeters: 2 });
  assert.equal(availability.status, 'unavailable', 'l’apport à la réserve compte dans la limite du jour');
  assert.match(availability.message, /1 m³ encore disponibles/);
});

function waterInfrastructure(volume: number | null): WaterInfrastructure {
  return {
    resources: [{ id: 'source', name: 'Forage principal', type: 'borehole', nominalFlowCubicMetersPerHour: 1.125, status: 'active', availableFrom: null, availableUntil: null, notes: null }],
    reservoirs: [{ id: 'reserve', name: 'Réserve tampon', type: 'buffer', capacityCubicMeters: 60, currentVolumeCubicMeters: volume, currentVolumeObservedAt: volume === null ? null : '2026-09-08T08:00:00Z', minimumSafetyCubicMeters: 0, exposedSurfaceSquareMeters: 0, receivesRain: false, evaporationEnabled: false, evaporationCoefficient: 1, status: 'active', notes: null }],
    resourceLimits: [], resourceReservoirLinks: [], reservoirLinks: [], defaultSupply: null, movements: [],
  };
}
