'use client';

import { priorityLabel } from '@/lib/domain/irrigation-feasibility';
import { notComputableInline } from '@/lib/domain/feasibility-unknown';
import type { StageAdviceBed, StageAdviceScreen } from '@/lib/domain/stage-advice';

/**
 * Le conseil selon le stade sensible (amélioration n° 4,
 * docs/ameliorations-4-5-contract.md, §3.3, F732) : en pénurie seulement,
 * les planches qu'il vaut mieux servir d'abord, regroupées par culture.
 * Rien ne change sans « Adopter », qui met la planche en priorité haute pour
 * la semaine en cours seulement.
 */

const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function StageAdviceBlock({ screen, pending, onAdopt }: {
  screen: StageAdviceScreen;
  pending: boolean;
  onAdopt: (bed: StageAdviceBed) => void;
}) {
  // Sans « Besoin par culture », le module ne connaît pas les stades : une ligne le dit à la place du bloc (F732, point 7).
  if (screen.kind === 'missing-part') return <p className="feasibility-note stage-advice-missing" role="note">{screen.notice}</p>;
  const { advice, equalSharePlanning } = screen;
  return (
    <section className="stage-advice" aria-labelledby="stage-advice-title" data-testid="stage-advice">
      <h3 id="stage-advice-title">Conseil : servir d’abord les stades sensibles</h3>
      <p className="stage-advice-lead">
        L’eau manque cette semaine. Ces planches ont une culture à un stade sensible au manque d’eau : mieux vaut les servir
        d’abord. Rien ne change sans votre geste ; « Adopter » met la planche en priorité haute pour cette semaine seulement.
      </p>
      {equalSharePlanning ? (
        <p className="feasibility-note">
          Votre planning partage l’eau à parts égales entre toutes les planches : la priorité haute change la répartition de
          cet écran, pas celle du planning.
        </p>
      ) : null}
      {advice.groups.map((group) => (
        <div key={group.referenceCropId} className="stage-advice-group">
          <h4>{group.referenceCropName}</h4>
          <ul>
            {group.beds.map((bed) => (
              <li key={bed.bedId} className="stage-advice-bed">
                <div>
                  <p className="stage-advice-bed-name"><strong>{bed.bedName}</strong> · {bed.plotName}</p>
                  {bed.crops.map((crop) => (
                    <p key={`${crop.seriesId}:${crop.stageLabel}`}>
                      {crop.plantName} ({crop.seriesName}) : stade « {crop.stageLabel} »
                      {crop.fromCalendar ? <span className="stage-advice-calendar"> · stade d’après le calendrier</span> : null}
                    </p>
                  ))}
                  <p className="stage-advice-figures">
                    Déficit relatif : {bed.relativeDeficitPercent === null
                      ? notComputableInline(bed.deficitUnknownReason ?? 'besoin réel inconnu')
                      : `${percent.format(bed.relativeDeficitPercent)} %`}
                    {' · '}Priorité de la semaine : {priorityLabel(bed.priority)}
                  </p>
                </div>
                <button type="button" disabled={pending} onClick={() => onAdopt(bed)} aria-label={`Adopter : ${bed.bedName} en priorité haute cette semaine`}>
                  Adopter
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
