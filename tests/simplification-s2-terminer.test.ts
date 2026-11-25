import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FEATURE_IDS } from '../lib/domain/features/catalogue';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record';
import { CLOSE_THE_VALVE, eventReply, nowCountdownText, todayNowActions } from '../lib/domain/today/card-action';
import { nowIrrigationLines, type TodayNowLine } from '../lib/domain/today/now-irrigations';

/**
 * Simplifier l'usage du module, lot S2, PR 2 : terminer, mettre en pause,
 * reprendre depuis la carte (docs/simplification-s2-contract.md, sections 3
 * et 6). La règle du bouton vit dans `lib/domain/today/card-action.ts` ; les
 * écritures sont celles d'« Arrosages », jouées sur les vrais services dans
 * `tests/db/simplification-s2-terminer.test.ts`.
 */

const NOW = new Date('2026-11-19T09:30:00.000Z');
const BEDS = new Map([['b1', 'P1']]);

function irrigation(id: string, equipment: Record<string, unknown>, status = 'in_progress'): IrrigationEventRecord {
  return {
    id: `event-${id}`, season: 2026, status, note: null, remainingCanceledAt: null, canceledAt: null,
    createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z',
    equipment: {
      id, status, plannedStartAt: '2026-11-19T08:40:00.000Z', plannedEndAt: '2026-11-19T09:40:00.000Z', plannedDurationSeconds: 3600,
      timerState: null, timerStartedAt: null, timerResumedAt: null, timerPausedAt: null, timerAccumulatedSeconds: 0, timerTheoreticalEndAt: null,
      actualStartAt: null, remainingCanceledAt: null, canceledAt: null,
      equipmentSnapshot: { id: 'eq', name: 'Goutte-à-goutte B', kind: 'drip', mobility: 'fixed' },
      settingSnapshot: { name: 'Réglage 1' },
      applications: [{ otfBedId: 'b1', plannedAmountMm: 10, actualAmountMm: null }],
      ...equipment,
    },
  } as unknown as IrrigationEventRecord;
}

const running = irrigation('r', { timerState: 'running', timerStartedAt: '2026-11-19T09:00:00.000Z', timerResumedAt: '2026-11-19T09:00:00.000Z', timerTheoreticalEndAt: '2026-11-19T10:00:00.000Z' });
const paused = irrigation('p', { timerState: 'paused', timerStartedAt: '2026-11-19T08:00:00.000Z', timerPausedAt: '2026-11-19T09:05:00.000Z', timerAccumulatedSeconds: 1200 });
const finished = irrigation('f', { timerState: 'running', timerStartedAt: '2026-11-19T08:00:00.000Z', timerResumedAt: '2026-11-19T08:00:00.000Z', timerTheoreticalEndAt: '2026-11-19T09:00:00.000Z' });
const remainder = irrigation('q', { status: 'partially_completed' }, 'partially_completed');

function line(event: IrrigationEventRecord): TodayNowLine {
  const [found] = nowIrrigationLines({ enabled: [...FEATURE_IDS], now: NOW, events: [event], bedNames: BEDS });
  assert.ok(found, event.equipment.id);
  return found;
}

const labels = (current: TodayNowLine) => {
  const actions = todayNowActions(current);
  return [actions.primary.label, actions.secondary?.label ?? null, actions.others.map((choice) => choice.label)];
};

test('le bouton de chaque carte qui coule ou attend d’être reprise (section 3, tableau)', () => {
  assert.deepEqual(labels(line(running)), ['Terminer', null, ['Mettre en pause', 'Ouvrir sur « Arrosages »']]);
  assert.deepEqual(labels(line(paused)), ['Reprendre', 'Terminer', ['Ouvrir sur « Arrosages »']]);
  assert.deepEqual(labels(line(finished)), ['Terminer', null, ['Ouvrir sur « Arrosages »']]);
  // Le mot de S1 (F836) prime sur « Reprendre le reliquat » du contrat S2.
  assert.deepEqual(labels(line(remainder)), ['Reprendre ce qui reste', null, ['Ouvrir sur « Arrosages »']]);
});

test('les gestes : la fin passe par sa fenêtre, l’heure proposée est celle de la pause ; le nom complet est lu', () => {
  assert.deepEqual(todayNowActions(line(running)).primary.gesture, { kind: 'finish', eventEquipmentId: 'r', equipmentName: 'Goutte-à-goutte B', suggestedEndAt: null });
  assert.deepEqual(todayNowActions(line(paused)).secondary?.gesture, { kind: 'finish', eventEquipmentId: 'p', equipmentName: 'Goutte-à-goutte B', suggestedEndAt: '2026-11-19T09:05:00.000Z' });
  assert.deepEqual(todayNowActions(line(running)).others[0].gesture, { kind: 'pause', eventEquipmentId: 'r' });
  assert.deepEqual(todayNowActions(line(paused)).primary.gesture, { kind: 'resume', eventEquipmentId: 'p' });
  assert.deepEqual(todayNowActions(line(remainder)).primary.gesture, { kind: 'start', eventEquipmentId: 'q' });
  assert.deepEqual(todayNowActions(line(running)).others[1].gesture, { kind: 'open', page: 'arrosages', anchor: 'irrigation-r' });
  assert.equal(todayNowActions(line(running)).primary.accessibleName, 'Terminer : Goutte-à-goutte B · Réglage 1');
});

test('le compte à rebours se lit sur le minuteur, à la minute supérieure ; la durée atteinte dit de fermer la vanne', () => {
  const current = line(running);
  assert.equal(nowCountdownText(current, NOW), 'Reste 30 min');
  assert.equal(nowCountdownText(current, new Date('2026-11-19T09:59:01.000Z')), 'Reste 1 min', 'jamais « 0 min »');
  assert.equal(nowCountdownText(current, new Date('2026-11-19T08:30:00.000Z')), 'Reste 1 h', 'avant le départ, la durée entière');
  assert.equal(nowCountdownText(current, new Date('2026-11-19T10:00:00.000Z')), CLOSE_THE_VALVE, 'la durée atteinte entre deux relectures');
  assert.equal(nowCountdownText(line(finished), NOW), CLOSE_THE_VALVE);
  assert.equal(CLOSE_THE_VALVE, 'Fermez la vanne, puis appuyez sur « Terminer ».');
  assert.equal(nowCountdownText(line(paused), NOW), null);
  assert.equal(nowCountdownText(line(remainder), NOW), null);
  assert.equal(line(finished).detail, 'depuis 9 h', 'la consigne n’est plus répétée dans le détail');
});

test('la réponse d’un geste reste sous la carte de l’irrigation, un refus aussi', () => {
  assert.deepEqual(eventReply('r', { ok: true, message: 'L’irrigation a repris.', warning: 'Pompe non vérifiée.' }), { tone: 'notice', text: 'L’irrigation a repris. Pompe non vérifiée.', eventEquipmentId: 'r' });
  assert.deepEqual(eventReply('r', { ok: false, message: 'Ce matériel est déjà utilisé par une irrigation en cours.' }), { tone: 'error', text: 'Ce matériel est déjà utilisé par une irrigation en cours.', eventEquipmentId: 'r' });
});

test('l’interface : la carte dessine les gestes du domaine ; la fenêtre de fin est celle d’« Arrosages », par le nom du matériel', () => {
  const day = readFileSync('app/irrigation/today/today-day.tsx', 'utf8');
  const nowCard = day.slice(day.indexOf('function NowCard('), day.indexOf('function OneButtonActions('));
  assert.match(nowCard, /todayNowActions\(line\)/);
  assert.match(nowCard, /nowCountdownText\(line, now\)/);
  assert.doesNotMatch(nowCard, /Terminer l’irrigation|Arrêter ou terminer/, 'plus de lien vers « Arrosages » pour finir');
  assert.match(day, /<FinishIrrigationDialog\s+equipmentName=\{finishing\.equipmentName\}/);
  assert.match(day, /finishValueToSend\(finishing\.finishAt, finishing\.precise\)/, 'la seconde du minuteur gardée, comme sur « Arrosages » (F472)');
  assert.match(day, /\.then\(\(\) => setFinishing\(null\)\)/, 'fermée à la réponse, même refusée : le motif se lit sous la carte, pas derrière la fenêtre');
  const dialog = readFileSync('app/irrigation/irrigation-manager/finish-irrigation-dialog.tsx', 'utf8');
  assert.doesNotMatch(dialog, /IrrigationEventRecord/, 'la fenêtre ne dépend plus de la fiche entière');
  assert.match(readFileSync('app/irrigation/irrigation-event-manager.tsx', 'utf8'), /equipmentName=\{finishEvent\.equipment\.equipmentSnapshot\.name\}/);
  const page = readFileSync('app/irrigation/today/today-page.tsx', 'utf8');
  for (const action of ['finishIrrigationEventAction', 'pauseIrrigationEventAction', 'resumeIrrigationEventAction']) assert.match(page, new RegExp(action), action);
  // Le compte à rebours ne se dit qu'une fois dans le navigateur : pas d'écart entre le rendu du serveur et l'hydratation.
  assert.match(readFileSync('app/irrigation/today/use-card-clock.ts', 'utf8'), /useSyncExternalStore\(subscribe, snapshot, serverSnapshot\)/);
});
