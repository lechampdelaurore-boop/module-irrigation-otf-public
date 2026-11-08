import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ESLint } from 'eslint';

/**
 * Cas négatifs et positifs des frontières entre zones (docs/boundaries-contract.md).
 * ESLint est exécuté sur des extraits placés virtuellement dans chaque zone : un
 * import interdit doit être refusé, un import permis doit passer.
 */
const RULE = '@typescript-eslint/no-restricted-imports';
let eslint: ESLint | null = null;

async function lint(filePath: string, code: string) {
  eslint ??= new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages;
}

async function restrictedImportErrors(filePath: string, code: string): Promise<string[]> {
  return (await lint(filePath, code))
    .filter((message) => message.ruleId === RULE && message.severity === 2)
    .map((message) => message.message);
}

const valueImport = (specifier: string) => `import { thing } from '${specifier}';\nexport const probe = thing;\n`;
const typeImport = (specifier: string) => `import type { Thing } from '${specifier}';\nexport type Probe = Thing;\n`;

test('lib/domain : refuse React, Next, l’exécution Cloudflare, les services, les adaptateurs, app/ et les valeurs de db/', async () => {
  const file = 'lib/domain/_probe.ts';
  for (const specifier of ['react', 'next/navigation', 'cloudflare:workers', '@/lib/services/irrigation-service', '../services/irrigation-service', '@/lib/adapters/otf/read-client', '@/app/access-auth', '@/db/workspace-repository', '../../db/workspace-repository']) {
    const errors = await restrictedImportErrors(file, valueImport(specifier));
    assert.equal(errors.length, 1, `import interdit non refusé : ${specifier}`);
    assert.match(errors[0], /boundaries-contract/, 'le message renvoie au contrat');
  }
});

test('lib/domain : accepte le domaine, et refuse db/ même en type (D-020)', async () => {
  const file = 'lib/domain/_probe.ts';
  assert.deepEqual(await restrictedImportErrors(file, valueImport('./irrigation-domain')), []);
  assert.deepEqual(await restrictedImportErrors(file, valueImport('@/lib/domain/weather/location')), []);
  // L'exception laissée par Q3 est levée : les enregistrements sont descendus
  // dans lib/domain, un import de db/ en type y est donc refusé comme un autre.
  assert.equal((await restrictedImportErrors(file, typeImport('@/db/irrigation-event/read'))).length, 1);
  assert.equal((await restrictedImportErrors('lib/domain/weather/_probe.ts', typeImport('../../../db/irrigation-event/read'))).length, 1);
  assert.equal((await restrictedImportErrors('lib/domain/weather/_probe.ts', valueImport('../../../db/irrigation-event/read'))).length, 1);
});

test('lib/adapters : refuse db/, les services et l’exécution ; accepte le domaine', async () => {
  const file = 'lib/adapters/_probe.ts';
  for (const specifier of ['@/db/workspace-repository', '@/lib/services/irrigation-service', 'cloudflare:workers', 'react']) {
    assert.equal((await restrictedImportErrors(file, valueImport(specifier))).length, 1, `import interdit non refusé : ${specifier}`);
  }
  assert.deepEqual(await restrictedImportErrors(file, valueImport('@/lib/domain/domain')), []);
  assert.deepEqual(await restrictedImportErrors('lib/adapters/otf/_probe.ts', valueImport('../../domain/otf/mapper')), []);
});

test('lib/services : refuse React, Next et app/ ; accepte db/, l’exécution et les adaptateurs', async () => {
  const file = 'lib/services/_probe.ts';
  for (const specifier of ['react', 'next/headers', '@/app/access-auth']) {
    assert.equal((await restrictedImportErrors(file, valueImport(specifier))).length, 1, `import interdit non refusé : ${specifier}`);
  }
  for (const specifier of ['@/db/workspace-repository', 'cloudflare:workers', '@/lib/adapters/weather/open-meteo-provider', '../domain/irrigation-needs']) {
    assert.deepEqual(await restrictedImportErrors(file, valueImport(specifier)), [], `import permis refusé : ${specifier}`);
  }
});

test('db/ : refuse app/, les services et les adaptateurs ; accepte le domaine et l’exécution', async () => {
  const file = 'db/_probe.ts';
  for (const specifier of ['@/app/access-auth', '@/lib/services/weather/automatic-sync', '@/lib/adapters/otf/read-client', 'react']) {
    assert.equal((await restrictedImportErrors(file, valueImport(specifier))).length, 1, `import interdit non refusé : ${specifier}`);
  }
  assert.deepEqual(await restrictedImportErrors(file, valueImport('@/lib/domain/irrigation-domain')), []);
  assert.deepEqual(await restrictedImportErrors(file, valueImport('cloudflare:workers')), []);
});

test('composants clients : db/ en type seulement, jamais l’exécution ; les pages serveur restent libres', async () => {
  const client = 'app/irrigation/_probe.tsx';
  assert.equal((await restrictedImportErrors(client, valueImport('@/db/equipment/read'))).length, 1);
  assert.equal((await restrictedImportErrors(client, valueImport('cloudflare:workers'))).length, 1);
  assert.deepEqual(await restrictedImportErrors(client, typeImport('@/db/equipment/read')), []);
  assert.deepEqual(await restrictedImportErrors('app/irrigation/page.tsx', valueImport('@/db/equipment/read')), [], 'une page serveur lit les dépôts');
  assert.deepEqual(await restrictedImportErrors('app/irrigation/equipment-actions.ts', valueImport('@/db/equipment/read')), [], 'une action serveur aussi');
});

test('taille des fichiers : un module de plus de 600 lignes fait échouer le lint', async () => {
  const longModule = Array.from({ length: 620 }, (_, index) => `export const line${index} = ${index};`).join('\n');
  const messages = await lint('lib/domain/_long.ts', longModule);
  const sizeErrors = messages.filter((message) => message.ruleId === 'max-lines');
  assert.equal(sizeErrors.length, 1);
  assert.equal(sizeErrors[0].severity, 2, 'erreur depuis la clôture de Q6');
  assert.deepEqual((await lint('db/schema.ts', longModule)).filter((message) => message.ruleId === 'max-lines'), [], 'le schéma est une exception listée');
});

test('taille des fichiers : aucun fichier du dépôt ne dépasse la limite', async () => {
  // La règle ne protège que si elle est tenue : ce test lit le dépôt réel, et
  // non un extrait, pour que la clôture de Q6 reste vraie demain.
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  const sources = ['app', 'db', 'lib', 'e2e'].flatMap(walk)
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts') && !file.endsWith(`db${path.sep}schema.ts`));

  const tooLong = sources
    .map((file) => ({ file, lines: readFileSync(file, 'utf8').split('\n').filter((line) => line.trim() !== '' && !line.trim().startsWith('//')).length }))
    .filter((entry) => entry.lines > 600);

  assert.deepEqual(tooLong, []);
});

test('unités : un facteur 1000, 3600 ou 60000 hors du module d’unités est refusé, les autres nombres non', async () => {
  const unitErrors = async (filePath: string, code: string) =>
    (await lint(filePath, code)).filter((message) => message.ruleId === 'no-restricted-syntax' && message.severity === 2);
  assert.equal((await unitErrors('lib/domain/_probe.ts', 'export const ms = 5 * 60_000;\n')).length, 1);
  assert.equal((await unitErrors('app/irrigation/_probe.ts', 'export const seconds = 2 * 3600;\n')).length, 1);
  assert.equal((await unitErrors('db/_probe.ts', 'export const liters = 3 * 1000.0;\n')).length, 1);
  assert.match((await unitErrors('lib/services/_probe.ts', 'export const ms = 2 * 1000;\n'))[0].message, /units\.ts/);
  assert.deepEqual(await unitErrors('lib/domain/units.ts', 'export const LITERS = 1000;\n'), [], 'le module d’unités est le seul endroit permis');
  assert.deepEqual(await unitErrors('tests/_probe.test.ts', 'export const liters = 1000;\n'), [], 'les tests restent libres');
  assert.deepEqual(await unitErrors('lib/domain/_probe.ts', 'export const n = 2000 + 250;\n'), [], 'les autres nombres ne sont pas visés');
  assert.deepEqual(await unitErrors('lib/domain/_probe.ts', 'export const notes = (text: string) => text.slice(0, 1000);\nexport const plausible = (mm: number) => mm <= 1000;\n'), [], '1000 comme borne de saisie ou de texte n’est pas un facteur');
  assert.equal((await unitErrors('lib/domain/_probe.ts', 'export const tolerance = Date.now() + 60_000;\n')).length, 1, '60 000 est toujours une durée en millisecondes');
});

test('tout .tsx de app/ hors page, layout et page introuvable est un composant client déclaré', () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  const components = walk('app').filter((file) => file.endsWith('.tsx') && !/[\\/](page|layout|not-found)\.tsx$/.test(file));
  const undeclared = components.filter((file) => !readFileSync(file, 'utf8').startsWith("'use client'"));
  assert.deepEqual(undeclared, [], 'la règle « db/ en type seulement » vise ces fichiers');

  // Les modules clients sans JSX extraits par Q6 (hooks, formats) sont visés
  // par la même règle ESLint : ils doivent porter la même déclaration.
  const modules = walk(path.join('app', 'irrigation', 'irrigation-manager')).filter((file) => file.endsWith('.ts'));
  assert.ok(modules.length > 0, 'le dossier des modules clients existe');
  assert.deepEqual(
    modules.filter((file) => !readFileSync(file, 'utf8').startsWith("'use client'")),
    [],
  );
});
