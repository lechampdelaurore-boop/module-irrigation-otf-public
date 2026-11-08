import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  formatIrrigationDateTimeInput,
  formatWaterVolumeForMessage,
  instantFromIrrigationDateTimeInput,
} from '../lib/domain/irrigation-format.ts';

test('les petits volumes restent lisibles dans les alertes de limite', () => {
  assert.equal(formatWaterVolumeForMessage(0.01125), '0,011');
  assert.equal(formatWaterVolumeForMessage(0.00125), '0,001');
  assert.equal(formatWaterVolumeForMessage(1), '1');
});

test('les dates de réserve sont identiques pour un serveur UTC et un navigateur dans un autre fuseau', () => {
  const moduleUrl = new URL('../lib/domain/irrigation-format.ts', import.meta.url).href;
  const script = `import { formatIrrigationDateTime } from ${JSON.stringify(moduleUrl)};
    console.log(JSON.stringify(['2026-09-07T16:50:00Z','2026-01-07T16:50:00Z'].map(date => formatIrrigationDateTime(date, 'Europe/Paris'))));`;
  const render = (tz: string) => JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' })) as string[];
  const server = render('UTC');
  assert.deepEqual(render('America/New_York'), server);
  assert.deepEqual(render('Europe/Paris'), server);
  assert.match(server[0], /18:50$/);
  assert.match(server[1], /17:50$/);
});

test('les trois dates initiales des ressources utilisent le fuseau du tableau de bord', () => {
  const source = readFileSync(new URL('../app/irrigation/water-resource-manager.tsx', import.meta.url), 'utf8');
  for (const value of ['reservoir.currentVolumeObservedAt', 'latestCorrection.occurredAt', 'dashboard.projectionEndsAt']) {
    assert.ok(source.includes(`formatIrrigationDateTime(${value}, dashboard.timeZone)`));
  }
});

test('la date locale du champ de projection est identique quel que soit le fuseau du rendu', () => {
  const moduleUrl = new URL('../lib/domain/irrigation-format.ts', import.meta.url).href;
  const script = `import { formatIrrigationDateTimeInput } from ${JSON.stringify(moduleUrl)};
    console.log(JSON.stringify([
      formatIrrigationDateTimeInput('2026-09-09T23:30:00Z', 'Europe/Paris'),
      formatIrrigationDateTimeInput('2026-01-09T23:30:00Z', 'Europe/Paris'),
      formatIrrigationDateTimeInput('2026-03-29T00:30:00Z', 'Europe/Paris'),
      formatIrrigationDateTimeInput('2026-03-29T01:30:00Z', 'Europe/Paris'),
    ]));`;
  const render = (tz: string) => JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' })) as string[];
  const server = render('UTC');
  assert.deepEqual(render('America/New_York'), server);
  assert.deepEqual(render('Europe/Paris'), server);
  assert.deepEqual(server, [
    '2026-09-10T01:30',
    '2026-01-10T00:30',
    '2026-03-29T01:30',
    '2026-03-29T03:30',
  ]);
});

test('le premier rendu des projections utilise le même instant de référence côté serveur et navigateur', () => {
  assert.equal(
    formatIrrigationDateTimeInput('2026-09-09T20:34:00Z', 'Europe/Paris'),
    '2026-09-09T22:34',
  );
  const source = readFileSync(new URL('../app/irrigation/water-resource-manager.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('initialDashboard.projectionEndsAt'));
  assert.ok(source.includes('initialProjectionMinimum'));
  assert.ok(!source.includes('min={toLocalInput(new Date())}'));
  assert.ok(!source.includes('new Date(Date.now() + 24 * 60 * 60 * 1_000)'));
});

test('une heure saisie à la ferme désigne le même instant, quel que soit le fuseau qui la lit', () => {
  const moduleUrl = new URL('../lib/domain/irrigation-format.ts', import.meta.url).href;
  const script = `import { instantFromIrrigationDateTimeInput } from ${JSON.stringify(moduleUrl)};
    console.log(JSON.stringify([
      instantFromIrrigationDateTimeInput('2026-09-25T06:00', 'Europe/Paris'),
      instantFromIrrigationDateTimeInput('2026-01-15T06:00', 'Europe/Paris'),
      new Date('2026-09-25T06:00').toISOString(),
    ]));`;
  const lire = (tz: string) => JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' })) as string[];

  // Le Worker déployé tourne en UTC, la machine du maraîcher à l'heure de la
  // ferme : c'est cet écart que la recette 3.1 bis a fait apparaître.
  const worker = lire('UTC');
  assert.deepEqual(worker.slice(0, 2), lire('Europe/Paris').slice(0, 2));
  assert.equal(worker[0], '2026-09-25T04:00:00.000Z');
  assert.equal(worker[1], '2026-01-15T05:00:00.000Z');
  // Ce que faisait l'ancien code, et qui décalait le relevé de deux heures.
  assert.equal(worker[2], '2026-09-25T06:00:00.000Z');
});

test('les jours de changement d’heure, le décalage retenu est celui qui a cours', () => {
  // Le 29 mars 2026 la France passe de UTC+1 à UTC+2 à deux heures du matin.
  assert.equal(instantFromIrrigationDateTimeInput('2026-03-29T01:30', 'Europe/Paris'), '2026-03-29T00:30:00.000Z');
  assert.equal(instantFromIrrigationDateTimeInput('2026-03-29T03:30', 'Europe/Paris'), '2026-03-29T01:30:00.000Z');
  // Le 25 octobre, l'heure entre deux et trois heures a lieu deux fois : la
  // seconde est retenue, faute de pouvoir deviner laquelle le maraîcher vise.
  assert.equal(instantFromIrrigationDateTimeInput('2026-10-25T02:30', 'Europe/Paris'), '2026-10-25T01:30:00.000Z');
});

test('l’heure pré-remplie par l’écran se relit sans bouger', () => {
  // Pré-remplissage puis enregistrement : c'est le geste du forage, et il ne
  // doit rien déplacer. La chaîne complète est ici, dans les deux sens.
  for (const instant of ['2026-09-25T18:48:00.000Z', '2026-01-15T07:05:00.000Z', '2026-10-24T23:30:00.000Z']) {
    const saisie = formatIrrigationDateTimeInput(instant, 'Europe/Paris');
    assert.equal(instantFromIrrigationDateTimeInput(saisie, 'Europe/Paris'), instant);
  }
});

test('une saisie qui n’a pas la forme attendue est refusée plutôt que devinée', () => {
  assert.equal(instantFromIrrigationDateTimeInput('pas une date'), null);
  assert.equal(instantFromIrrigationDateTimeInput('2026-02-31T10:00'), null);
  assert.equal(instantFromIrrigationDateTimeInput('2026-09-25T25:00'), null);
  assert.equal(instantFromIrrigationDateTimeInput(''), null);
});

test('le relevé enregistré passe par la lecture à l’heure de la ferme', () => {
  const source = readFileSync(new URL('../app/irrigation/water-resource-actions.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('instantFromIrrigationDateTimeInput(value)'));
  // L'action tourne dans le Worker : y parser une heure sans fuseau la place en
  // UTC. C'est le défaut relevé en recette 3.1 bis le 25 septembre 2026.
  assert.ok(!source.includes('new Date(input.takenAt)'));
  assert.ok(!source.includes('new Date(value)'));
});
