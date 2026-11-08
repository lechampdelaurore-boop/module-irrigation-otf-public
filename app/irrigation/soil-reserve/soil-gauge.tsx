'use client';

import { useEffect, useRef, useState } from 'react';
import { soilGardenAnchor } from '@/lib/domain/today/reliability';
import { gaugeShortDayLabel, type SoilGaugePlot, type SoilGaugeView, type SoilGaugeZone } from '@/lib/domain/soil-reserve/gauge-view';
import type { SoilObservation } from '@/lib/domain/soil-reserve/gauge';
import { saveSoilObservationAction, type SoilReserveActionResult } from '../soil-reserve-actions';
import { SoilBed } from './soil-bed';

/**
 * La jauge de la réserve du sol par parcelle et par jardin
 * (docs/soil-reserve-contract.md, « L'écran », « L'observation : le
 * curseur », 5 ter, PR 3b) : le curseur de la parcelle en tête, qui ne règle
 * que ses jardins de plein champ ; par jardin ou abri, le % du plein de
 * maintenant, le prévu jusqu'à dimanche, la plus basse de ses planches, les
 * planches sans culture à part, son curseur, et le détail par planche à la
 * demande.
 */

type Run = (operation: () => Promise<SoilReserveActionResult>) => void;

const whole = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
/**
 * Les quatre repères du curseur (D-053), ses seuls crans depuis le retour du
 * porteur du 7 novembre 2026 (3.8, précision P40) : une observation dit l'un
 * des quatre états. Une observation plus ancienne, entre deux crans, se lit
 * telle quelle ; le curseur part alors du cran le plus proche.
 */
const MARKS = [
  { percent: 25, label: 'sec' },
  { percent: 50, label: 'frais' },
  { percent: 75, label: 'humide' },
  { percent: 100, label: 'détrempé' },
] as const;
const CURSOR_STEP = 25;

export function SoilGaugePart({ season, gauge, pending, run }: { season: number; gauge: SoilGaugeView; pending: boolean; run: Run }) {
  if (gauge.zones.length === 0) return <p className="crop-coefficients-empty">Aucune parcelle cette saison.</p>;
  return (
    <div className="soil-gauge">
      {gauge.zones.map((zone) => <ZoneGauge key={zone.zoneId} season={season} zone={zone} today={gauge.today} pending={pending} run={run} />)}
    </div>
  );
}

function ZoneGauge({ season, zone, today, pending, run }: { season: number; zone: SoilGaugeZone; today: string; pending: boolean; run: Run }) {
  return (
    <section className="soil-zone" aria-label={`Réserve · ${zone.name}`}>
      <h4>Parcelle {zone.name}</h4>
      {zone.fieldPlotCount > 0 ? (
        <ObservationForm
          key={zone.observation?.recordedAt ?? 'aucune'}
          title="Observer la parcelle"
          note="Règle d’un coup ses jardins de plein champ ; les abris gardent le leur."
          observation={zone.observation}
          place={{ zoneId: zone.zoneId, plotId: null }}
          season={season}
          pending={pending}
          run={run}
        />
      ) : null}
      {zone.plots.map((plot) => <PlotGauge key={plot.plotId} season={season} zoneId={zone.zoneId} plot={plot} today={today} pending={pending} run={run} />)}
    </section>
  );
}

function plotHeadline(plot: SoilGaugePlot): string {
  const garden = plot.garden;
  if (garden.percent === null) return garden.countedBeds + garden.unknownBeds === 0 ? 'aucune planche cultivée' : 'inconnue';
  const parts = [`${whole.format(garden.percent)} % du plein maintenant`];
  if (garden.lowest) parts.push(`la plus basse : ${garden.lowest.bedName}, ${whole.format(garden.lowest.percent)} %`);
  return parts.join(' · ');
}

function PlotGauge({ season, zoneId, plot, today, pending, run }: { season: number; zoneId: string; plot: SoilGaugePlot; today: string; pending: boolean; run: Run }) {
  const garden = plot.garden;
  const anchor = soilGardenAnchor(plot.plotId);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    // « Observer le sol de … » sur « Aujourd'hui » (audit ergonomique, lot 2) ouvre le jardin désigné.
    if (window.location.hash === `#${anchor}` && details.current) {
      details.current.open = true;
      details.current.scrollIntoView({ block: 'start' });
    }
  }, [anchor]);
  return (
    <details ref={details} id={anchor} className="soil-garden" suppressHydrationWarning>
      <summary>
        <strong>{plot.name}{plot.sheltered ? ' · abri' : ''}</strong>
        <small>{plotHeadline(plot)}</small>
      </summary>
      <div className="soil-garden-body">
        <p className="soil-garden-counts">
          {garden.countedBeds} planche{garden.countedBeds > 1 ? 's' : ''} comptée{garden.countedBeds > 1 ? 's' : ''}
          {garden.unknownBeds > 0 ? ` · ${garden.unknownBeds} inconnue${garden.unknownBeds > 1 ? 's' : ''}` : ''}
          {garden.withoutCrop.length > 0 ? ` · ${garden.withoutCrop.length} sans culture, à part` : ''}
        </p>
        {garden.countedBeds > 0 ? (
          <ul className="soil-week" aria-label={`Prévu jusqu’à dimanche, fin de chaque jour · ${plot.name}`}>
            {plot.week.map((item) => (
              <li key={item.date}>
                <span>{gaugeShortDayLabel(item.date)}</span>
                <strong>{item.percent === null ? 'inconnue' : `${whole.format(item.percent)} %`}</strong>
                <small>prévu</small>
              </li>
            ))}
          </ul>
        ) : null}
        <ObservationForm
          key={plot.observation?.recordedAt ?? 'aucune'}
          title={`Observer ${plot.sheltered ? 'l’abri' : 'le jardin'}`}
          note={null}
          observation={plot.observation}
          place={{ zoneId, plotId: plot.plotId }}
          season={season}
          pending={pending}
          run={run}
        />
        <div className="soil-beds" role="list" aria-label={`Planches · ${plot.name}`}>
          {plot.beds.map((bed) => (
            <div role="listitem" key={bed.bedId}>
              <SoilBed bed={bed} season={season} today={today} pending={pending} run={run} />
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function ObservationForm({ title, note, observation, place, season, pending, run }: {
  title: string;
  note: string | null;
  observation: SoilObservation | null;
  place: { zoneId: string; plotId: string | null };
  season: number;
  pending: boolean;
  run: Run;
}) {
  const [percent, setPercent] = useState<number>(() => nearestMark(observation?.percent ?? MARKS[1].percent).percent);
  const [when, setWhen] = useState<'now' | 'earlier'>('now');
  const [earlier, setEarlier] = useState('');
  const readable = when === 'now' || earlier !== '';
  const submit = () => {
    if (!readable) return;
    // L'heure saisie est celle du navigateur, à la ferme ; elle part en UTC.
    const observedAt = when === 'now' ? new Date().toISOString() : new Date(earlier).toISOString();
    run(() => saveSoilObservationAction({ season, zoneId: place.zoneId, plotId: place.plotId, percent, observedAt }));
  };
  const nearest = nearestMark(percent);
  return (
    <div className="soil-observation" role="group" aria-label={title}>
      <p className="soil-observation-last">
        {observation
          ? `Dernière observation : ${observation.percent} % du plein, ${timeFormat.format(new Date(observation.observedAt))}${observation.plotId === null && place.plotId !== null ? ', par la parcelle' : ''}.`
          : 'Aucune observation encore.'}
        {note ? ` ${note}` : ''}
      </p>
      <label className="soil-cursor">
        <span>Ce que vous observez : « {nearest.label} », {percent} % du plein</span>
        <input type="range" min={MARKS[0].percent} max={100} step={CURSOR_STEP} value={percent} list="soil-cursor-marks" onChange={(event) => setPercent(Number(event.target.value))} />
      </label>
      <p className="soil-cursor-marks" aria-hidden="true">
        {MARKS.map((mark) => <span key={mark.percent}>{mark.label} {mark.percent} %</span>)}
      </p>
      <fieldset className="soil-observation-when">
        <legend>Observé</legend>
        <label className="crop-water-option">
          <input type="radio" name={`soil-when-${place.zoneId}-${place.plotId ?? 'parcelle'}`} checked={when === 'now'} onChange={() => setWhen('now')} />
          <span>maintenant</span>
        </label>
        <label className="crop-water-option">
          <input type="radio" name={`soil-when-${place.zoneId}-${place.plotId ?? 'parcelle'}`} checked={when === 'earlier'} onChange={() => setWhen('earlier')} />
          <span>plus tôt, aujourd’hui ou hier</span>
        </label>
        {when === 'earlier' ? (
          <label className="soil-observation-time">
            <span>Jour et heure de l’observation</span>
            <input type="datetime-local" value={earlier} onChange={(event) => setEarlier(event.target.value)} />
          </label>
        ) : null}
      </fieldset>
      <button type="button" disabled={pending || !readable} onClick={submit}>Enregistrer l’observation</button>
    </div>
  );
}

function nearestMark(percent: number) {
  return MARKS.reduce((best, mark) => (Math.abs(mark.percent - percent) < Math.abs(best.percent - percent) ? mark : best));
}

/** Les repères du curseur, une fois pour la page. */
export function SoilCursorMarks() {
  return (
    <datalist id="soil-cursor-marks">
      {MARKS.map((mark) => <option key={mark.percent} value={mark.percent} label={mark.label} />)}
    </datalist>
  );
}
