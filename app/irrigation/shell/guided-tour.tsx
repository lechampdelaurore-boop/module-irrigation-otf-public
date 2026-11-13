'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  availableTours,
  nextAvailableTour,
  parsePosition,
  parseSeenTours,
  playableStep,
  serializePosition,
  stepCount,
  withSeenTour,
  TOUR_INVITATION_STORAGE_KEY,
  TOUR_STORAGE_KEY,
  TOUR_URL_PARAMETER,
  TOURS_SEEN_STORAGE_KEY,
  type TourContext,
  type TourPosition,
} from '@/lib/domain/demo/tour-engine';
import { tourById, type Tour, type TourId, type TourPage, type TourStep } from '@/lib/domain/demo/tours';
import { WELCOME_PATH, pageHref, pageLabel, type PageQuery } from '@/lib/domain/features/pages';
import { Icon } from '../line-icon';

/** Ce que la bannière sait de la page pour y jouer une visite : la page ouverte, le menu de la ferme, la saison et la parcelle. */
export type TourSurroundings = { current: TourPage; reachable: readonly TourPage[]; query: PageQuery };

/** Au-delà, la bulle se pose près de l'élément ; en deçà, en feuille basse au-dessus de la barre des pages (charte, section 7). */
const WIDE_SCREEN = '(min-width: 981px)';
const MARGIN_PX = 16;
const GAP_PX = 12;
/** Un élément peut arriver après l'affichage (données lues ensuite) : on l'attend au plus deux secondes, puis l'étape est sautée. */
const ANCHOR_WAIT_STEPS = 20;
const ANCHOR_WAIT_MS = 100;

type Shown =
  | { kind: 'step'; position: TourPosition; anchor: HTMLElement | null; last: boolean; hasPrevious: boolean }
  | { kind: 'paused'; position: TourPosition; page: TourPage }
  | { kind: 'invitation' };

/*
 * Le navigateur peut refuser le stockage (navigation privée, réglage) : la
 * visite marche alors quand même, d'une page à l'autre par l'adresse, mais
 * ne reprend pas après la fermeture de l'onglet (contrat, section 7).
 */
function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function storageWorks(): boolean {
  const probe = `${TOUR_STORAGE_KEY}-essai`;
  return writeStored(probe, '1') && writeStored(probe, null);
}

/** Le premier élément visible qui porte ce repère : le menu existe en double, à gauche et en barre du bas. */
function visibleAnchor(name: string): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    if (element.getClientRects().length > 0) return element;
  }
  return null;
}

/**
 * L'élément d'une étape. À l'arrivée sur une page (`patient`), on lui laisse
 * le temps de paraître ; sur un clic dans une page déjà là, il y est ou non.
 */
async function waitForAnchor(name: string, patient: boolean): Promise<HTMLElement | null> {
  for (let attempt = 0; attempt < (patient ? ANCHOR_WAIT_STEPS : 1); attempt += 1) {
    const element = visibleAnchor(name);
    if (element) return element;
    await new Promise((resolve) => setTimeout(resolve, ANCHOR_WAIT_MS));
  }
  return null;
}

/** Une étape sans élément se montre toujours ; avec, seulement si l'élément est à l'écran. */
function anchorShown(step: TourStep): boolean {
  return !step.anchor || visibleAnchor(step.anchor) !== null;
}

/**
 * Reste-t-il une étape à montrer dans ce sens ? Une étape sur une autre page
 * compte ; sur cette page, seulement si son élément est là. Le bouton dit
 * « Terminer » à la dernière, et « Précédent » n'apparaît pas à la première.
 */
function hasStepTowards(tour: Tour, from: number, direction: 1 | -1, context: TourContext): boolean {
  for (let index = from; ;) {
    const playable = playableStep(tour, index, direction, context);
    if (!playable) return false;
    const anchor = tour.steps[playable.index].anchor;
    if (playable.page !== context.current || !anchor || visibleAnchor(anchor)) return true;
    index = playable.index + direction;
  }
}

function tourHref(page: TourPage, query: PageQuery, position: TourPosition): string {
  const url = new URL(page === 'bienvenue' ? WELCOME_PATH : pageHref(page, query), window.location.origin);
  url.searchParams.set(TOUR_URL_PARAMETER, serializePosition(position));
  return url.toString();
}

function pageName(page: TourPage): string {
  return page === 'bienvenue' ? 'Choisissez vos fonctionnalités' : pageLabel(page);
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/**
 * Les visites guidées de la démonstration (docs/demo-guided-contract.md,
 * sections 7 et 9 ; D3) : le bouton « Visites guidées » de la bannière, la
 * liste des visites, et la bulle de l'étape en cours. La bulle se pose près
 * de l'élément qu'elle présente, repéré par `data-tour` ; au téléphone, en
 * feuille basse au-dessus de la barre des pages. Elle ne fait jamais rien à
 * la place du visiteur : elle montre, et ne passe à une autre page que sur
 * son clic. L'étape en cours est rangée dans le navigateur (rien de
 * sensible) ; une étape dont l'élément manque est sautée sans message.
 *
 * Accessibilité (section 9, audit point 14) : le focus va au titre de la
 * bulle à chaque étape et revient au bouton de départ à la fin ; Échap
 * quitte ; l'étape est annoncée par une région `aria-live` ; le défilement
 * respecte `prefers-reduced-motion`.
 */
export function GuidedTour({ current, reachable, query }: TourSurroundings) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [seen, setSeen] = useState<TourId[]>([]);
  const [place, setPlace] = useState<CSSProperties | undefined>(undefined);
  const listId = useId();
  const titleId = useId();
  const textId = useId();
  const listButton = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const request = useRef(0);

  const context: TourContext = { current, reachable: [...reachable, current] };
  // `goTo` attend un élément pendant que la page vit : il lit la page et la saison du moment, pas celles de son premier appel.
  const contextRef = useRef(context);
  const queryRef = useRef(query);
  useLayoutEffect(() => {
    contextRef.current = context;
    queryRef.current = query;
  });

  const restoreFocus = useCallback(() => {
    const target = returnFocus.current?.isConnected ? returnFocus.current : listButton.current;
    returnFocus.current = null;
    target?.focus();
  }, []);

  const finish = useCallback((tour: TourId | null, completed: boolean) => {
    request.current += 1;
    writeStored(TOUR_STORAGE_KEY, null);
    if (tour && completed) {
      setSeen((previous) => {
        const next = withSeenTour(previous, tour);
        writeStored(TOURS_SEEN_STORAGE_KEY, next.join(','));
        return next;
      });
    }
    setShown(null);
    restoreFocus();
  }, [restoreFocus]);

  /**
   * Va à l'étape jouable la plus proche de `position`, dans le sens donné.
   * Sur une autre page, on n'y va que si le visiteur vient de cliquer
   * (`viaClick`) ; sinon la bulle propose de reprendre. `patient` : la page
   * vient de s'ouvrir, ses éléments peuvent arriver après elle.
   */
  const goTo = useCallback(async (position: TourPosition, direction: 1 | -1, viaClick: boolean, patient = false) => {
    const tour = tourById(position.tour);
    if (!tour) return;
    const ticket = ++request.current;
    let from = position.step;
    for (;;) {
      const playable = playableStep(tour, from, direction, contextRef.current);
      if (!playable) {
        if (direction === 1) finish(tour.id, true);
        return;
      }
      const next = { tour: tour.id, step: playable.index };
      writeStored(TOUR_STORAGE_KEY, serializePosition(next));
      if (playable.page !== contextRef.current.current) {
        if (viaClick) window.location.assign(tourHref(playable.page, queryRef.current, next));
        else setShown({ kind: 'paused', position: next, page: playable.page });
        return;
      }
      const step = tour.steps[playable.index];
      const anchor = step.anchor ? await waitForAnchor(step.anchor, patient) : null;
      if (ticket !== request.current) return;
      if (step.anchor && !anchor) {
        from = playable.index + direction;
        continue;
      }
      setShown({
        kind: 'step',
        position: next,
        anchor,
        last: !hasStepTowards(tour, playable.index + 1, 1, contextRef.current),
        hasPrevious: hasStepTowards(tour, playable.index - 1, -1, contextRef.current),
      });
      return;
    }
  }, [finish]);

  // À l'ouverture de la page, une fois la page peinte : l'étape portée par l'adresse (un clic sur la page
  // d'avant), sinon celle rangée dans le navigateur, sinon l'invitation.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSeen(parseSeenTours(readStored(TOURS_SEEN_STORAGE_KEY)));
      const url = new URL(window.location.href);
      const fromUrl = parsePosition(url.searchParams.get(TOUR_URL_PARAMETER));
      if (url.searchParams.has(TOUR_URL_PARAMETER)) {
        url.searchParams.delete(TOUR_URL_PARAMETER);
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      }
      if (fromUrl) {
        void goTo(fromUrl, 1, true, true);
        return;
      }
      const stored = parsePosition(readStored(TOUR_STORAGE_KEY));
      if (stored) {
        void goTo(stored, 1, false, true);
        return;
      }
      // Sans stockage, l'invitation reviendrait à chaque page : elle ne s'affiche pas.
      if (readStored(TOUR_INVITATION_STORAGE_KEY) === null && storageWorks()) setShown({ kind: 'invitation' });
    });
    return () => cancelAnimationFrame(frame);
  }, [goTo]);

  const start = (tour: TourId) => {
    writeStored(TOUR_INVITATION_STORAGE_KEY, 'vue');
    setListOpen(false);
    returnFocus.current ??= listButton.current;
    void goTo({ tour, step: 0 }, 1, true);
  };

  // L'élément présenté : souligné, amené à l'écran ; le focus passe au titre de la bulle.
  const anchor = shown?.kind === 'step' ? shown.anchor : null;
  useEffect(() => {
    // Une visite en pause ou l'invitation ne prennent pas le focus : le visiteur lit sa page.
    if (shown?.kind !== 'step') return;
    if (anchor) {
      anchor.setAttribute('data-tour-active', 'true');
      const tall = anchor.getBoundingClientRect().height > window.innerHeight * 0.5;
      const wide = window.matchMedia(WIDE_SCREEN).matches;
      anchor.scrollIntoView({ block: wide && !tall ? 'center' : 'start', behavior: scrollBehavior() });
    }
    heading.current?.focus({ preventScroll: true });
    return () => {
      anchor?.removeAttribute('data-tour-active');
    };
  }, [shown, anchor]);

  // À l'ordinateur, la bulle suit son élément quand la page défile, sans jamais sortir de la fenêtre.
  useLayoutEffect(() => {
    if (!anchor) return;
    let frame = 0;
    const reposition = () => {
      // Une fenêtre rétrécie passe à la feuille basse : la feuille de style reprend la main.
      if (!window.matchMedia(WIDE_SCREEN).matches) {
        setPlace(undefined);
        return;
      }
      const box = bubble.current?.getBoundingClientRect();
      if (!box) return;
      const target = anchor.getBoundingClientRect();
      const maxTop = Math.max(MARGIN_PX, window.innerHeight - box.height - MARGIN_PX);
      const maxLeft = Math.max(MARGIN_PX, window.innerWidth - box.width - MARGIN_PX);
      const clamp = (value: number, max: number) => Math.min(Math.max(MARGIN_PX, value), max);
      // Sous l'élément, sinon au-dessus, sinon à côté (le menu est haut et étroit), sinon dans le coin bas.
      let top = maxTop;
      let left = maxLeft;
      if (target.bottom + GAP_PX + box.height <= window.innerHeight - MARGIN_PX) {
        top = target.bottom + GAP_PX;
        left = target.left;
      } else if (target.top - GAP_PX - box.height >= MARGIN_PX) {
        top = target.top - GAP_PX - box.height;
        left = target.left;
      } else if (target.right + GAP_PX + box.width <= window.innerWidth - MARGIN_PX) {
        top = target.top;
        left = target.right + GAP_PX;
      } else if (target.left - GAP_PX - box.width >= MARGIN_PX) {
        top = target.top;
        left = target.left - GAP_PX - box.width;
      }
      setPlace({ position: 'fixed', top: clamp(top, maxTop), left: clamp(left, maxLeft) });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reposition);
    };
    schedule();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [anchor, shown]);

  const quit = useCallback(() => {
    if (shown?.kind === 'invitation') writeStored(TOUR_INVITATION_STORAGE_KEY, 'vue');
    finish(null, false);
  }, [shown, finish]);

  // Échap ferme la liste, ou quitte la visite quand le focus est dans la bulle.
  useEffect(() => {
    if (!shown && !listOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const focus = document.activeElement;
      if (listOpen && (list.current?.contains(focus) || listButton.current === focus)) {
        setListOpen(false);
        listButton.current?.focus();
        return;
      }
      if (shown && bubble.current?.contains(focus)) quit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, listOpen, quit]);

  // La liste se referme par un geste en dehors d'elle ; à l'ouverture, le focus va à sa première visite.
  useEffect(() => {
    if (!listOpen) return;
    list.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (list.current?.contains(target) || listButton.current?.contains(target))) return;
      setListOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [listOpen]);

  const tours = availableTours(context);
  const stored = shown && shown.kind !== 'invitation' ? shown.position : null;

  return (
    <div className="tour-launcher">
      <button
        ref={listButton}
        type="button"
        className="tour-launcher-button"
        data-tour="visites"
        aria-expanded={listOpen}
        aria-controls={listId}
        onClick={() => setListOpen((value) => !value)}
      >
        <Icon name="aide" />
        <span>Visites guidées</span>
      </button>
      {listOpen ? (
        <div ref={list} id={listId} className="tour-list" role="dialog" aria-modal="false" aria-labelledby={`${listId}-title`}>
          <h2 id={`${listId}-title`}>Visites guidées</h2>
          <p>Chacune dure deux à quatre minutes. La visite montre ; c’est vous qui cliquez.</p>
          <ul>
            {tours.map((tour) => (
              <li key={tour.id}>
                <button type="button" onClick={() => start(tour.id)} aria-describedby={`${listId}-${tour.id}`}>
                  <strong>{tour.title}</strong>
                  <small>{tour.minutes} min{seen.includes(tour.id) ? ' · déjà vue' : ''}{stored?.tour === tour.id ? ' · en cours' : ''}</small>
                </button>
                <p id={`${listId}-${tour.id}`}>
                  {tour.summary}
                  {tour.bestWith ? <> <em>{tour.bestWith}</em></> : null}
                </p>
              </li>
            ))}
          </ul>
          <button type="button" className="tour-secondary" onClick={() => { setListOpen(false); listButton.current?.focus(); }}>Fermer</button>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">{announce(shown, context)}</p>
      {shown ? createPortal(
        <TourBubble
          shown={shown}
          context={context}
          place={shown.kind === 'step' && shown.anchor ? place : undefined}
          bubbleRef={bubble}
          headingRef={heading}
          titleId={titleId}
          textId={textId}
          onNext={() => shown.kind === 'step' && void goTo({ ...shown.position, step: shown.position.step + 1 }, 1, true)}
          onPrevious={() => shown.kind === 'step' && void goTo({ ...shown.position, step: shown.position.step - 1 }, -1, true)}
          onSkip={(next) => {
            writeStored(TOUR_STORAGE_KEY, null);
            void goTo({ tour: next, step: 0 }, 1, true);
          }}
          onResume={() => shown.kind === 'paused' && window.location.assign(tourHref(shown.page, query, shown.position))}
          onStartWelcome={() => {
            returnFocus.current = listButton.current;
            start('bienvenue');
          }}
          onQuit={quit}
        />,
        document.body,
      ) : null}
    </div>
  );
}

/** Ce que le lecteur d'écran annonce : la visite et l'étape, ou rien. */
function announce(shown: Shown | null, context: TourContext): string {
  if (!shown) return '';
  if (shown.kind === 'invitation') return 'Une visite guidée de la démonstration est proposée en bas de la page.';
  const tour = tourById(shown.position.tour);
  if (!tour) return '';
  if (shown.kind === 'paused') return `Visite « ${tour.title} » en pause.`;
  const { rank, total } = stepCount(tour, shown.position.step, context, anchorShown);
  return `Visite « ${tour.title} », étape ${rank} sur ${total} : ${tour.steps[shown.position.step].title}.`;
}

function TourBubble({
  shown,
  context,
  place,
  bubbleRef,
  headingRef,
  titleId,
  textId,
  onNext,
  onPrevious,
  onSkip,
  onResume,
  onStartWelcome,
  onQuit,
}: {
  shown: Shown;
  context: TourContext;
  place: CSSProperties | undefined;
  bubbleRef: RefObject<HTMLElement | null>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  titleId: string;
  textId: string;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: (next: TourId) => void;
  onResume: () => void;
  onStartWelcome: () => void;
  onQuit: () => void;
}) {
  const common = {
    ref: bubbleRef,
    className: 'tour-bubble',
    role: 'dialog',
    'aria-modal': false,
    'aria-labelledby': titleId,
    'aria-describedby': textId,
  } as const;

  if (shown.kind === 'invitation') {
    return (
      <section {...common} data-placement="corner">
        <h2 id={titleId} ref={headingRef} tabIndex={-1}>Découvrir la démonstration</h2>
        <p id={textId}>Une visite de deux minutes présente le module, les fermes inventées et les moments de la saison. D’autres visites suivent, une par thème.</p>
        <div className="tour-actions">
          <button type="button" className="tour-primary" onClick={onStartWelcome}>Commencer la visite</button>
          <button type="button" className="tour-secondary" onClick={onQuit}>Plus tard</button>
        </div>
      </section>
    );
  }

  const tour = tourById(shown.position.tour);
  if (!tour) return null;

  if (shown.kind === 'paused') {
    return (
      <section {...common} data-placement="corner">
        <p className="tour-progress">Visite en cours</p>
        <h2 id={titleId} ref={headingRef} tabIndex={-1}>{tour.title}</h2>
        <p id={textId}>La visite continue sur la page « {pageName(shown.page)} ».</p>
        <div className="tour-actions">
          <button type="button" className="tour-primary" onClick={onResume}>Reprendre la visite</button>
          <button type="button" className="tour-secondary" onClick={onQuit}>Quitter la visite</button>
        </div>
      </section>
    );
  }

  const index = shown.position.step;
  const step = tour.steps[index];
  const { rank, total } = stepCount(tour, index, context, anchorShown);
  const { last, hasPrevious } = shown;
  const nextTour = nextAvailableTour(tour.id, context);
  return (
    <section {...common} data-placement={shown.anchor ? 'anchored' : 'centered'} style={place}>
      <p className="tour-progress">{tour.title} · étape {rank} sur {total}</p>
      <h2 id={titleId} ref={headingRef} tabIndex={-1}>{step.title}</h2>
      <p id={textId}>{step.text}</p>
      <div className="tour-actions">
        <button type="button" className="tour-primary" onClick={onNext}>{last ? 'Terminer' : 'Suivant'}</button>
        {hasPrevious ? <button type="button" className="tour-secondary" onClick={onPrevious}>Précédent</button> : null}
        {nextTour ? (
          <button type="button" className="tour-secondary" onClick={() => onSkip(nextTour.id)} aria-label={`Passer : commencer la visite « ${nextTour.title} »`}>
            Passer
          </button>
        ) : null}
        <button type="button" className="tour-quit" onClick={onQuit}>Quitter la visite</button>
      </div>
    </section>
  );
}
