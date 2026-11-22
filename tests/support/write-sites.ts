/**
 * Les endroits du code qui écrivent dans la base (amélioration n° 7, §5.4 ;
 * F717) : chaque `INSERT INTO`, `UPDATE` ou `DELETE FROM` d'une table nommée
 * en clair, rangé sous la fonction de premier niveau qui le contient, sous la
 * forme « fichier › fonction › table » de `db/change-journal/inventory.ts`.
 *
 * Les écritures dont la table est calculée (l'effacement d'une ferme, les
 * purges de conservation, l'import d'un export) n'ont pas de table nommée :
 * elles parcourent toutes les tables d'un plan, sans jamais changer un
 * réglage ; elles ne sont pas relevées.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SOURCE_ROOTS = ['db', 'lib', 'app'];
const SOURCE_FILE = /\.tsx?$/;
const DECLARATION = /^(?:export )?(?:async )?function\s+(\w+)|^(?:export )?const\s+(\w+)\s*=/gm;
const WRITE = /(?:INSERT(?: OR [A-Z]+)? INTO|UPDATE|DELETE FROM)\s+["`]?([a-z_]+)/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const entry = path.join(directory, name);
    if (statSync(entry).isDirectory()) return sourceFiles(entry);
    return SOURCE_FILE.test(name) && !name.endsWith('.d.ts') ? [entry] : [];
  });
}

export type WriteSite = { file: string; fn: string; table: string; body: string };

/** Les écritures du code, une par « fichier › fonction › table », avec le texte de la fonction. */
export function writeSites(root = '.'): WriteSite[] {
  const sites = new Map<string, WriteSite>();
  for (const directory of SOURCE_ROOTS) {
    for (const file of sourceFiles(path.join(root, directory))) {
      const source = readFileSync(file, 'utf8');
      const declarations = [...source.matchAll(DECLARATION)].map((match) => ({ index: match.index, name: match[1] ?? match[2] }));
      for (const match of source.matchAll(WRITE)) {
        const position = declarations.findLastIndex((declaration) => declaration.index < match.index);
        const declaration = declarations[position];
        const name = declaration?.name ?? '(module)';
        const body = source.slice(declaration?.index ?? 0, declarations[position + 1]?.index ?? source.length);
        const relative = path.relative(root, file).split(path.sep).join('/');
        sites.set(siteKey(relative, name, match[1]), { file: relative, fn: name, table: match[1], body });
      }
    }
  }
  return [...sites.values()];
}

export function siteKey(file: string, fn: string, table: string): string {
  return `${file} › ${fn} › ${table}`;
}
