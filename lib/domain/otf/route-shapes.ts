import { OtfShapeError, type OtfReadRoute } from './api-contract.ts';
import { mapWeekList } from './crop-plan-mapper.ts';
import { otfStructuresOf } from './farm-identity.ts';
import { asRecord, identifier, relationId, toInteger, type OtfFieldPlace } from './mapper.ts';

/**
 * La vérification de forme de chaque route lue dans Ouvre ta ferme
 * (docs/tranche-4-contract.md, T4-15, F370 point 5, et section 6.3 ter, F391
 * à F396). Elle passe dès que la réponse d'une route est arrivée, avant
 * l'appel suivant : un écart arrête la lecture, rien n'est rangé, et l'écart
 * ne nomme que la route et le champ, jamais une valeur.
 *
 * Elle refuse ce que le module ne sait pas lire sans deviner (D-003) : ce que
 * la traduction de l'instantané exige de chaque élément, et un champ lu avec
 * une valeur par défaut, constaté sur la ferme, qui manque à tous les
 * éléments d'une réponse (F393). `/configuration` est vérifiée par sa
 * traduction, faite aussitôt lue (`mapOtfConfiguration`).
 */

export type OtfListRoute = Exclude<OtfReadRoute, '/me' | '/configuration'>;

type ListRule = {
  /** Ce que la traduction exige de chaque élément, en plus d'être un objet avec son identifiant. */
  element?: (raw: Record<string, unknown>, route: OtfListRoute) => void;
  /**
   * Les champs lus avec une valeur par défaut, constatés sur la ferme
   * (docs/otf-contract.md, docs/series-contract.md) : présents, même nuls, sur
   * au moins un élément d'une réponse qui en porte (F393).
   */
  seenOnTheFarm: readonly string[];
};

const LIST_RULES: Record<OtfListRoute, ListRule> = {
  '/zoneList': { seenOnTheFarm: [] },
  '/plotList': {
    // Un remplissage de parcelle (`zoneFill`) n'est pas un jardin : la traduction ne lit pas sa parcelle.
    element: (raw, route) => {
      if (raw.zoneFill !== true) relationId(raw.zoneId ?? raw.zone, { route, field: 'zone' });
    },
    seenOnTheFarm: [],
  },
  '/bedList': {
    element: (raw, route) => void relationId(raw.plotId ?? raw.plot, { route, field: 'plot' }),
    seenOnTheFarm: ['length', 'width', 'alleyWidth'],
  },
  '/actionList': { seenOnTheFarm: ['fqn'] },
  '/plantList': { seenOnTheFarm: [] },
  '/seriesList': {
    element: (raw, route) => {
      toInteger(raw.season, { route, field: 'season' });
      // Une liste de mises en culture qui n'en est pas une est lue vide, comme avant (docs/series-contract.md).
      if (!Array.isArray(raw.cultivations)) return;
      for (const value of raw.cultivations) {
        const cultivation = asRecord(value, { route, field: 'cultivations[]' });
        identifier(cultivation.id ?? cultivation['@id'], { route, field: 'cultivations[].id' });
        relationId(cultivation.plant, { route, field: 'cultivations[].plant' });
        mapWeekList(cultivation.harvestWeeks, { route, field: 'cultivations[].harvestWeeks' });
        mapWeekList(cultivation.harvestWeeksExpected, { route, field: 'cultivations[].harvestWeeksExpected' });
      }
    },
    seenOnTheFarm: ['use', 'cycle', 'cultivations'],
  },
  '/placeList': {
    element: (raw, route) => optionalRelation(raw.series, { route, field: 'series' }),
    seenOnTheFarm: ['length'],
  },
  '/taskList': {
    element: (raw, route) => optionalRelation(raw.series, { route, field: 'series' }),
    seenOnTheFarm: ['action', 'series', 'cultivation', 'plannedWeek', 'doneWeek', 'status'],
  },
};

/** Les champs des mises en culture constatés sur la ferme, lus dans toutes les séries d'une réponse. */
const CULTIVATION_FIELDS_SEEN_ON_THE_FARM = ['harvestWeeks', 'harvestWeeksExpected'] as const;

/** `GET /me` : plusieurs structures ne sont jamais une ferme (F338 ; point D2 de la revue de l'isolation, F392). */
export function checkMeShape(payload: unknown): void {
  if (otfStructuresOf(payload).length > 1) throw new OtfShapeError('/me', 'structure', 'several-structures');
}

/** Les éléments d'une route de liste, toutes pages réunies (F391, F393). */
export function checkListShape(route: OtfListRoute, elements: readonly unknown[]): void {
  const rule = LIST_RULES[route];
  const records = elements.map((element) => {
    const raw = asRecord(element, { route, field: 'element' });
    identifier(raw.id ?? raw['@id'], { route, field: 'id' });
    rule.element?.(raw, route);
    return raw;
  });
  requireSeenFields(records, rule.seenOnTheFarm, (field) => ({ route, field }));
  if (route === '/seriesList') {
    const cultivations = records.flatMap((raw) => (Array.isArray(raw.cultivations) ? raw.cultivations : []));
    requireSeenFields(cultivations as Record<string, unknown>[], CULTIVATION_FIELDS_SEEN_ON_THE_FARM, (field) => ({ route, field: `cultivations[].${field}` }));
  }
}

/**
 * Un champ absent de tous les éléments d'une réponse non vide a changé de nom
 * ou disparu : le module le lirait avec sa valeur par défaut, donc faux. Un
 * champ présent, même nul, sur un seul élément suffit : Ouvre ta ferme écrit
 * les champs vides (`alleyWidth: null`, `fqn: null`).
 */
function requireSeenFields(records: readonly Record<string, unknown>[], fields: readonly string[], placeOf: (field: string) => OtfFieldPlace): void {
  if (records.length === 0) return;
  for (const field of fields) {
    if (!records.some((raw) => Object.hasOwn(raw, field))) {
      const place = placeOf(field);
      throw new OtfShapeError(place.route, place.field, 'missing-everywhere');
    }
  }
}

function optionalRelation(value: unknown, place: OtfFieldPlace): void {
  if (value !== null && value !== undefined) relationId(value, place);
}
