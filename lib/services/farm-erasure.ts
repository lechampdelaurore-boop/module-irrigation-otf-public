import {
  farmErasureBatches,
  finishFarmErasure,
  listErasingFarmErasures,
  readErasedSpace,
  remainingErasureBatches,
  runErasureBatch,
  startDueFarmErasures,
  type ErasingRequest,
} from '@/db/farm-erasure-repository';
import { logJsonLine } from '../adapters/log';
import {
  FARM_ERASURE_BATCH_ROWS,
  FARM_ERASURE_RUN_BUDGET,
  type FarmErasureRunReport,
} from '../domain/operations/farm-erasure';

/**
 * La tâche du matin qui efface les fermes qui l'ont demandé (4.5, PR 3 ;
 * docs/tranche-4-contract.md, F563, et 10 bis.17, F644 et F645).
 *
 * Les demandes échues passent « en cours », puis chacune efface, table par
 * table et par lots bornés, tout ce que l'espace garde, et enfin l'espace
 * lui-même avec la note « faite », d'un bloc. Chaque lot ne vise que les
 * lignes de l'espace : coupé à n'importe quel endroit (borne du passage,
 * panne), l'effacement reprend au passage suivant par une requête qui dit
 * les tables où il reste des lignes, sans rien oublier ni rien effacer
 * d'autre.
 *
 * Le journal ne porte que l'identifiant de la demande, des noms de table, des
 * nombres et des classes d'erreur : ni personne, ni ferme, ni contenu (F564).
 */

type RunOptions = {
  now?: Date;
  budget?: { statements: number; milliseconds: number };
  clock?: () => number;
  log?: typeof logJsonLine;
};

type Allowance = { statements: number; deadlineMs: number; clock: () => number };

/** Une instruction de plus, si le passage le permet encore. */
function take(allowance: Allowance): boolean {
  if (allowance.statements <= 0 || allowance.clock() >= allowance.deadlineMs) return false;
  allowance.statements -= 1;
  return true;
}

export async function runDueFarmErasures({
  now = new Date(),
  budget = FARM_ERASURE_RUN_BUDGET,
  clock = Date.now,
  log = logJsonLine,
}: RunOptions = {}): Promise<FarmErasureRunReport> {
  const allowance: Allowance = { statements: budget.statements, deadlineMs: clock() + budget.milliseconds, clock };
  let requests: ErasingRequest[];
  try {
    await startDueFarmErasures(now.toISOString());
    requests = await listErasingFarmErasures();
  } catch (error) {
    // La base ne répond pas : rien n'a commencé, le passage suivant reprendra.
    log('warn', { event: 'farm_erasure_failed', erasure: null, error: errorClass(error) });
    return { due: 0, erased: 0, unfinished: 0, failures: [errorClass(error)] };
  }
  const report = { due: requests.length, erased: 0, unfinished: 0, failures: [] as string[] };
  for (const request of requests) {
    try {
      if (await eraseSpace(request, allowance, log)) report.erased += 1;
      else report.unfinished += 1;
    } catch (error) {
      report.failures.push(errorClass(error));
      log('warn', { event: 'farm_erasure_failed', erasure: request.id, error: errorClass(error) });
    }
  }
  return report;
}

/** Efface ce que l'espace garde, puis l'espace ; `false` quand la borne du passage arrête avant la fin. */
async function eraseSpace(request: ErasingRequest, allowance: Allowance, log: typeof logJsonLine): Promise<boolean> {
  const space = await readErasedSpace(request.workspaceId);
  if (space === null) {
    // L'espace n'existe plus : seule la note reste à écrire.
    if (!take(allowance)) return false;
    await finishFarmErasure(request, new Date(allowance.clock()).toISOString());
    log('warn', { event: 'farm_erasure_done', erasure: request.id, rows: 0, spaceAlreadyGone: true });
    return true;
  }
  // Une requête dit les tables où il reste des lignes ; les autres sont déjà vides.
  if (!take(allowance)) return false;
  const batches = await remainingErasureBatches(space.workspaceId, farmErasureBatches(space));
  let rows = 0;
  for (const batch of batches) {
    let tableRows = 0;
    let erased: number;
    do {
      if (!take(allowance)) {
        if (tableRows > 0) log('info', { event: 'farm_erasure_step', erasure: request.id, table: batch.table, rows: tableRows });
        log('info', { event: 'farm_erasure_paused', erasure: request.id, rows: rows + tableRows });
        return false;
      }
      erased = await runErasureBatch(batch, FARM_ERASURE_BATCH_ROWS);
      tableRows += erased;
    } while (erased === FARM_ERASURE_BATCH_ROWS);
    if (tableRows > 0) log('info', { event: 'farm_erasure_step', erasure: request.id, table: batch.table, rows: tableRows });
    rows += tableRows;
  }
  if (!take(allowance)) return false;
  await finishFarmErasure(request, new Date(allowance.clock()).toISOString());
  log('info', { event: 'farm_erasure_done', erasure: request.id, rows: rows + 1 });
  return true;
}

/** Le nom de la classe d'erreur, jamais son message (F604). */
function errorClass(error: unknown): string {
  return error instanceof Error && /^[A-Za-z_]{1,40}$/.test(error.name) ? error.name : 'unknown';
}
