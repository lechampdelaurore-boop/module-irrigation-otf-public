const MAX_GARDEN_GROUP_NAME_LENGTH = 80;
const MAX_GARDEN_GROUP_MEMBERS = 100;

export type GardenBedOrder = 'normal' | 'reversed';

type GardenGroupMemberInput = {
  otfZoneId: string;
  otfPlotId: string;
  bedOrder: string;
  gapBeforeMeters: number;
};

export type GardenGroupInput = {
  name: string;
  season: number;
  members: GardenGroupMemberInput[];
};

type ValidGardenGroupMember = {
  otfZoneId: string;
  otfPlotId: string;
  position: number;
  bedOrder: GardenBedOrder;
  gapBeforeMeters: number;
};

export type ValidGardenGroupInput = {
  name: string;
  season: number;
  members: ValidGardenGroupMember[];
};

export function validateGardenGroupInput(
  input: GardenGroupInput,
): { value: ValidGardenGroupInput | null; errors: string[] } {
  const errors: string[] = [];
  const name = input.name.trim().replace(/\s+/g, ' ');

  if (!name) {
    errors.push('Donnez un nom au groupe de jardins.');
  } else if (name.length > MAX_GARDEN_GROUP_NAME_LENGTH) {
    errors.push(
      `Le nom du groupe ne peut pas dépasser ${MAX_GARDEN_GROUP_NAME_LENGTH} caractères.`,
    );
  }

  if (!Number.isInteger(input.season) || input.season < 1900 || input.season > 9999) {
    errors.push('La saison du groupe est invalide.');
  }
  if (input.members.length < 2) {
    errors.push('Un groupe doit contenir au moins deux jardins ou abris.');
  } else if (input.members.length > MAX_GARDEN_GROUP_MEMBERS) {
    errors.push(
      `Un groupe ne peut pas dépasser ${MAX_GARDEN_GROUP_MEMBERS} jardins ou abris.`,
    );
  }

  const plotIds = new Set<string>();
  const members = input.members.map((member, index) => {
    const otfZoneId = member.otfZoneId.trim();
    const otfPlotId = member.otfPlotId.trim();
    if (!otfZoneId || !otfPlotId || otfZoneId.length > 200 || otfPlotId.length > 200) {
      errors.push(`Le jardin placé en position ${index + 1} est invalide.`);
    }
    if (plotIds.has(otfPlotId)) {
      errors.push('Un jardin ne peut apparaître qu’une fois dans le même groupe.');
    }
    plotIds.add(otfPlotId);

    const bedOrder = member.bedOrder as GardenBedOrder;
    if (bedOrder !== 'normal' && bedOrder !== 'reversed') {
      errors.push(`Le sens du jardin placé en position ${index + 1} est invalide.`);
    }
    if (!Number.isFinite(member.gapBeforeMeters) || member.gapBeforeMeters < 0) {
      errors.push(`La distance avant le jardin placé en position ${index + 1} est invalide.`);
    }

    return {
      otfZoneId,
      otfPlotId,
      position: index + 1,
      bedOrder,
      gapBeforeMeters: index === 0 ? 0 : member.gapBeforeMeters,
    };
  });

  if (errors.length > 0) return { value: null, errors };
  return { value: { name, season: input.season, members }, errors: [] };
}
