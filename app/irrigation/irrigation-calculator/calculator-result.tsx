'use client';

import {
  formatCalculatorNumber as n,
  missingFieldsText,
  PLAUSIBLE_RATE_LIMIT_MM_PER_HOUR,
  type CalculatorResult,
  type CalculatorWarning,
  type NominalScope,
} from '@/lib/domain/irrigation-calculator/calculate';
import type { SettingValues } from '@/lib/domain/irrigation-calculator/provenance';
import { SETTING_LABELS } from '@/lib/domain/irrigation-calculator/provenance';
import { cubicMetersPerHourFromLitersPerHour } from '@/lib/domain/units';

/**
 * Le résultat du calculateur, en direct (docs/irrigation-calculator-contract.md,
 * section 11) : l'étiquette, la valeur reçue, ce qui manque, l'eau pompée,
 * l'écart avec le réglage actuel, les avertissements, le profil en cône en
 * petit graphique et « Voir le calcul ».
 */

const WARNING_TEXTS: Readonly<Record<CalculatorWarning, string>> = {
  'jet-wider-than-band': 'Le jet est plus large que la bande arrosée : l’eau tombe surtout à côté et cette moyenne est trompeuse. Essayez le profil en cône.',
  'spacing-beyond-reach': 'Les asperseurs sont plus espacés que leur portée : la moyenne le long de la rampe n’a plus de sens.',
  'pressure-out-of-range': 'La pression réelle est hors de la plage conseillée : le débit réel peut s’écarter du calcul.',
  'rate-above-plausible': `Plus de ${PLAUSIBLE_RATE_LIMIT_MM_PER_HOUR} mm/h : vérifiez les unités (mètres, l/h), c’est sans doute une faute de saisie.`,
};

const NOMINAL_SCOPES: Readonly<Record<NominalScope, string>> = {
  'per-meter-of-bed': 'par mètre de planche',
  valve: 'pour la vanne',
  ramp: 'pour la rampe',
  'per-sprinkler': 'par asperseur',
};

function peak(values: SettingValues): number {
  if (values.kind === 'drip') return values.rateMmPerHour;
  return Math.max(0, ...values.leftProfile.map((point) => point.rateMmPerHour), ...values.rightProfile.map((point) => point.rateMmPerHour));
}

function reach(values: SettingValues): number {
  if (values.kind === 'drip') return 0;
  return Math.max(0, ...values.leftProfile.map((point) => point.distanceMeters), ...values.rightProfile.map((point) => point.distanceMeters));
}

/** « Réglage actuel 8 mm/h, calculé 14,22 mm/h » ; rien quand le calcul retrouve la valeur enregistrée. */
function gapText(current: SettingValues, computed: SettingValues): string | null {
  if (current.kind === 'drip' && computed.kind === 'drip') {
    if (current.rateMmPerHour === computed.rateMmPerHour) return null;
    return `Réglage actuel ${n(current.rateMmPerHour)} mm/h, calculé ${n(computed.rateMmPerHour)} mm/h.`;
  }
  const [currentPeak, computedPeak, currentReach, computedReach] = [peak(current), peak(computed), reach(current), reach(computed)];
  if (currentPeak === computedPeak && currentReach === computedReach) return null;
  return `Réglage actuel ${n(currentPeak)} mm/h au plus jusqu’à ${n(currentReach)} m, calculé ${n(computedPeak)} mm/h au plus jusqu’à ${n(computedReach)} m.`;
}

function headline(result: CalculatorResult): string | null {
  if (result.receivedRateMmPerHour === null) return null;
  if (result.method === 'sprinkler_cone') return `${n(result.receivedRateMmPerHour)} mm/h sous la rampe`;
  if (result.method === 'sprinkler_mean') return `${n(result.receivedRateMmPerHour)} mm/h reçus sur la bande`;
  return `${n(result.receivedRateMmPerHour)} mm/h reçus par la planche`;
}

export function CalculatorResultPanel({
  result,
  computed,
  current,
}: {
  result: CalculatorResult;
  computed: SettingValues | null;
  current: SettingValues | null;
}) {
  const missing = missingFieldsText(result.missing);
  const title = headline(result);
  const gap = current && computed ? gapText(current, computed) : null;
  return (
    <section className="calculator-result" aria-live="polite" aria-labelledby="calculator-result-title">
      <header>
        <h4 id="calculator-result-title">Résultat</h4>
        {title ? <span className="setting-provenance" data-level={result.level}>{SETTING_LABELS[result.level]}</span> : null}
      </header>
      {title ? <p className="calculator-headline"><strong>{title}</strong></p> : <p className="calculator-headline">Résultat inconnu</p>}
      {result.errors.length > 0 ? <p className="calculator-missing">Corrigez les champs signalés.</p> : null}
      {missing ? <p className="calculator-missing">{missing}</p> : null}
      <dl className="calculator-figures">
        {result.flow ? (
          <div>
            <dt>{result.flow.source === 'measured' ? 'Débit mesuré' : result.flow.source === 'pressure' ? 'Débit à la pression réelle' : 'Débit de la fiche, à la pression de la fiche'}</dt>
            <dd>{n(result.flow.litersPerHour, 1)} l/h</dd>
          </div>
        ) : null}
        {result.theoreticalRateMmPerHour !== null ? <div><dt>Théorique, sans perte</dt><dd>{n(result.theoreticalRateMmPerHour)} mm/h</dd></div> : null}
        {result.zoneSharePercent !== null ? <div><dt>Part d’eau sur la zone</dt><dd>{n(result.zoneSharePercent)} %</dd></div> : null}
        {result.valveFlowLitersPerHour !== null ? (
          <div><dt>Débit de la vanne</dt><dd>{n(result.valveFlowLitersPerHour, 1)} l/h, soit {n(cubicMetersPerHourFromLitersPerHour(result.valveFlowLitersPerHour))} m³/h</dd></div>
        ) : null}
        {result.nominalFlowLitersPerHour !== null && result.nominalScope && result.nominalScope !== 'valve' ? (
          <div>
            <dt>Eau pompée {NOMINAL_SCOPES[result.nominalScope]}</dt>
            <dd>{n(result.nominalFlowLitersPerHour, 1)} l/h, soit {n(cubicMetersPerHourFromLitersPerHour(result.nominalFlowLitersPerHour), 3)} m³/h</dd>
          </div>
        ) : null}
        {result.bedSharePercent !== null ? <div><dt>Part d’eau sur la planche et son passe-pied</dt><dd>{n(result.bedSharePercent, 1)} %</dd></div> : null}
      </dl>
      {result.nominalFlowLitersPerHour !== null ? (
        <p className="calculator-note">L’eau pompée s’affiche pour information : le module compte l’eau reçue par les planches.</p>
      ) : null}
      {gap ? <p className="calculator-gap">{gap}</p> : null}
      {result.warnings.length > 0 ? (
        <ul className="calculator-warnings">
          {result.warnings.map((warning) => <li key={warning}>{WARNING_TEXTS[warning]}</li>)}
        </ul>
      ) : null}
      {result.method === 'sprinkler_cone' && result.profile ? <ConeChart profile={result.profile} /> : null}
      {result.method === 'sprinkler_cone' ? (
        <p className="calculator-note">Le cône ne modélise ni vent, ni dérive, ni évaporation.</p>
      ) : null}
      {result.steps.length > 0 ? (
        <details className="calculator-steps">
          <summary>Voir le calcul</summary>
          <ol>
            {result.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

const CHART_WIDTH = 280;
const CHART_HEIGHT = 96;
const CHART_PADDING = 8;

/** Le profil en cône, des deux côtés de la rampe : un petit graphique au trait. */
function ConeChart({ profile }: { profile: readonly { distanceMeters: number; rateMmPerHour: number }[] }) {
  const maxDistance = Math.max(...profile.map((point) => point.distanceMeters), 1);
  const maxRate = Math.max(...profile.map((point) => point.rateMmPerHour), 1);
  const x = (distance: number) => CHART_PADDING + ((distance + maxDistance) / (2 * maxDistance)) * (CHART_WIDTH - 2 * CHART_PADDING);
  const y = (rate: number) => CHART_HEIGHT - CHART_PADDING - (rate / maxRate) * (CHART_HEIGHT - 2 * CHART_PADDING);
  const sides = [...profile].reverse().map((point) => [-point.distanceMeters, point.rateMmPerHour] as const)
    .concat(profile.slice(1).map((point) => [point.distanceMeters, point.rateMmPerHour] as const));
  const points = sides.map(([distance, rate]) => `${x(distance).toFixed(1)},${y(rate).toFixed(1)}`).join(' ');
  return (
    <figure className="calculator-chart">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={`Profil en cône : ${n(profile[0]?.rateMmPerHour ?? 0)} mm/h sous la rampe, rien au-delà de ${n(maxDistance)} m de chaque côté`}>
        <line x1={CHART_PADDING} x2={CHART_WIDTH - CHART_PADDING} y1={y(0)} y2={y(0)} className="calculator-chart-axis" />
        <line x1={x(0)} x2={x(0)} y1={CHART_PADDING} y2={y(0)} className="calculator-chart-axis" />
        <polyline points={points} className="calculator-chart-line" />
      </svg>
      <figcaption>
        <span>{n(maxDistance)} m</span>
        <span>rampe</span>
        <span>{n(maxDistance)} m</span>
      </figcaption>
    </figure>
  );
}
