import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { feasibilityHeadTiles, isPriorityLevelShown } from '../lib/domain/feasibility-reading.ts';
import type { IrrigationFeasibility, PriorityFeasibility } from '../lib/domain/irrigation-feasibility.ts';
import type { StoredWeeklyPlan, WeeklyPlan } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { keepsDeficit, shortageAction } from '../lib/domain/planning/shortage-reading.ts';
import { farm, settings } from './support/planning-fixtures.ts';

/**
 * Audit ergonomique final, lot B : la pénurie lisible
 * (docs/audit-ergonomie-final-lot-b-contract.md). Affichage seul : ces tests
 * lisent le plan et la faisabilité tels que le moteur les rend, sans rien
 * recalculer.
 */

const volume = (value: number) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(value)} m³`;

/** Le plan tel que le service l'enregistre : la phrase se lit sur le plan enregistré. */
function stored(plan: WeeklyPlan): StoredWeeklyPlan {
  const { weekStart, weekEnd, computedAt, horizonStartAt, horizonEndAt, beds, deficit, budgets, assumptions, suggestions, overcommittedDays, arbitration } = plan;
  return {
    calculation: {
      id: 'calcul', season: 2026, weekStart, trigger: 'manual', triggerEvent: null, computedAt, horizonStartAt, horizonEndAt, settings: plan.settings,
      summary: { weekEnd, beds, deficit, budgets, assumptions, suggestions, overcommittedDays, changes: null, ...(arbitration ? { arbitration } : {}) },
    },
    proposals: plan.proposals.map((proposal) => ({
      ...proposal, storedId: `enregistrée-${proposal.id}`, calculationId: 'calcul', calculatedAt: computedAt, status: 'proposed',
      validatedEventId: null, irrigationStatus: null, replacedByCalculationId: null, decidedAt: null, actorUserId: null,
    })),
    suggestions: [],
    pendingEvent: null,
  };
}

/** La ferme à quatre tunnels, une réserve de 12 m³ sans forage : l'eau manque (le jeu S12 de la 3.9). */
const shortagePlan = () => buildWeeklyPlan(farm({ extraTunnels: true, forageFlow: 0, reservoirCubicMeters: 12 }).inputs, settings);

// R3 — une phrase d'action, le détail dans un repli (F243, F244).

test('R3, F243 : en pénurie, la phrase dit le manque d’eau et le nombre de planches qui ne recevront pas tout', () => {
  const plan = stored(shortagePlan());
  const { deficit, beds } = plan.calculation.summary;
  assert.ok(deficit.waterCubicMeters > 0.001, 'le jeu manque d’eau');
  const count = beds.filter((bed) => keepsDeficit(bed) && !bed.reasons.includes('no-equipment')).length;
  assert.ok(count > 1);
  assert.deepEqual(shortageAction(plan, volume), {
    arbitrated: false,
    sentence: `Il manque ${volume(deficit.waterCubicMeters)} d’eau d’ici dimanche : ${count} planches ne recevront pas tout leur besoin.`,
  });
});

test('R3, F243 : sous une répartition validée, la phrase le dit ; une seule planche au singulier', () => {
  const plan = stored(shortagePlan());
  const { summary } = plan.calculation;
  const one = { ...plan, calculation: { ...plan.calculation, summary: { ...summary, beds: summary.beds.map((bed, index) => (index === 0 ? { ...bed, deficitMm: 3 } : { ...bed, deficitMm: 0 })), arbitration: { allocatedCubicMeters: 2, reservedCubicMeters: 2, unreceivedCubicMeters: 0, unreceivedBedCount: 0 } } } };
  assert.deepEqual(shortageAction(one, volume), {
    arbitrated: true,
    sentence: `Votre répartition s’applique : il manque ${volume(summary.deficit.waterCubicMeters)} d’eau d’ici dimanche, 1 planche ne recevra pas tout son besoin.`,
  });
});

test('R3, F243 : une planche qu’aucun matériel n’arrose n’entre pas dans le compte des planches en manque', () => {
  const plan = stored(shortagePlan());
  const { summary } = plan.calculation;
  const beds = summary.beds.map((bed, index) => (index < 2 ? { ...bed, deficitMm: 4, reasons: ['no-equipment' as const] } : { ...bed, deficitMm: index === 2 ? 1 : 0 }));
  const sentence = shortageAction({ ...plan, calculation: { ...plan.calculation, summary: { ...summary, beds } } }, volume)?.sentence;
  assert.match(sentence ?? '', /: 1 planche ne recevra pas tout son besoin\.$/);
});

test('R3, F243 : aucune phrase sans manque d’eau, ni pour un résidu sous le litre, ni pour une eau seulement inconnue ; « au moins », ou sans chiffre, quand un manque n’a pas de volume', () => {
  const plan = stored(shortagePlan());
  const { summary } = plan.calculation;
  const withDeficit = (waterCubicMeters: number, budgets = summary.budgets, unknownVolumeBeds?: { water: number; pumpTime: number }) => ({ ...plan, calculation: { ...plan.calculation, summary: { ...summary, budgets, deficit: { ...summary.deficit, waterCubicMeters, ...(unknownVolumeBeds ? { unknownVolumeBeds } : {}) } } } });
  assert.equal(shortageAction(withDeficit(0), volume), null);
  assert.equal(shortageAction(withDeficit(0.0004), volume), null, 'moins d’un litre : un arrondi');
  const unknown = summary.budgets.map((budget) => ({ ...budget, availableCubicMeters: null }));
  assert.equal(shortageAction(withDeficit(0, unknown), volume), null, 'une eau inconnue n’est pas un manque (D-089)');
  assert.match(shortageAction(withDeficit(2, unknown), volume)?.sentence ?? '', /^Il manque au moins 2,00 m³ d’eau d’ici dimanche/);
  assert.match(shortageAction(withDeficit(0, summary.budgets, { water: 1, pumpTime: 0 }), volume)?.sentence ?? '', /^Il manque de l’eau d’ici dimanche, sans que le manque puisse être chiffré : \d+ planches ne recevront pas tout leur besoin\.$/);
});

test('R3, F244 : les deux notes du calcul sont dans « Le détail du calcul », fermé, sous les tuiles', () => {
  const view = readFileSync('app/irrigation/planning/weekly-plan-view.tsx', 'utf8');
  const fold = view.slice(view.indexOf('<details className="planning-calculation">'), view.indexOf('</details>', view.indexOf('<details className="planning-calculation">')));
  assert.match(fold, /<summary>Le détail du calcul<\/summary>/);
  assert.match(fold, /\{explanation\}/);
  assert.match(fold, /\{arbitration\}/);
  assert.doesNotMatch(fold, /\bopen\b/, 'fermé par défaut');
  assert.equal(view.match(/className="planning-summary-note"/g)?.length, 2, 'aucune note hors du repli');
});

// R3 — quatre tuiles au plus sur « Ressources », aucun bloc de priorité vide (F245, F246).

type Row = PriorityFeasibility['beds'][number];
const row = (status: Row['status']) => ({ status }) as Row;
const level = (priority: PriorityFeasibility['priority'], arbitration: PriorityFeasibility['arbitration'], beds: Row[]) => ({ priority, arbitration, beds }) as PriorityFeasibility;
const dashboard = (priorities: PriorityFeasibility[]) => ({ priorities, forecastAvailableCubicMeters: 2, totalNeedCubicMeters: 5, coveragePercent: 40 }) as Pick<IrrigationFeasibility, 'priorities' | 'forecastAvailableCubicMeters' | 'totalNeedCubicMeters' | 'coveragePercent'>;

test('R3, F245 : rien à choisir, quatre tuiles ; les planches servies en entier comptées parmi celles qui ont un besoin', () => {
  const tiles = feasibilityHeadTiles(dashboard([
    level('high', 'automatic', [row('full'), row('no_need')]),
    level('normal', 'automatic', [row('partial'), row('full'), row('unknown')]),
    level('low', 'automatic', []),
  ]));
  assert.deepEqual(tiles, { availableCubicMeters: 2, needCubicMeters: 5, coveragePercent: 40, fullyServedBeds: 2, bedsWithNeed: 4 });
});

test('R3, F245 : un niveau qui attend un choix, ou dont le choix est validé, laisse les tuiles à l’écran de répartition', () => {
  for (const arbitration of ['required', 'revalidation_required', 'validated'] as const) {
    assert.equal(feasibilityHeadTiles(dashboard([level('normal', arbitration, [row('arbitration_required')])])), null, arbitration);
  }
  const view = readFileSync('app/irrigation/irrigation-feasibility-dashboard.tsx', 'utf8');
  const head = view.slice(view.indexOf('<div className="feasibility-summary is-head">'), view.indexOf('</div> : null}', view.indexOf('<div className="feasibility-summary is-head">')));
  assert.equal(head.match(/<Summary /g)?.length, 4, 'quatre tuiles au plus');
  const fold = view.slice(view.indexOf('<details className="feasibility-calculation">'));
  assert.match(fold, /<summary>Le détail du calcul<\/summary>/);
  for (const label of ['Besoins totaux', 'Eau mobilisable actuellement', 'Disponibilité prévisionnelle', 'Volume affectable', 'Volume satisfait', 'Déficit global', 'Taux de couverture', 'Volume non affecté', 'Voir les ressources prises en compte', 'Volume supplémentaire potentiellement utilisable']) {
    assert.ok(fold.includes(label), `« ${label} » dans le repli`);
  }
});

test('R3, F246 : un niveau sans planche, ou dont toutes les planches n’ont aucun besoin, ne s’affiche pas ; des données insuffisantes le gardent', () => {
  assert.equal(isPriorityLevelShown(level('high', 'automatic', [])), false);
  assert.equal(isPriorityLevelShown(level('low', 'automatic', [row('no_need'), row('no_need')])), false);
  assert.equal(isPriorityLevelShown(level('low', 'automatic', [row('no_need'), row('unknown')])), true, 'une donnée inconnue ne se tait pas (D-003)');
  assert.equal(isPriorityLevelShown(level('normal', 'required', [row('arbitration_required')])), true);
});
