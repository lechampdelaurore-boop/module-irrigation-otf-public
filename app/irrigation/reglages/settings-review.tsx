'use client';

import { useState, useTransition } from 'react';
import { pageHref } from '@/lib/domain/features/pages';
import { SETTINGS_STEP_ANCHOR } from '@/lib/domain/onboarding/steps';
import type { SettingsReview } from '@/lib/services/onboarding-settings';
import { answerSettingsGroupAction } from '../onboarding-settings-actions';

const ANSWER_WORDS = { validated: 'Validé', skipped: 'Passé' } as const;

/**
 * « Réglages à relire » d'une ferme neuve (4.4, docs/tranche-4-contract.md,
 * F424 ; PR 5a, F588) : chaque groupe des cases cochées, ses valeurs de
 * départ avec leur source, « proposé, à ajuster » ; la personne valide ou
 * passe le groupe, et l'ajuste dans sa page. Aucun planning n'est calculé
 * avant la validation du groupe « Planning ».
 */
export function SettingsReviewSection({ season, initialReview }: { season: number; initialReview: SettingsReview }) {
  const [review, setReview] = useState(initialReview);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (review.groups.length === 0) return null;
  const answer = (group: string, value: 'validated' | 'skipped') => startTransition(async () => {
    const result = await answerSettingsGroupAction({ group, answer: value });
    if (result.ok) { setReview(result.review); setNotice(result.message); setError(null); }
    else { setError(result.message); setNotice(null); }
  });
  return (
    <section id={SETTINGS_STEP_ANCHOR} className="water-management-section settings-review" aria-labelledby="settings-review-title">
      <h2 id="settings-review-title">Réglages à relire</h2>
      <p>
        Les valeurs de départ du module, avec leur source : elles sont proposées, à ajuster. Validez ou passez chaque groupe ;
        ajustez-le dans sa page. Aucun planning n’est calculé avant que vous ayez validé le groupe « Planning ».
      </p>
      {notice ? <p className="water-notice" role="status">{notice}</p> : null}
      {error ? <p className="water-error" role="alert">{error}</p> : null}
      <ul className="settings-review-groups">
        {review.groups.map((group) => (
          <li key={group.id} className="settings-review-group" data-answer={group.answer ?? 'none'}>
            <h3>
              {group.label}
              <small>{group.answer ? ANSWER_WORDS[group.answer] : 'Proposé, à ajuster'}</small>
            </h3>
            <dl>
              {group.lines.map((line) => (
                <div key={line.label}>
                  <dt>{line.label}</dt>
                  <dd>{line.value} <small>({line.source})</small></dd>
                </div>
              ))}
            </dl>
            {group.answer === 'skipped' ? <p className="settings-review-consequence">{group.skippedConsequence}</p> : null}
            <div className="settings-review-actions">
              <button type="button" className="primary" disabled={pending || group.answer === 'validated'} onClick={() => answer(group.id, 'validated')}>
                Valider « {group.label} »
              </button>
              <button type="button" disabled={pending || group.answer === 'skipped'} onClick={() => answer(group.id, 'skipped')}>
                Passer
              </button>
              <a href={pageHref(group.page, { season }, group.anchor)}>Ajuster</a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
