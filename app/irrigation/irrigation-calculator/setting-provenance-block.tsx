'use client';

import type { CalculatorInputs } from '@/lib/domain/irrigation-calculator/inputs';
import {
  calculatorSettingValues,
  provenanceFromCalculation,
  SETTING_LABELS,
  settingValuesEqual,
  type SettingLabel,
  type SettingProvenance,
  type SettingValues,
} from '@/lib/domain/irrigation-calculator/provenance';

/**
 * Dans le formulaire d'un réglage, quand le calculateur est coché (3.8 bis,
 * docs/irrigation-calculator-contract.md, sections 4, 10 et 11) : le bouton
 * « Calculer depuis le matériel », l'étiquette que le réglage aura une fois
 * enregistré, et la case « mesuré », seul moyen d'obtenir cette étiquette.
 */

/**
 * L'étiquette qu'annonce le formulaire, selon la même règle que
 * l'enregistrement (`decideProvenance`) : la case « mesuré » ; un résultat du
 * calculateur que les valeurs reprennent exactement ; sinon la provenance
 * enregistrée tant que les valeurs n'ont pas changé ; sinon « saisi ».
 */
export function formProvenanceLabel(input: {
  measured: boolean;
  calculation: CalculatorInputs | null;
  values: SettingValues;
  stored: { provenance: SettingProvenance | null; values: SettingValues } | null;
}): SettingLabel {
  if (input.measured) return 'measured';
  if (input.calculation) {
    const computed = calculatorSettingValues(input.calculation);
    const provenance = provenanceFromCalculation(input.calculation);
    if (computed && provenance && settingValuesEqual(computed, input.values)) return provenance.level;
  }
  const stored = input.stored;
  if (stored?.provenance && stored.provenance.level !== 'measured' && settingValuesEqual(stored.values, input.values)) {
    return stored.provenance.level;
  }
  return 'entered';
}

export function SettingProvenanceLabel({ label }: { label: SettingLabel }) {
  return <span className="setting-provenance" data-level={label}>{SETTING_LABELS[label]}</span>;
}

export function SettingProvenanceBlock({
  label,
  measured,
  disabled,
  onMeasuredChange,
  onOpenCalculator,
}: {
  label: SettingLabel;
  measured: boolean;
  disabled: boolean;
  onMeasuredChange: (measured: boolean) => void;
  onOpenCalculator: () => void;
}) {
  return (
    <div className="setting-provenance-block">
      <div>
        <span>Provenance des valeurs</span>
        <SettingProvenanceLabel label={label} />
      </div>
      <button className="secondary-button" type="button" disabled={disabled} onClick={onOpenCalculator}>
        Calculer depuis le matériel
      </button>
      <label className="calculator-check">
        <input type="checkbox" checked={measured} disabled={disabled} onChange={(event) => onMeasuredChange(event.target.checked)} />
        <span>Ces valeurs viennent de mes mesures au pluviomètre</span>
      </label>
    </div>
  );
}
