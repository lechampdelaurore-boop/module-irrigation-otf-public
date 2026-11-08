'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { addSoilObservationForUser, addSoilRecordForUser, addSoilSettingsForUser, addSurfaceDeclarationForUser } from '@/db/soil-reserve/entries';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import type { SurfaceState } from '@/lib/domain/soil-reserve/bare-soil';
import type { SoilRecord, SoilSettingsRevision } from '@/lib/domain/soil-reserve/soil';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';
import { getSoilReserveViewForUser, type SoilReserveView } from '@/lib/services/soil-reserve-view';

/**
 * Les actions du bloc « Réserve du sol » (docs/soil-reserve-contract.md,
 * « L'écran », 5 ter, PR 3) : enregistrer le sol d'une parcelle ou la valeur
 * propre d'un jardin, les réglages de l'exploitation, une observation au
 * curseur et l'état de surface d'une planche sans culture. La parcelle, le
 * jardin et la planche doivent appartenir au plan de la saison lu chez Ouvre
 * ta ferme ; les règles de la saisie sont celles du dépôt.
 */

export type SoilReserveActionResult =
  | { ok: true; message: string; view: SoilReserveView }
  | { ok: false; message: string };

export async function saveSoilRecordAction(input: {
  season: number;
  record: Omit<SoilRecord, 'recordedAt'>;
}): Promise<SoilReserveActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const place = placeOf(snapshot, input.season, input.record.zoneId, input.record.plotId);
    if (!place.ok) return { ok: false, message: place.problem };
    const result = await addSoilRecordForUser(ownerUserId, input.record);
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    return {
      ok: true,
      message: place.saved,
      view: await getSoilReserveViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

export async function saveSoilSettingsAction(input: {
  season: number;
  revision: Omit<SoilSettingsRevision, 'recordedAt'>;
}): Promise<SoilReserveActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const result = await addSoilSettingsForUser(ownerUserId, input.revision);
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    return {
      ok: true,
      message: 'Les réglages de l’exploitation sont enregistrés.',
      view: await getSoilReserveViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

export async function saveSoilObservationAction(input: {
  season: number;
  zoneId: string;
  plotId: string | null;
  percent: number;
  observedAt: string;
}): Promise<SoilReserveActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const place = placeOf(snapshot, input.season, input.zoneId, input.plotId);
    if (!place.ok) return { ok: false, message: place.problem };
    const result = await addSoilObservationForUser(ownerUserId, {
      zoneId: input.zoneId,
      plotId: input.plotId,
      percent: input.percent,
      observedAt: input.observedAt,
    });
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    return {
      ok: true,
      message: input.plotId === null
        ? `L’observation de la parcelle, ${input.percent} % du plein, est enregistrée pour ses jardins de plein champ.`
        : `L’observation, ${input.percent} % du plein, est enregistrée.`,
      view: await getSoilReserveViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

export async function saveSurfaceDeclarationAction(input: {
  season: number;
  bedId: string;
  date: string;
  state: SurfaceState;
}): Promise<SoilReserveActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const bed = snapshot.beds.find((candidate) => candidate.id === input.bedId && candidate.seasons.includes(input.season));
    if (!bed) return { ok: false, message: 'Cette planche n’est pas dans le plan de la saison.' };
    const result = await addSurfaceDeclarationForUser(ownerUserId, { bedId: input.bedId, date: input.date, state: input.state });
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    return {
      ok: true,
      message: `L’état de surface de la planche ${bed.name} est enregistré.`,
      view: await getSoilReserveViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

function placeOf(
  snapshot: IrrigationSnapshot,
  season: number,
  zoneId: string,
  plotId: string | null,
): { ok: true; saved: string } | { ok: false; problem: string } {
  const zone = snapshot.zones.find((candidate) => candidate.id === zoneId && candidate.seasons.includes(season));
  if (!zone) return { ok: false, problem: 'Cette parcelle n’est pas dans le plan de la saison.' };
  if (plotId === null) return { ok: true, saved: 'Le sol de la parcelle est enregistré.' };
  const plot = snapshot.plots.find((candidate) => candidate.id === plotId && candidate.zoneId === zoneId && candidate.seasons.includes(season));
  if (!plot) return { ok: false, problem: 'Ce jardin n’est pas dans cette parcelle pour la saison.' };
  return { ok: true, saved: plot.mode === 'greenhouse' ? 'La valeur propre de l’abri est enregistrée.' : 'La valeur propre du jardin est enregistrée.' };
}

async function withContext(
  season: number,
  operation: (context: { ownerUserId: string; snapshot: IrrigationSnapshot }) => Promise<SoilReserveActionResult>,
): Promise<SoilReserveActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(season) || season < 1900 || season > 9999) return { ok: false, message: 'Saison invalide.' };
  try {
    const snapshot = await getIrrigationSnapshot(user.userId, { season });
    return await operation({ ownerUserId: user.userId, snapshot });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'L’enregistrement n’a pas pu se faire.' };
  }
}
