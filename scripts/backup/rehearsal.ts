/**
 * L'essai de restauration (4.5, PR 4 ; docs/tranche-4-contract.md, F561, et
 * 10 bis.15) : sur une base d'essai remplie de deux fermes fictives, les
 * trois scénarios, joués pour de vrai, puis la base détruite.
 *
 * - S1, revenir en arrière : signet noté, dégât sur la ferme A, restauration
 *   au signet (Time Travel), retour au signet d'avant (l'état abîmé), puis le
 *   rattrapage de la ferme A seule, la ferme B devant rester inchangée.
 * - S2, reconstruire depuis un export : une base neuve, vide, où l'export est
 *   importé ; les mêmes comparaisons ; puis l'isolation des deux fermes,
 *   lue par les dépôts du module sur la base reconstruite.
 * - S3, perdre la clé du coffre, sur la base reconstruite.
 *
 * Chaque état est exporté, rejoué en mémoire et comparé table par table
 * (nombre de lignes et empreinte du contenu). Le compte rendu ne dit que des
 * noms de tables, des nombres et des empreintes abrégées : il se colle tel
 * quel dans la PR. Les gestes passent par `D1Operations` : Wrangler chez
 * Cloudflare, ou la fausse D1 en mémoire des essais et de la simulation.
 */
import type { DatabaseSync } from 'node:sqlite';
import { secondsFromMilliseconds } from '../../lib/domain/units.ts';
import { REHEARSAL_DATABASE, type D1Operations } from './d1-operations.ts';
import { compareSummaries, differenceWords, inspectExport, summarizeDatabase, type ExportInspection, type TableSummary } from './export-inspection.ts';
import { farmDamageStatements, farmSummary, isRevisionCounter, missingFarmRowStatements, replayedCopy, revisionCounters } from './farm-rows.ts';
import { importIntoEmptyBase } from './restore-import.ts';
import { isolationChecks, vaultChecks, type Check } from './rehearsal-checks.ts';
import { buildRehearsalSource, secretsFoundIn, type RehearsalSource } from './rehearsal-data.ts';

/** La table abîmée en S1, avec celles qui en dépendent. */
const DAMAGED_TABLE = 'irrigation_events';
export const RECONSTRUCTED_DATABASE = `${REHEARSAL_DATABASE}-reconstruite`;
/** Où l'on essaie d'importer l'export tel que Cloudflare le rend, pour savoir s'il passe sans être rangé. */
const RAW_PROBE_DATABASE = `${REHEARSAL_DATABASE}-export-brut`;

/** Avant le dégât, et après chaque restauration : de quoi séparer nettement les instants chez Cloudflare. */
const PAUSE_BEFORE_DAMAGE_MS = 10_000;
const PAUSE_AFTER_RESTORE_MS = 5_000;

export type RehearsalOptions = {
  operations: D1Operations;
  /** Où l'essai se joue, dit en tête du compte rendu. */
  where: string;
  primary?: string;
  secondary?: string;
  rawProbe?: string;
  now?: () => Date;
  pause?: (milliseconds: number) => Promise<void>;
  /** Une ligne à chaque étape, pour suivre l'essai pendant qu'il tourne. */
  progress?: (line: string) => void;
  migrationsDir?: string;
};

export type RehearsalReport = { ok: boolean; failures: number; markdown: string };

type State = {
  label: string;
  title: string;
  sql: string;
  durationMs: number;
  inspection: ExportInspection;
  copy: DatabaseSync;
  tables: TableSummary[];
  digest: string;
};

class Report {
  readonly lines: string[] = [];
  failures = 0;

  section(title: string): void {
    this.lines.push('', `### ${title}`, '');
  }

  check(ok: boolean, text: string): boolean {
    if (!ok) this.failures += 1;
    this.lines.push(`- ${ok ? '✓' : '✗'} ${text}`);
    return ok;
  }

  checks(list: readonly Check[]): boolean {
    return list.map(({ ok, text }) => this.check(ok, text)).every(Boolean);
  }

  note(text: string): void {
    this.lines.push(`- ${text}`);
  }
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString('fr-FR')} ${word}${count > 1 ? 's' : ''}`;
}

function seconds(milliseconds: number): string {
  return `${secondsFromMilliseconds(milliseconds).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`;
}

function short(digest: string): string {
  return digest.slice(0, 12);
}

function parisTime(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function differencesWords(expected: readonly TableSummary[], actual: readonly TableSummary[]): string {
  return compareSummaries(expected, actual).map(differenceWords).join(' ; ');
}

/** Un message d'erreur sans secret : s'il en portait un, il est tu. */
function safeMessage(error: unknown, secrets: readonly string[]): string {
  const message = error instanceof Error ? error.message : 'erreur inconnue';
  return secretsFoundIn(message, secrets) > 0 ? '(message tu : il citait un secret de l’essai)' : message;
}

/** Le tableau des comparaisons, table par table : lignes de chaque état, « ≠ » quand le contenu diffère de T0. */
function comparisonTable(states: readonly State[]): string[] {
  const reference = states[0];
  const names = [...new Set(states.flatMap((state) => state.tables.map((table) => table.name)))].sort();
  const cell = (state: State, name: string): string => {
    const table = state.tables.find((entry) => entry.name === name);
    if (!table) return 'absente';
    const original = reference.tables.find((entry) => entry.name === name);
    return original && original.digest === table.digest ? String(table.rows) : `${table.rows} ≠`;
  };
  const shown = names.filter((name) => states.some((state) => cell(state, name) !== '0'));
  const lines = [
    `| Table | ${states.map((state) => `${state.label} ${state.title}`).join(' | ')} |`,
    `| --- | ${states.map(() => '---:').join(' | ')} |`,
    ...shown.map((name) => `| ${name} | ${states.map((state) => cell(state, name)).join(' | ')} |`),
    `| **Lignes en tout** | ${states.map((state) => String(state.tables.reduce((sum, table) => sum + table.rows, 0))).join(' | ')} |`,
    `| **Empreinte d’ensemble** | ${states.map((state) => `\`${short(state.digest)}\``).join(' | ')} |`,
  ];
  const empty = names.length - shown.length;
  return [...lines, '', `${plural(names.length, 'table')} comparée${names.length > 1 ? 's' : ''} à chaque état ; ${plural(empty, 'table')} vide${empty > 1 ? 's' : ''} partout, non montrée${empty > 1 ? 's' : ''}. « ≠ » : contenu différent de T0 (empreinte).`];
}

export async function runRehearsal(options: RehearsalOptions): Promise<RehearsalReport> {
  const {
    operations,
    where,
    primary = REHEARSAL_DATABASE,
    secondary = RECONSTRUCTED_DATABASE,
    rawProbe = RAW_PROBE_DATABASE,
    now = () => new Date(),
    pause = (milliseconds) => new Promise((resolve) => { setTimeout(resolve, milliseconds); }),
    progress = () => {},
    migrationsDir = 'drizzle',
  } = options;
  const report = new Report();
  const states: State[] = [];
  let source: RehearsalSource | null = null;
  const startedAt = now();

  const record = (label: string, title: string, { sql, durationMs }: { sql: string; durationMs: number }): State => {
    const inspection = inspectExport(sql, migrationsDir);
    // Un export qui ne se rejoue pas est dit par son contrôle ; l'état garde alors une base vide.
    let copy: DatabaseSync;
    try {
      copy = replayedCopy(sql);
    } catch {
      copy = replayedCopy('');
    }
    const summary = summarizeDatabase(copy);
    const state = { label, title, sql, durationMs, inspection, copy, tables: summary.tables, digest: summary.digest };
    states.push(state);
    return state;
  };
  const capture = async (database: string, label: string, title: string): Promise<State> => {
    progress(`Export ${label} (${title})…`);
    return record(label, title, await operations.exportSql(database));
  };
  const faithful = (state: State): boolean => report.check(
    state.inspection.problems.length === 0,
    state.inspection.problems.length === 0
      ? `Export ${state.label} contrôlé : il restaure la base fidèlement (${plural(state.tables.length, 'table')}, ${plural(state.inspection.totalRows, 'ligne')}, ${plural(state.inspection.migrations.applied.length, 'migration')}).`
      : `Export ${state.label} : PROBLÈME — ${state.inspection.problems.join(' ')}`,
  );
  const identical = (expected: State, actual: State, text: string): boolean => {
    const differences = differencesWords(expected.tables, actual.tables);
    return report.check(differences === '', differences === '' ? text : `${text} — NON : ${differences}`);
  };
  const step = async <T>(name: string, action: () => Promise<T>): Promise<T> => {
    progress(`${name}…`);
    return action();
  };

  try {
    report.section('Préparation');
    for (const database of [primary, secondary, rawProbe]) {
      if (await operations.exists(database)) {
        await step(`Base restée d’un essai interrompu : ${database}, détruite`, () => operations.destroy(database));
        report.note(`Une base restée d’un essai interrompu (${database}) a été détruite d’abord.`);
      }
    }
    await step(`Création de la base d’essai ${primary}`, () => operations.create(primary));
    report.check(true, `Base d’essai créée : \`${primary}\`.`);
    const built = await step('Données fictives', () => buildRehearsalSource(migrationsDir));
    source = built;
    const sourceCopy = replayedCopy(built.sql);
    const sourceTables = summarizeDatabase(sourceCopy).tables;
    sourceCopy.close();
    await step('Import des données fictives', () => operations.executeSql(primary, built.sql));
    const [farmA, farmB] = built.farms;
    report.check(true, `Données fictives importées : ferme A (n° ${farmA.otfFarmId}, ${plural(farmA.events, 'irrigation')}) et ferme B (n° ${farmB.otfFarmId}, ${plural(farmB.events, 'irrigation')}), chacune avec son matériel et son raccordement à Ouvre ta ferme (jetons fictifs chiffrés).`);
    const t0 = await capture(primary, 'T0', 'noté');
    if (!faithful(t0)) throw new Error('L’export T0 ne restaurerait pas la base : l’essai s’arrête.');
    const sameAsSource = differencesWords(sourceTables, t0.tables);
    report.check(sameAsSource === '', sameAsSource === '' ? 'T0 est identique aux données fictives envoyées, table par table.' : `T0 diffère des données fictives envoyées : ${sameAsSource}`);

    report.section('S1 · Revenir en arrière (Time Travel), puis rattraper une seule ferme');
    const noted = await step('Signet noté', () => operations.currentBookmark(primary));
    const notedAt = now().toISOString();
    report.check(true, 'Signet de l’état T0 noté, et son instant.');
    await pause(PAUSE_BEFORE_DAMAGE_MS);
    const damage = farmDamageStatements(t0.copy, DAMAGED_TABLE, farmA.workspaceId);
    await step('Dégât sur la ferme A', () => operations.executeSql(primary, damage.join('\n')));
    const t1 = await capture(primary, 'T1', 'abîmé');
    const lost = farmSummary(t0.copy, farmA.workspaceId).rows - farmSummary(t1.copy, farmA.workspaceId).rows;
    const lostTables = compareSummaries(t0.tables, t1.tables).map(({ table }) => table);
    const bUntouchedByDamage = farmSummary(t1.copy, farmB.workspaceId).digest === farmSummary(t0.copy, farmB.workspaceId).digest;
    report.check(lost > 0 && bUntouchedByDamage, `Dégât sur la ferme A : ${plural(lost, 'ligne')} effacée${lost > 1 ? 's' : ''} (\`${DAMAGED_TABLE}\` et les tables qui en dépendent) ; tables touchées : ${lostTables.join(', ')} ; ferme B ${bUntouchedByDamage ? 'intacte' : 'TOUCHÉE'}.`);
    // Une mesure, pour 10 bis.10 : son échec se dit, sans arrêter le scénario, qui restaure au signet noté.
    const fromInstant = await step('Signet de l’instant noté', () => operations.bookmarkAt(primary, notedAt).catch((error: unknown) => error instanceof Error ? error : new Error(String(error))));
    report.note(typeof fromInstant === 'string'
      ? `Finesse de Time Travel : le signet que Cloudflare rend pour l’instant noté ${fromInstant === noted ? 'est' : 'n’est pas'} le signet noté à cet instant.`
      : `Finesse de Time Travel : Cloudflare n’a pas rendu de signet pour l’instant noté (${fromInstant.message}) ; la restauration se fait au signet noté, qui n’en dépend pas.`);
    const { previousBookmark } = await step('Restauration au signet noté', () => operations.restore(primary, noted));
    await pause(PAUSE_AFTER_RESTORE_MS);
    const t2 = await capture(primary, 'T2', 'restauré');
    identical(t0, t2, `Restauration au signet noté : identique à T0, table par table (${plural(t2.tables.length, 'table')}).`);
    report.check(previousBookmark !== '', 'La restauration a rendu le signet de l’état d’avant (T1).');
    await step('Retour au signet d’avant', () => operations.restore(primary, previousBookmark));
    await pause(PAUSE_AFTER_RESTORE_MS);
    const t3 = await capture(primary, 'T3', 'retour');
    identical(t1, t3, 'Retour au signet d’avant la restauration : identique à l’état abîmé T1, table par table.');

    const recovery = missingFarmRowStatements(t2.copy, t3.copy, farmA.workspaceId);
    report.check(recovery.inserted === lost, `Rattrapage de la ferme A, lu dans l’état restauré T2 : ${plural(recovery.inserted, 'ligne')} à réinsérer (${recovery.insertedByTable.map(({ table, rows }) => `${table} : ${rows}`).join(', ')}), autant que le dégât en a effacé.`);
    const onlyCounters = recovery.changed.every(({ table, columns }) => columns.every((column) => isRevisionCounter(table, column)));
    report.check(onlyCounters, recovery.changed.length === 0
      ? 'Aucune ligne encore présente n’a changé.'
      : `Lignes encore présentes mais différentes, laissées telles quelles : ${recovery.changed.map(({ table, rows, columns }) => `${table} (${rows}, ${columns.join(', ')})`).join(' ; ')}${onlyCounters ? ' : les compteurs de révision de l’espace, seulement.' : ' : PAS seulement des compteurs de révision.'}`);
    report.check(!recovery.statements.some((statement) => statement.includes(farmB.workspaceId)), 'Aucune instruction du rattrapage ne nomme la ferme B.');
    await step('Réinsertion des lignes de la ferme A', () => operations.executeSql(primary, recovery.statements.join('\n')));
    const t4 = await capture(primary, 'T4', 'rattrapé');
    report.check(
      farmSummary(t4.copy, farmA.workspaceId, isRevisionCounter).digest === farmSummary(t0.copy, farmA.workspaceId, isRevisionCounter).digest,
      'Ferme A : identique à T0, ligne pour ligne, ses compteurs de révision exceptés.',
    );
    const countersBefore = revisionCounters(t3.copy, farmA.workspaceId);
    const countersAfter = revisionCounters(t4.copy, farmA.workspaceId);
    const moved = Object.keys(countersAfter).filter((column) => countersAfter[column] !== countersBefore[column]);
    report.check(
      Object.keys(countersAfter).every((column) => countersAfter[column] >= countersBefore[column]),
      `Compteurs de révision de la ferme A : jamais revenus en arrière${moved.length > 0 ? ` (${moved.map((column) => `${column} : ${countersBefore[column]} → ${countersAfter[column]}`).join(', ')}, avancés par les déclencheurs de la réinsertion ; les calculs faits sur l’état abîmé restent périmés)` : ''}.`,
    );
    const bAtT4 = farmSummary(t4.copy, farmB.workspaceId).digest;
    report.check(bAtT4 === farmSummary(t3.copy, farmB.workspaceId).digest && bAtT4 === farmSummary(t0.copy, farmB.workspaceId).digest, `Ferme B : inchangée, empreinte identique avant et après le rattrapage (\`${short(bAtT4)}\`).`);
    const wholeDifferences = compareSummaries(t0.tables, t4.tables);
    const onlyWorkspaces = wholeDifferences.every(({ table, expected, actual }) => table === 'irrigation_workspaces' && expected?.rows === actual?.rows);
    report.check(onlyWorkspaces, onlyWorkspaces
      ? `Base entière : identique à T0, sauf ${wholeDifferences.length === 0 ? 'rien' : 'la ligne d’espace de la ferme A (ses compteurs de révision)'}.`
      : `Base entière : diffère de T0 au-delà des compteurs : ${wholeDifferences.map(differenceWords).join(' ; ')}`);
    if (!faithful(t4)) throw new Error('L’export T4 ne restaurerait pas la base : S2 ne peut pas partir de lui.');

    report.section('S2 · Reconstruire depuis un export, puis l’isolation des deux fermes');
    await step(`Essai de l’export brut dans ${rawProbe}`, () => operations.create(rawProbe));
    try {
      await operations.executeSql(rawProbe, t4.sql);
      report.note('L’export brut, tel que Cloudflare le rend, s’importe tel quel dans une base vide.');
    } catch (error) {
      report.note(`L’export brut, tel que Cloudflare le rend, ne s’importe pas tel quel dans une base vide (${safeMessage(error, built.secrets)}) : d’où l’import rangé ci-dessous, celui de la procédure.`);
    }
    await step(`Destruction de ${rawProbe}`, () => operations.destroy(rawProbe));
    const rebuilt = await step(`Reconstruction dans la base neuve ${secondary}`, () => importIntoEmptyBase(operations, secondary, t4.sql, { migrationsDir, progress }));
    for (const line of rebuilt.lines.filter((entry) => !entry.startsWith('Base reconstruite'))) report.note(line);
    report.check(rebuilt.rebuilt !== null, `Base neuve et vide (\`${secondary}\`), l’export T4 importé rangé pour l’import (les tables d’abord, puis les lignes, chaque table après celles qu’elle désigne, puis index et déclencheurs) : il porte son schéma et sa liste de migrations, aucune migration n’est appliquée avant.`);
    if (rebuilt.rebuilt === null) throw new Error('La reconstruction a été refusée : S2 s’arrête.');
    const t5 = record('T5', 'reconstruit', rebuilt.rebuilt);
    identical(t4, t5, `Base reconstruite : identique à l’export T4, table par table (${plural(t5.tables.length, 'table')}).`);
    faithful(t5);
    const latest = t5.inspection.migrations.applied.at(-1) ?? 'aucune';
    report.check(t5.inspection.migrations.missingFromExport.length === 0, `Migrations : la base reconstruite a reçu les ${plural(t5.inspection.migrations.applied.length, 'migration')} du dépôt (la dernière : ${latest}) ; une migration plus récente s’y appliquerait comme à l’ordinaire.`);
    report.checks(await step('Isolation des deux fermes', () => isolationChecks(t5.copy, built.farms)));

    report.section('S3 · Perdre la clé du coffre, sur la base reconstruite');
    const vaultCopy = replayedCopy(t5.sql);
    try {
      report.checks(await step('Coffre des jetons', () => vaultChecks(vaultCopy, built)));
    } finally {
      vaultCopy.close();
    }
  } catch (error) {
    report.check(false, `L’essai s’est arrêté : ${safeMessage(error, source?.secrets ?? [])}`);
  } finally {
    const exported = states.map((state) => state.sql).join('\n');
    const leakedInExports = secretsFoundIn(exported, source?.secrets ?? []);
    report.section('Secrets');
    report.check(leakedInExports === 0, `Ni la clé du coffre ni un jeton en clair dans les ${plural(states.length, 'export')} de l’essai${leakedInExports > 0 ? ` : ${leakedInExports} trouvé${leakedInExports > 1 ? 's' : ''}` : ''}.`);

    report.section('Fin');
    for (const database of [primary, secondary, rawProbe]) {
      try {
        if (await operations.exists(database)) await step(`Destruction de ${database}`, () => operations.destroy(database));
      } catch (error) {
        report.check(false, `La base ${database} n’a pas pu être détruite : ${safeMessage(error, source?.secrets ?? [])}`);
      }
    }
    const remaining: string[] = [];
    for (const database of [primary, secondary, rawProbe]) {
      try {
        if (await operations.exists(database)) remaining.push(database);
      } catch {
        remaining.push(database);
      }
    }
    report.check(remaining.length === 0, remaining.length === 0 ? 'Bases d’essai détruites : aucune n’existe plus.' : `Bases d’essai encore là : ${remaining.join(', ')} (à détruire à la main).`);
    if (states.length > 0) report.note(`Durée des exports : ${states.map((state) => `${state.label} ${seconds(state.durationMs)}`).join(' · ')}.`);
  }

  const secrets = source?.secrets ?? [];
  const head = [
    '## Essai de restauration',
    '',
    `${where}, le ${parisTime(startedAt)} (heure de Paris) ; données fictives seulement.`,
  ];
  const comparisons = states.length > 0 ? ['', '### Comparaisons table par table', '', ...comparisonTable(states)] : [];
  const draft = (failures: number) => [
    ...head,
    '',
    failures === 0 ? '**Résultat : réussi.** Les trois scénarios ont rendu ce qu’ils devaient.' : `**Résultat : PROBLÈME** (${plural(failures, 'contrôle')} en échec, marqué${failures > 1 ? 's' : ''} ✗).`,
    ...report.lines,
    ...comparisons,
  ].join('\n');
  let markdown = draft(report.failures);
  if (secretsFoundIn(markdown, secrets) > 0) {
    report.check(false, 'Le compte rendu citait un secret de l’essai : il a été remplacé par ce seul constat.');
    markdown = [...head, '', '**Résultat : PROBLÈME.** Le compte rendu citait un secret de l’essai ; il n’est pas montré.'].join('\n');
  }
  for (const state of states) state.copy.close();
  return { ok: report.failures === 0, failures: report.failures, markdown: `${markdown}\n` };
}
