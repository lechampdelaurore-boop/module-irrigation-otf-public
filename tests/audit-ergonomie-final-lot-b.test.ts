import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { feasibilityHeadTiles, isPriorityLevelShown } from '../lib/domain/feasibility-reading.ts';
import type { IrrigationFeasibility, PriorityFeasibility } from '../lib/domain/irrigation-feasibility.ts';
import type { PlanBedOutcome, StoredWeeklyPlan, WeeklyPlan } from '../lib/domain/planning/contract.ts';
import { informationalBedCount, unplacedDeficitCount, unplacedGroups, unplacedTileDetail } from '../lib/domain/planning/action-summary.ts';
import { planSummaryLine, unplacedFoldLabel } from '../lib/domain/planning/phone-week.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { budgetValidatedNote, keepsDeficit, overcommittedDayNotice, shortageAction, shortageDecisionPending, waterReceivedWithoutShareMm } from '../lib/domain/planning/shortage-reading.ts';
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
const row = (status: Row['status'], objectiveMm: number | null = 10) => ({ status, need: { objectiveMm } }) as Row;
const level = (priority: PriorityFeasibility['priority'], arbitration: PriorityFeasibility['arbitration'], beds: Row[]) => ({ priority, arbitration, beds }) as PriorityFeasibility;
const dashboard = (priorities: PriorityFeasibility[]) => ({ priorities, forecastAvailableCubicMeters: 2, totalNeedCubicMeters: 5, knownNeedCubicMeters: 5, coveragePercent: 40 }) as Pick<IrrigationFeasibility, 'priorities' | 'forecastAvailableCubicMeters' | 'totalNeedCubicMeters' | 'knownNeedCubicMeters' | 'coveragePercent'>;

test('R3, F245 : rien à choisir, quatre tuiles ; les planches servies en entier comptées parmi celles qui ont un besoin', () => {
  const tiles = feasibilityHeadTiles(dashboard([
    level('high', 'automatic', [row('full'), row('no_need')]),
    level('normal', 'automatic', [row('partial'), row('full'), row('unknown')]),
    level('low', 'automatic', []),
  ]));
  assert.deepEqual(tiles, { availableCubicMeters: 2, needCubicMeters: 5, knownNeedCubicMeters: 5, unknownNeed: { noObjective: 0, noWettedArea: 1 }, coveragePercent: 40, fullyServedBeds: 2, bedsWithNeed: 4 });
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

// R4 — « Répartir l'eau », la faisabilité en tête de « Ressources » (F247, F248).

test('R4, F248 : une répartition attend quand le plan de la semaine manque d’eau sans répartition validée', () => {
  const plan = stored(shortagePlan());
  const { summary } = plan.calculation;
  const variant = (changes: Partial<typeof summary>) => ({ ...plan, calculation: { ...plan.calculation, summary: { ...summary, ...changes } } });
  assert.equal(shortageDecisionPending(null), false, 'aucun plan : l’ordre d’avant');
  assert.equal(shortageDecisionPending(plan), true);
  assert.equal(shortageDecisionPending(variant({ arbitration: { allocatedCubicMeters: 2, reservedCubicMeters: 2, unreceivedCubicMeters: 0, unreceivedBedCount: 0 } })), false, 'une répartition validée s’applique');
  assert.equal(shortageDecisionPending(variant({ deficit: { ...summary.deficit, waterCubicMeters: 0 } })), false, 'rien ne manque');
  const unknown = summary.budgets.map((budget) => ({ ...budget, availableCubicMeters: null }));
  assert.equal(shortageDecisionPending(variant({ budgets: unknown, deficit: { ...summary.deficit, waterCubicMeters: 0 } })), false, 'une eau inconnue n’est pas un manque');
});

test('R4, F247 et F248 : le lien mène à l’ancre de la faisabilité, qui passe en tête de « Ressources » quand une répartition attend', () => {
  // Le planning vit sur la page « Semaine » depuis le lot S4 (docs/simplification-s4-contract.md, section 3).
  const route = readFileSync('app/irrigation/semaine/page.tsx', 'utf8');
  assert.match(route, /isPartActive\(context\.enabled, 'feasibility'\) \? pageHref\('ressources', \{ season: context\.season \}, 'repartition'\) : null/);
  const view = readFileSync('app/irrigation/planning/weekly-plan-view.tsx', 'utf8');
  assert.match(view, /action\.arbitrated \? 'Revoir la répartition' : 'Répartir l’eau'/);
  assert.match(readFileSync('app/irrigation/irrigation-feasibility-dashboard.tsx', 'utf8'), /<section ref=\{root\} id="repartition"/);
  const ressources = readFileSync('app/irrigation/ressources/page.tsx', 'utf8');
  // Lot D, J2 (D-149) : sinon, la faisabilité vient après les ressources, juste avant le pli « Réglages de cette page » où passent les pompes.
  const order = ['{first ? feasibility : null}', '<WaterResourceManager', 'after={first ? null : feasibility}', 'settings={<PumpManager'].map((marker) => ressources.indexOf(marker));
  assert.ok(order.every((index, position) => index >= 0 && (position === 0 || index > order[position - 1])), 'la faisabilité avant les ressources quand elle passe en tête, après sinon');
  assert.match(readFileSync('app/irrigation/page-loaders.ts', 'utf8'), /decisionPending: shortageDecisionPending\(weeklyPlan\)/);
});

// J7 — seules les planches en manque se comptent en rouge (F251 à F253).

const outcome = (id: string, reasons: PlanBedOutcome['reasons'], deficitMm: number): PlanBedOutcome => ({
  bedId: id, bedName: id, plotName: 'Abri des noues', priority: 'normal', needMm: deficitMm > 0 ? 10.9 : 0, targetMm: 0, placedMm: 0, surplusMm: 0,
  deficitMm, reasons, proposalIds: [], equipmentId: 'rampe',
});

test('J7, F251 et F252 : cinq planches en manque, cinq sans objectif ; le compte rouge ne prend que les premières, « Sans objectif » en dernier, pour information', () => {
  const beds = [
    ...Array.from({ length: 5 }, (_, index) => outcome(`O${index + 1}`, ['no-objective'], 0)),
    ...Array.from({ length: 5 }, (_, index) => outcome(`A${index + 1}`, ['water-budget'], 3.6)),
  ];
  const groups = unplacedGroups(beds);
  assert.equal(unplacedDeficitCount(groups), 5);
  assert.equal(informationalBedCount(groups), 5);
  assert.deepEqual(groups.groups.map((group) => [group.title, group.informational]), [['Manque d’eau (5)', false], ['Sans objectif (5)', true]], 'à taille égale, le groupe sans manque passe après');
  assert.equal(unplacedFoldLabel(unplacedDeficitCount(groups), informationalBedCount(groups)), 'Planches non servies (5) · 5 sans objectif');
  assert.equal(unplacedTileDetail(groups, 5), '5 avec un manque chiffré · 5 sans objectif, pour information');
  // Le plus gros groupe d'abord, sauf un groupe sans manque, toujours en dernier.
  const many = unplacedGroups([...Array.from({ length: 8 }, (_, index) => outcome(`O${index + 1}`, ['no-objective'], 0)), outcome('A1', ['water-budget'], 3.6)]);
  assert.deepEqual(many.groups.map((group) => group.title), ['Manque d’eau (1)', 'Sans objectif (8)']);
  assert.match(planSummaryLine({ volumeCubicMeters: 1, unverifiedCount: 0 }, [], { waterCubicMeters: 0.37, pumpTimeCubicMeters: 0 }, unplacedDeficitCount(many), volume), /· 1 planche non servie$/);
});

test('J7, F253 : au téléphone, une ligne compacte par planche, la priorité normale et « Placé » repliés, le besoin dit « sur »', () => {
  const view = readFileSync('app/irrigation/planning/weekly-plan-view.tsx', 'utf8');
  assert.match(view, /<span className="planning-unplaced-of"> sur \{mmLabel\(bed\.needMm\)\}<\/span><FigureOrigin/);
  const sheet = readFileSync('app/irrigation/styles/penurie-lisible.css', 'utf8');
  const phone = sheet.slice(sheet.indexOf('@media (max-width: 760px)'));
  for (const hidden of ['td[data-cell="priority"][data-priority="normal"]', 'td[data-cell="need"]', 'td[data-cell="placed"]']) assert.ok(phone.includes(hidden), `${hidden} replié au téléphone`);
  assert.match(phone, /td\[data-cell="deficit"\]::before \{\s*content: "· manque ";/);
  assert.match(phone, /td\[data-cell="reason"\] \{\s*flex-basis: 100%;/);
  assert.match(sheet, /^\.planning-unplaced-of \{\s*display: none;/m, 'à l’ordinateur, la colonne « Besoin » le dit');
});

// Remarque 2 de la recette 3.9 — l'eau qu'une planche reçoit sans part (F254).

test('remarque 2, F254 : en report (S12), une planche reportée sous la rampe d’un bloc servi dit les 15 mm qu’elle reçoit quand même ; les autres rien', () => {
  const inputs = farm({ extraTunnels: true, forageFlow: 0, reservoirCubicMeters: 12, priorities: { 'tunnel-1': 'high', 'tunnel-2': 'high', 'tunnel-3': 'low', 'tunnel-4': 'low' } }).inputs;
  const plan = stored(buildWeeklyPlan(inputs, { ...settings, shortageStrategy: 'defer' }));
  const now = new Date(plan.calculation.computedAt);
  const bed = (id: string) => plan.calculation.summary.beds.find((item) => item.bedId === id)!;
  // B2-9, reportée : rien de placé à sa part, et la rampe du bloc 2 la mouille comme ses voisines servies.
  assert.deepEqual([bed('B2-9').reasons, bed('B2-9').placedMm, bed('B2-9').deficitMm], [['deferred'], 0, 20]);
  assert.ok(Math.abs((waterReceivedWithoutShareMm(plan, bed('B2-9'), now) ?? 0) - 15) < 0.01, 'les 15 mm de la rampe, à l’arrondi des secondes près');
  assert.equal(bed('B2-9').deficitMm, 20, 'le manque ne change pas');
  // Une planche servie à sa part, et une reportée sous un matériel qui ne part pas : rien à dire.
  assert.equal(waterReceivedWithoutShareMm(plan, bed('B2-1'), now), null);
  assert.equal(waterReceivedWithoutShareMm(plan, bed('T3-2'), now), null);
  // Une validée dont l'irrigation est annulée ne compte plus ; une refusée non plus.
  const off = (status: 'refused' | 'validated', irrigationStatus: 'canceled' | null) => ({ ...plan, proposals: plan.proposals.map((proposal) => ({ ...proposal, status, irrigationStatus })) });
  assert.equal(waterReceivedWithoutShareMm(off('validated', 'canceled'), bed('B2-9'), now), null);
  assert.equal(waterReceivedWithoutShareMm(off('refused', null), bed('B2-9'), now), null);
  assert.ok((waterReceivedWithoutShareMm(off('validated', null), bed('B2-9'), now) ?? 0) > 14.9, 'une validée compte');
  const view = readFileSync('app/irrigation/planning/weekly-plan-view.tsx', 'utf8');
  assert.match(view, /` ; reçoit quand même \$\{mmLabel\(receivedMm\)\} du matériel qui arrose ses voisines`/);
});

// Remarque 4 — les parts comptées après l'eau validée (F255).

test('remarque 4, F255 : avec des arrosages validés, le pli du budget dit le volume déjà validé ; sans chiffre quand un volume manque ; rien sans validation', () => {
  const plan = stored(shortagePlan());
  assert.ok(plan.proposals.length >= 2, 'le jeu propose au moins deux créneaux');
  assert.equal(budgetValidatedNote(plan, volume), null, 'rien de validé : aucune phrase');
  const [first, second] = plan.proposals;
  const validated = (proposal: StoredWeeklyPlan['proposals'][number], extra: Partial<StoredWeeklyPlan['proposals'][number]> = {}) => ({ ...proposal, status: 'validated' as const, ...extra });
  const two = { ...plan, proposals: [validated(first, { volumeCubicMeters: 3 }), validated(second, { volumeCubicMeters: 2.06 }), ...plan.proposals.slice(2)] };
  assert.equal(budgetValidatedNote(two, volume), 'Les parts se comptent sur ce qui reste à placer, après les 5,06 m³ déjà validés cette semaine : une part qui baisse après une validation ne retire pas d’eau aux planches.');
  // Une validée dont l'irrigation est annulée ne compte plus : son eau est revenue au plan.
  const canceled = { ...plan, proposals: [validated(first, { volumeCubicMeters: 3 }), validated(second, { volumeCubicMeters: 2.06, irrigationStatus: 'canceled' }), ...plan.proposals.slice(2)] };
  assert.match(budgetValidatedNote(canceled, volume) ?? '', /après les 3,00 m³ déjà validés/);
  // Un volume validé inconnu : la phrase ne chiffre pas.
  const unknown = { ...plan, proposals: [validated(first, { volumeCubicMeters: null }), validated(second, { volumeCubicMeters: 2.06 }), ...plan.proposals.slice(2)] };
  assert.match(budgetValidatedNote(unknown, volume) ?? '', /^Les parts se comptent sur ce qui reste à placer, après les arrosages déjà validés cette semaine : /);
  const view = readFileSync('app/irrigation/planning/weekly-plan-view.tsx', 'utf8');
  assert.match(view, /validatedNote=\{budgetValidatedNote\(plan, formatVolume\)\}/);
  assert.match(view, /<summary>Budget d’eau d’ici dimanche, chaîne par chaîne<\/summary>\s*\{\/\*[^*]*\*\/\}\s*\{validatedNote \? <p className="planning-budgets-validated">/);
});

// Remarque 5 — le jour au-delà de sa limite journalière (F256).

test('remarque 5, F256 : le jour qu’une limite posée après coup met en défaut le dit dans sa colonne ; les autres rien', () => {
  const days = [{ date: '2026-07-07', limitCubicMeters: 1.5, committedCubicMeters: 5.06 }];
  assert.equal(overcommittedDayNotice(days, '2026-07-07', volume), 'Limite journalière de 1,50 m³ dépassée : 5,06 m³ engagés');
  assert.equal(overcommittedDayNotice(days, '2026-07-08', volume), null);
  assert.equal(overcommittedDayNotice([], '2026-07-07', volume), null);
  assert.equal(overcommittedDayNotice([{ date: '2026-07-07', limitCubicMeters: 0.01, committedCubicMeters: 0.12 }], '2026-07-07', volume), 'Limite journalière de 0,01 m³ dépassée : 0,12 m³ engagés');
  const view = readFileSync('app/irrigation/planning/weekly-plan-view.tsx', 'utf8');
  assert.match(view, /overcommitted=\{overcommittedDayNotice\(plan\.calculation\.summary\.overcommittedDays, day\.dateKey, formatVolume\)\}/);
  assert.match(view, /\{overcommitted \? <p className="planning-day-overcommitted" role="note">\{overcommitted\}<\/p> : null\}/);
});
