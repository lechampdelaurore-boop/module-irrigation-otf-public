import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pageLabel } from '../lib/domain/features/pages.ts';
import type { SeasonSpecies, SpeciesWithoutReference } from '../lib/domain/crop-water/species.ts';
import { withoutReferenceBeyondSpecies } from '../lib/domain/crop-water/species-linking.ts';

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
  assert.match(panel, /const SPECIES_FOLD_ANCHOR = 'correspondance-des-especes';/);
  assert.doesNotMatch(panel, /initiallyOpen/, 'fermé d’office');
});
