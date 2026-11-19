'use client';

import { useCallback, useState } from 'react';
import { ConfirmDialog } from './confirm-dialog';

export type ConfirmRequest = {
  title: string;
  /** La phrase de toujours, telle que la boîte du navigateur la disait. */
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Rouge par défaut : chaque confirmation remplacée efface ou annule (F414). */
  tone?: 'add' | 'erase';
};

/**
 * La fenêtre de confirmation du module à la place de `window.confirm`
 * (audit du 19 novembre 2026, lot G, n° 8, F413) : `confirm` rend une
 * promesse vraie si la personne confirme, fausse si elle renonce ; `dialog`
 * se pose une fois dans la section qui l'appelle.
 */
export function useConfirm() {
  const [request, setRequest] = useState<(ConfirmRequest & { resolve: (confirmed: boolean) => void }) | null>(null);
  const confirm = useCallback((next: ConfirmRequest) => new Promise<boolean>((resolve) => setRequest({ ...next, resolve })), []);
  const close = (confirmed: boolean) => {
    request?.resolve(confirmed);
    setRequest(null);
  };
  const dialog = (
    <ConfirmDialog
      open={request !== null}
      title={request?.title ?? ''}
      confirmLabel={request?.confirmLabel ?? ''}
      cancelLabel={request?.cancelLabel ?? ''}
      tone={request?.tone ?? 'erase'}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    >
      {request ? <p>{request.text}</p> : null}
    </ConfirmDialog>
  );
  return { confirm, dialog };
}
