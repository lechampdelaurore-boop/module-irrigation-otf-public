import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ONBOARDING_STEP_IDS,
  onboardingExplanation,
  onboardingSummary,
  resolveOnboarding,
  verificationLine,
  type StoredOnboardingStep,
} from '../lib/domain/onboarding/steps';

// L'état de l'accueil d'une ferme (4.4, docs/tranche-4-contract.md, F417, F426, F427, F581).

const BEFORE: StoredOnboardingStep[] = ONBOARDING_STEP_IDS.map((step) => ({
  step,
  state: 'confirmed',
  origin: 'before-onboarding',
  confirmedAt: '2026-11-20T09:00:00.000Z',
}));

test('un espace sans ligne commence l’accueil : chaque étape est à faire, rien n’est confirmé à sa place (F417)', () => {
  const resolved = resolveOnboarding({ kind: 'stored', steps: [] });
  assert.equal(resolved.kind, 'onboarding');
  assert.deepEqual(resolved.kind === 'onboarding' ? resolved.steps.map((step) => [step.id, step.state, step.origin]) : null, [
    ['location', 'todo', 'onboarding'],
    ['plots', 'todo', 'onboarding'],
    ['soil', 'todo', 'onboarding'],
    ['crops', 'todo', 'onboarding'],
    ['settings', 'todo', 'onboarding'],
  ]);
  assert.equal(resolved.kind === 'onboarding' ? resolved.remaining.length : null, 5);
});

test('un espace d’avant la 4.4 : ses cinq étapes confirmées d’avant l’accueil, gardées telles quelles (F426)', () => {
  const resolved = resolveOnboarding({ kind: 'stored', steps: BEFORE });
  assert.equal(resolved.kind, 'before-onboarding');
  if (resolved.kind !== 'before-onboarding') return;
  assert.ok(resolved.steps.every((step) => step.state === 'confirmed' && step.origin === 'before-onboarding'));
  assert.deepEqual(resolved.steps.map(verificationLine).map((line) => [line.tone, line.text]), Array(5).fill(['confirmed', 'Réglage d’avant l’accueil, gardé tel quel.']));
  assert.equal(onboardingSummary(resolved), 'Fait avant l’accueil des nouvelles fermes.');
  assert.equal(onboardingExplanation(resolved), 'Votre ferme utilisait le module avant l’accueil des nouvelles fermes : ses réglages sont gardés tels quels.');
});

test('une ligne d’avant l’accueil qui manque remet l’espace dans l’accueil, au lieu de tenir l’étape pour confirmée', () => {
  const resolved = resolveOnboarding({ kind: 'stored', steps: BEFORE.filter((row) => row.step !== 'soil') });
  assert.equal(resolved.kind, 'onboarding');
  assert.deepEqual(resolved.kind === 'onboarding' ? resolved.remaining.map((step) => step.id) : null, ['soil']);
});

test('une ligne illisible est écartée : son étape reste à faire, jamais confirmée', () => {
  const resolved = resolveOnboarding({
    kind: 'stored',
    steps: [
      { step: 'soil', state: 'validé', origin: 'onboarding', confirmedAt: '2026-11-20T09:00:00.000Z' },
      { step: 'météo', state: 'confirmed', origin: 'onboarding', confirmedAt: '2026-11-20T09:00:00.000Z' },
      { step: 'plots', state: 'confirmed', origin: 'ailleurs', confirmedAt: '2026-11-20T09:00:00.000Z' },
    ],
  });
  assert.equal(resolved.kind, 'onboarding');
  if (resolved.kind !== 'onboarding') return;
  assert.ok(resolved.steps.every((step) => step.state === 'todo'));
});

test('la vérification dit vert le confirmé avec sa date, orange le passé avec sa conséquence, rouge le reste (F427)', () => {
  const resolved = resolveOnboarding({
    kind: 'stored',
    steps: [
      { step: 'location', state: 'confirmed', origin: 'onboarding', confirmedAt: '2026-11-19T23:30:00.000Z' },
      { step: 'soil', state: 'skipped', origin: 'onboarding', confirmedAt: null },
      { step: 'plots', state: 'proposed', origin: 'onboarding', confirmedAt: null },
    ],
  });
  assert.equal(resolved.kind, 'onboarding');
  if (resolved.kind !== 'onboarding') return;
  const lines = Object.fromEntries(resolved.steps.map(verificationLine).map((line) => [line.id, [line.tone, line.text]]));
  assert.deepEqual(lines, {
    // 23 h 30 en temps universel, le 20 novembre à Paris : la date se lit à l'heure de la ferme.
    location: ['confirmed', 'Confirmé le 20 novembre 2026.'],
    plots: ['missing', 'Proposé, à confirmer.'],
    soil: ['skipped', 'Vous n’avez pas confirmé le sol : la réserve utile reste non calculable.'],
    crops: ['missing', 'À faire.'],
    settings: ['missing', 'À faire.'],
  });
  assert.deepEqual(resolved.remaining.map((step) => step.id), ['plots', 'crops', 'settings'], 'confirmé et passé sont finis ; proposé reste à confirmer');
  assert.equal(onboardingSummary(resolved), '3 étapes sur 5 à finir.');
  assert.equal(onboardingExplanation(resolved), 'Les écrans de l’accueil arrivent avec les prochaines versions du module ; rien n’est confirmé à votre place.');
});

test('chaque étape passée dit ce qu’elle laisse de côté ; un accueil fini le dit', () => {
  const skipped = resolveOnboarding({
    kind: 'stored',
    steps: ONBOARDING_STEP_IDS.map((step) => ({ step, state: 'skipped', origin: 'onboarding', confirmedAt: null })),
  });
  assert.equal(skipped.kind, 'onboarding');
  if (skipped.kind !== 'onboarding') return;
  const texts = skipped.steps.map(verificationLine).map((line) => line.text);
  assert.equal(new Set(texts).size, 5, 'une conséquence par étape');
  assert.ok(texts.every((text) => text.startsWith('Vous n’avez pas ')));
  assert.match(texts[4], /aucun planning n’est calculé/, 'sans réglages du planning validés, pas de planning (réponse Q10)');
  assert.equal(onboardingSummary(skipped), 'Accueil terminé.');
  assert.equal(onboardingExplanation(skipped), 'Chaque étape est confirmée ou passée.');
  const one = resolveOnboarding({ kind: 'stored', steps: BEFORE.slice(0, 4).map((row) => ({ ...row, origin: 'onboarding' })) });
  assert.equal(one.kind === 'onboarding' ? onboardingSummary(one) : null, '1 étape sur 5 à finir.');
});

test('la démonstration n’a pas d’accueil', () => {
  assert.deepEqual(resolveOnboarding({ kind: 'demonstration' }), { kind: 'demonstration' });
});
