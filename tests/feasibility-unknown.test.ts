import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { bedUnknownReason, feasibilityUnknownReasons, GENERAL_UNKNOWN_REASON, notComputableInline, notComputableLine } from '../lib/domain/feasibility-unknown.ts';
import type { IrrigationFeasibility, PriorityFeasibility } from '../lib/domain/irrigation-feasibility.ts';

/**
 * Audit ergonomique final, lot D, N1 : chaque « Non calculable » de la
 * faisabilité, sur « Ressources », dit pourquoi
 * (docs/audit-ergonomie-final-lot-d-contract.md, section 5 ter, F315, F316,
 * D-152). La raison est celle que le calcul expose déjà ; sinon la raison
 * générale renvoie à « Fiabilité du calcul ».
 */

type Row = PriorityFeasibility['beds'][number];
const row = (status: Row['status'], objectiveMm: number | null) => ({ status, need: { objectiveMm } }) as Row;
const level = (beds: Row[]) => ({ priority: 'normal', arbitration: 'automatic', beds }) as PriorityFeasibility;
const pool = (name: string, currentCubicMeters: number | null, forecastCubicMeters: number | null) => ({ key: name, name, currentCubicMeters, forecastCubicMeters, reasons: [], paths: {} }) as IrrigationFeasibility['pools'][number];

test('cas 10 : « Part servie » sans besoin chiffré dit pourquoi, comme « Besoin de la semaine » (F315)', () => {
  const reasons = feasibilityUnknownReasons({
    priorities: [level([row('partial', 20), row('unknown', null), row('unknown', null), row('unknown', 20)])],
    pools: [pool('Cuve nord', null, 4), pool('Forage', 0, null)],
  });
  assert.equal(reasons.need, 'besoin non chiffré pour 2 planches sans objectif adopté, 1 planche sans surface mouillée connue');
  assert.equal(reasons.current, 'volume non renseigné pour Cuve nord');
  assert.equal(reasons.forecast, 'prévision inconnue pour Forage');
});

test('sans raison connue, la raison générale renvoie à « Fiabilité du calcul » ; sans ressource, on le dit', () => {
  const reasons = feasibilityUnknownReasons({ priorities: [level([row('partial', 20)])], pools: [pool('Cuve', 3, 4)] });
  assert.deepEqual(reasons, { need: GENERAL_UNKNOWN_REASON, current: GENERAL_UNKNOWN_REASON, forecast: GENERAL_UNKNOWN_REASON });
  assert.equal(GENERAL_UNKNOWN_REASON, 'une donnée manque : voir Fiabilité du calcul');
  const empty = feasibilityUnknownReasons({ priorities: [], pools: [] });
  assert.equal(empty.current, 'aucune ressource en service');
  assert.equal(empty.forecast, 'aucune ressource en service');
});

test('une planche : son objectif, puis sa surface mouillée, puis la raison générale ; toujours la même forme (F316)', () => {
  assert.equal(bedUnknownReason({ objectiveMm: null, wettedAreaSquareMeters: 12 }), 'aucun objectif adopté');
  assert.equal(bedUnknownReason({ objectiveMm: 20, wettedAreaSquareMeters: null }), 'surface mouillée inconnue');
  assert.equal(bedUnknownReason({ objectiveMm: 20, wettedAreaSquareMeters: 0 }), 'surface mouillée inconnue');
  assert.equal(bedUnknownReason({ objectiveMm: 20, wettedAreaSquareMeters: 12 }), GENERAL_UNKNOWN_REASON);
  assert.equal(notComputableLine('aucun objectif adopté'), 'Non calculable : aucun objectif adopté.');
  assert.equal(notComputableInline('prévision inconnue'), 'Non calculable (prévision inconnue)');
});

test('l’écran : aucun « Non calculable » de la faisabilité sans sa raison, « Part servie » et « Couverture confirmée » compris (F316)', () => {
  const view = readFileSync('app/irrigation/irrigation-feasibility-dashboard.tsx', 'utf8');
  assert.match(view, /label="Eau disponible"[^\n]*reasons\.forecast/);
  assert.match(view, /label="Part servie"[^\n]*reasons\.need/);
  assert.match(view, /label="Déficit global"[^\n]*reasons\.need/);
  assert.match(view, /Couverture confirmée : \$\{notComputableInline\(reasons\.need\)\}/);
  assert.match(view, /label="Eau mobilisable actuellement"[^\n]*reasons\?\.current/);
  assert.match(view, /label="Disponibilité prévisionnelle"[^\n]*reasons\?\.forecast/);
  assert.match(view, /<p className="need-unknown-reason">\{notComputableLine\(bedUnknownReason\(row\.need\)\)\}<\/p>/);
  assert.doesNotMatch(view, /n’est pas chiffré en entier/, 'la phrase générale laisse place à la raison');
});
