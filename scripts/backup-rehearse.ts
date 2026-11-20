/**
 * `pnpm backup:rehearse` : l'essai de restauration (4.5, PR 4 ;
 * docs/tranche-4-contract.md, F561, point 7, et 10 bis.15).
 *
 * Sans option, une **simulation** : la fausse D1 en mémoire, aucun appel à
 * Cloudflare ; elle montre que l'essai se déroule et ce qu'il dira. Avec
 * `--cloudflare`, l'essai pour de vrai, sur la base d'essai
 * `module-irrigation-otf-essai-restauration`, par Wrangler et la connexion du
 * lanceur : il se lance par le flux « Essai de restauration » de GitHub
 * Actions, après le « vas-y » du porteur. Jamais une autre base : les gestes
 * refusent tout autre nom.
 *
 * Le compte rendu, sans donnée, va sur la sortie standard (et dans le résumé
 * du flux sous GitHub Actions) ; l'avancement et les lignes de Wrangler, sur
 * la sortie d'erreur. Code 1 si un contrôle échoue.
 */
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { wranglerD1Operations } from './backup/d1-operations.ts';
import { memoryD1Operations } from './backup/memory-d1.ts';
import { runRehearsal } from './backup/rehearsal.ts';

const KNOWN_OPTIONS = new Set(['--cloudflare']);

async function main(): Promise<number> {
  const options = process.argv.slice(2);
  const unknown = options.filter((option) => !KNOWN_OPTIONS.has(option));
  if (unknown.length > 0) {
    process.stderr.write(`Option inconnue : ${unknown.join(' ')}. Seule option : --cloudflare (l’essai pour de vrai ; sans elle, une simulation en mémoire).\n`);
    return 2;
  }
  const cloudflare = options.includes('--cloudflare');
  const progress = (line: string) => { process.stderr.write(`${line}\n`); };
  // Un dossier vide, sans réglages de Wrangler : un nom de base n'y désigne que la base de ce nom.
  const workDirectory = cloudflare ? mkdtempSync(path.join(tmpdir(), 'essai-restauration-wrangler-')) : null;
  try {
    const report = await runRehearsal(workDirectory
      ? {
          operations: wranglerD1Operations({ cwd: workDirectory, relay: (line) => progress(`wrangler │ ${line}`) }),
          where: 'Chez Cloudflare, sur la base d’essai',
          progress,
        }
      : {
          operations: memoryD1Operations(),
          where: 'Simulation en mémoire (fausse D1, sans Cloudflare)',
          pause: async () => {},
          progress,
        });
    process.stdout.write(report.markdown);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.markdown);
    return report.ok ? 0 : 1;
  } finally {
    if (workDirectory) rmSync(workDirectory, { recursive: true, force: true });
  }
}

process.exitCode = await main();
