/**
 * Les adresses fixes du site public et du module (sous-tranche 4.8,
 * docs/tranche-4-contract.md, section 9, T4-19) : elles sont données au
 * formulaire d'Ouvre ta ferme et ne doivent plus changer, sous peine de
 * refaire la demande. L'adresse de retour est servie par le module, derrière
 * la connexion ; elle ne fait rien tant que la connexion à Ouvre ta ferme
 * (4.3) n'existe pas.
 */
export const SITE_URL = 'https://irrigation-otf-site.lechampdelaurore.workers.dev';
export const MODULE_URL = 'https://module-irrigation-otf.lechampdelaurore.workers.dev';
const OAUTH_RETURN_PATH = '/api/otf/oauth/retour';
export const OAUTH_RETURN_URL = `${MODULE_URL}${OAUTH_RETURN_PATH}`;
export const SOURCE_URL = 'https://github.com/lechampdelaurore-boop/module-irrigation-otf-public';
export const OTF_URL = 'https://www.ouvretaferme.org';
export const CNIL_URL = 'https://www.cnil.fr/fr/plaintes';

/** Les chemins des trois pages publiques. */
export const PAGE_PATHS = {
  home: '/',
  privacy: '/confidentialite',
  terms: '/conditions',
} as const;
