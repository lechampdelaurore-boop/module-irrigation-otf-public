import type { IrrigationSnapshot, Plot } from '../domain.ts';
import type { ResolvedOnboarding } from './steps.ts';

/**
 * Parcelles et abris (4.4, docs/tranche-4-contract.md, F420 ; PR 2b, F583) :
 * pour un espace qui fait l'accueil, chaque jardin est abri ou plein champ
 * parce que la personne l'a confirmé, jamais par déduction silencieuse. Un
 * jardin qu'elle n'a pas encore classé est « à classer » : son besoin en eau
 * n'est pas calculé, et la page le dit.
 *
 * Un espace d'avant l'accueil garde son classement d'avant, lu d'Ouvre ta
 * ferme (F426), et la démonstration le sien : rien ne change pour eux.
 */

/** Ce que la base garde du classement d'un jardin. */
export type StoredPlotShelter = {
  plotId: string;
  sheltered: boolean;
  /** Ce qui avait été proposé à la personne ; `null` si rien ne l'a été. */
  proposedSheltered: boolean | null;
  confirmedAt: string;
};

/** Le classement d'un jardin, pour un espace qui fait l'accueil. */
export type PlotClassification = {
  /** La proposition : abri si Ouvre ta ferme le dit abri, ou si son nom le dit. */
  proposedSheltered: boolean;
  /** Ce que la personne a confirmé ; `null` : à classer. */
  confirmed: StoredPlotShelter | null;
};

/**
 * Les mots d'un nom de jardin qui font proposer « abri » quand Ouvre ta ferme
 * ne le dit pas : ceux que la lecture d'OTF connaissait (`abri`, `cover`,
 * `greenhouse`, `shelter`, `tunnel`) et ceux qu'elle oubliait (`serre`,
 * `châssis`, `multichapelle`), section 8 bis.4, F420.
 */
const SHELTER_WORDS = /abri|serre|tunnel|ch[âa]ssis|multi-?chapelle|cover|greenhouse|shelter/;

/**
 * La proposition faite pour un jardin (F420, F583). Le type du jardin dans
 * Ouvre ta ferme (`mode`, une énumération : `greenhouse` ou `open-field`)
 * vient d'abord ; sinon, un mot de son nom. Une proposition n'est jamais
 * prise pour un classement : la personne la confirme ou la corrige.
 */
export function proposedShelter(plot: Pick<Plot, 'mode' | 'name'>): boolean {
  if (plot.mode === 'greenhouse') return true;
  return SHELTER_WORDS.test(plot.name.toLocaleLowerCase('fr-FR'));
}

/**
 * Le plan de la ferme tel que cet espace le classe. Pour un espace qui fait
 * l'accueil : un jardin confirmé prend le classement de la personne, un
 * jardin sans classement est « à classer » (`unclassified`), et chacun porte
 * sa proposition. Pour les autres, le plan est rendu tel quel.
 */
export function applyPlotShelters(
  snapshot: IrrigationSnapshot,
  onboarding: ResolvedOnboarding,
  stored: readonly StoredPlotShelter[],
): IrrigationSnapshot {
  if (onboarding.kind !== 'onboarding') return snapshot;
  const byPlot = new Map(stored.map((row) => [row.plotId, row]));
  return {
    ...snapshot,
    plots: snapshot.plots.map((plot): Plot => {
      const confirmed = byPlot.get(plot.id) ?? null;
      const classification: PlotClassification = { proposedSheltered: proposedShelter(plot), confirmed };
      const mode = confirmed === null ? 'unclassified' : confirmed.sheltered ? 'greenhouse' : 'garden';
      return { ...plot, mode, classification };
    }),
  };
}

/** Les jardins de la saison encore à classer, d'un plan déjà classé. */
export function unclassifiedPlots(snapshot: Pick<IrrigationSnapshot, 'plots'>, season: number): Plot[] {
  return seasonPlots(snapshot, season).filter((plot) => plot.mode === 'unclassified');
}

/** D'où vient le classement confirmé d'un jardin, en une phrase courte (F583). */
function classificationOrigin(confirmed: StoredPlotShelter): string {
  if (confirmed.proposedSheltered === null) return 'choisi par vous';
  return confirmed.proposedSheltered === confirmed.sheltered ? 'proposition confirmée' : 'proposition corrigée';
}

/** La raison d'un besoin non calculé, dans « Non calculable : … » (N1, F583). */
export const UNCLASSIFIED_PLOT_REASON = 'jardin à classer, abri ou plein champ, dans Réglages';

/** Une ligne de « Parcelles et abris », dans Réglages (F583). */
export type PlotShelterLine = {
  plotId: string;
  name: string;
  zoneName: string;
  proposedSheltered: boolean;
  state: 'sheltered' | 'open-field' | 'unclassified';
  /** D'où vient le classement ; `null` à classer. */
  origin: string | null;
};

/**
 * Les jardins de la saison à classer ou classés, dans l'ordre du plan, pour
 * un espace qui fait l'accueil ; `null` pour un autre espace, qui garde le
 * classement d'Ouvre ta ferme (F426) et n'a pas cet écran.
 */
export function plotShelterLines(snapshot: Pick<IrrigationSnapshot, 'plots' | 'zones'>, season: number): PlotShelterLine[] | null {
  const plots = seasonPlots(snapshot, season);
  if (!plots.some((plot) => plot.classification)) return null;
  const zones = new Map(snapshot.zones.map((zone) => [zone.id, zone.name]));
  return plots.map((plot) => {
    const confirmed = plot.classification?.confirmed ?? null;
    return {
      plotId: plot.id,
      name: plot.name,
      zoneName: zones.get(plot.zoneId) ?? '—',
      proposedSheltered: plot.classification?.proposedSheltered ?? plot.mode === 'greenhouse',
      state: confirmed === null ? 'unclassified' : confirmed.sheltered ? 'sheltered' : 'open-field',
      origin: confirmed === null ? null : classificationOrigin(confirmed),
    };
  });
}

/** Les jardins de la saison : ceux que l'écran classe, et dont l'étape attend le classement. */
export function seasonPlots(snapshot: Pick<IrrigationSnapshot, 'plots'>, season: number): Plot[] {
  return snapshot.plots.filter((plot) => plot.seasons.includes(season));
}
