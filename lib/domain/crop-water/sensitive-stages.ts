import { curveStages, type ReferenceCrop } from './reference.ts';

/**
 * Les stades sensibles au manque d'eau (amélioration n° 4,
 * docs/ameliorations-4-5-contract.md, §3.1, F730) : pour chaque culture de
 * référence qui sert la ferme — la commune, ou la version de la ferme qui la
 * remplace —, chaque stade de sa table est sensible ou non. La valeur en
 * vigueur est le choix de la ferme, sinon la liste préremplie commune, sinon
 * « non sensible ».
 *
 * Un choix et une ligne de la liste désignent un stade par son rang **et son
 * nom** : quand la table des stades d'une culture change, ce qui ne
 * correspond plus au stade de ce rang ne s'applique pas. Un conseil ne
 * s'appuie jamais sur un stade qui a changé de sens.
 *
 * Ce module ne lit ni n'écrit rien : la liste commune et les choix de la
 * ferme sont des données que la persistance apporte.
 */

/** Un stade désigné : la culture de référence (sa clé), le rang et le nom du stade. */
type StageDesignation = { cropKey: string; rank: number; label: string };

/** La confiance d'une ligne de la liste préremplie : la culture est dans la source, ou rapprochée d'une voisine. */
export type SensitiveStageConfidence = 'source-directe' | 'analogie';

/** Une ligne de la liste préremplie commune : un stade sensible d'une culture du jeu commun. */
export type SensitiveStageReference = StageDesignation & { confidence: SensitiveStageConfidence; source: string };

/** Le choix d'une ferme pour un stade : sensible ou non, quoi que dise la liste préremplie. */
export type SensitiveStageChoice = StageDesignation & { sensitive: boolean };

/** D'où vient la valeur d'un stade : le choix de la ferme, la liste préremplie, ou rien (non sensible). */
export type SensitiveStageOrigin = 'farm' | 'reference' | 'none';

export type SensitiveStageRow = {
  rank: number;
  label: string;
  sensitive: boolean;
  origin: SensitiveStageOrigin;
  /** La ligne de la liste préremplie qui désigne ce stade, que la ferme la suive ou non ; `null` sans ligne. */
  reference: Pick<SensitiveStageReference, 'confidence' | 'source'> | null;
};

const designates = (crop: ReferenceCrop, stage: { rank: number; label: string }) =>
  (entry: StageDesignation) => entry.cropKey === crop.id && entry.rank === stage.rank && entry.label === stage.label;

/** Les stades d'une culture, dans l'ordre de sa table, chacun avec sa valeur en vigueur et d'où elle vient. */
export function cropSensitiveStages(
  crop: ReferenceCrop,
  references: readonly SensitiveStageReference[],
  choices: readonly SensitiveStageChoice[],
): SensitiveStageRow[] {
  return curveStages(crop.curve).map((stage) => {
    const line = references.find(designates(crop, stage));
    const reference = line ? { confidence: line.confidence, source: line.source } : null;
    const choice = choices.find(designates(crop, stage));
    if (choice) return { rank: stage.rank, label: stage.label, sensitive: choice.sensitive, origin: 'farm', reference };
    return { rank: stage.rank, label: stage.label, sensitive: reference !== null, origin: reference ? 'reference' : 'none', reference };
  });
}

/** La clé d'un stade sensible : la culture, le rang et le nom du stade. */
export function sensitiveStageKey(cropKey: string, rank: number, label: string): string {
  return JSON.stringify([cropKey, rank, label]);
}

/** Les stades sensibles en vigueur de toutes les cultures qui servent la ferme. */
export function sensitiveStageKeys(
  crops: readonly ReferenceCrop[],
  references: readonly SensitiveStageReference[],
  choices: readonly SensitiveStageChoice[],
): ReadonlySet<string> {
  return new Set(crops.flatMap((crop) => cropSensitiveStages(crop, references, choices)
    .filter((row) => row.sensitive)
    .map((row) => sensitiveStageKey(crop.id, row.rank, row.label))));
}

/**
 * Les choix d'une ferme pour une culture, quand elle coche ses stades
 * sensibles : un choix pour chaque stade dont la valeur voulue diffère de la
 * liste préremplie, rien pour les autres, qui suivent la liste (et ses
 * corrections à venir). Ces choix remplacent tous ceux que la ferme avait
 * pour cette culture : cocher comme la liste, c'est revenir à la liste.
 * Une culture qui ne sert pas la ferme, ou un rang absent de sa table, est
 * refusé.
 */
export function sensitiveStageChoicesFor(input: {
  cropKey: string;
  /** La culture de référence de cette clé qui sert la ferme ; `undefined` si aucune. */
  crop: ReferenceCrop | undefined;
  references: readonly SensitiveStageReference[];
  sensitiveRanks: readonly number[];
}): { ok: true; cropName: string; choices: SensitiveStageChoice[] } | { ok: false; problems: string[] } {
  const { crop } = input;
  if (crop === undefined) return { ok: false, problems: [`Culture de référence inconnue : ${input.cropKey}.`] };
  const rows = cropSensitiveStages(crop, input.references, []);
  const unknown = [...new Set(input.sensitiveRanks)].filter((rank) => !rows.some((row) => row.rank === rank));
  if (unknown.length > 0) {
    return { ok: false, problems: unknown.map((rank) => `${crop.name} : le stade ${rank} n’existe pas dans sa table.`) };
  }
  const wanted = new Set(input.sensitiveRanks);
  return {
    ok: true,
    cropName: crop.name,
    choices: rows
      .filter((row) => row.sensitive !== wanted.has(row.rank))
      .map((row) => ({ cropKey: crop.id, rank: row.rank, label: row.label, sensitive: wanted.has(row.rank) })),
  };
}
