import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record';
import { CANCEL_CONFIRMATION, DONE_OTHERWISE, lateQuestion, todayCardActions } from '../lib/domain/today/card-action';
import { lateIrrigationLines, todayTodoLines, type TodayIrrigationLine } from '../lib/domain/today/today-irrigations';

/**
 * Simplifier l'usage du module, lot S2, PR 3 : l'arrosage à rattraper
 * (docs/simplification-s2-contract.md, section 4). La carte ne devine pas :
 * « Je le fais maintenant » (le démarrage, principal) et « C'est fait »
 * (l'enregistrement « tel que prévu », de même taille, seulement quand la
 * règle de « Tout est fait » l'accepte) ; « Ne pas le faire » rangé et
 * confirmé. Les écritures, sur les vrais services à deux fermes :
 * `tests/db/simplification-s2-a-rattraper.test.ts`.
 */

const ALL: FeatureId[] = [...FEATURE_IDS];
const NOW = new Date('2026-11-12T09:00:00.000Z');
const TODAY = '2026-11-12';
const BEDS = new Map([['b1', 'P1']]);
const CONFIRMATION = 'Enregistrer comme faite Goutte-à-goutte B · Réglage 1, hier de 6 h à 7 h, 600 L ? Elle ne se corrigera plus dans le module.';

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

function late(events: IrrigationEventRecord[], enabled: FeatureId[] = ALL): TodayIrrigationLine[] {
  return lateIrrigationLines({ enabled, now: NOW, events, lateToleranceMinutes: 30, bedNames: BEDS });
}

const missed = () => late([event('m', '2026-11-11T05:00:00.000Z')])[0];
const lateNow = () => late([event('l', '2026-11-12T08:00:00.000Z', 120)])[0];

test('non fait, créneau passé : « Je le fais maintenant » et « C’est fait » de même taille, « Ne pas le faire » rangé', () => {
  const actions = todayCardActions(missed(), { doneAsPlanned: CONFIRMATION });
  assert.ok(actions);
  assert.equal(actions.primary.label, 'Je le fais maintenant');
  assert.deepEqual(actions.primary.gesture, { kind: 'start', eventEquipmentId: 'm' });
  assert.equal(actions.secondary?.label, 'C’est fait');
  assert.deepEqual(actions.secondary?.gesture, { kind: 'done-as-planned', eventEquipmentId: 'm', confirmation: CONFIRMATION, otherwise: { page: 'arrosages', anchor: 'irrigation-m' } });
  assert.equal(actions.twin, true, 'le seul cas de deux boutons de même taille (S2-a)');
  assert.deepEqual(actions.others.map((choice) => choice.label), ['Ne pas le faire', 'Ouvrir sur « Arrosages »']);
  assert.deepEqual(actions.others[0].gesture, { kind: 'cancel', eventEquipmentId: 'm', confirmation: CANCEL_CONFIRMATION });
  assert.equal(actions.primary.accessibleName, `Je le fais maintenant : Goutte-à-goutte B · Réglage 1, ${missed().time}`);
});

test('« C’est fait » n’existe que si la règle de « Tout est fait » l’accepte : jamais avant la fin du créneau (T15)', () => {
  const withoutRule = todayCardActions(missed());
  assert.equal(withoutRule?.secondary, null);
  assert.equal(withoutRule?.twin, undefined, 'seul, le principal reste un bouton principal');
  const running = todayCardActions(lateNow(), { doneAsPlanned: null });
  assert.equal(running?.primary.label, 'Je le fais maintenant');
  assert.equal(running?.secondary, null);
});

test('« Ne pas le faire » se confirme d’une ligne, qui dit ce que fait le plan', () => {
  assert.deepEqual(CANCEL_CONFIRMATION, {
    title: 'Ne pas le faire ?',
    text: 'Cet arrosage ne sera pas fait. Le module recalcule la semaine.',
    confirmLabel: 'Ne pas le faire',
    cancelLabel: 'Le garder',
  });
});

test('sans « Arrosages » cochée : la carte s’ouvre sur le planning, et la confirmation ne renvoie pas vers une page absente', () => {
  const [line] = late([event('m', '2026-11-11T05:00:00.000Z')], ALL.filter((id) => id !== 'arrosages'));
  const actions = todayCardActions(line, { doneAsPlanned: CONFIRMATION });
  assert.equal(actions?.others[1].label, 'Ouvrir sur « Planning de la semaine »');
  assert.ok(actions?.secondary?.gesture.kind === 'done-as-planned');
  assert.equal(actions.secondary.gesture.otherwise, null);
});

test('la phrase dit le jour et pose la question (section 4)', () => {
  assert.equal(lateQuestion(lateNow(), TODAY), `Prévu à ${lateNow().hour}, pas encore démarré.`);
  assert.equal(lateQuestion(missed(), TODAY), `Prévu hier à ${missed().hour}. L’avez-vous fait ?`);
  const [beforeYesterday] = late([event('a', '2026-11-10T05:00:00.000Z')]);
  assert.equal(lateQuestion(beforeYesterday, TODAY), `Prévu avant-hier à ${beforeYesterday.hour}. L’avez-vous fait ?`);
  const [older] = late([event('o', '2026-11-08T05:00:00.000Z')]);
  assert.equal(lateQuestion(older, TODAY), `Prévu dim. 8 nov. à ${older.hour}. L’avez-vous fait ?`);
  const [today] = late([event('t', '2026-11-12T05:00:00.000Z')]);
  assert.equal(today.tone, 'missed');
  assert.equal(lateQuestion(today, TODAY), `Prévu à ${today.hour}. L’avez-vous fait ?`);
  const [planned] = todayTodoLines({ enabled: ALL, now: NOW, events: [event('p', '2026-11-12T15:00:00.000Z')], lateToleranceMinutes: 30, bedNames: BEDS, proposals: [] });
  assert.equal(lateQuestion(planned, TODAY), null);
});

test('l’interface : « C’est fait » passe par sa confirmation, qui gagne la ligne « Fait autrement » ; « Ne pas le faire » par la sienne', () => {
  const day = readFileSync('app/irrigation/today/today-day.tsx', 'utf8');
  assert.match(day, /if \(choice\.kind === 'done-as-planned'\) \{\n\s+setDoneAsked\(choice\);\n\s+return;/, 'rien n’est écrit au premier appui');
  assert.match(day, /onAllDone\(\[id\], irrigationReply\(id\)\)/, 'la règle et la fonction de « Fait comme prévu », inchangées');
  assert.match(day, /\{DONE_OTHERWISE\.text\}\{' '\}\n\s+<a href=\{pageHref\(doneAsked\.otherwise\.page, query, doneAsked\.otherwise\.anchor\)\}>\{DONE_OTHERWISE\.link\}<\/a>/);
  assert.deepEqual(DONE_OTHERWISE, { text: 'Fait autrement (une autre durée, un autre moment) ?', link: 'Notez-le sur « Arrosages »' });
  assert.match(day, /choice\.kind === 'cancel' && !await confirm\(\{ \.\.\.choice\.confirmation, tone: 'erase' \}\)/);
  assert.match(day, /<p className="today-late-question">\{question\}<\/p>/);
  assert.doesNotMatch(day, /function LateActions|Démarrer maintenant|DoneAsPlannedButton/, 'les anciens gestes de la carte sont partis');
  assert.match(day, /twin \? 'today-card-twin'/);
  const page = readFileSync('app/irrigation/today/today-page.tsx', 'utf8');
  assert.match(page, /: cancelPlannedIrrigationAction;/, 'l’annulation d’« Arrosages », la même');
  const css = readFileSync('app/irrigation/styles/today-day.css', 'utf8');
  assert.match(css, /\.today-page button\.today-card-twin \{\n\s+min-height: 50px;/, 'de même taille que le bouton principal');
});
