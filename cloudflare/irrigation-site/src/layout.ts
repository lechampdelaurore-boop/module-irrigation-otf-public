import { PAGE_PATHS } from './addresses.ts';

/**
 * La mise en page commune des pages publiques : du HTML écrit côté serveur,
 * sans script, sans police ni image venues d'ailleurs, sans témoin (cookie).
 * Les couleurs reprennent celles de la charte du module (docs/charte-module.md).
 */

export type PageId = keyof typeof PAGE_PATHS;

const NAV_LABELS: Record<PageId, string> = {
  home: 'Accueil',
  privacy: 'Confidentialité',
  terms: "Conditions d'utilisation",
};

/** Échappe un texte venu d'une variable avant de l'écrire dans la page. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Le logo du module dans l'onglet et les favoris (D-302). */
export const FAVICON_PATH = '/favicon.svg';
export const FAVICON_LINK = `<link rel="icon" href="${FAVICON_PATH}" type="image/svg+xml">`;

export function renderPage(input: { id: PageId; title: string; description: string; body: string }): string {
  const nav = (Object.keys(PAGE_PATHS) as PageId[])
    .map((id) => {
      const current = id === input.id ? ' aria-current="page"' : '';
      return `<li><a href="${PAGE_PATHS[id]}"${current}>${NAV_LABELS[id]}</a></li>`;
    })
    .join('');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${input.title} · Module d'irrigation pour Ouvre ta ferme</title>
<meta name="description" content="${input.description}">
${FAVICON_LINK}
<link rel="stylesheet" href="/site.css">
</head>
<body>
<a class="skip-link" href="#contenu">Aller au contenu</a>
<header class="site-header">
<p class="site-name"><a href="/">Module d'irrigation pour Ouvre ta ferme</a></p>
<nav aria-label="Pages du site"><ul>${nav}</ul></nav>
</header>
<main id="contenu" tabindex="-1">
${input.body}
</main>
<footer class="site-footer">
<p>Aucune mesure d'audience, aucune publicité, aucun témoin (cookie) sur ce site.</p>
</footer>
</body>
</html>
`;
}

export const SITE_CSS = `:root {
  --sheet: #f8f8f8;
  --card: #fff;
  --ink: #111;
  --ink2: #4a4a4a;
  --line: #ddd;
  --green: #0b694d;
  --green-dark: #08523c;
  --menu: #e7f1ee;
  color-scheme: light;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--sheet);
  color: var(--ink);
  font: 1rem/1.6 "Segoe UI", system-ui, -apple-system, sans-serif;
  overflow-wrap: anywhere;
}
a { color: var(--green); }
a:hover { color: var(--green-dark); }
a:focus-visible { outline: 3px solid var(--green); outline-offset: 2px; }
.skip-link { position: absolute; left: -9999px; }
.skip-link:focus { left: 1rem; top: 1rem; background: var(--card); padding: .5rem 1rem; z-index: 1; }
.site-header, main, .site-footer { max-width: 46rem; margin: 0 auto; padding: 0 1rem; }
.site-header { padding-top: 1rem; border-bottom: 1px solid var(--line); }
.site-name { margin: 0 0 .5rem; font-weight: 700; font-size: 1.1rem; }
.site-name a { color: var(--ink); text-decoration: none; }
.site-header ul { list-style: none; margin: 0; padding: 0 0 .75rem; display: flex; flex-wrap: wrap; gap: .5rem; }
.site-header li a {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 .9rem;
  border-radius: .75rem; background: var(--menu); text-decoration: none; color: var(--green-dark);
}
.site-header li a[aria-current="page"] { background: var(--green); color: #fff; }
main { padding-top: 1.5rem; padding-bottom: 2rem; }
main:focus { outline: none; }
h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 1rem; }
h2 { font-size: 1.2rem; margin: 2rem 0 .5rem; }
.lead { font-size: 1.1rem; }
.note { background: var(--card); border: 1px solid var(--line); border-radius: .75rem; padding: .75rem 1rem; }
.updated { color: var(--ink2); font-size: .95rem; }
code { overflow-wrap: anywhere; }
.site-footer { border-top: 1px solid var(--line); color: var(--ink2); font-size: .95rem; padding-bottom: 2rem; }
`;
