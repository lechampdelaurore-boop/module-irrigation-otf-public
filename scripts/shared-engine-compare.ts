import { compareEnginesOnDrawnBeds, type EngineComparison } from '../tests/support/soil-reserve-draw.ts';

/**
 * La comparaison tirée au hasard des deux calculs de la jauge
 * (docs/shared-engine-adapter-contract.md, « L'interrupteur et la preuve
 * d'égalité ») : l'ancien calcul du module et le moteur commun, sur des
 * planches tirées depuis des graines fixes, chaque grandeur de chaque jour à
 * 0,000001 mm près. Il mesure : il ne lit ni la ferme ni la base, n'écrit
 * rien, n'appelle aucun réseau. Sa sortie se colle dans la PR.
 *
 *   node --experimental-strip-types --import ./tests/support/register.mjs scripts/shared-engine-compare.ts [première graine] [graines] [planches par graine]
 */

const TOLERANCE = 1e-6;
const SHOWN_GAPS = 20;

const [firstSeed, seeds, beds] = [process.argv[2] ?? '1', process.argv[3] ?? '10', process.argv[4] ?? '2000'].map(Number);
const total: EngineComparison = { beds: 0, days: 0, seen: {}, maxGap: 0, gaps: [] };
const started = performance.now();
for (let seed = firstSeed; seed < firstSeed + seeds; seed += 1) {
  const result = compareEnginesOnDrawnBeds(seed, beds, TOLERANCE);
  total.beds += result.beds;
  total.days += result.days;
  total.maxGap = Math.max(total.maxGap, result.maxGap);
  for (const [what, count] of Object.entries(result.seen)) total.seen[what] = (total.seen[what] ?? 0) + count;
  total.gaps.push(...result.gaps.map((gap) => ({ ...gap, field: `graine ${seed}, ${gap.field}` })));
}

const fr = new Intl.NumberFormat('fr-FR');
console.log('Jauge : l’ancien calcul du module contre le moteur commun (bedSoilReserve, « module » et « commun »)');
console.log(`Graines ${firstSeed} à ${firstSeed + seeds - 1}, ${fr.format(total.beds)} planches, ${fr.format(total.days)} jours comparés en ${fr.format(Math.round(performance.now() - started))} ms.`);
console.log('Ce que les planches ont couvert (jours, sauf mention) :');
for (const [what, count] of Object.entries(total.seen).sort(([a], [b]) => a.localeCompare(b, 'fr'))) console.log(`  ${what} : ${fr.format(count)}`);
console.log(`Plus grand écart entre deux nombres : ${total.maxGap.toExponential(1)} (mm, % du plein ou part du jour).`);
if (total.gaps.length === 0) {
  console.log(`Aucun écart (tolérance ${TOLERANCE} mm ; critère du contrat 0,01 mm, MC-30).`);
} else {
  console.log(`${fr.format(total.gaps.length)} écarts ; les ${Math.min(SHOWN_GAPS, total.gaps.length)} premiers :`);
  for (const gap of total.gaps.slice(0, SHOWN_GAPS)) {
    console.log(`  planche ${gap.bed}, ${gap.date}, ${gap.field} : module ${JSON.stringify(gap.module)}, commun ${JSON.stringify(gap.commun)}`);
  }
  process.exitCode = 1;
}
