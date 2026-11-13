'use client';

import { DEMO_BANNER_TEXT } from '@/lib/domain/demo/deployment-mode';
import { DEMO_MOMENT_COOKIE, DEMO_PROFILE_COOKIE, DEMO_PROFILES, resolveDemoChoice, type DemoSelection } from '@/lib/domain/demo/catalogue';
import { Icon } from '../line-icon';

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
 * l'espace correspondant, sans rien effacer. Le bouton « Remettre la
 * démonstration à zéro » s'y ajoutera avec la remise à zéro (D4).
 */
export function DemoBanner({ selection = null }: { selection?: DemoSelection | null }) {
  const current = selection ? resolveDemoChoice(selection.profile, selection.moment) : null;
  return (
    <aside className="demo-banner" aria-label="Démonstration" data-demo-banner="true">
      <span className="demo-banner-icon"><Icon name="bouclier" /></span>
      <p>{DEMO_BANNER_TEXT}</p>
      {current ? (
        <div className="demo-banner-choices">
          <label>
            <span>Ferme</span>
            <select value={current.profile.id} onChange={(event) => choose(event.currentTarget.value, undefined)}>
              {DEMO_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
            </select>
          </label>
          {current.profile.moments.length > 1 ? (
            <label>
              <span>Moment</span>
              <select value={current.moment.id} onChange={(event) => choose(current.profile.id, event.currentTarget.value)}>
                {current.profile.moments.map((moment) => <option key={moment.id} value={moment.id}>{moment.label}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
