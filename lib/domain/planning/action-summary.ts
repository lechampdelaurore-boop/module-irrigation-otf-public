import { plannedIrrigationLateness } from '../planned-irrigation.ts';
import type { PlanBedOutcome, StoredProposal, UnplacedReason } from './contract.ts';
import type { PlanSummary } from './presentation.ts';

/**
 * Le planning de la semaine, l'action contre le bruit (audit ergonomique,
 * point 5, 3.8 quater lot 3, docs/audit-ergonomie-lot3-contract.md,
 * section 3) : les cartes de tête comptent ce qui demande un geste — à
 * valider, fait, en retard —, et les planches non servies se rangent par
 * motif, le manque de matériel en tête comme une action vers « Matériel »,
 * jamais comme un manque d'eau. Des comptes et des libellés, testés ; aucune
 * règle de placement.
 */

export type PlanActionCounts = {
  /** Les propositions encore à valider (ni décidées, ni expirées). */
  toValidate: number;
  refused: number;
  expired: number;
  /** Les validées dont l'irrigation est réalisée, en entier ou en partie. */
  done: number;
  /** Parmi les faites, celles faites en partie seulement. */
  partial: number;
  /** Les validées dont l'irrigation vit encore : planifiées, en cours, faites (une annulée ne compte plus). */
  validated: number;
  /** Les validées en retard ou non faites, avec la tolérance R14 de la page des arrosages. */
  late: number;
  /** Parmi les en retard, les non faites : tout leur créneau est passé sans démarrage. */
  missed: number;
};

/**
 * Le retard d'une validée se lit sur son irrigation, avec la règle de la page
 * des arrosages (`plannedIrrigationLateness`) : ses heures ont pu être
 * ajustées à la validation ou modifiées depuis. Sans irrigation retrouvée,
 * elle n'est pas comptée en retard.
 */
function lateness(proposal: StoredProposal, toleranceMinutes: number, now: Date) {
  if (proposal.status !== 'validated' || proposal.irrigationStatus !== 'planned' || !proposal.irrigation) return null;
  return plannedIrrigationLateness(proposal.irrigation, toleranceMinutes, now);
}

export function planActionCounts(
  plan: { proposals: readonly StoredProposal[] },
  summary: Pick<PlanSummary, 'counts'>,
  toleranceMinutes: number,
  now: Date,
): PlanActionCounts {
  let done = 0;
  let partial = 0;
  let late = 0;
  let missed = 0;
  for (const proposal of plan.proposals) {
    if (proposal.status !== 'validated') continue;
    if (proposal.irrigationStatus === 'completed') done += 1;
    if (proposal.irrigationStatus === 'partially_completed') {
      done += 1;
      partial += 1;
    }
    const state = lateness(proposal, toleranceMinutes, now);
    if (state !== null) late += 1;
    if (state === 'missed') missed += 1;
  }
  return {
    toValidate: summary.counts.proposed,
    refused: summary.counts.refused,
    expired: summary.counts.expired,
    done,
    partial,
    validated: summary.counts.validated,
    late,
    missed,
  };
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`) => `${count} ${count > 1 ? pluralForm : singular}`;

export type PlanActionTile = {
  label: string;
  value: string;
  detail: string;
  /** `deficit` : un geste attend, en rouge doux ; rien autrement. */
  tone?: 'deficit';
};

/**
 * Les trois cartes de tête, dans l'ordre : « À valider », « Faites », « En
 * retard » (cas 1). Le gros chiffre est ce qui demande un geste ; les
 * refusées et les expirées passent en détail sous « À valider ».
 */
export function planActionTiles(counts: PlanActionCounts): PlanActionTile[] {
  const decided = [
    `${counts.refused} refusée${counts.refused > 1 ? 's' : ''}`,
    `${counts.expired} expirée${counts.expired > 1 ? 's' : ''}`,
  ].join(' · ');
  return [
    { label: 'À valider', value: String(counts.toValidate), detail: decided },
    {
      label: 'Faites',
      value: String(counts.done),
      detail: `sur ${plural(counts.validated, 'validée')}${counts.partial > 0 ? ` · dont ${counts.partial} en partie` : ''}`,
    },
    {
      label: 'En retard',
      value: String(counts.late),
      detail: counts.late === 0 ? 'Rien en retard' : counts.missed > 0 ? `dont ${plural(counts.missed, 'non faite', 'non faites')}` : 'à démarrer sur « Arrosages »',
      tone: counts.late > 0 ? 'deficit' : undefined,
    },
  ];
}

/** Ce que la ligne du téléphone dit des gestes, en tête du résumé. */
export function planActionLine(counts: PlanActionCounts): string[] {
  const parts = [`${counts.toValidate} à valider`, `${counts.done} faite${counts.done > 1 ? 's' : ''}`];
  if (counts.late > 0) parts.push(`${counts.late} en retard`);
  return parts;
}

// ---------------------------------------------------------------------------
// Les planches non servies, rangées par motif
// ---------------------------------------------------------------------------

/** Le motif d'un groupe : celui de la planche, ou un manque partiel faute de place. */
export type UnplacedGroupKey = UnplacedReason | 'partial';

/** Le nom court de chaque groupe, en mots simples (précision F48 : les identifiants des règles restent pour les experts). */
const GROUP_TITLES: Record<UnplacedGroupKey, string> = {
  'no-equipment': 'Sans matériel',
  'no-objective': 'Sans objectif',
  'below-minimum-dose': 'Besoin trop petit pour un arrosage',
  'water-budget': 'Manque d’eau',
  deferred: 'Reportées jusqu’au prochain événement',
  'pump-time': 'Temps de pompage insuffisant',
  'daily-limit': 'Limite journalière atteinte',
  'withdrawal-limit': 'Limite de prélèvement atteinte',
  'reserve-timing': 'Réserve au minimum',
  'volume-unknown-under-limit': 'Volume inconnu sous une limite journalière',
  'supply-unavailable': 'Eau ou pompe indisponible',
  'no-time-left': 'Plus de plage horaire',
  'insufficient-reach': 'Réglage plus large que la planche',
  spacing: 'Espacement entre deux arrosages',
  'refused-slot': 'Créneaux refusés',
  'protected-slot': 'Créneaux protégés',
  partial: 'Servies en partie, faute de place',
};

type UnplacedGroup = {
  key: UnplacedGroupKey;
  /** « Sans matériel (38) ». */
  title: string;
  beds: PlanBedOutcome[];
};

export type UnplacedGroups = {
  /**
   * Les planches qu'aucun matériel n'arrose : un réglage à faire dans
   * « Matériel », dit en action en tête, jamais en manque d'eau (cas 2).
   * Nul quand il n'y en a pas.
   */
  noEquipment: { count: number; lead: string; link: string } | null;
  /** Tous les groupes, celui des planches sans matériel compris, le plus gros d'abord. */
  groups: UnplacedGroup[];
};

/**
 * Le motif qui range une planche : son premier motif, celui que le moteur
 * nomme d'abord ; sans motif, un manque partiel faute de place. Une planche
 * sans matériel n'a que ce motif-là.
 */
function groupKey(bed: Pick<PlanBedOutcome, 'reasons'>): UnplacedGroupKey {
  if (bed.reasons.includes('no-equipment')) return 'no-equipment';
  return bed.reasons[0] ?? 'partial';
}

/** « 38 planches n’ont aucun matériel : les rattacher » ; le lien porte les derniers mots. */
function noEquipmentAction(count: number): { count: number; lead: string; link: string } {
  return count > 1
    ? { count, lead: `${count} planches n’ont aucun matériel`, link: 'les rattacher' }
    : { count, lead: '1 planche n’a aucun matériel', link: 'la rattacher' };
}

/**
 * Les planches non servies rangées par motif, le plus gros groupe d'abord ;
 * à taille égale, l'ordre des motifs du contrat. Chaque groupe garde l'ordre
 * de `unplacedBeds` (prioritaires d'abord, puis par nom).
 */
export function unplacedGroups(beds: readonly PlanBedOutcome[]): UnplacedGroups {
  const byKey = new Map<UnplacedGroupKey, PlanBedOutcome[]>();
  for (const bed of beds) {
    const key = groupKey(bed);
    byKey.set(key, [...(byKey.get(key) ?? []), bed]);
  }
  const order = Object.keys(GROUP_TITLES) as UnplacedGroupKey[];
  const groups = [...byKey.entries()]
    .sort(([leftKey, left], [rightKey, right]) => right.length - left.length || order.indexOf(leftKey) - order.indexOf(rightKey))
    .map(([key, grouped]) => ({ key, title: `${GROUP_TITLES[key]} (${grouped.length})`, beds: grouped }));
  const noEquipment = byKey.get('no-equipment')?.length ?? 0;
  return { noEquipment: noEquipment > 0 ? noEquipmentAction(noEquipment) : null, groups };
}

/** Sous un centième de millimètre, le manque est un arrondi, pas un manque. */
const NEGLIGIBLE_DEFICIT_MM = 0.01;

/**
 * Le détail de la tuile « Planches non servies » : les planches sans matériel
 * dites à part, jamais comptées en manque d'eau (cas 2) ; sans elles, le
 * nombre de planches au manque chiffré, comme avant.
 */
export function unplacedTileDetail(groups: UnplacedGroups, bedsWithDeficit: number): string {
  if (!groups.noEquipment) return `${bedsWithDeficit} avec un manque chiffré`;
  const others = groups.groups
    .filter((group) => group.key !== 'no-equipment')
    .reduce((count, group) => count + group.beds.filter((bed) => bed.deficitMm >= NEGLIGIBLE_DEFICIT_MM).length, 0);
  const withoutEquipment = `dont ${groups.noEquipment.count} sans matériel`;
  return others === 0 ? withoutEquipment : `${withoutEquipment} · ${plural(others, 'autre', 'autres')} avec un manque chiffré`;
}

/** Ce qu'une planche non servie de ce groupe signifie, en une phrase, sous son titre. */
export const UNPLACED_GROUP_MEANING: Partial<Record<UnplacedGroupKey, string>> = {
  'no-equipment': 'Aucun matériel posé ne les arrose : c’est un réglage à faire dans « Matériel », pas un manque d’eau.',
  'water-budget': 'Le stock et les ressources ne suffisent pas d’ici dimanche.',
  // Sous le report, la file n'avance qu'au calcul qui suit un événement (décision 4 de la 3.9, D-052).
  deferred: 'Elles passent en tête au calcul qui suit un événement : un arrosage validé ou fait, de l’eau nouvelle, un stock corrigé. Recalculer sans événement ne change pas leur tour.',
  'insufficient-reach': 'Le réglage arrose une surface plus large que la planche : elle reçoit moins que la planche de référence de ce réglage.',
};
