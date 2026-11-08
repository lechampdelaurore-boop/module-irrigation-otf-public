'use client';

import { Icon } from '../line-icon';

/**
 * « Voir le détail » et sa flèche, à droite de la ligne d'une culture ou
 * d'une espèce (retour du porteur du 8 novembre 2026 : on ne devinait pas
 * qu'il fallait toucher une culture pour en voir le détail). Une fois la
 * carte ouverte, « Replier » et la flèche retournée. Décoratif pour un
 * lecteur d'écran, qui annonce déjà la ligne comme repliée ou dépliée.
 */
export function DetailHint() {
  return (
    <span className="detail-hint" aria-hidden="true">
      <span className="detail-hint-closed">Voir le détail</span>
      <span className="detail-hint-open">Replier</span>
      <Icon name="fleche-bas" />
    </span>
  );
}
