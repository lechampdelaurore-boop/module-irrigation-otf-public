'use client';

import { useState } from 'react';
import { gaugeDayLabel, gaugePercentOrigin, gaugeShortDayLabel, SURFACE_STATE_LABELS, thresholdOrigin, unknownReasonText, type SoilGaugeBed } from '@/lib/domain/soil-reserve/gauge-view';
import type { SurfaceState } from '@/lib/domain/soil-reserve/bare-soil';
import { saveSurfaceDeclarationAction, type SoilReserveActionResult } from '../soil-reserve-actions';
import { FigureOrigin } from '../shell/figure-origin';

/**
 * Le détail d'une planche dans le bloc « Réserve du sol »
 * (docs/soil-reserve-contract.md, « L'écran », 5 ter, PR 3b) : son état sur
 * sa capacité, son seuil, le jour du seuil ou les jours avant, la dose
 * conseillée ou « arrêt avant récolte », le drainage du jour, la confiance ;
 * sans culture, son état de surface, modifiable. Estimé et prévu ne se
 * confondent jamais (D-006).
 */

type Run = (operation: () => Promise<SoilReserveActionResult>) => void;

const mm = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const meters = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SURFACE_STATES = Object.keys(SURFACE_STATE_LABELS) as SurfaceState[];

function bedHeadline(bed: SoilGaugeBed): string {
  const current = bed.summary.current;
  if (!current) return 'inconnue';
  const parts = [`${whole.format(current.percent)} % du plein`];
  if (bed.summary.irrigationStop) parts.push('arrêt avant récolte');
  else if (bed.summary.advisedDoseMm !== null) parts.push(`sous le seuil, ${mm.format(bed.summary.advisedDoseMm)} mm conseillés`);
  else if (bed.summary.daysBeforeThreshold?.kind === 'forecast') parts.push(`seuil prévu le ${gaugeDayLabel(bed.summary.daysBeforeThreshold.date)}`);
  else if (bed.summary.daysBeforeThreshold?.kind === 'pace') parts.push(`seuil dans ${bed.summary.daysBeforeThreshold.days} j`);
  return parts.join(' · ');
}

export function SoilBed({ bed, season, today, pending, run }: { bed: SoilGaugeBed; season: number; today: string; pending: boolean; run: Run }) {
  const day = bed.today;
  const withoutCrop = day?.mode === 'bare' || day?.mode === 'cover';
  return (
    <details className="soil-bed" suppressHydrationWarning>
      <summary>
        <strong>Planche {bed.name}</strong>
        <small>{withoutCrop && day?.surfaceState ? `${SURFACE_STATE_LABELS[day.surfaceState]} · ` : ''}{bedHeadline(bed)}</small>
      </summary>
      <div className="soil-bed-detail">
        <BedState bed={bed} />
        {bed.week.length > 0 ? (
          <ul className="soil-week" aria-label={`Prévu jusqu’à dimanche, fin de chaque jour · planche ${bed.name}`}>
            {bed.week.map((item) => (
              <li key={item.date}>
                <span>{gaugeShortDayLabel(item.date)}</span>
                <strong>{item.percent === null ? 'inconnue' : `${whole.format(item.percent)} %`}</strong>
                <small>{item.nature === 'forecast' ? 'prévu' : 'estimé'}</small>
              </li>
            ))}
          </ul>
        ) : null}
        {withoutCrop || day?.mode === null || day === null ? (
          <SurfaceForm key={`${bed.bedId}|${day?.surfaceState ?? ''}|${day?.surfaceStateSince ?? ''}`} bed={bed} season={season} today={today} pending={pending} run={run} />
        ) : null}
      </div>
    </details>
  );
}

function BedState({ bed }: { bed: SoilGaugeBed }) {
  const { summary } = bed;
  const day = bed.today;
  const current = summary.current;
  const drainage = summary.drainage.find((item) => item.date === day?.date);
  return (
    <div className="soil-bed-state">
      {summary.unknown && !current ? <p className="soil-unknown">{unknownReasonText(summary.unknown)}</p> : null}
      {current ? (
        <p>
          <strong>{mm.format(current.mm)} mm sur {mm.format(current.capacityMm)} mm, {whole.format(current.percent)} % du plein</strong>
          <FigureOrigin text={gaugePercentOrigin(current, day?.depthM ?? null)} />
          {' '}· estimé {current.observedAt ? 'à l’heure de l’observation du jour' : 'au début du jour'}
          {day?.depthM !== null && day?.depthM !== undefined ? ` · racines à ${meters.format(day.depthM)} m` : ''}
        </p>
      ) : null}
      {current && current.thresholdMm !== null ? (
        <p>
          Seuil {mm.format(current.thresholdMm)} mm<FigureOrigin text={thresholdOrigin(current, day)} />
          {day?.cropThresholdPercent !== null && day?.cropThresholdPercent !== undefined
            ? ` · réglé par l’exploitation ; la culture conseillerait ${whole.format(day.cropThresholdPercent)} % du plein`
            : ''}
        </p>
      ) : null}
      {summary.irrigationStop ? <p className="soil-signal">Arrêt d’irrigation avant récolte.</p> : null}
      {!summary.irrigationStop && summary.advisedDoseMm !== null ? (
        <p className="soil-signal">
          Sous le seuil{summary.thresholdDay ? ` depuis le ${gaugeDayLabel(summary.thresholdDay)}` : ''} : dose conseillée {mm.format(summary.advisedDoseMm)} mm.
        </p>
      ) : null}
      {summary.daysBeforeThreshold?.kind === 'forecast' ? <p className="soil-signal">Seuil atteint le {gaugeDayLabel(summary.daysBeforeThreshold.date)}, prévu.</p> : null}
      {summary.daysBeforeThreshold?.kind === 'pace' ? (
        <p>
          Seuil dans {summary.daysBeforeThreshold.days} jour{summary.daysBeforeThreshold.days > 1 ? 's' : ''} au rythme des trois derniers jours
          ({mm.format(summary.daysBeforeThreshold.paceMm)} mm par jour), sans pluie ni arrosage.
        </p>
      ) : null}
      {summary.exhaustedDay ? (
        <p className="soil-signal">
          {summary.exhaustedDay <= (day?.date ?? '') ? `Réserve du sol épuisée depuis le ${gaugeDayLabel(summary.exhaustedDay)}.` : `Réserve du sol épuisée le ${gaugeDayLabel(summary.exhaustedDay)}, prévu.`}
        </p>
      ) : null}
      {drainage ? <p>Drainage aujourd’hui : {mm.format(drainage.mm)} mm, perdus sous les racines.</p> : null}
      {day && day.crops.length > 0 ? (
        <p>Cultures : {day.crops.map((crop) => `${crop.plantName} (${crop.referenceCropName}, ${meters.format(crop.depthM)} m${crop.proposedDepth ? ' proposés' : ''})`).join(', ')}</p>
      ) : null}
      <Mentions bed={bed} />
    </div>
  );
}

function Mentions({ bed }: { bed: SoilGaugeBed }) {
  const { summary } = bed;
  const mentions = bed.today?.mentions;
  const lines: string[] = [];
  if (summary.confidence.since) {
    lines.push(`Départ ${summary.confidence.kind === 'observation' ? 'par une observation' : 'par un apport'} le ${gaugeDayLabel(summary.confidence.since)}.`);
  }
  if (summary.confidence.checkProposed) lines.push('Plus de 30 jours sans réglage : un contrôle à la bêche ou au tensiomètre est conseillé.');
  if (summary.proposedDepthCrops.length > 0) lines.push(`Profondeur proposée, à vérifier à la tarière : ${summary.proposedDepthCrops.join(', ')}.`);
  if (mentions?.stonesMissing) lines.push('Part de cailloux non renseignée : comptée pour 0.');
  if (mentions && mentions.mulchRainShare !== null) {
    lines.push(mentions.mulchRainShare >= 1 ? 'Pluie comptée en entier malgré le paillage.' : `Pluie comptée à ${whole.format(mentions.mulchRainShare * 100)} % sous le paillage.`);
  }
  if (bed.today?.surfaceState && bed.today.mode !== 'crop') {
    const since = bed.today.surfaceStateSince ? ` depuis le ${gaugeDayLabel(bed.today.surfaceStateSince)}` : '';
    lines.push(bed.today.surfaceStateDeclared ? `État de surface déclaré${since}.` : 'État de surface proposé : sol nu, à déclarer s’il diffère.');
  }
  if (lines.length === 0) return null;
  return <ul className="soil-mentions">{lines.map((line) => <li key={line}>{line}</li>)}</ul>;
}

function SurfaceForm({ bed, season, today, pending, run }: { bed: SoilGaugeBed; season: number; today: string; pending: boolean; run: Run }) {
  const [state, setState] = useState<SurfaceState>(bed.today?.surfaceState ?? 'bare');
  const [date, setDate] = useState(today);
  const submit = () => run(() => saveSurfaceDeclarationAction({ season, bedId: bed.bedId, date, state }));
  return (
    <div className="crop-water-inline-form soil-surface-form" role="group" aria-label={`État de surface · planche ${bed.name}`}>
      <label>
        <span>État de surface</span>
        <select value={state} onChange={(event) => setState(event.target.value as SurfaceState)}>
          {SURFACE_STATES.map((value) => <option key={value} value={value}>{SURFACE_STATE_LABELS[value]}</option>)}
        </select>
      </label>
      <label><span>À partir du</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <button type="button" disabled={pending || date === ''} onClick={submit}>Déclarer l’état</button>
    </div>
  );
}
