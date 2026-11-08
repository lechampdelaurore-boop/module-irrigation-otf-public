import assert from 'node:assert/strict';
import test from 'node:test';
import { readPlantSymbols } from '../lib/adapters/otf/plant-sprite.ts';
import {
  demonstrationPlantSymbols,
  extractPlantSymbols,
  OTF_PLANT_SPRITE_URL,
  OTF_PLANT_SYMBOLS,
  plantSymbolSlug,
  plantVignetteSpriteHref,
  referenceCropSymbol,
  requestedPlantSymbols,
  speciesSymbol,
} from '../lib/domain/crop-water/plant-vignettes.ts';

const SPRITE = `<svg version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg">
	<symbol id="ail" viewBox="0 0 100 100">
	<path style="fill:#DE9B1D;" d="M41.1,17.4c-14.1-0.6z"/>
	</symbol>
	<symbol id="carotte" viewBox="0 0 100 100">
	<g transform="translate(1 2)"><ellipse cx="5" cy="5" rx="2" ry="3" style="fill:#F80"/></g>
	</symbol>
	<symbol id="tomate" viewBox="0 0 100 100">
	<path onload="alert(1)" d="M0 0z"/>
	</symbol>
	<symbol id="laitue" viewBox="0 0 100 100">
	<script>alert(1)</script>
	</symbol>
</svg>`;

test('plant vignettes: the 183 symbols read from Ouvre ta ferme on 7 November 2026', () => {
  assert.equal(OTF_PLANT_SYMBOLS.size, 183);
  assert.ok(OTF_PLANT_SYMBOLS.has('carotte'));
  assert.ok(OTF_PLANT_SYMBOLS.has('chou-fleur'));
});

test('plant vignettes: a name is written like an OTF fqn', () => {
  assert.equal(plantSymbolSlug('Céleri-rave'), 'celeri-rave');
  assert.equal(plantSymbolSlug('Chou de Bruxelles'), 'chou-de-bruxelles');
  assert.equal(plantSymbolSlug('Tomate cœur de bœuf'), 'tomate-coeur-de-boeuf');
  assert.equal(plantSymbolSlug('  Pomme de terre '), 'pomme-de-terre');
});

test('plant vignettes: every common reference crop has a drawing, by its table first', () => {
  const ids = ['criiam-ail', 'criiam-artichaut-non-remontant', 'criiam-artichaut-remontant', 'criiam-asperge', 'criiam-aubergine',
    'criiam-betterave', 'criiam-carotte', 'criiam-chou-fleur', 'criiam-courgette', 'criiam-fraisier', 'criiam-fraisier-remontant',
    'criiam-haricot', 'criiam-melon', 'criiam-oignon', 'criiam-poireau', 'criiam-poivron', 'criiam-pomme-de-terre',
    'criiam-salade-ete', 'criiam-tomate', 'fao-brocoli', 'fao-celeri', 'fao-concombre', 'fao-cruciferes', 'fao-epinard', 'fao-feve',
    'fao-navet', 'fao-oignon-vert', 'fao-pasteque', 'fao-patate-douce', 'fao-petit-pois', 'fao-potiron', 'fao-radis'];
  for (const id of ids) {
    const symbol = referenceCropSymbol({ id, name: 'Sans dessin' });
    assert.ok(symbol !== null && OTF_PLANT_SYMBOLS.has(symbol), id);
  }
  assert.equal(referenceCropSymbol({ id: 'criiam-salade-ete', name: 'Salade d’été' }), 'laitue');
  assert.equal(referenceCropSymbol({ id: 'local-1', name: 'Mâche' }), 'mache');
  assert.equal(referenceCropSymbol({ id: 'local-2', name: 'Culture inventée' }), null);
  assert.equal(speciesSymbol('Céleri-rave'), 'celeri-rave');
  assert.equal(speciesSymbol('Bupleurum'), null);
});

test('plant vignettes: one address per page, sorted, without unknown symbols', () => {
  assert.equal(plantVignetteSpriteHref(['tomate', null, 'ail', 'tomate', 'inconnu']), '/irrigation/especes.svg?ids=ail,tomate');
  assert.equal(plantVignetteSpriteHref([null]), null);
  assert.deepEqual(requestedPlantSymbols('tomate,ail,inconnu,ail'), ['ail', 'tomate']);
  assert.deepEqual(requestedPlantSymbols(null), []);
  assert.deepEqual(requestedPlantSymbols(Array.from({ length: 201 }, (_, index) => `x${index}`).join(',')), []);
});

test('plant vignettes: only the asked drawings are kept, and a symbol carrying more than a drawing is dropped', () => {
  const sprite = extractPlantSymbols(SPRITE, ['ail', 'carotte', 'tomate', 'laitue']);
  assert.match(sprite, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg">/);
  assert.match(sprite, /id="ail"/);
  assert.match(sprite, /id="carotte"/);
  assert.doesNotMatch(sprite, /id="tomate"/);
  assert.doesNotMatch(sprite, /id="laitue"/);
  assert.doesNotMatch(extractPlantSymbols(SPRITE, ['carotte']), /id="ail"/);
});

test('plant vignettes: the sprite is read from Ouvre ta ferme, kept fifteen days at the edge, and a failure gives no drawing', async () => {
  let seen: { url: string; init: RequestInit & { cf?: unknown } } | null = null;
  const sprite = await readPlantSymbols(['ail'], async (url, init) => {
    seen = { url: String(url), init: init as RequestInit & { cf?: unknown } };
    return new Response(SPRITE, { status: 200 });
  });
  assert.match(sprite ?? '', /id="ail"/);
  assert.equal(seen!.url, OTF_PLANT_SPRITE_URL);
  assert.deepEqual(seen!.init.cf, { cacheEverything: true, cacheTtlByStatus: { '200-299': 1_296_000, '300-599': -1 } });
  assert.equal(await readPlantSymbols(['ail'], async () => new Response('', { status: 404 })), null);
  assert.equal(await readPlantSymbols(['ail'], async () => { throw new TypeError('réseau'); }), null);
});

test('plant vignettes: the demonstration serves a leaf for each asked symbol, without calling Ouvre ta ferme', () => {
  const sprite = demonstrationPlantSymbols(['carotte', 'tomate']);
  assert.equal(sprite.match(/<symbol /g)?.length, 2);
  assert.match(sprite, /<symbol id="carotte" viewBox="0 0 100 100"><path /);
  assert.match(sprite, /<symbol id="tomate" /);
});
