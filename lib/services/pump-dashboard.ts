import { listPumpConfigurationForUser } from '@/db/pump-repository';
import { listWaterInfrastructureForUser } from '@/db/water-resource-repository';
import type { WaterInfrastructure } from '../domain/water-resources';
import type { EquipmentPumpDefault, IrrigationPump } from '../domain/pumps';

export type PumpDashboard = {
  pumps: IrrigationPump[];
  equipmentDefaults: EquipmentPumpDefault[];
  infrastructure: WaterInfrastructure;
};

/**
 * Une ferme sans pompe ni ressource déclarée : ce que voit une ferme qui n'a
 * pas coché « Ressources et pompes » (3.8, docs/feature-selection-contract.md,
 * R1). Ses pompes et ses ressources restent enregistrées.
 */
export function emptyPumpDashboard(): PumpDashboard {
  return {
    pumps: [],
    equipmentDefaults: [],
    infrastructure: { resources: [], resourceLimits: [], reservoirs: [], resourceReservoirLinks: [], reservoirLinks: [], defaultSupply: null, movements: [] },
  };
}

export async function getPumpDashboardForUser(ownerUserId: string): Promise<PumpDashboard> {
  const [configuration, infrastructure] = await Promise.all([
    listPumpConfigurationForUser(ownerUserId),
    listWaterInfrastructureForUser(ownerUserId),
  ]);
  return { ...configuration, infrastructure };
}
