'use client';

import { useSystemAlertsDot } from '../irrigation-manager/system-alerts-memory';
import { Icon } from '../line-icon';

/**
 * La barre du haut, commune à toutes les pages du module (deuxième passe de
 * la refonte, D-068, docs/charte-module.md, points 5 et 6) : à l'ordinateur,
 * une barre blanche avec la pastille verte à goutte, le nom de la session et
 * son initiale ; au téléphone, la barre anthracite de 36 px avec le nom, la
 * cloche des notifications et l'initiale. La cloche prend un point quand le
 * bandeau « Alertes système non disponibles » s'est replié (audit
 * ergonomique, point 2, précision F10).
 */
export function Topbar({
  userName,
  signOutPath,
  notificationsHref = null,
}: {
  userName: string;
  signOutPath: string;
  /** Les réglages des notifications, quand une case cochée en envoie. */
  notificationsHref?: string | null;
}) {
  const alertsLimited = useSystemAlertsDot();
  return (
    <header className="topbar">
      <a className="brand" href="/irrigation" aria-label="Accueil Irrigation">
        <span className="brand-mark" aria-hidden="true">
          <Icon name="goutte" />
        </span>
        <strong>Irrigation</strong>
      </a>
      <div className="account">
        <strong className="account-name">{userName}</strong>
        {notificationsHref ? (
          <a
            className="topbar-bell"
            href={notificationsHref}
            data-alerts-limited={alertsLimited}
            aria-label={alertsLimited ? 'Notifications du téléphone : alertes système non disponibles sur cet appareil' : 'Notifications du téléphone'}
            title="Notifications du téléphone"
          >
            <Icon name="cloche" />
          </a>
        ) : null}
        <a className="avatar" href={signOutPath} aria-label={`Déconnecter ${userName}`} title="Se déconnecter">
          {userName.slice(0, 1).toLocaleUpperCase('fr-FR')}
        </a>
      </div>
    </header>
  );
}
