/**
 * L'essai A de la météo multi-modèles (docs/weather-models-contract.md, § 7) :
 * ce qu'on demande à Open-Meteo et comment on lit ses réponses, sans réseau,
 * pour que la lecture soit testée (tests/weather-models-trial.test.ts). Le
 * script `scripts/weather-models-trial.ts` fait les appels, sur un lanceur
 * GitHub, puisque le conteneur de l'assistant n'atteint pas Open-Meteo.
 *
 * L'essai ne décide rien : il relève (1) le nom exact des séries dans une
 * réponse à plusieurs modèles, (2) les variables que chaque modèle rend,
 * (3) la portée réelle en jours, (4) les en-têtes de limite s'il y en a. Son
 * résultat fixe la liste du § 4 dans la PR 1.
 */

/** Les cinq séries du jour que la lecture multi-modèles demandera (contrat, § 5). */
export const TRIAL_DAILY_VARIABLES = [
  'precipitation_sum',
  'temperature_2m_min',
  'temperature_2m_max',
  'et0_fao_evapotranspiration',
  'shortwave_radiation_sum',
] as const;

/** La fenêtre lue aujourd'hui par la synchronisation : aujourd'hui et 14 jours de plus (cache-policy.ts). */
export const TRIAL_FORECAST_DAYS_AFTER_TODAY = 14;

/** Plafond du contrat (§ 7) : au plus 10 appels par essai. */
export const TRIAL_MAXIMUM_CALLS = 10;

type TrialPlace = { name: string; latitude: number; longitude: number };

/** Un lieu de France métropolitaine quelconque (centre du pays), jamais une ferme réelle. */
const FRANCE_PLACE: TrialPlace = { name: 'Bourges (France, centre)', latitude: 47.08, longitude: 2.4 };
/** Un lieu hors d'Europe, pour voir ce que rend un modèle régional hors de sa zone. */
const FAR_PLACE: TrialPlace = { name: 'Montréal (Canada)', latitude: 45.5, longitude: -73.57 };

export type TrialCall = {
  label: string;
  place: TrialPlace;
  /** `null` : aucun paramètre `models`, la lecture d'aujourd'hui. */
  models: readonly string[] | null;
  /**
   * Un appel qui peut être refusé sans que l'essai échoue : le modèle inconnu
   * (on veut la forme du refus) et les variantes (un seul nom inconnu refuse
   * tout l'appel, et c'est ce qu'on veut apprendre).
   */
  mayBeRefused?: boolean;
};

export const TRIAL_CALLS: readonly TrialCall[] = [
  { label: 'Référence : sans modèle (la lecture d’aujourd’hui)', place: FRANCE_PLACE, models: null },
  {
    label: 'Les cinq modèles de la liste proposée (§ 4)',
    place: FRANCE_PLACE,
    models: ['best_match', 'meteofrance_seamless', 'icon_seamless', 'ecmwf_ifs025', 'gfs_seamless'],
  },
  { label: 'La forme de production : le modèle choisi et best_match', place: FRANCE_PLACE, models: ['meteofrance_seamless', 'best_match'] },
  { label: 'Un modèle seul (les séries sont-elles suffixées ?)', place: FRANCE_PLACE, models: ['meteofrance_seamless'] },
  {
    label: 'Variantes à connaître (Météo-France séparés, ICON régionaux, Met Office, ECMWF AIFS)',
    place: FRANCE_PLACE,
    models: ['meteofrance_arome_france_hd', 'meteofrance_arpege_europe', 'icon_eu', 'icon_d2', 'ukmo_seamless', 'ecmwf_aifs025_single'],
    mayBeRefused: true,
  },
  {
    label: 'Hors zone : modèles régionaux loin de l’Europe',
    place: FAR_PLACE,
    models: ['meteofrance_seamless', 'icon_seamless', 'best_match'],
  },
  { label: 'Modèle inconnu (forme du refus)', place: FRANCE_PLACE, models: ['modele_inexistant'], mayBeRefused: true },
];

export function trialUrl(call: TrialCall, startDate: string, endDate: string): URL {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(call.place.latitude));
  url.searchParams.set('longitude', String(call.place.longitude));
  url.searchParams.set('timezone', 'Europe/Paris');
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('daily', TRIAL_DAILY_VARIABLES.join(','));
  if (call.models) url.searchParams.set('models', call.models.join(','));
  return url;
}

export type SeriesReading = {
  variable: string;
  /** Le nom de la série trouvée dans `daily`, ou `null` si aucune. */
  key: string | null;
  unit: string | null;
  days: number;
  nonNullDays: number;
  firstValueDate: string | null;
  lastValueDate: string | null;
};

export type ModelReading = { model: string; series: SeriesReading[] };

export type ResponseReading = {
  dailyKeys: string[];
  dates: string[];
  models: ModelReading[];
  /** Séries présentes qu'aucune lecture n'a rattachées à un modèle. */
  unclaimedKeys: string[];
  gridLatitude: number | null;
  gridLongitude: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Le nom de la série pour une variable et un modèle : suffixé par le modèle
 * (`precipitation_sum_meteofrance_seamless`) s'il existe, sinon nu
 * (`precipitation_sum`). L'essai dit lequel Open-Meteo emploie ; la lecture
 * ne le suppose pas.
 */
function seriesKeyFor(daily: Record<string, unknown>, variable: string, model: string | null): string | null {
  if (model !== null && `${variable}_${model}` in daily) return `${variable}_${model}`;
  return variable in daily ? variable : null;
}

export function readTrialResponse(payload: unknown, models: readonly string[] | null): ResponseReading | null {
  if (!isRecord(payload) || !isRecord(payload.daily)) return null;
  const daily = payload.daily;
  const units = isRecord(payload.daily_units) ? payload.daily_units : {};
  const dates = Array.isArray(daily.time) ? daily.time.filter((value): value is string => typeof value === 'string') : [];
  const claimed = new Set<string>(['time']);
  const readings = (models ?? [null]).map((model): ModelReading => ({
    model: model ?? '(sans paramètre models)',
    series: TRIAL_DAILY_VARIABLES.map((variable): SeriesReading => {
      const key = seriesKeyFor(daily, variable, model);
      const values = key !== null && Array.isArray(daily[key]) ? daily[key] : [];
      if (key !== null) claimed.add(key);
      const withValue = dates.filter((_, index) => typeof values[index] === 'number');
      const unit = key !== null && typeof units[key] === 'string' ? units[key] : null;
      return {
        variable,
        key,
        unit,
        days: values.length,
        nonNullDays: withValue.length,
        firstValueDate: withValue[0] ?? null,
        lastValueDate: withValue.at(-1) ?? null,
      };
    }),
  }));
  const dailyKeys = Object.keys(daily);
  return {
    dailyKeys,
    dates,
    models: readings,
    unclaimedKeys: dailyKeys.filter((key) => !claimed.has(key)),
    gridLatitude: typeof payload.latitude === 'number' ? payload.latitude : null,
    gridLongitude: typeof payload.longitude === 'number' ? payload.longitude : null,
  };
}

/** Les en-têtes utiles au comptage et aux limites ; jamais d'adresse ni de cookie. */
export function usefulHeaders(headers: Iterable<[string, string]>): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [name, value] of headers) {
    const lower = name.toLowerCase();
    if (lower === 'content-type' || lower.includes('ratelimit') || lower.includes('rate-limit')
      || lower === 'retry-after' || lower.startsWith('x-')) kept[lower] = value;
  }
  return kept;
}

export type TrialOutcome = {
  call: TrialCall;
  status: number | null;
  failure: string | null;
  headers: Record<string, string>;
  providerReason: string | null;
  reading: ResponseReading | null;
};

function shortDate(date: string | null): string {
  return date === null ? '—' : date.slice(5);
}

/** Le compte rendu en Markdown, prêt à être collé dans la PR du code. */
export function trialReport(outcomes: readonly TrialOutcome[], startDate: string, endDate: string): string {
  const lines = [
    '## Essai A, météo multi-modèles (docs/weather-models-contract.md, § 7)',
    '',
    `Fenêtre demandée : ${startDate} à ${endDate} (Europe/Paris), variables : ${TRIAL_DAILY_VARIABLES.join(', ')}. ${outcomes.length} appels.`,
  ];
  outcomes.forEach((outcome, index) => {
    const { call, reading } = outcome;
    lines.push('', `### ${index + 1}. ${call.label}`, '');
    lines.push(`Lieu : ${call.place.name} ; models = ${call.models ? call.models.join(',') : '(absent)'}.`);
    lines.push(`Réponse : ${outcome.status ?? 'aucune'}${outcome.failure ? ` (${outcome.failure})` : ''}${outcome.providerReason ? `, raison : « ${outcome.providerReason} »` : ''}.`);
    const headerText = Object.entries(outcome.headers).map(([name, value]) => `${name}: ${value}`).join(' ; ');
    if (headerText) lines.push(`En-têtes : ${headerText}.`);
    if (!reading) return;
    lines.push(`Point de grille : ${reading.gridLatitude}, ${reading.gridLongitude} ; ${reading.dates.length} jours rendus.`);
    lines.push(`Séries de \`daily\` : ${reading.dailyKeys.map((key) => `\`${key}\``).join(', ')}.`);
    if (reading.unclaimedKeys.length > 0) lines.push(`Séries non rattachées : ${reading.unclaimedKeys.map((key) => `\`${key}\``).join(', ')}.`);
    lines.push('', '| Modèle | Variable | Série | Unité | Jours avec valeur | Premier | Dernier |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const model of reading.models) {
      for (const series of model.series) {
        lines.push(`| ${model.model} | ${series.variable} | ${series.key ? `\`${series.key}\`` : 'absente'} | ${series.unit ?? '—'} | ${series.nonNullDays} / ${series.days} | ${shortDate(series.firstValueDate)} | ${shortDate(series.lastValueDate)} |`);
      }
    }
  });
  return `${lines.join('\n')}\n`;
}
