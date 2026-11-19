import assert from 'node:assert/strict';
import test from 'node:test';
import { MODULE_URL, OAUTH_RETURN_URL, PAGE_PATHS, SITE_URL } from '../src/addresses.ts';
import { handleSiteRequest } from '../src/index.ts';
import { contactHtml, RESPONSIBLE } from '../src/pages.ts';

// Le site public de la sous-tranche 4.8 (docs/tranche-4-contract.md, section 9, T4-18 ; D-153).

const CONTACT = 'contact@exemple.invalid';

async function get(path: string, env: { SITE_CONTACT_EMAIL?: string } = {}, method = 'GET') {
  const response = handleSiteRequest(new Request(`${SITE_URL}${path}`, { method }), env);
  return { response, body: await response.text() };
}

test('les trois pages publiques répondent en HTML français, sans connexion', async () => {
  for (const path of Object.values(PAGE_PATHS)) {
    const { response, body } = await get(path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.match(body, /<html lang="fr">/);
    assert.match(body, /<h1>/);
    assert.match(body, /href="\/confidentialite"/, `${path} mène à la confidentialité`);
  }
});

test('une barre oblique finale mène à la même page', async () => {
  const { response, body } = await get('/confidentialite/');
  assert.equal(response.status, 200);
  assert.match(body, /Politique de confidentialité/);
});

test('aucun script, aucune ressource externe, aucun témoin', async () => {
  for (const path of [...Object.values(PAGE_PATHS), '/site.css']) {
    const { response, body } = await get(path);
    assert.doesNotMatch(body, /<script/i, path);
    assert.doesNotMatch(body, /<(link|img|iframe)[^>]+(src|href)="https?:/i, `${path} ne charge rien d'ailleurs`);
    assert.doesNotMatch(body, /@import|url\(/i, `${path} ne charge aucune police ni image`);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'none'/);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  }
});

test('la politique de confidentialité couvre ce que demande le contrat (section 9)', async () => {
  const { body } = await get(PAGE_PATHS.privacy);
  const required: Array<[RegExp, string]> = [
    [/Qui est responsable/, 'responsable'],
    [/François PREZEAU, GAEC Le Champ de l'Aurore/, 'nom du responsable'],
    [/Ce que le module lit dans Ouvre ta ferme/, 'ce qui est lu'],
    [/n'écrit jamais rien dans Ouvre ta ferme/, 'lecture seule'],
    [/structure et configuration/, 'droit structure'],
    [/parcellaire/, 'droit parcellaire'],
    [/cultures/, 'droit cultures'],
    [/espèces et variétés/, 'droit espèces'],
    [/interventions/, 'droit interventions'],
    [/Ce que le module garde/, 'ce qui est gardé'],
    [/Combien de temps/, 'durée'],
    [/Où sont les données/, 'où'],
    [/Cloudflare/, 'hébergeur'],
    [/Ce qui sort vers l'extérieur/, 'sorties'],
    [/Open-Meteo/, 'météo'],
    [/Visual Crossing/, 'météo'],
    [/IGN/, 'cartes'],
    [/Notifications/, 'notifications'],
    [/Rien n'est vendu/, 'rien de vendu'],
    [/effacées entièrement/, 'effacement'],
    [/Vos droits/, 'droits'],
    [/CNIL/, 'réclamation'],
    [/Si Ouvre ta ferme change ou s'arrête/, 'si OTF change'],
    [/aucune mesure d'audience/i, 'aucune mesure d’audience'],
    [/pas encore été relu par un juriste/, 'relecture annoncée honnêtement'],
    // Le coffre des jetons (4.3, PR 2 ; docs/tranche-4-contract.md, F367) et le point D6 de la revue de l'isolation.
    [/<strong>La clé d'accès donnée par Ouvre ta ferme<\/strong>/, 'la clé d’accès gardée'],
    [/Elle est gardée chiffrée, et effacée quand vous déconnectez la ferme dans le module, ou dès que le module constate qu'Ouvre ta ferme n'accepte plus son accès/, 'chiffrée, effacée à la déconnexion ou au retrait'],
    [/il peut techniquement lire les données de chaque ferme dans la base de données et dans les journaux techniques/, 'ce que le responsable peut lire (D6)'],
    [/Texte du 19 novembre 2026/, 'date du texte'],
  ];
  for (const [pattern, label] of required) assert.match(body, pattern, label);
  assert.ok(body.includes(OAUTH_RETURN_URL), "l'adresse de retour est écrite");
  assert.ok(body.includes(MODULE_URL), "l'adresse du module est écrite");
});

test("la page d'accueil dit ce que fait le module, pour qui, ce qu'il ne fait pas, la démonstration et le contact", async () => {
  const { body } = await get(PAGE_PATHS.home);
  for (const heading of ["Ce qu'il fait", 'Pour qui', "Ce qu'il ne fait pas", "L'essayer", 'Contact']) {
    assert.match(body, new RegExp(`<h2>${heading}</h2>`), heading);
  }
  assert.match(body, /démonstration/);
  // Précisions du porteur du 18 novembre 2026 (F345, F346).
  assert.match(body, /pas encore de vanne ni de capteur : c'est en cours de développement/);
  assert.match(body, /travaillera sur ses vraies données/);
  assert.match(body, /pas encore ouvert à tous/);
  // Le contact, de préférence par Discord (F347).
  assert.match(body, /de préférence par Discord/);
  assert.match(body, /décrivez-le bien par écrit/);
  assert.match(body, /captures d'écran si possible/);
  assert.ok(body.includes(RESPONSIBLE));
});

test("les conditions d'utilisation disent : tel quel, aide à la décision, responsabilité de l'exploitant", async () => {
  const { body } = await get(PAGE_PATHS.terms);
  assert.match(body, /tel quel/);
  // Le prix (F348, choix du porteur du 18 novembre 2026) : gratuit pendant le
  // pilote, puis une participation possible aux frais, annoncée à l'avance.
  assert.match(body, /<strong>Prix\.<\/strong> Le module est gratuit pendant toute la durée du pilote\./);
  assert.match(body, /de l'ordre de 1 € par mois et par ferme, uniquement pour couvrir ces frais, sans but lucratif/);
  assert.match(body, /annoncée à l'avance/);
  assert.match(body, /libre d'arrêter/);
  assert.match(body, /Texte du 18 novembre 2026/);
  assert.match(body, /aide à la décision/i);
  assert.match(body, /responsable de sa ferme/);
});

test("le contact affiche l'adresse saisie dans Cloudflare, et rien d'autre", async () => {
  const { body } = await get(PAGE_PATHS.privacy, { SITE_CONTACT_EMAIL: ` ${CONTACT} ` });
  assert.ok(body.includes(`<a href="mailto:${CONTACT}">${CONTACT}</a>`));
  assert.doesNotMatch(body, /en cours de mise en place/);
});

test("sans adresse de contact, ou avec une valeur douteuse, la page renvoie à la page du projet", () => {
  for (const value of [undefined, '', '   ', 'pas une adresse', '<script>@x.fr', 'a"b@c.fr']) {
    const html = contactHtml(value);
    assert.match(html, /page publique du projet/, String(value));
    assert.doesNotMatch(html, /mailto:|<script/, String(value));
  }
});

test('une adresse inconnue répond 404 en français, sans cache', async () => {
  const { response, body } = await get('/irrigation');
  assert.equal(response.status, 404);
  assert.match(body, /Page introuvable/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('seules les méthodes GET et HEAD sont acceptées ; HEAD ne renvoie pas de corps', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const { response } = await get('/', {}, method);
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
  }
  const head = await get(PAGE_PATHS.privacy, {}, 'HEAD');
  assert.equal(head.response.status, 200);
  assert.equal(head.body, '');
});

test('la feuille de style est servie avec son type', async () => {
  const { response, body } = await get('/site.css');
  assert.equal(response.headers.get('content-type'), 'text/css; charset=utf-8');
  assert.match(body, /min-height: 44px/);
});

test("les adresses fixes données à Ouvre ta ferme ne changent pas sans qu'on le voie", () => {
  assert.equal(SITE_URL, 'https://irrigation-otf-site.lechampdelaurore.workers.dev');
  assert.equal(OAUTH_RETURN_URL, 'https://module-irrigation-otf.lechampdelaurore.workers.dev/api/otf/oauth/retour');
});
