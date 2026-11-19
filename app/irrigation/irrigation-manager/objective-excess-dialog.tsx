'use client';

import { millimetersText } from '@/lib/domain/display-numbers';
import type { ObjectiveExcess } from '@/lib/domain/irrigation-form-hints';
import { ConfirmDialog } from '../shell/confirm-dialog';

const LABELS = {
  running: { question: 'Irriguer quand même ?', confirm: 'Irriguer quand même', cancel: 'Ne pas irriguer' },
  planned: { question: 'Planifier quand même ?', confirm: 'Planifier quand même', cancel: 'Ne pas planifier' },
  edit: { question: 'Modifier quand même ?', confirm: 'Modifier quand même', cancel: 'Ne pas modifier' },
} as const;

/**
 * L'apport estimé d'une planche dépasse l'objectif de sa semaine (audit du
 * 19 novembre 2026, lot G, n° 9, F410) : un avertissement, jamais un refus ;
 * confirmé, l'arrosage s'enregistre.
 */
export function ObjectiveExcessDialog({ excess, kind, pending, onConfirm, onCancel }: {
  excess: ObjectiveExcess | null;
  kind: keyof typeof LABELS;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const labels = LABELS[kind];
  return (
    <ConfirmDialog
      open={excess !== null}
      title="Au-delà de l’objectif de la semaine"
      confirmLabel={labels.confirm}
      cancelLabel={labels.cancel}
      pending={pending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {excess ? (
        <p>
          {millimetersText(excess.amountMm)} dépassent l’objectif de la semaine de {excess.bedName} ({millimetersText(excess.objectiveMm)})
          {excess.otherBeds > 0 ? `, et celui de ${excess.otherBeds} autre${excess.otherBeds > 1 ? 's' : ''} planche${excess.otherBeds > 1 ? 's' : ''}` : ''}.
          {' '}{labels.question}
        </p>
      ) : null}
    </ConfirmDialog>
  );
}
