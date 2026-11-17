import { PAGE_PATHS } from './addresses.ts';
import { SITE_CSS } from './layout.ts';
import { homePage, privacyPage, termsPage } from './pages.ts';

/**
 * Le Worker du site public (sous-tranche 4.8, D-153) : trois pages en
 * lecture seule et leur feuille de style. Aucune base, aucun journal, aucun
 * témoin, aucun script ; seules les méthodes GET et HEAD sont acceptées.
 */

export type SiteEnv = {
  /** Saisie par le porteur lui-même dans Cloudflare, jamais dans le dépôt. */
  SITE_CONTACT_EMAIL?: string;
};

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy':
    "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'strict-transport-security': 'max-age=31536000',
};

/** Une heure en cache : le texte change rarement, et sa date est écrite en tête. */
const CACHE_CONTROL = 'public, max-age=3600';

const NOT_FOUND_HTML = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page introuvable</title><link rel="stylesheet" href="/site.css"></head>
<body><main id="contenu"><h1>Page introuvable</h1><p>Cette adresse ne correspond à aucune page du site.</p>
<p><a href="/">Retour à l'accueil</a></p></main></body></html>
`;

function respond(body: string, contentType: string, status: number, method: string): Response {
  return new Response(method === 'HEAD' ? null : body, {
    status,
    headers: {
      'content-type': contentType,
      'cache-control': status === 200 ? CACHE_CONTROL : 'no-store',
      ...SECURITY_HEADERS,
    },
  });
}

export function handleSiteRequest(request: Request, env: SiteEnv): Response {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Méthode non acceptée', {
      status: 405,
      headers: { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS },
    });
  }
  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  const html = 'text/html; charset=utf-8';
  switch (path) {
    case PAGE_PATHS.home:
      return respond(homePage(env.SITE_CONTACT_EMAIL), html, 200, method);
    case PAGE_PATHS.privacy:
      return respond(privacyPage(env.SITE_CONTACT_EMAIL), html, 200, method);
    case PAGE_PATHS.terms:
      return respond(termsPage(env.SITE_CONTACT_EMAIL), html, 200, method);
    case '/site.css':
      return respond(SITE_CSS, 'text/css; charset=utf-8', 200, method);
    default:
      return respond(NOT_FOUND_HTML, html, 404, method);
  }
}

const siteWorker = {
  fetch(request: Request, env: SiteEnv): Response {
    return handleSiteRequest(request, env);
  },
};

export default siteWorker;
