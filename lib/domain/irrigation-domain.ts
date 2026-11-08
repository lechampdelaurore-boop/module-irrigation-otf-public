const EQUIPMENT_KINDS = ['sprinkler', 'drip'] as const;
export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];

const EQUIPMENT_MOBILITIES = ['fixed', 'mobile'] as const;
export type EquipmentMobility = (typeof EQUIPMENT_MOBILITIES)[number];

export type IrrigationEventStatus = 'planned' | 'partially_completed' | 'completed' | 'canceled';

export type IrrigationTimerState = 'running' | 'paused';

export const MAX_SETTINGS_PER_EQUIPMENT = 10;
const MAX_EQUIPMENT_NAME_LENGTH = 80;
const MAX_SETTING_NAME_LENGTH = 80;
const MAX_PROFILE_POINTS_PER_SIDE = 100;

export type EquipmentDraftInput = {
  name: string;
  kind: string;
  mobility: string;
};

export type ValidEquipmentDraft = {
  name: string;
  kind: EquipmentKind;
  mobility: EquipmentMobility;
};

export type SprinklerProfilePoint = {
  distanceMeters: number;
  rateMmPerHour: number;
};

export type EquipmentSettingInput = {
  name: string;
  kind: string;
  rateMmPerHour?: number;
  leftProfile?: SprinklerProfilePoint[];
  rightProfile?: SprinklerProfilePoint[];
};

export type ValidEquipmentSettingInput =
  | {
      name: string;
      kind: 'sprinkler';
      leftProfile: SprinklerProfilePoint[];
      rightProfile: SprinklerProfilePoint[];
    }
  | {
      name: string;
      kind: 'drip';
      rateMmPerHour: number;
    };

export type EquipmentSettingDraft =
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

export type PlacementAnchor =
  | {
      type: 'bed_center';
      anchorBedOtfId: string;
    }
  | {
      type: 'between_beds';
      beforeBedOtfId: string;
      afterBedOtfId: string;
    };

export function validateEquipmentDraft(
  input: EquipmentDraftInput,
): { value: ValidEquipmentDraft | null; errors: string[] } {
  const errors: string[] = [];
  const name = input.name.trim().replace(/\s+/g, ' ');

  if (!name) {
    errors.push('Donnez un nom au matériel.');
  } else if (name.length > MAX_EQUIPMENT_NAME_LENGTH) {
    errors.push(
      `Le nom du matériel ne peut pas dépasser ${MAX_EQUIPMENT_NAME_LENGTH} caractères.`,
    );
  }

  if (!EQUIPMENT_KINDS.includes(input.kind as EquipmentKind)) {
    errors.push('Choisissez un type de matériel valide.');
  }
  if (!EQUIPMENT_MOBILITIES.includes(input.mobility as EquipmentMobility)) {
    errors.push('Indiquez si le matériel est fixe ou mobile.');
  }

  if (errors.length > 0) return { value: null, errors };

  return {
    value: {
      name,
      kind: input.kind as EquipmentKind,
      mobility: input.mobility as EquipmentMobility,
    },
    errors: [],
  };
}

export function validateEquipmentSettings(
  equipmentKind: EquipmentKind,
  settings: readonly EquipmentSettingDraft[],
): string[] {
  const errors: string[] = [];

  if (settings.length > MAX_SETTINGS_PER_EQUIPMENT) {
    errors.push(
      `Un matériel ne peut pas posséder plus de ${MAX_SETTINGS_PER_EQUIPMENT} réglages.`,
    );
  }

  const positions = new Set<number>();
  const normalizedNames = new Set<string>();

  for (const setting of settings) {
    if (setting.kind !== equipmentKind) {
      errors.push(
        `Le réglage « ${setting.name} » ne correspond pas au type du matériel.`,
      );
    }
    if (
      !Number.isInteger(setting.position) ||
      setting.position < 1 ||
      setting.position > 10
    ) {
      errors.push(
        `La position du réglage « ${setting.name} » doit être comprise entre 1 et 10.`,
      );
    }
    if (positions.has(setting.position)) {
      errors.push(
        `Deux réglages ne peuvent pas occuper la position ${setting.position}.`,
      );
    }
    positions.add(setting.position);

    const normalizedName = setting.name.trim().toLocaleLowerCase('fr-FR');
    if (!normalizedName) errors.push('Chaque réglage doit avoir un nom.');
    if (normalizedNames.has(normalizedName)) {
      errors.push(
        `Le nom de réglage « ${setting.name.trim()} » est déjà utilisé.`,
      );
    }
    normalizedNames.add(normalizedName);

    if (setting.kind === 'drip') {
      if (!isNonNegativeFinite(setting.rateMmPerHour)) {
        errors.push(
          `Le débit du réglage « ${setting.name} » doit être positif ou nul.`,
        );
      }
      continue;
    }

    errors.push(
      ...validateProfile(setting.name, 'gauche', setting.leftProfile),
    );
    errors.push(
      ...validateProfile(setting.name, 'droite', setting.rightProfile),
    );
  }

  return errors;
}

export function validateEquipmentSettingInput(
  input: EquipmentSettingInput,
): { value: ValidEquipmentSettingInput | null; errors: string[] } {
  const errors: string[] = [];
  const name = input.name.trim().replace(/\s+/g, ' ');

  if (!name) {
    errors.push('Donnez un nom au réglage.');
  } else if (name.length > MAX_SETTING_NAME_LENGTH) {
    errors.push(
      `Le nom du réglage ne peut pas dépasser ${MAX_SETTING_NAME_LENGTH} caractères.`,
    );
  }

  if (input.kind === 'drip') {
    if (!isNonNegativeFinite(input.rateMmPerHour ?? Number.NaN)) {
      errors.push('Le débit du réglage doit être positif ou nul.');
    }
    if (errors.length > 0) return { value: null, errors };

    return {
      value: {
        name,
        kind: 'drip',
        rateMmPerHour: input.rateMmPerHour as number,
      },
      errors: [],
    };
  }

  if (input.kind === 'sprinkler') {
    const leftProfile = normalizeProfile(input.leftProfile ?? []);
    const rightProfile = normalizeProfile(input.rightProfile ?? []);
    errors.push(...validateProfile(name, 'gauche', leftProfile));
    errors.push(...validateProfile(name, 'droite', rightProfile));

    if (leftProfile.length > MAX_PROFILE_POINTS_PER_SIDE) {
      errors.push(
        `Le profil gauche ne peut pas dépasser ${MAX_PROFILE_POINTS_PER_SIDE} points.`,
      );
    }
    if (rightProfile.length > MAX_PROFILE_POINTS_PER_SIDE) {
      errors.push(
        `Le profil droit ne peut pas dépasser ${MAX_PROFILE_POINTS_PER_SIDE} points.`,
      );
    }
    if (errors.length > 0) return { value: null, errors };

    return {
      value: {
        name,
        kind: 'sprinkler',
        leftProfile,
        rightProfile,
      },
      errors: [],
    };
  }

  errors.push('Choisissez un type de réglage valide.');
  return { value: null, errors };
}

export function canTransitionIrrigationEvent(
  from: IrrigationEventStatus,
  to: IrrigationEventStatus,
): boolean {
  if (from === to) return true;

  const allowed: Record<IrrigationEventStatus, IrrigationEventStatus[]> = {
    planned: ['partially_completed', 'completed', 'canceled'],
    partially_completed: ['completed'],
    completed: [],
    canceled: [],
  };

  return allowed[from].includes(to);
}

export function isFinalizedIrrigationStatus(
  status: IrrigationEventStatus,
): status is Extract<IrrigationEventStatus, 'completed' | 'partially_completed'> {
  return status === 'completed' || status === 'partially_completed';
}

function validateProfile(
  settingName: string,
  sideLabel: string,
  points: readonly SprinklerProfilePoint[],
): string[] {
  const errors: string[] = [];
  const distances = new Set<number>();

  if (points.length === 0) {
    return [
      `Le profil ${sideLabel} du réglage « ${settingName} » doit contenir au moins un point.`,
    ];
  }

  for (const point of points) {
    if (!isNonNegativeFinite(point.distanceMeters)) {
      errors.push(
        `Les distances du profil ${sideLabel} de « ${settingName} » doivent être positives ou nulles.`,
      );
    }
    if (!isNonNegativeFinite(point.rateMmPerHour)) {
      errors.push(
        `Les débits du profil ${sideLabel} de « ${settingName} » doivent être positifs ou nuls.`,
      );
    }
    if (distances.has(point.distanceMeters)) {
      errors.push(
        `La distance ${point.distanceMeters} m apparaît plusieurs fois dans le profil ${sideLabel} de « ${settingName} ».`,
      );
    }
    distances.add(point.distanceMeters);
  }

  if (!distances.has(0)) {
    errors.push(
      `Le profil ${sideLabel} du réglage « ${settingName} » doit commencer à 0 m.`,
    );
  }

  return errors;
}

function normalizeProfile(
  points: readonly SprinklerProfilePoint[],
): SprinklerProfilePoint[] {
  return points
    .map((point) => ({
      distanceMeters: point.distanceMeters,
      rateMmPerHour: point.rateMmPerHour,
    }))
    .sort((left, right) => left.distanceMeters - right.distanceMeters);
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
