import type { SettingProvenance } from '@/lib/domain/irrigation-calculator/provenance';

/**
 * Ce que la page « Matériel et placement » donne au calculateur d'irrigation
 * quand sa case est cochée (3.8 bis) : la provenance de chaque réglage, par
 * identifiant ; un réglage absent est « saisi ». Case décochée : `null`, ni
 * bouton, ni étiquette, ni case « mesuré ».
 */
export type CalculatorContext = {
  provenances: Readonly<Record<string, SettingProvenance>>;
};
