/**
 * L'export de la base par Wrangler, reçu en mémoire (4.5, PR 4 ;
 * docs/tranche-4-contract.md, 10 bis.9, et 10 bis.14, F622). Wrangler est
 * lancé comme le fait sa propre commande, avec `capture-wrangler-export.mjs`
 * chargé dans son processus : l'export arrive par le canal du processus, il
 * n'est jamais écrit en clair sur le disque.
 *
 * Ce que Wrangler écrit à l'écran est relayé ligne par ligne, avec chaque
 * adresse masquée : il affiche l'adresse de téléchargement de l'export, qui
 * l'ouvre à quiconque l'a pendant une heure.
 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** En adresse `file:` : sous Windows, `--import` lirait « C: » d'un chemin comme le début d'une adresse. */
const CAPTURE_MODULE = new URL('./capture-wrangler-export.mjs', import.meta.url).href;

export type ExportSource = { database: string; location: 'remote' | 'local'; config?: string };

export type CapturedExport = { sql: Buffer; sha256: string; durationMs: number };

export class ExportCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportCaptureError';
  }
}

/** Une ligne de Wrangler, sans adresse : on y lit ce qu'il fait, jamais où se télécharge l'export. */
export function maskedWranglerLine(line: string): string {
  return line
    .replace(/\bhttps?:\/\/\S+/gi, '(adresse masquée)')
    // La référence d'une requête que Cloudflare donne avec une erreur (« reference = … ») : un identifiant de requête, à ne pas consigner.
    .replace(/\b(reference\s*[=:]\s*)[\w-]+/gi, '$1(référence masquée)')
    // Les identifiants du compte et des bases (32 chiffres hexadécimaux, avec ou sans tirets), même collés à un autre mot : les journaux du flux sont publics.
    .replace(/(?<![0-9a-z])[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}(?![0-9a-z])/gi, '(identifiant masqué)');
}

/** Le chemin convenu avec le détour : dans un dossier qui n'existe pas, pour que rien ne s'y écrive jamais. */
function captureTarget(): string {
  return path.join(tmpdir(), `module-irrigation-export-sans-dossier-${randomUUID()}`, 'export.sql');
}

function wranglerCli(): string {
  const require = createRequire(import.meta.url);
  return path.join(path.dirname(require.resolve('wrangler/package.json')), 'wrangler-dist', 'cli.js');
}

export function wranglerExportArguments(source: ExportSource, output: string): string[] {
  return [
    'd1', 'export', source.database,
    source.location === 'remote' ? '--remote' : '--local',
    `--output=${output}`,
    // La confirmation de Wrangler (la base ne répond plus pendant l'export) est dite par le script, avant.
    '--skip-confirmation',
    ...(source.config ? [`--config=${source.config}`] : []),
  ];
}

type RunOptions = {
  /** Le programme lancé à la place de Wrangler (les essais). */
  cli?: string;
  cwd?: string;
  /** Où vont les lignes de Wrangler, masquées. */
  relay?: (line: string) => void;
};

/** L'export, en mémoire ; une erreur qui ne cite que des faits, jamais une valeur de la base. */
export function captureWranglerExport(source: ExportSource, { cli = wranglerCli(), cwd = process.cwd(), relay = () => {} }: RunOptions = {}): Promise<CapturedExport> {
  const target = captureTarget();
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--no-warnings', '--import', CAPTURE_MODULE, cli, ...wranglerExportArguments(source, target)], {
      cwd,
      env: { ...process.env, MODULE_IRRIGATION_EXPORT_CAPTURE: path.resolve(target) },
      stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
    });
    const chunks: Buffer[] = [];
    let received = 0;
    let announced: number | null = null;
    const relayStream = (stream: NodeJS.ReadableStream | null) => {
      if (!stream) return;
      let pending = '';
      stream.setEncoding('utf8');
      stream.on('data', (text: string) => {
        pending += text;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? '';
        for (const line of lines) if (line.trim()) relay(maskedWranglerLine(line));
      });
      stream.on('end', () => { if (pending.trim()) relay(maskedWranglerLine(pending)); });
    };
    relayStream(child.stdout);
    relayStream(child.stderr);
    child.on('message', (message: { kind?: string; data?: string; bytes?: number }) => {
      if (message.kind === 'export-chunk' && typeof message.data === 'string') {
        const chunk = Buffer.from(message.data, 'base64');
        received += chunk.length;
        chunks.push(chunk);
      } else if (message.kind === 'export-end' && typeof message.bytes === 'number') {
        announced = message.bytes;
      }
    });
    child.on('error', () => reject(new ExportCaptureError('Wrangler n’a pas pu être lancé.')));
    child.on('close', (code) => {
      const sql = Buffer.concat(chunks);
      chunks.length = 0;
      if (code !== 0) {
        sql.fill(0);
        reject(new ExportCaptureError(`Wrangler s’est arrêté en erreur (code ${String(code)}) : l’export n’est pas fait. Ses lignes ci-dessus disent pourquoi.`));
        return;
      }
      if (announced === null) {
        sql.fill(0);
        reject(new ExportCaptureError('Wrangler a fini sans remettre d’export : sa façon d’écrire a peut-être changé. Rien n’a été écrit sur le disque.'));
        return;
      }
      if (announced !== received) {
        sql.fill(0);
        reject(new ExportCaptureError(`L’export est arrivé incomplet (${received} octets sur ${announced}).`));
        return;
      }
      resolve({ sql, sha256: createHash('sha256').update(sql).digest('hex'), durationMs: Date.now() - startedAt });
    });
  });
}

/**
 * Une commande de Wrangler (essai de restauration, 10 bis.15) : sa sortie
 * standard est rendue (le JSON demandé par `--json`), ses messages relayés
 * ligne par ligne, chaque adresse masquée. Un code d'erreur lève une erreur
 * qui ne cite que la commande.
 */
export function runWranglerCommand(args: readonly string[], { cli = wranglerCli(), cwd = process.cwd(), relay = () => {} }: RunOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--no-warnings', cli, ...args], { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let pending = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (text: string) => { out += text; });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (text: string) => {
      pending += text;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) relay(maskedWranglerLine(line));
    });
    child.on('error', () => reject(new ExportCaptureError('Wrangler n’a pas pu être lancé.')));
    let errors = '';
    child.stderr?.on('data', (text: string) => { errors += text; });
    child.on('close', (code) => {
      if (pending.trim()) relay(maskedWranglerLine(pending));
      if (code === 0) resolve(out);
      else {
        for (const line of out.split(/\r?\n/)) if (line.trim()) relay(maskedWranglerLine(line));
        const reason = wranglerFailureReason(`${errors}\n${out}`);
        reject(new ExportCaptureError(`Wrangler a échoué (${args.slice(0, 2).join(' ')}, code ${String(code)}${reason ? ` : ${reason}` : ''}).`));
      }
    });
  });
}

/**
 * La raison d'un échec de SQLite ou de D1, quand Wrangler la dit : un nom de
 * contrainte ou de table, jamais une valeur. Rien si elle n'est pas reconnue.
 */
export function wranglerFailureReason(output: string): string | null {
  const found = /(no such (?:table|column): [\w.]+|(?:FOREIGN KEY|UNIQUE|NOT NULL|CHECK|PRIMARY KEY) constraint failed(?:: [\w.]+)?|SQLITE_[A-Z_]+|not authorized)/.exec(output);
  if (found) return found[1];
  // Une erreur de l'API de Cloudflare se dit par son numéro (« [code: 7500] »), jamais par sa référence.
  const code = /\[code: (\d+)\]/.exec(output);
  if (!code) return null;
  return `${/internal error/i.test(output) ? 'erreur interne de Cloudflare, ' : ''}code ${code[1]} de l’API de Cloudflare`;
}

/** Le JSON que Wrangler écrit avec `--json`, même précédé d'un avertissement. */
export function wranglerJson<T>(output: string): T {
  const start = output.search(/^[[{]/m);
  if (start < 0) throw new ExportCaptureError('Wrangler n’a pas rendu de JSON.');
  return JSON.parse(output.slice(start)) as T;
}
