'use client';

import { useState } from 'react';
import type { KcOverrideRow } from '@/lib/domain/crop-water/settings-view';

/**
 * Les surcharges de Kc d'une culture de référence (5 quater, PR 3c) : pour
 * chaque stade, ou chacun des trois Kc de la FAO, la valeur de la source et
 * celle de la ferme qui compte aujourd'hui ; un formulaire ajoute une
 * révision datée, ou revient à la valeur de la source. Rien n'est effacé.
 */

const kcFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export type KcOverrideSubmit = { targetKey: string; kc: number | null; effectiveFrom: string };

export function KcOverrides({ cropName, rows, today, pending, onSubmit }: {
  cropName: string;
  rows: readonly KcOverrideRow[];
  today: string;
  pending: boolean;
  onSubmit: (input: KcOverrideSubmit) => void;
}) {
  const [targetKey, setTargetKey] = useState(rows[0]?.key ?? '');
  const [value, setValue] = useState('');
  const [backToSource, setBackToSource] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const kc = parseKc(value);
  const ready = targetKey !== '' && effectiveFrom !== '' && (backToSource || kc !== null);
  const overridden = rows.filter((row) => row.history.length > 0);
  return (
    <div className="kc-overrides">
      <h4>Surcharges de la ferme</h4>
      {overridden.length === 0 ? (
        <p className="reference-crop-meta">Aucune surcharge : les valeurs de la source comptent.</p>
      ) : (
        <ul className="kc-override-list" aria-label={`Surcharges de Kc · ${cropName}`}>
          {overridden.map((row) => (
            <li key={row.key}>
              <strong>{row.label}</strong>
              <span>
                Source {kcFormat.format(row.sourceKc)} · aujourd’hui {inForceLabel(row)}
              </span>
              <small>
                {row.history.map((override) => (
                  `${override.kc === null ? 'retour à la source' : kcFormat.format(override.kc)} à partir du ${day(override.effectiveFrom)}`
                )).join(' ; ')}
              </small>
            </li>
          ))}
        </ul>
      )}
      <details className="kc-override-form-wrap" suppressHydrationWarning>
        <summary>Surcharger un Kc</summary>
        <div className="kc-override-form" role="group" aria-label={`Surcharger un Kc · ${cropName}`}>
          <label>
            <span>Valeur</span>
            <select value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>
              {rows.map((row) => (
                <option key={row.key} value={row.key}>{row.label} (source {kcFormat.format(row.sourceKc)})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Kc de la ferme</span>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              disabled={backToSource}
              placeholder="par exemple 0,85"
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <label className="kc-override-back">
            <input type="checkbox" checked={backToSource} onChange={(event) => setBackToSource(event.target.checked)} />
            Revenir à la valeur de la source
          </label>
          <label>
            <span>À partir du</span>
            <input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
          </label>
          <p className="reference-crop-meta">Le Kc se règle de 0 à 1,3. Les jours d’avant gardent leur valeur.</p>
          <button
            type="button"
            disabled={pending || !ready}
            onClick={() => onSubmit({ targetKey, kc: backToSource ? null : kc, effectiveFrom })}
          >
            Enregistrer la surcharge
          </button>
        </div>
      </details>
    </div>
  );
}

function inForceLabel(row: KcOverrideRow): string {
  if (row.inForce === null || row.inForce.kc === null) return `${kcFormat.format(row.sourceKc)}, valeur de la source`;
  return `${kcFormat.format(row.inForce.kc)}, valeur de la ferme`;
}

function parseKc(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

function day(value: string): string {
  return dayFormat.format(new Date(`${value}T12:00:00Z`));
}
