'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { logJsonLine } from '@/lib/adapters/log';
import { DemoResetRefusedError, resetDemoSpace } from '@/lib/services/demo-reset';

/**
 * Le bouton « Remettre à zéro » de la bannière de la démonstration
 * (docs/demo-guided-contract.md, section 8 ; D4), après la confirmation de
 * l'invité : l'espace de la ferme et du moment ouverts revient à sa première
 * ouverture. Refusé hors démonstration.
 */

export type DemoResetActionResult = { ok: true } | { ok: false; message: string };

export async function resetDemoSpaceAction(): Promise<DemoResetActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  try {
    await resetDemoSpace(user.userId);
    // Jamais l'identifiant de l'invité : un événement et une heure.
    logJsonLine('info', { event: 'irrigation_demo_reset', at: new Date().toISOString() });
    return { ok: true };
  } catch (error) {
    if (error instanceof DemoResetRefusedError) return { ok: false, message: error.message };
    return { ok: false, message: 'La remise à zéro n’a pas abouti. Réessayez.' };
  }
}
