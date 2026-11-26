import assert from 'node:assert/strict';
import test from 'node:test';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import { phoneBar } from '../lib/domain/features/phone-bar';
import { menuPages } from '../lib/domain/features/pages';
import { withRequirements } from '../lib/domain/features/selection';
import type { ProposalStatus, StoredProposal } from '../lib/domain/planning/contract';
import { pastDaysLabel, phoneWeekFolds, planSummaryLine } from '../lib/domain/planning/phone-week';
import type { PlanDay } from '../lib/domain/planning/presentation';
import { isLimitedAlertStatus, isSystemAlertsBannerFolded, systemAlertsMemoryAfter } from '../lib/domain/system-alerts-banner';

/**
 * Le lot 2 de l'audit ergonomique, PR 1 : le téléphone (3.8 quater, point 2,
 * docs/audit-ergonomie-lot2-contract.md, section 4 et cas 1 à 3, 17 à 19 ;
 * précisions F6, F10 et F11, D-073). La barre du bas, le planning replié et
 * le bandeau des alertes système sont des règles d'affichage : elles vivent
 * dans `lib/domain/` et se testent ici ; le parcours P28 les éprouve à l'écran.
 */

const ALL: FeatureId[] = [...FEATURE_IDS];

// Barre du bas (F6) : remplacée par les trois endroits et le « + » (simplification, lot S3, PR 2,
// D-331, docs/simplification-s3-contract.md, section 4). Ses règles se testent dans
// tests/simplification-s3-barre.test.ts ; ici, ce que F6 garde : la page la plus utilisée au
// champ en tête, et la barre suit le menu.

test('F6 réécrite par S3 : « Aujourd’hui » en tête de la barre, plus de « Plus », chaque page joignable', () => {
  const menu = menuPages(ALL);
  assert.equal(menu.length, 14, 'les douze pages, « Semaine » (lot S4, PR 1) et « Ma ferme » (lot S3, PR 1)');
  const bar = phoneBar(menu, 'arrosages', true);
  assert.deepEqual(bar.map((item) => (item.kind === 'plus' ? 'plus' : item.place)), ['aujourdhui', 'semaine', 'plus', 'ma-ferme']);
  // Un menu de cinq pages ou moins ne tient plus entier dans la barre : la barre montre ses endroits.
  const small = menuPages(withRequirements(['arrosages']));
  assert.deepEqual(small, ['aujourdhui', 'arrosages', 'materiel', 'ma-ferme', 'reglages']);
  assert.deepEqual(phoneBar(small, null, true).map((item) => (item.kind === 'plus' ? 'plus' : item.place)), ['aujourdhui', 'plus', 'ma-ferme']);
});

// Planning replié (F11).

const SATURDAY_6H = new Date('2026-11-14T05:00:00.000Z'); // samedi 14 novembre 2026, 6 h 00 à la ferme
const WEEK = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];

function proposal(dateKey: string, hour: string, status: ProposalStatus, irrigationStatus: StoredProposal['irrigationStatus'] = null): StoredProposal {
  return { storedId: `${dateKey}-${hour}`, status, irrigationStatus, startAt: `${dateKey}T${hour}:00.000Z` } as StoredProposal;
}

function day(dateKey: string, proposals: StoredProposal[] = []): PlanDay {
  const counts: Record<ProposalStatus, number> = { proposed: 0, validated: 0, refused: 0, replaced: 0, expired: 0 };
  for (const item of proposals) counts[item.status] += 1;
  return { dateKey, beforeHorizon: false, proposals, counts, volumeCubicMeters: 0, unknownVolumeCount: 0 };
}

test('cas 17 : le jour du jour ouvert, les jours écoulés repliés, sauf celui qui porte des irrigations en retard', () => {
  const late = ['06:00', '07:00', '08:00'].map((hour) => proposal('2026-11-11', hour, 'validated', 'planned'));
  const days = WEEK.map((key) => {
    if (key === '2026-11-11') return day(key, late);
    if (key === '2026-11-14') return day(key, [proposal(key, '18:00', 'proposed')]);
    if (key === '2026-11-15') return day(key, [proposal(key, '18:00', 'proposed')]);
    return day(key);
  });
  const { folds, pastCount } = phoneWeekFolds(days, SATURDAY_6H);
  assert.deepEqual(folds, {
    '2026-11-09': 'past',
    '2026-11-10': 'past',
    '2026-11-11': 'open',
    '2026-11-12': 'past',
    '2026-11-13': 'past',
    '2026-11-14': 'open',
    '2026-11-15': 'folded',
  });
  // Le pli compte les jours qu'il range, pas celui qui reste ouvert pour son retard.
  assert.equal(pastCount, 4);
  assert.equal(pastDaysLabel(pastCount), 'Jours écoulés (4)');
});

test('un jour écoulé dont les irrigations sont faites, annulées ou jamais validées se replie', () => {
  const done = day('2026-11-12', [
    proposal('2026-11-12', '06:00', 'validated', 'completed'),
    proposal('2026-11-12', '07:00', 'validated', 'canceled'),
    proposal('2026-11-12', '08:00', 'expired'),
    proposal('2026-11-12', '09:00', 'refused'),
  ]);
  assert.equal(phoneWeekFolds([done, day('2026-11-14')], SATURDAY_6H).folds['2026-11-12'], 'past');
});

test('aujourd’hui sans rien : le jour à venir le plus proche qui a des propositions reste ouvert', () => {
  const days = WEEK.map((key) => (key === '2026-11-15' ? day(key, [proposal(key, '06:00', 'proposed')]) : day(key)));
  const { folds } = phoneWeekFolds(days, SATURDAY_6H);
  assert.equal(folds['2026-11-14'], 'open');
  assert.equal(folds['2026-11-15'], 'open');
  // Des cartes expirées seules ne sont pas « quelque chose à faire » aujourd'hui.
  const expiredToday = WEEK.map((key) => {
    if (key === '2026-11-14') return day(key, [proposal(key, '04:00', 'expired')]);
    if (key === '2026-11-15') return day(key, [proposal(key, '06:00', 'proposed')]);
    return day(key);
  });
  assert.equal(phoneWeekFolds(expiredToday, SATURDAY_6H).folds['2026-11-15'], 'open');
  // Aujourd'hui a des propositions : demain reste replié.
  const busyToday = WEEK.map((key) => (key >= '2026-11-14' ? day(key, [proposal(key, '18:00', 'proposed')]) : day(key)));
  assert.equal(phoneWeekFolds(busyToday, SATURDAY_6H).folds['2026-11-15'], 'folded');
});

test('aucun jour écoulé : aucun pli « Jours écoulés »', () => {
  const monday = new Date('2026-11-09T05:00:00.000Z');
  const { folds, pastCount } = phoneWeekFolds(WEEK.map((key) => day(key)), monday);
  assert.equal(pastCount, 0);
  assert.equal(folds['2026-11-09'], 'open');
  assert.equal(folds['2026-11-10'], 'folded');
});

test('les tuiles en une ligne : les gestes et le volume toujours, le reste quand il compte (lot 3, point 5)', () => {
  const volume = (value: number) => `${String(value).replace('.', ',')} m³`;
  assert.equal(
    planSummaryLine({ volumeCubicMeters: 4.2, unverifiedCount: 0 }, ['3 à valider', '1 faite'], { waterCubicMeters: 0, pumpTimeCubicMeters: 0 }, 0, volume),
    '3 à valider · 1 faite · 4,2 m³',
  );
  assert.equal(
    planSummaryLine({ volumeCubicMeters: 0.195, unverifiedCount: 1 }, ['1 à valider', '2 faites', '1 en retard'], { waterCubicMeters: 1.5, pumpTimeCubicMeters: 0.5 }, 7, volume),
    '1 à valider · 2 faites · 1 en retard · 0,195 m³ · manque d’eau 1,5 m³ · non pompé faute de temps 0,5 m³ · 7 planches non servies · 1 non vérifié',
  );
  assert.equal(
    planSummaryLine({ volumeCubicMeters: 0, unverifiedCount: 0 }, ['0 à valider', '0 faite'], { waterCubicMeters: 0, pumpTimeCubicMeters: 0 }, 1, volume),
    '0 à valider · 0 faite · 0 m³ · 1 planche non servie',
  );
});

// Bandeau « Alertes système non disponibles » (F10).

test('cas 18 : le bandeau d’un état limité déjà vu sur l’appareil se replie ; un autre état le fait revenir', () => {
  assert.equal(isSystemAlertsBannerFolded('denied', null), false);
  assert.equal(isSystemAlertsBannerFolded('denied', 'denied'), true);
  // Du « non pris en charge » au « refusé » : le bandeau revient.
  assert.equal(isSystemAlertsBannerFolded('denied', 'unsupported'), false);
  // Activées ou à activer : rien à replier.
  assert.equal(isSystemAlertsBannerFolded('enabled', 'enabled'), false);
  assert.equal(isSystemAlertsBannerFolded('default', 'denied'), false);
});

test('cas 19 : un souvenir illisible laisse le bandeau déplié ; l’appareil ne retient que l’état limité', () => {
  // Le stockage illisible se lit `null` (system-alerts-memory.ts) : le bandeau reste affiché.
  assert.equal(isSystemAlertsBannerFolded('unavailable', null), false);
  assert.equal(systemAlertsMemoryAfter('unavailable'), 'unavailable');
  assert.equal(systemAlertsMemoryAfter('enabled'), null);
  assert.equal(systemAlertsMemoryAfter('default'), null);
  // Pendant la vérification, rien n'est effacé.
  assert.equal(systemAlertsMemoryAfter('checking'), undefined);
  assert.equal(isLimitedAlertStatus('denied'), true);
  assert.equal(isLimitedAlertStatus('n’importe quoi'), false);
  assert.equal(isLimitedAlertStatus(null), false);
});
