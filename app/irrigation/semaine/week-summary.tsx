'use client';

import { useState } from 'react';
import type { WeekGardenLine, WeekGardens } from '@/lib/domain/semaine/week-gardens';
import type { WeekBilan } from '@/lib/domain/semaine/week-sentence';

/**
 * Le bilan de la semaine (simplification, lot S4, PR 2,
 * docs/simplification-s4-contract.md, sections 4.3 et 4.4) : une barre de
 * 14 px, reçus sur visés, son nom lu « 12 mm reçus sur 23 mm visés », et
 * trois chiffres, reçus, visés, arrosés. Jamais une couleur seule : chaque
 * chiffre est écrit. Sans objectif, pas de barre : « Poser un objectif ».
 */
export function WeekBilanCard({ bilan, goalsHref }: { bilan: WeekBilan; goalsHref: string }) {
  return (
    <section className="week-bilan" aria-labelledby="week-bilan-title">
      <h3 id="week-bilan-title" className="sr-only">Le bilan de la semaine</h3>
      {bilan.bar ? (
        <span className="week-bilan-bar" role="img" aria-label={bilan.bar.label} data-unknown={bilan.bar.unknown || undefined}>
          <i data-tone="irrigation" style={{ width: `${bilan.bar.irrigationPercent}%` }} />
          <i data-tone="rain" style={{ width: `${bilan.bar.rainPercent}%` }} />
        </span>
      ) : null}
      <dl className="week-bilan-figures">
        <div data-missing={bilan.received.value === null || undefined}>
          <dt>{bilan.received.value === null ? 'Eau reçue' : 'reçus'}</dt>
          <dd><strong>{bilan.received.value ?? 'inconnue'}</strong>{bilan.received.detail ? <small>{bilan.received.detail}</small> : null}</dd>
        </div>
        <div data-missing={bilan.objective.value === null || undefined}>
          <dt>{bilan.objective.value === null ? 'Eau visée' : 'visés'}</dt>
          <dd>
            <strong>{bilan.objective.value ?? 'aucune'}</strong>
            {bilan.objective.value === null ? <a href={goalsHref}>Poser un objectif</a> : <small>{bilan.objective.detail}</small>}
          </dd>
        </div>
        {bilan.watered.value ? (
          <div>
            <dt>arrosés</dt>
            <dd><strong>{bilan.watered.value}</strong></dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

/**
 * « Jardin par jardin » (section 6) : une ligne par jardin, son nom,
 * « 12 mm sur 20 mm », une barre de 10 px ; la ligne mène au pli du jardin
 * dans « Ce qu'il reste à arroser ». Dix jardins, puis « Voir les n autres »
 * (S4-j) ; aucun n'est perdu.
 */
export function WeekGardensList({ gardens, goalsHref }: { gardens: WeekGardens; goalsHref: string }) {
  const [showAll, setShowAll] = useState(false);
  const lines = showAll ? [...gardens.shown, ...gardens.hidden] : gardens.shown;
  if (lines.length === 0) return null;
  return (
    <section className="week-gardens" aria-labelledby="week-gardens-title">
      <h3 id="week-gardens-title">Jardin par jardin</h3>
      <ul>
        {lines.map((line) => <GardenLine key={line.key} line={line} goalsHref={goalsHref} />)}
      </ul>
      {gardens.moreLabel ? (
        <button type="button" className="week-gardens-more" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Voir moins' : gardens.moreLabel}
        </button>
      ) : null}
      {gardens.unaimedBeds ? <p className="week-gardens-unaimed">{gardens.unaimedBeds} <a href={goalsHref}>Poser un objectif</a></p> : null}
    </section>
  );
}

function GardenLine({ line, goalsHref }: { line: WeekGardenLine; goalsHref: string }) {
  return (
    <li className="week-garden" data-aimed={line.aimed}>
      <a className="week-garden-link" href={`#${line.anchor}`}>
        <span className="week-garden-name" aria-hidden="true">{line.name}</span>
        <span className="week-garden-text" aria-hidden="true">{line.text}</span>
        {line.bar ? (
          <span className="week-garden-bar" aria-hidden="true" data-unknown={line.bar.unknown || undefined}>
            <i data-tone="irrigation" style={{ width: `${line.bar.irrigationPercent}%` }} />
            <i data-tone="rain" style={{ width: `${line.bar.rainPercent}%` }} />
          </span>
        ) : null}
        <span className="sr-only">{line.label}</span>
      </a>
      {line.aimed ? null : <a className="week-garden-goal" href={goalsHref}>Lui en donner une</a>}
    </li>
  );
}
