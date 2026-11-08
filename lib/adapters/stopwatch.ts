/**
 * Chronomètre des journaux de durée (docs/planning-contract.md, « Les durées
 * du recalcul », point ouvert 34). Lire l'horloge est un échange avec
 * l'extérieur, d'où sa place dans les adaptateurs ; l'horloge est injectable
 * pour les tests. Dans un Worker Cloudflare, elle n'avance qu'aux
 * entrées-sorties : une phase de calcul pur mesure 0 ms et son temps se
 * reporte sur la phase suivante.
 */
export type Stopwatch = {
  /** Clôt la phase en cours sous ce nom et rend sa durée en millisecondes entières. */
  lap(name: string): number;
  /** Les phases closes, dans l'ordre de leur première apparition, et le total depuis le départ. */
  report(): { durationsMs: Record<string, number>; totalMs: number };
};

export function startStopwatch(now: () => number = () => performance.now()): Stopwatch {
  const startedAt = now();
  let lastAt = startedAt;
  const durationsMs: Record<string, number> = {};
  return {
    lap(name) {
      const at = now();
      const elapsed = Math.round(at - lastAt);
      durationsMs[name] = (durationsMs[name] ?? 0) + elapsed;
      lastAt = at;
      return elapsed;
    },
    report() {
      return { durationsMs: { ...durationsMs }, totalMs: Math.round(now() - startedAt) };
    },
  };
}
