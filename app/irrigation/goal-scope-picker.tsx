'use client';

import { useId, useMemo, useState } from 'react';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import {
  countGoalScopeMatches,
  filterGoalScopeChoices,
  goalScopeChoiceGroups,
} from '@/lib/domain/goal-scope-choices';

/**
 * Le périmètre d'un objectif (audit ergonomique, point 4, 3.8 quater) : une
 * recherche tapée au-dessus de la liste, et la liste rangée par jardin, dans
 * l'ordre naturel des noms. Taper « B9 » ne garde que les planches B9.
 */
export function GoalScopePicker({
  snapshot,
  season,
  value,
  onChange,
}: {
  snapshot: IrrigationSnapshot;
  season: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState('');
  const hintId = useId();
  const groups = useMemo(() => goalScopeChoiceGroups(snapshot, season), [snapshot, season]);
  const shown = filterGoalScopeChoices(groups, query, value);
  const matches = query.trim() ? countGoalScopeMatches(groups, query) : null;

  return (
    <div className="goal-scope-picker">
      <label>
        <span>Chercher un périmètre</span>
        <input
          type="search"
          value={query}
          placeholder="B9, bloc 1, Tunnel…"
          aria-describedby={hintId}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <label>
        <span>Périmètre</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {shown.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <small id={hintId} className="goal-scope-hint" role="status">
        {matches === null
          ? 'Rangé par jardin ; tapez un nom pour réduire la liste.'
          : matches === 0
            ? 'Aucun périmètre ne correspond à cette recherche.'
            : `${matches} périmètre${matches > 1 ? 's' : ''} trouvé${matches > 1 ? 's' : ''}.`}
      </small>
    </div>
  );
}
