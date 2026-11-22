/**
 * Le contrôle d'un export chiffré (4.5, PR 4 ; docs/tranche-4-contract.md,
 * F561, et 10 bis.14, F621) : déchiffré en mémoire, rejoué dans une base
 * vide, il dit s'il restaurerait la base fidèlement, sans montrer une donnée.
 *
 *   pnpm backup:verify <fichier .chiffre>
 *
 * À lancer quand on veut : après une mise à jour du dépôt, avant de compter
 * sur un vieil export, ou pour s'assurer qu'on se souvient du mot de passe.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { decryptExport } from './backup/export-crypto.ts';
import { inspectionLines, repositoryRoot } from './backup/export-files.ts';
import { inspectExport } from './backup/export-inspection.ts';
import { askHidden } from './backup/passphrase-prompt.ts';

const say = (line = '') => process.stdout.write(`${line}\n`);

async function main(): Promise<number> {
  const files = process.argv.slice(2).filter((argument) => argument !== '--');
  if (files.length !== 1) throw new Error('Donnez le fichier à contrôler : pnpm backup:verify <fichier .chiffre>');
  const sealed = readFileSync(path.resolve(files[0]));
  const passphrase = await askHidden('Mot de passe de cet export (rien ne s’affiche) : ');
  const plain = decryptExport(sealed, passphrase);
  try {
    const inspection = inspectExport(plain.toString('utf8'), path.join(repositoryRoot(), 'drizzle'));
    say(inspection.problems.length === 0
      ? 'Export déchiffré et contrôlé : rejoué dans une base vide, il restaure la base fidèlement.'
      : 'Export déchiffré, mais il ne restaurerait pas la base fidèlement :');
    for (const line of inspectionLines(inspection)) say(`  ${line}`);
    return inspection.problems.length === 0 ? 0 : 1;
  } finally {
    plain.fill(0);
  }
}

main().then(
  (code) => { process.exitCode = code; },
  (error: unknown) => {
    process.stderr.write(`\n${error instanceof Error ? error.message : 'Erreur inattendue.'}\n`);
    process.exitCode = 1;
  },
);
