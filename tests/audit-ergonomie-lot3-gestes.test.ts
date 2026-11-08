import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { CorrespondenceEntry, SeasonSpecies } from '../lib/domain/crop-water/species';
import {
  speciesInLinkOrder,
  speciesLinkCounter,
  speciesNeedsLink,
  suggestReferenceCrop,
  type LinkCandidate,
} from '../lib/domain/crop-water/species-linking';
import { matchesSearch } from '../lib/domain/name-search';
import { observationDayText, soilGardenLines } from '../lib/domain/soil-reserve/garden-lines';
import type { SoilGaugePlot } from '../lib/domain/soil-reserve/gauge-view';
import { weatherAlertTemplates } from '../lib/domain/weather/weather-alert-templates';
import { validateWeatherAlertCriterion, weatherAlertCriterionSummary } from '../lib/domain/weather/weather-alerts';

/**
 * Audit ergonomique, lot 3, PR 2 (docs/audit-ergonomie-lot3-contract.md,
 * sections 4 et 6, cas 8 à 11) : les espèces à rattacher en tête, la
 * proposition d'après le nom, les jardins « inconnue » et les jardins
 * pareils rangés en une phrase, les trois modèles d'alerte. Aucune règle de
 * calcul ne change : ces tests ne lisent que des ordres, des comptes et des
 * phrases. Aujourd'hui = dimanche 8 novembre 2026 à la ferme.
 */

const TODAY = '2026-11-08';

function species(plantId: string, plantName: string, target: CorrespondenceEntry['target'] | null): SeasonSpecies {
  return {
    plantId,
    plantName,
    series: [{ id: `${plantId}-s1`, name: `${plantName} 1` }],
    link: target === null ? null : { plantId, seriesId: null, target },
    exceptions: [],
  };
}

const reference = (referenceCropId: string): CorrespondenceEntry['target'] => ({ kind: 'reference', referenceCropId, analogy: false });

/** 78 espèces : 75 rattachées (dont un engrais vert), 2 sans rattachement, 1 « sans référence ». */
function seventyEightSpecies(): SeasonSpecies[] {
  const linked = Array.from({ length: 73 }, (_, index) => species(`p${String(index).padStart(2, '0')}`, `Espèce ${String(index).padStart(2, '0')}`, reference('criiam-tomate')));
  return [
    species('ail', 'Ail', reference('criiam-ail')),
    species('bourrache', 'Bourrache', null),
    ...linked,
    species('mache', 'Mâche', { kind: 'without-reference' }),
    species('phacelie', 'Phacélie', { kind: 'surface-state' }),
    species('zinnia', 'Zinnia', null),
  ];
}

test('cas 8 : les espèces sans référence passent en tête, le compteur dit ce qui reste à rattacher', () => {
  const all = seventyEightSpecies();
  assert.equal(all.length, 78);
  const ordered = speciesInLinkOrder(all);
  assert.deepEqual(ordered.slice(0, 3).map((item) => item.plantName), ['Bourrache', 'Mâche', 'Zinnia']);
  assert.equal(ordered.length, 78);
  assert.equal(ordered[3].plantName, 'Ail');
  assert.equal(speciesLinkCounter(all), '3 espèces à rattacher sur 78');
  // L'engrais vert est un rattachement, « sans référence » n'en est pas un.
  assert.equal(speciesNeedsLink(species('x', 'Phacélie', { kind: 'surface-state' })), false);
  assert.equal(speciesNeedsLink(species('x', 'Mâche', { kind: 'without-reference' })), true);
  assert.equal(speciesLinkCounter([species('a', 'Ail', null)]), '1 espèce à rattacher sur 1');
  assert.equal(speciesLinkCounter([species('a', 'Ail', reference('criiam-ail'))]), 'L’espèce de la saison est rattachée');
  assert.equal(speciesLinkCounter(all.filter((item) => !speciesNeedsLink(item))), 'Les 75 espèces de la saison sont rattachées');
  assert.equal(speciesLinkCounter([]), 'Aucune espèce à rattacher');
});

test('cas 8 : la recherche par nom ignore accents et majuscules', () => {
  const names = seventyEightSpecies().map((item) => item.plantName);
  assert.deepEqual(names.filter((name) => matchesSearch(name, 'mache')), ['Mâche']);
  assert.deepEqual(names.filter((name) => matchesSearch(name, 'PHAC')), ['Phacélie']);
  assert.equal(names.filter((name) => matchesSearch(name, '')).length, 78);
});

function candidate(id: string, name: string, source: LinkCandidate['source'], options: Partial<LinkCandidate> = {}): LinkCandidate {
  return { id, name, source, fromCommonSet: source !== 'local', usable: true, ...options };
}

const COMMON_SET: LinkCandidate[] = [
  candidate('criiam-ail', 'Ail', 'criiam'),
  candidate('criiam-fraisier', 'Fraisier non remontant', 'criiam'),
  candidate('criiam-fraisier-remontant', 'Fraisier remontant', 'criiam'),
  candidate('criiam-haricot', 'Haricot', 'criiam'),
  candidate('criiam-oignon', 'Oignon', 'criiam'),
  candidate('criiam-pomme-de-terre', 'Pomme de terre', 'criiam'),
  candidate('criiam-tomate', 'Tomate', 'criiam'),
  candidate('fao-cruciferes', 'Crucifères (choux)', 'fao56'),
  candidate('fao-oignon-vert', 'Oignon vert', 'fao56'),
  candidate('fao-petit-pois', 'Petit pois', 'fao56'),
  candidate('fao-radis', 'Radis', 'fao56'),
];

test('cas 9 : une proposition d’après le nom, la plus précise, seulement parmi le jeu commun utilisable', () => {
  const suggested = (name: string, candidates = COMMON_SET) => suggestReferenceCrop(name, candidates)?.id ?? null;
  assert.equal(suggested('Tomate'), 'criiam-tomate');
  assert.equal(suggested('Tomate cerise'), 'criiam-tomate');
  assert.equal(suggested('Tomates anciennes'), 'criiam-tomate');
  assert.equal(suggested('Pommes de terre primeur'), 'criiam-pomme-de-terre');
  assert.equal(suggested('Haricot vert'), 'criiam-haricot');
  assert.equal(suggested('Oignon blanc'), 'criiam-oignon');
  assert.equal(suggested('Oignon vert botte'), 'fao-oignon-vert');
  assert.equal(suggested('Petits pois'), 'fao-petit-pois');
  assert.equal(suggested('radis'), 'fao-radis');
  // Un choix agronomique reste à l'utilisateur : rien n'est proposé.
  assert.equal(suggested('Fraisier'), null);
  assert.equal(suggested('Mâche'), null);
  assert.equal(suggested('Chou kale'), null);
  assert.equal(suggested('Pois'), null);
  assert.equal(suggested('Aillet'), null);
  assert.equal(suggested(''), null);
  // Une culture inutilisable, ou saisie par la ferme, n'est jamais proposée.
  assert.equal(suggested('Tomate', [candidate('criiam-tomate', 'Tomate', 'criiam', { usable: false })]), null);
  assert.equal(suggested('Tomate', [candidate('ferme-tomate', 'Tomate', 'local')]), null);
  // À précision égale, le CRIIAM Sud passe avant la FAO-56 ; deux cultures pareilles de la même source : rien.
  assert.equal(suggested('Tomate', [candidate('fao-tomate', 'Tomate', 'fao56'), candidate('criiam-tomate', 'Tomate', 'criiam')]), 'criiam-tomate');
  assert.equal(suggested('Tomate', [candidate('criiam-tomate', 'Tomate', 'criiam'), candidate('criiam-tomate-2', 'Tomates', 'criiam')]), null);
  // La version de la ferme d'une culture commune reste du jeu commun.
  assert.equal(suggested('Tomate', [candidate('criiam-tomate', 'Tomate', 'criiam', { fromCommonSet: true })]), 'criiam-tomate');
});

function plot(plotId: string, name: string, percent: number | null, options: { sheltered?: boolean; observedAt?: string | null; beds?: number } = {}): SoilGaugePlot {
  const beds = options.beds ?? 3;
  return {
    plotId,
    name,
    sheltered: options.sheltered ?? false,
    garden: {
      percent,
      lowest: null,
      countedBeds: percent === null ? 0 : beds,
      unknownBeds: percent === null ? beds : 0,
      withoutCrop: [],
    },
    week: [],
    observation: options.observedAt ? { zoneId: 'z1', plotId: null, percent: percent ?? 50, observedAt: options.observedAt, recordedAt: options.observedAt } : null,
    beds: [],
  };
}

test('cas 10 : six abris « inconnue » portent chacun « Observer » ; onze jardins à 50 % observés hier tiennent en une phrase', () => {
  const yesterday = '2026-11-07T08:00:00.000Z';
  const gardens = Array.from({ length: 11 }, (_, index) => plot(`j${index + 1}`, `Jardin ${index + 1}`, 50.2, { observedAt: yesterday }));
  const shelters = Array.from({ length: 6 }, (_, index) => plot(`t${index + 1}`, `Tunnel ${index + 1}`, null, { sheltered: true }));
  const lines = soilGardenLines({ plots: [...gardens, ...shelters], fieldPlotCount: 11 }, TODAY);
  assert.equal(lines.length, 1 + 11 + 6);
  const group = lines[0];
  assert.equal(group.kind, 'group');
  if (group.kind !== 'group') return;
  assert.equal(group.title, 'Tous les jardins de plein champ');
  assert.equal(group.detail, '50 % du plein, observé hier');
  assert.equal(group.plotIds.length, 11);
  const plots = lines.filter((line) => line.kind === 'plot');
  assert.equal(plots.filter((line) => line.groupKey === group.key).length, 11);
  const observe = plots.filter((line) => line.observe);
  assert.deepEqual(observe.map((line) => line.plot.name), ['Tunnel 1', 'Tunnel 2', 'Tunnel 3', 'Tunnel 4', 'Tunnel 5', 'Tunnel 6']);
  assert.ok(observe.every((line) => line.groupKey === null));
});

test('cas 10 : un pli ne range que des jardins de plein champ au même pourcentage, observés le même jour', () => {
  const lines = soilGardenLines({
    plots: [
      plot('a', 'Jardin A', 50, { observedAt: '2026-11-08T07:00:00.000Z' }),
      plot('b', 'Jardin B', 61, { observedAt: '2026-11-08T07:00:00.000Z' }),
      plot('c', 'Jardin C', 49.6, { observedAt: '2026-11-08T09:00:00.000Z' }),
      plot('d', 'Jardin D', 50, { observedAt: '2026-11-06T09:00:00.000Z' }),
      plot('e', 'Tunnel', 50, { sheltered: true, observedAt: '2026-11-08T07:00:00.000Z' }),
      plot('f', 'Jardin F', null, { beds: 0 }),
    ],
    fieldPlotCount: 5,
  }, TODAY);
  const groups = lines.filter((line) => line.kind === 'group');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind === 'group' && groups[0].title, '2 jardins de plein champ');
  assert.equal(groups[0].kind === 'group' && groups[0].detail, '50 % du plein, observé aujourd’hui');
  assert.deepEqual(groups[0].kind === 'group' && groups[0].plotIds, ['a', 'c']);
  // Le pli se place à la hauteur de son premier jardin.
  assert.deepEqual(lines.map((line) => (line.kind === 'group' ? 'pli' : line.plot.plotId)), ['pli', 'a', 'b', 'c', 'd', 'e', 'f']);
  // Une ligne « aucune planche cultivée » n'est pas inconnue : pas d'« Observer ».
  const last = lines.at(-1);
  assert.equal(last?.kind === 'plot' && last.observe, false);
  assert.equal(observationDayText(null, TODAY), 'sans observation');
  assert.equal(observationDayText('2026-11-03', TODAY), 'observé le mardi 3 novembre');
});

test('cas 11 : trois modèles tant qu’il n’y a aucune alerte, valides et modifiables ; plus de modèles dès une alerte', () => {
  const templates = weatherAlertTemplates(0);
  assert.deepEqual(templates.map((template) => template.title), ['Gel : moins de 3 °C', 'Forte chaleur : plus de 33 °C', 'Pluie : plus de 15 mm']);
  for (const template of templates) {
    const validation = validateWeatherAlertCriterion({ ...template.settings, threshold: String(template.settings.threshold) });
    assert.equal(validation.ok, true, template.title);
    assert.equal(template.settings.horizonDays, 3);
  }
  assert.equal(
    weatherAlertCriterionSummary(templates[0].settings),
    'Température minimale prévue en dessous de 3 °C (3 °C non compris), sur 3 jours, aujourd’hui compris',
  );
  assert.equal(weatherAlertTemplates(1).length, 0);
});

/** Les jetons de couleur de la charte, lus dans `app/globals.css`. */
function tokens(): Record<string, string> {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const full = (hex: string) => (hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join('')}` : hex);
  return Object.fromEntries([...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map((match) => [match[1], full(match[2])]));
}

function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [dark, light] = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (light + 0.05) / (dark + 0.05);
}

test('cas 13 : les petits textes tiennent 4,5:1 sur leurs fonds (jetons de la charte)', () => {
  const colors = tokens();
  // Le gris des légendes sur les fonds clairs et vert pâle, l'encre de chaque teinte sur sa teinte pâle.
  const pairs: [string, string][] = [
    ['ink2', 'card'], ['ink2', 'sheet'], ['ink2', 'green-soft'], ['ink2', 'tile'], ['ink2', 'menu'],
    ['green', 'card'], ['green-dark', 'tile'], ['green-dark', 'green-soft'],
    ['warn-ink', 'warn-soft'], ['danger-ink', 'danger-soft'], ['ok-ink', 'ok-soft'], ['water-ink', 'water-soft'], ['info-ink', 'info'],
  ];
  for (const [foreground, background] of pairs) {
    assert.ok(colors[foreground] && colors[background], `jetons --${foreground} et --${background} lus`);
    const ratio = contrast(colors[foreground], colors[background]);
    assert.ok(ratio >= 4.5, `--${foreground} sur --${background} : ${ratio.toFixed(2)}:1, moins que 4,5:1`);
  }
});
