import type { HydraulicFeasibility } from './pumps.ts';

/**
 * Le message de faisabilité hydraulique du formulaire d'irrigation, en phrase
 * d'action (audit ergonomique, point 6, 3.8 quater lot 3,
 * docs/audit-ergonomie-lot3-contract.md, section 3, cas 4, précision F46) :
 * il dit ce qui ne va pas et quoi faire. Le calcul de faisabilité ne change
 * pas, seul le texte. Le moteur ne calcule aujourd'hui aucune solution (une
 * durée, une heure ou une pompe qui conviendraient) : le message n'en
 * propose donc pas, et l'écran n'a pas de bouton pour l'appliquer (« sinon,
 * pas de bouton »).
 */

export type HydraulicMessage = {
  tone: 'unknown' | 'ok' | 'exceeded';
  /** La phrase principale. */
  sentence: string;
  /** Le détail chiffré, pour qui veut vérifier : « Débit demandé 8,26 m³/h pour 8 m³/h de capacité… ». */
  detail: string;
};

const flow = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
/** Sous un millionième de m³/h, l'écart est un arrondi, pas un dépassement (la tolérance de `evaluateHydraulicFeasibility`). */
const NEGLIGIBLE_FLOW = 1e-9;

function flowText(value: number): string {
  return `${flow.format(value)} m³/h`;
}

/** « en même temps que Rampe nord et Asperseur B » ; vide sans autre irrigation nommée. */
function othersText(feasibility: Pick<HydraulicFeasibility, 'conflictingIrrigations'>): string {
  const labels = [...new Set(feasibility.conflictingIrrigations.map((item) => item.label))];
  if (labels.length === 0) return '';
  const listed = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`;
  return ` (en même temps que ${listed})`;
}

/**
 * La phrase pour une irrigation en préparation (`historical` faux) ou déjà
 * réalisée (`historical` vrai) : une irrigation réalisée s'enregistre
 * toujours, son dépassement est dit, jamais masqué (règle invariante).
 */
export function hydraulicMessage(feasibility: HydraulicFeasibility, historical: boolean): HydraulicMessage {
  if (!feasibility.hydraulicallyVerified) {
    return {
      tone: 'unknown',
      sentence: feasibility.reasons.includes('pump_inactive')
        ? 'La pompe choisie est désactivée : la faisabilité n’est pas vérifiée. Choisissez une pompe active.'
        : 'Aucune pompe n’est choisie : la faisabilité n’est pas vérifiée. L’irrigation reste autorisée.',
      detail: '',
    };
  }
  const capacity = feasibility.pumpCapacityCubicMetersPerHour ?? 0;
  const detail = `Débit demandé ${flowText(feasibility.totalFlowCubicMetersPerHour)} pour ${flowText(capacity)} de capacité ; ${flowText(feasibility.remainingCapacityCubicMetersPerHour ?? 0)} restaient libres avant cette irrigation. ${feasibility.originAvailability.message}`;
  const missing = flowText(feasibility.excessFlowCubicMetersPerHour);
  if (feasibility.excessFlowCubicMetersPerHour > NEGLIGIBLE_FLOW) {
    const alone = feasibility.reasons.includes('unit_flow_exceeded');
    if (historical) {
      return {
        tone: 'exceeded',
        sentence: alone
          ? `La pompe ne pouvait pas alimenter ce matériel : il manquait ${missing}. L’irrigation s’enregistre quand même, avec son dépassement.`
          : `La pompe ne pouvait pas alimenter ce matériel en plus des autres${othersText(feasibility)} : il manquait ${missing}. L’irrigation s’enregistre quand même, avec son dépassement.`,
        detail,
      };
    }
    return {
      tone: 'exceeded',
      sentence: alone
        ? `La pompe ne peut pas alimenter ce matériel : il manque ${missing}. Changez de pompe ou de réglage.`
        : `La pompe ne peut pas alimenter ce matériel en plus des autres${othersText(feasibility)} : il manque ${missing}. Raccourcissez, décalez ou changez de pompe.`,
      detail,
    };
  }
  if (feasibility.originAvailability.status === 'unavailable') {
    return { tone: 'exceeded', sentence: `L’eau de cette origine n’est pas disponible : ${feasibility.originAvailability.message}`, detail };
  }
  return { tone: 'ok', sentence: `La pompe suffit : ${flowText(feasibility.totalFlowCubicMetersPerHour)} sur ${flowText(capacity)}.`, detail };
}
