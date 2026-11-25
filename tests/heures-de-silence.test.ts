import assert from 'node:assert/strict';
import test from 'node:test';
import { validateIrrigationPushAlarmRequest } from '../lib/domain/irrigation-push-contract.ts';
import {
  DEFAULT_QUIET_HOURS,
  isQuietEndTime,
  isQuietStartTime,
  isValidQuietHours,
  QUIET_END_TIMES,
  QUIET_START_TIMES,
  quietHoldAlarmId,
  quietHoursDecision,
  quietWindowDecision,
  type QuietHoursDecision,
  type QuietHoursNotification,
  type QuietHoursSettings,
} from '../lib/domain/notification-quiet-hours.ts';

/**
 * Les heures de silence des notifications, la règle (6 undecies, PR H1 ;
 * docs/heures-de-silence-contract.md, sections 3 et 8 ; D-320) : être dans la
 * plage (S1), rien ne change quand elle est éteinte (S2), ce qui passe
 * toujours (S3), ce qui est retenu jusqu'à la fin (S4), le rappel du soir qui
 * ne part pas (S5), le message du matin retenu (S6), jamais plus d'une plage
 * (S7), un identifiant de retenue par espace (S10), un réglage corrompu
 * ignoré comme éteint (scénario 17). Les scénarios chiffrés du contrat, un par
 * un, à l'heure de Paris.
 */

/** Un espace, tel que la base le crée : un UUID. */
const SPACE_A = '0b8e6c1a-5f0e-4a43-9d64-1c2a7e9f3b10';
const SPACE_B = 'f3d2a9b4-7c61-4e0a-8b5d-2a9c4e7f1d36';

/** Plage 22 h à 6 h, gel qui passe : le réglage des scénarios, sauf mention contraire. */
const NIGHT: QuietHoursSettings = { enabled: true, start: '22:00', end: '06:00', frostPasses: true };

const HEAT: QuietHoursNotification = { kind: 'weather-alert', criterion: { field: 'maximum-temperature', direction: 'above' } };
const RAIN: QuietHoursNotification = { kind: 'weather-alert', criterion: { field: 'precipitation', direction: 'above' } };
const MINIMUM_BELOW: QuietHoursNotification = { kind: 'weather-alert', criterion: { field: 'minimum-temperature', direction: 'below' } };
const CROP_FROST: QuietHoursNotification = { kind: 'crop-alert', alert: 'frost' };

const ALL_KINDS: readonly QuietHoursNotification[] = [
  { kind: 'irrigation-finished' },
  { kind: 'irrigation-late' },
  { kind: 'morning-message' },
  { kind: 'evening-reminder' },
  CROP_FROST,
  { kind: 'crop-alert', alert: 'drying' },
  { kind: 'crop-alert', alert: 'sprinkler' },
  HEAT,
  RAIN,
  MINIMUM_BELOW,
  { kind: 'weather-alert', criterion: { field: 'minimum-temperature', direction: 'above' } },
  { kind: 'weather-alert', criterion: { field: 'maximum-temperature', direction: 'below' } },
  { kind: 'weather-alert', criterion: { field: 'precipitation', direction: 'below' } },
];

const SEND = { action: 'send', defect: null } as const;
const hold = (until: string) => ({ action: 'hold', until }) as const;

// Mardi 24 novembre 2026, heure d'hiver : Paris = UTC + 1 h.
const AT_21_30 = new Date('2026-11-24T20:30:00.000Z');
const AT_22_00 = new Date('2026-11-24T21:00:00.000Z');
const AT_22_30 = new Date('2026-11-24T21:30:00.000Z');
const AT_23_00 = new Date('2026-11-24T22:00:00.000Z');
const NEXT_02_15 = new Date('2026-11-25T01:15:00.000Z');
const NEXT_05_59 = new Date('2026-11-25T04:59:00.000Z');
const NEXT_06_00 = new Date('2026-11-25T05:00:00.000Z');
const NEXT_06_15 = new Date('2026-11-25T05:15:00.000Z');
/** Mercredi 25 novembre, 6 h et 7 h à Paris. */
const UNTIL_06_00 = '2026-11-25T05:00:00.000Z';
const UNTIL_07_00 = '2026-11-25T06:00:00.000Z';

function parisClock(instant: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant));
}

test('les heures offertes : un début de 20 h à 23 h 45 et une fin de 4 h à 9 h, au quart d’heure (S1, choix 3)', () => {
  assert.equal(QUIET_START_TIMES.length, 16);
  assert.equal(QUIET_START_TIMES[0], '20:00');
  assert.equal(QUIET_START_TIMES.at(-1), '23:45');
  assert.equal(QUIET_END_TIMES.length, 21);
  assert.equal(QUIET_END_TIMES[0], '04:00');
  assert.equal(QUIET_END_TIMES.at(-1), '09:00');
  assert.ok(QUIET_START_TIMES.every((time) => /^2[0-3]:(00|15|30|45)$/.test(time)));
  assert.ok(QUIET_END_TIMES.every((time) => /^0[4-9]:(00|15|30|45)$/.test(time)));
  for (const refused of ['19:45', '00:00', '24:00', '22:10', '22:00:00', '9:00', '', null, 22]) assert.equal(isQuietStartTime(refused), false, String(refused));
  for (const refused of ['03:45', '09:15', '10:00', '06:05', '6:00', '22:00', undefined]) assert.equal(isQuietEndTime(refused), false, String(refused));
  assert.ok(isQuietStartTime('20:00') && isQuietStartTime('23:45') && isQuietEndTime('04:00') && isQuietEndTime('09:00'), 'les bornes sont comprises');
});

test('les défauts : éteinte, 22 h à 6 h proposée à l’allumage, le gel qui passe (choix 2, 3 et 5)', () => {
  assert.deepEqual(DEFAULT_QUIET_HOURS, { enabled: false, start: '22:00', end: '06:00', frostPasses: true });
  assert.equal(isValidQuietHours(DEFAULT_QUIET_HOURS), true);
  assert.equal(isValidQuietHours({ ...NIGHT, start: '15:00' }), false);
  assert.equal(isValidQuietHours({ ...NIGHT, end: '10:00' }), false);
  assert.equal(isValidQuietHours({ ...NIGHT, enabled: 1 as unknown as boolean }), false, 'une case est un booléen');
  assert.equal(isValidQuietHours({ ...NIGHT, frostPasses: 'oui' as unknown as boolean }), false);
});

test('scénarios 1 à 4 : début inclus, fin exclue, la fin du lendemain ou du jour même (S1, S4)', () => {
  assert.deepEqual(quietHoursDecision(NIGHT, HEAT, AT_21_30), SEND, '1. chaleur lue à 21 h 30 : hors plage, part à 21 h 30');
  assert.deepEqual(quietHoursDecision(NIGHT, HEAT, AT_22_00), hold(UNTIL_06_00), '2. chaleur lue à 22 h : retenue jusqu’à 6 h le lendemain');
  assert.deepEqual(quietHoursDecision(NIGHT, RAIN, NEXT_05_59), hold(UNTIL_06_00), '3. pluie lue à 5 h 59 : retenue jusqu’à 6 h le même jour');
  assert.deepEqual(quietHoursDecision(NIGHT, RAIN, NEXT_06_00), SEND, '4. pluie lue à 6 h : fin exclue, part tout de suite');
  assert.equal(parisClock(UNTIL_06_00), '25/11 06:00');
  assert.deepEqual(quietHoursDecision(NIGHT, HEAT, new Date('2026-11-24T20:59:59.000Z')), SEND, '21 h 59 : pas encore');
  assert.deepEqual(quietHoursDecision(NIGHT, HEAT, new Date('2026-11-24T23:00:00.000Z')), hold(UNTIL_06_00), 'minuit : retenue jusqu’à 6 h du même jour civil');
});

test('scénarios 5 à 8 : le gel passe tant que sa case est cochée ; seul est du gel la minimale « en dessous de » (S3)', () => {
  assert.deepEqual(quietHoursDecision(NIGHT, CROP_FROST, AT_22_30), SEND, '5. gel par culture à 22 h 30 : part tout de suite');
  assert.deepEqual(quietHoursDecision({ ...NIGHT, frostPasses: false }, CROP_FROST, AT_22_30), hold(UNTIL_06_00), '6. case décochée : retenue jusqu’à 6 h');
  assert.deepEqual(quietHoursDecision(NIGHT, MINIMUM_BELOW, AT_23_00), SEND, '7. minimale en dessous de 2 °C à 23 h : du gel, part');
  assert.deepEqual(quietHoursDecision({ ...NIGHT, frostPasses: false }, MINIMUM_BELOW, AT_23_00), hold(UNTIL_06_00), 'le critère de gel retenu, case décochée');
  assert.deepEqual(quietHoursDecision(NIGHT, HEAT, AT_23_00), hold(UNTIL_06_00), '8. maximale au-dessus de 35 °C : pas du gel, retenue');
  // Le module ne devine pas l'intention de la ferme : aucune autre alerte n'est du gel, même pour un seuil bas.
  for (const notification of ALL_KINDS) {
    const frost: boolean = notification === CROP_FROST || notification === MINIMUM_BELOW;
    const expected: QuietHoursDecision = notification.kind === 'irrigation-finished' || frost ? SEND
      : notification.kind === 'evening-reminder' ? { action: 'skip' } : hold(UNTIL_06_00);
    assert.deepEqual(quietHoursDecision(NIGHT, notification, AT_23_00), expected, JSON.stringify(notification));
  }
});

test('scénario 9 : la fin d’un arrosage démarré part toujours, sans lire le réglage (S3)', () => {
  assert.deepEqual(quietHoursDecision(NIGHT, { kind: 'irrigation-finished' }, NEXT_02_15), SEND, '9. fin d’un minuteur à 2 h 15');
  assert.deepEqual(quietHoursDecision({ ...NIGHT, frostPasses: false }, { kind: 'irrigation-finished' }, NEXT_02_15), SEND);
  assert.deepEqual(quietHoursDecision({ ...NIGHT, start: '15:00' }, { kind: 'irrigation-finished' }, NEXT_02_15), SEND, 'un réglage corrompu ne la touche pas : elle ne le lit pas');
});

test('scénario 10 : le rappel du soir dans la plage ne part pas et n’est pas retenu ; hors de la plage, il part (S5)', () => {
  const evening: QuietHoursNotification = { kind: 'evening-reminder' };
  assert.deepEqual(quietHoursDecision(NIGHT, evening, AT_22_30), { action: 'skip' }, '10. rappel réglé à 22 h 30');
  assert.deepEqual(quietHoursDecision({ ...NIGHT, start: '21:00' }, evening, AT_21_30), { action: 'skip' }, 'rappel de 21 h 30, plage dès 21 h');
  assert.deepEqual(quietHoursDecision(NIGHT, evening, AT_21_30), SEND, 'rappel de 21 h 30, plage dès 22 h');
  assert.deepEqual(quietHoursDecision(DEFAULT_QUIET_HOURS, evening, AT_22_30), SEND, 'plage éteinte');
});

test('scénario 11 : le message du matin composé à 6 h 15, plage de 22 h à 7 h, est retenu jusqu’à 7 h (S4, S6)', () => {
  assert.deepEqual(quietHoursDecision({ ...NIGHT, end: '07:00' }, { kind: 'morning-message' }, NEXT_06_15), hold(UNTIL_07_00));
  assert.equal(parisClock(UNTIL_07_00), '25/11 07:00');
  assert.deepEqual(quietHoursDecision(NIGHT, { kind: 'morning-message' }, NEXT_06_15), SEND, 'plage finie à 6 h : il part');
});

test('le retard d’une irrigation planifiée se juge à l’échéance de son alarme : retenu dans la plage, parti au-dehors (S4)', () => {
  const late: QuietHoursNotification = { kind: 'irrigation-late' };
  assert.deepEqual(quietHoursDecision(NIGHT, late, new Date('2026-11-24T22:15:00.000Z')), hold(UNTIL_06_00), 'échéance à 23 h 15');
  assert.deepEqual(quietHoursDecision(NIGHT, late, new Date('2026-11-25T05:30:00.000Z')), SEND, 'échéance à 6 h 30');
});

test('scénario 12 : plage éteinte ou jamais réglée, rien ne change (S2)', () => {
  for (const settings of [DEFAULT_QUIET_HOURS, { ...NIGHT, enabled: false }, { ...NIGHT, enabled: false, start: '15:00', end: '12:00' }]) {
    for (const notification of ALL_KINDS) {
      for (const at of [AT_21_30, AT_22_00, AT_23_00, NEXT_02_15, NEXT_05_59]) {
        assert.deepEqual(quietHoursDecision(settings, notification, at), SEND, `${JSON.stringify(settings)} ${notification.kind} ${at.toISOString()}`);
      }
    }
  }
});

test('scénario 13 : deux fermes, deux plages ; l’identifiant d’une retenue porte l’espace (S10)', () => {
  const farmA: QuietHoursSettings = { enabled: true, start: '21:00', end: '07:00', frostPasses: true };
  assert.deepEqual(quietHoursDecision(farmA, HEAT, AT_21_30), hold(UNTIL_07_00), 'A : retenue jusqu’à 7 h');
  assert.deepEqual(quietHoursDecision(DEFAULT_QUIET_HOURS, HEAT, AT_21_30), SEND, 'B, sans plage : part à 21 h 30');

  const tag = 'weather-alert:7d0c2f9e-31a4-4b8e-9a51-6f2e8c3d1b07:v12:2026-11-26';
  const idA = quietHoldAlarmId(SPACE_A, tag);
  const idB = quietHoldAlarmId(SPACE_B, tag);
  assert.equal(idA, `quiet:${SPACE_A}:${tag}`);
  assert.notEqual(idA, idB, 'la même alerte dans deux fermes : deux alarmes');
  assert.equal(quietHoldAlarmId(SPACE_A, tag), idA, 'la même étiquette d’une même ferme : une seule alarme, comme aujourd’hui');
  assert.notEqual(quietHoldAlarmId(SPACE_A, `${tag}x`), idA);
  // Le Worker accepte l'alarme, avec la plus longue étiquette d'aujourd'hui (une alerte météo de version à quatre chiffres) et une étiquette de culture.
  for (const someTag of [tag.replace(':v12:', ':v9999:'), 'crop-sprinkler:2026-11-26:1a2b3c4d', 'crop-frost:2026-11-26:suite']) {
    const request = { eventEquipmentId: quietHoldAlarmId(SPACE_A, someTag), recipientKey: SPACE_A, revision: '1795554176408-0b8e6c1a-5f0e-4a43-9d64-1c2a7e9f3b10', dueAt: UNTIL_06_00, notification: { title: 'Alerte météo', body: 'Pluie prévue.', tag: someTag, data: { url: '/irrigation/alertes-meteo' } } };
    assert.deepEqual(validateIrrigationPushAlarmRequest(request), request, someTag);
  }
});

test('une étiquette trop longue pour le Worker est remplacée par son empreinte, toujours propre à l’espace (S10)', () => {
  const longTag = `weather-alert:${'a'.repeat(150)}`;
  const idA = quietHoldAlarmId(SPACE_A, longTag);
  assert.ok(idA.length <= 128, `${idA.length} caractères`);
  assert.match(idA, new RegExp(`^quiet:${SPACE_A}:[0-9a-f]{8}$`));
  assert.equal(quietHoldAlarmId(SPACE_A, longTag), idA, 'stable');
  assert.notEqual(quietHoldAlarmId(SPACE_B, longTag), idA, 'propre à l’espace');
  assert.notEqual(quietHoldAlarmId(SPACE_A, `${longTag}b`), idA, 'propre à l’étiquette');
  assert.ok(validateIrrigationPushAlarmRequest({ eventEquipmentId: idA, recipientKey: SPACE_A, revision: 'r1', dueAt: UNTIL_06_00, notification: { title: 'T', body: 'B', tag: 'crop-frost:2026-11-26:suite', data: { url: '/irrigation' } } }));
});

test('scénario 14 : la nuit du passage à l’heure d’été, la fin reste 6 h à Paris (S1)', () => {
  // Samedi 27 mars 2027, 23 h à Paris (UTC + 1) ; dimanche 28 mars, 6 h à Paris (UTC + 2) : six heures réelles, pas sept.
  const decision = quietHoursDecision(NIGHT, HEAT, new Date('2027-03-27T22:00:00.000Z'));
  assert.deepEqual(decision, hold('2027-03-28T04:00:00.000Z'));
  assert.equal(parisClock('2027-03-28T04:00:00.000Z'), '28/03 06:00');
});

test('la nuit du passage à l’heure d’hiver, la fin reste aussi à l’heure de Paris, et la plage la plus longue n’est pas un défaut (S1, S7)', () => {
  // Samedi 24 octobre 2026, 23 h à Paris (UTC + 2) ; dimanche 25 octobre, 6 h à Paris (UTC + 1) : huit heures réelles.
  assert.deepEqual(quietHoursDecision(NIGHT, HEAT, new Date('2026-10-24T21:00:00.000Z')), hold('2026-10-25T05:00:00.000Z'));
  assert.equal(parisClock('2026-10-25T05:00:00.000Z'), '25/10 06:00');
  // L'heure répétée (de 2 h à 3 h, deux fois) est dans la plage : la fin est celle du jour.
  assert.deepEqual(quietHoursDecision(NIGHT, HEAT, new Date('2026-10-25T00:30:00.000Z')), hold('2026-10-25T05:00:00.000Z'), '2 h 30, heure d’été');
  assert.deepEqual(quietHoursDecision(NIGHT, HEAT, new Date('2026-10-25T01:30:00.000Z')), hold('2026-10-25T05:00:00.000Z'), '2 h 30, heure d’hiver');
  // De 20 h à 9 h, la plage la plus longue : treize heures d'horloge, quatorze heures réelles cette nuit-là ; retenue, pas un défaut.
  const longest: QuietHoursSettings = { enabled: true, start: '20:00', end: '09:00', frostPasses: true };
  assert.deepEqual(quietHoursDecision(longest, HEAT, new Date('2026-10-24T18:00:00.000Z')), hold('2026-10-25T08:00:00.000Z'));
  assert.deepEqual(quietHoursDecision(longest, HEAT, AT_21_30), hold('2026-11-25T08:00:00.000Z'), 'un soir ordinaire');
});

test('S7 : une retenue ne dure jamais plus d’une plage, treize heures de l’horloge de Paris ; au-delà, elle part et le défaut se dit', () => {
  const tooLong = { action: 'send', defect: 'hold-too-long' } as const;
  const corrupted = { startMinutes: 15 * 60, endMinutes: 6 * 60 };
  assert.deepEqual(quietWindowDecision(corrupted, true, HEAT, new Date('2026-11-24T15:00:00.000Z')), tooLong, '16 h jusqu’à 6 h : quatorze heures');
  assert.deepEqual(quietWindowDecision(corrupted, true, HEAT, AT_23_00), hold(UNTIL_06_00), '23 h jusqu’à 6 h : sept heures');
  assert.deepEqual(quietWindowDecision({ startMinutes: 20 * 60, endMinutes: 9 * 60 }, true, HEAT, new Date('2026-11-24T19:00:00.000Z')), hold('2026-11-25T08:00:00.000Z'), '20 h jusqu’à 9 h : treize heures, la borne comprise');
  assert.deepEqual(quietWindowDecision({ startMinutes: 20 * 60, endMinutes: 9 * 60 + 1 }, true, HEAT, new Date('2026-11-24T19:00:00.000Z')), tooLong, 'une minute de plus');
  assert.deepEqual(quietWindowDecision({ startMinutes: 2 * 60, endMinutes: 6 * 60 }, true, HEAT, new Date('2026-11-25T02:00:00.000Z')), tooLong, 'une plage de jour corrompue ne retient pas un jour entier');
  assert.deepEqual(quietWindowDecision(corrupted, true, HEAT, new Date('2026-11-24T12:00:00.000Z')), SEND, '13 h : hors de la plage');
  assert.deepEqual(quietWindowDecision(corrupted, true, { kind: 'evening-reminder' }, new Date('2026-11-24T15:00:00.000Z')), { action: 'skip' }, 'le rappel du soir n’est jamais retenu : S5 et non S7');
  assert.deepEqual(quietWindowDecision(corrupted, true, { kind: 'irrigation-finished' }, new Date('2026-11-24T15:00:00.000Z')), SEND);
  assert.deepEqual(quietWindowDecision(corrupted, true, CROP_FROST, new Date('2026-11-24T15:00:00.000Z')), SEND);
});

test('scénario 17 : un réglage hors des bornes est ignoré comme éteint, et le défaut se dit (S17)', () => {
  for (const corrupted of [{ start: '15:00' }, { end: '10:00' }, { start: '22:10' }, { end: '6:00' }, { start: '' }, { end: 'nuit' }]) {
    const settings = { ...NIGHT, ...corrupted };
    for (const notification of ALL_KINDS.filter((kind) => kind.kind !== 'irrigation-finished')) {
      assert.deepEqual(quietHoursDecision(settings, notification, AT_23_00), { action: 'send', defect: 'invalid-setting' }, `${JSON.stringify(corrupted)} ${notification.kind}`);
    }
  }
});
