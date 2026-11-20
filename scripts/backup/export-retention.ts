/**
 * Combien de temps l'exploitant garde les exports chiffrés (4.5, PR 5 ;
 * docs/tranche-4-contract.md, 10 bis.20, F657). Un export garde aussi les
 * données d'une ferme effacée depuis : la page de confidentialité promet
 * qu'aucun n'est gardé plus de cinq semaines.
 *
 * La commande de l'export tient cette promesse elle-même : après un export
 * vérifié (relu, déchiffré à l'identique, sans problème), elle efface du même
 * dossier les exports faits 25 jours ou plus avant lui. 25, c'est 35 jours
 * moins les 10 jours après lesquels la tâche « Export de la base hors de
 * Cloudflare » passe en rouge (F624) : tant que l'export n'est pas en
 * rouge, aucun ne passe cinq semaines ; à un export par semaine, le dossier
 * en garde quatre. Elle n'efface que les fichiers qu'elle a nommés elle-même
 * (le nom dit le jour), jamais l'export qu'elle vient d'écrire, jamais un
 * export daté après lui, jamais un lien ni un dossier.
 */
import { lstatSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { taskDeclaration } from '../../lib/domain/operations/task-registry.ts';
import { HOURS_PER_DAY } from '../../lib/domain/units.ts';
import { addDaysToDateKey } from '../../lib/domain/water-management.ts';

/** La promesse de la page de confidentialité : cinq semaines au plus. */
export const EXPORT_KEPT_MAX_DAYS = 35;

/** Les jours après lesquels l'export manqué passe en rouge (F624). */
const EXPORT_BROKEN_AFTER_DAYS = taskDeclaration('offsite-export').brokenAfterHours / HOURS_PER_DAY;

/** Un export part au premier export vérifié fait ce nombre de jours (ou plus) après lui. */
export const EXPORT_REPLACED_AFTER_DAYS = EXPORT_KEPT_MAX_DAYS - EXPORT_BROKEN_AFTER_DAYS;

/** Le nom que la commande donne à un export (`exportFileName`), et son jour à Paris. */
const EXPORT_NAME = /^module-irrigation-export-(\d{4}-\d{2}-\d{2})-\d{2}h\d{2}\.chiffre$/;

/** Le jour d'un export, lu dans son nom ; `null` pour un fichier que la commande n'a pas nommé. */
export function exportDayOf(fileName: string): string | null {
  return EXPORT_NAME.exec(fileName)?.[1] ?? null;
}

/**
 * Les exports du dossier de `keptFile` faits `EXPORT_REPLACED_AFTER_DAYS`
 * jours ou plus avant lui, par nom, dans l'ordre des jours. Seuls des
 * fichiers ordinaires portant le nom de la commande ; jamais `keptFile`.
 */
export function replacedExports(keptFile: string): string[] {
  const keptDay = exportDayOf(path.basename(keptFile));
  if (keptDay === null) throw new Error('L’export gardé ne porte pas le nom que lui donne la commande.');
  const limit = addDaysToDateKey(keptDay, -EXPORT_REPLACED_AFTER_DAYS);
  const directory = path.dirname(keptFile);
  return readdirSync(directory)
    .filter((name) => {
      const day = exportDayOf(name);
      return day !== null && day <= limit && name !== path.basename(keptFile)
        && lstatSync(path.join(directory, name)).isFile();
    })
    .sort();
}

export type ExportRemoval = { removed: string[]; notRemoved: string[] };

/** Efface les exports remplacés ; un fichier qui ne s'efface pas (ouvert ailleurs) est dit, sans arrêter les autres. */
export function removeReplacedExports(keptFile: string): ExportRemoval {
  const directory = path.dirname(keptFile);
  const removal: ExportRemoval = { removed: [], notRemoved: [] };
  for (const name of replacedExports(keptFile)) {
    try {
      unlinkSync(path.join(directory, name));
      removal.removed.push(name);
    } catch {
      removal.notRemoved.push(name);
    }
  }
  return removal;
}

/** Ce que la commande en dit : des noms de fichiers, aucune donnée. */
export function removalLines(removal: ExportRemoval): string[] {
  const lines: string[] = [];
  if (removal.removed.length > 0) {
    lines.push(`Exports de ${EXPORT_REPLACED_AFTER_DAYS} jours ou plus, effacés de ce dossier (cinq semaines au plus, comme le promet la page de confidentialité) :`);
    for (const name of removal.removed) lines.push(`  ${name}`);
    lines.push('Effacez aussi ces mêmes fichiers là où vous copiez les exports (clé USB, disque externe, stockage en ligne).');
  }
  if (removal.notRemoved.length > 0) {
    lines.push('À FAIRE : ces exports trop anciens n’ont pas pu être effacés (ouverts ailleurs ?) ; l’export du jour reste bon, mais effacez-les vous-même :');
    for (const name of removal.notRemoved) lines.push(`  ${name}`);
  }
  return lines;
}
