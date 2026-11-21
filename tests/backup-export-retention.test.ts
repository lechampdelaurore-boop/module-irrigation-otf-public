import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { exportFileName } from '../scripts/backup/export-files.ts';
import {
  EXPORT_KEPT_MAX_DAYS,
  EXPORT_REPLACED_AFTER_DAYS,
  exportDayOf,
  removalLines,
  removeReplacedExports,
  replacedExports,
} from '../scripts/backup/export-retention.ts';
import { taskDeclaration } from '../lib/domain/operations/task-registry.ts';

/**
 * La conservation des exports chiffrés (4.5, PR 5 ; docs/tranche-4-contract.md,
 * 10 bis.20, F657) : après un export vérifié, la commande efface du même
 * dossier les exports faits 25 jours ou plus avant lui ; tant que la tâche
 * de l'export n'est pas en rouge, aucun n'est gardé plus de cinq semaines,
 * ce que promet la page de confidentialité ; elle ne touche à rien d'autre.
 */

const scratch = mkdtempSync(path.join(tmpdir(), 'essai-conservation-exports-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

let folders = 0;
function folder(): string {
  folders += 1;
  const directory = path.join(scratch, `dossier-${folders}`);
  mkdirSync(directory);
  return directory;
}

/** Un export fait ce jour-là à 21 h 30, heure de Paris, comme l'écrit la commande. */
function writeExport(directory: string, day: string): string {
  const file = path.join(directory, `module-irrigation-export-${day}-21h30.chiffre`);
  writeFileSync(file, 'chiffré');
  return file;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
const dayAfter = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

test('25 jours : les cinq semaines promises, moins les dix jours après lesquels l’export manqué passe en rouge', () => {
  assert.equal(EXPORT_KEPT_MAX_DAYS, 35);
  assert.equal(taskDeclaration('offsite-export').brokenAfterHours, 10 * 24);
  assert.equal(EXPORT_REPLACED_AFTER_DAYS, 25);
});

test('le jour d’un export se lit dans le nom que lui donne la commande, et seulement dans celui-là', () => {
  assert.equal(exportDayOf(exportFileName(new Date('2026-11-20T20:30:00.000Z'))), '2026-11-20');
  assert.equal(exportDayOf(exportFileName(new Date('2026-03-28T23:30:00.000Z'))), '2026-03-29', 'le jour de Paris, pas celui de Greenwich');
  for (const other of [
    'module-irrigation-export-2026-10-01-21h30 (1).chiffre',
    'module-irrigation-export-2026-10-01-21h30.chiffre.bak',
    'Copie de module-irrigation-export-2026-10-01-21h30.chiffre',
    'module-irrigation-export-2026-10-01.chiffre',
    'notes.txt',
  ]) assert.equal(exportDayOf(other), null, other);
});

test('à un export par semaine, le dossier en garde quatre ; à un export tous les 7 à 10 jours, aucun ne passe cinq semaines', () => {
  for (const gaps of [[7], [10], [7, 10, 8, 9, 10, 7, 10, 10, 8]]) {
    const directory = folder();
    const born = new Map<string, string>();
    let day = '2026-08-03';
    for (let week = 0; week < 20; week += 1) {
      const file = writeExport(directory, day);
      born.set(path.basename(file), day);
      const { removed, notRemoved } = removeReplacedExports(file);
      assert.deepEqual(notRemoved, []);
      for (const name of removed) {
        assert.ok(daysBetween(born.get(name)!, day) <= EXPORT_KEPT_MAX_DAYS, `${name} effacé le ${day}, au plus cinq semaines après`);
      }
      for (const name of readdirSync(directory)) {
        assert.ok(daysBetween(born.get(name)!, day) < EXPORT_REPLACED_AFTER_DAYS, `${name} gardé le ${day}`);
      }
      if (gaps.length === 1 && gaps[0] === 7 && week >= 3) assert.equal(readdirSync(directory).length, 4, `semaine ${week}`);
      day = dayAfter(day, gaps[week % gaps.length]);
    }
  }
});

test('la limite au jour près, d’un mois à l’autre et au passage à l’heure d’hiver', () => {
  const directory = folder();
  const kept = writeExport(directory, '2026-11-20');
  writeExport(directory, '2026-10-25');
  writeExport(directory, '2026-10-26');
  writeExport(directory, '2026-10-27');
  assert.deepEqual(replacedExports(kept), [
    'module-irrigation-export-2026-10-25-21h30.chiffre',
    'module-irrigation-export-2026-10-26-21h30.chiffre',
  ], '26 et 25 jours avant : effacés ; 24 jours : gardé');
});

test('rien d’autre n’est effacé : ni l’export du jour, ni un export daté après lui, ni un fichier renommé, un dossier ou un lien', () => {
  const directory = folder();
  const kept = writeExport(directory, '2026-11-20');
  writeFileSync(path.join(directory, 'module-irrigation-export-2026-11-20-07h05.chiffre'), 'le même jour, plus tôt');
  writeFileSync(path.join(directory, 'module-irrigation-export-2026-12-30-21h30.chiffre'), 'daté après : une horloge fausse');
  const others = [
    'module-irrigation-export-2026-09-01-21h30 (1).chiffre',
    'module-irrigation-export-2026-09-01-21h30.chiffre.bak',
    'notes.txt',
  ];
  for (const name of others) writeFileSync(path.join(directory, name), 'autre');
  mkdirSync(path.join(directory, 'module-irrigation-export-2026-09-02-21h30.chiffre'));
  const outside = path.join(scratch, 'hors-du-dossier.chiffre');
  writeFileSync(outside, 'ailleurs');
  symlinkSync(outside, path.join(directory, 'module-irrigation-export-2026-09-03-21h30.chiffre'));
  const old = writeExport(directory, '2026-09-04');
  const before = readdirSync(directory).sort();

  const removal = removeReplacedExports(kept);

  assert.deepEqual(removal, { removed: [path.basename(old)], notRemoved: [] });
  assert.deepEqual(readdirSync(directory).sort(), before.filter((name) => name !== path.basename(old)));
  assert.ok(existsSync(outside), 'le fichier visé par le lien reste');
  assert.throws(() => replacedExports(path.join(directory, 'notes.txt')), /nom que lui donne la commande/);
});

test('ce que dit la commande : des noms de fichiers, le rappel des copies, et ce qui reste à effacer à la main', () => {
  assert.deepEqual(removalLines({ removed: [], notRemoved: [] }), [], 'rien d’effacé : rien à dire');
  const said = removalLines({
    removed: ['module-irrigation-export-2026-10-01-21h30.chiffre'],
    notRemoved: ['module-irrigation-export-2026-10-08-21h30.chiffre'],
  });
  assert.match(said[0], /^Exports de 25 jours ou plus, effacés de ce dossier/);
  assert.equal(said[1], '  module-irrigation-export-2026-10-01-21h30.chiffre');
  assert.match(said[2], /Effacez aussi ces mêmes fichiers là où vous copiez les exports/);
  assert.match(said[3], /^À FAIRE : .*l’export du jour reste bon/);
  assert.equal(said[4], '  module-irrigation-export-2026-10-08-21h30.chiffre');
  assert.ok(said.every((line) => !/PROBLÈME/.test(line)), 'un export bon n’est jamais dit « PROBLÈME » : la procédure dirait de ne pas le noter');
});
