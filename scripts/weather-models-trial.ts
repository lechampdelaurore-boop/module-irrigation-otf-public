import { appendFileSync } from 'node:fs';
import { addDaysToDateKey, dateKeyInTimeZone } from '../lib/domain/water-management.ts';
import {
  readTrialResponse,
  TRIAL_CALLS,
  TRIAL_FORECAST_DAYS_AFTER_TODAY,
  TRIAL_MAXIMUM_CALLS,
  trialReport,
  trialUrl,
  usefulHeaders,
  type TrialOutcome,
} from './weather-models/trial-read.ts';

/**
 * L'essai A de la météo multi-modèles (docs/weather-models-contract.md, § 7),
 * joué par le flux « Essai des modèles météo » sur un lanceur GitHub : sept
 * appels à l'API gratuite d'Open-Meteo, sans clé ni secret, sur deux lieux
 * quelconques (aucune ferme). Il écrit le compte rendu en Markdown (sortie et
 * résumé du flux), puis chaque réponse brute entre deux repères, pour que la
 * PR 1 en tire ses jeux de réponses figés. Il ne lit ni n'écrit aucune base.
 *
 *   node --experimental-strip-types --no-warnings scripts/weather-models-trial.ts
 */

const PAUSE_BETWEEN_CALLS_MILLISECONDS = 1_500;
const CALL_TIMEOUT_MILLISECONDS = 15_000;

if (TRIAL_CALLS.length > TRIAL_MAXIMUM_CALLS) throw new Error('Essai A : plus d’appels que le contrat n’en permet.');

const startDate = dateKeyInTimeZone(new Date(), 'Europe/Paris');
const endDate = addDaysToDateKey(startDate, TRIAL_FORECAST_DAYS_AFTER_TODAY);
const outcomes: TrialOutcome[] = [];
const rawBodies: string[] = [];

for (const [index, call] of TRIAL_CALLS.entries()) {
  if (index > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_CALLS_MILLISECONDS));
  const url = trialUrl(call, startDate, endDate);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(CALL_TIMEOUT_MILLISECONDS),
    });
    const text = await response.text();
    rawBodies.push(text);
    let payload: unknown = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
    const reason = typeof payload === 'object' && payload !== null && 'reason' in payload && typeof payload.reason === 'string'
      ? payload.reason
      : null;
    outcomes.push({
      call,
      status: response.status,
      failure: response.ok ? null : 'refus',
      headers: usefulHeaders(response.headers.entries()),
      providerReason: reason,
      reading: response.ok ? readTrialResponse(payload, call.models) : null,
    });
  } catch (error) {
    rawBodies.push('');
    outcomes.push({
      call,
      status: null,
      failure: error instanceof Error ? `${error.name} : ${error.message}` : 'erreur inconnue',
      headers: {},
      providerReason: null,
      reading: null,
    });
  }
}

const report = trialReport(outcomes, startDate, endDate);
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);

rawBodies.forEach((body, index) => {
  console.log(`===== RÉPONSE BRUTE ${index + 1} : début =====`);
  console.log(body);
  console.log(`===== RÉPONSE BRUTE ${index + 1} : fin =====`);
});

// L'essai échoue si un appel qui devait réussir n'a pas abouti : le flux est alors rouge.
const unexpectedFailures = outcomes.filter((outcome) => outcome.call.mayBeRefused !== true && outcome.failure !== null);
if (unexpectedFailures.length > 0) {
  console.error(`Essai A : ${unexpectedFailures.length} appel(s) en échec qui devai(en)t réussir.`);
  process.exitCode = 1;
}
