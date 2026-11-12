'use client';

import { useMemo, useState } from 'react';
import type { ArbitrationBedCrops, ArbitrationCrops } from '@/lib/domain/arbitration-crops';
import { initialArbitrationSelection, previewArbitration, type ArbitrationPreview } from '@/lib/domain/arbitration-preview';
import { compareNamesNaturally } from '@/lib/domain/bed-order';
import { FEASIBILITY_PRIORITIES, priorityLabel, sameBedIds, type IrrigationFeasibility, type PriorityFeasibility } from '@/lib/domain/irrigation-feasibility';
import type { BedIrrigationNeed } from '@/lib/domain/irrigation-needs';
import { ArbitrationTimeline, ArbitrationTimelineHeader } from './arbitration-timeline';

/**
 * L'écran d'arbitrage façon plan d'assolement (docs/shortage-contract.md,
 * 2 bis, D-083) : le bilan du choix, puis les planches rangées par parcelle et
 * par jardin, avec leurs cultures, leur besoin et leur part d'eau. Toutes les
 * planches à choisir sont cochées au départ ; chaque case recalcule la part
 * dans le navigateur, par le calcul du serveur ; rien n'est enregistré avant
 * « Valider la répartition ».
 */

const cubic = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const millimeters = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const area = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const decided = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const m3 = (value: number) => `${cubic.format(value)} m³`;
const mm = (value: number) => `${millimeters.format(value)} mm`;
const pct = (value: number) => `${Math.round(value * 100)} %`;
const count = (value: number, one: string, many = `${one}s`) => `${value} ${value > 1 ? many : one}`;
const lower = (priority: PriorityFeasibility['priority']) => priorityLabel(priority).toLocaleLowerCase('fr');
const EPS = 1e-7;

type Row = PriorityFeasibility['beds'][number];
type Garden = { key: string; name: string; sheltered: boolean; needs: BedIrrigationNeed[] };
type Parcel = { key: string; name: string; gardens: Garden[] };

export function ArbitrationPlan({ feasibility, level, crops, pending, onSave }: {
  feasibility: IrrigationFeasibility;
  level: PriorityFeasibility;
  crops: ArbitrationCrops | null;
  pending: boolean;
  onSave: (selectedBedIds: string[]) => Promise<void>;
}) {
  const [selection, setSelection] = useState(() => initialArbitrationSelection(level));
  const [farmView, setFarmView] = useState(false);
  const preview = useMemo(() => previewArbitration(feasibility, level.priority, selection), [feasibility, level.priority, selection]);
  const saved = level.arbitration === 'validated' && level.decision ? initialArbitrationSelection(level) : null;
  const unchanged = saved !== null && sameBedIds(saved, selection);
  const candidates = new Set(level.candidates);
  const rows = new Map(preview.priorities.flatMap((item) => item.beds).map((row) => [row.need.bedId, row]));
  const shown = feasibility.priorities.flatMap((item) => item.beds.map((row) => row.need)).filter((need) => farmView || candidates.has(need.bedId));
  const allBeds = feasibility.priorities.reduce((total, item) => total + item.beds.length, 0);
  const toggle = (ids: readonly string[], served: boolean) => setSelection((previous) => {
    const next = new Set(previous);
    for (const id of ids) if (served) next.add(id); else next.delete(id);
    return level.candidates.filter((id) => next.has(id));
  });
  const label = lower(level.priority);
  const served = selection.length;

  return <section className="arbitration-plan" aria-labelledby={`arbitrage-${level.priority}`}>
    <header className="arbitration-heading">
      <h3 id={`arbitrage-${level.priority}`}>L’eau ne suffit pas pour toutes les planches de priorité {label}</h3>
      <p>Décochez les planches qui peuvent attendre. L’eau se partage entre les planches cochées : chacune reçoit la même part de son besoin. Les planches décochées ne reçoivent rien cette semaine.</p>
      {level.arbitration === 'revalidation_required' ? <p className="feasibility-warning">Votre choix précédent n’est plus valable : les planches ou l’eau ont changé. Toutes les planches à choisir sont de nouveau cochées ; vérifiez, puis validez.</p> : null}
    </header>
    <Summary preview={preview} level={level} priorities={preview.priorities} served={served} />
    <div className="arbitration-toolbar">
      <div role="group" aria-label="Planches affichées" className="arbitration-views">
        <button type="button" aria-pressed={!farmView} onClick={() => setFarmView(false)}>Planches à choisir ({level.candidates.length})</button>
        <button type="button" aria-pressed={farmView} onClick={() => setFarmView(true)}>Toute la ferme ({allBeds})</button>
      </div>
      {crops ? <p className="arbitration-legend" aria-label="Légende de la frise">
        <span><i className="is-crop" />culture en place</span><span><i className="is-harvest" />période de récolte</span>
        <span><i className="is-planned" />culture prévue</span><span><i className="is-now" />cette semaine</span>
      </p> : <p className="arbitration-note">Plan de culture non lu : les cultures des planches ne s’affichent pas.</p>}
    </div>
    <OtherLevels priorities={preview.priorities} current={level.priority} />
    {parcelsOf(shown).map((parcel) => <section key={parcel.key} className="arbitration-parcel" aria-label={parcel.name}>
      <h4>{parcel.name}</h4>
      {parcel.gardens.map((garden) => {
        const choosable = garden.needs.filter((need) => candidates.has(need.bedId)).map((need) => need.bedId);
        return <article key={garden.key} className="arbitration-garden">
          <header>
            <div className="arbitration-garden-title">
              <strong>{garden.name}</strong>
              <span className={`arbitration-chip${garden.sheltered ? ' is-shelter' : ''}`}>{garden.sheltered ? 'Abri' : 'Plein champ'}</span>
              <small>{gardenSummary(garden, choosable, selection, rows)}</small>
            </div>
            {choosable.length ? <div className="arbitration-garden-actions">
              <button type="button" disabled={pending} aria-label={`Tout servir : ${garden.name}`} onClick={() => toggle(choosable, true)}>Tout servir</button>
              <button type="button" disabled={pending} aria-label={`Ne rien servir : ${garden.name}`} onClick={() => toggle(choosable, false)}>Ne rien servir</button>
            </div> : null}
          </header>
          <div className="arbitration-table">
            <div className="arbitration-columns" aria-hidden="true">
              <span>Servir</span><span>Planche</span>
              {crops ? <ArbitrationTimelineHeader weekStart={crops.weekStart} /> : <span />}
              <span>Cette semaine</span><span>Besoin</span><span>Part d’eau</span>
            </div>
            {garden.needs.map((need) => <BedRow key={need.bedId} need={need} row={rows.get(need.bedId)!} crops={crops?.beds[need.bedId] ?? null}
              cropsRead={crops !== null} choosable={candidates.has(need.bedId)} checked={selection.includes(need.bedId)} farmView={farmView}
              level={level} preview={preview} pending={pending} onToggle={(value) => toggle([need.bedId], value)} />)}
          </div>
        </article>;
      })}
    </section>)}
    <p className="arbitration-footnote">Les cultures et leurs dates viennent du plan de culture d’Ouvre ta ferme ; le stade et le Kc, du besoin par culture du module, à titre d’information. Le besoin de la semaine reste l’objectif de la planche, moins la pluie et les arrosages.</p>
    <footer className="arbitration-footer">
      <div>
        <strong aria-live="polite">{count(served, 'planche servie', 'planches servies')} · {preview.share === null ? 'aucune eau répartie' : preview.share + EPS >= 1 ? 'chacune reçoit tout son besoin' : `chacune reçoit ${pct(preview.share)} de son besoin`} · {m3(preview.allocatedCubicMeters)} répartis</strong>
        <p role="status">{unchanged && level.decision
          ? `Répartition validée le ${decided.format(new Date(level.decision.decidedAt))} : le planning réserve sa part à chaque planche servie, sans la redistribuer.`
          : `Rien n’est enregistré tant que vous n’avez pas validé.${saved ? ' La répartition validée reste en vigueur jusque-là.' : ''}`}</p>
      </div>
      <div className="arbitration-actions">
        <button type="button" className="arbitration-secondary" disabled={pending || sameBedIds(selection, level.candidates)} onClick={() => setSelection([...level.candidates])}>Revenir à la proposition</button>
        <button type="button" disabled={pending || unchanged} onClick={() => void onSave(selection)}>{pending ? 'Enregistrement…' : unchanged ? 'Répartition validée' : 'Valider la répartition'}</button>
      </div>
    </footer>
  </section>;
}

function Summary({ preview, level, priorities, served }: { preview: ArbitrationPreview; level: PriorityFeasibility; priorities: PriorityFeasibility[]; served: number }) {
  const before = priorities.slice(0, FEASIBILITY_PRIORITIES.indexOf(level.priority)).filter((item) => item.allocatedCubicMeters > EPS);
  const available = preview.availableCubicMeters;
  const selectedRows = preview.level.beds.filter((row) => (row.proposedCubicMeters ?? 0) > EPS);
  const segments = available > EPS ? [
    ...selectedRows.filter((row) => row.status !== 'below_threshold').map((row) => ({ key: row.need.bedId, name: row.need.bedName, volume: row.allocatedCubicMeters ?? 0, kind: 'is-served' })),
    ...(preview.belowThresholdCubicMeters > EPS ? [{ key: 'seuil', name: 'sous le seuil', volume: preview.belowThresholdCubicMeters, kind: 'is-below' }] : []),
    ...(preview.leftoverCubicMeters > EPS ? [{ key: 'reste', name: 'reste', volume: preview.leftoverCubicMeters, kind: 'is-rest' }] : []),
  ] : [];
  const text = `${m3(preview.allocatedCubicMeters)} répartis entre ${count(served, 'planche')}`
    + (preview.belowThresholdCubicMeters > EPS ? ` · ${m3(preview.belowThresholdCubicMeters)} sous le seuil` : '')
    + (preview.leftoverCubicMeters > EPS ? ` · ${m3(preview.leftoverCubicMeters)} restent` : '');
  const below = preview.level.beds.filter((row) => preview.belowThresholdBedIds.includes(row.need.bedId));
  const thresholds = [...new Set(below.map((row) => row.need.thresholdMm))];
  return <div className="arbitration-summary">
    <div className="arbitration-tiles">
      <div className="arbitration-tile"><span>Eau disponible</span><strong>{m3(available)}</strong>
        <small>pour la priorité {lower(level.priority)}, d’ici dimanche soir{before.length ? `, après ${m3(before.reduce((total, item) => total + item.allocatedCubicMeters, 0))} pour la priorité ${before.map((item) => lower(item.priority)).join(' et ')}` : ''}</small></div>
      <div className="arbitration-tile"><span>Besoin des planches cochées</span><strong>{m3(preview.selectedNeedCubicMeters)}</strong>
        <small>sur {m3(level.knownNeedCubicMeters)} pour {count(level.candidates.length, 'planche')} à choisir</small></div>
      <div className="arbitration-tile is-share"><span>Chaque planche cochée reçoit</span><strong>{preview.share === null ? '—' : pct(preview.share)}</strong>
        <small>{preview.share === null ? 'aucune planche cochée' : preview.share + EPS >= 1 ? 'de son besoin : tout son besoin' : 'de son besoin, la même part pour toutes'}</small></div>
      <div className="arbitration-tile"><span>Planches servies</span><strong>{served} sur {level.candidates.length}</strong><small>les autres ne reçoivent rien cette semaine</small></div>
    </div>
    <div className="arbitration-distribution">
      <p><strong>Répartition de l’eau disponible</strong><span>{available > EPS ? text : 'Aucune eau disponible pour ce niveau d’ici dimanche soir.'}</span></p>
      {segments.length ? <div className="arbitration-bar" role="img" aria-label={text}>
        {segments.map((segment) => {
          const width = Math.min(100, segment.volume / available * 100);
          return <span key={segment.key} className={segment.kind} style={{ width: `${width.toFixed(3)}%` }} title={`${segment.name} : ${m3(segment.volume)}`}>{width > 6 ? segment.name : ''}</span>;
        })}
      </div> : null}
    </div>
    {below.length ? <p className="feasibility-warning">Sous le seuil de planification{thresholds.length === 1 ? ` (${mm(thresholds[0])})` : ''}, la part de {below.map((row) => row.need.bedName).join(', ')} ne serait pas transmise au planning. Servez moins de planches pour que chacune reçoive davantage.</p> : null}
  </div>;
}

function OtherLevels({ priorities, current }: { priorities: PriorityFeasibility[]; current: PriorityFeasibility['priority'] }) {
  const index = FEASIBILITY_PRIORITIES.indexOf(current);
  const lines = priorities.flatMap((item, position) => {
    if (position === index || item.candidates.length === 0) return [];
    const beds = count(item.candidates.length, 'planche');
    if (position < index) return [`Priorité ${lower(item.priority)} : ${m3(item.allocatedCubicMeters)} pour ${beds}, servie avant ce choix.`];
    return [item.allocatedCubicMeters > EPS
      ? `Priorité ${lower(item.priority)} : ${m3(item.allocatedCubicMeters)} pour ${beds}, après ce choix.`
      : `Priorité ${lower(item.priority)} : en attente (${beds}) ; il ne restera rien pour elle cette semaine.`];
  });
  return lines.length ? <div className="arbitration-levels">{lines.map((line) => <p key={line}>{line}</p>)}</div> : null;
}

function BedRow({ need, row, crops, cropsRead, choosable, checked, farmView, level, preview, pending, onToggle }: {
  need: BedIrrigationNeed; row: Row; crops: ArbitrationBedCrops | null; cropsRead: boolean; choosable: boolean; checked: boolean; farmView: boolean;
  level: PriorityFeasibility; preview: ArbitrationPreview; pending: boolean; onToggle: (served: boolean) => void;
}) {
  const present = crops?.present ?? [];
  const serveLabel = cropsRead ? `Servir ${need.bedName} : ${present.length ? present.join(', ') : 'planche nue'}` : `Servir ${need.bedName}`;
  return <div className={`arbitration-bed${choosable && !checked ? ' is-off' : ''}`}>
    <div className="arbitration-serve">{choosable
      ? <label className="arbitration-check"><input type="checkbox" checked={checked} disabled={pending} aria-label={serveLabel} onChange={(event) => onToggle(event.target.checked)} /></label>
      : <span className="arbitration-fixed" aria-hidden="true">{(row.allocatedCubicMeters ?? 0) > EPS ? '✓' : row.status === 'unknown' || row.status === 'no_need' ? '—' : '…'}</span>}</div>
    <div className="arbitration-name"><strong>{need.bedName}</strong><small>{area.format(need.areaSquareMeters)} m²{farmView ? ` · priorité ${lower(need.priority)}` : ''}</small></div>
    <ArbitrationTimeline crops={crops?.crops ?? null} />
    <div className="arbitration-week"><span>{crops?.week.main ?? '—'}</span>{crops?.week.detail ? <small>{crops.week.detail}</small> : null}</div>
    <div className="arbitration-need"><span>{need.effectiveNeedMm === null ? 'Non calculable' : mm(need.effectiveNeedMm)}</span><small>{need.effectiveVolumeCubicMeters === null ? '' : m3(need.effectiveVolumeCubicMeters)}</small></div>
    <div className="arbitration-share">{choosable ? <Share need={need} row={row} checked={checked} share={preview.share} /> : <Status row={row} need={need} level={level} />}</div>
  </div>;
}

function Share({ need, row, checked, share }: { need: BedIrrigationNeed; row: Row; checked: boolean; share: number | null }) {
  if (!checked) return <><span className="is-off">Non servie</span><small>rien cette semaine</small></>;
  const part = share ?? 0;
  const proposed = row.proposedCubicMeters ?? 0;
  return <>
    <span className="arbitration-share-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, part * 100).toFixed(1)}%` }} /></span>
    <span>{mm((need.effectiveNeedMm ?? 0) * part)} · {m3(proposed)}</span><small>{pct(part)} de son besoin</small>
    {row.status === 'below_threshold' ? <small className="is-below">Sous le seuil de {mm(need.thresholdMm)} : pas transmise au planning</small> : null}
    {row.hydraulicQuality === 'incompatible' ? <small className="is-below">Aucune alimentation compatible avec les caractéristiques renseignées.</small> : null}
  </>;
}

function Status({ row, need, level }: { row: Row; need: BedIrrigationNeed; level: PriorityFeasibility }) {
  const before = FEASIBILITY_PRIORITIES.indexOf(need.priority) < FEASIBILITY_PRIORITIES.indexOf(level.priority);
  const allocated = row.allocatedCubicMeters ?? 0;
  const text = row.status === 'unknown' ? 'Données insuffisantes'
    : row.status === 'no_need' ? 'Aucun besoin'
      : row.status === 'full' ? 'Servie en entier'
        : allocated > EPS ? `Servie à ${pct(allocated / (need.effectiveVolumeCubicMeters ?? allocated))}`
          : 'En attente';
  const detail = row.status === 'unknown' || row.status === 'no_need' ? `priorité ${lower(need.priority)}`
    : before ? `priorité ${lower(need.priority)}, servie avant ce choix` : allocated > EPS ? `priorité ${lower(need.priority)}, après ce choix` : `priorité ${lower(need.priority)} : rien cette semaine`;
  return <><span className={allocated > EPS ? undefined : 'is-off'}>{text}</span><small>{detail}</small></>;
}

function gardenSummary(garden: Garden, choosable: readonly string[], selection: readonly string[], rows: ReadonlyMap<string, Row>): string {
  if (!choosable.length) return `${count(garden.needs.length, 'planche')} · aucune à choisir`;
  const need = choosable.reduce((total, id) => total + (rows.get(id)?.need.effectiveVolumeCubicMeters ?? 0), 0);
  const part = choosable.filter((id) => selection.includes(id)).reduce((total, id) => total + (rows.get(id)?.proposedCubicMeters ?? 0), 0);
  const servedHere = choosable.filter((id) => selection.includes(id)).length;
  return `${count(choosable.length, 'planche')} à choisir · ${count(servedHere, 'servie')} · besoin ${m3(need)} · part ${m3(part)}`;
}

/** Les planches par parcelle puis par jardin ou abri, chacun dans l'ordre naturel des noms (3.8 quater). */
function parcelsOf(needs: readonly BedIrrigationNeed[]): Parcel[] {
  const parcels = new Map<string, Parcel>();
  for (const need of needs) {
    const parcel = parcels.get(need.zoneId) ?? { key: need.zoneId, name: need.zoneName, gardens: [] };
    parcels.set(need.zoneId, parcel);
    let garden = parcel.gardens.find((item) => item.key === need.plotId);
    if (!garden) { garden = { key: need.plotId, name: need.plotName, sheltered: need.sheltered, needs: [] }; parcel.gardens.push(garden); }
    garden.needs.push(need);
  }
  const byName = <T extends { name: string; key: string }>(left: T, right: T) => compareNamesNaturally(left.name, right.name) || compareNamesNaturally(left.key, right.key);
  return [...parcels.values()].sort(byName).map((parcel) => ({
    ...parcel,
    gardens: parcel.gardens.sort(byName).map((garden) => ({ ...garden, needs: garden.needs.sort((left, right) => compareNamesNaturally(left.bedName, right.bedName) || compareNamesNaturally(left.bedId, right.bedId)) })),
  }));
}
