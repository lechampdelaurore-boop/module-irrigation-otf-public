'use client';
import type { EquipmentListItem, EquipmentSettingRecord } from '@/lib/domain/equipment-record';
import {
  type CreationKind,
  creationButtonLabel,
  decimalFormatter,
  formatDuration,
  formatRate,
  formatVolume,
  oneDecimalFormatter,
} from './presentation';

import { hydraulicMessage } from '@/lib/domain/hydraulic-message';
import { evaluateHydraulicFeasibility } from '@/lib/domain/pumps';
import type { Bed } from '@/lib/domain/domain';
import { FigureOrigin } from '../shell/figure-origin';

/**
 * La faisabilité hydraulique en phrase d'action (audit ergonomique, lot 3,
 * point 6, cas 4) : ce qui ne va pas et quoi faire, le détail chiffré dessous.
 * Rien n'est montré tant qu'aucun matériel n'est choisi (cas 3) : pas de cadre
 * rouge avant un choix de l'utilisateur. Le moteur ne calcule aucune
 * solution : il n'y a donc pas de bouton pour en appliquer une (F46).
 */
export function HydraulicIndicator({
  feasibility,
  historical,
}: {
  feasibility: ReturnType<typeof evaluateHydraulicFeasibility>;
  historical: boolean;
}) {
  const message = hydraulicMessage(feasibility, historical);
  const tone = message.tone === 'exceeded' ? 'is-exceeded' : message.tone === 'ok' ? 'is-ok' : 'is-unknown';
  return <div className={`hydraulic-indicator ${tone}`} role={message.tone === 'exceeded' ? 'status' : undefined}>
    <strong>{message.sentence}</strong>
    {message.detail ? <small>{message.detail}</small> : null}
  </div>;
}

export function ActionTab({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button type="button" role="tab" aria-selected={active} data-active={active} onClick={onClick}>
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  );
}

export function IrrigationPreview({
  equipment,
  setting,
  applications,
  durationSeconds,
  volumeLiters,
  startKnown,
  creationKind,
  onSubmit,
  pending,
  origin = null,
  warning = null,
}: {
  equipment: EquipmentListItem | null;
  setting: EquipmentSettingRecord | null;
  /** Apport nul quand la durée est inconnue. */
  applications: Array<{ bed: Bed; rateMmPerHour: number; amountMm: number | null }>;
  /** Nulle tant que les dates d'une irrigation déjà réalisée ne se lisent pas. */
  durationSeconds: number | null;
  /** Nul quand la durée est inconnue, ou qu'une planche n'a pas de surface mouillée connue. */
  volumeLiters: number | null;
  /** Faux tant que la date de début d'une irrigation planifiée ne se lit pas. */
  startKnown: boolean;
  /** La bulle « d'où vient ce chiffre » de la durée et du volume (3.8). */
  origin?: string | null;
  creationKind: CreationKind;
  onSubmit: () => void;
  pending: boolean;
  /** Ce que le maraîcher doit savoir avant d'enregistrer, sans que rien soit bloqué : un créneau protégé (3.8 ter, règle 12). */
  warning?: string | null;
}) {
  const referenceRate = applications[0]?.rateMmPerHour ?? 0;
  return (
    <aside className="irrigation-preview" aria-live="polite">
      <p className="eyebrow">Résultat calculé</p>
      <strong className="calculated-duration">{formatDuration(durationSeconds)}<FigureOrigin text={origin} /></strong>
      <dl>
        <div><dt>Matériel</dt><dd>{equipment?.name ?? '—'}</dd></div>
        <div><dt>Réglage</dt><dd>{setting?.name ?? '—'}</dd></div>
        {equipment?.kind === 'drip' ? (
          <div><dt>Intensité</dt><dd>{formatRate(referenceRate)}</dd></div>
        ) : (
          <div><dt>Étendue</dt><dd>{applications.length} planche{applications.length > 1 ? 's' : ''}</dd></div>
        )}
        <div><dt>Volume estimé</dt><dd>{volumeLabel(durationSeconds, volumeLiters)}</dd></div>
      </dl>
      {applications.length > 0 ? (
        <details className="application-preview-details">
          <summary>Apport estimé par planche</summary>
          <div className="application-table-wrap">
            <table>
              <thead><tr><th>Planche</th><th>mm/h</th><th>Apport</th></tr></thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.bed.id}>
                    <td>{application.bed.name}</td>
                    <td>{decimalFormatter.format(application.rateMmPerHour)}</td>
                    <td>{application.amountMm === null ? 'inconnu' : `${oneDecimalFormatter.format(application.amountMm)} mm`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
      {warning ? <p className="irrigation-preview-warning" role="status">{warning}</p> : null}
      <button
        type="button"
        className="start-irrigation-button"
        disabled={pending || !startKnown || durationSeconds === null || durationSeconds <= 0 || applications.length === 0}
        onClick={onSubmit}
      >
        {pending ? 'Enregistrement…' : creationButtonLabel(creationKind)}
      </button>
      {creationKind === 'running' ? (
        <small>Le minuteur retrouvera son état après une actualisation de la page.</small>
      ) : null}
    </aside>
  );
}

/** Le volume estimé, ou pourquoi il est inconnu : jamais « 0 L » faute de donnée (D-003). */
function volumeLabel(durationSeconds: number | null, volumeLiters: number | null): string {
  if (durationSeconds === null) return 'Inconnu — vérifiez le début et la fin';
  if (volumeLiters === null) return 'Inconnu — passe-pied non renseigné';
  return formatVolume(volumeLiters);
}
