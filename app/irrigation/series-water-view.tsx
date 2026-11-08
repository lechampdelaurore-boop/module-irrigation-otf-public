'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import type { SeriesWaterDashboard } from '@/lib/services/series-water-service';
import { loadSeriesWaterAction } from './irrigation-history-actions';
import { SeriesCropWaterPanel } from './crop-water/series-crop-water-panel';

type Report = Extract<SeriesWaterDashboard, { available: true }>['report'];
type SeriesSummary = Report['series'][number];

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const volumeFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

/**
 * La vue « Séries » des cumuls (docs/series-contract.md, « Interface ») : une
 * ligne par série avec son implantation, sa dernière récolte, ses planches et
 * ses cumuls de l'implantation à aujourd'hui ; les séries à venir à part ; le
 * détail par planche. Recalculée à chaque ouverture, jamais stockée.
 */
export function SeriesWaterView({ season, viewTabs, cropWater }: { season: number; viewTabs: ReactNode; cropWater: boolean }) {
  const [dashboard, setDashboard] = useState<SeriesWaterDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await loadSeriesWaterAction({ season });
      if (result.ok) setDashboard(result.dashboard);
      else setError(result.message);
    });
  }, [season]);

  return (
    <section className="irrigation-history-dashboard series-water-view" aria-labelledby="series-water-title">
      <header className="irrigation-history-heading">
        <div>
          <p className="eyebrow">Suivi réel · saison {season}</p>
          <h2 id="series-water-title">Cumuls et historique</h2>
          <p>L’eau reçue par chaque série culturale, de son implantation à sa dernière récolte, d’après le plan de culture d’Ouvre ta ferme.</p>
        </div>
      </header>

      {viewTabs}

      {error ? <p className="history-error" role="alert">{error}</p> : null}
      {pending || (dashboard === null && error === null) ? <p className="history-loading" role="status">Calcul des cumuls par série…</p> : null}

      {dashboard && !dashboard.available ? (
        <p className="history-empty">
          Le plan de culture n’a pas encore été lu depuis Ouvre ta ferme pour cette saison : cliquez sur « Actualiser » en haut de la page, puis revenez ici.
        </p>
      ) : null}

      {dashboard?.available ? <SeriesReport dashboard={dashboard} cropWater={cropWater} /> : null}
    </section>
  );
}

function SeriesReport({ dashboard, cropWater }: { dashboard: Extract<SeriesWaterDashboard, { available: true }>; cropWater: boolean }) {
  const { report } = dashboard;
  return (
    <>
      <div className="history-list-heading">
        <div>
          <h3>Séries suivies</h3>
          <p>
            {report.series.length} série{report.series.length > 1 ? 's' : ''} en cours ou terminée{report.series.length > 1 ? 's' : ''},
            {' '}{report.upcoming.length} à venir · cumuls observés jusqu’au {formatDateKey(dashboard.today)}.
          </p>
        </div>
      </div>

      {dashboard.warnings.length > 0 ? (
        <div className="history-warnings">
          {dashboard.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}

      {report.series.length > 0 ? (
        <div className="history-event-list series-list">
          {report.series.map((item) => <SeriesCard key={item.seriesId} item={item} season={dashboard.season} cropWater={cropWater} />)}
        </div>
      ) : (
        <p className="history-empty">Aucune série implantée à ce jour dans le plan de culture de la saison.</p>
      )}

      {report.upcoming.length > 0 ? (
        <>
          <div className="history-list-heading">
            <div>
              <h3>À venir</h3>
              <p>Implantation planifiée après aujourd’hui : rien n’est cumulé, rien n’est mêlé à l’observé.</p>
            </div>
          </div>
          <ul className="series-upcoming" aria-label="Séries à venir">
            {report.upcoming.map((item) => (
              <li key={item.seriesId}>
                <strong>{item.name}</strong>
                <span>{item.plantNames.join(', ')}</span>
                <span>{implantationLabel(item)} · {bedsLabel(item)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

function SeriesCard({ item, season, cropWater }: { item: SeriesSummary; season: number; cropWater: boolean }) {
  // La fiche du besoin de la culture se calcule à l'ouverture de la carte, pas pour toutes les séries d'un coup.
  const [opened, setOpened] = useState(false);
  const card = useRef<HTMLDetailsElement>(null);
  // Une carte ouverte avant que React ne reprenne la main n'a pas déclenché `onToggle`.
  useEffect(() => { if (card.current?.open) setOpened(true); }, []);
  return (
    <details ref={card} className="history-event-card series-card" onToggle={(event) => { if (event.currentTarget.open) setOpened(true); }}>
      <summary>
        <span className="series-card-main">
          <strong>{item.name}</strong>
          <small>{item.plantNames.join(', ')} · {implantationLabel(item)} · {harvestLabel(item)}</small>
          <small>{bedsLabel(item)}{item.observedPeriod ? ` · du ${formatDateKey(item.observedPeriod.startDate)} au ${formatDateKey(item.observedPeriod.endDate)}` : ''}</small>
        </span>
        <span className="series-measures">
          <Measure label="Irrigation" value={mmAndVolume(item)} />
          <Measure label="Pluie" value={item.rainMm === null ? 'indisponible' : `${numberFormatter.format(item.rainMm)} mm`} />
          <Measure label="Objectif" value={item.objectiveMm === null ? 'indisponible' : `${numberFormatter.format(item.objectiveMm)} mm`} />
          <Measure label="Écart" value={gapLabel(item.gapToObjectiveMm)} tone={gapTone(item.gapToObjectiveMm)} />
          <Measure label="ET0" value={item.et0Mm === null ? 'indisponible' : `${numberFormatter.format(item.et0Mm)} mm`} />
        </span>
      </summary>
      <div className="history-event-detail">
        <dl>
          <Detail label="Implantation" value={implantationLabel(item)} />
          <Detail label="Dernière récolte" value={harvestLabel(item)} />
          <Detail label="Statut" value={item.occupation.status === 'ongoing' ? 'En cours' : 'Terminée'} />
          <Detail label="Surface occupée" value={item.areaSquareMeters === null ? 'Inconnue — largeur de planche manquante, pas de moyenne' : `${numberFormatter.format(item.areaSquareMeters)} m²`} />
          <Detail label="Volume d’irrigation" value={`${volumeFormatter.format(item.irrigationCubicMeters)} m³${item.irrigationVolumeIncomplete ? ' — incomplet, surface mouillée inconnue' : ''}`} />
          <Detail label="Pluie réelle" value={item.rainAvailability.complete ? `${numberFormatter.format(item.rainMm ?? 0)} mm` : `Indisponible — ${item.rainAvailability.availableDays}/${item.rainAvailability.totalDays} jour(s)`} />
          <Detail label="Objectif restant" value={item.objectiveRemainingMm === null ? '—' : `${numberFormatter.format(item.objectiveRemainingMm)} mm jusqu’à la dernière récolte attendue`} />
        </dl>
        <table className="series-beds">
          <caption>Planches de la série, millimètres reçus sur la période</caption>
          <thead>
            <tr><th scope="col">Planche</th><th scope="col">Jardin ou abri</th><th scope="col">Linéaire</th><th scope="col">Irrigation</th><th scope="col">Volume</th><th scope="col">Pluie</th><th scope="col">Objectif</th></tr>
          </thead>
          <tbody>
            {item.beds.map((bed) => (
              <tr key={bed.bedId}>
                <th scope="row">{bed.bedName}</th>
                <td data-label="Jardin ou abri">{bed.plotName}{bed.sheltered ? ' (abri)' : ''}</td>
                <td data-label="Linéaire">{bed.lengthMeters === null ? '—' : `${numberFormatter.format(bed.lengthMeters)} m`}</td>
                <td data-label="Irrigation">{numberFormatter.format(bed.irrigationMm)} mm</td>
                <td data-label="Volume">{bed.irrigationCubicMeters === null ? 'inconnu' : `${volumeFormatter.format(bed.irrigationCubicMeters)} m³`}</td>
                <td data-label="Pluie">{bed.rainMm === null ? '—' : `${numberFormatter.format(bed.rainMm)} mm`}</td>
                <td data-label="Objectif">{bed.objectiveMm === null ? '—' : `${numberFormatter.format(bed.objectiveMm)} mm`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {opened && cropWater ? <SeriesCropWaterPanel season={season} seriesId={item.seriesId} seriesName={item.name} /> : null}
      </div>
    </details>
  );
}

function Measure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <span className="series-measure" data-tone={tone}><small>{label}</small><strong>{value}</strong></span>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function mmAndVolume(item: SeriesSummary) {
  if (item.irrigationMm === null) return `par planche seulement · ${volumeFormatter.format(item.irrigationCubicMeters)} m³`;
  return `${numberFormatter.format(item.irrigationMm)} mm · ${volumeFormatter.format(item.irrigationCubicMeters)} m³${item.irrigationVolumeIncomplete ? ' (incomplet)' : ''}`;
}

function implantationLabel(item: SeriesSummary) {
  const { implantation } = item.occupation;
  // « semis direct réalisé », « plantation planifiée » : l'accord suit la nature.
  const label = implantation.kind === 'direct-sowing'
    ? (implantation.realized ? 'semis direct réalisé' : 'semis direct planifié')
    : (implantation.realized ? 'plantation réalisée' : 'plantation planifiée');
  return `${label} ${weekLabel(implantation.week)}`;
}

function harvestLabel(item: SeriesSummary) {
  const { lastHarvest } = item.occupation;
  if (lastHarvest === null) return 'dernière récolte inconnue';
  return `dernière récolte ${lastHarvest.realized ? 'réalisée' : 'attendue'} ${weekLabel(lastHarvest.week)}`;
}

function bedsLabel(item: SeriesSummary) {
  const names = item.beds.map((bed) => bed.bedName).join(', ');
  const linear = item.beds.reduce<number | null>((sum, bed) => (sum === null || bed.lengthMeters === null ? null : sum + bed.lengthMeters), 0);
  return `${item.beds.length} planche${item.beds.length > 1 ? 's' : ''} (${names || '—'})${linear === null ? '' : ` · ${numberFormatter.format(linear)} m`}`;
}

/** `2025-W45` → « semaine 45 de 2025 ». */
function weekLabel(week: string) {
  return `semaine ${Number(week.slice(6))} de ${week.slice(0, 4)}`;
}

function gapLabel(value: number | null) {
  if (value === null) return 'non calculé';
  return `${value > 0 ? '+' : ''}${numberFormatter.format(value)} mm`;
}

function gapTone(value: number | null) {
  if (value === null || value === 0) return 'neutral';
  return value > 0 ? 'deficit' : 'surplus';
}

function formatDateKey(dateKey: string) {
  return dateFormatter.format(new Date(`${dateKey}T12:00:00Z`));
}
