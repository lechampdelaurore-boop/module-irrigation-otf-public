import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Audit ergonomique final, lot D, J2 : le pli « Réglages de cette page »
 * (docs/audit-ergonomie-final-lot-d-contract.md, section 5, F305 à F307).
 * Affichage seul : ces tests lisent où chaque réglage est rangé ; les
 * parcours P12, P15, P31c, P32 et P35 l'ouvrent et s'en servent.
 */

const source = (path: string) => readFileSync(path, 'utf8');
const fold = source('app/irrigation/shell/page-settings-fold.tsx');

test('le pli s’appelle « Réglages de cette page », fermé, avec une ancre stable qui l’ouvre (F305, F307)', () => {
  assert.match(fold, /export const PAGE_SETTINGS_ANCHOR = 'reglages-de-la-page';/);
  assert.match(fold, /<strong>Réglages de cette page<\/strong>/);
  // Le pli passe par `AnchoredFold`, partagé avec « Correspondance des espèces » (lot J du 19 novembre 2026, F459).
  assert.match(fold, /initiallyOpen=\{openReason !== null\}/, 'fermé, sauf raison dite');
  assert.match(fold, /useState\(initiallyOpen\)/);
  assert.match(fold, /addEventListener\('hashchange'/, 'un lien suivi dans la page l’ouvre aussi');
  assert.match(fold, /fold\.current\?\.contains\(target\)/, 'l’ancre d’un élément qu’il contient l’ouvre');
});

test('chaque page range ses réglages dans le pli, en bas (F305)', () => {
  const arrosages = source('app/irrigation/water-management-dashboard.tsx');
  const limit = arrosages.indexOf('Limite journalière d’irrigation');
  assert.ok(arrosages.lastIndexOf('<PageSettingsFold>', limit) > arrosages.lastIndexOf("if (part === 'arrosages')", limit), 'Arrosages : la limite journalière');

  // Le seuil est dans « Réglages de la semaine », le dernier pli du détail de la page « Semaine » (S4, PR 2), sous la même ancre.
  const besoins = source('app/irrigation/irrigation-needs-dashboard.tsx');
  assert.ok(besoins.indexOf('irrigation-needs-gardens') < besoins.indexOf('export function NeedsThresholdSettings'), 'après les besoins par planche');
  assert.ok(besoins.indexOf('export function NeedsThresholdSettings') < besoins.indexOf('Seuil minimal de planification'), 'Objectifs et besoins : le seuil');
  const semaine = source('app/irrigation/semaine/page.tsx');
  assert.ok(semaine.lastIndexOf('<WeekSettings ') > semaine.lastIndexOf('<WaterManagementDashboard '), 'le pli des réglages, en bas du détail');
  assert.ok(semaine.indexOf('<NeedsThresholdSettings ') > semaine.lastIndexOf('<WeekSettings '), 'le seuil dans le pli des réglages');
  assert.match(semaine, /<AnchoredFold\s+id=\{PAGE_SETTINGS_ANCHOR\}/);

  const ressources = source('app/irrigation/water-resource-manager.tsx');
  const settingsAt = ressources.indexOf('<PageSettingsFold>');
  assert.ok(settingsAt > ressources.indexOf('water-projection-panel') && settingsAt < ressources.indexOf('<h3>Liaisons</h3>'), 'Ressources : les liaisons, après les projections');
  assert.ok(ressources.indexOf('{after}') < settingsAt, 'la faisabilité avant le pli');
  assert.match(source('app/irrigation/ressources/page.tsx'), /settings=\{<PumpManager /, 'Ressources : les pompes et la pompe habituelle');

  const materiel = source('app/irrigation/hierarchy-browser.tsx');
  assert.match(materiel, /<PageSettingsFold>\s*<BedCropWaterPanel /, 'Matériel : le besoin de la culture de la planche');
});

test('« Matériel » renvoie au besoin de la planche, sur « Semaine » depuis S4 (PR 4), au lieu de répéter ETM, ET0 et Kc (F306)', () => {
  const materiel = source('app/irrigation/hierarchy-browser.tsx');
  assert.match(materiel, /className="bed-crop-water-pointer"/);
  assert.match(materiel, /pageHref\('semaine', \{ season \}, NEEDS_SECTION_ANCHOR\)/);
  assert.match(materiel, /href=\{`#\$\{PAGE_SETTINGS_ANCHOR\}`\}/);
});

test('M1 : au téléphone, une case de planche de « Matériel » ne descend pas sous 44 px de large ; trop nombreuses, elles passent à la ligne (F313, F314)', () => {
  const sheet = source('app/irrigation/styles/pages-allegees.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const phone = sheet.match(/@media \(max-width: 600px\) \{\s*\.bed-strip \{([\s\S]*?)\}\s*\}/)?.[1] ?? '';
  assert.match(phone, /grid-template-columns:\s*repeat\(auto-fit, minmax\(var\(--touch-target\), 1fr\)\);/);
  assert.match(phone, /gap:\s*4px;/, 'un écart entre deux cases, pour ne pas en toucher deux');
  assert.match(source('app/globals.css'), /--touch-target:\s*44px;/);
  // La feuille du lot passe après celle du téléphone : sa règle l'emporte.
  const entry = source('app/irrigation/irrigation.css');
  assert.ok(entry.indexOf("styles/pages-allegees.css") > entry.indexOf("styles/responsive.css"));
  // Le nom accessible et le geste de la case ne changent pas (F313, point 3).
  assert.match(source('app/irrigation/hierarchy/plot-plan-card.tsx'), /className="plan-bed"[\s\S]*?aria-label=\{bedCoverage/);
});
