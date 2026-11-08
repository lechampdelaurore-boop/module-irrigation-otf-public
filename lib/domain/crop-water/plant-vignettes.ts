/**
 * Les dessins des espèces d'Ouvre ta ferme, à côté du nom d'une culture
 * (retour du porteur, 7 novembre 2026, précision P41). Ouvre ta ferme les
 * range dans un seul fichier SVG public, un symbole par espèce, nommé par le
 * `fqn` de l'espèce du référentiel (« carotte », « chou-fleur »). Le module ne
 * copie pas ce fichier : sa route `/irrigation/especes.svg` le lit chez Ouvre
 * ta ferme, en garde les symboles demandés, et la page les appelle par
 * `<use>`. Une culture sans dessin s'affiche sans, comme avant.
 */

/** Le fichier des dessins d'Ouvre ta ferme (`plant/static/image/plants.svg`), public, sans clé. */
export const OTF_PLANT_SPRITE_URL = 'https://www.ouvretaferme.org/static/production/plant/image/plants.svg';

/** L'adresse de la route du module qui sert les symboles demandés. */
const PLANT_VIGNETTE_ROUTE = '/irrigation/especes.svg';

/** Au plus, les symboles qu'une adresse demande : il y en a 183 dans le fichier d'Ouvre ta ferme. */
const MAX_REQUESTED_SYMBOLS = 200;

/**
 * Les symboles du fichier d'Ouvre ta ferme, relevés le 7 novembre 2026. Une
 * culture n'appelle qu'un symbole de cette liste : un nom absent du fichier ne
 * laisse pas une case vide à l'écran. Un dessin ajouté plus tard chez Ouvre ta
 * ferme s'ajoute ici.
 */
export const OTF_PLANT_SYMBOLS: ReadonlySet<string> = new Set(`
abricot achillee-millefeuille agastache ail amarante anemone aneth arroche artichaut asperge aubergine avoine basilic
betterave ble blette bleuet boite-oeufs bourrache calendula camomille campanule capucine cardon carotte cassis
celeri-branche celeri-couper celeri-rave celosie cerfeuil cerise champignon-de-paris chanvre chicoree-frisee
chicoree-sauvage chicoree-scarole chou-blanc chou-brocoli chou-de-bruxelles chou-de-milan chou-fleur chou-kale
chou-pak-choi chou-pe-tsai chou-pointu chou-rave chou-romanesco chou-rouge chrysantheme ciboule-de-chine ciboulette
claytone-cuba coing concombre consoude coquelicot coriandre cornichon cosmos courge courge-bleue-de-hongrie
courge-butternut courge-potimarron courge-potiron courge-spaghetti courgette cresson curcuma dahlia delphinium
digitale echalote endive engrais-vert epinard estragon eucalyptus fenouil feve feverole figue fraise framboise
gingembre gombo groseille haricot hibiscus hysope immortelle jus-de-tomate kaki kiwano kiwi laitue lavande lin
liveche lupin luzerne mache mais marguerite marjolaine melisse melon menthe mesclun millet mirabelle mizuna monarde
moutarde muflier mure myrtille narcisse navet nigelle noix oca-du-perou oignon orge origan oseille panais pasteque
patate-douce patisson peche perilla persil phacelie physalis piment pivoine pleurote poire poire-de-terre poireau
pois pois-de-senteur poivron pomme pomme-de-terre prune radis-botte radis-rave raifort reine-marguerite renoncule
rhubarbe romarin roquette-cultivee rudbeckia rutabaga safran sarrasin sarriette sauge scabieuse seigle shiitake soja
sorgho statice sureau thym tomate tomate-ananas tomate-cerise tomate-coeur-boeuf tomate-noire-crimee tomate-rose-berne
tomate-zebree topinambour tournesol tulipe verveine-officinale vesce vigne zinnia
`.trim().split(/\s+/));

/**
 * Le dessin de chaque culture de référence du jeu commun : son nom ne suffit
 * pas toujours (« Salade d'été », « Crucifères »), d'où une table.
 */
const REFERENCE_CROP_SYMBOLS: Readonly<Record<string, string>> = {
  'criiam-ail': 'ail',
  'criiam-artichaut-non-remontant': 'artichaut',
  'criiam-artichaut-remontant': 'artichaut',
  'criiam-asperge': 'asperge',
  'criiam-aubergine': 'aubergine',
  'criiam-betterave': 'betterave',
  'criiam-carotte': 'carotte',
  'criiam-chou-fleur': 'chou-fleur',
  'criiam-courgette': 'courgette',
  'criiam-fraisier': 'fraise',
  'criiam-fraisier-remontant': 'fraise',
  'criiam-haricot': 'haricot',
  'criiam-melon': 'melon',
  'criiam-oignon': 'oignon',
  'criiam-poireau': 'poireau',
  'criiam-poivron': 'poivron',
  'criiam-pomme-de-terre': 'pomme-de-terre',
  'criiam-salade-ete': 'laitue',
  'criiam-tomate': 'tomate',
  'fao-brocoli': 'chou-brocoli',
  'fao-celeri': 'celeri-branche',
  'fao-concombre': 'concombre',
  'fao-cruciferes': 'chou-blanc',
  'fao-epinard': 'epinard',
  'fao-feve': 'feve',
  'fao-navet': 'navet',
  'fao-oignon-vert': 'oignon',
  'fao-pasteque': 'pasteque',
  'fao-patate-douce': 'patate-douce',
  'fao-petit-pois': 'pois',
  'fao-potiron': 'courge-potiron',
  'fao-radis': 'radis-botte',
};

/** « Céleri-rave » → « celeri-rave » : le nom écrit comme un `fqn` d'Ouvre ta ferme. */
export function plantSymbolSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Le symbole d'une culture de référence : par sa table, sinon par son nom ; `null` sans dessin. */
export function referenceCropSymbol(crop: { id: string; name: string }): string | null {
  const mapped = REFERENCE_CROP_SYMBOLS[crop.id];
  if (mapped !== undefined) return mapped;
  return speciesSymbol(crop.name);
}

/** Le symbole d'une espèce d'Ouvre ta ferme, par son nom ; `null` sans dessin. */
export function speciesSymbol(name: string): string | null {
  const slug = plantSymbolSlug(name);
  return OTF_PLANT_SYMBOLS.has(slug) ? slug : null;
}

/** L'adresse qui sert les symboles d'une page, triés pour qu'une même page garde la même adresse. */
export function plantVignetteSpriteHref(symbols: readonly (string | null)[]): string | null {
  const ids = [...new Set(symbols.filter((symbol): symbol is string => symbol !== null && OTF_PLANT_SYMBOLS.has(symbol)))].sort();
  return ids.length === 0 ? null : `${PLANT_VIGNETTE_ROUTE}?ids=${ids.join(',')}`;
}

/** Les symboles qu'une adresse demande, réduits à ceux du fichier ; vide si la demande ne tient pas. */
export function requestedPlantSymbols(value: string | null): string[] {
  if (value === null) return [];
  const ids = [...new Set(value.split(','))];
  if (ids.length > MAX_REQUESTED_SYMBOLS) return [];
  return ids.filter((id) => OTF_PLANT_SYMBOLS.has(id)).sort();
}

const SYMBOL_PATTERN = /<symbol\b[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<\/symbol>/g;
/** Les seules balises d'un dessin, celles du fichier relevé le 7 novembre 2026. */
const DRAWING_TAGS = new Set(['symbol', 'g', 'path', 'circle', 'ellipse', 'polygon', 'polyline', 'rect', 'line']);
/** Les seuls attributs d'un dessin : ni script, ni gestionnaire d'événement, ni lien. */
const DRAWING_ATTRIBUTES = new Set(['id', 'viewBox', 'd', 'style', 'transform', 'cx', 'cy', 'r', 'rx', 'ry', 'points', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'fill', 'stroke', 'stroke-width', 'opacity']);

function isDrawingOnly(markup: string): boolean {
  for (const [, tag] of markup.matchAll(/<\/?\s*([a-zA-Z][\w:-]*)/g)) if (!DRAWING_TAGS.has(tag)) return false;
  for (const [, attribute] of markup.matchAll(/\s([a-zA-Z_:][\w:.-]*)\s*=/g)) if (!DRAWING_ATTRIBUTES.has(attribute)) return false;
  return !/url\s*\(|javascript:|expression\s*\(/i.test(markup);
}

/**
 * Les dessins de la démonstration, sans appel réseau : une feuille verte pour
 * chaque symbole demandé, à la place du dessin d'Ouvre ta ferme.
 */
export function demonstrationPlantSymbols(ids: readonly string[]): string {
  const leaf = '<path d="M50 88C24 70 22 34 50 12C78 34 76 70 50 88Z" style="fill:#7cb342"/><path d="M50 84V30" style="fill:none;stroke:#33691e;stroke-width:4"/>';
  const sprite = ids.map((id) => `<symbol id="${id}" viewBox="0 0 100 100">${leaf}</symbol>`).join('\n');
  return extractPlantSymbols(sprite, ids);
}

/**
 * Le fichier servi par le module : les seuls symboles demandés, chacun tel
 * qu'Ouvre ta ferme le dessine. Un symbole qui porterait autre chose qu'un
 * dessin (une balise ou un attribut hors liste) est écarté.
 */
export function extractPlantSymbols(sprite: string, ids: readonly string[]): string {
  const wanted = new Set(ids);
  const kept: string[] = [];
  for (const match of sprite.matchAll(SYMBOL_PATTERN)) {
    const [markup, id] = match;
    if (!wanted.has(id) || !isDrawingOnly(markup)) continue;
    kept.push(markup);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg">\n${kept.join('\n')}\n</svg>\n`;
}
