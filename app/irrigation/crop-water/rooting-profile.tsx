'use client';

import { useState } from 'react';
import { rootingProfileProblems, type RootingStage } from '@/lib/domain/soil-reserve/rooting';
import { PROPOSED_DEPTH_TEXT, rootingDepthText, stageLineLabel, type RootingLine, type RootingProfileView } from '@/lib/domain/soil-reserve/rooting-view';

/**
 * Le profil racinaire d'une culture de référence dans sa carte de la page
 * « Coefficients culturaux » (docs/soil-reserve-contract.md, « La profondeur
 * racinaire et la part utilisable des cultures », 5 ter, PR 3c) : la part p
 * et la profondeur de chaque stade qui comptent aujourd'hui, leur source, le
 * jeu commun à côté d'une révision de la ferme, et un formulaire qui
 * enregistre un profil entier à partir d'un jour. Rien n'est effacé.
 */

export type RootingProfileSubmit = { p: number | null; stages: RootingStage[]; source: string; note: string | null; effectiveFrom: string };

const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const ALL_STAGES = 'all';

export function RootingProfileSection({ cropName, view, today, pending, onSubmit }: {
  cropName: string;
  view: RootingProfileView;
  today: string;
  pending: boolean;
  onSubmit: (input: RootingProfileSubmit) => void;
}) {
  const { inForce, common } = view;
  const commonLine = (line: RootingLine) => common?.lines.find((candidate) => candidate.rank === line.rank) ?? null;
  return (
    <div className="rooting-profile">
      <h4>Racines et part utilisable</h4>
      <p className="reference-crop-meta">
        {inForce === null
          ? `Aucun profil : ${PROPOSED_DEPTH_TEXT} à chaque stade, p 0,50.`
          : inForce.origin === 'farm' ? `Profil de la ferme, à partir du ${day(inForce.effectiveFrom)}.` : 'Profil du jeu commun.'}
      </p>
      <ul className="rooting-lines" aria-label={`Profil racinaire · ${cropName}`}>
        <li>
          <span>Part utilisable p</span>
          <strong>{view.defaultP ? '0,50, sans valeur saisie' : decimal.format(view.p)}</strong>
          {common && common.p !== inForce?.p ? <small>jeu commun : {common.p === null ? 'sans valeur' : decimal.format(common.p)}</small> : null}
        </li>
        {(inForce?.lines ?? []).map((line) => {
          const shared = commonLine(line);
          return (
            <li key={`${line.rank}`}>
              <span>{line.label}</span>
              <strong>{rootingDepthText(line)}</strong>
              {common && (!shared || rootingDepthText(shared) !== rootingDepthText(line))
                ? <small>jeu commun : {shared ? rootingDepthText(shared) : 'pas de ligne'}</small>
                : null}
            </li>
          );
        })}
        {view.proposedStages.map((stage) => (
          <li key={`proposed-${stage.rank}`}>
            <span>{stageLineLabel(stage.rank, view.stages)}</span>
            <strong>{PROPOSED_DEPTH_TEXT}</strong>
          </li>
        ))}
      </ul>
      {inForce ? <p className="reference-crop-meta">Source : {inForce.source}{inForce.note ? ` · ${inForce.note}` : ''}</p> : null}
      {view.history.length > 0 ? (
        <p className="reference-crop-meta">
          Profils de la ferme : {view.history.map((revision) => `à partir du ${day(revision.effectiveFrom)} (${revision.source})`).join(' ; ')}.
        </p>
      ) : null}
      <details className="rooting-profile-form-wrap" suppressHydrationWarning>
        <summary>Modifier le profil racinaire</summary>
        <RootingProfileForm
          key={inForce ? `${inForce.origin}|${inForce.recordedAt}` : 'none'}
          cropName={cropName}
          view={view}
          today={today}
          pending={pending}
          onSubmit={onSubmit}
        />
      </details>
    </div>
  );
}

type Line = { rank: number | null; depth: string; progressive: boolean; endDepth: string; days: string };

function linesOf(stages: readonly RootingStage[]): Line[] {
  return stages.map((stage) => ({
    rank: stage.rank,
    depth: decimal.format(stage.depthM),
    progressive: stage.endDepthM !== null && stage.progressionDays !== null,
    endDepth: stage.endDepthM === null ? '' : decimal.format(stage.endDepthM),
    days: stage.progressionDays === null ? '' : String(stage.progressionDays),
  }));
}

function RootingProfileForm({ cropName, view, today, pending, onSubmit }: {
  cropName: string;
  view: RootingProfileView;
  today: string;
  pending: boolean;
  onSubmit: (input: RootingProfileSubmit) => void;
}) {
  const startLines = view.inForce ? linesOf(view.inForce.lines) : [{ rank: null, depth: '0,30', progressive: false, endDepth: '', days: '' }];
  const [lines, setLines] = useState<Line[]>(startLines);
  const [p, setP] = useState(view.inForce?.p === null || view.inForce === null ? '' : decimal.format(view.inForce.p));
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const missing = [
    ...(lines.some((line) => line.rank === null) ? [] : [{ value: ALL_STAGES, label: stageLineLabel(null, view.stages) }]),
    ...view.stages.filter((stage) => !lines.some((line) => line.rank === stage.rank)).map((stage) => ({ value: String(stage.rank), label: stageLineLabel(stage.rank, view.stages) })),
  ];
  const [added, setAdded] = useState(missing[0]?.value ?? '');
  const toAdd = missing.find((option) => option.value === added) ?? missing[0] ?? null;

  const parsedP = p.trim() === '' ? null : parseDecimal(p);
  const stages: (RootingStage | null)[] = lines.map((line) => {
    const depthM = parseDecimal(line.depth);
    const endDepthM = line.progressive ? parseDecimal(line.endDepth) : null;
    const progressionDays = line.progressive ? parseWhole(line.days) : null;
    if (depthM === null || (line.progressive && (endDepthM === null || progressionDays === null))) return null;
    return { rank: line.rank, depthM, endDepthM, progressionDays };
  });
  const complete = stages.every((stage): stage is RootingStage => stage !== null);
  const problems = [
    ...(p.trim() !== '' && parsedP === null ? ['Part utilisable p : un nombre, par exemple 0,35.'] : []),
    ...(complete ? [] : ['Chaque ligne demande sa profondeur en mètres, et une profondeur progressive sa profondeur finale et son nombre de jours.']),
    ...(complete && (p.trim() === '' || parsedP !== null) ? rootingProfileProblems({ p: parsedP, stages: stages as RootingStage[] }, cropName) : []),
  ];
  const ready = problems.length === 0 && lines.length > 0 && source.trim() !== '' && effectiveFrom !== '';
  const update = (index: number, change: Partial<Line>) => setLines(lines.map((line, position) => (position === index ? { ...line, ...change } : line)));
  const takeCommon = () => {
    if (!view.common) return;
    setLines(linesOf(view.common.lines));
    setP(view.common.p === null ? '' : decimal.format(view.common.p));
    setSource('Jeu commun repris');
  };

  return (
    <div className="rooting-profile-form" role="group" aria-label={`Modifier le profil racinaire · ${cropName}`}>
      <label>
        <span>Part utilisable p</span>
        <input type="text" inputMode="decimal" value={p} placeholder="par exemple 0,35" onChange={(event) => setP(event.target.value)} />
      </label>
      {lines.map((line, index) => {
        const label = stageLineLabel(line.rank, view.stages);
        return (
          <div className="rooting-line-form" role="group" aria-label={label} key={`${line.rank}`}>
            <strong>{label}</strong>
            <label>
              <span>{line.progressive ? 'Profondeur au début (m)' : 'Profondeur (m)'}</span>
              <input type="text" inputMode="decimal" value={line.depth} onChange={(event) => update(index, { depth: event.target.value })} />
            </label>
            <label className="rooting-progressive">
              <input type="checkbox" checked={line.progressive} onChange={(event) => update(index, { progressive: event.target.checked })} />
              Profondeur qui augmente
            </label>
            {line.progressive ? (
              <>
                <label>
                  <span>Jusqu’à (m)</span>
                  <input type="text" inputMode="decimal" value={line.endDepth} onChange={(event) => update(index, { endDepth: event.target.value })} />
                </label>
                <label>
                  <span>En (jours)</span>
                  <input type="text" inputMode="numeric" value={line.days} onChange={(event) => update(index, { days: event.target.value })} />
                </label>
              </>
            ) : null}
            {lines.length > 1 ? (
              <button type="button" className="secondary" onClick={() => setLines(lines.filter((_, position) => position !== index))}>Retirer la ligne</button>
            ) : null}
          </div>
        );
      })}
      {toAdd ? (
        <div className="rooting-add-line">
          <label>
            <span>Ajouter une ligne</span>
            <select value={toAdd.value} onChange={(event) => setAdded(event.target.value)}>
              {missing.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => setLines([...lines, { rank: toAdd.value === ALL_STAGES ? null : Number(toAdd.value), depth: '', progressive: false, endDepth: '', days: '' }])}
          >
            Ajouter
          </button>
        </div>
      ) : null}
      <p className="reference-crop-meta">
        Une ligne propre à un stade passe avant la ligne « Tous les stades » ; un stade sans ligne compte {PROPOSED_DEPTH_TEXT}. La profondeur se
        vérifie à la tarière.
      </p>
      <label>
        <span>Source</span>
        <input type="text" value={source} placeholder="par exemple : tarière, 12 mai" onChange={(event) => setSource(event.target.value)} />
      </label>
      <label>
        <span>Note</span>
        <input type="text" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <label>
        <span>À partir du</span>
        <input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
      </label>
      {problems.length > 0 ? <ul className="rooting-problems">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul> : null}
      <div className="rooting-actions">
        {view.common ? <button type="button" className="secondary" onClick={takeCommon}>Reprendre le jeu commun</button> : null}
        <button
          type="button"
          disabled={pending || !ready}
          onClick={() => onSubmit({ p: parsedP, stages: stages as RootingStage[], source: source.trim(), note: note.trim() === '' ? null : note.trim(), effectiveFrom })}
        >
          Enregistrer le profil
        </button>
      </div>
    </div>
  );
}

function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null;
}

function parseWhole(value: string): number | null {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
}

function day(value: string): string {
  return dayFormat.format(new Date(`${value}T12:00:00Z`));
}
