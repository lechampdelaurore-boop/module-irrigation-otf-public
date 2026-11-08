'use client';

import type { ClosedPlacementPose } from '@/db/equipment-placement-poses';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import type { PlacementPose } from '@/lib/domain/equipment-placement-periods';
import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import { requestPlannedIrrigationForm } from '@/lib/domain/feasibility-notifications';
import { pagePath } from '@/lib/domain/features/pages';
import type { GardenGroupConfiguration } from '@/lib/domain/garden-group-record';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import type { ProtectedSlot } from '@/lib/domain/planning/protected-slots';
import type { PumpDashboard } from '@/lib/services/pump-dashboard';
import type { WaterDashboard } from '@/lib/services/water-dashboard';
import { IrrigationEventManager } from '../irrigation-event-manager';
import { hrefWithIntent, useUrlIntent } from '../shell/url-intent';
import { WaterManagementDashboard } from '../water-management-dashboard';

/**
 * La page « Arrosages » (3.8, docs/feature-selection-contract.md, section 5) :
 * irriguer maintenant, planifier, saisir un arrosage fait, les irrigations à
 * venir ou à terminer, puis l'eau du jour et la limite journalière (P15).
 */
export function ArrosagesPage({
  season,
  initialNowIso,
  snapshot,
  equipment,
  equipmentPlacements,
  equipmentPoses,
  equipmentPoseHistory,
  gardenGroupConfiguration,
  irrigationEvents,
  pumpDashboard,
  lateToleranceMinutes,
  protectedSlots,
  waterDashboard,
  planningEnabled,
  pumpsEnabled,
}: {
  season: number;
  initialNowIso: string;
  snapshot: IrrigationSnapshot;
  equipment: EquipmentListItem[];
  equipmentPlacements: EquipmentPlacementRecord[];
  equipmentPoses: PlacementPose[];
  equipmentPoseHistory: ClosedPlacementPose[];
  gardenGroupConfiguration: GardenGroupConfiguration;
  irrigationEvents: IrrigationEventRecord[];
  pumpDashboard: PumpDashboard;
  lateToleranceMinutes: number;
  /** Les créneaux protégés, Planning coché seulement : « Planifier » avertit d'un arrosage qui y tombe (3.8 ter, règle 12). */
  protectedSlots: ProtectedSlot[];
  waterDashboard: WaterDashboard;
  /** « Recalculer le plan » sur un arrosage en retard conduit au planning, s'il est coché. */
  planningEnabled: boolean;
  /** Le choix de la pompe, avec la case « Ressources et pompes » (R1). */
  pumpsEnabled: boolean;
}) {
  // « Ajouter un créneau à la main » depuis le planning ouvre ici le formulaire « Planifier » (`?planifier=1`).
  useUrlIntent('planifier', () => requestPlannedIrrigationForm());

  return (
    <>
      <IrrigationEventManager
        season={season}
        initialNowIso={initialNowIso}
        equipment={equipment}
        placements={equipmentPlacements}
        poses={equipmentPoses}
        poseHistory={equipmentPoseHistory}
        groups={gardenGroupConfiguration.groups}
        beds={snapshot.beds.filter((bed) => bed.seasons.includes(season))}
        events={irrigationEvents}
        pumpDashboard={pumpDashboard}
        pumpsEnabled={pumpsEnabled}
        lateToleranceMinutes={lateToleranceMinutes}
        protectedSlots={protectedSlots}
        onRecalculatePlan={planningEnabled
          ? () => window.location.assign(hrefWithIntent(pagePath('planning'), season, 'recalculer', '1'))
          : undefined}
      />
      <WaterManagementDashboard season={season} snapshot={snapshot} initialDashboard={waterDashboard} part="arrosages" />
    </>
  );
}
