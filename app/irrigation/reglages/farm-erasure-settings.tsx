'use client';

import { useState, useTransition } from 'react';
import { FARM_ERASURE_EXPLANATION, sameFarmName } from '@/lib/domain/operations/farm-erasure-request';
import { requestFarmErasureAction, type FarmErasureActionResult } from '../farm-erasure-actions';

const FARM_ERASURE_ANCHOR = 'supprimer-ma-ferme';

/**
 * « Supprimer ma ferme et mes données », en bas de Réglages (4.5, PR 3,
 * troisième partie ; docs/tranche-4-contract.md, F563, et 10 bis.22, F665) :
 * ce qui disparaît, ce qui reste, le délai et l'annulation, l'autorisation
 * à retirer dans Ouvre ta ferme ; la demande ne part qu'une fois le nom de la
 * ferme tapé, et le serveur le relit. Fermé par défaut ; absent de la
 * démonstration.
 */
export function FarmErasureSettings({ farmName, season }: { farmName: string; season: number }) {
  const [typedName, setTypedName] = useState('');
  const [answer, setAnswer] = useState<FarmErasureActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const typed = sameFarmName(typedName, farmName);
  const submit = () => startTransition(async () => {
    const result = await requestFarmErasureAction({ typedName, season });
    setAnswer(result);
    // L'espace est figé dès la demande : la page se relit sur son écran (F666).
    if (result.ok) window.location.reload();
  });
  return (
    <section id={FARM_ERASURE_ANCHOR} className="water-management-section farm-erasure-settings" aria-labelledby="farm-erasure-title">
      <details className="water-panel water-fold">
        <summary>
          <h2 id="farm-erasure-title">Supprimer ma ferme et mes données</h2>
          <small>Effacement sept jours après la demande, annulable jusque-là</small>
        </summary>
        <div className="water-fold-body">
          {FARM_ERASURE_EXPLANATION.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <form
            className="farm-erasure-form"
            aria-label="Demander la suppression de la ferme"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label>
              <span>Pour confirmer, tapez le nom de la ferme : « {farmName} »</span>
              <input type="text" autoComplete="off" spellCheck={false} value={typedName} onChange={(event) => setTypedName(event.target.value)} />
            </label>
            <button type="submit" className="danger-button" disabled={pending || !typed}>
              {pending ? 'Demande en cours…' : 'Supprimer ma ferme et mes données'}
            </button>
          </form>
          {answer ? <p className={answer.ok ? 'water-notice' : 'water-error'} role={answer.ok ? 'status' : 'alert'}>{answer.message}</p> : null}
        </div>
      </details>
    </section>
  );
}
