import {
  advanceFarmErasure,
  cancelFarmErasure,
  listOpenFarmErasures,
  readOpenFarmErasure,
  requestFarmErasure,
  type OpenFarmErasure,
} from '@/db/farm-erasure-repository';
import { logJsonLine } from '../adapters/log';
import {
  farmErasureRequestDecision,
  farmErasureRequestedMessage,
  frozenFarmView,
  immediateErasureDecision,
  type FrozenFarmView,
} from '../domain/operations/farm-erasure-request';
import { isDemoDeployment } from './deployment-mode';
import { runDueFarmErasures } from './farm-erasure';
import { readCachedIrrigationSnapshot } from './irrigation-service';

/**
 * La demande d'effacement d'une ferme, vue de la personne et de l'exploitant
 * (4.5, PR 3, troisième partie ; docs/tranche-4-contract.md, F563, et 10 bis.22,
 * F665 à F669). Le moteur (la note, le plan, la tâche du matin) est dans
 * `farm-erasure.ts` ; ici, ce qui fait naître, annule ou avance une demande,
 * et la garde de l'espace figé.
 *
 * Le journal ne dit que des faits : jamais la personne, la ferme ni le nom tapé.
 */

/**
 * L'espace a une demande d'effacement ouverte : il est figé (F647, F666).
 * Lancée par la lecture de la personne connectée, avant toute lecture
 * d'Ouvre ta ferme et toute saisie ; l'écran de l'espace figé la rattrape.
 */
export class FarmFrozenError extends Error {
  readonly view: FrozenFarmView;
  readonly displayName: string;

  constructor(erasure: OpenFarmErasure, displayName: string) {
    super('Une demande d’effacement fige cet espace.');
    this.name = 'FarmFrozenError';
    this.view = frozenFarmView(erasure);
    this.displayName = displayName;
  }
}

/** La personne entre dans son espace : figé s'il a une demande ouverte. */
export async function assertSpaceNotFrozen(spaceKey: string, displayName: string): Promise<void> {
  const erasure = await readOpenFarmErasure(spaceKey);
  if (erasure) throw new FarmFrozenError(erasure, displayName);
}

type Answer = { ok: boolean; message: string };

/**
 * « Supprimer ma ferme et mes données », après avoir tapé le nom de la ferme
 * (F563, F665). Le nom se lit dans l'instantané déjà en cache de la saison
 * affichée : aucun appel à Ouvre ta ferme. Jamais en démonstration.
 */
export async function requestErasureOfSpace(
  spaceKey: string,
  input: { typedName?: unknown; season?: unknown },
  now = new Date(),
  log = logJsonLine,
): Promise<Answer> {
  if (isDemoDeployment()) return { ok: false, message: 'La démonstration ne s’efface pas : elle se remet à zéro chaque nuit.' };
  const season = typeof input.season === 'number' && Number.isInteger(input.season) ? input.season : null;
  const snapshot = season === null ? null : await readCachedIrrigationSnapshot(spaceKey, season);
  const decision = farmErasureRequestDecision(input.typedName, snapshot?.structure.name ?? null);
  if (!decision.ok) return decision;
  const erasure = await requestFarmErasure(spaceKey, now);
  if (!erasure) return { ok: false, message: 'Votre espace n’est pas trouvé : rechargez la page.' };
  log('info', { event: 'farm_erasure_requested', erasure: erasure.id });
  return { ok: true, message: farmErasureRequestedMessage(erasure.eraseAfter) };
}

/** « Annuler la demande », tant que l'effacement n'a pas commencé (F563, F667). */
export async function cancelErasureOfSpace(spaceKey: string, now = new Date(), log = logJsonLine): Promise<Answer> {
  const erasure = await readOpenFarmErasure(spaceKey);
  if (!erasure) return { ok: true, message: 'Aucune demande en cours : la ferme est ouverte.' };
  if (!await cancelFarmErasure(spaceKey, now)) {
    return { ok: false, message: 'L’effacement a commencé : il ne peut plus être annulé.' };
  }
  log('info', { event: 'farm_erasure_cancelled', erasure: erasure.id });
  return { ok: true, message: 'La demande est annulée : la ferme reprend dès maintenant, et les calculs du matin demain.' };
}

/**
 * L'effacement sans attendre, sur demande écrite de la personne à l'exploitant
 * (F563, F668) : le délai s'arrête maintenant et l'effacement passe tout de
 * suite, dans la même borne que le matin ; ce qui reste, le matin le finit.
 * L'appelant a vérifié que la personne est l'exploitant.
 */
export async function eraseNowOnWrittenRequest(
  input: { requestId?: unknown; typedFarm?: unknown },
  now = new Date(),
  log = logJsonLine,
  run = runDueFarmErasures,
): Promise<Answer> {
  const decision = immediateErasureDecision(input, await listOpenFarmErasures());
  if (!decision.ok) return decision;
  if (!await advanceFarmErasure(decision.request.id, now.toISOString())) {
    return { ok: false, message: 'La demande n’est plus en attente : rechargez la page.' };
  }
  log('info', { event: 'farm_erasure_advanced', erasure: decision.request.id });
  const report = await run({ now, log });
  if (report.failures.length > 0) {
    return { ok: false, message: 'L’effacement a commencé mais a échoué ; le prochain passage du matin le reprendra. Le journal du Worker dit la classe de l’erreur.' };
  }
  if (report.unfinished > 0) return { ok: true, message: 'L’effacement a commencé ; le prochain passage du matin le finira.' };
  return { ok: true, message: `L’effacement de la ${decision.request.otfFarmId === null ? 'demande' : `ferme ${decision.request.otfFarmId}`} est fait.` };
}
