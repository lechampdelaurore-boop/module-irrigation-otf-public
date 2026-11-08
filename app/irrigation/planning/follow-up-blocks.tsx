'use client';

import type { PlanChanges } from '@/lib/domain/planning/changes';
import type { StoredPlanSuggestion } from '@/lib/domain/planning/contract';
import {
  planChangesLines,
  planChangesTitle,
  splitSuggestions,
  suggestionCauseLabel,
  suggestionLabel,
  type DateFormats,
} from '@/lib/domain/planning/follow-up';
import { formatDuration } from '../irrigation-manager/presentation';
import { formatDateTime, formatMm, formatShortDay, formatTime } from './format';

export type SuggestionFeedback = { ok: boolean; message: string };

const FORMAT: DateFormats = { dateTime: formatDateTime, time: formatTime, day: formatShortDay };

type SuggestionHandlers = {
  onApply: (suggestion: StoredPlanSuggestion) => void;
  onKeep: (suggestion: StoredPlanSuggestion) => void;
};

/**
 * Les suggestions sur les arrosages validés (3.7, docs/replanning-contract.md,
 * règles 11 à 17 et « L'écran ») : chacune avec sa raison et ses deux
 * gestes ; les gardées repliées. Les libellés viennent de
 * `lib/domain/planning/follow-up.ts`.
 */
export function SuggestionList({ suggestions, pending, feedback, onApply, onKeep }: {
  suggestions: readonly StoredPlanSuggestion[];
  pending: boolean;
  feedback: Record<string, SuggestionFeedback>;
} & SuggestionHandlers) {
  const { active, kept } = splitSuggestions(suggestions);
  if (suggestions.length === 0) return null;
  return (
    <div className="planning-suggestions" aria-labelledby="planning-suggestions-title">
      <h3 id="planning-suggestions-title">Suggestions sur vos arrosages validés</h3>
      <p className="planning-suggestions-note">Le moteur ne modifie jamais un arrosage validé : il suggère, vous décidez. « Appliquer » passe par la modification ou l’annulation ordinaire de l’irrigation ; « Garder » fait taire la suggestion jusqu’à ce qu’un calcul en fasse une autre.</p>
      {active.length === 0 ? (
        <p className="planning-empty">Aucune suggestion en attente.</p>
      ) : (
        <ul className="planning-suggestion-list">
          {active.map((suggestion) => (
            <SuggestionItem key={suggestion.eventEquipmentId} suggestion={suggestion} pending={pending} feedback={feedback[suggestion.eventEquipmentId]} onApply={onApply} onKeep={onKeep} />
          ))}
        </ul>
      )}
      {kept.length > 0 ? (
        <details className="planning-kept">
          <summary>{kept.length} suggestion{kept.length > 1 ? 's' : ''} gardée{kept.length > 1 ? 's' : ''}</summary>
          <ul className="planning-suggestion-list">
            {kept.map((suggestion) => <SuggestionItem key={suggestion.eventEquipmentId} suggestion={suggestion} pending={pending} feedback={undefined} />)}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function SuggestionItem({ suggestion, pending, feedback, onApply, onKeep }: {
  suggestion: StoredPlanSuggestion;
  pending: boolean;
  feedback: SuggestionFeedback | undefined;
} & Partial<SuggestionHandlers>) {
  const reduced = suggestion.suggestion === 'reduce' && suggestion.durationSeconds !== null
    ? ` · durée ${formatDuration(suggestion.durationSeconds)} au lieu de ${formatDuration(suggestion.plannedDurationSeconds)}`
    : '';
  return (
    <li className="planning-suggestion" data-suggestion={suggestion.suggestion} data-kept={suggestion.kept} data-event-equipment-id={suggestion.eventEquipmentId}>
      <div className="planning-suggestion-head">
        <strong>{suggestionLabel(suggestion)}</strong>
        <span>{suggestion.equipmentName} · {formatDateTime(suggestion.plannedStartAt)} → {formatTime(suggestion.plannedEndAt)} · {formatMm(suggestion.plannedDoseMm)} prévus{reduced}</span>
      </div>
      {suggestion.causes.length > 0 ? (
        <ul className="planning-suggestion-causes">
          {suggestion.causes.map((cause, index) => <li key={`${cause.kind}-${index}`}>{suggestionCauseLabel(cause, FORMAT)}</li>)}
        </ul>
      ) : null}
      {feedback ? <p className={feedback.ok ? 'planning-proposal-feedback' : 'planning-proposal-refusal'} role={feedback.ok ? 'status' : 'alert'}>{feedback.message}</p> : null}
      {onApply && onKeep && !suggestion.kept ? (
        <div className="planning-suggestion-actions">
          <button type="button" className="primary" disabled={pending} onClick={() => onApply(suggestion)}>Appliquer</button>
          <button type="button" disabled={pending} onClick={() => onKeep(suggestion)}>Garder</button>
        </div>
      ) : null}
    </li>
  );
}

/** Le pli « Ce qui a changé depuis le calcul de … » (règle 25) : une lecture, rien à modifier. */
export function ChangesFold({ changes }: { changes: PlanChanges }) {
  const lines = planChangesLines(changes, FORMAT);
  return (
    <details className="planning-changes">
      <summary>{planChangesTitle(changes, FORMAT)} · {lines.length === 0 ? 'rien' : `${lines.length} changement${lines.length > 1 ? 's' : ''}`}</summary>
      {lines.length === 0 ? (
        <p className="planning-empty">Rien n’a changé : mêmes propositions, mêmes suggestions, mêmes planches servies.</p>
      ) : (
        <ul>
          {lines.map((line, index) => <li key={`${line.kind}-${index}`} data-kind={line.kind}>{line.text}</li>)}
        </ul>
      )}
    </details>
  );
}
