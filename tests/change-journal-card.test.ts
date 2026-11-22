import assert from 'node:assert/strict';
import test from 'node:test';
import { CHANGE_AUTHOR_OTHER, CHANGE_AUTHOR_SELF, changeJournalCard, snapshotNames } from '../lib/domain/change-journal/card';
import type { ChangeJournalEntry } from '../lib/domain/change-journal/entry';
import { changeFieldWords, type NameOf } from '../lib/domain/change-journal/fields';
import { CHANGE_SUBJECT_CODES, familyOfSubject, type ChangeSubject } from '../lib/domain/change-journal/subjects';
import { changeFamilyFilter, changeJournalEmpty, changeJournalIntro, changeJournalSummary, CHANGE_JOURNAL_FILTERS } from '../lib/domain/change-journal/view';
import { DEFAULT_CROP_ALERT_SETTINGS } from '../lib/domain/crop-alerts/settings';
import { FEATURE_IDS } from '../lib/domain/features/catalogue';
import { DEFAULT_PLANNING_SETTINGS } from '../lib/domain/planning/settings';
import { DEFAULT_SOIL_SETTINGS } from '../lib/domain/soil-reserve/soil';
import { FARM_SOIL } from './support/soil-reserve-fixtures';
import { mockSnapshot } from '../lib/adapters/mock-data';

/**
 * Le texte du journal des modifications (amélioration n° 7, §5.2 et §5.5 ;
 * D-288, F722) : chaque carte dit quand, qui, le sujet, l'action, l'objet,
 * puis l'avant et l'après de chaque champ, avec son unité ; jamais un code,
 * un identifiant ni une adresse.
 */

const ME = 'espace-de-la-ferme';
const NO_NAMES: NameOf = () => null;

function entry(subject: ChangeSubject, fields: Partial<ChangeJournalEntry>): ChangeJournalEntry {
  return {
    id: 'ligne-1',
    family: familyOfSubject(subject),
    subject,
    objectId: null,
    context: {},
    action: 'modifie',
    before: null,
    after: null,
    actorUserId: ME,
    createdAt: '2026-11-18T13:12:00.000Z',
    sequence: 1,
    ...fields,
  };
}

const card = (value: ChangeJournalEntry, nameOf = NO_NAMES) => changeJournalCard(value, { viewerUserId: ME, nameOf });
const lines = (value: ChangeJournalEntry, nameOf = NO_NAMES) => card(value, nameOf).lines.map(({ label, text }) => `${label} : ${text}`);

test('une carte dit quand, à l’heure de la ferme, et « Vous » ou « Une autre personne connectée », jamais une adresse', () => {
  const goal = entry('objectif-hydrique', { before: { amountMm: 30 }, after: { amountMm: 35 } });
  assert.deepEqual(
    { when: card(goal).when, who: card(goal).who, subject: card(goal).subject, action: card(goal).action, lines: lines(goal) },
    { when: '18/11/2026 à 14 h 12', who: CHANGE_AUTHOR_SELF, subject: 'Objectif hydrique', action: 'Modification', lines: ['Objectif : 30 mm → 35 mm'] },
  );
  assert.equal(card({ ...goal, actorUserId: 'une-autre-cle' }).who, CHANGE_AUTHOR_OTHER);
  assert.equal(CHANGE_AUTHOR_OTHER, 'Une autre personne connectée');
});

test('une création dit ce qui est créé, une suppression ce qui l’était ; une valeur vide dit ce qu’elle veut dire', () => {
  const created = entry('materiel', { action: 'cree', after: { name: 'Rampe 1', kind: 'sprinkler', mobility: 'mobile' }, context: { name: 'Rampe 1' } });
  assert.equal(card(created).action, 'Création');
  assert.equal(card(created).object, 'Rampe 1');
  assert.deepEqual(lines(created), ['Nom : Rampe 1', 'Nature : aspersion', 'Installation : mobile']);
  const removed = entry('reglage-de-materiel', {
    action: 'supprime',
    before: { name: 'Standard', rateMmPerHour: 12.5, leftProfile: '[]', rightProfile: '[]' },
    context: { equipment: 'Goutte', name: 'Standard' },
  });
  assert.equal(card(removed).action, 'Suppression');
  assert.equal(card(removed).object, 'Goutte › Standard');
  assert.deepEqual(lines(removed), ['Nom : Standard', 'Débit : 12,5 mm/h', 'Profil à gauche : aucun point', 'Profil à droite : aucun point']);
  const pump = entry('pompe-par-defaut', { before: { pump: 'Pompe 1' }, after: { pump: null }, context: { equipment: 'Rampe' } });
  assert.deepEqual(lines(pump), ['Pompe : Pompe 1 → aucune']);
});

test('l’objet d’un objectif : sa semaine et son lieu par leur nom ; sans nom connu, sa sorte ; toute la ferme', () => {
  const zone = mockSnapshot.zones[0];
  const plot = mockSnapshot.plots.find((item) => item.zoneId === zone.id)!;
  const bed = mockSnapshot.beds.find((item) => item.plotId === plot.id)!;
  const context = { season: 2026, weekStart: '2026-11-16', scopeType: 'bed', zoneId: zone.id, plotId: plot.id, bedId: bed.id };
  const goal = entry('objectif-hydrique', { action: 'cree', after: { amountMm: 12 }, context });
  assert.equal(card(goal, snapshotNames(mockSnapshot)).object, `semaine du 16/11/2026, Planche · ${bed.name}`);
  assert.equal(card(goal).object, 'semaine du 16/11/2026, une planche');
  const farm = entry('objectif-hydrique', { context: { season: 2026, weekStart: '2026-11-16', scopeType: 'farm', zoneId: null, plotId: null, bedId: null } });
  assert.equal(card(farm).object, 'semaine du 16/11/2026, toute la ferme');
  assert.equal(card(entry('seuil-de-gel', { context: { plantId: 'plante-x', seriesId: null } })).object, 'une culture');
  assert.equal(card(entry('limite-d-eau-du-jour', { context: { season: 2026 } })).object, 'saison 2026');
  assert.equal(card(entry('materiel', { context: { name: 'Rampe sud', copiedFrom: 'Rampe nord' } })).object, 'Rampe sud, copie de Rampe nord');
  assert.equal(card(entry('ressource', { context: { name: 'Forage', origin: 'debit-mesure' } })).object, 'Forage, débit mesuré');
  assert.equal(card(entry('fonctionnalites', {})).object, null);
});

test('chaque valeur s’écrit avec son unité et ses mots : heures, jours, parts, profils, origines, stades, planches', () => {
  assert.deepEqual(lines(entry('creneau-protege', { before: { saturday: 0, endMinute: 720 }, after: { saturday: 1, endMinute: 780 } })), [
    'Samedi : non → oui', 'Fin : 12 h → 13 h',
  ]);
  assert.deepEqual(lines(entry('reglages-du-planning', {
    before: { dosesDripMaximumMm: 10, forecastRainShare: 1, shortageStrategy: 'priority-then-equal-share', windowsSprinklerStartMinute: 1260, lateToleranceMinutes: 30 },
    after: { dosesDripMaximumMm: 12, forecastRainShare: 0.5, shortageStrategy: 'equal-share', windowsSprinklerStartMinute: 1290, lateToleranceMinutes: 45 },
  })), [
    'Dose maximale, goutte-à-goutte : 10 mm → 12 mm',
    'Part de la pluie prévue déduite : 100 % → 50 %',
    'Conduite en pénurie : prioritaires d’abord, puis part égale → part égale pour toutes',
    'Début de la plage, aspersion : 21 h → 21 h 30',
    'En retard après : 30 minutes → 45 minutes',
  ]);
  assert.deepEqual(lines(entry('reglage-de-materiel', { before: { leftProfile: '[]' }, after: { leftProfile: '[[2,8],[4,6]]' } })), [
    'Profil à gauche : aucun point → à 2 m, 8 mm/h ; à 4 m, 6 mm/h',
  ]);
  assert.deepEqual(lines(entry('pompe', { before: { origins: '[["resource","Forage",1]]', maximumFlowCubicMetersPerHour: 8 }, after: { origins: '[]', maximumFlowCubicMetersPerHour: 9 } })), [
    'Origines de l’eau : Forage (par défaut) → aucune', 'Débit maximal : 8 m³/h → 9 m³/h',
  ]);
  assert.deepEqual(lines(entry('profil-racinaire', { before: { stages: '[[null,0.3,null,null]]' }, after: { stages: '[[1,0.2,null,null],[2,0.3,0.5,30]]' } })), [
    'Profondeurs des racines : 0,3 m → 0,2 m ; 0,3 m à 0,5 m en 30 jours',
  ]);
  const bed = mockSnapshot.beds[0];
  assert.deepEqual(lines(entry('pose', { before: { beds: `["${bed.id}","inconnue"]` }, after: { beds: `["${bed.id}"]` } }), snapshotNames(mockSnapshot)), [
    `Planches : 2 planches → ${bed.name}`,
  ]);
  assert.deepEqual(lines(entry('rappel-du-soir', { before: { enabled: 0, time: '19:00' }, after: { enabled: 1, time: '20:30' } })), [
    'Rappel du soir : non → oui', 'Heure : 19 h → 20 h 30',
  ]);
  assert.deepEqual(lines(entry('fonctionnalites', { before: { alertesMeteo: 0 }, after: { alertesMeteo: 1 } })), [
    'Case « Alertes météo » : non cochée → cochée',
  ]);
  assert.deepEqual(lines(entry('limite-d-eau-du-jour', { before: { validUntil: null, maxCubicMetersPerDay: 12 }, after: { validUntil: '2026-09-30', maxCubicMetersPerDay: null } })), [
    'Jusqu’au : sans fin → 30/09/2026', 'Limite : 12 m³ par jour → aucune',
  ]);
  assert.deepEqual(lines(entry('alertes-de-culture', { before: { frostOffsetCelsius: 0 }, after: { frostOffsetCelsius: 1.5 } })), ['Microclimat : 0 °C → +1,5 °C']);
  assert.deepEqual(lines(entry('sol-de-parcelle', { before: { referenceShare: 2 / 3 }, after: { referenceShare: 0.5 } })), ['Part de la réserve utile : 67 % → 50 %']);
});

test('un champ que cette version ne sait pas lire est compté, jamais montré par son code', () => {
  assert.deepEqual(lines(entry('materiel', { before: { name: 'A', inconnu: 1 }, after: { name: 'B', inconnu: 2 } })), [
    'Nom : A → B', 'Autres champs : 1 champ que cette version ne sait pas lire',
  ]);
});

/** Les champs aplatis comme l'écrivain du planning les nomme (D-286, F719). */
function planningKeys(value: unknown, path: readonly string[] = []): string[] {
  if (typeof value === 'object' && value !== null) return Object.entries(value).flatMap(([name, inner]) => planningKeys(inner, [...path, name]));
  return [path.map((part, index) => (index === 0 ? part : part[0].toUpperCase() + part.slice(1))).join('')];
}

test('chaque champ des réglages gardés en entier a ses mots : planning, fonctionnalités, alertes, sol', () => {
  const expected: [ChangeSubject, string[]][] = [
    ['reglages-du-planning', planningKeys(DEFAULT_PLANNING_SETTINGS)],
    ['fonctionnalites', FEATURE_IDS.map((feature) => feature.replaceAll(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()))],
    ['alertes-de-culture', Object.keys(DEFAULT_CROP_ALERT_SETTINGS)],
    ['reglages-du-sol', ['thresholdMode', 'thresholdPercent', ...Object.keys(DEFAULT_SOIL_SETTINGS.surface), 'plasticMulchRainShare', 'effectiveFrom']],
    ['sol-de-parcelle', Object.keys(FARM_SOIL).filter((key) => !['zoneId', 'plotId', 'recordedAt'].includes(key))],
  ];
  const missing = expected.flatMap(([subject, keys]) => keys.filter((key) => changeFieldWords(subject, key) === null).map((key) => `${subject}.${key}`));
  assert.deepEqual(missing, []);
  assert.equal(planningKeys(DEFAULT_PLANNING_SETTINGS).length, 20);
  assert.ok(CHANGE_SUBJECT_CODES.every((subject) => changeFieldWords(subject, 'name') !== null), 'le nom se lit partout');
});

test('la section : la phrase de tête, la ligne du pli, la liste vide, le filtre', () => {
  const started = '2026-11-21T09:00:00.000Z';
  assert.match(changeJournalIntro(started), /Il commence à sa mise en service, le 21\/11\/2026 : les changements d’avant n’y sont pas\./);
  assert.equal(changeJournalSummary({ total: 0, latestAt: null, startedAt: started }), 'Aucune modification enregistrée depuis le 21/11/2026.');
  assert.equal(changeJournalSummary({ total: 12, latestAt: '2026-11-21T13:12:00.000Z', startedAt: started }), '12 modifications, la dernière le 21/11/2026 à 14 h 12.');
  assert.equal(changeJournalSummary({ total: 1, latestAt: '2026-11-21T13:12:00.000Z', startedAt: started }), '1 modification, la dernière le 21/11/2026 à 14 h 12.');
  assert.equal(changeJournalEmpty(started, 'materiel'), 'Aucune modification enregistrée dans « Matériel et ressources ».');
  assert.equal(changeJournalEmpty(null, null), 'Aucune modification enregistrée.');
  assert.deepEqual(CHANGE_JOURNAL_FILTERS.map(({ label }) => label), ['Tout', 'Objectifs', 'Réglages', 'Matériel et ressources']);
  assert.equal(changeFamilyFilter('reglage'), 'reglage');
  assert.equal(changeFamilyFilter('DROP TABLE'), null);
  assert.equal(changeFamilyFilter(undefined), null);
});

test('un stade sensible au manque d’eau : la culture et le stade par leur nom, puis l’avant et l’après (amélioration n° 4, D-290)', () => {
  const stage = entry('stade-sensible', {
    objectId: 'criiam-tomate',
    context: { name: 'Tomate', rank: 1, stage: 'Plantation → Reprise' },
    before: { sensitive: 0 },
    after: { sensitive: 1 },
  });
  assert.deepEqual([card(stage).subject, card(stage).object, lines(stage)], [
    'Stade sensible au manque d’eau', 'Tomate, Plantation → Reprise', ['Sensible au manque d’eau : non → oui'],
  ]);
});
