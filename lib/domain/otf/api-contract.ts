/**
 * Contrat de lecture OTF partagé par le domaine et l'adaptateur : les routes
 * lues, l'erreur d'API, l'écart de forme et la forme des collections
 * renvoyées. Aucune dépendance : le domaine (mapper, politique d'instantané)
 * et l'adaptateur (client de lecture) l'importent tous deux.
 */
export type OtfApiErrorCode = 'season-unavailable';

export class OtfApiError extends Error {
  readonly status?: number;
  readonly code?: OtfApiErrorCode;

  constructor(message: string, status?: number, code?: OtfApiErrorCode) {
    super(message);
    this.name = 'OtfApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Les seules routes que le module lit dans Ouvre ta ferme (docs/otf-contract.md,
 * « Routes autorisées »), dans l'ordre d'une lecture : le connecteur refuse
 * toute autre route, et chacune a sa vérification de forme
 * (`lib/domain/otf/route-shapes.ts`).
 */
export const OTF_READ_ROUTES = [
  '/me',
  '/configuration',
  '/zoneList',
  '/plotList',
  '/bedList',
  // Extension « suivi par série » (docs/series-contract.md) : cinq routes GET
  // de plus, même portée `production:read`, mêmes règles de rythme et de pages.
  '/actionList',
  '/plantList',
  '/seriesList',
  '/placeList',
  '/taskList',
] as const;

export type OtfReadRoute = (typeof OTF_READ_ROUTES)[number];

/**
 * Ce qui ne va pas dans la forme d'une réponse (docs/tranche-4-contract.md,
 * section 6.3 ter) : un champ lu absent de tous les éléments, un élément qui
 * n'est pas un objet, un identifiant, une relation, un entier, une liste ou
 * une semaine illisible, plusieurs structures dans `GET /me`.
 */
export type OtfShapeProblem =
  | 'missing-everywhere'
  | 'not-object'
  | 'unreadable-id'
  | 'unreadable-relation'
  | 'not-integer'
  | 'not-list'
  | 'not-week'
  | 'several-structures';

/**
 * Ouvre ta ferme a changé la forme de ses données (T4-15, F370 point 5) : la
 * route et le champ, jamais une valeur, ni dans le message ni dans le journal.
 * La lecture s'arrête et rien n'est rangé.
 */
export class OtfShapeError extends OtfApiError {
  readonly route: OtfReadRoute;
  readonly field: string;
  readonly problem: OtfShapeProblem;

  constructor(route: OtfReadRoute, field: string, problem: OtfShapeProblem) {
    super(`Ouvre ta ferme a changé la forme de ses données : ${route}, champ ${field} (${problem}).`);
    this.name = 'OtfShapeError';
    this.route = route;
    this.field = field;
    this.problem = problem;
  }
}

export function extractCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) {
    throw new OtfApiError('Réponse OTF invalide : collection attendue.');
  }

  const candidates = [
    payload['hydra:member'],
    payload.member,
    payload.items,
    payload.data,
    payload.list,
  ];
  const collection = candidates.find(Array.isArray);

  if (!collection) {
    throw new OtfApiError('Réponse OTF invalide : éléments absents.');
  }

  return collection;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
