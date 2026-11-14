'use client';
import { useSyncExternalStore } from 'react';
import { readBasemapPreference, type BasemapPreference } from '@/lib/domain/satellite-view/basemaps';

/**
 * Ce que l'onglet « Vue satellite » lit du navigateur, et que le serveur ne
 * connaît pas : le choix de fond mémorisé par l'appareil (F205, F209) et la
 * présence de WebGL (F206 e). Lus par `useSyncExternalStore`, pour que le
 * premier rendu soit celui du serveur et que le navigateur prenne la suite.
 */

const BASEMAP_PREFERENCE_KEY = 'irrigation.vue-satellite.fond';
const listeners = new Set<() => void>();
/** Quand le stockage est refusé (navigation privée, réglage), le choix vaut pour la visite seulement. */
let memoryPreference: BasemapPreference | null = null;

function readPreference(): BasemapPreference {
  if (memoryPreference !== null) return memoryPreference;
  try {
    return readBasemapPreference(window.localStorage.getItem(BASEMAP_PREFERENCE_KEY));
  } catch {
    return 'satellite';
  }
}

function subscribePreference(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function storeBasemapPreference(preference: BasemapPreference): void {
  try {
    window.localStorage.setItem(BASEMAP_PREFERENCE_KEY, preference);
    memoryPreference = null;
  } catch {
    memoryPreference = preference;
  }
  for (const listener of listeners) listener();
}

/** Le satellite par défaut, au serveur comme sans stockage : le sens même de l'onglet. */
export function useBasemapPreference(): BasemapPreference {
  return useSyncExternalStore(subscribePreference, readPreference, () => 'satellite');
}

let webGlSupport: boolean | null = null;

function readWebGlSupport(): boolean {
  if (webGlSupport === null) {
    try {
      const canvas = document.createElement('canvas');
      webGlSupport = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    } catch {
      webGlSupport = false;
    }
  }
  return webGlSupport;
}

const subscribeNothing = () => () => {};

/** `null` au serveur, avant que le navigateur ne réponde. */
export function useWebGlSupport(): boolean | null {
  return useSyncExternalStore(subscribeNothing, readWebGlSupport, () => null);
}
