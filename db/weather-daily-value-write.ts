import { db } from './binding';
import type { WeatherDailyValue } from '@/lib/domain/weather/weather-provider';

/**
 * L'écriture d'un jour de météo lu (prévision ou réanalyse), la même pour
 * l'actualisation à l'écran et pour les relectures planifiées
 * (docs/weather-contract.md ; docs/weather-models-contract.md, § 3 règles 5,
 * 6 et 11, § 6 ; D-346, F1016).
 *
 * - **À source égale**, une réponse partielle garde les champs déjà connus
 *   (`COALESCE`), comme avant ; `fetched_at` reste celui de la lecture qui a
 *   donné la valeur gardée.
 * - **Quand la source change** (la ferme a changé de modèle, ou le jour passe
 *   du modèle choisi à « Automatique d'Open-Meteo »), la ligne est remplacée
 *   **en entier** : une valeur que la nouvelle source ne donne pas reste
 *   `null` (D-003), jamais celle d'une autre source, et la `source` dit
 *   toujours qui a donné chaque champ du jour (règle 6 : jamais un mélange).
 *
 * Un jour entièrement vide ne s'écrit pas (`hasWeatherValue`) : il n'efface
 * rien. Les colonnes sont du code ; seules les valeurs passent en paramètres.
 */
export function weatherDailyValueStatement(row: {
  workspaceId: string;
  locationKey: string;
  kind: 'forecast' | 'reanalysis';
  value: WeatherDailyValue;
  source: string;
  fetchedAt: string;
}): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO irrigation_weather_daily_values AS kept
       (workspace_id, location_key, date, data_kind, precipitation_mm, et0_mm,
        minimum_temperature_celsius, maximum_temperature_celsius, solar_energy_mj_per_square_meter,
        source, fetched_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(workspace_id, location_key, date, data_kind) DO UPDATE SET
       precipitation_mm = ${keptOrNew('precipitation_mm')},
       et0_mm = ${keptOrNew('et0_mm')},
       minimum_temperature_celsius = ${keptOrNew('minimum_temperature_celsius')},
       maximum_temperature_celsius = ${keptOrNew('maximum_temperature_celsius')},
       solar_energy_mj_per_square_meter = ${keptOrNew('solar_energy_mj_per_square_meter')},
       source = excluded.source,
       fetched_at = CASE WHEN ${SAME_SOURCE} AND (${KEEPS_AN_OLDER_VALUE}) THEN kept.fetched_at ELSE excluded.fetched_at END,
       updated_at = excluded.updated_at`,
  ).bind(
    row.workspaceId,
    row.locationKey,
    row.value.date,
    row.kind,
    row.value.precipitationMm,
    row.value.et0Mm,
    row.value.minimumTemperatureCelsius ?? null,
    row.value.maximumTemperatureCelsius ?? null,
    row.value.solarEnergyMegajoulesPerSquareMeter ?? null,
    row.source,
    row.fetchedAt,
    row.fetchedAt,
  );
}

const VALUE_COLUMNS = [
  'precipitation_mm',
  'et0_mm',
  'minimum_temperature_celsius',
  'maximum_temperature_celsius',
  'solar_energy_mj_per_square_meter',
] as const;

type ValueColumn = (typeof VALUE_COLUMNS)[number];

/** SQLite lit chaque expression de `SET` sur la ligne d'avant : la comparaison des sources tient pour toutes. */
const SAME_SOURCE = 'excluded.source IS kept.source';

/** Une valeur absente de la lecture, gardée de la précédente : la lecture n'est pas la seule à avoir donné la ligne. */
const KEEPS_AN_OLDER_VALUE = VALUE_COLUMNS.map((column) => `(excluded.${column} IS NULL AND kept.${column} IS NOT NULL)`).join(' OR ');

function keptOrNew(column: ValueColumn): string {
  return `CASE WHEN ${SAME_SOURCE} THEN COALESCE(excluded.${column}, kept.${column}) ELSE excluded.${column} END`;
}
