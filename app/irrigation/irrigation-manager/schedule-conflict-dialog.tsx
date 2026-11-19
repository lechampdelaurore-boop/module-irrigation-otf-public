'use client';

import { FARM_TIME_ZONE } from '@/lib/domain/water-management';
import type { IrrigationEventConfirmation } from '../irrigation-event/contract';
import { ConfirmDialog } from '../shell/confirm-dialog';
import type { CreationKind } from './presentation';

const dayFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: FARM_TIME_ZONE });
const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: FARM_TIME_ZONE });

/** « 11 h 13 », à l'heure de la ferme. */
function clockText(value: string) {
  return timeFormatter.format(new Date(value)).replace(':', ' h ');
}

const LABELS: Record<CreationKind | 'edit', { title: string; question: string; confirm: string; cancel: string }> = {
  running: { title: 'Démarrer une seconde irrigation ?', question: 'En démarrer une maintenant ?', confirm: 'Démarrer quand même', cancel: 'Ne pas démarrer' },
  planned: { title: 'Planifier une seconde irrigation ?', question: 'En planifier une seconde ?', confirm: 'Planifier quand même', cancel: 'Ne pas planifier' },
  completed: { title: 'Enregistrer une seconde irrigation ?', question: 'En enregistrer une seconde ?', confirm: 'Enregistrer quand même', cancel: 'Ne pas enregistrer' },
  edit: { title: 'Modifier sur un créneau occupé ?', question: 'Modifier quand même ?', confirm: 'Modifier quand même', cancel: 'Ne pas modifier' },
};

/**
 * Le même matériel a déjà une irrigation planifiée sur ce créneau (audit du
 * 19 novembre 2026, lot G, n° 1, F407) : rien n'est écrit tant que le
 * maraîcher n'a pas répondu.
 */
export function ScheduleConflictDialog({ conflict, creationKind, pending, onConfirm, onCancel }: {
  conflict: IrrigationEventConfirmation | null;
  creationKind: CreationKind | 'edit';
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const labels = LABELS[creationKind];
  return (
    <ConfirmDialog
      open={conflict !== null}
      title={labels.title}
      confirmLabel={labels.confirm}
      cancelLabel={labels.cancel}
      pending={pending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {conflict ? (
        <p>
          Ce matériel a déjà une irrigation planifiée le {dayFormatter.format(new Date(conflict.plannedStartAt))},
          de {clockText(conflict.plannedStartAt)} à {clockText(conflict.plannedEndAt)}. {labels.question}
        </p>
      ) : null}
    </ConfirmDialog>
  );
}
