import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReferenceCrop } from '../lib/domain/crop-water/reference.ts';
import {
  cropSensitiveStages,
  sensitiveStageChoicesFor,
  sensitiveStageKey,
  sensitiveStageKeys,
  type SensitiveStageChoice,
  type SensitiveStageReference,
} from '../lib/domain/crop-water/sensitive-stages.ts';
import type { AllocationStatus, HydraulicQuality, PriorityFeasibility } from '../lib/domain/irrigation-feasibility.ts';
import type { BedIrrigationNeed, IrrigationNeedPriority } from '../lib/domain/irrigation-needs.ts';
import { feasibilityInShortage, stageAdvice } from '../lib/domain/stage-advice.ts';
import { crop, cropDay, cropWithoutKc, staged } from './support/soil-reserve-fixtures.ts';

/**
 * Amélioration n° 4 : la priorité conseillée selon le stade sensible
 * (docs/ameliorations-4-5-contract.md, §3, F730 à F732). Les stades
 * sensibles en vigueur (le choix de la ferme, sinon la liste préremplie,
 * sinon rien ; un stade désigné par son rang et son nom), puis le conseil :
 * seulement en pénurie, jamais pour un stade inconnu, la mention « stade
 * d'après le calendrier », regroupé par culture et trié par déficit. Le
 * parcours P56 le montre à l'écran.
 */

const TODAY = '2026-07-08';

const TOMATO: ReferenceCrop = {
  id: 'criiam-tomate',
  name: 'Tomate',
  source: 'criiam',
  curve: {
    shape: 'steps',
    stages: [
      { rank: 1, label: 'Plantation → Reprise', kc: 0.4 },
      { rank: 2, label: 'Reprise → Floraison 3e bouquet', kc: 0.8 },
      { rank: 3, label: 'Floraison 3e bouquet → Mi-récolte', kc: 1 },
    ],
    sets: [],
  },
  emergenceDelayDays: { 'direct-sowing': 0, planting: 0 },
} as unknown as ReferenceCrop;

const LEEK: ReferenceCrop = {
  ...TOMATO,
  id: 'criiam-poireau',
  name: 'Poireau',
  curve: { shape: 'steps', stages: [{ rank: 1, label: 'Reprise → Récolte', kc: 0.7 }], sets: [] },
} as unknown as ReferenceCrop;

const REFERENCES: SensitiveStageReference[] = [
  { cropKey: 'criiam-tomate', rank: 2, label: 'Reprise → Floraison 3e bouquet', confidence: 'source-directe', source: 'FAO, tableau 2' },
  { cropKey: 'criiam-tomate', rank: 3, label: 'Floraison 3e bouquet → Mi-récolte', confidence: 'source-directe', source: 'FAO, tableau 2' },
];

test('la valeur en vigueur d’un stade : le choix de la ferme, sinon la liste préremplie, sinon non sensible', () => {
  const choices: SensitiveStageChoice[] = [
    { cropKey: 'criiam-tomate', rank: 1, label: 'Plantation → Reprise', sensitive: true },
    { cropKey: 'criiam-tomate', rank: 3, label: 'Floraison 3e bouquet → Mi-récolte', sensitive: false },
  ];
  assert.deepEqual(cropSensitiveStages(TOMATO, REFERENCES, choices).map((row) => [row.rank, row.sensitive, row.origin, row.reference?.confidence ?? null]), [
    [1, true, 'farm', null],
    [2, true, 'reference', 'source-directe'],
    [3, false, 'farm', 'source-directe'],
  ]);
  // Une culture sans proposition n'a aucun stade sensible tant que la ferme n'en coche pas.
  assert.deepEqual(cropSensitiveStages(LEEK, REFERENCES, []).map((row) => [row.rank, row.sensitive, row.origin]), [[1, false, 'none']]);
});

test('un stade qui a changé de nom ne reprend ni la liste préremplie ni le choix de la ferme', () => {
  const renamed = { ...TOMATO, curve: { ...TOMATO.curve, stages: [
    { rank: 1, label: 'Plantation → Reprise', kc: 0.4 },
    { rank: 2, label: 'Reprise → Première fleur', kc: 0.8 },
  ] } } as unknown as ReferenceCrop;
  const choices: SensitiveStageChoice[] = [{ cropKey: 'criiam-tomate', rank: 1, label: 'Plantation → Ancien nom', sensitive: true }];
  assert.deepEqual(cropSensitiveStages(renamed, REFERENCES, choices).map((row) => [row.rank, row.sensitive, row.origin]), [
    [1, false, 'none'],
    [2, false, 'none'],
  ]);
  assert.equal(sensitiveStageKeys([renamed], REFERENCES, choices).size, 0);
});

test('les clés des stades sensibles en vigueur, culture par culture', () => {
  const keys = sensitiveStageKeys([TOMATO, LEEK], REFERENCES, [{ cropKey: 'criiam-poireau', rank: 1, label: 'Reprise → Récolte', sensitive: true }]);
  assert.deepEqual([...keys].sort(), [
    sensitiveStageKey('criiam-poireau', 1, 'Reprise → Récolte'),
    sensitiveStageKey('criiam-tomate', 2, 'Reprise → Floraison 3e bouquet'),
    sensitiveStageKey('criiam-tomate', 3, 'Floraison 3e bouquet → Mi-récolte'),
  ].sort());
});

test('ce qu’une ferme enregistre : un choix pour chaque stade qui diffère de la liste, rien pour les autres', () => {
  const saved = sensitiveStageChoicesFor({ cropKey: 'criiam-tomate', crop: TOMATO, references: REFERENCES, sensitiveRanks: [1, 2, 2] });
  assert.deepEqual(saved, {
    ok: true,
    cropName: 'Tomate',
    choices: [
      { cropKey: 'criiam-tomate', rank: 1, label: 'Plantation → Reprise', sensitive: true },
      { cropKey: 'criiam-tomate', rank: 3, label: 'Floraison 3e bouquet → Mi-récolte', sensitive: false },
    ],
  });
  // Cocher comme la liste, c'est revenir à la liste : aucun choix ne reste.
  assert.deepEqual(sensitiveStageChoicesFor({ cropKey: 'criiam-tomate', crop: TOMATO, references: REFERENCES, sensitiveRanks: [3, 2] }), { ok: true, cropName: 'Tomate', choices: [] });
});

test('une culture qui ne sert pas la ferme ou un rang absent de sa table est refusé', () => {
  assert.deepEqual(sensitiveStageChoicesFor({ cropKey: 'tomate-d-alice', crop: undefined, references: REFERENCES, sensitiveRanks: [1] }), {
    ok: false, problems: ['Culture de référence inconnue : tomate-d-alice.'],
  });
  assert.deepEqual(sensitiveStageChoicesFor({ cropKey: 'criiam-tomate', crop: TOMATO, references: REFERENCES, sensitiveRanks: [2, 7] }), {
    ok: false, problems: ['Tomate : le stade 7 n’existe pas dans sa table.'],
  });
});

// --- Le conseil (F731, F732) ---

const SENSITIVE = sensitiveStageKeys([TOMATO], REFERENCES, []);

function need(bedId: string, options: { priority?: IrrigationNeedPriority; deficit?: number | null; objectiveMm?: number | null; plotName?: string } = {}): BedIrrigationNeed {
  return {
    bedId, bedName: bedId, plotId: 'p1', plotName: options.plotName ?? 'Jardin Sud', zoneId: 'z1', zoneName: 'Les Prés',
    priority: options.priority ?? 'normal',
    relativeDeficitPercent: options.deficit === undefined ? 50 : options.deficit,
    objectiveMm: options.objectiveMm === undefined ? 30 : options.objectiveMm,
  } as BedIrrigationNeed;
}

function row(bed: BedIrrigationNeed, status: AllocationStatus = 'partial', hydraulicQuality: HydraulicQuality = 'confirmed') {
  return { need: bed, status, hydraulicQuality } as PriorityFeasibility['beds'][number];
}

function feasibility(rows: PriorityFeasibility['beds'], options: { shortage?: boolean; water?: number | null } = {}) {
  return {
    forecastAvailableCubicMeters: options.water === undefined ? 4 : options.water,
    priorities: [{ priority: 'normal', shortage: options.shortage ?? true, beds: rows } as unknown as PriorityFeasibility],
  };
}

const tomatoAt = (rank: number, label: string, extra: Parameters<typeof staged>[2] = {}) =>
  crop({ referenceCropId: 'criiam-tomate', name: 'Tomate', stage: staged(rank, '2026-06-20', { label, ...extra }) });

const declaration = { seriesId: 'serie-criiam-tomate', bedId: null, referenceCropId: 'criiam-tomate', rank: 2, date: '2026-06-20', recordedAt: '2026-06-20T08:00:00.000Z' };

function advise(rows: PriorityFeasibility['beds'], days: { bedId: string; days: ReturnType<typeof cropDay>[] }[], options: { shortage?: boolean; water?: number | null } = {}) {
  return stageAdvice({ feasibility: feasibility(rows, options), days, today: TODAY, sensitive: SENSITIVE });
}

test('seulement en pénurie, et une eau inconnue n’est pas une pénurie', () => {
  const rows = [row(need('N01'))];
  const days = [{ bedId: 'N01', days: [cropDay(TODAY, [tomatoAt(2, 'Reprise → Floraison 3e bouquet')])] }];
  assert.equal(advise(rows, days, { shortage: false }), null);
  assert.equal(advise(rows, days, { water: null }), null);
  assert.equal(feasibilityInShortage(feasibility(rows, { water: null })), false);
  assert.deepEqual(advise(rows, days)?.bedIds, ['N01']);
});

test('aucun conseil pour une planche déjà haute, servie en entier, sans alimentation compatible ou dont le stade est inconnu', () => {
  const sensitiveDay = (bedId: string) => ({ bedId, days: [cropDay(TODAY, [tomatoAt(2, 'Reprise → Floraison 3e bouquet')])] });
  const advice = advise([
    row(need('N01', { priority: 'high' }), 'partial'),
    row(need('N02'), 'full'),
    row(need('N03'), 'unsatisfied', 'incompatible'),
    row(need('N04'), 'unsatisfied'),
    row(need('N05'), 'partial'),
    row(need('N06'), 'partial'),
  ], [
    sensitiveDay('N01'), sensitiveDay('N02'), sensitiveDay('N03'),
    // Une culture sans Kc : son stade est inconnu, aucun conseil.
    { bedId: 'N04', days: [cropDay(TODAY, [cropWithoutKc('Physalis')])] },
    // Un stade non sensible.
    { bedId: 'N05', days: [cropDay(TODAY, [tomatoAt(1, 'Plantation → Reprise')])] },
    // Le jour d'hier ne compte pas.
    { bedId: 'N06', days: [cropDay('2026-07-07', [tomatoAt(2, 'Reprise → Floraison 3e bouquet')])] },
  ]);
  assert.deepEqual(advice, { groups: [], bedIds: [] });
});

test('chaque statut que la répartition ne sert pas en entier donne le conseil', () => {
  const statuses: AllocationStatus[] = ['partial', 'unsatisfied', 'not_selected', 'arbitration_required', 'waiting_priority', 'below_threshold'];
  const advice = advise(
    statuses.map((status, index) => row(need(`N0${index + 1}`), status)),
    statuses.map((_, index) => ({ bedId: `N0${index + 1}`, days: [cropDay(TODAY, [tomatoAt(2, 'Reprise → Floraison 3e bouquet')])] })),
  );
  assert.deepEqual(advice?.bedIds, ['N01', 'N02', 'N03', 'N04', 'N05', 'N06']);
});

test('le stade d’après le calendrier porte sa mention ; un stade déclaré, ou connu sans ET0, donne le conseil sans elle ou avec elle', () => {
  const advice = advise([row(need('N01')), row(need('N02')), row(need('N03'))], [
    { bedId: 'N01', days: [cropDay(TODAY, [tomatoAt(2, 'Reprise → Floraison 3e bouquet')])] },
    { bedId: 'N02', days: [cropDay(TODAY, [tomatoAt(2, 'Reprise → Floraison 3e bouquet', { origin: 'observed', declaration })])] },
    // L'ET0 manque : le stade et le Kc sont connus, le conseil tient.
    { bedId: 'N03', days: [cropDay(TODAY, [crop({ referenceCropId: 'criiam-tomate', name: 'Tomate', etmMm: null, stage: staged(3, '2026-06-20', { label: 'Floraison 3e bouquet → Mi-récolte' }) })])] },
  ]);
  const crops = advice?.groups[0]?.beds.map((bed) => [bed.bedId, bed.crops.map((item) => [item.stageLabel, item.fromCalendar])]);
  assert.deepEqual(crops?.sort(), [
    ['N01', [['Reprise → Floraison 3e bouquet', true]]],
    ['N02', [['Reprise → Floraison 3e bouquet', false]]],
    ['N03', [['Floraison 3e bouquet → Mi-récolte', true]]],
  ]);
});

test('regroupé par culture, les planches par déficit relatif décroissant (inconnu en dernier), les groupes par leur plus fort déficit', () => {
  const pepper = () => crop({ referenceCropId: 'criiam-poivron', name: 'Poivron', stage: staged(1, '2026-06-01', { label: 'Plantation → Début floraison' }) });
  const sensitive = new Set([...SENSITIVE, sensitiveStageKey('criiam-poivron', 1, 'Plantation → Début floraison')]);
  const advice = stageAdvice({
    feasibility: feasibility([
      row(need('N02', { deficit: 40 })),
      row(need('N10', { deficit: null, objectiveMm: null })),
      row(need('N03', { deficit: 40, priority: 'low' })),
      row(need('N01', { deficit: 90 })),
    ]),
    days: [
      { bedId: 'N02', days: [cropDay(TODAY, [tomatoAt(2, 'Reprise → Floraison 3e bouquet')])] },
      { bedId: 'N10', days: [cropDay(TODAY, [tomatoAt(3, 'Floraison 3e bouquet → Mi-récolte')])] },
      { bedId: 'N03', days: [cropDay(TODAY, [tomatoAt(2, 'Reprise → Floraison 3e bouquet')])] },
      // Deux cultures sensibles : la planche paraît dans les deux groupes, une fois dans la liste des planches conseillées.
      { bedId: 'N01', days: [cropDay(TODAY, [pepper(), tomatoAt(2, 'Reprise → Floraison 3e bouquet')])] },
    ],
    today: TODAY,
    sensitive,
  });
  assert.deepEqual(advice?.groups.map((group) => [group.referenceCropName, group.beds.map((bed) => bed.bedId)]), [
    ['Poivron', ['N01']],
    ['Tomate', ['N01', 'N02', 'N03', 'N10']],
  ]);
  assert.deepEqual(advice?.bedIds, ['N01', 'N02', 'N03', 'N10']);
  const unknown = advice?.groups[1]?.beds.find((bed) => bed.bedId === 'N10');
  assert.deepEqual([unknown?.relativeDeficitPercent, unknown?.deficitUnknownReason], [null, 'aucun objectif adopté']);
  assert.deepEqual(advice?.groups[1]?.beds.map((bed) => bed.priority), ['normal', 'normal', 'low', 'normal']);
});

test('le conseil se lit après la répartition, sans la changer', () => {
  const rows = [row(need('N01'))];
  const input = feasibility(rows);
  const before = JSON.stringify(input);
  advise(rows, [{ bedId: 'N01', days: [cropDay(TODAY, [tomatoAt(2, 'Reprise → Floraison 3e bouquet')])] }]);
  stageAdvice({ feasibility: input, days: [], today: TODAY, sensitive: SENSITIVE });
  assert.equal(JSON.stringify(input), before);
});
