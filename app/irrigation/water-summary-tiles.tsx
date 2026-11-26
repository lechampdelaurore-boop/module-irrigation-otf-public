'use client';

import { volumeText } from '@/lib/domain/display-numbers';
import { farmObjectiveScopeText, type FarmObjective } from '@/lib/domain/farm-objective';
import { SIMPLE_WORDS } from '@/lib/domain/simple-words';
import type { WaterDashboardDay } from '@/lib/domain/water-management';
import type { WaterDashboard } from '@/lib/services/water-dashboard';
import { Icon, type IconName } from './line-icon';

const mm = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * Les tuiles de résumé de la semaine : l'eau visée, l'irrigation réalisée,
 * la pluie réelle ou estimée, la pluie encore prévue et la soif de la
 * semaine, chacune avec ce qui manque. Un seul composant, deux places : le
 * pli « Jours de la semaine, un par un » du détail, et « Comprendre ces
 * chiffres » sous le bilan de « La semaine » (simplification, lot S4, PR 3,
 * docs/simplification-s4-contract.md, section 8.1), sans un calcul de plus.
 * Un chiffre absent se dit absent, jamais zéro (D-003).
 */
export function WaterSummaryTiles({ dashboard, farmObjective, today }: {
  dashboard: Pick<WaterDashboard, 'totals' | 'goals'> & { days: readonly WaterDashboardDay[] };
  /** L'eau visée de la ferme, celle d'« Aujourd'hui » ; `null` tant qu'elle n'est pas lue. */
  farmObjective: FarmObjective | null;
  /** Le jour de la ferme : la pluie réelle manque jusqu'à lui, la prévision à partir de lui. */
  today: string;
}) {
  const missingEt0Dates = dashboard.days.filter((day) => day.et0Mm === null).map((day) => day.date);
  const missingActualRainDates = dashboard.days.filter((day) => day.date <= today && day.effectiveActualRainMm === null).map((day) => day.date);
  const missingForecastRainDates = dashboard.days.filter((day) => day.date >= today && day.forecastRainMm === null).map((day) => day.date);
  const goals = dashboard.goals.length;
  return (
    <div className="water-summary-grid" data-open="true">
      <SummaryCard icon="cible" label={SIMPLE_WORDS.weekGoal} value={farmObjective === null ? 'En cours de lecture' : farmObjective.objectiveMm === null ? 'Aucune' : `${mm.format(Math.round(farmObjective.objectiveMm * 10) / 10)} mm`} detail={`${farmObjective === null ? '' : `${farmObjectiveScopeText(farmObjective)} · `}${goals} objectif${goals > 1 ? 's' : ''} saisi${goals > 1 ? 's' : ''}`} />
      <SummaryCard icon="goutte" label="Irrigation réalisée" value={`${mm.format(dashboard.totals.realizedIrrigationMm)} mm`} detail={`${volumeText(dashboard.totals.realizedIrrigationCubicMeters)} répartis sur la surface totale des planches`} />
      <SummaryCard water icon="pluie" label="Pluie réelle / estimée" value={`${formatOptionalMm(dashboard.totals.actualRainMm)}${missingActualRainDates.length ? ' · partielle' : ''}`} detail={missingActualRainDates.length ? `Non utilisable pour un bilan complet : ${missingWeatherDates(missingActualRainDates)}. Mesure manuelle prioritaire, sinon réanalyse.` : 'Mesure manuelle prioritaire, sinon réanalyse'} />
      <SummaryCard water icon="pluie" label="Pluie encore prévue" value={`${formatOptionalMm(dashboard.totals.remainingForecastRainMm)}${missingForecastRainDates.length ? ' · partielle' : ''}`} detail={missingForecastRainDates.length ? `Prévision incomplète : ${missingWeatherDates(missingForecastRainDates)}.` : 'Prévision à partir d’aujourd’hui'} />
      <SummaryCard icon="soleil" label={SIMPLE_WORDS.thirstOfWeek} value={`${formatOptionalMm(dashboard.totals.et0Mm)}${missingEt0Dates.length ? ' · partielle' : ''}`} detail={`ET0, l’évaporation de référence. Prévision : ${formatOptionalMm(dashboard.totals.et0ForecastMm)} · Réanalyse : ${formatOptionalMm(dashboard.totals.et0ReanalysisMm)}. ${missingEt0Dates.length ? `Non utilisée comme total hebdomadaire complet : ${missingWeatherDates(missingEt0Dates)}.` : 'Utilisée dans le calcul des besoins affiché ensuite.'}`} />
    </div>
  );
}

function SummaryCard({ icon, label, value, detail, water = false }: { icon: IconName; label: string; value: string; detail: string; water?: boolean }) {
  // Un chiffre absent (« Non défini », « non disponible · partielle ») s'écrit à la taille du texte courant, sur une ligne, pas en très gros (lot D, J3, F300).
  const unknown = !/^\d/.test(value);
  return <div className={water ? 'water-summary-card is-water' : 'water-summary-card'}><span><Icon name={icon} />{label}</span><strong className={unknown ? 'is-unknown' : undefined}>{value}</strong><small>{detail}</small></div>;
}

function formatOptionalMm(value: number | null) {
  return value === null ? 'Non disponible' : `${mm.format(value)} mm`;
}

function missingWeatherDates(dates: readonly string[]) {
  const format = (dateKey: string) => dateFormatter.format(new Date(`${dateKey}T12:00:00.000Z`));
  return `${dates.length === 1 ? 'donnée manquante le' : 'données manquantes les'} ${dates.map(format).join(', ')}`;
}
