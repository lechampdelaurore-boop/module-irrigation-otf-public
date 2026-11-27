import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record';
import type { StoredProposal } from '../lib/domain/planning/contract';
import {
  OTHER_CHOICES_LABEL,
  REFUSE_CONFIRMATION,
  refusalReply,
  todayCardActions,
  validateAndStartReply,
  validationReply,
} from '../lib/domain/today/card-action';
import { lateIrrigationLines, todayTodoLines, type TodayIrrigationLine } from '../lib/domain/today/today-irrigations';
import { oneValidation, validateThenStart } from '../app/irrigation/today/card-gestures';
import { DAY_REPLY, irrigationReply, isCardReply, proposalReply } from '../app/irrigation/today/today-replies';

/**
 * Simplifier l'usage du module, lot S2, PR 1 : valider et démarrer depuis la
 * carte (docs/simplification-s2-contract.md, sections 3 et 5).
 *
 * La règle du bouton unique vit dans `lib/domain/today/card-action.ts` : une
 * proposition dit « Valider », un lien « Démarrer tout de suite » et, dans
 * « Autres choix », « Changer l'heure ou la dose » et « Pas à cette heure » ;
 * une irrigation planifiée dit « Démarrer », et « Modifier ou annuler » dans
 * « Autres choix ». Chaque geste est l'action du planning ou d'« Arrosages »,
 * la même : la composition « valider puis démarrer » est jouée ici sur des
 * étapes simulées, et dans `tests/db/simplification-s2-carte.test.ts` sur les
 * vrais services, à deux fermes.
 */

const ALL: FeatureId[] = [...FEATURE_IDS];
const NOW = new Date('2026-11-12T05:00:00.000Z');
const BEDS = new Map([['b1', 'P1'], ['b2', 'P2']]);

function event(id: string, startAt: string, minutes = 60): IrrigationEventRecord {
  const endAt = new Date(Date.parse(startAt) + minutes * 60_000).toISOString();
  return {
    id: `event-${id}`, season: 2026, status: 'planned', note: null, remainingCanceledAt: null, canceledAt: null,
    createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z',
    equipment: {
      id, status: 'planned', plannedStartAt: startAt, plannedEndAt: endAt, plannedDurationSeconds: minutes * 60,
      timerState: null, timerStartedAt: null, remainingCanceledAt: null, canceledAt: null,
      equipmentSnapshot: { id: 'eq', name: 'Goutte-à-goutte B', kind: 'drip', mobility: 'fixed' },
      settingSnapshot: { name: 'Réglage 1' },
      applications: [{ otfBedId: 'b1', plannedAmountMm: 12 }],
    },
  } as unknown as IrrigationEventRecord;
}

function proposal(storedId: string, startAt: string): StoredProposal {
  return {
    storedId, status: 'proposed', startAt, endAt: new Date(Date.parse(startAt) + 3600_000).toISOString(), durationSeconds: 3600,
    doseMm: 8, equipmentName: 'Asperseur A', settingName: 'Buse 2', applications: [{ otfBedId: 'b2' }],
  } as unknown as StoredProposal;
}

function todo(events: IrrigationEventRecord[], proposals: StoredProposal[], enabled: FeatureId[] = ALL): TodayIrrigationLine[] {
  return todayTodoLines({ enabled, now: NOW, events, lateToleranceMinutes: 30, bedNames: BEDS, proposals });
}

const summary = (line: TodayIrrigationLine) => {
  const actions = todayCardActions(line);
  if (!actions) return null;
  return {
    primary: `${actions.primary.label} → ${actions.primary.gesture.kind}`,
    secondary: actions.secondary ? `${actions.secondary.label} → ${actions.secondary.gesture.kind}` : null,
    others: actions.others.map((choice) => `${choice.label} → ${choice.gesture.kind === 'open' ? `${choice.gesture.page}#${choice.gesture.anchor}` : choice.gesture.kind}`),
  };
};

test('section 3 : une proposition porte « Valider », « Démarrer tout de suite » et, rangés, « Changer l’heure ou la dose » et « Pas à cette heure »', () => {
  const [line] = todo([], [proposal('p20', '2026-11-12T17:00:00.000Z')]);
  assert.equal(line.tone, 'proposed');
  assert.equal(line.proposalId, 'p20');
  assert.equal(line.eventEquipmentId, null);
  assert.deepEqual(summary(line), {
    primary: 'Valider → validate',
    secondary: 'Démarrer tout de suite → validate-and-start',
    others: ['Changer l’heure ou la dose → semaine#proposal-p20', 'Pas à cette heure → refuse'],
  });
  const actions = todayCardActions(line);
  assert.ok(actions);
  assert.deepEqual(actions.primary.gesture, { kind: 'validate', proposalId: 'p20' });
  assert.deepEqual(actions.secondary?.gesture, { kind: 'validate-and-start', proposalId: 'p20' });
  // Le nom complet reste lu par un lecteur d'écran.
  assert.equal(actions.primary.accessibleName, 'Valider : Asperseur A · Buse 2, 18 h');
  assert.equal(OTHER_CHOICES_LABEL, 'Autres choix');
});

test('section 3 : une irrigation planifiée porte « Démarrer », et « Modifier ou annuler sur « Arrosages » » rangé ; sans « Arrosages », le planning', () => {
  const [line] = todo([event('e7', '2026-11-12T15:00:00.000Z')], []);
  assert.equal(line.tone, 'planned');
  assert.equal(line.proposalId, null);
  assert.deepEqual(summary(line), {
    primary: 'Démarrer → start',
    secondary: null,
    others: ['Modifier ou annuler sur « Arrosages » → arrosages#irrigation-e7'],
  });
  assert.equal(todayCardActions(line)?.primary.accessibleName, 'Démarrer : Goutte-à-goutte B · Réglage 1, 16 h');
  const [onPlanning] = todo([event('e7', '2026-11-12T15:00:00.000Z')], [], ALL.filter((feature) => feature !== 'arrosages'));
  assert.deepEqual(summary(onPlanning)?.others, ['Ouvrir sur « Semaine » → semaine#irrigation-e7']);
});

test('un seul bouton principal par carte, jamais deux ; « Valider » et « Démarrer » ne sont jamais des liens', () => {
  const lines = todo([event('e7', '2026-11-12T15:00:00.000Z'), event('e8', '2026-11-12T16:00:00.000Z')], [proposal('p20', '2026-11-12T17:00:00.000Z')]);
  for (const line of lines) {
    const actions = todayCardActions(line);
    assert.ok(actions, line.key);
    assert.notEqual(actions.primary.gesture.kind, 'open', 'le bouton principal fait le geste, sur la page');
    const labels = [actions.primary, actions.secondary, ...actions.others].filter((choice) => choice !== null).map((choice) => choice.label);
    assert.equal(new Set(labels).size, labels.length, 'aucun geste en double sur la carte');
  }
});

test('les irrigations en retard ou non faites ont leur carte depuis la PR 3 du lot (tests/simplification-s2-a-rattraper.test.ts)', () => {
  const late = lateIrrigationLines({ enabled: ALL, now: NOW, events: [event('e1', '2026-11-11T05:00:00.000Z'), event('e2', '2026-11-12T04:00:00.000Z', 120)], lateToleranceMinutes: 30, bedNames: BEDS });
  assert.deepEqual(late.map((line) => line.tone), ['missed', 'late']);
  for (const line of late) assert.equal(todayCardActions(line)?.primary.label, 'Je le fais maintenant');
});

test('section 5 : « Pas à cette heure » se confirme d’une ligne, qui dit ce que fait le plan (D-030, S2-b)', () => {
  const [line] = todo([], [proposal('p20', '2026-11-12T17:00:00.000Z')]);
  const refuse = todayCardActions(line)?.others.find((choice) => choice.gesture.kind === 'refuse');
  assert.ok(refuse && refuse.gesture.kind === 'refuse');
  assert.deepEqual(refuse.gesture.confirmation, REFUSE_CONFIRMATION);
  assert.equal(REFUSE_CONFIRMATION.text, 'Le module cherchera une autre place pour cet arrosage.');
  assert.doesNotMatch(JSON.stringify(todayCardActions(line)), /Pas aujourd’hui/, 'le mot écarté par le contrat');
  assert.deepEqual(refusalReply(true), { tone: 'notice', text: 'Heure refusée : le module cherche une autre place pour cet arrosage.', eventEquipmentId: null });
  assert.equal(refusalReply(false).text, 'Cette proposition avait déjà été décidée.');
});

test('section 5 : la réponse d’une validation ; un refus de garde garde son motif, une réserve se dit à côté', () => {
  assert.deepEqual(validationReply({ ok: true, eventEquipmentId: 'ee1' }), { tone: 'notice', text: 'Validé : l’arrosage est planifié.', eventEquipmentId: 'ee1' });
  assert.deepEqual(
    validationReply({ ok: true, eventEquipmentId: 'ee1', warning: 'Ce matériel possède déjà une irrigation planifiée sur ce créneau.' }).text,
    'Validé : l’arrosage est planifié. Ce matériel possède déjà une irrigation planifiée sur ce créneau.',
  );
  assert.deepEqual(validationReply({ ok: false, message: 'Le créneau de cette proposition est passé : recalculez le plan.' }), {
    tone: 'error', text: 'Le créneau de cette proposition est passé : recalculez le plan.', eventEquipmentId: null,
  });
});

test('S2-c : « Démarrer tout de suite » ; un démarrage refusé après la validation le dit sans détour, rien n’est annulé', () => {
  const validated = { ok: true as const, eventEquipmentId: 'ee1' };
  assert.deepEqual(validateAndStartReply(validated, { ok: true, message: 'L’irrigation a démarré.' }), { tone: 'notice', text: 'Validé. L’irrigation a démarré.', eventEquipmentId: 'ee1' });
  assert.deepEqual(validateAndStartReply(validated, { ok: false, message: 'La limite journalière du 12 novembre serait dépassée.' }), {
    tone: 'error',
    text: 'Validé, mais pas démarré : La limite journalière du 12 novembre serait dépassée. L’arrosage reste planifié.',
    eventEquipmentId: 'ee1',
  });
  assert.deepEqual(validateAndStartReply({ ok: false, message: 'Cette proposition a déjà été validée.' }, null), {
    tone: 'error', text: 'Cette proposition a déjà été validée.', eventEquipmentId: null,
  });
});

test('S2-c : la composition valide d’abord, ne démarre que l’irrigation créée, et jamais sans validation', async () => {
  const calls: string[] = [];
  const ok = await validateThenStart({
    validate: async () => { calls.push('valider'); return { ok: true, results: [{ ok: true, eventEquipmentId: 'ee9' }] }; },
    start: async (id) => { calls.push(`démarrer ${id}`); return { ok: true, message: 'L’irrigation a démarré.' }; },
  });
  assert.deepEqual(calls, ['valider', 'démarrer ee9']);
  assert.deepEqual(ok, { validation: { ok: true, eventEquipmentId: 'ee9', warning: undefined }, start: { ok: true, message: 'L’irrigation a démarré.' } });

  calls.length = 0;
  const refused = await validateThenStart({
    validate: async () => { calls.push('valider'); return { ok: true, results: [{ ok: false, message: 'Cette proposition a été refusée.' }] }; },
    start: async (id) => { calls.push(`démarrer ${id}`); return { ok: true, message: '' }; },
  });
  assert.deepEqual(calls, ['valider'], 'aucun démarrage sans validation');
  assert.deepEqual(refused, { validation: { ok: false, message: 'Cette proposition a été refusée.' }, start: null });

  assert.deepEqual(oneValidation({ ok: false, message: 'Votre session a expiré.' }), { ok: false, message: 'Votre session a expiré.' });
  assert.deepEqual(oneValidation({ ok: true, results: [] }), { ok: false, message: 'Choisissez une proposition.' });
});

test('L4 tient : la réponse d’une proposition a son endroit ; validée, elle suit l’irrigation ; partie, en tête du bloc', () => {
  assert.equal(proposalReply('p20'), 'proposition:p20');
  assert.ok(isCardReply(proposalReply('p20')));
  assert.ok(isCardReply(irrigationReply('e7')));
  assert.ok(!isCardReply(DAY_REPLY));
  const page = readFileSync('app/irrigation/today/today-page.tsx', 'utf8');
  assert.match(page, /const origin = result\.eventEquipmentId \? irrigationReply\(result\.eventEquipmentId\) : proposalReply\(gesture\.proposalId\);/);
  const day = readFileSync('app/irrigation/today/today-day.tsx', 'utf8');
  assert.match(day, /isCardReply\(reply\.origin\) && !cards\.has\(reply\.origin\) \? \{ \.\.\.reply, origin: DAY_REPLY \}/);
});

test('le dessin : la carte dessine ce que dit la règle, sans rien décider ; « Autres choix » déplie sa liste, Échap la referme', () => {
  const day = readFileSync('app/irrigation/today/today-day.tsx', 'utf8');
  assert.match(day, /const actions = todayCardActions\(line, \{ doneAsPlanned \}\);/);
  assert.match(day, /<CardChoice choice=\{actions\.primary\} query=\{query\} pending=\{pending\} onGesture=\{onGesture\} primary \/>/);
  assert.doesNotMatch(day, /Valider au planning/);
  // « Pas à cette heure » passe par la confirmation avant d'écrire.
  assert.match(day, /choice\.kind === 'refuse' && !await confirm\(/);
  const choices = readFileSync('app/irrigation/today/other-choices.tsx', 'utf8');
  assert.match(choices, /aria-expanded=\{open\}/);
  assert.match(choices, /event\.key !== 'Escape'/);
  assert.match(choices, /toggle\.current\?\.focus\(\)/, 'Échap rend le focus au bouton');
  assert.match(choices, /closest\('a, button'\)\) setOpen\(false\)/, 'un choix referme la liste');
  // Pendant un geste, tous les boutons de la page sont désactivés.
  assert.match(choices, /disabled=\{pending\}/);
  assert.match(day, /disabled=\{pending\}\n {6}aria-label=\{choice\.accessibleName\}/);
  // Le focus revient au nouveau bouton principal de la carte.
  const page = readFileSync('app/irrigation/today/today-page.tsx', 'utf8');
  assert.match(page, /\[data-irrigation="\$\{id\}"\] \[data-primary\]/);
});

test('les actions de la carte sont celles du planning et d’« Arrosages » : aucune règle nouvelle', () => {
  const actions = readFileSync('app/irrigation/today-card-actions.ts', 'utf8');
  assert.match(actions, /validatePlanProposalsAction\(\{ season: input\.season, proposalIds: \[input\.proposalId\] \}\)/);
  assert.match(actions, /startIrrigationEventAction\(eventEquipmentId\)/);
  assert.match(actions, /refusePlanProposalAction\(\{ season: input\.season, proposalId: input\.proposalId \}\)/);
  assert.doesNotMatch(actions, /from '@\/db\//, 'aucune lecture ni écriture directe de la base');
});
