import assert from 'node:assert/strict';
import test from 'node:test';
import { dryingNotification, type DryingDeadline } from '../lib/domain/crop-alerts/drying.ts';
import { frostNotifications, type CropAlertNotification, type FrostEvaluation } from '../lib/domain/crop-alerts/frost.ts';
import { fitPushBody, PUSH_BODY_MAX_LENGTH, pushTag } from '../lib/domain/crop-alerts/push.ts';
import { validateIrrigationPushNotification } from '../lib/domain/irrigation-push-contract.ts';

/**
 * Les notifications des alertes par culture respectent le contrat du service
 * d'envoi (texte d'au plus 160 caractères, étiquette sans virgule). Défaut
 * trouvé à la recette réelle de la 5 quinquies, le 6 novembre 2026 : l'alerte
 * de gel du dimanche 8 novembre, qui nommait la patate douce et la tomate,
 * était refusée par le service et enregistrée « Échec du service de
 * notification ».
 */

const accepted = (notification: CropAlertNotification) =>
  validateIrrigationPushNotification({ title: notification.title, body: notification.body, tag: notification.tag, data: { url: notification.url } }) !== null;

const crossing = (subjectKey: string, name: string, underShelter = false) => ({
  subjectKey,
  subjectVersion: `v-${subjectKey}`,
  plantId: subjectKey,
  name,
  damageCelsius: 0,
  marginCelsius: 3,
  offsetCelsius: 0,
  alertThresholdCelsius: 3,
  underShelter,
  alreadyAlerted: false,
});

const frostDay = (crossings: ReturnType<typeof crossing>[]): FrostEvaluation => ({
  days: [{ date: '2026-11-08', minimumCelsius: 1.9, forecastedAt: '2026-11-06T21:47:00.000Z', crossings }],
  unavailableDates: [],
});

test('la recette du 6 novembre 2026 : patate douce et tomate sous abri, une notification acceptée, au même texte', () => {
  const [notification] = frostNotifications(frostDay([crossing('81', 'Patate douce'), crossing('64', 'Tomate', true)]));
  assert.equal(notification.body,
    'Gel prévu dimanche 8 novembre : 1,9 °C. Patate douce, tomate (2 cultures présentes). Sous abri, la température diffère : la prévision est celle de l’extérieur.');
  assert.match(notification.tag, /^crop-frost:2026-11-08:[0-9a-f]{8}$/u);
  assert.equal(accepted(notification), true);
});

test('sous abri, la note se raccourcit, puis s’efface devant cinq noms longs ; la notification est toujours acceptée', () => {
  const short = frostNotifications(frostDay(['Chou de Milan', 'Céleri branche', 'Tomate'].map((name, index) => crossing(`plante-${index}`, name, true))))[0];
  assert.equal(short.body, 'Gel prévu dimanche 8 novembre : 1,9 °C. Chou de Milan, céleri branche, tomate (3 cultures présentes). Sous abri, la température diffère.');
  assert.equal(accepted(short), true);
  const names = ['Chicorée scarole', 'Chicorée frisée', 'Chou de Milan', 'Céleri branche', 'Patate douce', 'Tomate', 'Mesclun'];
  const [long] = frostNotifications(frostDay(names.map((name, index) => crossing(`plante-${index}`, name, true))));
  assert.equal(long.body, 'Gel prévu dimanche 8 novembre : 1,9 °C. Chicorée scarole, chicorée frisée, chou de Milan, céleri branche, patate douce et 2 autres (7 cultures présentes).');
  assert.equal(accepted(long), true);
});

test('les séries échues nombreuses : le texte se coupe au dernier mot, l’étiquette reste une empreinte', () => {
  const due: DryingDeadline[] = Array.from({ length: 6 }, (_, index) => ({
    seriesId: `serie,${index}@ail`,
    seriesName: `Ail de printemps ${index}`,
    season: 2026,
    plantId: 'p-ail',
    plantName: index % 2 === 0 ? 'Ail' : 'Pomme de terre',
    dryingDays: 15,
    harvestStart: `2026-07-${String(20 + index).padStart(2, '0')}`,
    stopDate: '2026-07-05',
    bedNames: [`${10 + index}`, `${20 + index}`],
  }));
  const notification = dryingNotification(due);
  assert.ok(notification);
  assert.ok(notification.body.endsWith('…') && notification.body.length <= PUSH_BODY_MAX_LENGTH, notification.body);
  assert.match(notification.tag, /^crop-drying:[0-9a-f]{8}$/u);
  assert.equal(accepted(notification), true);
});

test('l’empreinte ne dépend pas de l’ordre des sujets ; deux listes différentes donnent deux étiquettes', () => {
  assert.equal(pushTag('crop-frost:2026-11-08', ['64', '81']), pushTag('crop-frost:2026-11-08', ['81', '64']));
  assert.notEqual(pushTag('crop-frost:2026-11-08', ['64', '81']), pushTag('crop-frost:2026-11-08', ['64']));
  assert.notEqual(pushTag('crop-sprinkler:2026-11-12', ['a@1']), pushTag('crop-sprinkler:2026-11-12', ['a@2']));
});

test('un texte court reste tel quel ; un texte trop long se coupe au dernier mot, suivi de « … »', () => {
  assert.equal(fitPushBody('  Gel prévu   demain.  '), 'Gel prévu demain.');
  const long = `${'mot '.repeat(60)}fin.`;
  const fitted = fitPushBody(long);
  assert.ok(fitted.length <= PUSH_BODY_MAX_LENGTH);
  assert.match(fitted, /^mot( mot)+…$/u);
});
