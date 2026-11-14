import type { OutlinePosition } from '../domain.ts';
import { boundsCenter, type GeoBounds } from './framing.ts';

/**
 * Les fonds de la vue satellite (S3, docs/satellite-view-contract.md, F206
 * c et d, F210, F212) : un fond est un nom, une adresse de tuiles, une
 * attribution, un zoom maximal et une zone couverte. S3 livre les
 * orthophotos de l'IGN, gratuites et sans clé, et le fond « Dessin », uni ;
 * un fond mondial se branchera plus tard, avec la clé de la ferme concernée,
 * jamais dans le dépôt.
 */

/** Une zone couverte : un anneau de points `[lon, lat]`, le premier répété à la fin. */
type BasemapArea = {
  name: string;
  ring: OutlinePosition[];
};

export type Basemap = {
  id: string;
  /** Le nom de la bascule. */
  name: string;
  /** `raster` : des tuiles d'images ; `plain` : un fond uni, sans aucune requête. */
  kind: 'raster' | 'plain';
  /** Le modèle d'adresse des tuiles, `{z}`, `{x}`, `{y}` ; jamais de clé (F212). `null` pour un fond uni. */
  tiles: string | null;
  tileSizePx: number | null;
  /** Le crédit toujours visible sur la carte (F210) ; `null` pour un fond uni, qui ne doit rien à personne. */
  attribution: { text: string; href: string } | null;
  /** Le plus grand zoom servi ; au-delà, la carte agrandit la dernière tuile. `null` : sans limite. */
  maxZoom: number | null;
  /** Où le fond a des images ; `null` : partout. */
  coverage: BasemapArea[] | null;
};

function box(name: string, west: number, south: number, east: number, north: number): BasemapArea {
  return {
    name,
    ring: [[west, south], [east, south], [east, north], [west, north], [west, south]],
  };
}

/**
 * La France métropolitaine, à grands traits : un polygone qui suit la
 * frontière et les côtes à quelques kilomètres au large, îles du littoral
 * comprises. Une ferme frontalière peut s'y trouver : le fond IGN est alors
 * essayé, et s'il n'a pas d'image, la carte passe au « Dessin » (F206 c).
 */
const METROPOLITAN_FRANCE: BasemapArea = {
  name: 'France métropolitaine',
  ring: [
    [2.45, 51.15], [2.7, 51.05], [2.95, 50.85], [3.35, 50.8], [3.75, 50.55],
    [4.25, 50.4], [4.95, 50.25], [5.05, 49.95], [5.45, 49.75], [5.85, 49.6],
    [6.4, 49.55], [7.1, 49.2], [8.05, 49.1], [8.3, 48.95], [7.95, 48.55],
    [7.7, 48.05], [7.7, 47.6], [7.1, 47.48], [6.95, 47.25], [6.6, 46.95],
    [6.2, 46.55], [6.45, 46.45], [6.85, 46.42], [6.95, 46.15], [7.05, 45.9],
    [7.1, 45.3], [6.95, 44.85], [7.05, 44.4], [7.75, 44.15], [7.62, 43.72],
    [7.4, 43.45], [6.6, 43.05], [5.9, 42.95], [4.4, 43.25], [3.55, 43.15],
    [3.3, 42.75], [3.35, 42.4], [2.95, 42.36], [2.4, 42.33], [1.9, 42.38],
    [1.4, 42.42], [0.9, 42.62], [0.65, 42.72], [0, 42.62], [-0.6, 42.72],
    [-1, 42.92], [-1.4, 42.98], [-1.85, 43.25], [-1.95, 43.45], [-1.7, 44],
    [-1.5, 44.7], [-1.45, 45.4], [-1.65, 45.95], [-1.85, 46.3], [-2.55, 46.6],
    [-2.55, 47.1], [-3.4, 47.2], [-3.65, 47.6], [-4.45, 47.7], [-4.95, 47.95],
    [-5.3, 48.4], [-5.1, 48.65], [-4.2, 48.85], [-3.2, 48.95], [-2.4, 48.8],
    [-1.95, 48.95], [-2.05, 49.75], [-1.3, 49.8], [-1.1, 49.45], [-0.3, 49.4],
    [0, 49.6], [0.35, 49.85], [1.05, 50.05], [1.45, 50.25], [1.45, 50.75],
    [1.5, 50.97], [1.85, 51.05], [2.45, 51.15],
  ],
};

/**
 * Les emprises de la France où le fond IGN s'essaie (F206 d) : la métropole
 * et l'outre-mer où la couche a des images à l'échelle d'une ferme, chacun
 * dans un rectangle autour de ses terres. Constaté à la condition B (contrat,
 * section 12) : la Polynésie française n'a rien au-delà du zoom 11, elle
 * n'est donc pas ici et reçoit l'avis « non configuré ». Une zone sans image
 * passe d'elle-même au « Dessin » (F206 c).
 */
export const FRANCE_AREAS: BasemapArea[] = [
  METROPOLITAN_FRANCE,
  box('Corse', 8.45, 41.33, 9.65, 43.1),
  box('Guadeloupe', -61.85, 15.82, -60.95, 16.55),
  box('Martinique', -61.25, 14.38, -60.8, 14.9),
  box('Guyane', -54.65, 2.1, -51.6, 5.85),
  box('La Réunion', 55.2, -21.4, 55.85, -20.85),
  box('Mayotte', 44.95, -13.05, 45.35, -12.6),
  box('Saint-Pierre-et-Miquelon', -56.45, 46.74, -56.1, 47.15),
  box('Saint-Martin et Saint-Barthélemy', -63.2, 17.85, -62.75, 18.15),
  box('Wallis-et-Futuna', -178.25, -14.4, -176.1, -13.15),
  box('Nouvelle-Calédonie', 163.5, -22.8, 168.2, -19.5),
];

/** Un point est-il dans l'une des zones ? Lancer de rayon vers l'est, règle du demi-segment. */
function isInAreas([longitude, latitude]: OutlinePosition, areas: BasemapArea[]): boolean {
  return areas.some(({ ring }) => {
    let inside = false;
    for (let index = 0; index + 1 < ring.length; index += 1) {
      const [x1, y1] = ring[index];
      const [x2, y2] = ring[index + 1];
      const crosses = (y1 <= latitude && latitude < y2) || (y2 <= latitude && latitude < y1);
      if (crosses && longitude < x1 + ((latitude - y1) / (y2 - y1)) * (x2 - x1)) inside = !inside;
    }
    return inside;
  });
}

/** La décision « en France » de F206 d. */
export function isInFrance(position: OutlinePosition): boolean {
  return isInAreas(position, FRANCE_AREAS);
}

/**
 * Les orthophotos de l'IGN par la Géoplateforme, service WMTS public, jeu de
 * tuiles `PM_0_19` que la couche déclare (Mercator sphérique, 256 px, zooms 0
 * à 19). Gratuit, sans clé, tuiles non soumises à limite d'usage (conditions
 * de cartes.gouv.fr, lues le 14 novembre 2026). Couche, format, jeu et zoom
 * maximal constatés sur de vraies tuiles (condition B, contrat section 12) ;
 * crédit lu dans la licence (condition C), lien vers la page de la donnée,
 * qui porte sa date de mise à jour. Les tuiles sont demandées par le
 * navigateur directement à l'IGN, à la demande de l'écran seulement : ni
 * relais, ni cache, ni précharge.
 */
export const IGN_ORTHOPHOTOS: Basemap = {
  id: 'ign-orthophotos',
  name: 'Satellite',
  kind: 'raster',
  tiles:
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
    '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg' +
    '&TILEMATRIXSET=PM_0_19&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  tileSizePx: 256,
  attribution: {
    text: '© IGN – Géoplateforme',
    href: 'https://cartes.gouv.fr/rechercher-une-donnee/dataset/IGNF_BD-ORTHO',
  },
  maxZoom: 19,
  coverage: FRANCE_AREAS,
};

/** Le fond « Dessin » : uni et clair, sans aucune requête ; repli de tous les cas (F206 c et d). */
export const DRAWING_BASEMAP: Basemap = {
  id: 'drawing',
  name: 'Dessin',
  kind: 'plain',
  tiles: null,
  tileSizePx: null,
  attribution: null,
  maxZoom: null,
  coverage: null,
};

/** Les fonds d'images essayés dans l'ordre ; S3 n'en livre qu'un (F206 d). */
const SATELLITE_BASEMAPS: Basemap[] = [IGN_ORTHOPHOTOS];

export type BasemapPreference = 'satellite' | 'drawing';

/**
 * Le choix de la bascule mémorisé par l'appareil (`localStorage`) : toute
 * valeur autre que « dessin », absente ou illisible comprise, revient au
 * satellite, le sens même de l'onglet.
 */
export function readBasemapPreference(stored: unknown): BasemapPreference {
  return stored === 'drawing' ? 'drawing' : 'satellite';
}

export type BasemapChoice = {
  basemap: Basemap;
  /** `satellite-not-configured` : satellite demandé, aucun fond n'a d'images ici (F206 d). */
  notice: 'satellite-not-configured' | null;
};

/**
 * Le fond à montrer. Le « Dessin » quand on le demande, et quand rien n'est
 * dessiné (aucune carte ne se montre alors, F206 a) ; sinon le premier fond
 * d'images dont la zone couverte contient le centre du cadrage ; hors de
 * toute zone, le « Dessin » et l'avis « non configuré ». La panne d'un fond
 * choisi (réseau, blocage, tuile vide) se constate à l'écran, F206 c.
 */
export function chooseBasemap(
  preference: BasemapPreference,
  framing: GeoBounds | null,
  satellites: Basemap[] = SATELLITE_BASEMAPS,
): BasemapChoice {
  if (preference === 'drawing' || framing === null) {
    return { basemap: DRAWING_BASEMAP, notice: null };
  }
  const center = boundsCenter(framing);
  const basemap = satellites.find(
    ({ coverage }) => coverage === null || isInAreas(center, coverage),
  );
  return basemap === undefined
    ? { basemap: DRAWING_BASEMAP, notice: 'satellite-not-configured' }
    : { basemap, notice: null };
}
