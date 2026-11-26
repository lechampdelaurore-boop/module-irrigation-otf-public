'use client';

import { useId, useState, type MouseEvent, type ReactNode } from 'react';
import type { WeekGardenLine, WeekGardens } from '@/lib/domain/semaine/week-gardens';
import type { WeekBilan } from '@/lib/domain/semaine/week-sentence';
import { isOnScreen } from '../shell/on-screen';

/**
 * Le bilan de la semaine (simplification, lot S4, PR 2,
 * docs/simplification-s4-contract.md, sections 4.3 et 4.4) : une barre de
 * 14 px, reçus sur visés, son nom lu « 12 mm reçus sur 23 mm visés », et
 * trois chiffres, reçus, visés, arrosés. Jamais une couleur seule : chaque
 * chiffre est écrit. Sans objectif, pas de barre : « Poser un objectif ».
 *
 * Ses gestes (PR 3, sections 4.5, 8.1 à 8.3), qui n'écrivent rien par
 * eux-mêmes (D-028) : « Comprendre ces chiffres » déplie dessous les tuiles
 * de résumé de la semaine, d'où viennent les chiffres ; « Changer l'eau
 * visée » ouvre le pli des objectifs, le premier champ au clavier ;
 * « Noter la pluie » ouvre la fenêtre de S2, quand la pluie compte.
 */
export function WeekBilanCard({ bilan, goalsHref, tiles, rain }: {
  bilan: WeekBilan;
  goalsHref: string;
  /** Les tuiles de résumé de la semaine, dans « Comprendre ces chiffres ». */
  tiles: ReactNode;
  /** « Noter la pluie » ; `null` : la ferme n'a pas ce geste. */
  rain: { open: () => void; pending: boolean; reply: ReactNode } | null;
}) {
  const [understand, setUnderstand] = useState(false);
  const understandId = useId();
  const goalSet = bilan.objective.value !== null;
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
        <div data-missing={!goalSet || undefined}>
          <dt>{goalSet ? 'visés' : 'Eau visée'}</dt>
          <dd>
            <strong>{bilan.objective.value ?? 'aucune'}</strong>
            {goalSet ? <small>{bilan.objective.detail}</small> : <a href={goalsHref} onClick={(event) => openGoals(event, goalsHref)}>Poser un objectif</a>}
          </dd>
        </div>
        {bilan.watered.value ? (
          <div>
            <dt>arrosés</dt>
            <dd><strong>{bilan.watered.value}</strong></dd>
          </div>
        ) : null}
      </dl>
      <div className="week-bilan-actions">
        <button type="button" className="week-bilan-link" aria-expanded={understand} aria-controls={understandId} onClick={() => setUnderstand((value) => !value)}>
          Comprendre ces chiffres
        </button>
        {goalSet ? <a className="week-bilan-link" href={goalsHref} onClick={(event) => openGoals(event, goalsHref)}>Changer l’eau visée</a> : null}
        {rain ? <button type="button" className="week-bilan-link" disabled={rain.pending} onClick={rain.open}>Noter la pluie</button> : null}
      </div>
      {rain?.reply}
      <div id={understandId} className="week-understand" hidden={!understand}>
        {tiles}
      </div>
    </section>
  );
}

/**
 * Le champ que « Changer l'eau visée » met sous le clavier : les millimètres
 * de l'objectif (F933) ; le périmètre, « Toute la ferme » par défaut, est
 * juste au-dessus. Sinon, le premier champ du pli.
 */
const GOAL_FIELD = '.water-inline-form input:not([disabled])';
const FIRST_FIELD = 'select:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled])';

/**
 * « Changer l'eau visée » et « Poser un objectif » (section 8.2) : l'ancre
 * ouvre le pli des objectifs et ceux qui le portent (`AnchoredFold`), sans
 * changer de page ; le champ prend le clavier dès que le pli l'affiche. Un
 * pli fermé garde son contenu dans la page sans le montrer : le champ n'est
 * pris que visible, et l'essai se refait tant que le clavier n'y est pas.
 * Une ancre déjà dans l'adresse rouvre quand même ses plis.
 */
export function openGoals(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (window.location.hash === href) {
    event.preventDefault();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  const id = href.slice(1);
  let frames = 0;
  const focusWhenShown = () => {
    const fold = document.getElementById(id);
    const field = fold?.querySelector<HTMLElement>(GOAL_FIELD) ?? fold?.querySelector<HTMLElement>(FIRST_FIELD) ?? null;
    if (field && isOnScreen(field)) {
      field.focus();
      if (document.activeElement === field) return;
    }
    frames += 1;
    if (frames < 120) requestAnimationFrame(focusWhenShown);
  };
  requestAnimationFrame(focusWhenShown);
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
      {gardens.unaimedBeds ? <p className="week-gardens-unaimed">{gardens.unaimedBeds} <a href={goalsHref} onClick={(event) => openGoals(event, goalsHref)}>Poser un objectif</a></p> : null}
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
      {line.aimed ? null : <a className="week-garden-goal" href={goalsHref} onClick={(event) => openGoals(event, goalsHref)}>Lui en donner une</a>}
    </li>
  );
}
