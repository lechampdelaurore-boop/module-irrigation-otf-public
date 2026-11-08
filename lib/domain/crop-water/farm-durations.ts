import type { FaoPhaseLengths, ReferenceCrop } from './reference';

/**
 * Les durées propres à une ferme (docs/crop-water-need-contract.md, « Le jeu
 * de référence est une donnée », « L'écran », 5 quater, PR 3e) : ce que la
 * ferme règle d'une culture commune — délais de levée, début de chaque
 * stade en jours, durées des phases de la FAO et coefficient d'abattement,
 * jours du calendrier d'une culture pluriannuelle. La forme, les Kc, les
 * repères et les mois des jeux de saison restent ceux de la culture
 * commune : un Kc se règle par une surcharge datée (PR 3c).
 */
export type FarmDurations = {
  emergence: { directSowing: number; planting: number };
  /** Escalier : pour chaque jeu de saison, les jours de chaque stade ; `null` pour un repère sans durée (récolte). */
  stepDays: (number | null)[][] | null;
  /** Trapèze : les durées des quatre phases de chaque jeu de saison. */
  phaseLengths: FaoPhaseLengths[] | null;
  /** Trapèze : le coefficient d'abattement. */
  abatement: number | null;
  /** Calendrier : le début de chaque stade et le dernier jour, `MM-JJ`, et les mois d'installation. */
  calendar: { starts: string[]; end: string; establishmentMonths: number | null } | null;
};

/** Les durées d'une culture telles qu'elle les porte : le point de départ du formulaire. */
export function farmDurationsOf(crop: ReferenceCrop): FarmDurations {
  const curve = crop.curve;
  return {
    emergence: { directSowing: crop.emergenceDelayDays['direct-sowing'], planting: crop.emergenceDelayDays.planting },
    stepDays: curve.shape === 'steps'
      ? curve.sets.map((set) => set.value.map((start) => ('days' in start.anchor ? start.anchor.days : null)))
      : null,
    phaseLengths: curve.shape === 'trapezoid' ? curve.sets.map((set) => ({ ...set.value })) : null,
    abatement: curve.shape === 'trapezoid' ? curve.abatement : null,
    calendar: curve.shape === 'calendar'
      ? { starts: curve.stages.map((stage) => stage.start), end: curve.end, establishmentMonths: curve.establishment?.months ?? null }
      : null,
  };
}

/**
 * La version de la ferme d'une culture commune, avec ses durées. Une valeur
 * de la ferme différente de la commune perd la marque « estimée » : c'est la
 * ferme qui la donne. `null` quand les durées ne suivent pas la forme de la
 * culture (un jeu ou un stade de trop ou de moins) ; les valeurs elles-mêmes
 * sont vérifiées par la règle du jeu de référence (`referenceCropProblems`).
 */
export function withFarmDurations(common: ReferenceCrop, durations: FarmDurations): ReferenceCrop | null {
  const curve = common.curve;
  const emergenceDelayDays = { 'direct-sowing': durations.emergence.directSowing, planting: durations.emergence.planting };
  if (curve.shape === 'steps') {
    const stepDays = durations.stepDays;
    if (!stepDays || stepDays.length !== curve.sets.length) return null;
    const sets = [];
    for (const [index, set] of curve.sets.entries()) {
      const days = stepDays[index];
      if (days.length !== set.value.length) return null;
      const starts = [];
      for (const [position, start] of set.value.entries()) {
        const value = days[position];
        if (!('days' in start.anchor)) {
          if (value !== null) return null;
          starts.push(start);
          continue;
        }
        if (value === null) return null;
        starts.push(value === start.anchor.days ? start : { anchor: { from: start.anchor.from, days: value }, estimated: false });
      }
      sets.push({ months: set.months, value: starts });
    }
    return { ...common, emergenceDelayDays, curve: { ...curve, sets } };
  }
  if (curve.shape === 'trapezoid') {
    const lengths = durations.phaseLengths;
    if (!lengths || lengths.length !== curve.sets.length || durations.abatement === null) return null;
    return {
      ...common,
      emergenceDelayDays,
      curve: { ...curve, abatement: durations.abatement, sets: curve.sets.map((set, index) => ({ months: set.months, value: { ...lengths[index] } })) },
    };
  }
  const calendar = durations.calendar;
  if (!calendar || calendar.starts.length !== curve.stages.length) return null;
  if ((curve.establishment === null) !== (calendar.establishmentMonths === null)) return null;
  return {
    ...common,
    emergenceDelayDays,
    curve: {
      ...curve,
      end: calendar.end,
      stages: curve.stages.map((stage, index) => (
        calendar.starts[index] === stage.start ? stage : { ...stage, start: calendar.starts[index], estimated: false }
      )),
      establishment: curve.establishment && calendar.establishmentMonths !== null
        ? { ...curve.establishment, months: calendar.establishmentMonths }
        : null,
    },
  };
}

/** Vrai quand la ferme n'a rien changé aux durées de la culture commune. */
export function sameDurations(a: FarmDurations, b: FarmDurations): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
