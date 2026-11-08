import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  applyReservoirMovement,
  estimatedEvaporationCubicMeters,
  hasReservoirCycle,
  mobilizableVolume,
  normalizeWaterReservoirDraft,
  normalizeWaterResourceDraft,
  normalizeWaterResourceLimit,
  projectWaterAvailability,
  rainInputCubicMeters,
  splitIntervalByLocalDay,
  type WaterInfrastructure,
  type WaterReservoir,
  type WaterResource,
} from '../lib/domain/water-resources.ts';

const resource: WaterResource = {
  id: 'forage', name: 'Forage principal', type: 'borehole',
  nominalFlowCubicMetersPerHour: 1.125, status: 'active',
  availableFrom: null, availableUntil: null, notes: null,
};
const reservoir: WaterReservoir = {
  id: 'reserve', name: 'Réserve tampon', type: 'buffer', capacityCubicMeters: 60,
  currentVolumeCubicMeters: 20, currentVolumeObservedAt: '2026-09-07T00:00:00.000Z',
  minimumSafetyCubicMeters: 5, exposedSurfaceSquareMeters: 40,
  receivesRain: true, evaporationEnabled: true, evaporationCoefficient: 1,
  status: 'active', notes: null,
};

test('3.4 réservations et remplissage ne dupliquent pas l’eau : source24, plan10, réserve14', () => {
  const result = projection({ infrastructure: infrastructure({ resources: [{ ...resource, nominalFlowCubicMetersPerHour: 1 }], reservoirs: [{ ...reservoir, currentVolumeCubicMeters: 0, minimumSafetyCubicMeters: 0 }] }), plannedWater: [{ date: '2026-09-07', cubicMeters: 10, sourceKey: 'reservoir:reserve' }] });
  assert.equal(result.reservoirs[0].theoreticalEndVolumeCubicMeters, 24);
  assert.equal(result.reservoirs[0].afterPlanningEndVolumeCubicMeters, 14);
  assert.equal(result.pools.reduce((sum, p) => sum + (p.forecastCubicMeters ?? 0), 0), 14);
  assert.equal(result.reservedUnassignedCubicMeters, 0);
});

test('3.4 un plan direct ne réduit pas la projection théorique sans plan', () => {
  const result = projection({ infrastructure: infrastructure({ resources: [{ ...resource, nominalFlowCubicMetersPerHour: 1 }], reservoirs: [{ ...reservoir, currentVolumeCubicMeters: 0, minimumSafetyCubicMeters: 0 }] }), plannedWater: [{ date: '2026-09-07', cubicMeters: 10, sourceKey: 'resource:forage' }] });
  assert.equal(result.reservoirs[0].theoreticalEndVolumeCubicMeters, 24); assert.equal(result.reservoirs[0].afterPlanningEndVolumeCubicMeters, 14);
});

test('3.4 un plan non couvert le premier jour reste réservé le lendemain', () => {
  for (const sourceKey of ['resource:forage', 'reservoir:reserve']) {
    const result = projection({ endsAt: new Date('2026-09-08T22:00:00Z'), infrastructure: infrastructure({ resources: [{ ...resource, nominalFlowCubicMetersPerHour: 1, availableFrom: '2026-09-08' }], reservoirs: [{ ...reservoir, currentVolumeCubicMeters: 0, minimumSafetyCubicMeters: 0, evaporationEnabled: false }] }), plannedWater: [{ date: '2026-09-07', cubicMeters: 10, sourceKey }] });
    assert.equal(result.pools.reduce((sum, p) => sum + (p.forecastCubicMeters ?? 0), 0) - result.reservedUnassignedCubicMeters, 14);
  }
});

test('3.4 origine explicite indépendante du défaut, origine inconnue réservée une fois', () => {
  const explicit = projection({ plannedWater: [{ date: '2026-09-07', cubicMeters: 10, sourceKey: 'reservoir:reserve' }] });
  assert.equal(explicit.unassignedPlannedCubicMeters, 0); assert.equal(explicit.reservedUnassignedCubicMeters, 0);
  const unknown = projection({ infrastructure: infrastructure({ defaultSupply: { sourceKind: 'reservoir', reservoirId: 'reserve', resourceId: null } }), plannedWater: [{ date: '2026-09-07', cubicMeters: 10, sourceKey: null }] });
  assert.equal(unknown.unassignedPlannedCubicMeters, 10); assert.equal(unknown.reservedUnassignedCubicMeters, 10);
});

test('3.4 remplissage automatique inconnu ne devient pas un reliquat source confirmé', () => {
  for (const patch of [{ currentVolumeCubicMeters: null }, { evaporationEnabled: true }]) {
    const result = projection({ weather: [], infrastructure: infrastructure({ reservoirs: [{ ...reservoir, evaporationEnabled: false, ...patch }] }), plannedWater: [{ date: '2026-09-07', cubicMeters: 10, sourceKey: 'reservoir:reserve' }] });
    assert.equal(result.pools.find(p => p.key === 'resource:forage')!.forecastCubicMeters, null);
    assert.equal(result.pools.find(p => p.key === 'reservoir:reserve')!.forecastCubicMeters, null);
  }
});

test('3.4 minimum et plusieurs ressources : réserve20-5, source24+48 donnent87 sans doublon', () => {
  const result = projection({ infrastructure: infrastructure({ resources: [{ ...resource, nominalFlowCubicMetersPerHour: 1 }, { ...resource, id: 'second', nominalFlowCubicMetersPerHour: 2 }], reservoirs: [{ ...reservoir, evaporationEnabled: false }] }) });
  assert.equal(result.pools.reduce((sum, p) => sum + (p.currentCubicMeters ?? 0), 0), 15);
  assert.equal(result.pools.reduce((sum, p) => sum + (p.forecastCubicMeters ?? 0), 0), 87);
});

test('3.4 déficit planifié sans apport reste protégé sur le reste des ressources', () => {
  const result = projection({ infrastructure: infrastructure({ resourceReservoirLinks: [], reservoirs: [{ ...reservoir, currentVolumeCubicMeters: 0, evaporationEnabled: false }] }), plannedWater: [{ date: '2026-09-07', cubicMeters: 10, sourceKey: 'reservoir:reserve' }] });
  assert.equal(result.reservedUnassignedCubicMeters, 10);
});

function infrastructure(overrides: Partial<WaterInfrastructure> = {}): WaterInfrastructure {
  return {
    resources: [resource], reservoirs: [reservoir], resourceLimits: [],
    resourceReservoirLinks: [{ id: 'link', resourceId: 'forage', reservoirId: 'reserve', fillMode: 'automatic', active: true }],
    reservoirLinks: [], defaultSupply: null, movements: [], ...overrides,
  };
}

function projection(input: Partial<Parameters<typeof projectWaterAvailability>[0]> = {}) {
  return projectWaterAvailability({
    infrastructure: infrastructure(),
    startsAt: new Date('2026-09-06T22:00:00.000Z'),
    endsAt: new Date('2026-09-07T22:00:00.000Z'),
    timeZone: 'Europe/Paris', weather: [{ date: '2026-09-07', forecastRainMm: 0, et0Mm: 0 }],
    plannedWater: [], ...input,
  });
}

test('une ressource forage conserve un débit fixe de 1,125 m³/h', () => {
  assert.equal(normalizeWaterResourceDraft({ ...resource }).nominalFlowCubicMetersPerHour, 1.125);
});

test('une nouvelle réserve propose un volume inconnu sans le transformer en zéro', () => {
  const source = readFileSync('app/irrigation/water-resource-manager.tsx', 'utf8');
  assert.match(source, /reservoir \? reservoir\.currentVolumeCubicMeters === null : true/);
});

test('les valeurs physiques négatives sont refusées', () => {
  assert.throws(() => normalizeWaterResourceDraft({ ...resource, nominalFlowCubicMetersPerHour: -1 }), /débit/);
  assert.throws(() => normalizeWaterReservoirDraft({ ...reservoir, capacityCubicMeters: -1 }), /capacité/);
  assert.throws(() => normalizeWaterReservoirDraft({ ...reservoir, exposedSurfaceSquareMeters: -1 }), /surface/);
  assert.throws(() => normalizeWaterReservoirDraft({ ...reservoir, evaporationCoefficient: -1 }), /coefficient/);
});

test('une période de disponibilité incohérente est refusée', () => {
  assert.throws(() => normalizeWaterResourceDraft({ ...resource, availableFrom: '2026-09-08', availableUntil: '2026-09-07' }), /période/);
});

test('une réserve de 60 m³ accepte un volume connu', () => {
  const value = normalizeWaterReservoirDraft({ ...reservoir, capacityCubicMeters: 60, currentVolumeCubicMeters: 42 });
  assert.equal(value.currentVolumeCubicMeters, 42);
});

test('un volume initial inconnu reste null et ne devient jamais zéro', () => {
  const value = normalizeWaterReservoirDraft({ ...reservoir, currentVolumeCubicMeters: null });
  assert.equal(value.currentVolumeCubicMeters, null);
  assert.equal(mobilizableVolume(null, 5), null);
});

test('le minimum de sécurité ne peut pas dépasser la capacité', () => {
  assert.throws(() => normalizeWaterReservoirDraft({ ...reservoir, minimumSafetyCubicMeters: 61 }), /minimum/);
});

test('le volume mobilisable respecte le minimum de sécurité', () => {
  assert.equal(mobilizableVolume(42, 5), 37);
  assert.equal(mobilizableVolume(3, 5), 0);
});

test('10 mm de pluie sur 40 m² ajoutent 0,4 m³', () => {
  assert.equal(rainInputCubicMeters(10, 40), 0.4);
});

test('5 mm d’ET0 sur 40 m² avec un coefficient 1 retirent 0,2 m³', () => {
  assert.equal(estimatedEvaporationCubicMeters(5, 40, 1), 0.2);
  assert.equal(estimatedEvaporationCubicMeters(5, 40, 0), 0);
});

test('un apport réel ne dépasse jamais la capacité et expose le débordement', () => {
  assert.deepEqual(applyReservoirMovement({ currentVolumeCubicMeters: 59, capacityCubicMeters: 60, volumeDeltaCubicMeters: 3 }), {
    resultingVolumeCubicMeters: 60, overflowCubicMeters: 2, unavailableCubicMeters: 0,
  });
});

test('un mouvement ne fabrique pas un stock lorsque le volume est inconnu', () => {
  assert.equal(applyReservoirMovement({ currentVolumeCubicMeters: null, capacityCubicMeters: 60, volumeDeltaCubicMeters: 3 }).resultingVolumeCubicMeters, null);
});

test('une correction manuelle peut franchir le minimum sans falsifier le volume', () => {
  assert.equal(applyReservoirMovement({ currentVolumeCubicMeters: 10, capacityCubicMeters: 60, volumeDeltaCubicMeters: -7 }).resultingVolumeCubicMeters, 3);
});

test('les cycles de réserves sont détectés', () => {
  assert.equal(hasReservoirCycle([
    { upstreamReservoirId: 'a', downstreamReservoirId: 'b', active: true },
    { upstreamReservoirId: 'b', downstreamReservoirId: 'a', active: true },
  ]), true);
  assert.equal(hasReservoirCycle([
    { upstreamReservoirId: 'a', downstreamReservoirId: 'b', active: true },
    { upstreamReservoirId: 'b', downstreamReservoirId: 'c', active: true },
  ]), false);
});

test('le cas réel produit 27 m³ potentiels en 24 h avec le forage à 1,125 m³/h', () => {
  const result = projection().reservoirs[0];
  assert.equal(result.automaticPotentialCubicMeters, 27);
  assert.equal(result.theoreticalEndVolumeCubicMeters, 47);
});

test('le remplissage s’arrête logiquement lorsque la réserve est pleine', () => {
  const full = { ...reservoir, currentVolumeCubicMeters: 60 };
  const result = projection({ infrastructure: infrastructure({ reservoirs: [full] }) }).reservoirs[0];
  assert.equal(result.theoreticalEndVolumeCubicMeters, 60);
  assert.equal(result.automaticAcceptedCubicMeters, 0);
  assert.equal(result.capacityLimitedCubicMeters, 27);
});

test('le remplissage continu reprend lorsqu’une irrigation crée de la place', () => {
  const result = projection({
    infrastructure: infrastructure({ defaultSupply: { sourceKind: 'reservoir', resourceId: null, reservoirId: 'reserve' } }),
    plannedWater: [{ date: '2026-09-07', cubicMeters: 20 }],
  }).reservoirs[0];
  assert.equal(result.afterPlanningEndVolumeCubicMeters, 27);
  assert.equal(result.plannedConsumptionCubicMeters, 20);
});

test('la pluie prévue alimente seulement une réserve configurée pour la recevoir', () => {
  const rain = projection({ weather: [{ date: '2026-09-07', forecastRainMm: 10, et0Mm: 0 }] }).reservoirs[0];
  assert.equal(rain.forecastRainCubicMeters, 0.4);
  const dry = { ...reservoir, receivesRain: false };
  assert.equal(projection({ infrastructure: infrastructure({ reservoirs: [dry] }), weather: [{ date: '2026-09-07', forecastRainMm: 10, et0Mm: 0 }] }).reservoirs[0].forecastRainCubicMeters, 0);
});

test('la pluie respecte la capacité maximale', () => {
  const almostFull = { ...reservoir, currentVolumeCubicMeters: 59.9 };
  const result = projection({ infrastructure: infrastructure({ resources: [], reservoirs: [almostFull], resourceReservoirLinks: [] }), weather: [{ date: '2026-09-07', forecastRainMm: 10, et0Mm: 0 }] }).reservoirs[0];
  assert.equal(result.theoreticalEndVolumeCubicMeters, 60);
});

test('l’évaporation est une estimation paramétrable', () => {
  const result = projection({ weather: [{ date: '2026-09-07', forecastRainMm: 0, et0Mm: 5 }] }).reservoirs[0];
  assert.equal(result.estimatedEvaporationCubicMeters, 0.2);
  assert.equal(result.theoreticalEndVolumeCubicMeters, 46.8);
});

test('une ET0 manquante reste explicitement inconnue', () => {
  const result = projection({ weather: [{ date: '2026-09-07', forecastRainMm: 0, et0Mm: null }] }).reservoirs[0];
  assert.deepEqual(result.missingEt0Dates, ['2026-09-07']);
});

test('une ressource inactive ne produit aucun apport', () => {
  const result = projection({ infrastructure: infrastructure({ resources: [{ ...resource, status: 'inactive' }] }) }).reservoirs[0];
  assert.equal(result.automaticPotentialCubicMeters, 0);
});

test('une période de disponibilité borne les apports', () => {
  const limited = { ...resource, availableFrom: '2026-09-08', availableUntil: '2026-09-08' };
  const result = projectWaterAvailability({ infrastructure: infrastructure({ resources: [limited] }), startsAt: new Date('2026-09-06T22:00:00Z'), endsAt: new Date('2026-09-08T22:00:00Z'), timeZone: 'Europe/Paris', weather: [], plannedWater: [] }).reservoirs[0];
  assert.equal(result.automaticPotentialCubicMeters, 27);
});

test('une limite de prélèvement active borne chaque jour et une limite inactive ne borne rien', () => {
  const active = { id: 'limit', resourceId: 'forage', enabled: true, maxCubicMetersPerDay: 15, validFrom: '2026-01-01', validUntil: null, referenceNote: null, createdAt: '2026-01-01T00:00:00Z' };
  assert.equal(projection({ infrastructure: infrastructure({ resourceLimits: [active] }) }).reservoirs[0].automaticPotentialCubicMeters, 15);
  assert.equal(projection({ infrastructure: infrastructure({ resourceLimits: [{ ...active, enabled: false, maxCubicMetersPerDay: null }] }) }).reservoirs[0].automaticPotentialCubicMeters, 27);
});

test('une limite de prélèvement invalide est refusée', () => {
  assert.throws(() => normalizeWaterResourceLimit({ enabled: true, maxCubicMetersPerDay: -1, validFrom: '2026-01-01', validUntil: null, referenceNote: null }), /limite/);
});

test('une projection traversant minuit répartit les limites sur deux jours', () => {
  const fast = { ...resource, nominalFlowCubicMetersPerHour: 10 };
  const limit = { id: 'limit', resourceId: 'forage', enabled: true, maxCubicMetersPerDay: 15, validFrom: '2026-01-01', validUntil: null, referenceNote: null, createdAt: '2026-01-01T00:00:00Z' };
  const result = projectWaterAvailability({ infrastructure: infrastructure({ resources: [fast], resourceLimits: [limit], reservoirs: [{ ...reservoir, capacityCubicMeters: 100 }] }), startsAt: new Date('2026-09-07T21:00:00Z'), endsAt: new Date('2026-09-08T00:00:00Z'), timeZone: 'Europe/Paris', weather: [], plannedWater: [] }).reservoirs[0];
  assert.equal(result.automaticPotentialCubicMeters, 25);
});

test('le découpage journalier respecte les journées françaises de 23 et 25 heures', () => {
  const spring = splitIntervalByLocalDay(new Date('2026-03-28T23:00:00Z'), new Date('2026-03-29T22:00:00Z'), 'Europe/Paris');
  const autumn = splitIntervalByLocalDay(new Date('2026-10-24T22:00:00Z'), new Date('2026-10-25T23:00:00Z'), 'Europe/Paris');
  assert.equal(spring[0].localDayHours, 23);
  assert.equal(autumn[0].localDayHours, 25);
});

test('les projections 48 h et 7 jours utilisent tout l’horizon', () => {
  const base = infrastructure({ reservoirs: [{ ...reservoir, capacityCubicMeters: 1_000 }] });
  const result48 = projectWaterAvailability({ infrastructure: base, startsAt: new Date('2026-09-06T22:00:00Z'), endsAt: new Date('2026-09-08T22:00:00Z'), timeZone: 'Europe/Paris', weather: [], plannedWater: [] });
  const result7d = projectWaterAvailability({ infrastructure: base, startsAt: new Date('2026-09-06T22:00:00Z'), endsAt: new Date('2026-09-13T22:00:00Z'), timeZone: 'Europe/Paris', weather: [], plannedWater: [] });
  assert.equal(result48.reservoirs[0].automaticPotentialCubicMeters, 54);
  assert.equal(result7d.reservoirs[0].automaticPotentialCubicMeters, 189);
});

test('une date personnalisée calcule la durée exacte', () => {
  const result = projectWaterAvailability({ infrastructure: infrastructure(), startsAt: new Date('2026-09-06T22:00:00Z'), endsAt: new Date('2026-09-07T10:00:00Z'), timeZone: 'Europe/Paris', weather: [], plannedWater: [] });
  assert.equal(result.reservoirs[0].automaticPotentialCubicMeters, 13.5);
});

test('plusieurs ressources vers une réserve cumulent leurs apports', () => {
  const second = { ...resource, id: 'source-b', name: 'Source B', nominalFlowCubicMetersPerHour: 2 };
  const first = { ...resource, nominalFlowCubicMetersPerHour: 1 };
  const result = projection({ infrastructure: infrastructure({ resources: [first, second], resourceReservoirLinks: [
    { id: 'a', resourceId: 'forage', reservoirId: 'reserve', fillMode: 'automatic', active: true },
    { id: 'b', resourceId: 'source-b', reservoirId: 'reserve', fillMode: 'automatic', active: true },
  ] }) }).reservoirs[0];
  assert.equal(result.automaticPotentialCubicMeters, 72);
  assert.equal(result.theoreticalEndVolumeCubicMeters, 60);
});

test('une ressource peut viser plusieurs réserves sans cardinalité 1:1 ni double comptage', () => {
  const reserve2 = { ...reservoir, id: 'reserve-2', name: 'Réserve 2' };
  const result = projection({ infrastructure: infrastructure({ reservoirs: [reservoir, reserve2], resourceReservoirLinks: [
    { id: 'a', resourceId: 'forage', reservoirId: 'reserve', fillMode: 'automatic', active: true },
    { id: 'b', resourceId: 'forage', reservoirId: 'reserve-2', fillMode: 'automatic', active: true },
  ] }) });
  assert.deepEqual(result.reservoirs.map((item) => item.automaticPotentialCubicMeters), [0, 0]);
  assert.deepEqual(result.reservoirs.map((item) => item.sharedResourceIds), [['forage'], ['forage']]);
});

test('un remplissage manuel affiche son potentiel sans le compter comme apport certain', () => {
  const result = projection({ infrastructure: infrastructure({ resourceReservoirLinks: [{ id: 'manual', resourceId: 'forage', reservoirId: 'reserve', fillMode: 'manual', active: true }] }) }).reservoirs[0];
  assert.equal(result.manualPotentialCubicMeters, 27);
  assert.equal(result.theoreticalEndVolumeCubicMeters, 20);
});

test('les irrigations planifiées sont soustraites seulement d’une alimentation par défaut connue', () => {
  const unknown = projection({ plannedWater: [{ date: '2026-09-07', cubicMeters: 10 }] });
  assert.equal(unknown.unassignedPlannedCubicMeters, 10);
  assert.equal(unknown.reservoirs[0].plannedConsumptionCubicMeters, 0);
  const assigned = projection({ infrastructure: infrastructure({ defaultSupply: { sourceKind: 'reservoir', resourceId: null, reservoirId: 'reserve' } }), plannedWater: [{ date: '2026-09-07', cubicMeters: 10 }] });
  assert.equal(assigned.unassignedPlannedCubicMeters, 0);
  assert.equal(assigned.reservoirs[0].plannedConsumptionCubicMeters, 10);
});

test('une ressource directe alimente l’irrigation sans réserve virtuelle', () => {
  const result = projection({ infrastructure: infrastructure({ reservoirs: [], resourceReservoirLinks: [], defaultSupply: { sourceKind: 'resource', resourceId: 'forage', reservoirId: null } }), plannedWater: [{ date: '2026-09-07', cubicMeters: 10 }] });
  assert.equal(result.reservoirs.length, 0);
  assert.equal(result.directSupply?.theoreticalCubicMeters, 27);
  assert.equal(result.directSupply?.afterPlanningCubicMeters, 17);
});

test('une liaison réserve vers réserve reste topologique et ne transfère aucun volume', () => {
  const reserve2 = { ...reservoir, id: 'reserve-2', name: 'Réserve 2' };
  const result = projection({ infrastructure: infrastructure({ reservoirs: [reservoir, reserve2], reservoirLinks: [{ id: 'transfer', upstreamReservoirId: 'reserve', downstreamReservoirId: 'reserve-2', transferMode: 'automatic', active: true }] }) });
  assert.deepEqual(result.reservoirs.map((item) => item.uncharacterizedTransferCount), [1, 1]);
});

test('un prélèvement réel déjà tracé réduit la limite disponible sans double comptage', () => {
  const limit = { id: 'limit', resourceId: 'forage', enabled: true, maxCubicMetersPerDay: 15, validFrom: '2026-01-01', validUntil: null, referenceNote: null, createdAt: '2026-01-01T00:00:00Z' };
  const result = projection({ infrastructure: infrastructure({ resourceLimits: [limit], movements: [{ id: 'm', reservoirId: 'reserve', resourceId: 'forage', kind: 'resource_input', volumeDeltaCubicMeters: 5, occurredAt: '2026-09-07T10:00:00Z', previousVolumeCubicMeters: 20, resultingVolumeCubicMeters: 25, reason: null }] }) }).reservoirs[0];
  assert.equal(result.automaticPotentialCubicMeters, 10);
});
