import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

/**
 * La troisième passe de l'habillage (docs/charte-module.md, « Troisième
 * passe ») : cinq touches, en CSS pour l'essentiel (styles/finitions.css).
 * Ces tests tiennent ce qu'aucun autre contrôle ne voit : les icônes des
 * pastilles recopiées en image, et les titres qu'elles visent.
 */
const finitions = readFileSync('app/irrigation/styles/finitions.css', 'utf8');
const rules = finitions.replace(/\/\*[\s\S]*?\*\//g, '');
const phone = rules.match(/@media \(max-width: 760px\) \{([\s\S]*)\}\s*$/)?.[1] ?? '';
const lineIcons = readFileSync('app/irrigation/line-icon.tsx', 'utf8');
const iconPaths = new Map([...lineIcons.matchAll(/^\s+(\w+): '([^']+)',/gm)].map((match) => [match[1], match[2]]));

function tsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

const components = tsxFiles('app').map((path) => readFileSync(path, 'utf8')).join('\n');
const badges = [...finitions.matchAll(/^#([\w-]+) \{ --badge-icon: url\("data:image\/svg\+xml,[^"]*d='([^']+)'[^"]*"\); \}$/gm)]
  .map((match) => ({ id: match[1], path: match[2] }));

test('chaque pastille de titre reprend exactement une icône au trait du module', () => {
  assert.ok(badges.length >= 15, `au moins quinze titres ont leur pastille (trouvé : ${badges.length})`);
  const known = new Set(iconPaths.values());
  for (const badge of badges) {
    assert.ok(known.has(badge.path), `#${badge.id} : son icône diverge de line-icon.tsx`);
  }
});

test('chaque pastille vise un titre qui existe, et un titre de bloc', () => {
  for (const { id } of badges) {
    assert.match(components, new RegExp(`<h[23] id="${id}"`), `#${id} : aucun titre h2 ou h3 ne porte cet identifiant`);
  }
});

test('chaque titre à pastille est dans les trois listes : mise en ligne, pastille et téléphone', () => {
  const desktop = rules.slice(0, rules.indexOf('@media (max-width: 760px)'));
  for (const { id } of badges) {
    assert.match(desktop, new RegExp(`^#${id}::before(,| \\{)?$`, 'm'), `#${id} : sa pastille à l'ordinateur`);
    assert.match(phone, new RegExp(`#${id}::before\\b`), `#${id} : sa pastille rétrécie au téléphone`);
    assert.match(desktop, new RegExp(`^#${id}(,| \\{)$`, 'm'), `#${id} : le titre se met en ligne avec sa pastille`);
  }
});

test('l’étiquette « Nouveau » du bandeau est décorative', () => {
  const rule = finitions.match(/\.feature-banner p::before \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(rule, /content:\s*"Nouveau" \/ "";/, 'un texte de remplacement vide : le lecteur d’écran ne la lit pas');
});

test('le survol des cartes ne vaut qu’à la souris, et ne déplace rien', () => {
  const hover = finitions.match(/@media \(hover: hover\) \{([\s\S]*?)\n\}\n/)?.[1] ?? '';
  assert.match(hover, /:not\(\[open\]\):hover/, 'seule la carte fermée répond au survol');
  assert.doesNotMatch(rules, /transform|translate/, 'une transformation dérangerait les bulles d’aide des cartes');
});

test('les tuiles de totaux portent leur filet de couleur', () => {
  const rule = finitions.match(/\.feasibility-summary > div \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(rule, /border-top:\s*3px solid var\(--green-universe\)/);
  assert.match(readFileSync('app/globals.css', 'utf8'), /--green-universe:\s*#0f8c66;/, 'le vert de la pastille d’univers d’OTF');
});
