import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { OTF_READ_LINE_AFTER_HOURS, otfReadLineReason } from '../lib/domain/otf-read-line.ts';
import { pageHelp } from '../lib/domain/features/help.ts';
import { pageUsesSeason, type IrrigationPageId } from '../lib/domain/features/pages.ts';
import { PAGE_FEATURE_IDS } from '../lib/domain/features/catalogue.ts';

/**
 * Simplifier l'usage du module, lot S1 (docs/simplification-s1-contract.md,
 * D-328) : les règles qui se lisent dans le domaine et dans le code. Les
 * hauteurs et les gestes se jouent dans le parcours P61.
 */

// PR 1 — Le chapeau d'une ligne (section 3).

const NOW = new Date('2026-11-25T11:00:00.000Z');
const HOUR_MS = 3_600_000;
const readAt = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * HOUR_MS).toISOString();

test('règle 2, F822 : la ligne de lecture ne se montre que pour dire un problème', () => {
  assert.equal(OTF_READ_LINE_AFTER_HOURS, 24);
  // Une lecture réussie de moins de 24 heures : rien à dire, d'OTF ou du cache.
  assert.equal(otfReadLineReason({ source: 'live', lastSuccessfulReadAt: readAt(0) }, NOW), null);
  assert.equal(otfReadLineReason({ source: 'cache', lastSuccessfulReadAt: readAt(5) }, NOW), null);
  assert.equal(otfReadLineReason({ source: 'live', lastSuccessfulReadAt: readAt(24) }, NOW), null, '24 heures pile : pas encore ancienne');
  // Plus de 24 heures : la lecture du matin a manqué au moins une fois.
  assert.equal(otfReadLineReason({ source: 'cache', lastSuccessfulReadAt: new Date(NOW.getTime() - 24 * HOUR_MS - 1).toISOString() }, NOW), 'old');
  assert.equal(otfReadLineReason({ source: 'live', lastSuccessfulReadAt: readAt(72) }, NOW), 'old');
  // La lecture a échoué : la ferme tourne sur sa dernière lecture réussie, même récente.
  assert.equal(otfReadLineReason({ source: 'cache', lastSuccessfulReadAt: readAt(1), warning: 'Connexion à Ouvre ta ferme indisponible.' }, NOW), 'failed');
  assert.equal(otfReadLineReason({ source: 'cache', lastSuccessfulReadAt: readAt(48), warning: 'Limite atteinte.' }, NOW), 'failed', 'l’échec passe avant l’âge');
  // Une date illisible ne se tait pas (D-003).
  assert.equal(otfReadLineReason({ source: 'live', lastSuccessfulReadAt: 'pas une date' }, NOW), 'old');
  // Un avertissement vide n'en est pas un.
  assert.equal(otfReadLineReason({ source: 'live', lastSuccessfulReadAt: readAt(1), warning: '' }, NOW), null);
});

test('F829 : les données de démonstration ne viennent d’aucune lecture, la ligne ne s’y montre jamais', () => {
  assert.equal(otfReadLineReason({ source: 'mock', lastSuccessfulReadAt: readAt(24 * 90) }, NOW), null);
  assert.equal(otfReadLineReason({ source: 'mock', lastSuccessfulReadAt: readAt(1), warning: 'peu importe' }, NOW), null);
});

test('règles 1 à 3 : le gabarit ne montre la ligne de lecture que sur l’avis du domaine, « Actualiser » vit dans le menu du compte', () => {
  const context = readFileSync('app/irrigation/page-context.ts', 'utf8');
  assert.match(context, /readLine: otfReadLineReason\(snapshot, new Date\(\)\) !== null/, 'le gabarit reçoit l’avis du domaine, calculé côté serveur');
  const shell = readFileSync('app/irrigation/shell/irrigation-shell.tsx', 'utf8');
  assert.equal(shell.match(/className="sync-card"/g)?.length, 1, 'une seule ligne de lecture');
  assert.match(shell, /\{readLine \? \(\s*<div className="sync-card"/, 'la ligne ne se montre que si le domaine le dit');
  assert.match(shell, /<a className="refresh-link" href=\{refreshHref\}>/, 'quand elle s’affiche, elle garde son lien');
  assert.match(shell, /refresh=\{\{ href: refreshHref, lastReadText: `\$\{source === 'mock' \? `\$\{sourceLabel\(source\)\} · ` : ''\}Dernière lecture réussie le \$\{updatedAt\}` \}\}/, 'le menu du compte reçoit « Actualiser » et la date ; les données de démonstration s’y disent (F829)');
  assert.match(shell, /const refreshHref = pageHref\(page, \{ season, zone, refresh: true \}\);/, 'la même adresse `?refresh=1` qu’avant');
  // Le bloc « Données en cache » ne bouge pas.
  assert.match(shell, /\{warning \? \(\s*<aside className="cache-warning" role="alert">/);
  const topbar = readFileSync('app/irrigation/shell/topbar.tsx', 'utf8');
  assert.match(topbar, /<AccountMenu userName=\{userName\} signOutPath=\{signOutPath\} refresh=\{refresh\} \/>/);
  const menu = readFileSync('app/irrigation/shell/account-menu.tsx', 'utf8');
  assert.match(menu, /\{refresh \? \(\s*<a role="menuitem" className="account-menu-refresh" href=\{refresh\.href\}>\s*Actualiser les données d’Ouvre ta ferme\s*<small>\{refresh\.lastReadText\}<\/small>/);
  assert.ok(menu.indexOf('account-menu-refresh') < menu.indexOf('Se déconnecter'), '« Actualiser » avant « Se déconnecter »');
  // Le nettoyage de l'adresse après la relecture ne change pas.
  assert.match(shell, /url\.searchParams\.delete\('refresh'\);/);
});

test('règle 4, F824 : la saison quitte « Arrosages » et reste là où elle sert', () => {
  const ALL = [...PAGE_FEATURE_IDS];
  const pages: IrrigationPageId[] = ['aujourdhui', ...PAGE_FEATURE_IDS, 'reglages'];
  const without = pages.filter((page) => !pageUsesSeason(page, ALL));
  assert.deepEqual(without, ['aujourdhui', 'arrosages', 'alertes-meteo']);
  assert.equal(pageUsesSeason('arrosages', ['arrosages']), false, 'quelles que soient les cases');
  for (const page of ['planning', 'besoins', 'historique', 'sol', 'cultures', 'materiel', 'ressources', 'alertes-cultures'] as const) {
    assert.equal(pageUsesSeason(page, ALL), true, page);
  }
});

/**
 * Règle 5, F826 : les explications fixes de tête de page passent dans le « ? ».
 * Pour chacune : le fichier qu'elle quitte, un morceau de sa phrase, et ce que
 * le « ? » de la page dit désormais.
 */
const MOVED: readonly { page: IrrigationPageId; file: string; gone: string; help: RegExp }[] = [
  { page: 'arrosages', file: 'app/irrigation/irrigation-event-manager.tsx', gone: 'Calculez l’apport, lancez un minuteur fiable', help: /minuteur/ },
  { page: 'planning', file: 'app/irrigation/planning/weekly-plan-view.tsx', gone: 'Des propositions de créneaux, du calcul à dimanche', help: /une par une, par jour ou toutes ensemble.*Rien n’est arrosé sans vous\./ },
  { page: 'besoins', file: 'app/irrigation/water-management-dashboard.tsx', gone: 'Suivi hebdomadaire du lundi au dimanche', help: /La semaine va du lundi au dimanche\./ },
  { page: 'historique', file: 'app/irrigation/irrigation-history-dashboard.tsx', gone: 'Analysez l’eau réellement appliquée', help: /l’eau réellement apportée, la météo observée et les objectifs de chaque semaine/ },
  { page: 'sol', file: 'app/irrigation/soil-reserve/soil-reserve-section.tsx', gone: 'tient à la disposition des racines', help: /réserve utile \(RFU\)/ },
  { page: 'cultures', file: 'app/irrigation/crop-water/crop-coefficients-panel.tsx', gone: 'Une culture ne boit pas autant à la levée', help: /une culture ne boit pas autant à la levée qu’en pleine saison/ },
  { page: 'ressources', file: 'app/irrigation/water-resource-manager.tsx', gone: 'Origines, réserves, connexions et estimation', help: /leurs connexions disent où va l’eau/ },
  { page: 'alertes-meteo', file: 'app/irrigation/weather-alerts-panel.tsx', gone: 'Une notification quand la prévision de la commune franchit', help: /aucune marge n’est ajoutée/ },
  { page: 'alertes-cultures', file: 'app/irrigation/crop-alerts-panel.tsx', gone: 'Le gel selon chaque culture, l’arrêt d’arrosage avant la récolte et les aspersions', help: /le gel selon la culture, l’arrêt d’arrosage avant la récolte, les aspersions à reconsidérer/ },
  { page: 'reglages', file: 'app/irrigation/reglages/feature-settings.tsx', gone: 'Seules les fonctionnalités cochées s’affichent et tournent', help: /Une case décochée n’est ni affichée ni prise en compte ; ses données restent enregistrées\./ },
];

test('règle 5, F826 : chaque explication fixe de tête de page a quitté la page, et son « ? » dit ce qu’elle disait', () => {
  for (const { page, file, gone, help } of MOVED) {
    assert.ok(!readFileSync(file, 'utf8').includes(gone), `${file} : « ${gone}… » est passé dans le « ? »`);
    const text = Object.values(pageHelp(page)).join(' ');
    assert.match(text, help, `le « ? » de ${page}`);
  }
  // La réserve du sol : la RFU et l'honnêteté de la jauge (D-041), les deux.
  const sol = Object.values(pageHelp('sol')).join(' ');
  assert.match(sol, /réserve utile \(RFU\)/);
  assert.match(sol, /C’est une information : elle ne change ni le besoin, ni le plan, ni les priorités\./);
});

test('F830 : une mise en garde reste en place, ce n’est pas une explication', () => {
  // « Alertes cultures » : les seuils sont des repères, la prévision est celle de l'air à 2 m.
  assert.match(readFileSync('app/irrigation/crop-alerts-panel.tsx', 'utf8'), /Les seuils sont des repères ; la prévision est celle de l’air à 2 m, à l’extérieur/);
  // « Alertes météo » : le repli « Pour le gel : la prévision est celle de l'air à 2 m » reste.
  assert.match(readFileSync('app/irrigation/weather-alerts-panel.tsx', 'utf8'), /<summary>Pour le gel : la prévision est celle de l’air à 2 m<\/summary>/);
  // Un état du jour reste en place : la phrase des planches à pluie incomplète, par exemple.
  assert.match(readFileSync('app/irrigation/irrigation-needs-dashboard.tsx', 'utf8'), /irrigation-needs-warning/);
});
