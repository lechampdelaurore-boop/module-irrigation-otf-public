'use client';

import { useState } from 'react';
import { priorityLabel } from '@/lib/domain/irrigation-feasibility';
import { formatIrrigationDateTimeInput, instantFromIrrigationDateTimeInput } from '@/lib/domain/irrigation-format';
import { effectiveProposalStatus, type StoredProposal } from '@/lib/domain/planning/contract';
import {
  EQUIPMENT_KIND_LABELS,
  adjustProposalTiming,
  decimalFromInput,
  doseReasonLabel,
  earlierCalculationDate,
  proposalStatusLabel,
  timingReasonLabel,
  validatedProposalNote,
} from '@/lib/domain/planning/presentation';
import { proposalOrigin } from '@/lib/domain/planning/origins';
import { proposalAnchor } from '@/lib/domain/today/today-irrigations';
import type { ProposalSoilNote } from '@/lib/domain/soil-reserve/proposal-soil';
import { FARM_TIME_ZONE } from '@/lib/domain/water-management';
import { formatDuration } from '../irrigation-manager/presentation';
import { FigureOrigin } from '../shell/figure-origin';
import { formatDateTime, formatFlow, formatMm, formatTime, formatVolume } from './format';

export type ProposalFeedback = { ok: boolean; message: string };

type Props = {
  proposal: StoredProposal;
  /** Le calcul affiché : une carte d'un calcul antérieur porte la date du sien. */
  currentCalculationId: string;
  now: Date;
  pending: boolean;
  feedback: ProposalFeedback | undefined;
  /** Les planches dont la dose dépasse ce que le sol peut encore retenir (5 ter, PR 3d) ; une information. */
  soilNotes?: readonly ProposalSoilNote[];
  onValidate: (storedId: string) => void;
  onAdjust: (storedId: string, startAt: string, doseMm: number) => void;
  onRefuse: (storedId: string) => void;
};

const doseInput = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, useGrouping: false });

/**
 * Une proposition du plan (docs/planning-contract.md, « Interface (3.6) ») :
 * le créneau d'un coup d'œil, sa justification d'un clic, et les gestes —
 * valider, ajuster, refuser — tant qu'elle est proposée.
 */
export function ProposalCard({ proposal, currentCalculationId, now, pending, feedback, soilNotes = [], onValidate, onAdjust, onRefuse }: Props) {
  const status = effectiveProposalStatus(proposal, now);
  const { justification } = proposal;
  const bedNames = proposal.bedApplications.map((application) => application.bedName);
  const earlierDate = earlierCalculationDate(proposal, currentCalculationId);
  const origin = earlierDate === null ? null : `calcul du ${formatDateTime(earlierDate)}`;
  return (
    <article id={proposalAnchor(proposal.storedId)} className="planning-proposal" data-status={status} data-irrigation={proposal.irrigationStatus ?? undefined} data-verified={justification.hydraulicallyVerified} data-proposal-id={proposal.storedId} aria-label={`Proposition ${proposal.id}${origin ? ` du ${origin}` : ''}, ${proposal.equipmentName}`}>
      {/* Une seule carte ouverte à la fois : sur un grand écran, son détail s'ouvre par-dessus le tableau (précision P46). */}
      <details name="planning-proposal">
        <summary>
          <span className="planning-proposal-time">
            <strong>{formatTime(proposal.startAt)} → {formatTime(proposal.endAt)}</strong>
            <small>{formatDuration(proposal.durationSeconds)}</small>
          </span>
          <span className="planning-proposal-main">
            <strong>{proposal.equipmentName}</strong>
            <small>{EQUIPMENT_KIND_LABELS[proposal.kind]} · {proposal.settingName} · {bedNames.length} planche{bedNames.length > 1 ? 's' : ''} ({bedNames.join(', ')}){origin ? ` · ${origin}` : ''}</small>
          </span>
          <span className="planning-proposal-measures">
            <Measure label="Dose" value={formatMm(proposal.doseMm)} />
            <Measure label="Volume" value={formatVolume(proposal.volumeCubicMeters)} />
            <Measure label="Pompe" value={justification.pump ? justification.pump.pumpName : 'non vérifiée'} tone={justification.hydraulicallyVerified ? undefined : 'unverified'} />
          </span>
          <span className="planning-status" data-status={status} data-irrigation={proposal.irrigationStatus ?? undefined}>{proposalStatusLabel(proposal, now)}</span>
        </summary>
        <div className="planning-proposal-detail">
          <dl className="planning-justification">
            <Detail label="Durée et volume" value={`${formatDuration(proposal.durationSeconds)}, ${formatVolume(proposal.volumeCubicMeters)}`} origin={proposalOrigin(proposal, formatDuration(proposal.durationSeconds))} />
            <Detail label="Priorité" value={priorityLabel(justification.priority)} />
            <Detail label="Pourquoi cette dose" value={doseReasonLabel(justification.doseReason)} />
            <Detail label="Pourquoi ce moment" value={timingReasonLabel(justification.timingReason)} />
            <Detail label="Contrainte limitante" value={justification.limitingConstraint ?? 'aucune'} />
            <Detail label="Pompe" value={justification.pump ? `${justification.pump.pumpName} · ${formatFlow(justification.pump.flowCubicMetersPerHour)} demandés · ${formatFlow(justification.pump.alreadyEngagedCubicMetersPerHour)} déjà engagés` : 'aucune pompe habituelle : faisabilité hydraulique non vérifiée'} />
            <Detail label="Eau" value={justification.supply ? `${justification.supply.originName}${justification.supply.projectedLevelAfterCubicMeters === null ? ' · niveau projeté inconnu' : ` · ${formatVolume(justification.supply.projectedLevelAfterCubicMeters)} projetés après ce créneau`}` : 'origine d’eau non vérifiée'} />
            <Detail label="Faisabilité" value={justification.hydraulicallyVerified ? 'vérifiée : pompe, origine et stock connus' : 'non vérifiée : pompe, origine ou stock inconnu'} />
          </dl>
          <table className="planning-table planning-beds">
            <caption>Planches arrosées : besoin avant et après ce créneau, sur-apport affiché, jamais fondu</caption>
            <thead>
              <tr><th scope="col">Planche</th><th scope="col">Besoin avant</th><th scope="col">Apport</th><th scope="col">Besoin après</th><th scope="col">Sur-apport</th><th scope="col">Surface mouillée</th></tr>
            </thead>
            <tbody>
              {proposal.bedApplications.map((application) => (
                <tr key={application.bedId}>
                  <th scope="row">{application.bedName}</th>
                  <td data-label="Besoin avant">{formatMm(application.needBeforeMm)}</td>
                  <td data-label="Apport">{formatMm(application.appliedMm)}</td>
                  <td data-label="Besoin après">{formatMm(application.needAfterMm)}</td>
                  <td data-label="Sur-apport">{application.surplusMm > 0 ? formatMm(application.surplusMm) : '—'}</td>
                  <td data-label="Surface mouillée">{application.wettedAreaSquareMeters === null ? 'inconnue' : `${doseInput.format(application.wettedAreaSquareMeters)} m²`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div className="planning-proposal-after">
        {status === 'proposed' && soilNotes.length > 0 ? (
          <p className="planning-proposal-soil">
            {soilNotes.map((note) => `${note.bedName} : ${formatMm(note.beyondMm)} au-delà de ce que le sol peut retenir, perdus en drainage.`).join(' ')}
          </p>
        ) : null}
        {feedback ? <p className={feedback.ok ? 'planning-proposal-feedback' : 'planning-proposal-refusal'} role={feedback.ok ? 'status' : 'alert'}>{feedback.message}</p> : null}
        {status === 'proposed' ? (
          <ProposalActions proposal={proposal} pending={pending} onValidate={onValidate} onAdjust={onAdjust} onRefuse={onRefuse} />
        ) : status === 'expired' ? (
          <p className="planning-proposal-note">Le créneau est passé sans décision : recalculez le plan.</p>
        ) : status === 'validated' ? (
          <p className="planning-proposal-note">{validatedProposalNote(proposal.irrigationStatus)}</p>
        ) : null}
      </div>
    </article>
  );
}

function ProposalActions({ proposal, pending, onValidate, onAdjust, onRefuse }: Omit<Props, 'now' | 'feedback' | 'currentCalculationId' | 'soilNotes'>) {
  const [adjusting, setAdjusting] = useState(false);
  const [startInput, setStartInput] = useState(() => formatIrrigationDateTimeInput(proposal.startAt, FARM_TIME_ZONE));
  const [dose, setDose] = useState(() => doseInput.format(proposal.doseMm));
  const preview = adjustProposalTiming(proposal, { startAt: instantFromIrrigationDateTimeInput(startInput) ?? '', doseMm: decimalFromInput(dose) });
  return (
    <>
      <div className="planning-proposal-actions">
        <button type="button" className="primary" disabled={pending} onClick={() => onValidate(proposal.storedId)}>Valider</button>
        <button type="button" disabled={pending} aria-expanded={adjusting} onClick={() => setAdjusting((value) => !value)}>Ajuster</button>
        <button type="button" className="danger-outline" disabled={pending} onClick={() => onRefuse(proposal.storedId)}>Refuser</button>
      </div>
      {adjusting ? (
        <form
          className="planning-adjust"
          aria-label={`Ajuster la proposition ${proposal.id}`}
          onSubmit={(event) => {
            event.preventDefault();
            if (preview) onAdjust(proposal.storedId, preview.startAt, preview.doseMm);
          }}
        >
          <label><span>Début</span><input type="datetime-local" value={startInput} onChange={(event) => setStartInput(event.target.value)} /></label>
          <label><span>Dose de référence (mm)</span><input inputMode="decimal" value={dose} onChange={(event) => setDose(event.target.value)} /></label>
          <p className="planning-adjust-preview" role="status">
            {preview
              ? `Durée ${formatDuration(preview.durationSeconds)}, fin le ${formatDateTime(preview.endAt)} : la durée suit la dose, chaque planche reçoit au taux de son réglage.`
              : 'Indiquez une dose strictement positive et un début.'}
          </p>
          <div className="planning-adjust-actions">
            <button type="submit" className="primary" disabled={pending || !preview}>Valider avec ces valeurs</button>
            <button type="button" disabled={pending} onClick={() => setAdjusting(false)}>Abandonner l’ajustement</button>
          </div>
        </form>
      ) : null}
    </>
  );
}

function Measure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <span className="planning-measure" data-tone={tone}><small>{label}</small><strong>{value}</strong></span>;
}

function Detail({ label, value, origin }: { label: string; value: string; origin?: string | null }) {
  return <div><dt>{label}</dt><dd>{value}{origin ? <FigureOrigin text={origin} /> : null}</dd></div>;
}
