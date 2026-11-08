import assert from 'node:assert/strict';
import test from 'node:test';
import { PAGE_FEATURE_IDS } from '../lib/domain/features/catalogue';
import { GARDEN_GROUP_HELP, PAGE_HELP, pageHelp, RELIABILITY_HELP, SHELTER_FACTOR_HELP } from '../lib/domain/features/help';
import type { IrrigationPageId } from '../lib/domain/features/pages';

/**
 * Le « ? » de chaque page (docs/feature-selection-contract.md, section 6) :
 * chaque page a ses trois textes, courts, en phrases.
 */

const PAGES: IrrigationPageId[] = ['aujourdhui', ...PAGE_FEATURE_IDS, 'reglages'];

test('chaque page a son aide : à quoi elle sert, comment la lire, par où commencer', () => {
  assert.deepEqual(Object.keys(PAGE_HELP).sort(), [...PAGES].sort(), 'une aide par page, aucune de trop');
  for (const page of PAGES) {
    const help = pageHelp(page);
    for (const [part, text] of Object.entries(help)) {
      assert.ok(text.length >= 40, `${page}, ${part} : trop court`);
      assert.ok(text.length <= 300, `${page}, ${part} : ${text.length} caractères, trop long pour une aide courte`);
      assert.match(text, /^[A-ZÀ-Ý«]/u, `${page}, ${part} : commence par une majuscule`);
      assert.match(text, /[.»]$/u, `${page}, ${part} : finit par un point`);
      assert.doesNotMatch(text, /'/u, `${page}, ${part} : apostrophe typographique`);
    }
  }
});

test('le « ? » des groupes de jardins alignés dit à quoi sert un groupe, ce qu’il faut renseigner, et décrit son schéma (P38)', () => {
  assert.deepEqual(GARDEN_GROUP_HELP.entries.map((entry) => entry.title), [
    'À quoi sert un groupe',
    'Comment le module s’en sert',
    'Ce qu’il faut renseigner',
    'Quand s’en passer',
  ]);
  for (const { title, text } of [...GARDEN_GROUP_HELP.entries, { title: 'schéma', text: GARDEN_GROUP_HELP.figureLabel ?? '' }]) {
    assert.ok(text.length >= 40 && text.length <= 300, `${title} : ${text.length} caractères`);
    assert.match(text, /^[A-ZÀ-Ý«]/u, `${title} : commence par une majuscule`);
    assert.match(text, /\.$/u, `${title} : finit par un point`);
    assert.doesNotMatch(text, /'/u, `${title} : apostrophe typographique`);
  }
  assert.match(GARDEN_GROUP_HELP.entries[3].text, /goutte-à-goutte/u, 'le goutte-à-goutte n’en a pas besoin');
});

test('le « ? » du K_abri dit ce qu’il fait, sa valeur par défaut, un exemple et quand le changer (P42)', () => {
  assert.deepEqual(SHELTER_FACTOR_HELP.entries.map((entry) => entry.title), [
    'Ce que fait le K_abri',
    'La valeur par défaut',
    'Un exemple',
    'Quand le changer',
  ]);
  for (const { title, text } of SHELTER_FACTOR_HELP.entries) {
    assert.ok(text.length >= 40 && text.length <= 300, `${title} : ${text.length} caractères`);
    assert.match(text, /^[A-ZÀ-Ý«0-9]/u, `${title} : commence par une majuscule ou un nombre`);
    assert.match(text, /\.$/u, `${title} : finit par un point`);
    assert.doesNotMatch(text, /'/u, `${title} : apostrophe typographique`);
  }
  assert.equal(SHELTER_FACTOR_HELP.figureLabel, undefined);
});

test('le « ? » de « Fiabilité du calcul » écrit chaque seuil : aucun n’est caché (audit ergonomique, lot 2, section 6)', () => {
  assert.deepEqual(RELIABILITY_HELP.entries.map((entry) => entry.title), ['Ce que dit la zone', 'Les seuils', 'Ce que fait le bouton']);
  const seuils = RELIABILITY_HELP.entries[1].text;
  for (const seuil of ['plus de 7 jours', '7 derniers jours', 'plus de 48 heures']) assert.ok(seuils.includes(seuil), seuil);
  assert.match(seuils, /ne changent aucun calcul\.$/u);
  for (const { title, text } of RELIABILITY_HELP.entries) {
    assert.match(text, /^[A-ZÀ-Ý«]/u, `${title} : commence par une majuscule`);
    assert.match(text, /\.$/u, `${title} : finit par un point`);
    assert.doesNotMatch(text, /'/u, `${title} : apostrophe typographique`);
  }
});
