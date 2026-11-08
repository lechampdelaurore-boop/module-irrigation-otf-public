'use client';

import { useEffect, useState, useTransition } from 'react';
import { et0NatureLabel, proposalStatusLabel } from '@/lib/domain/crop-water/presentation';
import type { SeriesBedCropWater, SeriesCropWaterSheet } from '@/lib/services/crop-water-series';
import { declareSeriesStageAction, loadSeriesCropWaterAction, type SeriesCropWaterActionResult } from '../crop-water-actions';
import { CropLine, formatDay, signed } from './bed-crop-water-panel';

/**
 * La fiche de la série pour le besoin par culture et par stade
 * (docs/crop-water-need-contract.md, « L'écran », 5 quater, PR 3e) : sur
 * chacune de ses planches, le stade, le Kc et l'ETM du jour de ses cultures,
 * et l'objectif proposé de la semaine de la planche face à son objectif
 * applicable. La proposition couvre toute la planche : elle s'adopte dans la
 * fiche de la planche. Un stade se déclare ici pour toute la série.
 */

type AvailableSheet = Extract<SeriesCropWaterSheet, { available: true }>;

const mm = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export function SeriesCropWaterPanel({ season, seriesId, seriesName }: { season: number; seriesId: string; seriesName: string }) {
  const [sheet, setSheet] = useState<SeriesCropWaterSheet | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (operation: () => Promise<SeriesCropWaterActionResult>) => startTransition(async () => {
    const result = await operation();
    if (!result.ok) { setError(result.message); setNotice(null); return; }
    setSheet(result.sheet);
    setNotice(result.message);
    setError(null);
    // Un stade déclaré change la proposition des planches de la série, affichée ailleurs sur la page.
    if (result.sheet.available) window.dispatchEvent(new CustomEvent('irrigation-needs-source-changed', { detail: { weekStart: result.sheet.weekStart } }));
  });

  useEffect(() => {
    let current = true;
    startTransition(async () => {
      const result = await loadSeriesCropWaterAction({ season, seriesId });
      if (!current) return;
      if (result.ok) { setSheet(result.sheet); setError(null); } else setError(result.message);
    });
    return () => { current = false; };
  }, [season, seriesId]);

  const titleId = `series-crop-water-${seriesId}`;
  return (
    <section className="bed-crop-water series-crop-water" aria-labelledby={titleId} aria-busy={pending}>
      <h4 id={titleId}>Besoin de la culture · série {seriesName}</h4>
      {notice ? <p className="water-notice" role="status">{notice}</p> : null}
      {error ? <p className="water-error" role="alert">{error}</p> : null}
      {sheet === null ? (
        error ? null : <p className="bed-crop-water-muted">Calcul du besoin de la culture…</p>
      ) : !sheet.available ? (
        <p className="bed-crop-water-muted">
          {sheet.reason === 'crop-plan-not-read'
            ? 'Le plan de culture n’a pas pu être lu chez Ouvre ta ferme : le besoin de la culture n’est pas calculé.'
            : 'Cette série n’est pas dans le plan de culture de la saison.'}
        </p>
      ) : (
        <>
          <p className="bed-crop-water-muted">
            Aujourd’hui, {formatDay(sheet.today)} · semaine du {formatDay(sheet.weekStart)} au {formatDay(sheet.weekEnd)}. La proposition de
            chaque planche compte toutes ses cultures ; elle s’adopte dans la fiche de la planche.
          </p>
          {sheet.beds.length === 0 ? (
            <p className="bed-crop-water-muted">La série n’est posée sur aucune planche de la saison.</p>
          ) : (
            <ul className="series-crop-water-beds" aria-label={`Planches de la série ${seriesName}`}>
              {sheet.beds.map((bed) => <BedItem key={bed.bedId} bed={bed} />)}
            </ul>
          )}
          <DeclareSeriesStageForm key={sheet.today} sheet={sheet} pending={pending} onDeclare={(input) => run(() => declareSeriesStageAction({ season, seriesId, ...input }))} />
          {sheet.unusableCrops.length > 0 ? (
            <p className="bed-crop-water-muted">
              Cultures de référence inutilisables : {sheet.unusableCrops.map((crop) => `${crop.name} (${crop.problems.join(' ')})`).join(' ; ')}.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function BedItem({ bed }: { bed: SeriesBedCropWater }) {
  const { week } = bed;
  return (
    <li>
      <strong>Planche {bed.bedName}{bed.plotName ? ` · ${bed.plotName}` : ''}</strong>
      {bed.crops.length === 0 ? (
        <p className="bed-crop-water-muted">La série n’est pas sur cette planche aujourd’hui.</p>
      ) : (
        <ul className="bed-crop-water-crops" aria-label={`Cultures du jour · planche ${bed.bedName}`}>
          {bed.crops.map((crop) => <CropLine key={`${crop.seriesId}|${crop.cultivationId}`} crop={crop} />)}
        </ul>
      )}
      <small>
        {bed.bedEtmMm === null ? 'ETM de la planche inconnue' : `ETM de la planche aujourd’hui : ${mm.format(bed.bedEtmMm)} mm`}
        {bed.et0 ? ` · ET0 ${mm.format(bed.et0.mm)} mm (${et0NatureLabel(bed.et0.nature)})` : ''}
        {bed.otherSeries.length > 0 ? ` · avec ${bed.otherSeries.join(', ')}` : ''}
      </small>
      <small>
        Semaine : objectif proposé {week.proposedMm === null ? 'non calculable' : `${mm.format(week.proposedMm)} mm`}
        {', '}objectif applicable {week.objectiveMm === null ? 'aucun' : `${mm.format(week.objectiveMm)} mm`}
        {week.differenceMm === null ? '' : `, écart ${signed(week.differenceMm)} mm`}
        {'. '}{proposalStatusLabel(week.status)}
      </small>
    </li>
  );
}

function DeclareSeriesStageForm({ sheet, pending, onDeclare }: {
  sheet: AvailableSheet;
  pending: boolean;
  onDeclare: (input: { referenceCropId: string; rank: number; date: string }) => void;
}) {
  const [choiceIndex, setChoiceIndex] = useState(0);
  const [rank, setRank] = useState('');
  const [date, setDate] = useState(sheet.today);
  const choices = sheet.stageChoices;
  if (choices.length === 0) return null;
  const choice = choices[Math.min(choiceIndex, choices.length - 1)];
  const valid = rank !== '' && date !== '' && date <= sheet.today;
  return (
    <details className="bed-crop-water-declare">
      <summary>Déclarer un stade pour toute la série</summary>
      <p className="bed-crop-water-muted">Un stade se déclare le jour où il est atteint, pour toutes les planches de la série. Il recale les stades suivants.</p>
      <div className="bed-crop-water-form" role="group" aria-label={`Déclarer un stade · série ${sheet.seriesName}`}>
        {choices.length > 1 ? (
          <label><span>Culture</span>
            <select value={choiceIndex} onChange={(event) => { setChoiceIndex(Number(event.target.value)); setRank(''); }}>
              {choices.map((item, index) => <option key={item.referenceCropId} value={index}>{item.plantName} ({item.referenceCropName})</option>)}
            </select>
          </label>
        ) : <p><strong>{choice.plantName}</strong> ({choice.referenceCropName})</p>}
        <label><span>Stade atteint</span>
          <select value={rank} onChange={(event) => setRank(event.target.value)}>
            <option value="">Choisir un stade</option>
            {choice.stages.map((stage) => <option key={stage.rank} value={stage.rank}>{stage.label}</option>)}
          </select>
        </label>
        <label><span>Le jour</span><input type="date" value={date} max={sheet.today} onChange={(event) => setDate(event.target.value)} /></label>
        <button type="button" disabled={pending || !valid} onClick={() => onDeclare({ referenceCropId: choice.referenceCropId, rank: Number(rank), date })}>
          Déclarer le stade
        </button>
      </div>
    </details>
  );
}
