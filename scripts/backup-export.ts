/**
 * L'export hebdomadaire chiffré de la base (4.5, PR 4 ; docs/tranche-4-contract.md,
 * F561, 10 bis.9, et 10 bis.14, F620 à F624). Lancé par l'exploitant, sur
 * son ordinateur, le soir, une fois par semaine :
 *
 *   pnpm backup:export [--dossier <dossier hors du dépôt>] [--database <nom>] [--local]
 *
 * 1. le mot de passe de l'export, tapé deux fois, sans écho ;
 * 2. l'export de la base par Wrangler, reçu en mémoire (jamais en clair sur
 *    le disque) ;
 * 3. son contrôle : rejoué dans une base vide, il doit restaurer la base
 *    fidèlement (schéma des migrations, contraintes, clés étrangères) ;
 * 4. le fichier chiffré, écrit hors du dépôt, sans écraser un export
 *    précédent ; puis relu et déchiffré pour vérifier qu'il rend l'export
 *    à l'octet près.
 *
 * Aucun secret en dur : Wrangler se sert de la connexion de l'exploitant
 * (`pnpm exec wrangler login`). La sortie ne dit que des nombres, des noms
 * de migrations et des empreintes.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { decryptExport, encryptExport } from './backup/export-crypto.ts';
import {
  DEFAULT_DATABASE,
  assertOutsideRepository,
  defaultExportDirectory,
  exportFileName,
  inspectionLines,
  parisDate,
  repositoryRoot,
  sizeWords,
} from './backup/export-files.ts';
import { inspectExport } from './backup/export-inspection.ts';
import { askNewPassphrase } from './backup/passphrase-prompt.ts';
import { captureWranglerExport, type ExportSource } from './backup/wrangler-export.ts';
import { secondsFromMilliseconds } from '../lib/domain/units.ts';

type Options = { directory: string; source: ExportSource };

function parseOptions(argv: readonly string[]): Options {
  let directory = defaultExportDirectory();
  const source: ExportSource = { database: DEFAULT_DATABASE, location: 'remote' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`Valeur manquante après ${argument}.`);
      index += 1;
      return value;
    };
    if (argument === '--dossier') directory = path.resolve(next());
    else if (argument === '--database') source.database = next();
    else if (argument === '--local') source.location = 'local';
    else if (argument === '--') continue;
    else throw new Error(`Option inconnue : ${argument}.`);
  }
  return { directory, source };
}

const say = (line = '') => process.stdout.write(`${line}\n`);

async function main(): Promise<number> {
  const { directory, source } = parseOptions(process.argv.slice(2));
  const root = repositoryRoot();
  assertOutsideRepository(directory, root);
  say(`Export ${source.location === 'remote' ? 'de la base en ligne' : 'de la base locale'} « ${source.database} », chiffré, vers :`);
  say(`  ${directory}`);
  say('Pendant l’export, la base ne répond plus aux fermes (quelques secondes) : faites-le le soir, loin de 6 h 15 et de 9 h.');
  say();
  const passphrase = await askNewPassphrase();

  say();
  say('Export par Wrangler :');
  const captured = await captureWranglerExport(source, { cwd: root, relay: (line) => say(`  wrangler │ ${line}`) });
  try {
    const inspection = inspectExport(captured.sql.toString('utf8'), path.join(root, 'drizzle'));
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const now = new Date();
    const file = path.join(directory, exportFileName(now));
    const sealed = encryptExport(captured.sql, passphrase);
    // « wx » : jamais par-dessus un export précédent.
    writeFileSync(file, sealed, { flag: 'wx', mode: 0o600 });
    const reread = decryptExport(readFileSync(file), passphrase);
    const identical = createHash('sha256').update(reread).digest('hex') === captured.sha256;
    reread.fill(0);

    say();
    if (!identical) {
      say('PROBLÈME : le fichier écrit ne rend pas l’export à l’identique. Ne le comptez pas comme une sauvegarde ; recommencez.');
      return 1;
    }
    say(inspection.problems.length === 0
      ? 'Export vérifié : rejoué dans une base vide, il restaure la base fidèlement.'
      : 'Export enregistré, mais il ne restaurerait pas la base fidèlement :');
    for (const line of inspectionLines(inspection)) say(`  ${line}`);
    say(`  Fichier : ${file} (${sizeWords(sealed.length)}), relu et déchiffré à l’identique.`);
    say(`  Durée de l’export : ${secondsFromMilliseconds(captured.durationMs).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s.`);
    say();
    if (inspection.problems.length > 0) {
      say('Ne le notez pas comme fait. Transmettez ces lignes à l’assistant : elles ne contiennent aucune donnée.');
      return 1;
    }
    say(`Notez-le sur la page d’état du module : « J’ai fait l’export du ${parisDate(now)} ».`);
    say('Copiez le fichier hors de cet ordinateur (clé USB, disque externe ou votre stockage en ligne) : il est chiffré.');
    say('Gardez le mot de passe à part du fichier : sans lui, l’export est illisible, même pour vous.');
    return 0;
  } finally {
    captured.sql.fill(0);
  }
}

main().then(
  (code) => { process.exitCode = code; },
  (error: unknown) => {
    process.stderr.write(`\n${error instanceof Error ? error.message : 'Erreur inattendue.'}\n`);
    process.exitCode = 1;
  },
);
