import { newPushAlarmRevision } from '@/db/irrigation-event/push-schedule';
import {
  claimOperatorNotice,
  listWorkspaceIdsOfFarm,
  markOperatorNoticeSent,
  releaseOperatorNotice,
} from '@/db/operator-repository';
import { logJsonLine } from '../adapters/log';
import type { IrrigationPushSendRequest } from '../domain/irrigation-push-contract';
import { errorClassWords } from '../domain/operations/morning-task-outcomes';
import { operatorWatchNotice, parisDay, type OperatorNotice } from '../domain/operations/operator-watch';
import { knownDeploymentFarm } from './farm-identity-service';
import { type IrrigationPushSendResult, sendIrrigationPushNotification } from './irrigation-push-service';
import { readTaskStates, recordTaskOutcomes } from './task-runs';

/**
 * La veille de l'exploitant (4.5, PR 2 ; docs/tranche-4-contract.md, F566,
 * F608 à F611) : à 9 h, le planificateur appelle la route interne, qui lit
 * le registre, envoie la notification due à l'exploitant, et enregistre
 * l'exécution de la veille comme celle de toute tâche du registre.
 *
 * L'exploitant, c'est la personne du déploiement : ses appareils sont
 * inscrits sous les espaces de la ferme du déploiement (F608). Aucun appel à
 * OTF, aucun nom de ferme ni de personne au journal.
 */

export type OperatorNoticeSender = (request: IrrigationPushSendRequest) => Promise<IrrigationPushSendResult>;

/** Ce que la veille a fait : la réponse de la route, des genres et des nombres seulement. */
export type OperatorWatchResult = {
  notice: OperatorNotice['kind'] | 'none' | 'already-sent';
  problems: number;
  successful: boolean;
};

const DELIVERY_FAILURES: Record<Exclude<IrrigationPushSendResult['status'], 'sent' | 'retrying'>, string> = {
  'no-subscriber': 'aucun appareil de l\'exploitant inscrit aux notifications',
  failed: 'notification refusée par chaque appareil de l\'exploitant',
  unreachable: 'service de notification injoignable',
  disabled: 'service de notification non configuré',
};

/** Du plus parlant au moins parlant, quand l'exploitant a plusieurs espaces. */
const FAILURE_ORDER = ['unreachable', 'failed', 'disabled', 'no-subscriber'] as const;

export async function runOperatorWatch({
  now = new Date(),
  send = sendIrrigationPushNotification,
  deploymentFarm = knownDeploymentFarm,
  log = logJsonLine,
}: {
  now?: Date;
  send?: OperatorNoticeSender;
  deploymentFarm?: () => Promise<string | null>;
  log?: typeof logJsonLine;
} = {}): Promise<OperatorWatchResult> {
  const at = now.toISOString();
  let result: OperatorWatchResult;
  let error: string | null = null;
  try {
    const notice = operatorWatchNotice(await readTaskStates(now), now);
    if (!notice) {
      result = { notice: 'none', problems: 0, successful: true };
    } else {
      const day = parisDay(now);
      if (!await claimOperatorNotice(day, notice, at)) {
        // Déjà partie aujourd'hui, ou en partance : une panne qui dure ne la renvoie pas (F566).
        result = { notice: 'already-sent', problems: notice.problems, successful: true };
      } else {
        error = await deliver(notice, day, now, send, deploymentFarm);
        if (error === null) await markOperatorNoticeSent(day, at);
        else await releaseOperatorNotice(day);
        result = { notice: notice.kind, problems: notice.problems, successful: error === null };
      }
    }
  } catch (caught) {
    error = `interrompue avant la fin (${errorClassWords(caught instanceof Error ? caught.name : undefined)})`;
    result = { notice: 'none', problems: 0, successful: false };
  }
  await recordTaskOutcomes([{ task: 'operator-watch', successful: result.successful, error }], { at, log });
  log(result.successful ? 'info' : 'warn', {
    event: result.successful ? 'operator_watch_completed' : 'operator_watch_failed',
    notice: result.notice,
    problems: result.problems,
    summary: error ?? undefined,
  });
  return result;
}

/** Envoie la notification vers chaque espace de l'exploitant ; `null` si elle est partie, sinon le résumé de l'échec. */
async function deliver(
  notice: OperatorNotice,
  day: string,
  now: Date,
  send: OperatorNoticeSender,
  deploymentFarm: () => Promise<string | null>,
): Promise<string | null> {
  const farm = await deploymentFarm();
  if (farm === null) return 'ferme du déploiement inconnue : aucun exploitant à prévenir';
  const workspaceIds = await listWorkspaceIdsOfFarm(farm);
  if (workspaceIds.length === 0) return 'aucun espace de l\'exploitant';
  const statuses: IrrigationPushSendResult['status'][] = [];
  for (const workspaceId of workspaceIds) {
    const delivery = await sendSafely(send, {
      notificationId: `operator-watch-${day}`,
      recipientKey: workspaceId,
      revision: newPushAlarmRevision(now),
      notification: { title: notice.title, body: notice.body, tag: notice.tag, data: { url: notice.url } },
    });
    statuses.push(delivery.status);
  }
  // Partie vers un appareil, ou confiée au service qui la retente seul (douze essais au plus).
  if (statuses.some((status) => status === 'sent' || status === 'retrying')) return null;
  const failure = FAILURE_ORDER.find((status) => statuses.includes(status)) ?? 'unreachable';
  return DELIVERY_FAILURES[failure];
}

async function sendSafely(send: OperatorNoticeSender, request: IrrigationPushSendRequest): Promise<IrrigationPushSendResult> {
  try {
    return await send(request);
  } catch {
    return { status: 'unreachable', message: 'Le service d’alerte est indisponible.' };
  }
}
