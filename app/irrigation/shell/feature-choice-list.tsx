'use client';

import type { FeatureId } from '@/lib/domain/features/catalogue';
import { featureChoiceLine, featureChoiceRows } from '@/lib/domain/features/choice';
import type { FeatureSelection } from '@/lib/domain/features/selection';
import { Icon } from '../line-icon';
import { PAGE_ICONS } from './page-icons';

/**
 * La liste des dix cases (docs/feature-selection-contract.md, sections 2 et
 * 4), à la première ouverture et dans Réglages. Une case nécessaire à une case
 * cochée est grisée et dit pour laquelle (R3) ; une case décochée dit ce que
 * la cocher cochera avec elle.
 */
export function FeatureChoiceList({
  selection,
  disabled,
  keepOne,
  onToggle,
}: {
  selection: FeatureSelection;
  disabled: boolean;
  /** Dans Réglages, la dernière case cochée ne se décoche pas (P7). */
  keepOne: boolean;
  onToggle: (id: FeatureId, checked: boolean) => void;
}) {
  const rows = featureChoiceRows(selection);
  return (
    <fieldset className="feature-choice" data-tour="fonctionnalites">
      <legend>Fonctionnalités</legend>
      <ul>
        {rows.map((row) => {
          const last = keepOne && row.checked && selection.length === 1;
          const locked = row.checked && (row.requiredBy.length > 0 || last);
          const line = last ? 'Au moins une fonctionnalité reste cochée.' : featureChoiceLine(row);
          const lineId = `feature-line-${row.id}`;
          return (
            <li key={row.id} data-checked={row.checked} data-locked={locked}>
              <label>
                <input
                  type="checkbox"
                  checked={row.checked}
                  disabled={disabled || locked}
                  aria-describedby={line ? lineId : undefined}
                  onChange={(event) => onToggle(row.id, event.currentTarget.checked)}
                />
                <Icon name={PAGE_ICONS[row.id]} />
                <span className="feature-choice-copy">
                  <strong>{row.label}</strong>
                  <small>{row.summary}</small>
                  {line ? <em id={lineId}>{line}</em> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
