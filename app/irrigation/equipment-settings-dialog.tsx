'use client';

import type { EquipmentListItem, EquipmentSettingRecord } from '@/lib/domain/equipment-record';
import { useEffect, useMemo, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { interpolateSprinklerRate } from '@/lib/domain/irrigation-calculations';
import { MAX_SETTINGS_PER_EQUIPMENT } from '@/lib/domain/irrigation-domain';
import {
  deleteEquipmentSettingAction,
  saveEquipmentSettingAction,
} from './equipment-actions';
import type { CalculatorInputs } from '@/lib/domain/irrigation-calculator/inputs';
import type { SettingValues } from '@/lib/domain/irrigation-calculator/provenance';
import type { CalculatorContext } from './irrigation-calculator/calculator-context';
import { IrrigationCalculator } from './irrigation-calculator/irrigation-calculator';
import {
  formProvenanceLabel,
  SettingProvenanceBlock,
  SettingProvenanceLabel,
} from './irrigation-calculator/setting-provenance-block';

type Props = {
  equipment: EquipmentListItem;
  /** Le calculateur d'irrigation, si sa case est cochée (3.8 bis). */
  calculator: CalculatorContext | null;
  onClose: () => void;
};

type ProfilePointForm = {
  key: string;
  distance: string;
  rate: string;
};

type SettingEditorState = {
  id: string | null;
  name: string;
  symmetric: boolean;
  leftProfile: ProfilePointForm[];
  rightProfile: ProfilePointForm[];
  dripRate: string;
  previewDistance: string;
  /** Les entrées du calculateur dont le résultat a rempli le formulaire (3.8 bis). */
  calculation: CalculatorInputs | null;
  measured: boolean;
};

export function EquipmentSettingsDialog({ equipment, calculator, onClose }: Props) {
  const [editor, setEditor] = useState<SettingEditorState | null>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isPending) return;
      if (calculatorOpen) setCalculatorOpen(false);
      else if (editor) setEditor(null);
      else onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [calculatorOpen, editor, isPending, onClose]);

  const storedSetting = editor?.id ? equipment.settings.find((setting) => setting.id === editor.id) ?? null : null;
  const stored = storedSetting
    ? { provenance: calculator?.provenances[storedSetting.id] ?? null, values: storedValues(storedSetting) }
    : null;
  const back = () => (calculatorOpen ? setCalculatorOpen(false) : editor ? setEditor(null) : onClose());

  const openCreate = () => {
    clearMessages();
    setEditor({
      id: null,
      name: '',
      symmetric: equipment.kind === 'sprinkler',
      leftProfile: [newPoint('0', '')],
      rightProfile: [newPoint('0', '')],
      dripRate: '',
      previewDistance: '0.60',
      calculation: null,
      measured: false,
    });
  };

  const openEdit = (setting: EquipmentSettingRecord) => {
    clearMessages();
    if (setting.kind === 'drip') {
      setEditor({
        id: setting.id,
        name: setting.name,
        symmetric: false,
        leftProfile: [newPoint('0', '')],
        rightProfile: [newPoint('0', '')],
        dripRate: String(setting.rateMmPerHour),
        previewDistance: '0.60',
        calculation: null,
        measured: calculator?.provenances[setting.id]?.level === 'measured',
      });
      return;
    }

    setEditor({
      id: setting.id,
      name: setting.name,
      symmetric: profilesMatch(setting.leftProfile, setting.rightProfile),
      leftProfile: setting.leftProfile.map((point) =>
        newPoint(String(point.distanceMeters), String(point.rateMmPerHour)),
      ),
      rightProfile: setting.rightProfile.map((point) =>
        newPoint(String(point.distanceMeters), String(point.rateMmPerHour)),
      ),
      dripRate: '',
      previewDistance: '0.60',
      calculation: null,
      measured: calculator?.provenances[setting.id]?.level === 'measured',
    });
  };

  const applyCalculation = ({ inputs, values, name }: { inputs: CalculatorInputs; values: SettingValues; name: string }) => {
    if (!editor) return;
    const points = values.kind === 'sprinkler'
      ? values.leftProfile.map((point) => newPoint(String(point.distanceMeters), String(point.rateMmPerHour)))
      : null;
    setEditor({
      ...editor,
      name: editor.name.trim() ? editor.name : name,
      dripRate: values.kind === 'drip' ? String(values.rateMmPerHour) : editor.dripRate,
      symmetric: points ? true : editor.symmetric,
      leftProfile: points ?? editor.leftProfile,
      rightProfile: points ? cloneProfile(points) : editor.rightProfile,
      calculation: inputs,
      measured: false,
    });
    setCalculatorOpen(false);
  };

  const submitSetting = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;

    setError(null);
    startTransition(async () => {
      const setting =
        equipment.kind === 'drip'
          ? {
              name: editor.name,
              kind: 'drip' as const,
              rateMmPerHour: parseDecimal(editor.dripRate),
            }
          : {
              name: editor.name,
              kind: 'sprinkler' as const,
              leftProfile: profileValues(editor.leftProfile),
              rightProfile: profileValues(
                editor.symmetric ? editor.leftProfile : editor.rightProfile,
              ),
            };

      const result = await saveEquipmentSettingAction({
        id: editor.id,
        equipmentId: equipment.id,
        setting,
        provenance: calculator ? { calculation: editor.calculation, measured: editor.measured } : undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setEditor(null);
      setNotice(result.message);
    });
  };

  const deleteSetting = (setting: EquipmentSettingRecord) => {
    if (
      !window.confirm(
        `Supprimer le réglage « ${setting.name} » ? Cette action est irréversible.`,
      )
    ) {
      return;
    }

    clearMessages();
    startTransition(async () => {
      const result = await deleteEquipmentSettingAction({
        equipmentId: equipment.id,
        settingId: setting.id,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(result.message);
    });
  };

  const clearMessages = () => {
    setNotice(null);
    setError(null);
  };

  return (
    <div
      className="equipment-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || isPending) return;
        back();
      }}
    >
      <section
        className="equipment-dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
      >
        <header>
          <div>
            <small>{equipment.kind === 'sprinkler' ? 'Aspersion' : 'Goutte-à-goutte'}</small>
            <h3 id="settings-dialog-title">
              {calculatorOpen ? 'Calculer depuis le matériel' : editor ? (editor.id ? 'Modifier le réglage' : 'Nouveau réglage') : equipment.name}
            </h3>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={back}
            aria-label={calculatorOpen ? 'Revenir au réglage' : editor ? 'Revenir aux réglages' : 'Fermer'}
          >
            {editor ? '←' : '×'}
          </button>
        </header>

        {editor && calculatorOpen ? (
          <IrrigationCalculator
            kind={equipment.kind}
            initialInputs={editor.calculation ?? stored?.provenance?.inputs ?? null}
            current={stored?.values ?? null}
            onUse={applyCalculation}
            onCancel={() => setCalculatorOpen(false)}
          />
        ) : editor ? (
          <SettingEditor
            equipment={equipment}
            editor={editor}
            error={error}
            isPending={isPending}
            provenance={calculator ? (
              <SettingProvenanceBlock
                label={formProvenanceLabel({ measured: editor.measured, calculation: editor.calculation, values: editorValues(equipment, editor), stored })}
                measured={editor.measured}
                disabled={isPending}
                onMeasuredChange={(measured) => setEditor({ ...editor, measured, calculation: measured ? null : editor.calculation })}
                onOpenCalculator={() => setCalculatorOpen(true)}
              />
            ) : null}
            onChange={setEditor}
            onCancel={() => setEditor(null)}
            onSubmit={submitSetting}
          />
        ) : (
          <div className="settings-manager-body">
            <div className="settings-manager-intro">
              <div>
                <strong>Réglages disponibles</strong>
                <span>{equipment.settingsCount} sur {MAX_SETTINGS_PER_EQUIPMENT}</span>
              </div>
              <button
                className="primary-button"
                type="button"
                disabled={
                  isPending ||
                  equipment.settingsCount >= MAX_SETTINGS_PER_EQUIPMENT
                }
                onClick={openCreate}
              >
                Ajouter un réglage
              </button>
            </div>

            {notice ? <p className="equipment-notice" role="status">{notice}</p> : null}
            {error ? <p className="equipment-error" role="alert">{error}</p> : null}

            {equipment.settings.length > 0 ? (
              <div className="settings-list">
                {equipment.settings.map((setting) => (
                  <article className="setting-card" key={setting.id}>
                    <span className="setting-position">{setting.position}</span>
                    <div>
                      <strong>{setting.name}</strong>
                      <small>
                        {settingSummary(setting)}
                        {calculator ? <> · <SettingProvenanceLabel label={calculator.provenances[setting.id]?.level ?? 'entered'} /></> : null}
                      </small>
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => openEdit(setting)}
                    >
                      Modifier
                    </button>
                    <button
                      className="setting-delete-button"
                      type="button"
                      disabled={isPending}
                      onClick={() => deleteSetting(setting)}
                    >
                      Supprimer
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="settings-empty-state">
                <strong>Aucun réglage défini</strong>
                <p>
                  {equipment.kind === 'sprinkler'
                    ? 'Décrivez le débit en mm/h à différentes distances du matériel.'
                    : 'Indiquez le débit uniforme en mm/h apporté à chaque planche.'}
                </p>
                <button type="button" onClick={openCreate}>Créer le premier réglage</button>
              </div>
            )}

            <p className="settings-calculation-note">
              Les apports seront calculés à partir de ces valeurs lors du placement
              sur le plan. Au-delà de la dernière distance d’aspersion, le débit est nul.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function SettingEditor({
  equipment,
  editor,
  error,
  isPending,
  provenance,
  onChange,
  onCancel,
  onSubmit,
}: {
  equipment: EquipmentListItem;
  editor: SettingEditorState;
  error: string | null;
  isPending: boolean;
  provenance: ReactNode;
  onChange: (editor: SettingEditorState) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const previewDistance = parseDecimal(editor.previewDistance);
  const leftPreview = useMemo(
    () => interpolateSprinklerRate(profileValues(editor.leftProfile), previewDistance),
    [editor.leftProfile, previewDistance],
  );
  const rightPreview = useMemo(
    () =>
      interpolateSprinklerRate(
        profileValues(editor.symmetric ? editor.leftProfile : editor.rightProfile),
        previewDistance,
      ),
    [editor.leftProfile, editor.rightProfile, editor.symmetric, previewDistance],
  );

  const updateProfile = (
    side: 'leftProfile' | 'rightProfile',
    profile: ProfilePointForm[],
  ) => onChange({ ...editor, [side]: profile });

  return (
    <form className="setting-editor-form" onSubmit={onSubmit}>
      <label className="equipment-field">
        <span>Nom du réglage</span>
        <input
          autoFocus
          required
          maxLength={80}
          value={editor.name}
          onChange={(event) => onChange({ ...editor, name: event.target.value })}
          placeholder="Ex. Réglage doux"
        />
      </label>

      {provenance}

      {equipment.kind === 'drip' ? (
        <div className="drip-rate-editor">
          <label className="equipment-field">
            <span>Apport uniforme</span>
            <div className="unit-input">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={editor.dripRate}
                onChange={(event) =>
                  onChange({ ...editor, dripRate: event.target.value })
                }
              />
              <strong>mm/h par planche</strong>
            </div>
          </label>
          <p>
            Une valeur de 14 mm/h apporte 14 litres par heure sur chaque m²
            de planche sélectionnée.
          </p>
        </div>
      ) : (
        <>
          <label className="symmetry-toggle">
            <input
              type="checkbox"
              checked={editor.symmetric}
              onChange={(event) =>
                onChange({
                  ...editor,
                  symmetric: event.target.checked,
                  rightProfile: event.target.checked
                    ? cloneProfile(editor.leftProfile)
                    : editor.rightProfile,
                })
              }
            />
            <span>
              <strong>Même courbe à gauche et à droite</strong>
              <small>Décochez pour décrire une aspersion asymétrique.</small>
            </span>
          </label>

          <div className="profile-editors" data-symmetric={editor.symmetric}>
            <ProfileEditor
              title="Côté gauche"
              points={editor.leftProfile}
              onChange={(points) => updateProfile('leftProfile', points)}
            />
            {!editor.symmetric ? (
              <ProfileEditor
                title="Côté droit"
                points={editor.rightProfile}
                onChange={(points) => updateProfile('rightProfile', points)}
              />
            ) : null}
          </div>

          <div className="profile-preview">
            <label>
              <span>Tester à</span>
              <div className="unit-input compact-unit-input">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editor.previewDistance}
                  onChange={(event) =>
                    onChange({ ...editor, previewDistance: event.target.value })
                  }
                />
                <strong>m</strong>
              </div>
            </label>
            <div><small>Gauche</small><strong>{formatRate(leftPreview)} mm/h</strong></div>
            <div><small>Droite</small><strong>{formatRate(rightPreview)} mm/h</strong></div>
          </div>
          <p className="profile-help">
            Entre deux distances, le débit est interpolé linéairement. Le futur
            calcul par planche utilisera la distance jusqu’au centre de la planche.
          </p>
        </>
      )}

      {error ? <p className="equipment-error" role="alert">{error}</p> : null}
      <footer>
        <button className="secondary-button" type="button" disabled={isPending} onClick={onCancel}>Annuler</button>
        <button className="primary-button" type="submit" disabled={isPending}>
          {isPending ? 'Enregistrement…' : editor.id ? 'Enregistrer' : 'Ajouter le réglage'}
        </button>
      </footer>
    </form>
  );
}

function ProfileEditor({
  title,
  points,
  onChange,
}: {
  title: string;
  points: ProfilePointForm[];
  onChange: (points: ProfilePointForm[]) => void;
}) {
  const updatePoint = (
    key: string,
    field: 'distance' | 'rate',
    value: string,
  ) =>
    onChange(
      points.map((point) =>
        point.key === key ? { ...point, [field]: value } : point,
      ),
    );

  const addPoint = () => {
    const lastDistance = parseDecimal(points.at(-1)?.distance ?? '0');
    onChange([
      ...points,
      newPoint(String(Number.isFinite(lastDistance) ? lastDistance + 1 : 0), ''),
    ]);
  };

  return (
    <fieldset className="profile-editor">
      <legend>{title}</legend>
      <div className="profile-column-labels" aria-hidden="true">
        <span>Distance (m)</span><span>Débit (mm/h)</span><span />
      </div>
      {points.map((point) => (
        <div className="profile-point-row" key={point.key}>
          <input
            required
            aria-label={`${title}, distance en mètres`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={point.distance}
            onChange={(event) => updatePoint(point.key, 'distance', event.target.value)}
          />
          <input
            required
            aria-label={`${title}, débit en millimètres par heure`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={point.rate}
            onChange={(event) => updatePoint(point.key, 'rate', event.target.value)}
          />
          <button
            type="button"
            disabled={points.length === 1}
            onClick={() => onChange(points.filter((item) => item.key !== point.key))}
            aria-label={`Supprimer le point à ${point.distance || '?'} m`}
          >
            ×
          </button>
        </div>
      ))}
      <button className="add-profile-point" type="button" onClick={addPoint}>
        + Ajouter une distance
      </button>
    </fieldset>
  );
}

/** Les valeurs enregistrées d'un réglage, comparées à celles du formulaire (3.8 bis). */
function storedValues(setting: EquipmentSettingRecord): SettingValues {
  return setting.kind === 'drip'
    ? { kind: 'drip', rateMmPerHour: setting.rateMmPerHour }
    : { kind: 'sprinkler', leftProfile: setting.leftProfile, rightProfile: setting.rightProfile };
}

function editorValues(equipment: EquipmentListItem, editor: SettingEditorState): SettingValues {
  return equipment.kind === 'drip'
    ? { kind: 'drip', rateMmPerHour: parseDecimal(editor.dripRate) }
    : {
        kind: 'sprinkler',
        leftProfile: profileValues(editor.leftProfile),
        rightProfile: profileValues(editor.symmetric ? editor.leftProfile : editor.rightProfile),
      };
}

function newPoint(distance: string, rate: string): ProfilePointForm {
  return { key: crypto.randomUUID(), distance, rate };
}

function cloneProfile(points: ProfilePointForm[]) {
  return points.map((point) => newPoint(point.distance, point.rate));
}

function profileValues(points: ProfilePointForm[]) {
  return points.map((point) => ({
    distanceMeters: parseDecimal(point.distance),
    rateMmPerHour: parseDecimal(point.rate),
  }));
}

function parseDecimal(value: string) {
  if (!value.trim()) return Number.NaN;
  return Number(value.replace(',', '.'));
}

function profilesMatch(
  left: readonly { distanceMeters: number; rateMmPerHour: number }[],
  right: readonly { distanceMeters: number; rateMmPerHour: number }[],
) {
  return (
    left.length === right.length &&
    left.every(
      (point, index) =>
        point.distanceMeters === right[index]?.distanceMeters &&
        point.rateMmPerHour === right[index]?.rateMmPerHour,
    )
  );
}

function settingSummary(setting: EquipmentSettingRecord) {
  if (setting.kind === 'drip') {
    return `${formatRate(setting.rateMmPerHour)} mm/h par planche`;
  }
  const leftReach = setting.leftProfile.at(-1)?.distanceMeters ?? 0;
  const rightReach = setting.rightProfile.at(-1)?.distanceMeters ?? 0;
  return `Portée : ${formatDistance(leftReach)} m à gauche · ${formatDistance(rightReach)} m à droite`;
}

function formatRate(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
    : '—';
}

function formatDistance(value: number) {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
