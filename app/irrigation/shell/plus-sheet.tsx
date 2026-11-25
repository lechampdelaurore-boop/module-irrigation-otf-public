'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { pagePath } from '@/lib/domain/features/pages';
import { PLUS_BUTTON_LABEL, PLUS_SHEET_TITLE, WATERING_INTENT, WATERING_INTENT_VALUES, type PlusGesture } from '@/lib/domain/features/plus-sheet';
import type { RainEntry } from '@/lib/domain/today/rain-entry';
import { Icon, type IconName } from '../line-icon';
import { RainEntryForm } from '../rain-entry-dialog';
import { readRainEntryAction } from '../water-actions';

const GESTURE_ICONS: Record<PlusGesture['id'], IconName> = {
  'arroser-maintenant': 'goutte',
  'noter-la-pluie': 'pluie',
  'arrosage-fait': 'coche',
};

type RainState =
  | { kind: 'closed' }
  | { kind: 'reading' }
  | { kind: 'refused'; message: string }
  | { kind: 'open'; entry: RainEntry; season: number };

/**
 * Le « + » de la barre du bas et sa feuille « Que voulez-vous faire ? »
 * (simplification, lot S3, PR 2, docs/simplification-s3-contract.md,
 * sections 4 et 4.1 ; D-331). Un bouton, pas un lien : il ouvre une feuille
 * modale qui monte du bas (`<dialog>`, le clavier gardé dedans) ; Échap, un
 * geste hors de la feuille ou « Fermer » la referment, et le clavier revient
 * sur le « + ». Les gestes viennent du domaine (`plusGestures`).
 *
 * « Arroser maintenant » et « Noter un arrosage déjà fait » ouvrent
 * « Arrosages » sur leur formulaire, par une demande portée par l'adresse,
 * lue une fois puis retirée (`?arroser=`, comme `?planifier=1`). « Noter la
 * pluie » monte dans la feuille le formulaire de S2, sans changer de page :
 * les mesures déjà notées se lisent à l'ouverture du geste, jamais avec la
 * page ; la réponse s'écrit sous le geste, et la page derrière se relit à la
 * fermeture de la feuille pour montrer la nouvelle pluie. Rien ne s'écrit
 * sans un appui (D-028).
 */
export function PlusSheet({ gestures, season, planning, besoinsHref }: {
  gestures: readonly PlusGesture[];
  /** La saison de la page, gardée par les liens vers « Arrosages » ; `null` sur la page introuvable. */
  season: number | null;
  /** « Le plan se recalcule » ne se dit que « Planning » coché. */
  planning: boolean;
  /** « Retirer une mesure, voir jour par jour » : `null` sans « Objectifs et besoins ». */
  besoinsHref: string | null;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const rainId = useId();
  const [open, setOpen] = useState(false);
  const [rain, setRain] = useState<RainState>({ kind: 'closed' });
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [, startReading] = useTransition();

  // La feuille ne vit qu'ouverte, posée hors de la barre (`document.body`) : les styles de la barre ne la touchent pas.
  useEffect(() => {
    if (open && sheet.current && !sheet.current.open) sheet.current.showModal();
  }, [open]);

  const close = () => {
    if (pending) return;
    // Une pluie enregistrée : la page derrière se relit, pour que le plan et
    // les chiffres la montrent ; ses blocs gardent leur état, un simple
    // rafraîchissement ne les relirait pas tous.
    if (saved) {
      window.location.reload();
      return;
    }
    // Fermée d'abord : tant qu'elle est modale, le reste de la page est inerte et le « + » ne prendrait pas le clavier.
    sheet.current?.close();
    setOpen(false);
    setRain({ kind: 'closed' });
    button.current?.focus();
  };

  const toggleRain = () => {
    if (rain.kind !== 'closed') {
      setRain({ kind: 'closed' });
      return;
    }
    setRain({ kind: 'reading' });
    startReading(async () => {
      const result = await readRainEntryAction();
      setRain(result.ok ? { kind: 'open', entry: result.entry, season: result.season } : { kind: 'refused', message: result.message });
    });
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="phone-bar-plus"
        aria-label={PLUS_BUTTON_LABEL}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="phone-bar-plus-badge"><Icon name="plus" /></span>
      </button>
      {open ? createPortal(
      <dialog
        ref={sheet}
        className="plus-sheet"
        aria-labelledby={titleId}
        onCancel={(event) => { event.preventDefault(); close(); }}
        // Un geste sur le voile, hors de la feuille, la referme.
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <div className="plus-sheet-body">
          <span className="plus-sheet-handle" aria-hidden="true" />
          <h2 id={titleId}>{PLUS_SHEET_TITLE}</h2>
          <ul className="plus-gestures">
            {gestures.map((gesture) => (
              <li key={gesture.id} data-gesture={gesture.id}>
                {gesture.id === 'noter-la-pluie' ? (
                  <>
                    <button type="button" className="plus-gesture" aria-expanded={rain.kind !== 'closed'} aria-controls={rainId} onClick={toggleRain}>
                      <GestureText gesture={gesture} />
                    </button>
                    <div id={rainId} className="plus-rain" hidden={rain.kind === 'closed'}>
                      {rain.kind === 'reading' ? <p className="plus-rain-reading" role="status">Lecture de la pluie déjà notée…</p> : null}
                      {rain.kind === 'refused' ? <p className="rain-entry-refusal" role="alert">{rain.message}</p> : null}
                      {rain.kind === 'open' ? (
                        <RainEntryForm
                          className="rain-entry-form plus-rain-form"
                          entry={rain.entry}
                          season={rain.season}
                          planning={planning}
                          besoinsHref={besoinsHref}
                          onPending={setPending}
                          onSaved={(text) => {
                            // Le formulaire se replie avec sa réponse : il ne dira plus la fin de son enregistrement.
                            setPending(false);
                            setRain({ kind: 'closed' });
                            setSaved(text);
                          }}
                        />
                      ) : null}
                    </div>
                    {saved ? <p className="plus-rain-saved" role="status">{saved}</p> : null}
                  </>
                ) : (
                  <a className="plus-gesture" href={wateringHref(gesture.id, season)}>
                    <GestureText gesture={gesture} />
                  </a>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="secondary-button plus-sheet-close" disabled={pending} onClick={close}>Fermer</button>
        </div>
      </dialog>,
      document.body,
      ) : null}
    </>
  );
}

function GestureText({ gesture }: { gesture: PlusGesture }) {
  return (
    <>
      <span className="plus-gesture-icon"><Icon name={GESTURE_ICONS[gesture.id]} /></span>
      <span className="plus-gesture-text">
        <strong>{gesture.title}</strong>
        <span>{gesture.text}</span>
      </span>
    </>
  );
}

/** « Arrosages » sur son formulaire, la saison de la page gardée. */
function wateringHref(id: Exclude<PlusGesture['id'], 'noter-la-pluie'>, season: number | null): string {
  const params = new URLSearchParams();
  if (season !== null) params.set('season', String(season));
  params.set(WATERING_INTENT, WATERING_INTENT_VALUES[id]);
  return `${pagePath('arrosages')}?${params.toString()}`;
}
