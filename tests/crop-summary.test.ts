import assert from 'node:assert/strict';
import test from 'node:test';
import type { KcOverride } from '../lib/domain/crop-water/kc.ts';
import { referenceCropSummary, referenceCropSummaryText } from '../lib/domain/crop-water/crop-summary.ts';
import { kcOverrideRows } from '../lib/domain/crop-water/settings-view.ts';
import type { CorrespondenceEntry, SeasonSpecies } from '../lib/domain/crop-water/species.ts';
import { rootingProfileView } from '../lib/domain/soil-reserve/rooting-view.ts';
import { BROCCOLI, CARROT } from './support/crop-water-references.ts';
import { fixed, profile, progressive } from './support/soil-reserve-fixtures.ts';

/**
 * Le résumé d'une culture, à droite de son nom sur « Besoin par culture »
 * (choix du porteur du 8 novembre 2026) : l'étendue des Kc qui comptent
 * aujourd'hui, la racine la plus profonde de son profil et les séries de la
 * saison qui s'y rattachent, sans rien calculer de plus que la carte ouverte.
 */

const TODAY = '2026-11-08';
const reference = (referenceCropId: string): CorrespondenceEntry['target'] => ({ kind: 'reference', referenceCropId, analogy: false });
const species = (plantId: string, series: string[], link: CorrespondenceEntry['target'] | null, exceptions: [string, CorrespondenceEntry['target']][] = []): SeasonSpecies => ({
  plantId,
  plantName: plantId,
  series: series.map((id) => ({ id, name: id })),
  link: link === null ? null : { plantId, seriesId: null, target: link },
  exceptions: exceptions.map(([seriesId, target]) => ({ plantId, seriesId, target })),
});

test('le résumé dit l’étendue des Kc du jour, la racine la plus profonde et les séries rattachées', () => {
  const rows = kcOverrideRows(CARROT, [], TODAY);
  const sourceKcs = rows.map((row) => row.sourceKc);
  const rooting = rootingProfileView(CARROT, [{ ...profile(CARROT.id, 0.35, [fixed(1, 0.2), progressive(2, 0.4, 0.7, 40)]), effectiveFrom: '1900-01-01', origin: 'common' as const }], TODAY);
  const seasonSpecies = [
    species('carotte', ['S1', 'S2'], reference(CARROT.id)),
    // Une exception l'emporte sur le rattachement de son espèce, dans les deux sens.
    species('panais', ['S3', 'S4'], reference(CARROT.id), [['S4', reference(BROCCOLI.id)]]),
    species('chou', ['S5', 'S6'], reference(BROCCOLI.id), [['S6', reference(CARROT.id)]]),
    // Une série qui porte deux espèces rattachées à la carotte compte une fois.
    species('radis', ['S1'], reference(CARROT.id)),
    species('fleur', ['S7'], { kind: 'without-reference' }),
  ];
  const summary = referenceCropSummary(CARROT.id, rows, rooting, seasonSpecies);
  assert.deepEqual(summary.kc, { min: Math.min(...sourceKcs), max: Math.max(...sourceKcs) });
  assert.deepEqual(summary.rootDepth, { meters: 0.7, proposed: false }, 'une profondeur progressive compte par sa fin');
  assert.equal(summary.seriesCount, 4, 'S1, S2, S3 et S6');
  assert.match(referenceCropSummaryText(summary), /^Kc de \d,\d{2,3} à \d,\d{2,3} · racines jusqu’à 0,70 m · 4 séries de la saison$/);
});

test('une surcharge du jour entre dans l’étendue ; une surcharge à venir non', () => {
  const rows = kcOverrideRows(CARROT, [], TODAY);
  const target = rows[0]!.target;
  const override = (kc: number, effectiveFrom: string): KcOverride => ({ referenceCropId: CARROT.id, target, kc, effectiveFrom, recordedAt: `${effectiveFrom}T08:00:00.000Z` });
  const rooting = rootingProfileView(CARROT, [], TODAY);
  const today = referenceCropSummary(CARROT.id, kcOverrideRows(CARROT, [override(1.6, '2026-11-01')], TODAY), rooting, []);
  assert.equal(today.kc?.max, 1.6);
  const later = referenceCropSummary(CARROT.id, kcOverrideRows(CARROT, [override(1.6, '2026-12-01')], TODAY), rooting, []);
  assert.notEqual(later.kc?.max, 1.6);
});

test('sans profil, les 30 cm proposés sont dits comme tels ; sans série, « aucune série de la saison »', () => {
  const summary = referenceCropSummary(BROCCOLI.id, kcOverrideRows(BROCCOLI, [], TODAY), rootingProfileView(BROCCOLI, [], TODAY), []);
  assert.deepEqual(summary.rootDepth, { meters: 0.3, proposed: true });
  assert.equal(summary.seriesCount, 0);
  assert.match(referenceCropSummaryText(summary), / · racines : 0,30 m proposés · aucune série de la saison$/);
});

test('un seul Kc s’écrit seul ; une série au singulier ; un stade sans ligne plus profond que le profil compte ses 30 cm proposés', () => {
  assert.equal(
    referenceCropSummaryText({ kc: { min: 0.85, max: 0.85 }, rootDepth: { meters: 0.4, proposed: false }, seriesCount: 1 }),
    'Kc 0,85 · racines jusqu’à 0,40 m · 1 série de la saison',
  );
  const shallow = rootingProfileView(CARROT, [{ ...profile(CARROT.id, null, [fixed(1, 0.2)]), origin: 'farm' as const }], TODAY);
  assert.deepEqual(referenceCropSummary(CARROT.id, [], shallow, []).rootDepth, { meters: 0.3, proposed: true });
  assert.equal(referenceCropSummary(CARROT.id, [], shallow, []).kc, null);
});
