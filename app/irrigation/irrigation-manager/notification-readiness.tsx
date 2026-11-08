'use client';
import { useFoldedSystemAlerts } from './system-alerts-memory';
import type { NotificationStatus } from './use-irrigation-notifications';

/**
 * L'état des alertes de cet appareil. Sur la page des arrosages, le bandeau
 * « Alertes système non disponibles » se replie au téléphone après un premier
 * affichage, en un point sur la cloche (audit ergonomique, point 2, F10) ;
 * Réglages le garde toujours en entier.
 */
export function NotificationReadiness({
  status,
  pending,
  onEnable,
  onDisable,
  foldable = false,
}: {
  status: NotificationStatus;
  pending: boolean;
  onEnable: () => void;
  onDisable: () => void;
  /** Vrai sur la page des arrosages : le bandeau d'un état limité déjà vu s'y replie au téléphone. */
  foldable?: boolean;
}) {
  const folded = useFoldedSystemAlerts(status, foldable);
  if (status === 'checking') {
    return (
      <div className="irrigation-notification-readiness" id="irrigation-notifications" data-status="checking">
        <strong>Préparation des alertes système…</strong>
      </div>
    );
  }
  if (status === 'enabled') {
    return (
      <div className="irrigation-notification-readiness" id="irrigation-notifications" data-status="granted">
        <div>
          <strong>Alertes activées sur cet appareil</strong>
          <span>
            Fin du minuteur et alertes météo : une notification serveur peut arriver même si la page est fermée ou le téléphone verrouillé.
          </span>
        </div>
        <button type="button" disabled={pending} onClick={onDisable}>Désactiver</button>
      </div>
    );
  }
  if (status === 'default') {
    return (
      <div className="irrigation-notification-readiness" id="irrigation-notifications" data-status="default">
        <div>
          <strong>Recevoir les alertes sur cet appareil</strong>
          <span>
            Fin du minuteur et alertes météo. Activez-les sur cet appareil. Sur iPhone ou iPad, ouvrez le site depuis son icône ajoutée à l’écran d’accueil.
          </span>
        </div>
        <button type="button" disabled={pending} onClick={onEnable}>Activer</button>
      </div>
    );
  }
  return (
    <div className="irrigation-notification-readiness" id="irrigation-notifications" data-status="limited" data-folded={folded}>
      <strong>Alertes système non disponibles</strong>
      <span>
        {status === 'denied'
          ? 'Elles sont bloquées dans les réglages du navigateur. Le minuteur reste enregistré et l’alerte visuelle s’affichera au retour.'
          : status === 'unavailable'
            ? 'Le service de notification n’a pas pu démarrer. Le minuteur reste enregistré et la page demeure utilisable.'
            : 'Ce navigateur ne prend pas en charge les alertes persistantes. Le minuteur reste enregistré.'}
      </span>
    </div>
  );
}
