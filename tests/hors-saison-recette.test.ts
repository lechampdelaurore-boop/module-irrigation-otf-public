import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { automaticObjectiveLines, type ObjectiveBedReading } from '../lib/domain/objective-reading.ts';
import { weekGardens } from '../lib/domain/semaine/week-gardens.ts';
import { todayWeek, type TodayWeekBed } from '../lib/domain/today/week.ts';

/**
 * Les trois écarts de la recette de la ligne 34 sur la démo (27/11/2026,
 * D-356) : la ligne « automatique » d'un jardin dit sur combien de planches
 * porte sa moyenne (a) ; un jardin tout hors saison ne se dit ni « non
 * calculable » (b), ni « pas d'eau visée » ou « aucun objectif posé » (c).
 */

const automatic = { byNature: { reanalysis: 30, forecast: 0, estimated: 0 } } as unknown as ObjectiveBedReading['automaticObjective'];

function reading(bedId: string, objectiveMm: number | null): ObjectiveBedReading {
  return {
    bedId, bedName: `Planche ${bedId}`, plotId: 'saules', plotName: 'Clos des saules', zoneId: 'parcelle', areaSquareMeters: 10,
    objectiveMm, objectiveOrigin: 'automatic', automaticObjective: automatic,
  } as ObjectiveBedReading;
}

test('écart a : la moyenne d’un jardin sur une partie de ses planches le dit, « 1 planche sur 2 »', () => {
  const lines = automaticObjectiveLines([reading('1', 18), reading('2', null)]);
  assert.equal(lines[0].label, 'Clos des saules · 1 planche sur 2');
  assert.equal(lines[0].mm, 18);
  const sansValeur = lines.find((line) => line.key === 'bed:2');
  assert.equal(sansValeur?.label, 'Clos des saules · Planche 2', 'la planche sans valeur garde sa ligne');
  assert.equal(sansValeur?.mm, null);
  assert.equal(automaticObjectiveLines([reading('1', 18), reading('2', 18)])[0].label, 'Clos des saules · 2 planches', 'toutes chiffrées : comme avant');
  assert.equal(automaticObjectiveLines([reading('1', null), reading('2', null)])[0].label, 'Clos des saules · 2 planches', 'aucune chiffrée : « sans valeur », comme avant');
});

test('écart b : un jardin tout hors saison dit « hors saison : ni besoin ni volume », jamais « non calculable »', () => {
  const view = readFileSync('app/irrigation/irrigation-needs-dashboard.tsx', 'utf8');
  assert.match(view, /function gardenNeedText\(garden: GardenNeeds, capital: boolean\) \{\n  if \(gardenAllOffSeason\(garden\.beds\)\) return `\$\{capital \? 'Hors saison' : 'hors saison'\} : ni besoin ni volume`;/);
  assert.equal(view.match(/Volume non calculable'|volume non calculable'/g), null, 'le volume « non calculable » ne s’écrit plus qu’en un endroit, après le cas hors saison');
  assert.equal((view.match(/gardenNeedText\(garden, (true|false)\)/g) ?? []).length, 2, 'la ligne du jardin et son détail au téléphone');
});

const week = (beds: TodayWeekBed[]) => todayWeek({ weekStart: '2026-07-20', weekEnd: '2026-07-26', beds, water: null, rainOrigins: { measuredMm: 2, reanalysisMm: 0, forecastMm: 0 } });
const weekBed = (plotId: string, plotName: string, objectiveMm: number | null, values: Partial<TodayWeekBed> = {}): TodayWeekBed => ({
  plotId, plotName, sheltered: false, areaSquareMeters: 10, objectiveMm, actualRainMm: 2, actualIrrigationMm: 0,
  realRemainingMm: objectiveMm === null ? null : objectiveMm - 2, ...values,
});

test('écart c : un jardin tout hors saison se dit « hors saison », sans « Lui en donner une » ; ses planches ne sont pas « sans eau visée »', () => {
  const result = week([
    weekBed('bas', 'Champ du bas', 20),
    weekBed('haut', 'Champ du haut', null, { offSeason: true }),
    weekBed('haut', 'Champ du haut', null, { offSeason: true }),
    weekBed('clos', 'Clos des saules', null),
  ]);
  assert.ok(result);
  const haut = [...result.shown, ...result.hidden].find((row) => row.key.includes('haut'));
  assert.ok(haut);
  assert.equal(haut.text, '2 mm reçus, hors saison', '« Eau de la semaine » d’« Aujourd’hui »');
  const clos = [...result.shown, ...result.hidden].find((row) => row.key.includes('clos'));
  assert.equal(clos?.text, '2 mm reçus, aucun objectif posé', 'un jardin sans objectif, en saison : comme avant');
  const gardens = weekGardens(result);
  const lines = [...gardens.shown, ...gardens.hidden];
  const hautLine = lines.find((line) => line.name === 'Champ du haut');
  assert.deepEqual([hautLine?.text, hautLine?.label, hautLine?.aimed, hautLine?.offSeason], ['hors saison', 'Champ du haut : hors saison', false, true]);
  const closLine = lines.find((line) => line.name === 'Clos des saules');
  assert.deepEqual([closLine?.text, closLine?.offSeason], ['pas d’eau visée', false]);
  assert.equal(gardens.unaimedBeds, '1 planche n’a pas d’eau visée : elle n’est pas comptée.', 'les deux planches hors saison ne sont pas comptées « sans eau visée »');
  const summary = readFileSync('app/irrigation/semaine/week-summary.tsx', 'utf8');
  assert.match(summary, /\{line\.aimed \|\| line\.offSeason \? null : <a className="week-garden-goal"/);
});
