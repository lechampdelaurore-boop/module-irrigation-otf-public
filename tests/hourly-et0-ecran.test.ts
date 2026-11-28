import assert from 'node:assert/strict';
import test from 'node:test';
import { DAY_CURVE_TITLE, todayDayCurve, type TodayDayCurve, type TodayDayCurveInputs } from '../lib/domain/today/day-curve.ts';
import { detailSummary } from '../lib/domain/today/essential.ts';
import { todayView, type TodayInputs } from '../lib/domain/today/today-view.ts';
import { FEATURE_IDS } from '../lib/domain/features/catalogue.ts';
import { sharesFromHourlyEt0 } from '../lib/domain/weather/hourly-et0.ts';
import { TECHNICAL_WORDS } from '../lib/domain/simple-words.ts';

/**
 * L'ET0 horaire à l'écran (docs/et0-horaire-contract.md, § 4.5 et § 7 ;
 * D-350, PR HR3) : « Soif du jour, heure par heure » dans « Le détail »
 * d'« Aujourd'hui ». Les trois états (forme connue, forme théorique, ET0
 * manquante), la forme de la seule source de l'ET0 du jour (§ 9), la forme
 * dite « ancienne » après 6 heures, les heures de forte évaporation
 * (question 3), et la vue qui ne la lit qu'avec « Objectifs et besoins ».
 */

const VANNES = { latitude: 47.66, longitude: -2.76 };
/** Le jour d'exemple de la section 11 du contrat : l'ET0 du fournisseur, heure par heure. */
const EXAMPLE_MM = [0, 0, 0, 0, 0, 0, 0.01, 0.03, 0.07, 0.13, 0.2, 0.27, 0.31, 0.33, 0.31, 0.26, 0.19, 0.11, 0.05, 0.01, 0, 0, 0, 0];
const EXAMPLE_SHARES = sharesFromHourlyEt0(EXAMPLE_MM, 24) as number[];
const SOURCE = 'open-meteo:meteofrance_seamless';
/** Lundi 15 juin 2026, midi à Paris. */
const NOON = new Date('2026-06-15T10:00:00.000Z');

function inputs(overrides: Partial<TodayDayCurveInputs> = {}): TodayDayCurveInputs {
  return {
    date: '2026-06-15',
    timeZone: 'Europe/Paris',
    location: VANNES,
    et0: { mm: 2.4, source: SOURCE },
    recorded: [{ date: '2026-06-15', nature: 'provider-hourly', shares: EXAMPLE_SHARES, source: SOURCE, fetchedAt: '2026-06-15T04:15:00.000Z' }],
    ...overrides,
  };
}

function shown(curve: TodayDayCurve | null): Extract<TodayDayCurve, { state: 'shown' }> {
  assert.ok(curve && curve.state === 'shown', 'une courbe montrée');
  return curve;
}

test('forme connue, à midi : il reste environ 1,7 mm sur 2,4 mm (scénario 2), forte évaporation de 11 h à 16 h (scénario 5)', () => {
  const curve = shown(todayDayCurve(inputs(), NOON));
  assert.equal(curve.nature, 'provider-hourly');
  assert.equal(curve.sentence, 'D’ici ce soir, il reste environ 1,7 mm à consommer sur 2,4 mm.');
  assert.equal(curve.strongest, 'Évaporation la plus forte entre 11 h et 16 h');
  assert.equal(curve.old, null, 'lue à 6 h 15, il est midi : moins de 6 heures');
  assert.equal(curve.bars.length, 24);
  assert.deepEqual(curve.bars.filter((bar) => bar.current).map((bar) => bar.hour), ['12 h']);
  assert.deepEqual(curve.bars.filter((bar) => bar.strong).map((bar) => bar.hour), ['11 h', '12 h', '13 h', '14 h', '15 h']);
  assert.equal(curve.bars[13].heightPercent, 100, 'la plus forte heure à pleine hauteur');
  assert.equal(curve.bars[3].heightPercent, 0, 'la nuit, aucune évaporation');
  assert.equal(curve.bars[14].title.replace(/\s/g, ' '), '14 h : 13,6 % de la journée, environ 0,3 mm', 'scénario 1 dans l’infobulle');
  assert.equal(curve.label, 'Courbe de la journée, forme du fournisseur ; évaporation la plus forte entre 11 h et 16 h ; il est 12 h.');
  assert.match(curve.help.entries[0].title, /forme du fournisseur/);
  assert.ok(curve.help.entries.some((entry) => entry.text === 'Elle ne change pas le besoin de vos planches ni l’objectif ; elle montre à quelle heure la journée consomme.'));
  assert.ok(curve.help.entries.some((entry) => /75\s%/.test(entry.text) && /jamais une interdiction/.test(entry.text)), 'le seuil, en information');
});

test('la forme calculée à l’heure se dit aussi, dans le « ? »', () => {
  const curve = shown(todayDayCurve(inputs({
    et0: { mm: 2.4, source: 'visual-crossing' },
    recorded: [{ date: '2026-06-15', nature: 'computed-hourly', shares: EXAMPLE_SHARES, source: 'visual-crossing', fetchedAt: '2026-06-15T04:15:00.000Z' }],
  }), NOON));
  assert.equal(curve.nature, 'computed-hourly');
  assert.match(curve.help.entries[0].title, /calculée à l’heure/);
  assert.doesNotMatch(curve.sentence, /théorique/);
});

test('la forme d’un autre modèle ne sert jamais : la forme théorique du soleil, et la phrase le dit (§ 9, scénario 9)', () => {
  for (const recorded of [
    [{ date: '2026-06-15', nature: 'provider-hourly' as const, shares: EXAMPLE_SHARES, source: 'open-meteo:best_match', fetchedAt: '2026-06-15T04:15:00.000Z' }],
    [],
  ]) {
    const curve = shown(todayDayCurve(inputs({ recorded }), NOON));
    assert.equal(curve.nature, 'theoretical');
    assert.match(curve.sentence, /^D’ici ce soir, il reste environ [\d,]+ mm à consommer sur 2,4 mm, d’après la forme théorique du soleil\.$/);
    assert.equal(curve.old, null, 'une forme théorique n’a pas d’heure de lecture');
    assert.match(curve.help.entries[0].text, /symétrique autour de midi au soleil/);
    assert.equal(curve.bars[2].heightPercent, 0, 'la nuit, le soleil est sous l’horizon');
  }
});

test('une forme écrite qui n’a pas une part par heure du jour est refusée : la forme théorique (scénarios 6 et 7)', () => {
  const curve = shown(todayDayCurve(inputs({
    recorded: [{ date: '2026-06-15', nature: 'provider-hourly', shares: EXAMPLE_SHARES.slice(0, 23), source: SOURCE, fetchedAt: '2026-06-15T04:15:00.000Z' }],
  }), NOON));
  assert.equal(curve.nature, 'theoretical');
});

test('un jour de 23 heures : 23 barres, la forme écrite de 23 parts acceptée', () => {
  const shares = Array.from({ length: 23 }, () => 1 / 23);
  const curve = shown(todayDayCurve(inputs({
    date: '2026-03-29',
    recorded: [{ date: '2026-03-29', nature: 'provider-hourly', shares, source: SOURCE, fetchedAt: '2026-03-29T04:15:00.000Z' }],
  }), new Date('2026-03-29T10:00:00.000Z')));
  assert.equal(curve.nature, 'provider-hourly');
  assert.equal(curve.bars.length, 23);
  assert.ok(!curve.bars.some((bar) => bar.hour === '2 h'), 'l’heure qui n’existe pas n’est pas inventée');
});

test('une forme lue il y a plus de 6 heures est dite ancienne, avec son heure de lecture (§ 4.5)', () => {
  const at = new Date('2026-06-15T10:16:00.000Z');
  assert.equal(shown(todayDayCurve(inputs(), at)).old, 'Courbe ancienne : lue à 6 h 15.');
  assert.equal(shown(todayDayCurve(inputs(), new Date('2026-06-15T10:15:00.000Z'))).old, null, '6 heures pile : pas encore ancienne');
});

test('ET0 du jour manquante : pas de courbe, aucun millimètre, jamais 0 (scénario 8)', () => {
  const curve = todayDayCurve(inputs({ et0: null }), NOON);
  assert.ok(curve && curve.state === 'missing');
  assert.equal(curve.text, 'Pas de courbe : l’ET0 du jour manque.');
  assert.doesNotMatch(JSON.stringify(curve), /\d mm/);
});

test('le soir, la soif du jour est passée ; une nuit polaire sans heure du fournisseur ne dessine rien', () => {
  const evening = shown(todayDayCurve(inputs(), new Date('2026-06-15T21:30:00.000Z')));
  assert.equal(evening.sentence, 'La soif du jour est passée : 2,4 mm aujourd’hui.');
  assert.equal(evening.bars.some((bar) => bar.current), true, '23 h, l’heure en cours');
  const polar = todayDayCurve(inputs({ location: { latitude: 78.2, longitude: 15.6 }, timeZone: 'Arctic/Longyearbyen', date: '2026-12-15', recorded: [] }), new Date('2026-12-15T11:00:00.000Z'));
  assert.equal(polar, null);
});

test('le titre garde les mots du tableau (D-328) ; aucun mot du calcul hors du « ? »', () => {
  assert.equal(DAY_CURVE_TITLE, 'Soif du jour, heure par heure');
  const curve = shown(todayDayCurve(inputs(), NOON));
  for (const word of TECHNICAL_WORDS) {
    for (const text of [DAY_CURVE_TITLE, curve.sentence, curve.strongest ?? '']) assert.ok(!text.includes(word), `${word} dans « ${text} »`);
  }
});

test('« Le détail » dit la courbe dans sa ligne de résumé ; sans elle, rien ne change', () => {
  const base = { tiles: 4, gardens: 3, weatherDays: 0, reservoirs: 0, limits: 0, toRefresh: 2, reliability: true };
  assert.equal(detailSummary(base), '4 chiffres · 3 jardins · 2 données à rafraîchir');
  assert.equal(detailSummary({ ...base, dayCurve: true }), '4 chiffres · 3 jardins · la soif heure par heure · 2 données à rafraîchir');
  assert.equal(detailSummary({ tiles: 0, gardens: 0, weatherDays: 0, reservoirs: 0, limits: 0, toRefresh: 0, reliability: false, dayCurve: true }), 'la soif heure par heure');
});

function viewInputs(enabled: TodayInputs['enabled'], dayCurve: TodayDayCurveInputs | null): TodayInputs {
  return {
    enabled,
    now: NOON,
    weather: { forecasts: [], frost: null, criteria: null },
    events: [],
    lateToleranceMinutes: 30,
    plan: null,
    shortagePlan: null,
    bedNames: new Map(),
    infrastructure: null,
    reliability: { actualRainMissingDates: null, automaticObjectiveMissingEt0Dates: null, soilGardensNeverObserved: [], speciesWithoutReference: [] },
    week: null,
    soil: null,
    dayCurve,
  };
}

test('la vue : la courbe avec « Objectifs et besoins » seulement, et rien de lu pour la pastille', () => {
  const all = [...FEATURE_IDS];
  const view = todayView(viewInputs(all, inputs()));
  assert.equal(view.dayCurve?.state, 'shown');
  assert.match(view.essential.detail ?? '', /la soif heure par heure/);
  assert.equal(todayView(viewInputs(all.filter((feature) => feature !== 'besoins'), inputs())).dayCurve, null);
  assert.equal(todayView(viewInputs(all, null)).dayCurve, null);
});
