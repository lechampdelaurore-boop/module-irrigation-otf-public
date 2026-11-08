import type {
  SprinklerProfilePoint,
  ValidEquipmentSettingInput,
} from './irrigation-domain';

export type EquipmentSettingCopySource =
  | {
      name: string;
      position: number;
      kind: 'sprinkler';
      leftProfile: readonly SprinklerProfilePoint[];
      rightProfile: readonly SprinklerProfilePoint[];
    }
  | {
      name: string;
      position: number;
      kind: 'drip';
      rateMmPerHour: number;
    };

export type EquipmentSettingCopy = {
  position: number;
  setting: ValidEquipmentSettingInput;
};

export function copyEquipmentSettings(
  settings: readonly EquipmentSettingCopySource[],
): EquipmentSettingCopy[] {
  return [...settings]
    .sort((left, right) => left.position - right.position)
    .map((source) => {
      if (source.kind === 'drip') {
        return {
          position: source.position,
          setting: {
            name: source.name,
            kind: 'drip' as const,
            rateMmPerHour: source.rateMmPerHour,
          },
        };
      }
      return {
        position: source.position,
        setting: {
          name: source.name,
          kind: 'sprinkler' as const,
          leftProfile: source.leftProfile.map((point) => ({ ...point })),
          rightProfile: source.rightProfile.map((point) => ({ ...point })),
        },
      };
    });
}
