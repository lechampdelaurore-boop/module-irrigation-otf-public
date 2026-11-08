'use client';

import { useMemo, useState } from 'react';
import { calculateIrrigationSetting, formatCalculatorNumber as n } from '@/lib/domain/irrigation-calculator/calculate';
import { applyExample, examplesForKind } from '@/lib/domain/irrigation-calculator/examples';
import {
  FIELD_LABELS,
  METHOD_LABELS,
  NOZZLE_PRESSURE_EXPONENT,
  SELF_REGULATING_PRESSURE_EXPONENT,
  methodsForKind,
  type CalculatorField,
  type CalculatorInputs,
  type CalculatorMethod,
} from '@/lib/domain/irrigation-calculator/inputs';
import { calculatorSettingValues, type SettingValues } from '@/lib/domain/irrigation-calculator/provenance';
import {
  emptyFormState,
  formStateFromInputs,
  formatFieldValue,
  inputsFromFormState,
  switchFlowUnit,
  switchMethod,
  type CalculatorFormState,
  type FlowUnit,
} from './calculator-form';
import { CalculatorResultPanel } from './calculator-result';

/**
 * Le calculateur d'irrigation (3.8 bis, docs/irrigation-calculator-contract.md,
 * section 11) : un assistant de saisie dans la fenêtre des réglages du
 * matériel. L'utilisateur saisit ce qu'il connaît ; le résultat se lit en
 * direct ; « Utiliser ce résultat » remplit le formulaire du réglage, et rien
 * n'est enregistré avant sa validation.
 */

type FieldSpec = { field: CalculatorField; unit: string; hint?: string; optional?: boolean };

const WIDTH_LIMIT = 'Un réglage vaut pour toutes les planches où le matériel est posé : une planche plus large ou plus étroite recevra en réalité un autre mm/h.';

const METHOD_FIELDS: Readonly<Record<CalculatorMethod, readonly FieldSpec[]>> = {
  drip_per_bed: [
    { field: 'lineCount', unit: 'lignes', hint: 'Lignes de goutte-à-goutte posées sur une planche.' },
    { field: 'spacingMeters', unit: 'm', hint: 'Entre deux goutteurs d’une même ligne.' },
    { field: 'bedWidthMeters', unit: 'm', hint: WIDTH_LIMIT },
    { field: 'efficiencyPercent', unit: '%', hint: '100 % : le tuyau ne mouille que la planche.' },
  ],
  drip_per_valve: [
    { field: 'lineCount', unit: 'lignes', hint: 'Toutes les lignes ouvertes par la vanne.' },
    { field: 'lineLengthMeters', unit: 'm' },
    { field: 'spacingMeters', unit: 'm', hint: 'Entre deux goutteurs d’une même ligne.' },
    { field: 'lineGapMeters', unit: 'm', hint: 'Sans lui, seul le débit de la vanne se calcule.', optional: true },
    { field: 'efficiencyPercent', unit: '%' },
  ],
  sprinkler_mean: [
    { field: 'spacingMeters', unit: 'm', hint: 'Entre deux asperseurs le long de la rampe.' },
    { field: 'wettedWidthMeters', unit: 'm', hint: 'La largeur de la bande que la rampe arrose.' },
    { field: 'efficiencyPercent', unit: '%', hint: '80 % proposé : la part d’eau qui tombe vraiment sur la bande.' },
    { field: 'reachMeters', unit: 'm', hint: 'Le rayon mouillé ; la moitié du diamètre de la fiche.', optional: true },
    { field: 'sprinklerCount', unit: 'asperseurs', hint: 'Pour l’eau pompée de la rampe.', optional: true },
  ],
  sprinkler_cone: [
    { field: 'spacingMeters', unit: 'm', hint: 'Entre deux asperseurs le long de la rampe.' },
    { field: 'reachMeters', unit: 'm', hint: 'Le rayon mouillé ; la moitié du diamètre de la fiche.' },
    { field: 'bedAndPathWidthMeters', unit: 'm', hint: 'Pour lire la part d’eau qui tombe sur une planche ; le profil n’en dépend pas.', optional: true },
    { field: 'sprinklerCount', unit: 'asperseurs', hint: 'Pour l’eau pompée de la rampe.', optional: true },
  ],
};

const PRESSURE_FIELDS: readonly FieldSpec[] = [
  { field: 'referencePressureBar', unit: 'bar', hint: 'La pression à laquelle la fiche donne son débit.' },
  { field: 'actualPressureBar', unit: 'bar', hint: 'Sans elle, le débit est celui de la fiche.', optional: true },
  { field: 'pressureExponent', unit: '', hint: '0 pour un matériel autorégulant, 0,5 pour une buse.' },
  { field: 'pressureRangeMinBar', unit: 'bar', optional: true },
  { field: 'pressureRangeMaxBar', unit: 'bar', optional: true },
];

function suggestedName(inputs: CalculatorInputs, values: SettingValues): string {
  if (values.kind === 'drip') {
    const lines = inputs.method === 'drip_per_bed' && inputs.lineCount !== null ? `${inputs.lineCount} ligne${inputs.lineCount > 1 ? 's' : ''} · ` : '';
    return `${lines}${n(values.rateMmPerHour)} mm/h`;
  }
  const top = values.leftProfile[0]?.rateMmPerHour ?? 0;
  const reach = values.leftProfile.at(-1)?.distanceMeters ?? 0;
  return inputs.method === 'sprinkler_cone' ? `Cône · ${n(top)} mm/h · ${n(reach)} m` : `${n(top)} mm/h sur ${n(2 * reach)} m`;
}

export function IrrigationCalculator({
  kind,
  initialInputs,
  current,
  onUse,
  onCancel,
}: {
  kind: 'drip' | 'sprinkler';
  initialInputs: CalculatorInputs | null;
  /** Les valeurs enregistrées du réglage ouvert, pour l'écart ; `null` pour un nouveau réglage. */
  current: SettingValues | null;
  onUse: (use: { inputs: CalculatorInputs; values: SettingValues; name: string }) => void;
  onCancel: () => void;
}) {
  const methods = methodsForKind(kind);
  const [form, setForm] = useState<CalculatorFormState>(() =>
    initialInputs && methods.includes(initialInputs.method) ? formStateFromInputs(initialInputs) : emptyFormState(methods[0]!));
  const inputs = useMemo(() => inputsFromFormState(form), [form]);
  const result = useMemo(() => calculateIrrigationSetting(inputs), [inputs]);
  const computed = useMemo(() => calculatorSettingValues(inputs), [inputs]);
  const examples = examplesForKind(kind);
  const example = examples.find((item) => item.id === form.exampleId) ?? null;
  const errors = new Map(result.errors.map((error) => [error.field, error.message]));
  const flowNoun = kind === 'drip' ? 'd’un goutteur' : 'd’un asperseur';
  const flowUnit: FlowUnit = kind === 'drip' ? 'l/h' : form.flowUnit;

  const setField = (field: CalculatorField, value: string) =>
    setForm((state) => ({ ...state, fields: { ...state.fields, [field]: value } }));
  const chooseExample = (id: string) => {
    const chosen = examples.find((item) => item.id === id);
    if (!chosen) return setForm((state) => ({ ...state, exampleId: null }));
    // L'exemple préremplit la manière choisie ; sa manière conseillée est dite sous la liste.
    setForm(formStateFromInputs(applyExample(inputsFromFormState(switchFlowUnit(form, 'l/h')), chosen), chosen.id));
  };

  const renderField = (spec: FieldSpec, label = FIELD_LABELS[spec.field]) => {
    const id = `calculator-${spec.field}`;
    const error = errors.get(spec.field);
    const describedBy = [spec.hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
    return (
      <div className="calculator-field" key={spec.field} data-invalid={error ? 'true' : undefined}>
        <label htmlFor={id}>{label.charAt(0).toUpperCase() + label.slice(1)}{spec.optional ? <small> (facultatif)</small> : null}</label>
        <div className="unit-input">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={form.fields[spec.field]}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => setField(spec.field, event.target.value)}
          />
          {spec.unit ? <strong aria-hidden="true">{spec.unit}</strong> : null}
        </div>
        {spec.hint ? <small id={`${id}-hint`}>{spec.hint}</small> : null}
        {error ? <em id={`${id}-error`} role="alert">{error}</em> : null}
      </div>
    );
  };

  const selfRegulating = form.fields.pressureExponent === formatFieldValue(SELF_REGULATING_PRESSURE_EXPONENT);

  return (
    <div className="irrigation-calculator">
      <div className="calculator-inputs">
        <fieldset className="calculator-methods">
          <legend>Manière de calculer</legend>
          {methods.map((method) => (
            <label key={method} data-checked={form.method === method}>
              <input
                type="radio"
                name="calculator-method"
                checked={form.method === method}
                onChange={() => setForm((state) => switchMethod(state, method))}
              />
              <span>{METHOD_LABELS[method]}</span>
            </label>
          ))}
        </fieldset>

        <div className="calculator-field">
          <label htmlFor="calculator-example">Partir d’un exemple</label>
          <select id="calculator-example" value={form.exampleId ?? ''} onChange={(event) => chooseExample(event.target.value)}>
            <option value="">Aucun : je saisis mon matériel</option>
            {examples.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        {example ? (
          <p className="calculator-example-source">
            {example.source} Lu le {new Date(`${example.readOn}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. {example.reserve} Manière conseillée : {METHOD_LABELS[example.method].toLowerCase()}. Les champs restent modifiables.
          </p>
        ) : null}

        <fieldset className="calculator-group">
          <legend>Débit {flowNoun}</legend>
          {kind === 'sprinkler' ? (
            <div className="calculator-field">
              <label htmlFor="calculator-flow-unit">Unité des débits</label>
              <select id="calculator-flow-unit" value={form.flowUnit} onChange={(event) => setForm((state) => switchFlowUnit(state, event.target.value as FlowUnit))}>
                <option value="l/h">litres par heure (l/h)</option>
                <option value="m³/h">mètres cubes par heure (m³/h)</option>
              </select>
            </div>
          ) : null}
          {renderField({ field: 'referenceFlowLitersPerHour', unit: flowUnit, hint: 'Le débit nominal lu sur la fiche du fabricant.' })}
          {renderField({ field: 'measuredFlowLitersPerHour', unit: flowUnit, hint: 'Un débit que vous avez mesuré prime sur la fiche, tel quel.', optional: true })}
        </fieldset>

        <fieldset className="calculator-group">
          <legend>{kind === 'drip' ? 'Les lignes' : 'La rampe'}</legend>
          {METHOD_FIELDS[form.method].map((spec) => renderField(spec))}
        </fieldset>

        <details className="calculator-group calculator-pressure" open={form.fields.actualPressureBar !== '' || undefined}>
          <summary>Pression (facultatif)</summary>
          <label className="calculator-check">
            <input
              type="checkbox"
              checked={selfRegulating}
              onChange={(event) => setField('pressureExponent', formatFieldValue(event.target.checked ? SELF_REGULATING_PRESSURE_EXPONENT : NOZZLE_PRESSURE_EXPONENT))}
            />
            <span>Matériel autorégulant : son débit ne dépend pas de la pression dans sa plage.</span>
          </label>
          {PRESSURE_FIELDS.map((spec) => renderField(spec))}
        </details>
      </div>

      <div className="calculator-output">
        <CalculatorResultPanel result={result} computed={computed} current={current} />
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel}>Revenir au réglage</button>
          <button
            className="primary-button"
            type="button"
            disabled={!computed}
            onClick={() => computed && onUse({ inputs, values: computed, name: suggestedName(inputs, computed) })}
          >
            Utiliser ce résultat
          </button>
        </footer>
        <p className="calculator-note">« Utiliser ce résultat » remplit le réglage ; rien n’est enregistré avant « Enregistrer ».</p>
      </div>
    </div>
  );
}
