/** L'adresse d'un fichier que le bundler sert tel quel (`?url`), ici le travailleur de MapLibre. */
declare module '*?url' {
  const url: string;
  export default url;
}

/** La feuille de style de MapLibre, chargée avec la bibliothèque. */
declare module 'maplibre-gl/dist/maplibre-gl.css';
