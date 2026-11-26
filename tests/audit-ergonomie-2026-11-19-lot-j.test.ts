import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pageHref, pageLabel } from '../lib/domain/features/pages.ts';
import type { SeasonSpecies, SpeciesWithoutReference } from '../lib/domain/crop-water/species.ts';
import { withoutReferenceBeyondSpecies } from '../lib/domain/crop-water/species-linking.ts';
import { gardenState, goalsFoldLine, manualRainFoldLine, weatherFoldLine, weekTotalsLine } from '../lib/domain/besoins-phone.ts';
import { middleCutParts, parseMaterielTab, plotFoldSummary } from '../lib/domain/materiel-tabs.ts';
import { historyFilterSummary } from '../lib/domain/premier-geste.ts';

/**
 * Audit ergonomique du 19 novembre 2026, lot J « Pages courtes au
 * téléphone » (docs/audit-ergonomie-2026-11-19-lot-j-contract.md) : les
 * règles qui se lisent dans le code. Les hauteurs se mesurent dans le
 * parcours P40.
 */

// n° 18 — Un seul titre (PR 1, F456).

/** Les blocs qui ouvrent une page, le titre qu'ils portaient et la page. */
const FIRST_BLOCKS = [
  { file: 'app/irrigation/planning/weekly-plan-view.tsx', id: 'planning-title', page: 'planning', synonyms: [] },
  { file: 'app/irrigation/soil-reserve/soil-reserve-section.tsx', id: 'soil-reserve-title', page: 'sol', synonyms: [] },
  { file: 'app/irrigation/crop-water/crop-coefficients-panel.tsx', id: 'crop-coefficients-title', page: 'cultures', synonyms: ['Besoin en eau par culture'] },
  { file: 'app/irrigation/weather-alerts-panel.tsx', id: 'weather-alerts-title', page: 'alertes-meteo', synonyms: [] },
  { file: 'app/irrigation/crop-alerts-panel.tsx', id: 'crop-alerts-title', page: 'alertes-cultures', synonyms: [] },
  { file: 'app/irrigation/irrigation-history-dashboard.tsx', id: 'irrigation-history-title', page: 'historique', synonyms: ['Cumuls et historique'] },
  { file: 'app/irrigation/series-water-view.tsx', id: 'series-water-title', page: 'historique', synonyms: ['Cumuls et historique'] },
] as const;

test('n° 18, F456 : le premier bloc d’une page ne redit pas son titre à l’écran, il le garde pour les lecteurs d’écran', () => {
  for (const block of FIRST_BLOCKS) {
    const source = readFileSync(block.file, 'utf8');
    const heading = source.match(new RegExp(`<h([1-6]) id="${block.id}"([^>]*)>([^<]*)<`));
    assert.ok(heading, `${block.file} garde son titre`);
    const [, level, attributes, text] = heading;
    assert.ok([pageLabel(block.page), ...block.synonyms].includes(text ?? ''), `${block.file} : « ${text} »`);
    assert.match(attributes ?? '', /className="sr-only"/, `${block.file} : titre caché à l’écran`);
    assert.equal(level, '2', `${block.file} : un h2 sous le titre de la page, sans niveau sauté`);
    assert.doesNotMatch(source, /className="eyebrow">(Planning|Suivi réel) · saison/, `${block.file} : pas de surtitre qui redit la page`);
  }
});

test('n° 18, F456 : sous un titre de bloc devenu h2, les sous-titres remontent d’un niveau', () => {
  for (const file of ['app/irrigation/soil-reserve/soil-gauge.tsx', 'app/irrigation/soil-reserve/soil-settings.tsx', 'app/irrigation/weather-alerts-panel.tsx']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /<h[45][ >]/, file);
  }
  assert.doesNotMatch(readFileSync('app/irrigation/crop-alerts-panel.tsx', 'utf8'), /<h5[ >]/);
});

// n° 15 — « Besoin par culture » : le pli des réglages (PR 2, F457).

test('n° 15, F457 : « Réglages du calcul » est rangé dans le pli « Réglages de cette page »', () => {
  const panel = readFileSync('app/irrigation/crop-water/crop-coefficients-panel.tsx', 'utf8');
  assert.match(panel, /<PageSettingsFold>\s*<CropWaterSettingsSection /);
  assert.equal(panel.match(/<CropWaterSettingsSection /g)?.length, 1, 'jamais hors du pli');
});

// n° 15 — « Réglages » : les espèces pliées, une seule liste (PR 4, F459).

test('n° 15, F459 : la liste « sans référence Kc » ne répète pas les espèces à rattacher ; une exception de série y reste', () => {
  const species = (plantId: string, target: 'none' | 'reference' | 'without-reference') => ({
    plantId,
    plantName: plantId,
    series: [{ id: `s-${plantId}`, name: `Série ${plantId}` }],
    link: target === 'none' ? null : { seriesId: null, plantId, target: target === 'reference' ? { kind: 'reference', referenceCropId: 'tomate', analogy: false } : { kind: 'without-reference' } },
    exceptions: [],
  }) as unknown as SeasonSpecies;
  const list = [species('Carotte', 'none'), species('Fenouil', 'without-reference'), species('Tomate', 'reference')];
  const withoutReference: SpeciesWithoutReference[] = [
    { plantId: 'Carotte', plantName: 'Carotte', reason: 'missing', seriesIds: ['s-Carotte'] },
    { plantId: 'Fenouil', plantName: 'Fenouil', reason: 'without-reference', seriesIds: ['s-Fenouil'] },
    { plantId: 'Tomate', plantName: 'Tomate', reason: 'without-reference', seriesIds: ['s-Tomate-2'] },
  ];
  assert.deepEqual(withoutReferenceBeyondSpecies(withoutReference, list).map((item) => item.plantId), ['Tomate']);
});

test('n° 15, F459 : « Correspondance des espèces » est un pli fermé à ancre, son compteur en titre', () => {
  const panel = readFileSync('app/irrigation/crop-water/crop-coefficients-panel.tsx', 'utf8');
  assert.match(panel, /<AnchoredFold\s+id=\{SPECIES_FOLD_ANCHOR\}[\s\S]*?<strong>\{speciesLinkCounter\(view\.species\)\}<\/strong>[\s\S]*?<SpeciesSection [\s\S]*?<WithoutReferenceSection [\s\S]*?<\/AnchoredFold>/);
  // L'ancre est partagée avec la vérification de l'accueil (4.4, F589) : elle vit avec la correspondance des espèces.
  assert.match(readFileSync('lib/domain/crop-water/species-linking.ts', 'utf8'), /export const SPECIES_FOLD_ANCHOR = 'correspondance-des-especes';/);
  assert.doesNotMatch(panel, /initiallyOpen/, 'fermé d’office');
});

// n° 15 — « Objectifs et besoins » court au téléphone (PR 5, F460).

test('n° 15, F460 : les tuiles en une ligne, un total incomplet dit « partiel »', () => {
  assert.equal(
    weekTotalsLine({ objective: { objectiveMm: 25, withObjective: 4, total: 4 }, realizedIrrigationMm: 12, actualRainMm: 3.5, remainingForecastRainMm: 5, et0Mm: 18.2, partial: false }),
    '25 mm visés, ferme entière · irrigué 12 mm · pluie 3,5 mm · prévue 5 mm · soif de la semaine 18,2 mm',
  );
  assert.equal(
    weekTotalsLine({ objective: { objectiveMm: null, withObjective: 0, total: 4 }, realizedIrrigationMm: 0, actualRainMm: null, remainingForecastRainMm: 14.8, et0Mm: 11.5, partial: true }),
    'aucune eau visée · irrigué 0 mm · pluie non disponible · prévue 14,8 mm · soif de la semaine 11,5 mm · totaux incomplets',
  );
});

test('n° 15, F460 : les résumés des plis des objectifs, de la pluie mesurée et de la météo', () => {
  assert.equal(goalsFoldLine(0, null), 'Aucun objectif pour cette semaine.');
  assert.equal(goalsFoldLine(3, 25), 'Toute la ferme : 25 mm · 3 objectifs');
  assert.equal(goalsFoldLine(1, null), '1 objectif');
  assert.equal(manualRainFoldLine([{ manualRainMm: null }, { manualRainMm: null }]), 'Aucune mesure cette semaine.');
  assert.equal(manualRainFoldLine([{ manualRainMm: 0 }, { manualRainMm: 4.5 }, { manualRainMm: null }]), '2 jours mesurés cette semaine, 4,5 mm.');
  const at = (value: Date) => value.toISOString().slice(0, 10);
  assert.equal(weatherFoldLine('Rennes', null, false, at), 'Rennes · jamais actualisée');
  assert.equal(weatherFoldLine('Rennes', '2026-11-19T15:00:00.000Z', true, at), 'Rennes · mise à jour le 2026-11-19 · données anciennes');
});

test('n° 15, F460 : l’état d’un jardin sur sa ligne compacte', () => {
  assert.deepEqual(gardenState({ effectiveNeedMm: null, priorityCounts: { high: 2 } }), { text: 'à compléter', tone: 'unknown' });
  assert.deepEqual(gardenState({ effectiveNeedMm: 0, priorityCounts: { high: 1 } }), { text: 'couvert', tone: 'covered' });
  assert.deepEqual(gardenState({ effectiveNeedMm: 12, priorityCounts: { high: 1 } }), { text: '1 haute', tone: 'high' });
  assert.deepEqual(gardenState({ effectiveNeedMm: 12, priorityCounts: { high: 0 } }), { text: '', tone: 'normal' });
});

test('n° 15, F460 : les trois plis à ancre de la semaine, « À planifier » d’abord, le reste « Pour les experts »', () => {
  const water = readFileSync('app/irrigation/water-management-dashboard.tsx', 'utf8');
  for (const id of ['objectifs-de-la-semaine', 'meteo-de-reference', 'manual-rain']) {
    assert.match(water, new RegExp(`<AnchoredFold\\s+id="${id}"`), id);
  }
  assert.match(water, /initiallyOpen=\{weatherNeedsAttention\}/, 'une météo en défaut ouvre son pli');
  const needs = readFileSync('app/irrigation/irrigation-needs-dashboard.tsx', 'utf8');
  const primary = needs.indexOf('<div className="need-primary"><span><small>À planifier');
  const experts = needs.indexOf('<details className="need-experts"><summary>Pour les experts</summary>');
  assert.ok(primary > 0 && experts > primary, '« À planifier » puis « Pour les experts »');
  assert.ok(needs.indexOf('Besoin effectif <HelpButton', experts) > experts, 'le besoin effectif chez les experts');
  const css = readFileSync('app/irrigation/irrigation.css', 'utf8');
  assert.ok(css.indexOf('pages-courtes.css') < css.indexOf('gestes-surs.css'), 'les gestes sûrs restent les derniers');
});

// n° 15 — « Matériel » en trois onglets (PR 6, F461).

test('n° 15, F461 : l’onglet se lit dans l’adresse, le plan par défaut, et un lien y mène', () => {
  assert.equal(parseMaterielTab(undefined), 'plan');
  assert.equal(parseMaterielTab('materiel'), 'materiel');
  assert.equal(parseMaterielTab(['groupes', 'plan']), 'groupes');
  assert.equal(parseMaterielTab('inconnu'), 'plan');
  assert.equal(pageHref('materiel', { season: 2026, tab: 'materiel' }), '/irrigation/materiel?season=2026&onglet=materiel');
});

test('n° 15, F461 : un nom coupé au milieu garde sa fin, et les deux parties rendent le nom', () => {
  const noms = ['Goutte-à-goutte du carré 1', 'Goutte-à-goutte du carré 2', 'Goutte-à-goutte du carré 3'];
  const fins = noms.map((nom) => middleCutParts(nom).tail);
  assert.equal(new Set(fins).size, 3, 'trois fins distinctes');
  for (const nom of noms) {
    const { head, tail } = middleCutParts(nom);
    assert.equal(head + tail, nom);
    assert.equal(tail, nom.slice(-8));
  }
  assert.deepEqual(middleCutParts('gag2'), { head: 'gag2', tail: '' }, 'un nom court ne se coupe pas');
});

test('n° 15, F461 : le résumé d’un jardin replié', () => {
  assert.equal(plotFoldSummary(1, 0), '1 planche · aucun matériel');
  assert.equal(plotFoldSummary(3, 2), '3 planches · 2 matériels');
});

test('n° 15, F461 : les trois panneaux à onglets, cachés et non retirés ; poser montre le plan', () => {
  const browser = readFileSync('app/irrigation/hierarchy-browser.tsx', 'utf8');
  for (const id of ['plan', 'materiel', 'groupes']) {
    assert.match(browser, new RegExp(`id="materiel-panel-${id}" role="tabpanel" aria-labelledby="materiel-tab-${id}" hidden=\\{shownTab !== '${id}'\\}`), id);
  }
  assert.match(browser, /const shownTab: MaterielTab = placementEditor \? 'plan' : tab;/);
  assert.ok(browser.indexOf('<CoverageOverview') < browser.indexOf('id="materiel-panel-materiel"'), '« Aperçu instantané » avec le plan');
});

// n° 15 — « Arrosages » et « Historique » : le premier geste plus haut (PR 7, F462).

// L'encart « Résultat calculé » n'existe plus (simplification S5, section 6, D-333) : la phrase du
// résultat ne paraît qu'avec un matériel et une durée (tests/simplification-s5-arroser.test.ts) ;
// la règle de F462 qui tient encore, le bouton et la réponse toujours rendus, se lit sur le squelette.
test('n° 15, F462 : le bouton et la réponse du module restent hors de l’attente', () => {
  const form = readFileSync('app/irrigation/irrigation-manager/watering-form.tsx', 'utf8');
  const start = form.indexOf('<div className="watering-start">');
  assert.ok(start > 0);
  const tail = form.slice(start);
  assert.ok(tail.includes('className="start-irrigation-button"'), 'le bouton, toujours rendu');
  assert.ok(tail.includes('{reply}'), 'la réponse du lot G (F404) toujours rendue');
  assert.doesNotMatch(tail.slice(0, tail.indexOf('{reply}')), /\{sentence \?/, 'ni l’un ni l’autre n’attend la phrase du résultat');
});

test('n° 15, F462 : le pli « Filtrer » dit le périmètre ; l’export suit les chiffres', () => {
  assert.equal(historyFilterSummary('farm', 'Ferme de test'), 'toute la ferme');
  assert.equal(historyFilterSummary('plot', 'Tunnel 1'), 'Tunnel 1');
  const history = readFileSync('app/irrigation/irrigation-history-dashboard.tsx', 'utf8');
  assert.ok(history.indexOf('className="history-summary-grid"') < history.indexOf('className="history-export-button"'), 'l’export après les chiffres');
  assert.ok(history.indexOf('history-filter-fold') < history.indexOf('<span>Parcelle</span>'), 'les filtres dans le pli');
});
