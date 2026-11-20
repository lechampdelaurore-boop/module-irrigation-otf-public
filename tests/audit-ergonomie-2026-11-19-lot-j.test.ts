import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pageLabel } from '../lib/domain/features/pages.ts';

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
