'use client';

import { useEffect, useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { DEMO_BANNER_TEXT } from '@/lib/domain/demo/deployment-mode';
import { DEMO_MOMENT_COOKIE, DEMO_PROFILE_COOKIE, DEMO_PROFILES, demoSummary, resolveDemoChoice, type DemoSelection } from '@/lib/domain/demo/catalogue';
import { Icon } from '../line-icon';
import { DEMO_DETAIL_ATTRIBUTE, listenToDemoDetailRequests } from './demo-banner-detail';
import { DemoReset } from './demo-reset';
import { GuidedTour, type TourSurroundings } from './guided-tour';

/** Un an : le choix tient d'une visite à l'autre ; il ne porte rien de sensible. */
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * L'entrée du module, qui conduit à la page d'arrivée de la ferme choisie.
 * Un chargement complet, pas une navigation du routeur : le témoin change
 * l'espace et le jour simulé de toute la requête.
 */
const MODULE_ENTRY = '/irrigation';

function choose(profile: string, moment: string | undefined) {
  const { profile: chosen, moment: chosenMoment } = resolveDemoChoice(profile, moment);
  const options = `; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  document.cookie = `${DEMO_PROFILE_COOKIE}=${chosen.id}${options}`;
  document.cookie = `${DEMO_MOMENT_COOKIE}=${chosenMoment.id}${options}`;
  window.location.assign(new URL(MODULE_ENTRY, window.location.origin));
}

/**
 * La bannière permanente de la démonstration (docs/demo-guided-contract.md,
 * sections 4 et 9) : au-dessus de la barre du haut, sur toutes les pages, sans
 * bouton pour la fermer. Quand l'invité est connu, elle porte le choix de la
 * ferme fictive et du moment de la saison ; changer l'un ou l'autre ouvre
 * l'espace correspondant, sans rien effacer ; « Remettre à zéro » rend à
 * la ferme et au moment ouverts leur premier jour, après confirmation (D4).
 * Dans les pages du module, elle porte aussi les visites guidées (D3).
 *
 * Au téléphone (docs/audit-ergonomie-final-lot-f-contract.md, section 3 ;
 * J1), une ligne de 44 px dit la ferme et le moment, et « Changer » ouvre le
 * reste dessous. Le détail est fermé à chaque page : toute navigation du
 * module est un chargement complet. Au-dessus de 600 px, rien ne change.
 */
export function DemoBanner({ selection = null, tour = null }: {
  selection?: DemoSelection | null;
  /** La page ouverte et le menu de la ferme, pour les visites guidées ; absents, pas de visite (page introuvable). */
  tour?: TourSurroundings | null;
}) {
  const current = selection ? resolveDemoChoice(selection.profile, selection.moment) : null;
  const [open, setOpen] = useState(false);
  const detailId = useId();
  // Une visite qui présente un élément du détail l'ouvre, rendu avant qu'elle ne le cherche.
  useEffect(() => listenToDemoDetailRequests(() => flushSync(() => setOpen(true))), []);

  if (!current) {
    return (
      <aside className="demo-banner" aria-label="Démonstration" data-demo-banner="true" data-tour="banniere">
        <span className="demo-banner-icon"><Icon name="bouclier" /></span>
        <p>{DEMO_BANNER_TEXT}</p>
      </aside>
    );
  }
  const severalMoments = current.profile.moments.length > 1;
  return (
    <aside className="demo-banner" aria-label="Démonstration" data-demo-banner="true" data-tour="banniere" data-open={open}>
      <span className="demo-banner-icon"><Icon name="bouclier" /></span>
      <p className="demo-banner-text">{DEMO_BANNER_TEXT}</p>
      <p className="demo-banner-line">{demoSummary(current)}</p>
      <button
        type="button"
        className="demo-banner-toggle"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Fermer' : 'Changer'}
      </button>
      <div id={detailId} className="demo-banner-detail" {...{ [DEMO_DETAIL_ATTRIBUTE]: open ? 'ouvert' : 'ferme' }}>
        <div className="demo-banner-choices" data-tour="banniere-choix">
          <label>
            <span>Ferme</span>
            <select value={current.profile.id} onChange={(event) => choose(event.currentTarget.value, undefined)}>
              {DEMO_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
            </select>
          </label>
          {severalMoments ? (
            <label>
              <span>Moment</span>
              <select value={current.moment.id} onChange={(event) => choose(current.profile.id, event.currentTarget.value)}>
                {current.profile.moments.map((moment) => <option key={moment.id} value={moment.id}>{moment.label}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        <DemoReset farm={current.profile.label} moment={severalMoments ? current.moment.label : null} />
        {tour ? <GuidedTour current={tour.current} reachable={tour.reachable} query={tour.query} /> : null}
      </div>
    </aside>
  );
}
