import assert from 'node:assert/strict';
import test from 'node:test';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import { phoneBar, phoneBarLabel } from '../lib/domain/features/phone-bar';
import { menuPages, pageLabel } from '../lib/domain/features/pages';
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

// Barre du bas (F6).

test('cas 1 : toutes cases cochées, quatre entrées et « Plus », qui ouvre toutes les pages', () => {
  const menu = menuPages(ALL);
  const bar = phoneBar(menu, 'arrosages');
  assert.deepEqual(bar.entries, ['aujourdhui', 'arrosages', 'planning', 'ressources']);
  assert.equal(bar.more, true);
  assert.equal(bar.moreMarked, false);
  assert.equal(menu.length, 12, '« Plus » liste les douze pages');
  assert.equal(menu[0], 'aujourdhui');
  assert.equal(menu.at(-1), 'reglages');
});

test('cas 2 : un menu de cinq pages ou moins tient entier dans la barre, sans « Plus »', () => {
  // Arrosages a besoin de Matériel : le menu compte Aujourd'hui, Arrosages, Matériel, Historique et Réglages.
  const menu = menuPages(withRequirements(['arrosages', 'historique']));
  assert.deepEqual(menu, ['aujourdhui', 'arrosages', 'materiel', 'historique', 'reglages']);
  assert.deepEqual(phoneBar(menu, 'historique'), { entries: menu, more: false, moreMarked: false });
  // Sans « Aujourd'hui » (Matériel et Calculateur seuls) : deux pages, toutes dans la barre.
  const two = menuPages(withRequirements(['calculateur']));
  assert.deepEqual(two, ['materiel', 'reglages']);
  assert.equal(phoneBar(two, null).more, false);
  const six = menuPages(withRequirements(['arrosages', 'historique', 'alertes-meteo']));
  assert.equal(six.length, 6);
  assert.deepEqual(phoneBar(six, null).entries, ['aujourdhui', 'arrosages', 'materiel', 'alertes-meteo']);
  assert.equal(phoneBar(six, null).more, true);
});

test('cas 3 : la page ouverte hors de la barre fait porter la pastille verte à « Plus »', () => {
  const menu = menuPages(ALL);
  assert.equal(phoneBar(menu, 'sol').moreMarked, true);
  assert.equal(phoneBar(menu, 'reglages').moreMarked, true);
  assert.equal(phoneBar(menu, 'planning').moreMarked, false);
  // La page introuvable n'a pas de page courante : rien à signaler.
  assert.equal(phoneBar(menu, null).moreMarked, false);
});

test('une page prioritaire décochée laisse sa place à la suivante du menu, et la barre suit l’ordre du menu', () => {
  // Sans planning ni ressources : Aujourd'hui, Arrosages, puis les pages suivantes du menu.
  const menu = menuPages(withRequirements(['arrosages', 'besoins', 'sol', 'historique', 'alertes-meteo']));
  assert.deepEqual(menu, ['aujourdhui', 'arrosages', 'besoins', 'sol', 'cultures', 'materiel', 'alertes-meteo', 'historique', 'reglages']);
  assert.deepEqual(phoneBar(menu, null).entries, ['aujourdhui', 'arrosages', 'besoins', 'sol']);
  // Sans arrosages du tout : les pages du début du menu.
  const sansArrosages = menuPages(['materiel', 'alertes-meteo', 'alertes-cultures', 'calculateur']);
  assert.deepEqual(sansArrosages, ['aujourdhui', 'materiel', 'alertes-meteo', 'alertes-cultures', 'reglages']);
  assert.equal(phoneBar(sansArrosages, null).more, false);
});

test('la barre porte un nom court sous l’icône, le nom entier restant celui de la page', () => {
  assert.equal(phoneBarLabel('planning', pageLabel('planning')), 'Planning');
  assert.equal(phoneBarLabel('ressources', pageLabel('ressources')), 'Ressources');
  assert.equal(phoneBarLabel('arrosages', pageLabel('arrosages')), 'Arrosages');
  assert.equal(phoneBarLabel('alertes-meteo', pageLabel('alertes-meteo')), 'Alertes météo');
  for (const page of menuPages(ALL)) assert.ok(phoneBarLabel(page, pageLabel(page)).length <= 16, page);
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
    '1 à valider · 2 faites · 1 en retard · 0,195 m³ · manque d’eau 1,5 m³ · pompage manquant 0,5 m³ · 7 planches non servies · 1 non vérifié',
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
