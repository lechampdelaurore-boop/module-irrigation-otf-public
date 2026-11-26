import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { SIMPLE_WORDS, TECHNICAL_WORDS } from '../lib/domain/simple-words.ts';
import { weekTotalsLine } from '../lib/domain/besoins-phone.ts';
import { FEATURES } from '../lib/domain/features/catalogue.ts';
import { TOURS, allStepWords } from '../lib/domain/demo/tours.ts';

/**
 * Simplifier l'usage du module, lot S1, PR 2 : les mots
 * (docs/simplification-s1-contract.md, section 4 ; D-328). Le tableau des
 * mots, accepté tel quel par le porteur, vit dans `lib/domain/simple-words.ts`.
 */

test('le tableau des mots, tel qu’accepté par le porteur le 25 novembre 2026', () => {
  assert.equal(SIMPLE_WORDS.weekGoal, 'Eau visée cette semaine');
  assert.equal(SIMPLE_WORDS.stillMissing, 'Il manque encore');
  assert.equal(SIMPLE_WORDS.leftToWater, 'Ce qu’il reste à arroser');
  assert.equal(SIMPLE_WORDS.enoughWater, 'Y a-t-il assez d’eau ?');
  assert.equal(SIMPLE_WORDS.usableWater, 'Eau utilisable');
  assert.equal(SIMPLE_WORDS.soilHolds, 'Ce que votre sol retient');
  assert.equal(SIMPLE_WORDS.thirstOfDay, 'Soif du jour');
  assert.equal(SIMPLE_WORDS.lookalikeCrop, 'À quelle culture ressemble cette espèce ?');
  assert.equal(SIMPLE_WORDS.cropFineSettings, 'Réglages fins des cultures (pour les experts)');
  assert.equal(SIMPLE_WORDS.hourlyApplication, 'Ce que ce matériel apporte en une heure');
  assert.equal(SIMPLE_WORDS.noWateringHours, 'Heures où l’on n’arrose pas');
  assert.equal(SIMPLE_WORDS.stoppedRemainder, 'Ce qui reste d’un arrosage arrêté');
});

/**
 * Règle 5 : le test de garde. Les endroits où un mot du calcul reste permis,
 * avec leur raison : le détail (une bulle « d'où vient ce chiffre »), un
 * repli de Réglages qui garde le nom tel qu'enregistré, une erreur technique,
 * l'export CSV (F828).
 */
const ALLOWED: readonly { file: string; word: (typeof TECHNICAL_WORDS)[number]; reason: string }[] = [
  { file: 'app/irrigation/irrigation-needs-dashboard.tsx', word: 'Objectif hydrique', reason: 'la bulle d’aide de la colonne, dans le détail d’une planche' },
  { file: 'lib/domain/change-journal/fields.ts', word: 'Culture de référence', reason: 'le journal des modifications, un repli de Réglages, garde le nom du réglage tel qu’enregistré' },
  { file: 'lib/domain/change-journal/subjects.ts', word: 'Objectif hydrique', reason: 'le journal des modifications, un repli de Réglages' },
  { file: 'lib/domain/change-journal/subjects.ts', word: 'Culture de référence', reason: 'le journal des modifications, un repli de Réglages' },
  { file: 'lib/domain/crop-water/records.ts', word: 'Culture de référence', reason: 'une erreur technique (un identifiant inconnu), jamais attendue d’un geste à l’écran' },
  { file: 'lib/domain/crop-water/sensitive-stages.ts', word: 'Culture de référence', reason: 'une erreur technique (un identifiant inconnu)' },
  { file: 'lib/domain/irrigation-coverage.ts', word: 'Apport horaire', reason: 'la bulle « d’où vient ce chiffre », le détail' },
  { file: 'lib/domain/irrigation-history-csv.ts', word: 'Objectif hydrique', reason: 'les en-têtes de l’export CSV gardent leurs mots (F828)' },
  { file: 'lib/domain/water-resources.ts', word: 'Reliquat', reason: 'le solde d’un bilan d’eau dans le détail de la faisabilité, pas le reste d’un arrosage' },
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

/** Une ligne de commentaire ne s'affiche pas. */
function isComment(line: string): boolean {
  const text = line.trim();
  return text.startsWith('*') || text.startsWith('//') || text.startsWith('/*') || text.startsWith('{/*');
}

test('règle 5 : aucun mot du calcul de la colonne de gauche ne reparaît à l’écran hors des endroits permis', () => {
  const found: string[] = [];
  for (const file of [...sourceFiles('app'), ...sourceFiles('lib/domain')]) {
    if (file === path.join('lib', 'domain', 'simple-words.ts')) continue;
    readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (isComment(line)) return;
      for (const word of TECHNICAL_WORDS) {
        if (!line.includes(word)) continue;
        if (ALLOWED.some((allowed) => allowed.file === file.split(path.sep).join('/') && allowed.word === word)) continue;
        found.push(`${file}:${index + 1} « ${word} »`);
      }
    });
  }
  assert.deepEqual(found, []);
  // Chaque permission sert encore : une permission devenue inutile se retire.
  for (const allowed of ALLOWED) {
    assert.ok(readFileSync(allowed.file, 'utf8').includes(allowed.word), `${allowed.file} : « ${allowed.word} » (${allowed.reason})`);
  }
});

test('règle 1 : les titres et les étiquettes prennent leur mot dans le module des mots, sans le recopier', () => {
  const uses: readonly [string, keyof typeof SIMPLE_WORDS][] = [
    ['app/irrigation/water-management-dashboard.tsx', 'weekGoal'],
    // Les tuiles de résumé vivent dans leur composant, partagé avec « Comprendre ces chiffres » (S4, PR 3).
    ['app/irrigation/water-summary-tiles.tsx', 'weekGoal'],
    ['app/irrigation/water-summary-tiles.tsx', 'thirstOfWeek'],
    ['app/irrigation/today/today-week.tsx', 'weekGoal'],
    ['app/irrigation/today/today-week.tsx', 'stillMissing'],
    ['app/irrigation/irrigation-needs-dashboard.tsx', 'leftToWater'],
    ['app/irrigation/irrigation-feasibility-dashboard.tsx', 'enoughWater'],
    ['app/irrigation/water-resource-manager.tsx', 'usableWater'],
    ['lib/domain/pumps.ts', 'usableWater'],
    ['app/irrigation/crop-water/crop-coefficients-panel.tsx', 'lookalikeCrop'],
    ['app/irrigation/crop-water/crop-coefficients-panel.tsx', 'lookalikeCrops'],
    ['app/irrigation/crop-water/crop-coefficients-panel.tsx', 'cropFineSettings'],
    ['app/irrigation/hierarchy/selected-bed-details.tsx', 'hourlyApplication'],
    ['app/irrigation/planning/protected-slots-section.tsx', 'noWateringHours'],
    ['lib/domain/planning/action-summary.ts', 'noWateringHours'],
    ['lib/domain/today/now-irrigations.ts', 'stoppedRemainder'],
    ['app/irrigation/irrigation-history-dashboard.tsx', 'thirstOfPeriod'],
  ];
  for (const [file, key] of uses) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, new RegExp(`SIMPLE_WORDS\\.${key}\\b`), `${file} prend « ${SIMPLE_WORDS[key]} » dans le module`);
    assert.ok(!source.includes(SIMPLE_WORDS[key]), `${file} ne recopie pas « ${SIMPLE_WORDS[key]} »`);
  }
});

test('l’ET0 : au premier niveau, la soif ; « ET0 » reste dans le détail', () => {
  const line = weekTotalsLine({ objective: { objectiveMm: 25, withObjective: 4, total: 4 }, realizedIrrigationMm: 12, actualRainMm: 3.5, remainingForecastRainMm: 5, et0Mm: 18.2, partial: true });
  assert.match(line, /soif de la semaine 18,2 mm/);
  assert.doesNotMatch(line, /ET0|totaux partiels/);
  assert.match(line, /totaux incomplets$/);
  // Les tuiles de la semaine, partagées par le détail et « Comprendre ces chiffres » (S4, PR 3).
  const besoins = readFileSync('app/irrigation/water-summary-tiles.tsx', 'utf8');
  assert.match(besoins, /label=\{SIMPLE_WORDS\.thirstOfWeek\}[^\n]*detail=\{`ET0, l’évaporation de référence\./, 'le mot du calcul dans le détail de la tuile');
  assert.doesNotMatch(besoins, /label="Évaporation de la semaine \(ET0\)"/);
  assert.match(readFileSync('app/irrigation/water-management-dashboard.tsx', 'utf8'), /<WaterSummaryTiles /);
  assert.doesNotMatch(readFileSync('app/irrigation/irrigation-history-dashboard.tsx', 'utf8'), /label="ET0"/);
});

test('règle 6 : l’écran de bienvenue et la visite guidée parlent avec les mêmes mots', () => {
  const texts = [
    ...FEATURES.flatMap((feature) => [feature.label, feature.summary]),
    ...TOURS.flatMap((tour) => [tour.title, tour.summary, ...tour.steps.flatMap(allStepWords).flatMap((words) => [words.title, words.text])]),
  ];
  for (const text of texts) {
    for (const word of [...TECHNICAL_WORDS, 'coefficients culturaux', 'profils racinaires', 'créneaux protégés', 'faisabilité']) {
      assert.ok(!text.toLocaleLowerCase('fr-FR').includes(word.toLocaleLowerCase('fr-FR')), `« ${text} » dit « ${word} »`);
    }
  }
});
