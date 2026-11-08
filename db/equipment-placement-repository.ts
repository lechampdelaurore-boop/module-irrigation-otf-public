import { db } from './binding';
import {
  OPEN_POSE_UNCHANGED,
  historyInsertStatement,
  listEquipmentPosesForUser,
  listPosesOfEquipment,
  placementRecord,
  readCurrentPose,
  readIrrigationUses,
} from './equipment-placement-poses';
import { aEcritUneLigne } from './write-result';
import type { ValidEquipmentPlacementInput } from '@/lib/domain/equipment-placement-domain';
import {
  checkPlacementDate,
  checkRemovalDate,
  irrigationUseOfPlacement,
  posedPlacements,
  poseDateAt,
  poseDateRefusalMessage,
  samePlace,
  type PlacementPose,
  type PoseDateRefusal,
} from '@/lib/domain/equipment-placement-periods';
import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { EquipmentKind, PlacementAnchor } from '@/lib/domain/irrigation-domain';

/**
 * Positions du matériel, pose datée et stockage (sous-tranche 2.11,
 * docs/equipment-placement-periods-contract.md, D-043).
 *
 * La ligne de position est la pose courante d'un matériel pour une saison :
 * posé sans date de retrait, stocké avec. Une pose qui se ferme, par un
 * retrait ou un déplacement, est d'abord copiée dans le registre des poses,
 * en ajout seul ; rien ne s'efface (règle 8). La copie et la fermeture
 * partent dans le même lot, à la condition que la pose n'ait pas changé
 * depuis sa lecture : un double clic ne copie pas deux fois la même pose.
 */

export type RemoveEquipmentPlacementResult = 'removed' | 'not_found';

/** L'endroit et le réglage d'une pose, dans l'ordre de `placeValues`. */
const PLACE_ASSIGNMENTS = `setting_id = ?, garden_group_id = ?, otf_zone_id = ?,
  otf_plot_id = ?, anchor_type = ?, anchor_bed_otf_id = ?,
  before_bed_otf_id = ?, after_bed_otf_id = ?`;

/**
 * Le matériel posé d'une saison : ce que voient les besoins, la faisabilité,
 * le planning et la saisie d'une irrigation (règles 10 et 11). Un matériel
 * stocké n'y figure pas. Les dates restent en dehors : la position copiée
 * dans une irrigation garde sa forme (D-006).
 */
export async function listEquipmentPlacementsForUser(
  ownerUserId: string,
  season: number,
): Promise<EquipmentPlacementRecord[]> {
  const poses = await listEquipmentPosesForUser(ownerUserId, season);
  return posedPlacements(poses).map(placementRecord);
}

/**
 * Les poses d'un matériel pour une saison, fermées et courante ouverte, avec
 * leurs dates : la saisie d'une irrigation après coup y cherche la pose
 * ouverte à son heure de début (règle 12).
 */
export async function listPosesOfEquipmentForUser(
  ownerUserId: string,
  equipmentId: string,
  season: number,
): Promise<PlacementPose[]> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return [];
  return listPosesOfEquipment(workspaceId, equipmentId, season);
}

/**
 * Pose, repose ou déplace un matériel à la date `requestedAt`, instant ISO ;
 * une date en avance de deux minutes au plus sur l'heure du serveur vaut
 * maintenant (point ouvert 47), et c'est `at` qui s'enregistre.
 *
 * - Jamais posé cette saison : une pose s'ouvre (règles 3 et 4).
 * - Stocké : il est reposé, la pose courante reprend une date de pose et
 *   perd sa date de retrait ; la pose fermée est déjà au registre.
 * - Posé au même endroit : la pose reste ouverte et garde sa date ; seuls le
 *   réglage et le groupe suivent. `at` ne sert pas.
 * - Posé ailleurs : la pose courante se ferme à `at`, copiée au registre,
 *   et la nouvelle s'ouvre à la même date (« Déplacer », règles 5, 6 et 8).
 *
 * Une date refusée lève `EquipmentPlacementDateError`, avec son motif.
 */
export async function saveEquipmentPlacementForUser(
  ownerUserId: string,
  placement: ValidEquipmentPlacementInput,
  requestedAt: string,
): Promise<EquipmentPlacementRecord | null> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return null;

  const equipment = await db.prepare(
    `SELECT equipment.kind
     FROM irrigation_equipment AS equipment
     INNER JOIN irrigation_equipment_settings AS setting
       ON setting.equipment_id = equipment.id
     WHERE equipment.id = ?
       AND setting.id = ?
       AND equipment.workspace_id = ?
       AND equipment.status = 'active'
     LIMIT 1`,
  )
    .bind(placement.equipmentId, placement.settingId, workspaceId)
    .first<{ kind: EquipmentKind }>();
  if (!equipment) return null;

  assertPlacementMatchesEquipmentKind(equipment.kind, placement);
  if (placement.gardenGroupId) {
    const group = await db.prepare(
      `SELECT id FROM irrigation_garden_groups
       WHERE id = ? AND workspace_id = ? AND season = ? LIMIT 1`,
    )
      .bind(placement.gardenGroupId, workspaceId, placement.season)
      .first<{ id: string }>();
    if (!group) throw new EquipmentPlacementGroupError();
  }

  const current = await readCurrentPose(workspaceId, placement.equipmentId, placement.season);
  const now = new Date();
  const nowIso = now.toISOString();
  const at = poseDateAt(requestedAt, now);
  const placementId = current?.id ?? crypto.randomUUID();
  const anchorValues = placementAnchorValues(placement.anchor);
  const placeValues = [
    placement.settingId,
    placement.gardenGroupId,
    placement.otfZoneId,
    placement.otfPlotId,
    anchorValues.anchorType,
    anchorValues.anchorBedOtfId,
    anchorValues.beforeBedOtfId,
    anchorValues.afterBedOtfId,
  ];
  const statements: D1PreparedStatement[] = [];

  if (!current) {
    refuseIfDateRefused(checkPlacementDate({ placedAt: at, now, season: placement.season, current: null }));
    statements.push(
      db.prepare(
        `INSERT INTO irrigation_equipment_placements (
           id, workspace_id, equipment_id, season,
           setting_id, garden_group_id, otf_zone_id, otf_plot_id, anchor_type,
           anchor_bed_otf_id, before_bed_otf_id, after_bed_otf_id,
           placed_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(placementId, workspaceId, placement.equipmentId, placement.season, ...placeValues, at, nowIso),
    );
  } else if (current.removedAt !== null) {
    refuseIfDateRefused(checkPlacementDate({ placedAt: at, now, season: placement.season, current }));
    statements.push(
      db.prepare(
        `UPDATE irrigation_equipment_placements
         SET ${PLACE_ASSIGNMENTS}, placed_at = ?, removed_at = NULL, updated_at = ?
         WHERE id = ? AND workspace_id = ? AND removed_at IS NOT NULL AND updated_at = ?`,
      ).bind(...placeValues, at, nowIso, current.id, workspaceId, current.updatedAt),
    );
  } else if (samePlace(current, placement)) {
    statements.push(
      db.prepare(
        `UPDATE irrigation_equipment_placements
         SET ${PLACE_ASSIGNMENTS}, updated_at = ?
         WHERE id = ? AND workspace_id = ? AND removed_at IS NULL AND updated_at = ?`,
      ).bind(...placeValues, nowIso, current.id, workspaceId, current.updatedAt),
    );
  } else {
    const irrigations = await readIrrigationUses(workspaceId, current.id);
    refuseIfDateRefused(checkRemovalDate({
      removedAt: at,
      now,
      season: placement.season,
      current,
      irrigations: irrigationUseOfPlacement(irrigations, current.id),
    }));
    statements.push(
      historyInsertStatement(workspaceId, current, at),
      db.prepare(
        `UPDATE irrigation_equipment_placements
         SET ${PLACE_ASSIGNMENTS}, placed_at = ?, updated_at = ?
         WHERE ${OPEN_POSE_UNCHANGED}`,
      ).bind(...placeValues, at, nowIso, current.id, workspaceId, current.updatedAt),
    );
  }
  const poseStatementIndex = statements.length - 1;

  // Les planches ne changent que si la pose vient d'être écrite par ce lot.
  const writtenByThisBatch = `EXISTS (
    SELECT 1 FROM irrigation_equipment_placements
    WHERE id = ? AND updated_at = ?
  )`;
  statements.push(
    db.prepare(
      `DELETE FROM irrigation_placement_selected_beds
       WHERE placement_id = ? AND ${writtenByThisBatch}`,
    ).bind(placementId, placementId, nowIso),
  );
  placement.selectedBeds.forEach((bed, index) => {
    statements.push(
      db.prepare(
        `INSERT INTO irrigation_placement_selected_beds (
           placement_id, otf_zone_id, otf_plot_id, otf_bed_id, position
         ) SELECT ?, ?, ?, ?, ? WHERE ${writtenByThisBatch}`,
      ).bind(
        placementId,
        bed.otfZoneId,
        bed.otfPlotId,
        bed.otfBedId,
        index + 1,
        placementId,
        nowIso,
      ),
    );
  });

  const results = await db.batch(statements);
  if (!aEcritUneLigne(results[poseStatementIndex]?.meta)) {
    throw new EquipmentPlacementChangedError();
  }
  return {
    id: placementId,
    equipmentId: placement.equipmentId,
    settingId: placement.settingId,
    season: placement.season,
    gardenGroupId: placement.gardenGroupId,
    otfZoneId: placement.otfZoneId,
    otfPlotId: placement.otfPlotId,
    anchor: placement.anchor,
    selectedBeds: placement.selectedBeds,
  };
}

/**
 * Change le réglage appliqué à la position déjà enregistrée d'un matériel,
 * sans toucher à l'ancrage ni aux planches
 * (`docs/equipment-setting-change-contract.md`).
 *
 * Déplacer une rampe et changer sa buse sont deux gestes distincts sur la
 * ferme ; ils le sont aussi ici. Les planches couvertes n'ont pas à être
 * recalculées : une aspersion les déduit de l'ancrage et du profil, un
 * goutte-à-goutte les tient de sa sélection, que le réglage ne touche pas.
 * Un matériel stocké n'arrose rien : son réglage se choisit quand on le repose.
 */
export async function updateEquipmentPlacementSettingForUser(
  ownerUserId: string,
  equipmentId: string,
  season: number,
  settingId: string,
): Promise<EquipmentPlacementRecord | null> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return null;

  // Le réglage doit appartenir à ce matériel : sa nature est alors forcément la
  // bonne, la création l'ayant déjà imposée.
  const setting = await db.prepare(
    `SELECT setting.id
     FROM irrigation_equipment_settings AS setting
     INNER JOIN irrigation_equipment AS equipment
       ON equipment.id = setting.equipment_id
     WHERE setting.id = ?
       AND equipment.id = ?
       AND equipment.workspace_id = ?
       AND equipment.status = 'active'
     LIMIT 1`,
  )
    .bind(settingId, equipmentId, workspaceId)
    .first<{ id: string }>();
  if (!setting) return null;

  const existing = await db.prepare(
    `SELECT id FROM irrigation_equipment_placements
     WHERE equipment_id = ? AND season = ? AND workspace_id = ?
       AND removed_at IS NULL
     LIMIT 1`,
  )
    .bind(equipmentId, season, workspaceId)
    .first<{ id: string }>();
  if (!existing) return null;

  await db.prepare(
    `UPDATE irrigation_equipment_placements
     SET setting_id = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ? AND removed_at IS NULL`,
  )
    .bind(settingId, new Date().toISOString(), existing.id, workspaceId)
    .run();

  const placements = await listEquipmentPlacementsForUser(ownerUserId, season);
  return placements.find((placement) => placement.id === existing.id) ?? null;
}

/**
 * Retire un matériel posé et le stocke à la date `removedAt`, instant ISO :
 * la pose se ferme, copiée au registre des poses. Rien ne s'efface, même
 * quand le matériel a déjà arrosé : les irrigations gardent leur copie de la
 * position (règles 8 et 9). Une date refusée lève
 * `EquipmentPlacementDateError`, avec son motif (règles 3 à 6).
 */
export async function removeEquipmentPlacementForUser(
  ownerUserId: string,
  equipmentId: string,
  season: number,
  requestedRemovedAt: string,
): Promise<RemoveEquipmentPlacementResult> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return 'not_found';

  const current = await readCurrentPose(workspaceId, equipmentId, season);
  if (!current) return 'not_found';

  const now = new Date();
  const removedAt = poseDateAt(requestedRemovedAt, now);
  const irrigations = await readIrrigationUses(workspaceId, current.id);
  refuseIfDateRefused(checkRemovalDate({
    removedAt,
    now,
    season,
    current,
    irrigations: irrigationUseOfPlacement(irrigations, current.id),
  }));

  const results = await db.batch([
    historyInsertStatement(workspaceId, current, removedAt),
    db.prepare(
      `UPDATE irrigation_equipment_placements
       SET removed_at = ?, updated_at = ?
       WHERE ${OPEN_POSE_UNCHANGED}`,
    ).bind(removedAt, now.toISOString(), current.id, workspaceId, current.updatedAt),
  ]);
  if (!aEcritUneLigne(results.at(-1)?.meta)) throw new EquipmentPlacementChangedError();
  return 'removed';
}

function refuseIfDateRefused(refusal: PoseDateRefusal | null) {
  if (refusal) throw new EquipmentPlacementDateError(refusal);
}

function placementAnchorValues(anchor: PlacementAnchor) {
  if (anchor.type === 'bed_center') {
    return {
      anchorType: anchor.type,
      anchorBedOtfId: anchor.anchorBedOtfId,
      beforeBedOtfId: null,
      afterBedOtfId: null,
    };
  }
  return {
    anchorType: anchor.type,
    anchorBedOtfId: null,
    beforeBedOtfId: anchor.beforeBedOtfId,
    afterBedOtfId: anchor.afterBedOtfId,
  };
}

function assertPlacementMatchesEquipmentKind(
  kind: EquipmentKind,
  placement: ValidEquipmentPlacementInput,
) {
  if (kind === 'sprinkler') {
    if (placement.selectedBeds.length > 0) {
      throw new EquipmentPlacementKindError(
        'Une aspersion se place sur une planche ou entre deux planches.',
      );
    }
    return;
  }

  const anchor = placement.anchor;
  if (anchor.type !== 'bed_center' || placement.selectedBeds.length === 0) {
    throw new EquipmentPlacementKindError(
      'Sélectionnez au moins une planche pour le goutte-à-goutte.',
    );
  }
  if (
    !placement.selectedBeds.some(
      (bed) => bed.otfBedId === anchor.anchorBedOtfId,
    )
  ) {
    throw new EquipmentPlacementKindError(
      'La planche d’ancrage doit faire partie des planches sélectionnées.',
    );
  }
}

async function findWorkspaceId(ownerUserId: string): Promise<string | null> {
  const row = await db.prepare(
    `SELECT id FROM irrigation_workspaces
     WHERE owner_user_id = ? AND otf_farm_id IS NULL LIMIT 1`,
  )
    .bind(ownerUserId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export class EquipmentPlacementKindError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EquipmentPlacementKindError';
  }
}

export class EquipmentPlacementGroupError extends Error {
  constructor() {
    super('Le groupe de jardins sélectionné est introuvable pour cette saison.');
    this.name = 'EquipmentPlacementGroupError';
  }
}

/** Une date de pose ou de retrait refusée ; le message dit pourquoi (règles 3 à 6). */
export class EquipmentPlacementDateError extends Error {
  readonly refusal: PoseDateRefusal;

  constructor(refusal: PoseDateRefusal) {
    super(poseDateRefusalMessage(refusal));
    this.name = 'EquipmentPlacementDateError';
    this.refusal = refusal;
  }
}

/** La pose a changé entre sa lecture et son écriture : rien n'a été écrit. */
export class EquipmentPlacementChangedError extends Error {
  constructor() {
    super('La position de ce matériel vient de changer : rechargez la page et recommencez.');
    this.name = 'EquipmentPlacementChangedError';
  }
}
