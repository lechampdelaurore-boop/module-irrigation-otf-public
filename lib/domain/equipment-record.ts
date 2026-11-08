import type {
  EquipmentKind,
  EquipmentMobility,
  SprinklerProfilePoint,
} from './irrigation-domain.ts';

/**
 * Forme d'un matériel arrosant et de ses réglages, telle que le métier la
 * connaît. Décision D-020 : ces descriptions appartiennent au domaine, et
 * `db/` les importe pour dire ce qu'il lit et ce qu'il écrit.
 */

export type EquipmentStatus = 'active' | 'archived';

/**
 * Un réglage décrit comment le matériel distribue l'eau. Un asperseur porte
 * deux profils, un goutte-à-goutte un débit uniforme : les deux formes n'ont
 * pas les mêmes champs, et le type les distingue pour qu'aucun code ne lise
 * un profil là où il n'y en a pas.
 */
export type EquipmentSettingRecord =
  | {
      id: string;
      name: string;
      position: number;
      kind: 'sprinkler';
      leftProfile: SprinklerProfilePoint[];
      rightProfile: SprinklerProfilePoint[];
    }
  | {
      id: string;
      name: string;
      position: number;
      kind: 'drip';
      rateMmPerHour: number;
    };

export type EquipmentListItem = {
  id: string;
  name: string;
  kind: EquipmentKind;
  mobility: EquipmentMobility;
  status: EquipmentStatus;
  settingsCount: number;
  settings: EquipmentSettingRecord[];
  archivedAt: string | null;
};
