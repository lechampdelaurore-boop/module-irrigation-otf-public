'use client';

import { useEffect, useState, useTransition } from 'react';
import { bedEtmOrigin, et0NatureLabel, kcSourceLabel, noEtmReasonLabel, proposalStatusLabel, proposedObjectiveOrigin } from '@/lib/domain/crop-water/presentation';
import type { CropWaterDay } from '@/lib/domain/crop-water/etm';
import type { BedCropWaterSheet } from '@/lib/services/crop-water-bed';
import type { StageChoice } from '@/lib/services/crop-water-week';
import { addDaysToDateKey } from '@/lib/domain/water-management';
import { FigureOrigin } from '../shell/figure-origin';
import { adoptCropWaterProposalAction, declareCropStageAction, loadBedCropWaterAction, type BedCropWaterActionResult } from '../crop-water-actions';

/**
 * Le besoin de la culture dans la fiche de la planche (docs/crop-water-need-contract.md,
 * « L'écran », 5 quater, PR 3b) : le stade, le Kc et l'ETM du jour de chaque
 * culture, l'objectif proposé de la semaine face à l'objectif applicable,
 * « Déclarer un stade » et « Adopter la proposition ». La proposition reste
 * une information tant qu'elle n'est pas adoptée.
 */

type AvailableSheet = Extract<BedCropWaterSheet, { available: true }>;
type Run = (operation: () => Promise<BedCropWaterActionResult>, afterSuccess?: (sheet: AvailableSheet) => void) => void;

const mm = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const kc = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const factor = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const DAYS_PER_WEEK = 7;

export function BedCropWaterPanel({ season, bedId, bedName }: { season: number; bedId: string; bedName: string }) {
  const [sheet, setSheet] = useState<BedCropWaterSheet | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run: Run = (operation, afterSuccess) => startTransition(async () => {
    const result = await operation();
    if (!result.ok) { setError(result.message); setNotice(null); return; }
    setSheet(result.sheet);
    setNotice(result.message);
    setError(null);
    if (result.sheet.available) afterSuccess?.(result.sheet);
  });

  useEffect(() => {
    let current = true;
    startTransition(async () => {
      const result = await loadBedCropWaterAction({ season, bedId, weekStart: null });
      if (!current) return;
      if (result.ok) { setSheet(result.sheet); setError(null); } else setError(result.message);
    });
    return () => { current = false; };
  }, [season, bedId]);

  return (
    <section className="bed-crop-water" aria-labelledby={`bed-crop-water-${bedId}`} aria-busy={pending}>
      <h3 id={`bed-crop-water-${bedId}`}>Besoin de la culture · planche {bedName}</h3>
      {notice ? <p className="water-notice" role="status">{notice}</p> : null}
      {error ? <p className="water-error" role="alert">{error}</p> : null}
      {sheet === null ? (
        error ? null : <p className="bed-crop-water-muted">Calcul du besoin de la culture…</p>
      ) : !sheet.available ? (
        <p className="bed-crop-water-muted">
          {sheet.reason === 'crop-plan-not-read'
            ? 'Le plan de culture n’a pas pu être lu chez Ouvre ta ferme : le besoin de la culture n’est pas calculé.'
            : 'Cette planche n’est pas dans la saison.'}
        </p>
      ) : (
        <AvailableSheetView sheet={sheet} pending={pending} run={run} season={season} />
      )}
    </section>
  );
}

function AvailableSheetView({ sheet, pending, run, season }: { sheet: AvailableSheet; pending: boolean; run: Run; season: number }) {
  const loadWeek = (weekStart: string) => run(() => loadBedCropWaterAction({ season, bedId: sheet.bedId, weekStart }));
  return (
    <>
      <TodayView sheet={sheet} />
      <div className="bed-crop-water-week-nav">
        <button type="button" className="secondary" disabled={pending} onClick={() => loadWeek(addDaysToDateKey(sheet.weekStart, -DAYS_PER_WEEK))}>Semaine précédente</button>
        <strong>Semaine du {formatDay(sheet.weekStart)} au {formatDay(sheet.weekEnd)}</strong>
        <button type="button" className="secondary" disabled={pending} onClick={() => loadWeek(addDaysToDateKey(sheet.weekStart, DAYS_PER_WEEK))}>Semaine suivante</button>
      </div>
      <WeekView sheet={sheet} pending={pending} run={run} season={season} />
      <DeclareStageForm sheet={sheet} pending={pending} run={run} season={season} />
      <AdoptionList sheet={sheet} />
      {sheet.unusableCrops.length > 0 ? (
        <p className="bed-crop-water-muted">
          Cultures de référence inutilisables : {sheet.unusableCrops.map((crop) => `${crop.name} (${crop.problems.join(' ')})`).join(' ; ')}.
        </p>
      ) : null}
    </>
  );
}

function TodayView({ sheet }: { sheet: AvailableSheet }) {
  const day = sheet.bed.today;
  return (
    <div className="bed-crop-water-today">
      <p>
        <strong>Aujourd’hui, {formatDay(day.date)}</strong>
        {' · '}
        {day.etmMm === null ? 'ETM de la planche inconnue' : `ETM de la planche : ${mm.format(day.etmMm)} mm`}
        <FigureOrigin text={bedEtmOrigin(day)} />
        {day.et0 ? ` · ET0 ${mm.format(day.et0.mm)} mm (${et0NatureLabel(day.et0.nature)})` : ' · ET0 du jour manquante'}
      </p>
      {day.crops.length === 0 ? (
        <p className="bed-crop-water-muted">Aucune culture sur la planche aujourd’hui : elle compte 0.</p>
      ) : (
        <ul className="bed-crop-water-crops" aria-label="Cultures du jour">
          {day.crops.map((crop) => <CropLine key={`${crop.seriesId}|${crop.cultivationId}`} crop={crop} />)}
        </ul>
      )}
      {day.irrigationStop ? <p className="bed-crop-water-alert">Arrêt d’irrigation avant récolte : toutes les cultures sont à un Kc de 0.</p> : null}
      {day.problems.length > 0 ? <p className="bed-crop-water-alert">{day.problems.join(' ')}</p> : null}
    </div>
  );
}

export function CropLine({ crop }: { crop: CropWaterDay }) {
  const name = <strong>{crop.plantName} · {crop.seriesName}</strong>;
  if (crop.status === 'absent') return null;
  if (crop.status === 'surface-state') return <li>{name}<small>Engrais vert : l’état de la surface du sol, sans Kc.</small></li>;
  if (crop.status === 'no-etm') return <li data-status="missing">{name}<small>Pas d’ETM : {noEtmReasonLabel(crop.reason)}.</small></li>;
  if (crop.status === 'blocked') return <li data-status="blocked">{name}<small>Calcul bloqué : {crop.problems.join(' ')}</small></li>;
  const { trace } = crop;
  const stage = trace.stage;
  const factors = [
    trace.shelterFactor === 1 ? null : `K_abri ${factor.format(trace.shelterFactor)}`,
    trace.mulchFactor === 1 ? null : `paillage ${factor.format(trace.mulchFactor)}`,
    trace.shadeFactor === 1 ? null : `ombrage ${factor.format(trace.shadeFactor)} (hypothèse)`,
  ].filter(Boolean);
  return (
    <li data-status={crop.status}>
      {name}
      <span>
        Stade : {stage.label}, {stage.origin === 'observed' ? 'déclaré' : 'calculé'} depuis le {formatDay(stage.startedOn)}
        {stage.estimated ? ' (date estimée, sans source)' : ''}
      </span>
      <small>
        {stage.nextChange ? `Prochain stade : ${stage.nextChange.label}, prévu le ${formatDay(stage.nextChange.date)}.` : stage.waitingForHarvest ? 'Le stade suivant attend une date de récolte qu’Ouvre ta ferme ne donne pas.' : 'Dernier stade.'}
      </small>
      <span>
        Kc {kc.format(trace.kc.kc)}
        {trace.kc.overridden ? ' (surcharge de la ferme)' : ''}
        {trace.kc.smoothed ? ' (lissé)' : ''}
        {' · '}
        {crop.status === 'computed' ? `ETM ${mm.format(crop.etmMm)} mm` : 'ETM inconnue : l’ET0 du jour manque'}
      </span>
      <small>
        {trace.referenceCropName} ({kcSourceLabel(trace.source)}){trace.analogy ? ', par analogie' : ''}{trace.exception ? ', exception de la série' : ''}
        {factors.length > 0 ? ` · ${factors.join(' · ')}` : ''}
      </small>
    </li>
  );
}

function WeekView({ sheet, pending, run, season }: { sheet: AvailableSheet; pending: boolean; run: Run; season: number }) {
  const week = sheet.bed.week;
  const natures = (['reanalysis', 'estimated', 'forecast'] as const).filter((nature) => week.byNature[nature] > 0);
  const adopt = () => run(
    () => adoptCropWaterProposalAction({ season, bedId: sheet.bedId, weekStart: sheet.weekStart }),
    (next) => {
      window.dispatchEvent(new CustomEvent('irrigation-goals-changed', { detail: { weekStart: next.weekStart } }));
      window.dispatchEvent(new CustomEvent('irrigation-needs-source-changed', { detail: { weekStart: next.weekStart } }));
    },
  );
  return (
    <div className="bed-crop-water-proposal">
      <dl>
        <div><dt>Objectif applicable</dt><dd>{week.objectiveMm === null ? 'Aucun' : `${mm.format(week.objectiveMm)} mm`}</dd></div>
        <div><dt>Objectif proposé</dt><dd>{week.proposedMm === null ? 'Non calculable' : `${mm.format(week.proposedMm)} mm`}<FigureOrigin text={proposedObjectiveOrigin(week)} /></dd></div>
        <div>
          <dt>Écart</dt>
          <dd>{week.differenceMm === null ? '—' : `${signed(week.differenceMm)} mm${week.differencePercent === null ? '' : ` (${signed(week.differencePercent)} %)`}`}</dd>
        </div>
      </dl>
      <p className="bed-crop-water-muted">
        {proposalStatusLabel(week.status)}
        {natures.length > 0 ? ` Dont ${natures.map((nature) => `${mm.format(week.byNature[nature])} mm sur ${et0NatureLabel(nature)}`).join(', ')}.` : ''}
      </p>
      {sheet.sprinklerWarning ? <p className="bed-crop-water-alert" role="note">{sheet.sprinklerWarning}</p> : null}
      <ul className="bed-crop-water-notes">
        {week.missingDays.length > 0 ? <li>ET0 manquante : {week.missingDays.map((date) => formatDay(date)).join(', ')}. Ces jours ne comptent pas pour zéro.</li> : null}
        {week.blockedDays.map((day) => <li key={day.date}>Calcul bloqué le {formatDay(day.date)} : {day.problems.join(' ')}</li>)}
        {week.cropsWithoutEtm.map((crop) => <li key={`${crop.seriesName}|${crop.plantName}`}>{crop.plantName} · {crop.seriesName} : pas d’ETM, {noEtmReasonLabel(crop.reason)}.</li>)}
        {week.irrigationStopDates.length > 0 ? <li>Arrêt d’irrigation avant récolte : {week.irrigationStopDates.map((date) => formatDay(date)).join(', ')}.</li> : null}
        {week.alerts.map((alert) => (
          <li key={alert.kind === 'high-etm' ? `high-${alert.date}` : 'deviation'} data-status="alert">
            {alert.kind === 'high-etm'
              ? `ETM élevée le ${formatDay(alert.date)} : ${mm.format(alert.etmMm)} mm. Vérifiez la culture de référence et les réglages.`
              : `La proposition (${mm.format(alert.proposedMm)} mm) s’écarte de plus de moitié de l’objectif applicable (${mm.format(alert.objectiveMm)} mm).`}
          </li>
        ))}
      </ul>
      {week.adoptable && sheet.weekOpen ? (
        <div className="bed-crop-water-actions">
          <button type="button" disabled={pending} onClick={adopt}>Adopter la proposition</button>
          <small>Elle devient l’objectif de la planche à partir d’aujourd’hui ; l’objectif d’avant reste dans l’historique.</small>
        </div>
      ) : week.adoptable ? (
        <p className="bed-crop-water-muted">Cette semaine est finie : sa proposition ne s’adopte plus.</p>
      ) : null}
    </div>
  );
}

function DeclareStageForm({ sheet, pending, run, season }: { sheet: AvailableSheet; pending: boolean; run: Run; season: number }) {
  const choices = sheet.bed.stageChoices;
  const [choiceIndex, setChoiceIndex] = useState(0);
  const [rank, setRank] = useState('');
  const [date, setDate] = useState(sheet.today);
  const [wholeSeries, setWholeSeries] = useState(false);
  if (choices.length === 0) return null;
  const choice: StageChoice = choices[Math.min(choiceIndex, choices.length - 1)];
  const valid = rank !== '' && date !== '' && date <= sheet.today;
  const declare = () => run(() => declareCropStageAction({
    season, bedId: sheet.bedId, weekStart: sheet.weekStart, seriesId: choice.seriesId,
    referenceCropId: choice.referenceCropId, rank: Number(rank), date, wholeSeries,
  }), () => window.dispatchEvent(new CustomEvent('irrigation-needs-source-changed', { detail: { weekStart: sheet.weekStart } })));
  return (
    <details className="bed-crop-water-declare">
      <summary>Déclarer un stade</summary>
      <p className="bed-crop-water-muted">Un stade se déclare le jour où il est atteint. Il recale les stades suivants ; une correction est une déclaration nouvelle.</p>
      <div className="bed-crop-water-form">
        {choices.length > 1 ? (
          <label><span>Culture</span>
            <select value={choiceIndex} onChange={(event) => { setChoiceIndex(Number(event.target.value)); setRank(''); }}>
              {choices.map((item, index) => <option key={`${item.seriesId}|${item.referenceCropId}`} value={index}>{item.plantName} · {item.seriesName} ({item.referenceCropName})</option>)}
            </select>
          </label>
        ) : <p><strong>{choice.plantName} · {choice.seriesName}</strong> ({choice.referenceCropName})</p>}
        <label><span>Stade atteint</span>
          <select value={rank} onChange={(event) => setRank(event.target.value)}>
            <option value="">Choisir un stade</option>
            {choice.stages.map((stage) => <option key={stage.rank} value={stage.rank}>{stage.label}</option>)}
          </select>
        </label>
        <label><span>Le jour</span><input type="date" value={date} max={sheet.today} onChange={(event) => setDate(event.target.value)} /></label>
        <fieldset>
          <legend>Pour</legend>
          <label className="bed-crop-water-choice"><input type="radio" name={`stage-scope-${sheet.bedId}`} checked={!wholeSeries} onChange={() => setWholeSeries(false)} /> cette planche</label>
          <label className="bed-crop-water-choice"><input type="radio" name={`stage-scope-${sheet.bedId}`} checked={wholeSeries} onChange={() => setWholeSeries(true)} /> toute la série</label>
        </fieldset>
        <button type="button" disabled={pending || !valid} onClick={declare}>Déclarer le stade</button>
      </div>
    </details>
  );
}

function AdoptionList({ sheet }: { sheet: AvailableSheet }) {
  if (sheet.adoptions.length === 0) return null;
  return (
    <details className="bed-crop-water-adoptions">
      <summary>Propositions adoptées ({sheet.adoptions.length})</summary>
      <ul>
        {sheet.adoptions.map((adoption) => (
          <li key={adoption.adoptedAt}>
            Semaine du {formatDay(adoption.weekStart)} : {mm.format(adoption.amountMm)} mm, adoptée le {formatInstant(adoption.adoptedAt)}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function signed(value: number): string {
  return value > 0 ? `+${mm.format(value)}` : mm.format(value);
}

export function formatDay(dateKey: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${dateKey}T12:00:00Z`));
}

function formatInstant(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(iso));
}
