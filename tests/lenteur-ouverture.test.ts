import assert from 'node:assert/strict';
import test from 'node:test';
import { landingRedirectScript, legacyRedirect, pageHref } from '../lib/domain/features/pages';

/**
 * Lenteur du module, N2 (D-323, docs/lenteur-du-module-contract.md) : sans
 * ancre, `/irrigation` conduit à la page d'arrivée par un script lu avec la
 * page, sans attendre les scripts du module ; avec une ancre, rien ne change.
 */

test('le script conduit à la page d’arrivée seulement sans ancre', () => {
  const script = landingRedirectScript('/irrigation/aujourdhui?season=2026');
  assert.equal(script, 'if(!window.location.hash)window.location.replace("/irrigation/aujourdhui?season=2026");');
});

test('le script vise la même page que la conduite du navigateur sans ancre', () => {
  const sansAujourdhui = ['materiel', 'calculateur'] as const;
  const href = pageHref(legacyRedirect('', [...sansAujourdhui]).page, { season: 2026, week: '2026-11-23', refresh: true });
  assert.equal(href, '/irrigation/materiel?season=2026&week=2026-11-23&refresh=1');
  assert.match(landingRedirectScript(href), /replace\("\/irrigation\/materiel\?season=2026&week=2026-11-23&refresh=1"\)/);
});

test('une adresse qui sortirait du module ou du texte du script est refusée', () => {
  for (const href of ['https://ailleurs.example/', '/irrigation', '/autre/page', '/irrigation/aujourdhui"</script>', '/irrigation/aujourdhui#planning']) {
    assert.throws(() => landingRedirectScript(href), RangeError, href);
  }
});
