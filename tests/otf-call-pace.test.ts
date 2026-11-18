import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_CALL_PACE,
  holdCallsUntil,
  nextCallSlot,
  OTF_CALLS_PER_MINUTE,
  OTF_MINUTE_LIMIT_MAX_WAIT_MS,
  recordCallStart,
  type CallPaceState,
} from '../lib/domain/otf/call-pace.ts';

// L'espacement du connecteur : 250 ms et sa marge (lib/adapters/otf/read-client.ts).
const SPACING_MS = 255;

function stateAfter(starts: readonly number[]): CallPaceState {
  return starts.reduce((state, startedAt) => recordCallStart(state, startedAt), EMPTY_CALL_PACE);
}

function fullMinuteFrom(firstStart: number): number[] {
  return Array.from({ length: OTF_CALLS_PER_MINUTE }, (_, index) => firstStart + index * SPACING_MS);
}

test('un premier appel part tout de suite ; le suivant attend l’espacement (F334)', () => {
  assert.deepEqual(nextCallSlot(EMPTY_CALL_PACE, 10_000, SPACING_MS), { kind: 'start-at', at: 10_000 });
  const state = recordCallStart(EMPTY_CALL_PACE, 10_000);
  assert.deepEqual(nextCallSlot(state, 10_100, SPACING_MS), { kind: 'start-at', at: 10_255 });
  assert.deepEqual(nextCallSlot(state, 20_000, SPACING_MS), { kind: 'start-at', at: 20_000 });
});

test('après une limite atteinte chez OTF, rien ne part avant la fin de la pause', () => {
  const state = holdCallsUntil(recordCallStart(EMPTY_CALL_PACE, 10_000), 11_000);
  assert.deepEqual(nextCallSlot(state, 10_300, SPACING_MS), { kind: 'start-at', at: 11_000 });
  // Une pause plus courte ne raccourcit pas celle qui court.
  assert.equal(holdCallsUntil(state, 10_500).notBefore, 11_000);
});

test('trente départs par minute au plus : le trente et unième attend qu’une place se libère, cinq secondes au plus', () => {
  const starts = fullMinuteFrom(100_000);
  const askedAt = starts[0] + 57_000;
  const slot = nextCallSlot(stateAfter(starts), askedAt, SPACING_MS);

  assert.equal(slot.kind, 'start-at');
  if (slot.kind !== 'start-at') return;
  assert.ok(slot.at - starts[0] > 60_000, 'plus d’une minute après le premier des trente');
  assert.ok(slot.at - askedAt <= OTF_MINUTE_LIMIT_MAX_WAIT_MS, `attente : ${slot.at - askedAt} ms`);
});

test('quand la place se libère dans plus de cinq secondes, l’appel est refusé et rien n’est compté', () => {
  const starts = fullMinuteFrom(100_000);
  const full = stateAfter(starts);
  const askedAt = starts[starts.length - 1] + SPACING_MS;
  const slot = nextCallSlot(full, askedAt, SPACING_MS);

  assert.equal(slot.kind, 'refused');
  if (slot.kind !== 'refused') return;
  assert.ok(slot.minuteFreesAt - askedAt > OTF_MINUTE_LIMIT_MAX_WAIT_MS);
  // Le refus est un calcul : l'état du régulateur ne bouge pas.
  assert.deepEqual(full, stateAfter(starts));
});

test('les départs de plus d’une minute ne comptent plus', () => {
  const starts = fullMinuteFrom(100_000);
  const later = starts[0] + 62_000;
  const state = stateAfter(starts);

  assert.deepEqual(nextCallSlot(state, later, SPACING_MS), { kind: 'start-at', at: later });
  const after = recordCallStart(state, later);
  assert.ok(after.recentStarts.length <= OTF_CALLS_PER_MINUTE);
  assert.ok(!after.recentStarts.includes(starts[0]), 'le premier départ est oublié');
  assert.equal(after.recentStarts[after.recentStarts.length - 1], later);
});

test('un appelant qui insiste ne dépasse jamais quatre départs par seconde ni trente par minute', () => {
  let state = EMPTY_CALL_PACE;
  let now = 0;
  const starts: number[] = [];
  while (starts.length < 200) {
    const slot = nextCallSlot(state, now, SPACING_MS);
    if (slot.kind === 'refused') {
      // Il revient dès que la place se libère dans cinq secondes.
      now = slot.minuteFreesAt - OTF_MINUTE_LIMIT_MAX_WAIT_MS;
      continue;
    }
    now = slot.at;
    state = recordCallStart(state, now);
    starts.push(now);
  }

  for (let index = 0; index + 4 < starts.length; index += 1) {
    assert.ok(starts[index + 4] - starts[index] > 1_000, `cinq départs en ${starts[index + 4] - starts[index]} ms`);
  }
  for (let index = 0; index + OTF_CALLS_PER_MINUTE < starts.length; index += 1) {
    const span = starts[index + OTF_CALLS_PER_MINUTE] - starts[index];
    assert.ok(span > 60_000, `trente et un départs en ${span} ms`);
  }
});
