'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { FeatureId } from '@/lib/domain/features/catalogue';
import { checkFeature, uncheckFeature, type FeatureSelection } from '@/lib/domain/features/selection';
import {
  CHOOSE_MYSELF_LABEL,
  START_WAYS,
  WELCOME_EYEBROW,
  WELCOME_HEADING,
  WELCOME_INTRO,
  startWaySelection,
} from '@/lib/domain/features/start';
import type { StartWay } from '@/lib/domain/features/start-mode';
import { whatFollowsText } from '@/lib/domain/onboarding/route';
import { saveFeatureSelectionAction } from '../feature-selection-actions';
import { FeatureChoiceList } from '../shell/feature-choice-list';
import type { DemoSelection } from '@/lib/domain/demo/catalogue';
import { Icon, type IconName } from '../line-icon';
import { Topbar } from '../shell/topbar';

/** La ferme vierge de la démonstration n'a pas encore de menu : ses visites se jouent sur cette page (D3). */
const WELCOME_TOUR = { current: 'bienvenue', reachable: [], query: {} } as const;

/** L'icône de chaque façon : le minuteur, la proposition du matin, tout ce qui pousse. */
const WAY_ICONS: Record<StartWay, IconName> = { notes: 'horloge', proposals: 'calendrier', all: 'pousse' };

/**
 * La première ouverture (simplification, lot S6,
 * docs/simplification-s6-contract.md, section 3 ; D-336) : trois façons de
 * commencer, rien choisi d'avance (S6-a), « Continuer » attend un choix ;
 * « Choisir moi-même les fonctionnalités » montre, sur la même page, la liste
 * des cases de la 3.8 (R5, P7 : au moins une case pour continuer). Rien n'est
 * écrit avant « Continuer » (D-028) ; le serveur calcule les cases d'une
 * façon, jamais le navigateur.
 */
export function WelcomeChoice({ userName, signOutPath, demo, demoSelection }: {
  userName: string;
  signOutPath: string;
  demo: boolean;
  demoSelection: DemoSelection | null;
}) {
  const shell = useRef<HTMLElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const waysGroup = useRef<HTMLDivElement>(null);
  const [way, setWay] = useState<StartWay | null>(null);
  const [custom, setCustom] = useState(false);
  const [selection, setSelection] = useState<FeatureSelection>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const switched = useRef(false);

  useEffect(() => {
    // La page répond aux clics (docs/browser-journeys-contract.md).
    shell.current?.setAttribute('data-interactive', 'true');
  }, []);

  useEffect(() => {
    // Passer de la liste aux trois façons, ou l'inverse : le clavier suit, jamais perdu sur la page.
    if (!switched.current) return;
    if (custom) backButton.current?.focus();
    else (waysGroup.current?.querySelector<HTMLInputElement>('input:checked') ?? waysGroup.current?.querySelector<HTMLInputElement>('input'))?.focus();
  }, [custom]);

  const chooseMyself = () => {
    setError(null);
    // Les cases de la façon enfoncée sont déjà cochées : la personne les ajuste.
    setSelection(way ? startWaySelection(way) : []);
    switched.current = true;
    setCustom(true);
  };

  const backToWays = () => {
    setError(null);
    switched.current = true;
    setCustom(false);
  };

  const toggle = (id: FeatureId, checked: boolean) => {
    setError(null);
    if (checked) {
      setSelection(checkFeature(selection, id));
      return;
    }
    const result = uncheckFeature(selection, id);
    // Le brouillon peut redevenir vide : « Continuer » attend alors une case.
    if (result.ok) setSelection(result.selection);
    else if (result.reason === 'last') setSelection([]);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveFeatureSelectionAction(custom ? { startMode: 'custom', enabled: selection } : { startMode: way ?? '' });
      if (!result.ok) {
        // Le choix était déjà fait (un second appui) : la page d'arrivée s'ouvre quand même.
        if (result.firstPage) window.location.assign(result.firstPage);
        else setError(result.message);
        return;
      }
      window.location.assign(result.firstPage);
    });
  };

  const ready = custom ? selection.length > 0 : way !== null;

  return (
    <main ref={shell} className="app-shell welcome-shell">
      {/* Le premier arrêt du clavier saute la barre, comme sur les autres pages (audit final, lot E, A1, F257). */}
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <Topbar userName={userName} signOutPath={signOutPath} demo={demo} demoSelection={demoSelection} tour={demo ? WELCOME_TOUR : null} />
      <section className="welcome-choice" id="contenu" tabIndex={-1} aria-labelledby="welcome-title">
        <p className="eyebrow">{WELCOME_EYEBROW}</p>
        <h1 id="welcome-title">{WELCOME_HEADING}</h1>
        {custom ? (
          <>
            <p className="welcome-back">
              <button ref={backButton} type="button" className="welcome-link" disabled={pending} onClick={backToWays}>‹ Revenir aux trois façons</button>
            </p>
            <h2 className="welcome-custom-title">{CHOOSE_MYSELF_LABEL}</h2>
            <p>
              Cochez ce dont votre ferme a besoin : seules les fonctionnalités cochées s’affichent et tournent. Une fonctionnalité qui
              en demande d’autres les coche avec elle. Vous pourrez changer ce choix à tout moment dans Réglages, sans rien perdre.
            </p>
            <FeatureChoiceList selection={selection} disabled={pending} keepOne={false} onToggle={toggle} />
          </>
        ) : (
          <>
            <p>{WELCOME_INTRO}</p>
            {/* Trois boutons radio natifs : un seul à la fois, les flèches du clavier passent de l'un à l'autre (S6, section 3.2). */}
            <div ref={waysGroup} className="start-ways" role="radiogroup" aria-labelledby="welcome-title" data-tour="fonctionnalites">
              {START_WAYS.map((candidate) => {
                const checked = way === candidate.id;
                return (
                  <label key={candidate.id} className="start-way" data-checked={checked}>
                    <input
                      type="radio"
                      name="start-way"
                      value={candidate.id}
                      checked={checked}
                      disabled={pending}
                      aria-labelledby={`start-way-${candidate.id}-name`}
                      aria-describedby={`${candidate.recommended ? `start-way-${candidate.id}-tag ` : ''}start-way-${candidate.id}-text`}
                      onChange={() => { setError(null); setWay(candidate.id); }}
                    />
                    <span className="start-way-icon"><Icon name={WAY_ICONS[candidate.id]} /></span>
                    <span className="start-way-copy">
                      <strong id={`start-way-${candidate.id}-name`}>{candidate.name}</strong>
                      {candidate.recommended ? <span id={`start-way-${candidate.id}-tag`} className="start-way-tag">Conseillé</span> : null}
                      <small id={`start-way-${candidate.id}-text`}>{candidate.text}</small>
                    </span>
                    {/* La coche dit le choix retenu avec la bordure : la couleur seule ne le dit pas. */}
                    <span className="start-way-check" aria-hidden="true">{checked ? <Icon name="coche" /> : null}</span>
                  </label>
                );
              })}
            </div>
            <p className="start-what-follows">{whatFollowsText(way ? startWaySelection(way) : null)}</p>
          </>
        )}
        <div className="welcome-actions">
          {custom ? (
            <p role="status">
              {selection.length === 0
                ? 'Cochez au moins une fonctionnalité pour continuer.'
                : `${selection.length} fonctionnalité${selection.length > 1 ? 's' : ''} cochée${selection.length > 1 ? 's' : ''}.`}
            </p>
          ) : null}
          <button type="button" className="primary-button welcome-continue" disabled={pending || !ready} onClick={submit}>
            {pending ? 'Enregistrement…' : 'Continuer'}
          </button>
        </div>
        {/* L'erreur du serveur sous le bouton, le choix gardé (section 3.2). */}
        {error ? <p className="water-error" role="alert">{error}</p> : null}
        {custom ? null : (
          <p className="welcome-custom">
            <button type="button" className="welcome-link" disabled={pending} onClick={chooseMyself}>{CHOOSE_MYSELF_LABEL}</button>
          </p>
        )}
      </section>
    </main>
  );
}
