import type { Plot, Bed } from '../domain.ts';
import { shelterFactorOn, type CropWaterOptions, type ShadeNet } from './etm.ts';
import type { KcOverride } from './kc.ts';
import { curveStages, type ReferenceCrop } from './reference.ts';

/**
 * Ce que la page « Coefficients culturaux » montre des surcharges de Kc et
 * des réglages du calcul (docs/crop-water-need-contract.md, « Les
 * facteurs », « L'écran », 5 quater, PR 3c). Rien n'est réécrit : une
 * surcharge, un K_abri sont des révisions datées ; la valeur d'origine reste
 * lisible à côté de celle qui compte.
 */

type OverrideTarget = KcOverride['target'];

/** Une valeur de Kc que la ferme peut surcharger : un stade, ou l'un des trois Kc de la FAO. */
export type KcOverrideRow = {
  key: string;
  target: OverrideTarget;
  label: string;
  /** La valeur de la source, avant abattement. */
  sourceKc: number;
  /** La surcharge qui compte aujourd'hui ; `kc` nul : retour à la valeur de la source. */
  inForce: KcOverride | null;
  /** Les surcharges de cette valeur, la plus récente d'abord, à venir comprises. */
  history: KcOverride[];
};

const FAO_POINTS = [
  { fao: 'initial', label: 'Kc début' },
  { fao: 'mid', label: 'Kc pleine saison' },
  { fao: 'end', label: 'Kc fin' },
] as const;

export function overrideTargetKey(target: OverrideTarget): string {
  return 'fao' in target ? `fao:${target.fao}` : `rank:${target.rank}`;
}

export function overrideTargetOfKey(key: string): OverrideTarget | null {
  const [kind, value] = key.split(':');
  if (kind === 'fao' && (value === 'initial' || value === 'mid' || value === 'end')) return { fao: value };
  if (kind === 'rank' && /^\d+$/.test(value ?? '')) return { rank: Number(value) };
  return null;
}

/** Les valeurs surchargeables d'une culture, avec la surcharge du jour et leur histoire. */
export function kcOverrideRows(crop: ReferenceCrop, overrides: readonly KcOverride[], today: string): KcOverrideRow[] {
  const curve = crop.curve;
  const values: { target: OverrideTarget; label: string; sourceKc: number }[] = curve.shape === 'trapezoid'
    ? FAO_POINTS.map((point) => ({
        target: { fao: point.fao },
        label: point.label,
        sourceKc: point.fao === 'initial' ? curve.kcInitial : point.fao === 'mid' ? curve.kcMid : curve.kcEnd,
      }))
    : curveStages(curve).map((stage) => ({ target: { rank: stage.rank }, label: stage.label, sourceKc: kcOfRank(crop, stage.rank) }));
  return values.map((value) => {
    const key = overrideTargetKey(value.target);
    const mine = overrides.filter((override) => override.referenceCropId === crop.id && overrideTargetKey(override.target) === key);
    return {
      key,
      ...value,
      inForce: latestOn(mine, today),
      history: [...mine].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.recordedAt.localeCompare(a.recordedAt)),
    };
  });
}

function kcOfRank(crop: ReferenceCrop, rank: number): number {
  const curve = crop.curve;
  if (curve.shape === 'trapezoid') return 0;
  const stages = curve.shape === 'calendar' && curve.establishment ? [curve.establishment, ...curve.stages] : curve.stages;
  return stages.find((stage) => stage.rank === rank)?.kc ?? 0;
}

/** La dernière révision valable ce jour-là : le jour le plus tardif, puis l'enregistrement le plus récent (comme le calcul). */
function latestOn<T extends { effectiveFrom: string; recordedAt: string }>(revisions: readonly T[], date: string): T | null {
  let chosen: T | null = null;
  for (const revision of revisions) {
    if (revision.effectiveFrom > date) continue;
    if (chosen === null || revision.effectiveFrom > chosen.effectiveFrom
      || (revision.effectiveFrom === chosen.effectiveFrom && revision.recordedAt >= chosen.recordedAt)) chosen = revision;
  }
  return chosen;
}

type ShelterRevision = { shelterId: string; value: number; effectiveFrom: string; recordedAt: string };
type StoredNet = ShadeNet & { id: string };

/** Les réglages tels que la base les rend (`db/crop-water/settings.ts`). */
export type CropWaterSettingsInput = {
  shelterFactors: readonly ShelterRevision[];
  mulch: readonly { bedId: string; season: number; plasticMulch: boolean }[];
  shadeNets: readonly StoredNet[];
  options: CropWaterOptions;
};

export type ShelterSetting = {
  plotId: string;
  name: string;
  /** Le K_abri d'aujourd'hui. */
  factor: number;
  /** Aucune révision ne compte aujourd'hui : c'est la valeur par défaut du CRIIAM. */
  isDefault: boolean;
  /** Les révisions, la plus récente d'abord, à venir comprises. */
  history: ShelterRevision[];
};

export type BedSetting = {
  bedId: string;
  name: string;
  plotName: string;
  sheltered: boolean;
  plasticMulch: boolean;
  /** Les filets de la planche, le plus récent d'abord. */
  nets: StoredNet[];
};

export type CropWaterSettingsView = {
  today: string;
  options: CropWaterOptions;
  shelters: ShelterSetting[];
  beds: BedSetting[];
};

/**
 * Les réglages d'une saison : un abri par jardin sous abri (son K_abri), les
 * planches de la saison avec leur paillage plastique et leurs filets
 * d'ombrage, et les options de la ferme.
 */
export function cropWaterSettingsView(input: {
  plots: readonly Plot[];
  beds: readonly Bed[];
  settings: CropWaterSettingsInput;
  season: number;
  today: string;
}): CropWaterSettingsView {
  const { settings, season, today } = input;
  const plots = input.plots.filter((plot) => plot.seasons.includes(season));
  const plotById = new Map(plots.map((plot) => [plot.id, plot]));
  const shelters = plots
    .filter((plot) => plot.mode === 'greenhouse')
    .map((plot) => {
      const mine = settings.shelterFactors.filter((revision) => revision.shelterId === plot.id);
      return {
        plotId: plot.id,
        name: plot.name,
        factor: shelterFactorOn({ shelterId: plot.id, shelterFactors: mine }, today),
        isDefault: latestOn(mine, today) === null,
        history: [...mine].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.recordedAt.localeCompare(a.recordedAt)),
      };
    });
  const beds = input.beds
    .filter((bed) => bed.seasons.includes(season) && plotById.has(bed.plotId))
    .map((bed) => {
      const plot = plotById.get(bed.plotId)!;
      return {
        bedId: bed.id,
        name: bed.name,
        plotName: plot.name,
        sheltered: plot.mode === 'greenhouse',
        plasticMulch: settings.mulch.some((setting) => setting.bedId === bed.id && setting.season === season && setting.plasticMulch),
        nets: settings.shadeNets.filter((net) => net.bedId === bed.id).sort((a, b) => b.from.localeCompare(a.from)),
      };
    });
  return { today, options: settings.options, shelters, beds };
}
