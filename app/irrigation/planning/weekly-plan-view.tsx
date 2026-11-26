'use client';

import type { ReactNode } from 'react';
import { priorityLabel } from '@/lib/domain/irrigation-feasibility';
import type { PlanBedOutcome, StoredWeeklyPlan, SupplyBudget } from '@/lib/domain/planning/contract';
import {
  arbitrationNote,
  bedReasonLabels,
  budgetDemandText,
  budgetLevelsText,
  calculationTriggerLabel,
  pendingEventNotice,
  unplacedReasonsExpertNote,
  waterDeficitExplanation,
  type PlanSummary,
} from '@/lib/domain/planning/presentation';
import { budgetValidatedNote, shortageAction } from '@/lib/domain/planning/shortage-reading';
import { hasPumpTimeDeficit, hasWaterDeficit, pumpTimeDeficitDetail, pumpTimeDeficitValue, uncountedWaterCount, unknownWaterChainCount, waterDeficitTileDetail, waterDeficitValue } from '@/lib/domain/planning/water-deficit-summary';
import { ChangesFold, SuggestionList } from './follow-up-blocks';
import { PlanningSettingsForm } from './planning-settings-form';
import { ProtectedSlotsSection } from './protected-slots-section';
import { formatDateTime, formatShortDay, formatVolume } from './format';
import { unplacedOrigin } from '@/lib/domain/planning/origins';
import { planSummaryLine, unplacedFoldLabel } from '@/lib/domain/planning/phone-week';
import { UNPLACED_GROUP_MEANING, informationalBedCount, planActionLine, planActionTiles, unplacedDeficitCount, unplacedTileDetail, waitingBedCount, type UnplacedGroups } from '@/lib/domain/planning/action-summary';
import { pageHref, pagePath } from '@/lib/domain/features/pages';
import { hrefWithIntent } from '../shell/url-intent';
import { planLine } from '@/lib/domain/today/today-view';
import { Icon, type IconName } from '../line-icon';
import { FigureOrigin } from '../shell/figure-origin';
import { AnchoredFold } from '../shell/page-settings-fold';
import { useWeeklyPlan, type WeeklyPlanState } from './weekly-plan-state';

/**
 * Le plan de la semaine sur la page « Semaine » (docs/planning-contract.md,
 * « Interface (3.6) » ; simplification, lot S4, PR 2,
 * docs/simplification-s4-contract.md, sections 4, 5 et 7.1) : la ligne du
 * plan et l'eau qui manque au premier niveau, « Le plan, chaîne par chaîne »
 * (le dernier calcul, son résumé, ses changements, ses budgets, ses
 * suggestions, ce qui n'a pas été placé) et ses réglages dans le détail. Les
 * jours et leurs créneaux sont dans « Jour par jour »
 * (`app/irrigation/semaine/week-days.tsx`). Chaque morceau lit le même état
 * (`WeeklyPlanProvider`) ; les regroupements et les comptes viennent de
 * `lib/domain/planning/`.
 */

/** L'ancre de la liste des planches non servies, que « n planches non servies · Voir » ouvre (S4-i). */
export const UNPLACED_ANCHOR = 'planches-non-servies';

/**
 * La section du plan : elle porte les ancres `planning` et `planning-title`
 * que visent les liens d'aujourd'hui (section 7.4), autour de toute la vue
 * « La semaine » quand la ferme a coché « Planning de la semaine ».
 */
export function WeeklyPlanSection({ children }: { children: ReactNode }) {
  const state = useWeeklyPlan();
  return (
    <section id="planning" className="planning-section" aria-labelledby="planning-title" aria-busy={state?.pending ?? false}>
      {/* Le titre de la page le dit déjà : celui du bloc reste pour les lecteurs d’écran (audit du 19 novembre 2026, lot J, n° 18, F456). */}
      <h2 id="planning-title" className="sr-only">Planning de la semaine</h2>
      {children}
    </section>
  );
}

/**
 * La ligne du plan, au premier niveau de la semaine en cours (section 4,
 * point 2) : « Plan calculé aujourd'hui à 6 h 02 » et « Recalculer le plan »,
 * mêmes mots et mêmes états que sur « Aujourd'hui » (S2) ; l'avis d'un geste
 * et celui d'un recalcul en attente dessous.
 */
export function PlanLine() {
  const state = useWeeklyPlan();
  if (!state) return null;
  const { plan, pending, compute, notice, error, now } = state;
  return (
    <>
      <div className="planning-heading week-plan-line">
        <p>{plan ? planLine(plan.calculation.computedAt, now).text : 'Aucun calcul pour cette semaine. Le plan se calcule chaque matin après la météo, ou maintenant d’un clic.'}</p>
        {/* « Plan calculé aujourd'hui à 6 h 02 · Recalculer », les mots de S2 (section 4, point 2) ; sans plan, le calcul est le geste. */}
        <div className="planning-heading-actions">
          {plan ? (
            <button type="button" className="week-plan-recalculate" aria-label="Recalculer le plan" disabled={pending} onClick={compute}>
              {pending ? 'Calcul en cours…' : 'Recalculer'}
            </button>
          ) : (
            <button type="button" className="primary" disabled={pending} onClick={compute}>
              {pending ? 'Calcul en cours…' : 'Calculer le plan de la semaine'}
            </button>
          )}
        </div>
      </div>
      {notice ? <p className="planning-notice" role="status">{notice}</p> : null}
      {error ? <p className="planning-error" role="alert">{error}</p> : null}
      {plan?.pendingEvent ? (
        <p className={plan.pendingEvent.status === 'failed' ? 'planning-error' : 'planning-empty'} role={plan.pendingEvent.status === 'failed' ? 'alert' : 'status'}>
          {pendingEventNotice(plan.pendingEvent, formatDateTime(plan.pendingEvent.occurredAt))}
        </p>
      ) : null}
    </>
  );
}

/**
 * « L'eau manque » dans l'encadré d'attention (section 4, point 3) : la
 * phrase d'action du plan quand l'eau manque (audit final, lot B, R3, F243)
 * et « Répartir l'eau » vers l'écran de répartition (R4, F247).
 */
export function PlanShortage() {
  const state = useWeeklyPlan();
  if (!state?.plan) return null;
  const action = shortageAction(state.plan, formatVolume, state.now);
  if (!action) return null;
  return (
    <p className="planning-shortage-action" role="note">
      <span>{action.sentence}</span>
      {state.repartitionHref ? <a href={state.repartitionHref}>{action.arbitrated ? 'Revoir la répartition' : 'Répartir l’eau'}</a> : null}
    </p>
  );
}

/** La ligne du pli « Le plan, chaîne par chaîne » : celle du résumé du plan (F11), ou l'absence de calcul. */
export function planDetailLine(state: WeeklyPlanState): string {
  const { plan, summary, actions, groups } = state;
  if (!plan || !summary || !actions) return 'Aucun calcul pour cette semaine';
  return planSummaryLine(summary, planActionLine(actions), plan.calculation.summary.deficit, unplacedDeficitCount(groups), formatVolume, unknownWaterChainCount(plan.calculation.summary.budgets));
}

/**
 * « Le plan, chaîne par chaîne » (section 7.1, n° 2) : le calcul et ses
 * sources, ses tuiles, ses changements, le budget d'eau, les suggestions,
 * les planches non servies ; « Ajouter un créneau à la main » ouvre le
 * formulaire « Planifier » de la page des arrosages (3.8).
 */
export function PlanDetail() {
  const state = useWeeklyPlan();
  if (!state) return null;
  const { plan, summary, actions, groups, unplaced, received, season, pending, suggestionFeedback, applySuggestion, keepSuggestion } = state;
  return (
    <>
      <div className="planning-heading-actions">
        <button type="button" onClick={() => window.location.assign(hrefWithIntent(pagePath('arrosages'), season, 'planifier', '1'))}>Ajouter un créneau à la main</button>
      </div>
      {!plan || !summary ? (
        <>
          <p className="planning-empty">Aucun calcul pour cette semaine. Le plan se calcule chaque matin après la météo, ou maintenant d’un clic.</p>
        </>
      ) : (
        <>
          {/* La semaine et l'heure du calcul d'abord ; ses sources, plus discrètes, dessous (audit du 19 novembre 2026, lot K, n° 17, F465). */}
          <p className="planning-meta">
            <span className="planning-meta-main">Semaine du {formatShortDay(plan.calculation.weekStart)} au {formatShortDay(plan.calculation.summary.weekEnd)} · calculé le {formatDateTime(plan.calculation.computedAt)} ({calculationTriggerLabel(plan.calculation)})</span>
            <small className="planning-meta-sources">
              Prévision météo sur {plan.calculation.summary.assumptions.forecastDays} jour{plan.calculation.summary.assumptions.forecastDays > 1 ? 's' : ''}
              {plan.calculation.summary.assumptions.reservoirsObservedAt.map((reservoir) => (
                <span key={reservoir.reservoirId}> · {reservoir.name} : {reservoir.currentCubicMeters === null ? 'niveau inconnu' : `${formatVolume(reservoir.currentCubicMeters)} observés${reservoir.observedAt ? ` le ${formatDateTime(reservoir.observedAt)}` : ''}`}</span>
              ))}
            </small>
          </p>
          {actions ? <PlanSummaryCards summary={summary} plan={plan} actions={planActionTiles(actions)} unplacedCount={unplacedDeficitCount(groups)} unplacedDetail={unplacedTileDetail(groups, plan.calculation.summary.deficit.bedCount)} /> : null}
          {plan.calculation.summary.changes ? <ChangesFold changes={plan.calculation.summary.changes} /> : null}
          {plan.calculation.summary.budgets.length > 0 ? <BudgetList budgets={plan.calculation.summary.budgets} validatedNote={budgetValidatedNote(plan, formatVolume)} /> : null}
          <SuggestionList suggestions={plan.suggestions} pending={pending} feedback={suggestionFeedback} onApply={applySuggestion} onKeep={keepSuggestion} />
          <UnplacedList beds={unplaced} groups={groups} season={season} received={received} />
        </>
      )}
    </>
  );
}

/** Les réglages du planning et les heures où l'on n'arrose pas, dans « Réglages de la semaine » (section 7.1, n° 8 ; S4-n). */
export function PlanSettings() {
  const state = useWeeklyPlan();
  if (!state) return null;
  return (
    <PlanningSettingsForm initialSettings={state.settings}>
      <ProtectedSlotsSection initialSlots={state.protectedSlots} />
    </PlanningSettingsForm>
  );
}

function PlanSummaryCards({ summary, plan, actions, unplacedCount, unplacedDetail }: {
  summary: PlanSummary;
  plan: StoredWeeklyPlan;
  /** « À valider », « Faites », « En retard » : les cartes de tête (audit ergonomique, lot 3, point 5, cas 1). */
  actions: ReturnType<typeof planActionTiles>;
  unplacedCount: number;
  unplacedDetail: string;
}) {
  const { deficit } = plan.calculation.summary;
  // Une chaîne servie à l'eau inconnue : son manque ne peut pas être chiffré, et le résumé le dit (point ouvert 51, D-089) ;
  // de même pour une planche en manque au volume inconnu, que le résumé compte à part (point ouvert 64, D-098).
  const unknownWater = unknownWaterChainCount(plan.calculation.summary.budgets);
  const explanation = waterDeficitExplanation(plan);
  // Sous un arbitrage validé, aucune ligne de budget : la note dit l'eau allouée et ce qui ne peut pas être reçu (D-052).
  const arbitration = arbitrationNote(plan.calculation.summary);
  // L'eau qui manque se dit au premier niveau, dans l'encadré d'attention (`PlanShortage`) ; ici, les tuiles du calcul,
  // ouvertes : la ligne de résumé est celle du pli « Le plan, chaîne par chaîne » (F11).
  return (
    <>
      <div className="planning-summary" data-open="true" data-tour="planning-semaine">
        {actions.map((tile) => <SummaryCard key={tile.label} icon={ACTION_TILE_ICONS[tile.label]} label={tile.label} value={tile.value} detail={tile.detail} tone={tile.tone} action />)}
        <SummaryCard icon="goutte" label="Volume proposé et validé" value={formatVolume(summary.volumeCubicMeters)} detail={summary.unknownVolumeCount > 0 ? `${summary.unknownVolumeCount} créneau${summary.unknownVolumeCount > 1 ? 'x' : ''} au volume inconnu en plus` : 'Volumes connus'} />
        <SummaryCard icon="aide" label="Non vérifié" value={String(summary.unverifiedCount)} detail="Créneaux sans pompe, origine ou stock connu" />
        <SummaryCard icon="goutte" label="Manque d’eau" value={waterDeficitValue(deficit.waterCubicMeters, uncountedWaterCount(deficit, unknownWater), formatVolume)} detail={waterDeficitTileDetail(deficit, unknownWater)} tone={hasWaterDeficit(deficit) ? 'deficit' : undefined} />
        <SummaryCard icon="horloge" label="Eau non pompée faute de temps" value={pumpTimeDeficitValue(deficit, formatVolume)} detail={pumpTimeDeficitDetail(deficit)} tone={hasPumpTimeDeficit(deficit) ? 'deficit' : undefined} />
        <SummaryCard icon="pousse" label="Planches non servies" value={String(unplacedCount)} detail={unplacedDetail} tone={unplacedCount > 0 ? 'deficit' : undefined} />
      </div>
      {/* Les chiffres du calcul, fermés par défaut ; leur texte ne change pas (audit final, lot B, R3, F244). */}
      {explanation || arbitration ? (
        <details className="planning-calculation">
          <summary>Le détail du calcul</summary>
          {explanation ? <p className="planning-summary-note">{explanation}</p> : null}
          {arbitration ? <p className="planning-summary-note">{arbitration}</p> : null}
        </details>
      ) : null}
    </>
  );
}

/** L'icône au trait des tuiles de gestes, d'après leur libellé (troisième passe, docs/charte-module.md). */
const ACTION_TILE_ICONS: Partial<Record<string, IconName>> = { 'À valider': 'calendrier', Faites: 'coche', 'En retard': 'alerte' };

/** Une tuile de total, son icône au trait devant le libellé (troisième passe, docs/charte-module.md). */
function SummaryCard({ icon, label, value, detail, tone, action = false }: { icon?: IconName; label: string; value: string; detail: string; tone?: string; action?: boolean }) {
  return <div className="planning-summary-card" data-tone={tone} data-action={action || undefined}><span>{icon ? <Icon name={icon} /> : null}{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function BudgetList({ budgets, validatedNote }: { budgets: readonly SupplyBudget[]; validatedNote: string | null }) {
  return (
    <details className="planning-budgets">
      <summary>Budget d’eau d’ici dimanche, chaîne par chaîne</summary>
      {/* Une part qui baisse après une validation se comprend (remarque 4 de la recette 3.9, F255). */}
      {validatedNote ? <p className="planning-budgets-validated">{validatedNote}</p> : null}
      <ul>
        {budgets.map((budget) => (
          <li key={budget.originKey}>
            <strong>{budget.originName}</strong>
            <span>
              {/* Une chaîne dont rien ne peut venir d'ici dimanche le dit, sans eau mobilisable (points ouverts 52 et 53, D-088). */}
              {budget.unavailable
                ? 'indisponible cette semaine, aucune eau mobilisable'
                : budget.availableCubicMeters === null ? 'eau mobilisable inconnue' : `${formatVolume(budget.availableCubicMeters)} mobilisables`} pour {budgetDemandText(budget, formatVolume)}
              {budget.dailyLimitRemainingCubicMeters !== null ? ` · limite journalière : ${formatVolume(budget.dailyLimitRemainingCubicMeters)} restants` : ''}
              {/* La part visée et la part placée de chaque niveau, « — » sans demande (décision 2 de la 3.9, D-052). */}
              {` · ${budgetLevelsText(budget)}`}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Les planches non servies, repliées par défaut derrière leur titre et leur
 * flèche (demande du porteur du 8 novembre 2026), rangées par motif, le plus
 * gros groupe d'abord (audit ergonomique, lot 3, point 5, cas 2). Les
 * planches qu'aucun matériel n'arrose sont dites en action vers « Matériel »,
 * au-dessus du pli, jamais comme un manque d'eau. Une liste vide dit en une
 * phrase que tout est servi.
 */
function UnplacedList({ beds, groups, season, received }: { beds: readonly PlanBedOutcome[]; groups: UnplacedGroups; season: number; received: ReadonlyMap<string, number | null> }) {
  if (beds.length === 0) {
    return (
      <div className="planning-unplaced" data-tour="planning-non-servies">
        <h3>Planches non servies</h3>
        <p className="planning-empty">Toutes les planches qui ont un besoin sont servies en entier.</p>
      </div>
    );
  }
  return (
    <div className="planning-unplaced-wrap" data-tour="planning-non-servies">
      {groups.noEquipment ? (
        <p className="planning-unplaced-action">
          <Icon name="rampe" />
          <span>{groups.noEquipment.lead} :</span>
          <a href={pageHref('materiel', { season })}>{groups.noEquipment.link}</a>
        </p>
      ) : null}
      {/* « n planches non servies · Voir », au premier niveau, ouvre ce pli par son ancre (S4-i). */}
      <AnchoredFold
        id={UNPLACED_ANCHOR}
        className="planning-unplaced"
        bodyClassName="planning-unplaced-body"
        summary={<><h3>{unplacedFoldLabel(unplacedDeficitCount(groups), informationalBedCount(groups), waitingBedCount(groups))}</h3><Icon name="fleche-bas" /></>}
      >
        <p className="planning-unplaced-caption">Chaque planche que le plan ne sert pas en entier, rangée par motif : aussi important que ce qui est placé.</p>
        {groups.groups.map((group) => (
          <section key={group.key} className="planning-unplaced-group" data-group={group.key} data-informational={group.informational || undefined} aria-label={group.title}>
            <h4>{group.title}</h4>
            {UNPLACED_GROUP_MEANING[group.key] ? <p className="planning-unplaced-meaning">{UNPLACED_GROUP_MEANING[group.key]}</p> : null}
            <table className="planning-table planning-unplaced-table">
              <thead>
                <tr><th scope="col">Planche</th><th scope="col">Jardin ou abri</th><th scope="col">Priorité</th><th scope="col">Besoin</th><th scope="col">Placé</th><th scope="col">Manque</th><th scope="col">Motif</th></tr>
              </thead>
              <tbody>
                {group.beds.map((bed) => (
                  // Au téléphone, une ligne compacte : « A01 · Abri des noues · manque 3,6 mm sur 10,9 mm », le motif dessous (audit final, lot B, J7, F253).
                  <tr key={bed.bedId} data-informational={group.informational || undefined}>
                    <th scope="row">{bed.bedName}</th>
                    <td data-label="Jardin ou abri" data-cell="plot">{bed.plotName}</td>
                    <td data-label="Priorité" data-cell="priority" data-priority={bed.priority}>{priorityLabel(bed.priority)}</td>
                    <td data-label="Besoin" data-cell="need">{mmLabel(bed.needMm)}</td>
                    <td data-label="Placé" data-cell="placed">{mmLabel(bed.placedMm)}</td>
                    <td data-label="Manque" data-cell="deficit">{mmLabel(bed.deficitMm)}<span className="planning-unplaced-of"> sur {mmLabel(bed.needMm)}</span><FigureOrigin text={unplacedOrigin(bed)} /></td>
                    <td data-label="Motif" data-cell="reason" title={unplacedReasonsExpertNote(bed.reasons) ?? undefined}>{bed.reasons.length === 0 ? 'manque partiel, faute de place' : bedReasonLabels(bed).join(' ; ')}{receivedNote(received.get(bed.bedId) ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </AnchoredFold>
    </div>
  );
}

/** « ; reçoit quand même 24,6 mm du matériel qui arrose ses voisines » : l'eau versée sans part, dite sur la ligne (F254). */
function receivedNote(receivedMm: number | null): string {
  return receivedMm === null ? '' : ` ; reçoit quand même ${mmLabel(receivedMm)} du matériel qui arrose ses voisines`;
}

const mmFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
function mmLabel(value: number) {
  return `${mmFormatter.format(value)} mm`;
}
