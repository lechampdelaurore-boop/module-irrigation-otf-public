'use client';

import { useEffect, useState } from 'react';
import { ALERT_TIMING_EXPLANATION, alertReadingNote } from '@/lib/domain/weather/alert-reading-note';

/**
 * La dernière lecture de la météo et pourquoi une alerte peut tarder, sur
 * les pages « Alertes météo » et « Alertes cultures » (C5, D-307). L'âge se
 * juge une fois la page prête : le rendu du serveur dit l'heure seule.
 */
export function AlertReadingNote({ lastReadingAt }: { lastReadingAt: string | null }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) setNow(new Date());
    });
    return () => {
      mounted = false;
    };
  }, []);
  const note = alertReadingNote(lastReadingAt, now);
  return (
    <div className="alert-reading-note" data-tone={note.tone}>
      <p>{note.text}</p>
      <details>
        <summary>Pourquoi une alerte peut arriver en retard</summary>
        <p>{ALERT_TIMING_EXPLANATION}</p>
      </details>
    </div>
  );
}
