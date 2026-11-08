/**
 * Journaliseur unique du module (contrat Q3) : une ligne JSON par événement sur
 * la sortie du Worker, en information ou en avertissement. Il remplace cinq
 * copies identiques réparties entre services et adaptateurs météo. Il vit dans
 * les adaptateurs : écrire sur la console est un échange avec l'extérieur, et
 * les adaptateurs comme les services peuvent l'importer.
 */
export type LogLevel = 'info' | 'warn';

export function logJsonLine(level: LogLevel, entry: Record<string, unknown>): void {
  const serialized = JSON.stringify(entry);
  if (level === 'warn') console.warn(serialized);
  else console.info(serialized);
}
