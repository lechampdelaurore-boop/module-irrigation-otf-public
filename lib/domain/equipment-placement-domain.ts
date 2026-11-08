import type { PlacementAnchor } from './irrigation-domain';

const MAX_EXTERNAL_ID_LENGTH = 200;

export type PlacementBedInput = {
  otfZoneId: string;
  otfPlotId: string;
  otfBedId: string;
};

export type EquipmentPlacementInput = {
  equipmentId: string;
  settingId: string;
  season: number;
  gardenGroupId: string | null;
  otfZoneId: string;
  otfPlotId: string;
  anchor: PlacementAnchor;
  selectedBeds: PlacementBedInput[];
};

export type ValidEquipmentPlacementInput = EquipmentPlacementInput;

export function validateEquipmentPlacementInput(
  input: EquipmentPlacementInput,
): { value: ValidEquipmentPlacementInput | null; errors: string[] } {
  const errors: string[] = [];
  const equipmentId = normalizeId(input.equipmentId);
  const settingId = normalizeId(input.settingId);
  const gardenGroupId = input.gardenGroupId
    ? normalizeId(input.gardenGroupId)
    : null;
  const otfZoneId = normalizeId(input.otfZoneId);
  const otfPlotId = normalizeId(input.otfPlotId);

  if (!equipmentId) errors.push('Choisissez un matériel valide.');
  if (!settingId) errors.push('Choisissez un réglage valide.');
  if (input.gardenGroupId !== null && !gardenGroupId) {
    errors.push('Choisissez un groupe de jardins valide.');
  }
  if (!Number.isInteger(input.season) || input.season < 1900 || input.season > 9999) {
    errors.push('Choisissez une saison valide.');
  }
  if (!otfZoneId || !otfPlotId) {
    errors.push('Choisissez un jardin ou un abri valide.');
  }

  const anchor = normalizeAnchor(input.anchor, errors);
  const selectedBeds: PlacementBedInput[] = [];
  const selectedBedIds = new Set<string>();
  for (const bed of input.selectedBeds) {
    const normalized = {
      otfZoneId: normalizeId(bed.otfZoneId),
      otfPlotId: normalizeId(bed.otfPlotId),
      otfBedId: normalizeId(bed.otfBedId),
    };
    if (!normalized.otfZoneId || !normalized.otfPlotId || !normalized.otfBedId) {
      errors.push('Une planche sélectionnée est invalide.');
      continue;
    }
    if (selectedBedIds.has(normalized.otfBedId)) {
      errors.push('Une même planche ne peut être sélectionnée qu’une fois.');
      continue;
    }
    selectedBedIds.add(normalized.otfBedId);
    selectedBeds.push(normalized);
  }

  if (errors.length > 0 || !anchor) return { value: null, errors };

  return {
    value: {
      equipmentId,
      settingId,
      season: input.season,
      gardenGroupId,
      otfZoneId,
      otfPlotId,
      anchor,
      selectedBeds,
    },
    errors: [],
  };
}

function normalizeAnchor(
  anchor: PlacementAnchor,
  errors: string[],
): PlacementAnchor | null {
  if (anchor.type === 'bed_center') {
    const anchorBedOtfId = normalizeId(anchor.anchorBedOtfId);
    if (!anchorBedOtfId) {
      errors.push('Choisissez une planche pour placer le matériel.');
      return null;
    }
    return { type: 'bed_center', anchorBedOtfId };
  }

  if (anchor.type === 'between_beds') {
    const beforeBedOtfId = normalizeId(anchor.beforeBedOtfId);
    const afterBedOtfId = normalizeId(anchor.afterBedOtfId);
    if (!beforeBedOtfId || !afterBedOtfId || beforeBedOtfId === afterBedOtfId) {
      errors.push('Choisissez deux planches voisines distinctes.');
      return null;
    }
    return { type: 'between_beds', beforeBedOtfId, afterBedOtfId };
  }

  errors.push('Choisissez un emplacement valide.');
  return null;
}

function normalizeId(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_EXTERNAL_ID_LENGTH) return '';
  return normalized;
}
