/**
 * Où va l'export chiffré, et ce que les commandes en disent (4.5, PR 4 ;
 * docs/tranche-4-contract.md, 10 bis.9, et 10 bis.14, F623). Le fichier va
 * hors du dépôt (le dépôt est public : jamais d'export dedans, même chiffré),
 * par défaut dans le dossier personnel de l'exploitant ; il n'écrase jamais
 * un export précédent. Les commandes ne disent que des nombres, des noms de
 * migrations et des empreintes, jamais une donnée.
 */
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FARM_TIME_ZONE } from '../../lib/domain/water-management.ts';
import type { ExportInspection } from './export-inspection.ts';

export const DEFAULT_DATABASE = 'module-irrigation-otf';
export const EXPORT_EXTENSION = '.chiffre';

export function repositoryRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function defaultExportDirectory(home = homedir()): string {
  return path.join(home, 'Sauvegardes module irrigation');
}

/** Le chemin réel du dossier, ou du plus proche parent qui existe, suivi du reste. */
function realPathOf(target: string): string {
  const resolved = path.resolve(target);
  if (existsSync(resolved)) return realpathSync(resolved);
  const parent = path.dirname(resolved);
  return parent === resolved ? resolved : path.join(realPathOf(parent), path.basename(resolved));
}

/** Refuse un dossier dans le dépôt : un `git add` de trop publierait l'export. */
export function assertOutsideRepository(directory: string, root = repositoryRoot()): void {
  const relative = path.relative(realPathOf(root), realPathOf(directory));
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error('L’export ne va jamais dans le dossier du dépôt, qui est public : choisissez un dossier hors du dépôt (par défaut, « Sauvegardes module irrigation » dans votre dossier personnel).');
  }
}

/** « module-irrigation-export-2026-11-20-21h30.chiffre », à l'heure de Paris. */
export function exportFileName(now: Date): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', {
    timeZone: FARM_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return `module-irrigation-export-${parts.year}-${parts.month}-${parts.day}-${parts.hour}h${parts.minute}${EXPORT_EXTENSION}`;
}

/** « 20/11/2026 », à l'heure de Paris : la date à noter sur la page d'état. */
export function parisDate(now: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: FARM_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString('fr-FR')} ${word}${count > 1 ? 's' : ''}`;
}

export function sizeWords(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('fr-FR')} ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

/** Ce que dit un contrôle d'export : des nombres, des noms de migrations, une empreinte ; jamais une valeur. */
export function inspectionLines(inspection: ExportInspection): string[] {
  const { applied, missingFromExport } = inspection.migrations;
  const lines = [
    `${plural(inspection.tables.length, 'table')}, ${plural(inspection.totalRows, 'ligne')} ; ${plural(applied.length, 'migration')} reçue${applied.length > 1 ? 's' : ''}${applied.length > 0 ? `, la dernière : ${applied[applied.length - 1]}` : ''}.`,
  ];
  if (inspection.digest) lines.push(`Empreinte de la base : ${inspection.digest.slice(0, 16)}`);
  if (missingFromExport.length > 0) {
    lines.push(`La base n’a pas encore reçu ${plural(missingFromExport.length, 'migration')} du dépôt (le site n’est pas encore à jour) : l’export reste bon.`);
  }
  for (const problem of inspection.problems) lines.push(`PROBLÈME : ${problem}`);
  return lines;
}
