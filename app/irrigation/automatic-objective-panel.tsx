'use client';

import { useEffect, useId, useRef } from 'react';
import { millimetersText } from '@/lib/domain/display-numbers';
import { automaticObjectiveEnableText, type AutomaticObjectiveLine } from '@/lib/domain/objective-reading';

/**
 * L'objectif automatique se voit et se modifie dans le volet « Objectifs de
 * la semaine » (6 quaterdecies, PR A1, docs/objectif-automatique-saison-contract.md,
 * section 3 ; D-337) : les lignes « automatique » de la liste et la fenêtre
 * d'allumage. Affichage et gestes existants seulement : les valeurs viennent
 * du tableau des besoins, les gestes sont ceux du volet.
 */

/** Ce que l'allumage décide quand des planches gardent un objectif saisi (point 5). */
export type EnableChoice = 'keep' | 'clear' | 'cancel';

/**
 * La fenêtre d'allumage (point 5) : « Allumer, garder mes objectifs » par
 * défaut, « Allumer et vider les objectifs » en rouge, comme « Vider les
 * objectifs » (F414, F415), et « Annuler ». L'écran ne vide jamais seul.
 */
export function AutomaticObjectiveEnableDialog({ keptGoalBeds, onChoose }: {
  /** Les planches qui gardent un objectif saisi ; `null` : la fenêtre est fermée. */
  keptGoalBeds: number | null;
  onChoose: (choice: EnableChoice) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const open = keptGoalBeds !== null;
  useEffect(() => {
    if (open && !dialog.current?.open) {
      dialog.current?.showModal();
      keep.current?.focus();
    }
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="module-confirm-dialog automatic-objective-enable"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onChoose('cancel'); }}
    >
      <h3 id={titleId}>Allumer l’objectif automatique ?</h3>
      <div className="module-confirm-body">
        <p>{keptGoalBeds === null ? '' : automaticObjectiveEnableText(keptGoalBeds)}</p>
        <p>Les garder : ces planches suivent leur objectif saisi, les autres l’objectif automatique. Les vider : toute la ferme suit l’objectif automatique ; l’historique est conservé.</p>
      </div>
      <div className="irrigation-dialog-actions">
        <button type="button" onClick={() => onChoose('cancel')}>Annuler</button>
        <button type="button" className="confirm-erase" onClick={() => onChoose('clear')}>Allumer et vider les objectifs</button>
        <button type="button" className="primary" ref={keep} onClick={() => onChoose('keep')}>Allumer, garder mes objectifs</button>
      </div>
    </dialog>
  );
}

/**
 * Les lignes « automatique » de la liste du volet (point 2) : par jardin, et
 * par planche qui s'écarte de son jardin, ses millimètres de la semaine et
 * leur origine ; « Corriger » choisit l'endroit dans le sélecteur, le champ
 * montre sa valeur, la saisie passe avant (point 3).
 */
export function AutomaticObjectiveLines({ lines, pending, onCorrect }: {
  lines: readonly AutomaticObjectiveLine[];
  pending: boolean;
  onCorrect: (scopeValue: string) => void;
}) {
  return (
    <>
      {lines.map((line) => (
        <span key={line.key} className="goal-chip-automatic">
          <strong>{line.label}</strong>
          {line.mm === null ? 'sans valeur' : millimetersText(Math.round(line.mm * 10) / 10)}
          <small>{line.origin}{line.forecast ? ' · prévu' : ''}</small>
          <button type="button" className="secondary-button" disabled={pending} onClick={() => onCorrect(line.scopeValue)}>Corriger</button>
        </span>
      ))}
    </>
  );
}
