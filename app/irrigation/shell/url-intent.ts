'use client';

import { useEffect, useRef } from 'react';

/**
 * Une demande portée par l'adresse d'une page à l'autre (3.8,
 * docs/feature-selection-contract.md, section 5) : « Ajouter un créneau à la
 * main » du planning ouvre le formulaire « Planifier » (`?planifier=1`),
 * « Recalculer le plan » d'un arrosage en retard recalcule le planning
 * (`?recalculer=1`). Lue une fois après l'affichage, puis retirée de
 * l'adresse : un rechargement ne la rejoue pas.
 */
export function useUrlIntent(name: string, run: (value: string) => void): void {
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    const value = url.searchParams.get(name);
    if (value === null || value === '') return;
    url.searchParams.delete(name);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    latest.current(value);
  }, [name]);
}

/** L'adresse d'une page avec sa demande, en gardant la saison de la page courante. */
export function hrefWithIntent(path: string, season: number, name: string, value: string): string {
  const params = new URLSearchParams({ season: String(season), [name]: value });
  return `${path}?${params.toString()}`;
}
