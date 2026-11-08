'use client';

/**
 * Le dessin d'une espèce d'Ouvre ta ferme, devant le nom d'une culture
 * (précision P41). Décoratif : le nom voisin porte le sens. Sans dessin, rien.
 */
export function PlantVignette({ spriteHref, symbol }: { spriteHref: string | null; symbol: string | null }) {
  if (spriteHref === null || symbol === null) return null;
  return (
    <svg className="plant-vignette" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <use href={`${spriteHref}#${symbol}`} />
    </svg>
  );
}
