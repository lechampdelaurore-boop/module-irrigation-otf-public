import assert from 'node:assert/strict';
import test from 'node:test';
import { remainingUnknowns, settingsGroupsText } from '../lib/domain/onboarding/verification';

/**
 * La vérification finale de l'accueil (4.4, docs/tranche-4-contract.md,
 * F427 ; PR 5b, F589) : ce qui reste inconnu, en mots, avec son lien ; les
 * groupes des réglages, proposés ou confirmés.
 */

const hrefs = { species: '#correspondance-des-especes', plots: '#parcelles-et-abris' };

test('ce qui reste inconnu, avec la conséquence et le lien', () => {
  assert.deepEqual(remainingUnknowns({ speciesToLink: 2, plotsToClassify: 1, soil: { parcels: 3, href: '/irrigation/sol#p' }, hrefs }), [
    { id: 'species', text: '2 espèces non rattachées : besoin non calculé', href: '#correspondance-des-especes' },
    { id: 'plots', text: '1 jardin à classer : besoin non calculé', href: '#parcelles-et-abris' },
    { id: 'soil', text: '3 parcelles sans sol : réserve non calculable', href: '/irrigation/sol#p' },
  ]);
  assert.deepEqual(remainingUnknowns({ speciesToLink: 1, plotsToClassify: 0, soil: null, hrefs }).map((item) => item.text), ['1 espèce non rattachée : besoin non calculé']);
  assert.deepEqual(remainingUnknowns({ speciesToLink: 0, plotsToClassify: 0, soil: { parcels: 0, href: '' }, hrefs }), []);
});

test('chaque groupe des réglages dit s’il est confirmé, passé ou seulement proposé', () => {
  assert.deepEqual(settingsGroupsText([
    { id: 'abris', label: 'Abris', answer: 'validated' },
    { id: 'gel', label: 'Gel', answer: 'skipped' },
    { id: 'planning', label: 'Planning', answer: null },
  ]), ['Abris : confirmé', 'Gel : passé, valeurs proposées', 'Planning : proposé']);
});
