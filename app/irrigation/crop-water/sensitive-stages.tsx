'use client';

import { useState } from 'react';
import type { SensitiveStageRow } from '@/lib/domain/crop-water/sensitive-stages';

/**
 * Les stades sensibles au manque d'eau d'une culture, pour la ferme
 * (amélioration n° 4, docs/ameliorations-4-5-contract.md, §3.1, F730) : une
 * case par stade de sa table, qui dit d'où vient sa valeur (« d'après les
 * références » ou « choisi par la ferme »). Un stade coché ne change aucun
 * calcul : en pénurie, il donne le conseil de servir d'abord la planche, que
 * le maraîcher adopte ou non.
 */
export function SensitiveStagesForm({ cropName, rows, pending, onSave }: {
  cropName: string;
  rows: readonly SensitiveStageRow[];
  pending: boolean;
  onSave: (sensitiveRanks: number[]) => void;
}) {
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set(rows.filter((row) => row.sensitive).map((row) => row.rank)));
  const changed = rows.some((row) => row.sensitive !== checked.has(row.rank));
  const count = rows.filter((row) => row.sensitive).length;
  const sources = [...new Set(rows.flatMap((row) => (row.reference ? [row.reference.source] : [])))];
  return (
    <details className="sensitive-stages" suppressHydrationWarning>
      <summary>
        Stades sensibles au manque d’eau
        <small>{count === 0 ? 'aucun stade sensible' : `${count} stade${count > 1 ? 's' : ''} sensible${count > 1 ? 's' : ''} sur ${rows.length}`}</small>
      </summary>
      <div className="sensitive-stages-form" role="group" aria-label={`Stades sensibles au manque d’eau · ${cropName}`}>
        <p className="reference-crop-meta">
          Quand l’eau manque, une planche dont la culture est à un stade coché reçoit, sur « Ressources et pompes », le conseil de
          la servir d’abord ; vous l’adoptez ou non. Aucun calcul ne change. Ce réglage ne vaut que pour votre ferme.
        </p>
        {sources.length === 0 && !rows.some((row) => row.origin === 'farm') ? (
          <p className="reference-crop-meta">La liste préremplie ne propose aucun stade pour cette culture : cochez ceux que vous jugez sensibles.</p>
        ) : null}
        {rows.map((row) => (
          <label key={row.rank} className="sensitive-stage">
            <input
              type="checkbox"
              checked={checked.has(row.rank)}
              onChange={(event) => setChecked((current) => toggled(current, row.rank, event.target.checked))}
            />
            <span>{row.label}<small>{originText(row)}</small></span>
          </label>
        ))}
        <div className="sensitive-stages-actions">
          <button type="button" disabled={pending || !changed} onClick={() => onSave([...checked].sort((left, right) => left - right))}>
            Enregistrer les stades sensibles
          </button>
          {rows.some((row) => row.origin === 'farm') ? (
            <button type="button" className="secondary" disabled={pending} onClick={() => onSave(rows.filter((row) => row.reference !== null).map((row) => row.rank))}>
              Reprendre la liste préremplie
            </button>
          ) : null}
        </div>
        {sources.length > 0 ? (
          <details className="sensitive-stages-sources">
            <summary>Sources de la liste préremplie</summary>
            <ul>{sources.map((source) => <li key={source}>{source}</li>)}</ul>
          </details>
        ) : null}
      </div>
    </details>
  );
}

function toggled(current: ReadonlySet<number>, rank: number, on: boolean): ReadonlySet<number> {
  const next = new Set(current);
  if (on) next.add(rank);
  else next.delete(rank);
  return next;
}

/** D'où vient la valeur d'une case : le choix de la ferme, sinon la liste préremplie (une analogie est dite telle). */
function originText(row: SensitiveStageRow): string {
  if (row.origin === 'farm') return 'choisi par la ferme';
  return row.reference?.confidence === 'analogie' ? 'd’après les références, par analogie' : 'd’après les références';
}
