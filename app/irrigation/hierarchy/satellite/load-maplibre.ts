'use client';

type MapLibreModule = typeof import('maplibre-gl');

let loading: Promise<MapLibreModule> | null = null;

/**
 * MapLibre, sa feuille de style et son travailleur, chargés à l'ouverture de
 * l'onglet seulement, jamais au serveur (F204, F208). Le travailleur est servi
 * par le module avec le reste de l'application : MapLibre le chercherait
 * sinon à côté de son propre fichier, qu'assemble le bundler.
 */
export function loadMapLibre(): Promise<MapLibreModule> {
  loading ??= Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
    import('maplibre-gl/dist/maplibre-gl.css'),
  ]).then(([maplibre, worker]) => {
    maplibre.setWorkerUrl(worker.default);
    return maplibre;
  });
  // Un échec (réseau coupé au chargement) laisse réessayer à la prochaine ouverture.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
