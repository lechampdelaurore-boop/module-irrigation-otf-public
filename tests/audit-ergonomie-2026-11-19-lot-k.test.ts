import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import type { PlanBedOutcome } from '../lib/domain/planning/contract.ts';
import { informationalBedCount, unplacedDeficitCount, unplacedGroups, unplacedTileDetail, waitingBedCount } from '../lib/domain/planning/action-summary.ts';
import { dayValidateShown, unplacedFoldLabel } from '../lib/domain/planning/phone-week.ts';
import { adjustDoseText, adjustedDoseMm } from '../lib/domain/planning/adjust-dose.ts';
import { finishInputText, finishValueToSend } from '../lib/domain/finish-time.ts';
import { clockFromMinutes, clockText, countText, dateClockText, durationMinutesText } from '../lib/domain/clock-text.ts';

/**
 * Audit ergonomique du 19 novembre 2026, lot K « Finitions de charte »
 * (docs/audit-ergonomie-2026-11-19-lot-k-contract.md) : les règles qui se
 * lisent dans le code.
 */

// n° 17 — Planning : le rouge pour le manque d'eau seul (PR 1, F463 à F467).

const outcome = (id: string, reasons: PlanBedOutcome['reasons'], deficitMm: number): PlanBedOutcome => ({
  bedId: id, bedName: id, plotName: 'Jardin', priority: 'normal', needMm: deficitMm, targetMm: 0, placedMm: 0, surplusMm: 0,
  deficitMm, reasons, proposalIds: [], equipmentId: 'rampe',
});

test('n° 17, F463 : deux planches au besoin sous la dose minimale, une semaine normale : rien en rouge, « en attente », pour information', () => {
  const groups = unplacedGroups([outcome('B1', ['below-minimum-dose'], 1.1), outcome('B2', ['below-minimum-dose'], 1.1)]);
  assert.equal(unplacedDeficitCount(groups), 0, 'la tuile « Planches non servies » à 0, neutre');
  assert.equal(waitingBedCount(groups), 2);
  assert.equal(informationalBedCount(groups), 2);
  assert.deepEqual(groups.groups.map((group) => [group.key, group.informational]), [['below-minimum-dose', true]]);
  assert.equal(unplacedTileDetail(groups, 2), '0 avec un manque chiffré · 2 en attente d’un besoin plus grand, pour information');
  assert.equal(unplacedFoldLabel(unplacedDeficitCount(groups), informationalBedCount(groups), waitingBedCount(groups)), 'Planches en attente (2)');
});

test('n° 17, F463 : avec un vrai manque, le rouge le garde ; les planches en attente et sans objectif dites à part', () => {
  const groups = unplacedGroups([
    outcome('A1', ['water-budget'], 3.6),
    outcome('B1', ['below-minimum-dose'], 1.1),
    outcome('O1', ['no-objective'], 0),
    outcome('O2', ['no-objective'], 0),
  ]);
  assert.equal(unplacedDeficitCount(groups), 1);
  assert.equal(unplacedTileDetail(groups, 2), '1 avec un manque chiffré · 2 sans objectif et 1 en attente d’un besoin plus grand, pour information');
  assert.equal(unplacedFoldLabel(1, informationalBedCount(groups), waitingBedCount(groups)), 'Planches non servies (1) · 2 sans objectif · 1 en attente');
  assert.equal(unplacedFoldLabel(0, 3, 1), 'Planches sans objectif (2) · 1 en attente');
  assert.equal(unplacedFoldLabel(0, 2), 'Planches sans objectif (2)', 'sans planche en attente, le titre d’avant');
});

test('n° 17, F463 : un besoin sous la dose et un autre motif reste un manque', () => {
  const groups = unplacedGroups([outcome('B1', ['below-minimum-dose', 'spacing'], 1.1)]);
  assert.equal(unplacedDeficitCount(groups), 1);
  assert.equal(waitingBedCount(groups), 0);
});

test('n° 17, F464 : « Ajuster » montre la dose de la carte, et la rend exacte quand on n’y touche pas', () => {
  const parse = (text: string) => Number(text.replace(',', '.'));
  assert.equal(adjustDoseText(8.06), '8,1');
  assert.equal(adjustedDoseMm('8,1', 8.06, parse), 8.06, 'laissée telle quelle : la dose exacte');
  assert.equal(adjustedDoseMm(' 8,1 ', 8.06, parse), 8.06);
  assert.equal(adjustedDoseMm('8,15', 8.06, parse), 8.15, 'tapée : à sa précision');
  assert.equal(adjustedDoseMm('9', 8.06, parse), 9);
});

test('n° 17, F465 à F467 : la ligne d’état en deux lignes, un seul « Valider » pour une proposition, le pli des réglages signé', () => {
  assert.equal(dayValidateShown(0), false);
  assert.equal(dayValidateShown(1), false);
  assert.equal(dayValidateShown(2), true);
  const view = readFileSync('app/irrigation/planning/weekly-plan-view.tsx', 'utf8');
  assert.ok(view.indexOf('className="planning-meta-main"') < view.indexOf('className="planning-meta-sources"'));
  assert.ok(view.indexOf('className="planning-meta-sources"') < view.indexOf('Prévision météo sur'), 'la source météo dans la seconde ligne');
  const css = readFileSync('app/irrigation/styles/finitions-charte.css', 'utf8');
  assert.match(css, /\.planning-settings > summary::after \{/);
  const sheets = readFileSync('app/irrigation/irrigation.css', 'utf8');
  assert.ok(sheets.indexOf("'./styles/finitions-charte.css'") < sheets.indexOf("'./styles/gestes-surs.css'"), '« gestes-surs.css » reste la dernière');
});

// n° 21 — Un bouton plein par écran, un seul dessin de pli, plus de geste muet (PR 3, F469 à F473).

test('n° 21, F469 : un seul dessin de pli, le chevron à droite, sauf les menus « … »', () => {
  const css = readFileSync('app/irrigation/styles/finitions-charte.css', 'utf8');
  const fold = 'main.app-shell details:not(.row-menu, .equipment-menu, .plan-equipment-menu) > summary:not(:has(> .detail-hint))';
  assert.ok(css.includes(`${fold} {`), 'la règle commune à tous les plis');
  assert.ok(css.includes(`${fold}::-webkit-details-marker`), 'le triangle du navigateur caché');
  assert.ok(css.includes(`${fold}::after`), 'le chevron');
  assert.ok(css.includes('details[open]:not(.row-menu, .equipment-menu, .plan-equipment-menu) > summary:not(:has(> .detail-hint))::after'), 'le chevron tourne');
  const sheets = readFileSync('app/irrigation/irrigation.css', 'utf8');
  assert.ok(sheets.indexOf('finitions-charte.css') > sheets.indexOf('pages-courtes.css'), 'après les pages courtes, pour l’emporter');
  assert.ok(sheets.indexOf('finitions-charte.css') < sheets.indexOf('gestes-surs.css'), 'avant les gestes sûrs, qui gardent le dernier mot');
});

test('n° 21, F470 : les raccourcis et les choix ne sont plus pleins', () => {
  const water = readFileSync('app/irrigation/water-management-dashboard.tsx', 'utf8');
  assert.match(water, /className="water-week-today"/);
  assert.match(water, /today >= dashboard\.weekStart && today <= dashboard\.weekEnd/, '« Cette semaine » indisponible quand on y est');
  assert.match(readFileSync('app/irrigation/water-resource-manager.tsx', 'utf8'), /aria-pressed=\{dashboard\.horizon === horizon\}/);
  assert.match(readFileSync('app/irrigation/garden-group-manager.tsx', 'utf8'), /data-secondary=\{!hasSprinkler \|\| undefined\}/);
  assert.match(readFileSync('app/irrigation/hierarchy-browser.tsx', 'utf8'), /hasSprinkler=\{equipment\.some\(\(item\) => item\.kind === 'sprinkler'\)\}/);
});

test('n° 21, F471 : « Retirer la mesure » indisponible sans mesure à retirer', () => {
  const water = readFileSync('app/irrigation/water-management-dashboard.tsx', 'utf8');
  assert.match(water, /nothingToRemove\(dashboard\.days, rainDate\)/);
});

test('n° 21, F472 : l’heure réelle de fin à la minute, la seconde du minuteur gardée si on n’y touche pas', () => {
  assert.equal(finishInputText('2026-11-19T08:50:37'), '2026-11-19T08:50');
  assert.equal(finishInputText('2026-11-19T08:50'), '2026-11-19T08:50');
  assert.equal(finishValueToSend('2026-11-19T08:50', '2026-11-19T08:50:37'), '2026-11-19T08:50:37', 'laissée telle quelle : la seconde du minuteur');
  assert.equal(finishValueToSend('2026-11-19T08:45', '2026-11-19T08:50:37'), '2026-11-19T08:45', 'tapée : à la minute');
  assert.match(readFileSync('app/irrigation/irrigation-manager/finish-irrigation-dialog.tsx', 'utf8'), /step="60"/);
});

test('n° 21, F473 : un seul mot pour finir un arrosage', () => {
  for (const file of ['app/irrigation/irrigation-manager/finish-irrigation-dialog.tsx', 'app/irrigation/irrigation-manager/irrigation-cards.tsx', 'app/irrigation/today/today-day.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.ok(source.includes('Terminer l’irrigation'), file);
    assert.doesNotMatch(source, /Terminer maintenant|'Irrigation terminée'\}/, file);
  }
});

// n° 22 — Mots et formats (PR 4, F474 à F476).

test('n° 22, F474 : les heures s’écrivent « 8 h 50 », à l’heure de la ferme, l’hiver comme l’été', () => {
  assert.equal(clockText('2026-11-19T07:50:00Z'), '8 h 50', 'hiver, UTC+1');
  assert.equal(clockText('2026-06-16T06:50:00Z'), '8 h 50', 'été, UTC+2');
  assert.equal(clockText('2026-06-16T16:00:00Z'), '18 h');
  assert.equal(clockText('2026-06-16T22:05:00Z'), '0 h 05');
  assert.equal(clockFromMinutes(21 * 60), '21 h');
  assert.equal(clockFromMinutes(23 * 60 + 59), '23 h 59');
  assert.equal(clockFromMinutes(0), '0 h');
  assert.equal(dateClockText('2026-06-16T06:50:00Z'), '16/06/2026 à 8 h 50');
  assert.equal(dateClockText('2026-06-16T06:50:00Z', 'Europe/Paris', 'medium'), '16 juin 2026 à 8 h 50');
});

test('n° 22, F474 : les durées s’écrivent « 1 h 21 », « 2 h », « 45 min »', () => {
  assert.equal(durationMinutesText(81), '1 h 21');
  assert.equal(durationMinutesText(120), '2 h');
  assert.equal(durationMinutesText(45), '45 min');
  assert.equal(durationMinutesText(64.6), '1 h 05');
});

test('n° 22, F475 : plus de pluriel entre parenthèses', () => {
  assert.equal(countText(0, 'jour'), '0 jour');
  assert.equal(countText(1, 'jour'), '1 jour');
  assert.equal(countText(7, 'jour'), '7 jours');
  assert.equal(countText(3, 'planification'), '3 planifications');
  for (const file of ['app/irrigation/irrigation-history-dashboard.tsx', 'app/irrigation/series-water-view.tsx', 'app/irrigation/pump-manager.tsx', 'app/irrigation/water-resource-manager.tsx', 'lib/services/irrigation-history-service.ts']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\(s\)/, file);
  }
  assert.match(readFileSync('lib/domain/irrigation-history-csv.ts', 'utf8'), /'Planche\(s\)'/, 'l’export garde ses colonnes de tableur');
});

test('n° 22, F476 : « Ressources » et « Réglages » en mots simples ; « Faisabilité recalculée. » est un message', () => {
  const resources = readFileSync('app/irrigation/water-resource-manager.tsx', 'utf8');
  for (const word of ['Disponibilité / projections', 'Apport non retenu', 'Disponible théorique', 'mobilisables']) assert.ok(!resources.includes(word), word);
  const feasibility = readFileSync('app/irrigation/irrigation-feasibility-dashboard.tsx', 'utf8');
  assert.ok(!feasibility.includes('Analyse préliminaire'));
  assert.match(feasibility, /className="water-notice feasibility-notice"/);
  assert.ok(!readFileSync('app/irrigation/crop-water/crop-coefficients-panel.tsx', 'utf8').includes('sans référence Kc'));
});

// n° 19 — Une échelle de tailles de texte, rien sous 12 px (PR 5, F477 et F478).

test('n° 19, F477 : six tailles en jetons, aucune taille fixe sous 23 px hors de l’échelle, quatre graisses', () => {
  const root = readFileSync('app/globals.css', 'utf8');
  for (const [name, value] of [['12', '.75rem'], ['13', '.8125rem'], ['14', '.875rem'], ['16', '1rem'], ['20', '1.25rem'], ['28', '1.75rem']]) {
    assert.match(root, new RegExp(`--text-${name}: ${value.replace('.', '\\.')};`));
  }
  const sheets = readdirSync('app/irrigation/styles').filter((name) => name.endsWith('.css')).map((name) => `app/irrigation/styles/${name}`);
  for (const file of [...sheets, 'app/globals.css']) {
    const css = readFileSync(file, 'utf8');
    for (const match of css.matchAll(/font-size:\s*([0-9.]+)(px|rem)/g)) {
      const px = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
      assert.ok(px >= 23, `${file} : ${match[0]} hors de l’échelle`);
    }
    for (const match of css.matchAll(/font-weight:\s*(\d{3})\b(?!\s*\d)/g)) {
      assert.ok(['300', '400', '500', '700'].includes(match[1]), `${file} : ${match[0]}`);
    }
  }
  const finish = readFileSync('app/irrigation/styles/finitions-charte.css', 'utf8');
  assert.match(finish, /small \{\n  font-size: max\(var\(--text-12\), 80%\);/);
  assert.match(finish, /:where\(main\.app-shell\) :where\(strong, b\) \{\n  font-weight: 700;/);
});

test('n° 19, F478 : la pastille chiffrée du plan dit ce qu’elle compte', () => {
  const card = readFileSync('app/irrigation/hierarchy/plot-plan-card.tsx', 'utf8');
  assert.match(card, /mm par heure d’arrosage/);
  assert.match(card, /className="plot-coverage-legend"/);
});
