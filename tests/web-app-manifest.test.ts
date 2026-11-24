import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

/**
 * Le module s'installe sur un téléphone comme une application (D-302). Chrome
 * pour Android ne le propose que si le manifeste nomme une page de départ, un
 * affichage sans barre d'adresse et des icônes PNG de 192 et 512 pixels ; une
 * icône SVG seule ne suffit pas. Ces tests figent ce que le manifeste promet
 * et vérifient que chaque image qu'il nomme existe, à la taille annoncée.
 */

const PUBLIC_DIRECTORY = 'public';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface WebAppManifest {
  id?: string;
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  icons?: ManifestIcon[];
}

function readManifest(): WebAppManifest {
  return JSON.parse(readFileSync(join(PUBLIC_DIRECTORY, 'manifest.webmanifest'), 'utf8')) as WebAppManifest;
}

/** Signature des fichiers PNG (8 octets), puis l'en-tête IHDR qui porte largeur et hauteur. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_WIDTH_OFFSET_BYTES = 16;
const PNG_HEIGHT_OFFSET_BYTES = 20;

function pngSizePx(path: string): { widthPx: number; heightPx: number } {
  const bytes = readFileSync(path);
  assert.ok(bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), `${path} n'est pas un PNG`);
  return { widthPx: bytes.readUInt32BE(PNG_WIDTH_OFFSET_BYTES), heightPx: bytes.readUInt32BE(PNG_HEIGHT_OFFSET_BYTES) };
}

function pngIcons(manifest: WebAppManifest): ManifestIcon[] {
  return (manifest.icons ?? []).filter((icon) => icon.type === 'image/png');
}

function purposes(icon: ManifestIcon): string[] {
  return (icon.purpose ?? 'any').split(/\s+/);
}

test('le manifeste nomme la page de départ et un affichage d’application', () => {
  const manifest = readManifest();
  assert.equal(manifest.id, '/irrigation');
  assert.equal(manifest.start_url, '/irrigation');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name && manifest.short_name);
});

test('le manifeste porte des icônes PNG de 192 et 512 pixels pour tout usage, et une icône à masque', () => {
  const icons = pngIcons(readManifest());
  const anySizes = icons.filter((icon) => purposes(icon).includes('any')).map((icon) => icon.sizes);
  assert.ok(anySizes.includes('192x192'), 'icône PNG 192 × 192 « any » absente');
  assert.ok(anySizes.includes('512x512'), 'icône PNG 512 × 512 « any » absente');
  assert.ok(
    icons.some((icon) => purposes(icon).includes('maskable')),
    'icône PNG « maskable » absente : Android la rognerait en cercle sans marge',
  );
});

test('une icône ne sert jamais à la fois de « any » et de « maskable »', () => {
  // Une même image ne peut pas être à la fois pleine (any) et réduite à la zone
  // sûre du masque (maskable) : l'une des deux serait mal rognée.
  for (const icon of readManifest().icons ?? []) {
    const declared = purposes(icon);
    assert.ok(!(declared.includes('any') && declared.includes('maskable')), icon.src);
  }
});

test('chaque image PNG du manifeste existe dans public/ et a la taille annoncée', () => {
  for (const icon of pngIcons(readManifest())) {
    assert.ok(icon.src.startsWith('/'), icon.src);
    const [widthPx, heightPx] = icon.sizes.split('x').map(Number);
    assert.deepEqual(pngSizePx(join(PUBLIC_DIRECTORY, icon.src)), { widthPx, heightPx }, icon.src);
  }
});

test('l’icône d’iPhone est un PNG de 180 pixels', () => {
  assert.deepEqual(pngSizePx(join(PUBLIC_DIRECTORY, 'apple-touch-icon.png')), { widthPx: 180, heightPx: 180 });
});
