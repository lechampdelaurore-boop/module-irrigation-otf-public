import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';

/**
 * Les parcours navigateur saisissent leurs dates et heures à l'heure de la
 * ferme, comme la page les lit, quel que soit le fuseau de la machine qui les
 * joue (docs/browser-journeys-contract.md, « Reproductibilité », point ouvert
 * 49, D-082). Écrites à l'heure de la machine, UTC en intégration continue,
 * elles reculaient d'une heure en hiver et de deux en été : le lundi peu après
 * minuit, « il y a une heure » tombait dans la semaine précédente, et
 * « demain » devenait aujourd'hui.
 */
test('un parcours écrit ses dates et heures à l’heure de la ferme, sur une machine en UTC comme ailleurs', () => {
  const moduleUrl = new URL('../e2e/support/materiel.ts', import.meta.url).href;
  // Le lundi 9 novembre 2026 à 0 h 30 à la ferme (heure d'hiver), puis le
  // mercredi 15 juillet 2026 à 0 h 15 (heure d'été).
  const script = `import { horodatageLocal } from ${JSON.stringify(moduleUrl)};
    const hiver = Date.UTC(2026, 10, 8, 23, 30);
    const ete = Date.UTC(2026, 6, 14, 22, 15);
    console.log(JSON.stringify([horodatageLocal(0, hiver), horodatageLocal(-60, hiver), horodatageLocal(24 * 60, hiver), horodatageLocal(0, ete)]));`;
  const ecrire = (tz: string) => JSON.parse(execFileSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', script],
    { env: { ...process.env, TZ: tz }, encoding: 'utf8' },
  )) as string[];
  const aLaFerme = ['2026-11-09T00:30', '2026-11-08T23:30', '2026-11-10T00:30', '2026-07-15T00:15'];
  assert.deepEqual(ecrire('UTC'), aLaFerme, 'une machine en UTC, comme l’intégration continue');
  assert.deepEqual(ecrire('America/New_York'), aLaFerme, 'une machine dans un autre fuseau');
  assert.deepEqual(ecrire('Europe/Paris'), aLaFerme, 'une machine à l’heure de la ferme');
});
