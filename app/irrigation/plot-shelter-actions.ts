'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { savePlotSheltersForUser, type PlotShelterAnswer } from '@/db/plot-shelter-repository';
import { plotShelterLines, seasonPlots, type PlotShelterLine } from '@/lib/domain/onboarding/plots';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';

/**
 * « Parcelles et abris », dans Réglages (4.4, docs/tranche-4-contract.md,
 * F420, F583) : la personne classe chaque jardin de la saison, abri ou plein
 * champ, ou le laisse « à classer » ; ou confirme d'un geste les propositions
 * qui restent, après les avoir lues. Le jardin doit appartenir au plan de la
 * saison lu chez Ouvre ta ferme ; un espace qui ne fait pas l'accueil n'a
 * rien à classer ici (F426).
 */

export type PlotShelterActionResult =
  | { ok: true; message: string; lines: PlotShelterLine[] }
  | { ok: false; message: string };

type Answer = 'sheltered' | 'open-field' | 'unknown';

export async function savePlotShelterAction(input: { season: number; plotId: string; answer: Answer }): Promise<PlotShelterActionResult> {
  if (!['sheltered', 'open-field', 'unknown'].includes(input.answer)) return { ok: false, message: 'Réponse invalide.' };
  return withLines(input.season, (lines) => {
    const line = lines.find((item) => item.plotId === input.plotId);
    if (!line) return { problem: 'Ce jardin n’est pas dans le plan de la saison.' };
    const sheltered = input.answer === 'unknown' ? null : input.answer === 'sheltered';
    return {
      answers: [{ plotId: line.plotId, sheltered, proposedSheltered: line.proposedSheltered }],
      message: sheltered === null ? `${line.name} reste à classer.` : `${line.name} : ${sheltered ? 'abri' : 'plein champ'}, enregistré.`,
    };
  });
}

export async function confirmRemainingProposalsAction(input: { season: number }): Promise<PlotShelterActionResult> {
  return withLines(input.season, (lines) => {
    const remaining = lines.filter((line) => line.state === 'unclassified');
    if (remaining.length === 0) return { problem: 'Chaque jardin est déjà classé.' };
    return {
      answers: remaining.map((line) => ({ plotId: line.plotId, sheltered: line.proposedSheltered, proposedSheltered: line.proposedSheltered })),
      message: `${remaining.length} jardin${remaining.length > 1 ? 's' : ''} classé${remaining.length > 1 ? 's' : ''} comme proposé.`,
    };
  });
}

/** La ligne après la réponse, sans relire le plan : la réponse vient d'être écrite telle quelle. */
function answered(line: PlotShelterLine, answers: readonly PlotShelterAnswer[]): PlotShelterLine {
  const answer = answers.find((item) => item.plotId === line.plotId);
  if (!answer) return line;
  if (answer.sheltered === null) return { ...line, state: 'unclassified', origin: null };
  return {
    ...line,
    state: answer.sheltered ? 'sheltered' : 'open-field',
    origin: answer.sheltered === line.proposedSheltered ? 'proposition confirmée' : 'proposition corrigée',
  };
}

async function withLines(
  season: number,
  decide: (lines: PlotShelterLine[]) => { answers: PlotShelterAnswer[]; message: string } | { problem: string },
): Promise<PlotShelterActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(season) || season < 1900 || season > 9999) return { ok: false, message: 'Saison invalide.' };
  try {
    const snapshot = await getIrrigationSnapshot(user.userId, { season });
    const lines = plotShelterLines(snapshot, season);
    if (lines === null) return { ok: false, message: 'Le classement de vos jardins est déjà celui d’Ouvre ta ferme.' };
    const decision = decide(lines);
    if ('problem' in decision) return { ok: false, message: decision.problem };
    await savePlotSheltersForUser(user.userId, {
      answers: decision.answers,
      planPlotIds: seasonPlots(snapshot, season).map((plot) => plot.id),
      at: new Date().toISOString(),
    });
    return { ok: true, message: decision.message, lines: lines.map((line) => answered(line, decision.answers)) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'L’enregistrement n’a pas pu se faire.' };
  }
}
