import assert from 'node:assert/strict';
import test from 'node:test';
import { millimetersNumber, millimetersText, volumeText } from '../lib/domain/display-numbers.ts';
import { ofName, proposalsText, settingText } from '../lib/domain/display-words.ts';
import { ABSENT_FEATURE_NOTICE, absentPageNotice, pageAccess, pageHref } from '../lib/domain/features/pages.ts';

/**
 * Audit ergonomique final, lot E, mots et chiffres
 * (docs/audit-ergonomie-final-lot-e-contract.md). Les cas chiffrés de la
 * section 10, un affichage seulement : le calcul garde sa précision.
 */

test('J8 : un volume en m³ à deux décimales au plus, sans zéro inutile (F258, cas 1 et 6)', () => {
  assert.equal(volumeText(3.138), '3,14 m³');
  assert.equal(volumeText(12), '12 m³');
  assert.equal(volumeText(1.5), '1,5 m³');
  assert.equal(volumeText(1.004), '1 m³');
});

test('J8 : sous 1 m³, des litres entiers ; jamais « 0 L » pour un volume non nul (F258, cas 2, 3 et 5)', () => {
  assert.equal(volumeText(0.425), '425 L');
  assert.equal(volumeText(0.0005), '1 L');
  assert.equal(volumeText(0.0004), 'moins de 1 L');
  assert.equal(volumeText(0.9994), '999 L');
  assert.equal(volumeText(0.9996), '1 m³', 'un volume qui s’arrondit à 1 000 L se lit en m³');
});

test('J8 : zéro se lit « 0 m³ », le signe d’un écart se garde (F258, cas 4 et 7)', () => {
  assert.equal(volumeText(0), '0 m³');
  assert.equal(volumeText(-0.3), '-300 L');
  assert.equal(volumeText(-2.5), '-2,5 m³');
  assert.equal(volumeText(Number.NaN), '—');
});

test('J8 : des millimètres à une décimale au plus (F259, cas 8)', () => {
  assert.equal(millimetersText(16.54), '16,5 mm');
  assert.equal(millimetersText(12), '12 mm');
  assert.equal(millimetersNumber(0.04), '0');
});

test('J9 : une seule proposition se dit « la proposition » (F262, cas 9)', () => {
  assert.equal(`Valider ${proposalsText(1)} du jour`, 'Valider la proposition du jour');
  assert.equal(`Valider ${proposalsText(3)} du jour`, 'Valider les 3 propositions du jour');
});

test('J9 : « de » s’élide devant une voyelle, accentuée ou non, jamais devant un h (F262, cas 10)', () => {
  assert.equal(`Observer le sol ${ofName('Abri des noues')}`, "Observer le sol d'Abri des noues");
  assert.equal(ofName('Étang'), "d'Étang");
  assert.equal(ofName('île'), "d'île");
  assert.equal(ofName('Œillets'), "d'Œillets");
  assert.equal(ofName('Haut Champ'), 'de Haut Champ');
  assert.equal(ofName('Serre 2'), 'de Serre 2');
});

test('J9 : le réglage nommé une fois (F263, cas 11)', () => {
  assert.equal(settingText('Réglage habituel'), 'Réglage habituel');
  assert.equal(settingText('réglage du matin'), 'réglage du matin');
  assert.equal(settingText('5 planches'), 'Réglage 5 planches');
  assert.equal(settingText('Réglages'), 'Réglage Réglages', 'un autre mot que « Réglage »');
});

test('J11 : l’adresse nomme la page non cochée et la ligne la nomme, avec le lien vers Réglages (F265, cas 12)', () => {
  const access = pageAccess('arrosages', false, ['materiel']);
  assert.deepEqual(access, { kind: 'not-enabled', page: 'materiel', requested: 'arrosages' });
  assert.equal(pageHref('aujourdhui', { season: 2026, absent: 'arrosages' }), '/irrigation/aujourdhui?season=2026&absente=arrosages');
  assert.deepEqual(absentPageNotice('arrosages'), { text: 'La page « Arrosages » n’est pas cochée pour votre ferme.', settingsLabel: 'La cocher dans Réglages' });
  assert.deepEqual(absentPageNotice('historique'), { text: 'La page « Historique et cumuls » n’est pas cochée pour votre ferme.', settingsLabel: 'La cocher dans Réglages' });
});

test('J11 : « Aujourd’hui » n’a pas de case, une ancienne adresse ou une page inconnue garde la phrase d’avant (F265)', () => {
  assert.deepEqual(pageAccess('aujourdhui', false, ['calculateur']), { kind: 'not-enabled', page: 'reglages', requested: 'aujourdhui' });
  assert.deepEqual(absentPageNotice('aujourdhui'), { text: 'La page « Aujourd’hui » n’a aucune de ses fonctionnalités cochées pour votre ferme.', settingsLabel: 'Les cocher dans Réglages' });
  assert.equal(pageHref('materiel', { absent: true }), '/irrigation/materiel?absente=1');
  for (const old of ['1', 'inconnue', 'reglages']) assert.deepEqual(absentPageNotice(old), { text: ABSENT_FEATURE_NOTICE, settingsLabel: 'La cocher dans Réglages' }, old);
  assert.equal(absentPageNotice(undefined), null);
  assert.equal(absentPageNotice(''), null);
  assert.equal(absentPageNotice(['arrosages', 'planning']), null);
});
