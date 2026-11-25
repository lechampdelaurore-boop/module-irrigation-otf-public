import type { ReactNode } from 'react';
import { cacheForRequest } from 'vinext/cache';

/**
 * Une page du module calculée une fois par requête (lenteur du module, N1,
 * D-322). Pour une page demandée par le routeur, vinext 1.0.1 appelle la page
 * une première fois pour y chercher une redirection, puis la rend : sans
 * cette mémoire, chaque lecture de la page se faisait deux fois. Hors d'une
 * requête (tests), la page est appelée à chaque fois.
 */
export function renderOncePerRequest<Props>(page: (props: Props) => Promise<ReactNode>): (props: Props) => Promise<ReactNode> {
  const slot = cacheForRequest(() => ({ rendered: null as Promise<ReactNode> | null }));
  return (props: Props) => {
    const current = slot();
    current.rendered ??= page(props);
    return current.rendered;
  };
}
