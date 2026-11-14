import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Audit ergonomique final, lot C, gestes sûrs
 * (docs/audit-ergonomie-final-lot-c-contract.md). Les parcours P7, P10,
 * P31c et P35 mesurent la page peinte ; ces tests tiennent ce qui doit
 * rester vrai dans la feuille : sa place, la dernière, et la règle des
 * boutons indisponibles, lisible par ses seules couleurs.
 */
const entry = readFileSync('app/irrigation/irrigation.css', 'utf8');
const sheet = readFileSync('app/irrigation/styles/gestes-surs.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = readFileSync('app/globals.css', 'utf8');

function token(name: string): string {
  const value = tokens.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6}|[0-9a-f]{3});`))?.[1];
  assert.ok(value, `le jeton --${name} est une couleur écrite en chiffres`);
  return `#${value.length === 3 ? [...value].map((digit) => digit + digit).join('') : value}`;
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

test('la feuille des gestes sûrs est importée la dernière : ses règles passent après celles des blocs', () => {
  const imports = [...entry.matchAll(/@import '\.\/styles\/([^']+)';/g)].map((match) => match[1]);
  assert.equal(imports.at(-1), 'gestes-surs.css');
});

test('A3 : un bouton indisponible n’est plus transparent, et se lit à 4,5 pour 1 au moins (F239)', () => {
  const rule = sheet.match(/^button:disabled \{([\s\S]*?)\}/m)?.[1] ?? '';
  assert.match(rule, /opacity:\s*1 !important;/, 'aucune transparence');
  const background = rule.match(/background:\s*var\(--([\w-]+)\) !important;/)?.[1];
  const color = rule.match(/(?:^|\n)\s*color:\s*var\(--([\w-]+)\) !important;/)?.[1];
  assert.ok(background && color, 'le fond et le texte viennent des jetons de la charte');
  const ratio = contrast(token(color), token(background));
  assert.ok(ratio >= 4.5, `texte ${token(color)} sur ${token(background)} : ${ratio.toFixed(2)} pour 1`);
});

test('A3 : la pastille « Répartition validée » se lit à 4,5 pour 1 au moins (F240)', () => {
  const rule = sheet.match(/^\.arbitration-validated \{([\s\S]*?)\}/m)?.[1] ?? '';
  const background = rule.match(/background:\s*var\(--([\w-]+)\);/)?.[1];
  const color = rule.match(/(?:^|\n)\s*color:\s*var\(--([\w-]+)\);/)?.[1];
  assert.ok(background && color, 'le fond et le texte viennent des jetons de la charte');
  const ratio = contrast(token(color), token(background));
  assert.ok(ratio >= 4.5, `texte ${token(color)} sur ${token(background)} : ${ratio.toFixed(2)} pour 1`);
});
