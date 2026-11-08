import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const APP_DIRECTORY = 'app';

/**
 * Les noms que le cadre (Next, repris par vinext) lit comme des fichiers de
 * métadonnées quand ils se trouvent sous `app/` : un composant nommé ainsi
 * devient une route d'image et la page y renvoie par une balise `<link>`. Le
 * 7 novembre 2026, `app/irrigation/icon.tsx` (le composant des icônes au trait)
 * a ainsi fait demander `/irrigation/icon` à chaque page, une image qui
 * n'existe pas (erreur 404).
 */
const METADATA_FILE_NAME = /^(favicon|icon\d*|apple-icon\d*|opengraph-image\d*|twitter-image\d*|sitemap|robots|manifest)(\.alt)?\.[a-z]+$/;

/**
 * Le module n'a aucun fichier de métadonnées sous `app/` : son manifeste et ses
 * images sont dans `public/` et déclarés par `app/layout.tsx`. Un fichier voulu
 * s'ajoute ici, avec sa raison.
 */
const INTENDED_METADATA_FILES: string[] = [];

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

test('aucun fichier de app/ ne porte un nom que le cadre lit comme une métadonnée', () => {
  const metadataFiles = filesUnder(APP_DIRECTORY)
    .filter((path) => METADATA_FILE_NAME.test(path.split('/').at(-1) ?? ''))
    .sort();

  assert.deepEqual(metadataFiles, INTENDED_METADATA_FILES);
});

test('le motif reconnaît les noms de métadonnées et laisse passer les autres', () => {
  for (const name of ['icon.tsx', 'icon1.png', 'apple-icon.tsx', 'opengraph-image.alt.txt', 'favicon.ico', 'manifest.ts', 'robots.txt']) {
    assert.ok(METADATA_FILE_NAME.test(name), name);
  }
  for (const name of ['line-icon.tsx', 'icons.tsx', 'icon-button.tsx', 'page.tsx', 'irrigation.css']) {
    assert.ok(!METADATA_FILE_NAME.test(name), name);
  }
});
