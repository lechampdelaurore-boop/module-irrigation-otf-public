import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const STYLES_DIRECTORY = 'app/irrigation/styles';

/**
 * La feuille est découpée par composant depuis Q6 ; ce test lit l'ensemble,
 * dans l'ordre où la page l'assemble, et n'a donc pas à savoir dans quel
 * fichier vit telle règle.
 */
const styleFiles = importedStyleFiles();
const stylesheet = styleFiles.map((name) => readFileSync(`${STYLES_DIRECTORY}/${name}`, 'utf8')).join('\n');

function importedStyleFiles(): string[] {
  const entry = readFileSync('app/irrigation/irrigation.css', 'utf8');
  return [...entry.matchAll(/@import '\.\/styles\/([^']+)';/g)].map((match) => match[1]);
}

test('la feuille de style ne contient que la liste de ses fichiers, dans l’ordre', () => {
  const entry = readFileSync('app/irrigation/irrigation.css', 'utf8');
  const withoutImports = entry.replace(/@import '\.\/styles\/[^']+';\n?/g, '').trim();

  assert.equal(withoutImports, '', 'aucune règle ne doit rester dans le point d’entrée');
  assert.deepEqual(
    [...styleFiles].sort(),
    readdirSync(STYLES_DIRECTORY).sort(),
    'chaque fichier de styles est importé, et aucun import ne désigne un fichier absent',
  );
});

test('aucun fichier de styles ne dépasse 600 lignes', () => {
  // ESLint ne lit pas le CSS : la limite du contrat se vérifie ici.
  const tooLong = styleFiles
    .map((name) => ({ name, lines: readFileSync(`${STYLES_DIRECTORY}/${name}`, 'utf8').split('\n').length }))
    .filter((file) => file.lines > 600);

  assert.deepEqual(tooLong, []);
});

test('les menus contextuels ont une cible tactile minimale de 44 pixels', () => {
  const planMenu = stylesheet.match(/\.plan-equipment-menu summary \{([\s\S]*?)\n\}/)?.[1];
  const inventoryMenu = stylesheet.match(/\.equipment-menu summary \{([\s\S]*?)\n\}/)?.[1];

  assert.match(planMenu ?? '', /width:\s*44px/);
  assert.match(planMenu ?? '', /min-height:\s*44px/);
  assert.match(inventoryMenu ?? '', /width:\s*44px/);
  assert.match(inventoryMenu ?? '', /height:\s*44px/);
});

test('une proposition validée dont l’irrigation est annulée se range avec les refusées, sa pastille se lit', () => {
  // Choix du porteur, 7 novembre 2026 : « comme une refusée, pastille visible » (détail de la recette 3.7).
  const card = stylesheet.match(/\.planning-proposal\[data-status="validated"\]\[data-irrigation="canceled"\] \{([\s\S]*?)\n\}/)?.[1];

  assert.match(card ?? '', /border-left-color:\s*var\(--line\)/, 'le trait gauche gris des refusées, plus le vert des validées');
  assert.match(card ?? '', /color:\s*var\(--muted\)/, 'le texte atténué des refusées');
});

test('les pastilles de ce qui ne compte plus se lisent : gris moyen et bordées, partout', () => {
  // Choix du porteur, 7 novembre 2026 : « toutes pareilles ».
  const selectors = [
    '.planning-status[data-status="expired"]',
    '.planning-status[data-status="refused"]',
    '.planning-status[data-status="replaced"]',
    '.planning-status[data-status="validated"][data-irrigation="canceled"]',
    '.event-status[data-status="canceled"]',
  ];
  const rules = [...stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((selector) => selector.trim()),
    body: match[2],
  }));
  for (const selector of selectors) {
    const own = rules.filter((rule) => rule.selectors.includes(selector));
    assert.ok(own.length > 0, `${selector} a sa règle`);
    const body = own.map((rule) => rule.body).join('\n');
    assert.match(body, /border:\s*1px solid var\(--line-strong\)/, `${selector} : une pastille bordée`);
    assert.match(body, /background:\s*var\(--line\)/, `${selector} : un fond gris moyen`);
    assert.doesNotMatch(body, /var\(--sheet\)/, `${selector} : plus le gris de la feuille, presque blanc sur la carte`);
  }
});

test('la documentation décrit la garde météo de la migration 0008', () => {
  const dataModel = readFileSync('docs/irrigation-data-model.md', 'utf8');

  assert.match(dataModel, /0008_weather_refresh_guard/);
  assert.match(dataModel, /last_refresh_attempt_at/);
  assert.match(dataModel, /refresh_not_before_at/);
});
