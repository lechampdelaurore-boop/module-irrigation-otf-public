import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as choice from '../lib/domain/features/choice.ts';
import { weatherDays, weatherScale } from '../lib/domain/today/weather-days.ts';
import { DEMO_UNSENT_DELIVERY_LABEL, shownWeatherAlertDelivery } from '../lib/domain/weather/weather-alerts.ts';

/**
 * Audit ergonomique du 19 novembre 2026, lot I « Pénurie et démonstration »
 * (docs/audit-ergonomie-2026-11-19-lot-i-contract.md) : les règles qui se
 * lisent sans base. Les autres sont dans
 * `tests/db/audit-ergonomie-2026-11-19-lot-i.test.ts`.
 */

const sheet = (path: string) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// n° 12 — Le bandeau sur tablette (PR 4, F451).

test('n° 12, F451 : la bannière compacte du téléphone vaut jusqu’à 1 000 px ; au-dessus, la phrase passe à la ligne sans rétrécir', () => {
  const css = sheet('app/irrigation/styles/demo.css');
  assert.doesNotMatch(css, /max-width: 600px/, 'plus de bascule à 600 px');
  const compact = css.match(/@media \(max-width: 1000px\) \{\s*\.demo-banner \{([\s\S]*?)\}/)?.[1] ?? '';
  assert.match(compact, /flex-wrap: wrap;/);
  assert.match(css, /@media \(max-width: 1000px\) \{[\s\S]*?\.demo-banner \.demo-banner-line \{[\s\S]*?display: -webkit-box;/);
  const wide = css.match(/@media \(min-width: 1001px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(wide, /\.demo-banner \{\s*flex-wrap: wrap;\s*\}/);
  assert.match(wide, /\.demo-banner > p \{\s*min-width: 18em;\s*\}/, 'la phrase ne descend plus jusqu’à zéro');
  assert.doesNotMatch(wide, /\.demo-banner p \{/, 'l’annonce cachée de la visite, hors écran, ne prend pas cette largeur');
});

// n° 25 — Petits défauts de la démonstration (PR 5).

test('n° 25, F452 : « Commencer par l’essentiel » est retiré par le lot S6 de la simplification (D-336) : les trois façons de commencer font son travail', () => {
  assert.ok(!('ESSENTIAL_FEATURES' in choice) && !('withEssentialFeatures' in choice));
  assert.doesNotMatch(readFileSync('app/irrigation/bienvenue/welcome-choice.tsx', 'utf8'), /Commencer par l’essentiel/);
  assert.doesNotMatch(readFileSync('app/irrigation/styles/features.css', 'utf8'), /\.welcome-start/);
});

test('n° 25, F452 : « Cochera aussi » se lit en texte ordinaire, pas en italique accentué', () => {
  const rule = sheet('app/irrigation/styles/features.css').match(/\.feature-choice-copy em \{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /font-weight: 400;/);
  assert.match(rule, /color: var\(--ink2\);/);
});

test('n° 25, F453 : un jour qu’une alerte de froid annonce porte le flocon, même au-dessus de 0 °C', () => {
  const forecasts = [
    { date: '2026-11-20', minimumTemperatureCelsius: 3, maximumTemperatureCelsius: 11, precipitationMm: 0, forecastedAt: '2026-11-19T06:00:00Z' },
    { date: '2026-11-21', minimumTemperatureCelsius: 3, maximumTemperatureCelsius: 11, precipitationMm: 0, forecastedAt: '2026-11-19T06:00:00Z' },
  ];
  const days = weatherDays({
    dates: ['2026-11-20', '2026-11-21'],
    today: '2026-11-20',
    forecasts,
    announcements: new Map([['2026-11-21', { frost: null, alerts: ['Température minimale prévue 3 °C'], cold: true }]]),
    scale: weatherScale(forecasts),
  });
  assert.equal(days[0]?.icon, 'sun');
  assert.equal(days[1]?.icon, 'frost');
  const view = readFileSync('lib/domain/today/today-view.ts', 'utf8');
  assert.match(view, /criterion\.field === 'minimum-temperature' && criterion\.direction === 'below'/);
});

test('n° 25, F454 : en démonstration, un envoi manqué se lit « Non envoyée : notifications coupées », en couleur neutre', () => {
  for (const status of ['failed', 'no-subscriber', 'retrying'] as const) {
    assert.deepEqual(shownWeatherAlertDelivery({ deliveryStatus: status, deliveryLabel: 'x' }, true), { status: 'demo-unsent', label: DEMO_UNSENT_DELIVERY_LABEL });
    assert.deepEqual(shownWeatherAlertDelivery({ deliveryStatus: status, deliveryLabel: 'x' }, false), { status, label: 'x' }, 'hors démonstration, rien ne change');
  }
  assert.deepEqual(shownWeatherAlertDelivery({ deliveryStatus: 'sent', deliveryLabel: 'Envoyée' }, true), { status: 'sent', label: 'Envoyée' });
  const css = sheet('app/irrigation/styles/water-dashboard.css');
  assert.doesNotMatch(css, /data-status="demo-unsent"/, 'aucune couleur d’alerte pour la démonstration');
  for (const panel of ['app/irrigation/weather-alerts-panel.tsx', 'app/irrigation/crop-alerts-panel.tsx']) {
    assert.match(readFileSync(panel, 'utf8'), /<DeliveryStatus entry=\{entry\} demo=\{demo\} \/>/, panel);
  }
});

test('n° 25, F455 : dans Réglages, la ligne des notifications coupées se lit sous le titre de sa section', () => {
  const page = readFileSync('app/irrigation/reglages/page.tsx', 'utf8');
  const section = page.match(/function DemoNotificationSettings\(\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(section, /<h2 id="notifications-title">Notifications du téléphone<\/h2>/);
  assert.match(section, /DEMO_PUSH_NOTICE/);
});
