import assert from 'node:assert/strict';
import test from 'node:test';
import { cropPlanForSeason } from '../lib/domain/crop-plan.ts';
import { buildMockCropPlan } from '../lib/adapters/mock-crop-plan.ts';
import { mockSnapshot } from '../lib/adapters/mock-data.ts';
import { weekKeyFromDateKey } from '../lib/domain/week-keys.ts';

test('le plan de culture d’une saison ne garde que ses séries, leurs emplacements sur des planches connues et leurs tâches', () => {
  const plan = buildMockCropPlan(new Date('2026-09-29T10:00:00.000Z'));
  const season = cropPlanForSeason(plan, 2026, new Set(['bed-n01', 'bed-t01']));
  assert.deepEqual(season.series.map(({ id }) => id), ['serie-carottes', 'serie-mache', 'serie-tomates', 'serie-carottes-verger', 'serie-radis', 'serie-endives']);
  assert.deepEqual(season.places.map(({ id }) => id), ['place-carottes-n01', 'place-mache-n01', 'place-tomates-t01'], 'N02 et V01 absentes de la saison, oignons de 2027');
  assert.ok(season.implantationTasks.every((task) => task.seriesId !== 'serie-oignons-2027'));
  assert.equal(season.readSummary, plan.readSummary, 'les compteurs restent ceux de la lecture');
  assert.deepEqual(cropPlanForSeason(plan, 2027, new Set(['bed-n01'])).series.map(({ id }) => id), ['serie-oignons-2027']);
});

test('les données de démonstration portent les cas que les parcours navigateur attendent', () => {
  const now = new Date('2026-09-29T10:00:00.000Z');
  const plan = buildMockCropPlan(now);
  const bedIds = new Set(mockSnapshot.beds.map(({ id }) => id));
  assert.ok(plan.places.every((place) => bedIds.has(place.bedId)), 'chaque emplacement est sur une planche de démonstration');
  const seriesIds = new Set(plan.series.map(({ id }) => id));
  assert.ok(plan.places.every((place) => seriesIds.has(place.seriesId)));
  assert.ok(plan.implantationTasks.every((task) => seriesIds.has(task.seriesId)));

  const onN01 = plan.places.filter((place) => place.bedId === 'bed-n01' && plan.series.find((s) => s.id === place.seriesId)?.season === 2026);
  assert.equal(onN01.length, 2, 'une succession sur N01');

  const withoutImplantation = plan.series.filter((item) => !plan.implantationTasks.some((task) => task.seriesId === item.id));
  assert.deepEqual(withoutImplantation.map(({ id }) => id), ['serie-radis'], 'une série sans implantation');
  assert.deepEqual(plan.series.filter((item) => item.use === 'block').map(({ id }) => id), ['serie-endives'], 'une série en bloc');

  const mache = plan.implantationTasks.find((task) => task.seriesId === 'serie-mache');
  assert.equal(mache?.status, 'todo');
  assert.equal(mache?.plannedWeek, weekKeyFromDateKey('2026-10-20'), 'plantation à venir, trois semaines après aujourd’hui');

  const verger = plan.implantationTasks.find((task) => task.seriesId === 'serie-carottes-verger');
  assert.equal(verger?.doneWeek, weekKeyFromDateKey('2026-09-08'), 'des carottes semées trois semaines plus tôt, en place le jour du parcours');
  assert.deepEqual(plan.series.find((item) => item.id === 'serie-carottes-verger')?.cultivations[0].harvestWeeksExpected, [weekKeyFromDateKey('2026-11-24')]);
  assert.equal(mockSnapshot.cropPlan?.series.length, 7, 'l’instantané de démonstration porte le plan');
});
