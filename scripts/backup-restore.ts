/**
 * La restauration d'un export chiffré dans une base neuve (4.5, PR 4 ;
 * docs/tranche-4-contract.md, F561, scénario S2, et 10 bis.15) : quand la
 * base est perdue (compte perdu, base détruite) et que Time Travel ne peut
 * plus rien. Le geste est celui que l'essai de restauration joue en S2.
 *
 *   pnpm backup:restore <fichier .chiffre> --base <nom de la base neuve>
 *
 * L'export est déchiffré en mémoire et contrôlé ; la base nommée doit être
 * neuve ou vide (elle est créée si elle n'existe pas ; une base qui a des
 * tables est refusée, jamais écrasée) ; l'export y est importé, puis la base
 * est exportée à son tour et comparée, table par table. Le temps de l'envoi
 * seulement, l'export rangé pour l'import est écrit dans un dossier privé de
 * l'ordinateur, effacé aussitôt, même en cas d'échec : `wrangler d1 execute`
 * ne lit qu'un fichier.
 *
 * C'est un geste chez Cloudflare : il se fait sur la décision du porteur, avec
 * sa connexion à Wrangler, en suivant docs/exploitation.md (« Restaurer
 * depuis un export »). La sortie ne dit que des nombres et des noms.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { wranglerD1Operations } from './backup/d1-operations.ts';
import { decryptExport } from './backup/export-crypto.ts';
import { repositoryRoot } from './backup/export-files.ts';
import { askHidden } from './backup/passphrase-prompt.ts';
import { assertRestoreTarget, importIntoEmptyBase } from './backup/restore-import.ts';

const say = (line = '') => process.stdout.write(`${line}\n`);

function parseArguments(argv: readonly string[]): { file: string; database: string } {
  const rest = argv.filter((argument) => argument !== '--');
  const baseIndex = rest.indexOf('--base');
  const database = baseIndex >= 0 ? rest[baseIndex + 1] : undefined;
  const files = rest.filter((_argument, index) => index !== baseIndex && index !== baseIndex + 1);
  if (files.length !== 1 || !database) {
    throw new Error('Donnez le fichier et la base neuve : pnpm backup:restore <fichier .chiffre> --base <nom de la base neuve>');
  }
  assertRestoreTarget(database);
  return { file: files[0], database };
}

async function main(): Promise<number> {
  const { file, database } = parseArguments(process.argv.slice(2));
  const sealed = readFileSync(path.resolve(file));
  const passphrase = await askHidden('Mot de passe de cet export (rien ne s’affiche) : ');
  const plain = decryptExport(sealed, passphrase);
  // Un dossier vide, sans réglages de Wrangler : le nom donné ne désigne que la base de ce nom.
  const workDirectory = mkdtempSync(path.join(tmpdir(), 'restauration-wrangler-'));
  try {
    const operations = wranglerD1Operations({
      cwd: workDirectory,
      relay: (line) => process.stderr.write(`wrangler │ ${line}\n`),
      guard: assertRestoreTarget,
    });
    const outcome = await importIntoEmptyBase(operations, database, plain.toString('utf8'), {
      migrationsDir: path.join(repositoryRoot(), 'drizzle'),
      progress: (line) => process.stderr.write(`${line}\n`),
    });
    for (const line of outcome.lines) say(line);
    if (!outcome.ok) {
      say('PROBLÈME : la base n’est pas restaurée fidèlement. Ne la mettez pas en service ; copiez ces lignes à l’assistant.');
      return 1;
    }
    const applied = outcome.rebuilt?.inspection.migrations.applied ?? [];
    say(`Restauration réussie : ${applied.length} migrations reçues, la dernière : ${applied.at(-1) ?? 'aucune'}.`);
    say('La suite (docs/exploitation.md, « Restaurer depuis un export ») se fait avec l’assistant : brancher le module sur cette base, appliquer les migrations plus récentes, vérifier la page d’état.');
    return 0;
  } finally {
    plain.fill(0);
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

main().then(
  (code) => { process.exitCode = code; },
  (error: unknown) => {
    process.stderr.write(`\n${error instanceof Error ? error.message : 'Erreur inattendue.'}\n`);
    process.exitCode = 1;
  },
);
