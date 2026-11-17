import assert from 'node:assert/strict';
import test from 'node:test';
import { OTF_OAUTH_RETURN_PATH, otfOauthReturnNotOpenYet } from '../lib/domain/otf/oauth-return.ts';

// L'adresse de retour de la connexion à Ouvre ta ferme, fixée par la 4.8 (D-153).

test("l'adresse de retour est fixe : elle est donnée au formulaire d'Ouvre ta ferme", () => {
  assert.equal(OTF_OAUTH_RETURN_PATH, '/api/otf/oauth/retour');
});

test("avant la 4.3, la page dit que la connexion n'est pas ouverte et que rien n'a été lu", () => {
  const page = otfOauthReturnNotOpenYet();
  assert.equal(page.status, 200);
  assert.match(page.body, /<html lang="fr">/);
  assert.match(page.body, /pas encore ouverte/);
  assert.match(page.body, /Aucune donnée n'a été lue ni enregistrée/);
  assert.match(page.body, /href="\/irrigation"/);
});

test("la page n'est jamais mise en cache et ne transmet pas l'adresse (le code) par un lien", () => {
  const { headers, body } = otfOauthReturnNotOpenYet();
  assert.equal(headers['cache-control'], 'no-store');
  assert.equal(headers['referrer-policy'], 'no-referrer');
  assert.doesNotMatch(body, /<script|<form|<img/i);
});

test("le site public annonce la même adresse de retour que celle que sert le module", async () => {
  const { MODULE_URL, OAUTH_RETURN_URL } = await import('../cloudflare/irrigation-site/src/addresses.ts');
  assert.equal(OAUTH_RETURN_URL, `${MODULE_URL}${OTF_OAUTH_RETURN_PATH}`);
});
