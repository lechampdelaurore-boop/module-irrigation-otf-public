'use client';
import { useState } from 'react';
import {
  authorisedEnvelope,
  flowMeasurementOrigin,
  flowReferenceChange,
  resourceConsumptionByMonth,
  type ResourceConsumptionPeriod,
  type ResourceFlowMeasurement,
} from '@/lib/domain/resource-flow';
import type { WaterResource } from '@/lib/domain/water-resources';
import {
  formatIrrigationDateTime,
  formatIrrigationDateTimeInput,
} from '@/lib/domain/irrigation-format';
import { hoursAndMinutesFromSeconds, hoursFromSeconds } from '@/lib/domain/units';
import type { ResourceMeterReadingRecord } from '@/db/water-resource-flow-repository';
import type { ResourceFlowHistoryEntry } from '@/lib/services/resource-flow-history';
import { ResourceFlowChart } from './resource-flow-chart';
import { FigureOrigin } from './shell/figure-origin';

/**
 * Relevés du compteur d'une ressource, mesures qu'ils portent, et mise à jour
 * du débit de référence (`docs/resource-flow-contract.md`).
 *
 * La saisie est pensée pour être faite au forage, debout, sur un téléphone :
 * date et heure pré-remplies, un seul champ obligatoire, le reste facultatif.
 */

const flowFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const volumeFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, signDisplay: 'exceptZero' });
// La part de l'autorisé n'est pas une variation : elle ne porte pas de signe.
const ratioFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export type ResourceFlowReadingInput = {
  /** Nul pour un nouveau relevé ; sinon, le relevé que la saisie corrige. */
  readingId: string | null;
  takenAt: string;
  meterIndexCubicMeters: number;
  stoppedHours: number;
  stoppedMinutes: number;
  meterReplaced: boolean;
  note: string | null;
};

export function ResourceFlowPanel({
  resource,
  entry,
  timeZone,
  nowIso,
  authorisedCubicMetersPerDay,
  pending,
  notice,
  error,
  onSubmit,
  onDelete,
  onApply,
  onClose,
}: {
  resource: WaterResource;
  entry: ResourceFlowHistoryEntry;
  timeZone: string;
  nowIso: string;
  authorisedCubicMetersPerDay: number | null;
  pending: boolean;
  notice: string | null;
  error: string | null;
  onSubmit: (input: ResourceFlowReadingInput, onSuccess: () => void) => void;
  onDelete: (readingId: string) => void;
  onApply: (measurement: ResourceFlowMeasurement) => void;
  onClose: () => void;
}) {
  const [takenAt, setTakenAt] = useState(() => formatIrrigationDateTimeInput(nowIso, timeZone));
  const [meterIndex, setMeterIndex] = useState('');
  const [stoppedHours, setStoppedHours] = useState('0');
  const [stoppedMinutes, setStoppedMinutes] = useState('0');
  const [meterReplaced, setMeterReplaced] = useState(false);
  const [note, setNote] = useState('');
  const [correctedReadingId, setCorrectedReadingId] = useState<string | null>(null);

  const viderLaSaisie = () => {
    setMeterIndex('');
    setNote('');
    setStoppedHours('0');
    setStoppedMinutes('0');
    setMeterReplaced(false);
    setCorrectedReadingId(null);
  };

  /**
   * Recharge le formulaire avec un relevé existant. L'index y revient **non
   * arrondi** : le tableau n'en montre qu'une décimale, et recopier ce qu'il
   * affiche perdrait des litres à chaque correction.
   */
  const corriger = (reading: ResourceMeterReadingRecord) => {
    const arret = hoursAndMinutesFromSeconds(reading.stoppedSeconds ?? 0);
    setCorrectedReadingId(reading.id);
    setTakenAt(formatIrrigationDateTimeInput(reading.takenAt, timeZone));
    setMeterIndex(String(reading.meterIndexCubicMeters).replace('.', ','));
    setStoppedHours(String(arret.hours));
    setStoppedMinutes(String(arret.minutes));
    setMeterReplaced(reading.meterReplaced);
    setNote(reading.note ?? '');
  };

  const latest = entry.measurements[entry.measurements.length - 1] ?? null;
  const formatDate = (value: string) => formatIrrigationDateTime(value, timeZone);

  return (
    <section className="resource-flow-panel" aria-label={`Relevés de débit — ${resource.name}`}>
      <div className="resource-flow-heading">
        <div>
          <h3>Relevés de débit — {resource.name}</h3>
          <p>Débit de référence en vigueur : <strong>{flowFormat.format(resource.nominalFlowCubicMetersPerHour)} m³/h</strong></p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer">Fermer</button>
      </div>

      <form
        className="resource-flow-form"
        onSubmit={(event) => {
          event.preventDefault();
          // Les champs ne se vident qu'une fois le relevé accepté : effacer
          // un index refusé oblige à relire le compteur, et laisse croire que
          // l'enregistrement a eu lieu.
          onSubmit({
            readingId: correctedReadingId,
            takenAt,
            meterIndexCubicMeters: Number(meterIndex.replace(',', '.')),
            stoppedHours: Number(stoppedHours || '0'),
            stoppedMinutes: Number(stoppedMinutes || '0'),
            meterReplaced,
            note: note.trim() || null,
          }, viderLaSaisie);
        }}
      >
        {correctedReadingId ? (
          <p className="resource-flow-correcting" role="status">
            Correction du relevé du {formatDate(
              entry.readings.find((item) => item.id === correctedReadingId)?.takenAt ?? '',
            )}. La décision de débit déjà prise, elle, ne bouge pas.
          </p>
        ) : null}

        <div className="resource-flow-fields">
          <label>
            <span>Date et heure du relevé</span>
            <input type="datetime-local" value={takenAt} onChange={(event) => setTakenAt(event.target.value)} required />
          </label>
          <label>
            <span>Index du compteur (m³)</span>
            <input inputMode="decimal" value={meterIndex} onChange={(event) => setMeterIndex(event.target.value)} required />
          </label>
        </div>

        <fieldset className="resource-flow-stopped" disabled={meterReplaced}>
          <legend>Durée d’arrêt depuis le relevé précédent</legend>
          <label>
            <span>Heures</span>
            <input inputMode="numeric" value={stoppedHours} onChange={(event) => setStoppedHours(event.target.value)} />
          </label>
          <label>
            <span>Minutes</span>
            <input inputMode="numeric" value={stoppedMinutes} onChange={(event) => setStoppedMinutes(event.target.value)} />
          </label>
          <p>Le temps pendant lequel la pompe n’a pas tourné. Sans elle, le débit calculé serait celui de la période entière, arrêts compris.</p>
        </fieldset>

        <label className="resource-flow-toggle">
          <input type="checkbox" checked={meterReplaced} onChange={(event) => setMeterReplaced(event.target.checked)} />
          Le compteur a été remplacé ou remis à zéro
        </label>

        <label>
          <span>Note (facultatif)</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
        </label>

        <div className="resource-flow-actions">
          <button type="submit" disabled={pending}>
            {correctedReadingId ? 'Enregistrer la correction' : 'Enregistrer le relevé'}
          </button>
          {correctedReadingId ? (
            <button type="button" disabled={pending} onClick={viderLaSaisie}>Annuler la correction</button>
          ) : null}
        </div>
        {/* La réponse vit en haut de la section « Ressources en eau », à six
            cents pixels d'ici : un refus y passait inaperçu, et l'écran
            paraissait n'avoir rien fait. Elle est reprise sous le bouton. */}
        {error ? <p className="water-error" role="alert">{error}</p> : null}
        {notice ? <p className="water-notice" role="status">{notice}</p> : null}
      </form>

      {latest ? (
        <LatestMeasurement
          measurement={latest}
          resource={resource}
          pending={pending}
          onApply={onApply}
          formatDate={formatDate}
        />
      ) : null}

      <ResourceFlowChart
        measurements={entry.measurements}
        revisions={entry.revisions}
        currentFlowCubicMetersPerHour={resource.nominalFlowCubicMetersPerHour}
        formatFlow={(value) => flowFormat.format(value)}
        formatDate={formatDate}
      />

      <ConsumptionHistory
        measurements={entry.measurements}
        authorisedCubicMetersPerDay={authorisedCubicMetersPerDay}
        timeZone={timeZone}
      />

      <ReadingHistory
        entry={entry}
        pending={pending}
        correctedReadingId={correctedReadingId}
        onCorrect={corriger}
        onDelete={onDelete}
        formatDate={formatDate}
      />
    </section>
  );
}

function LatestMeasurement({
  measurement,
  resource,
  pending,
  onApply,
  formatDate,
}: {
  measurement: ResourceFlowMeasurement;
  resource: WaterResource;
  pending: boolean;
  onApply: (measurement: ResourceFlowMeasurement) => void;
  formatDate: (value: string) => string;
}) {
  const change = flowReferenceChange(measurement, resource.nominalFlowCubicMetersPerHour);
  const alreadyApplied = change !== null && change.toCubicMetersPerHour === change.fromCubicMetersPerHour;

  return (
    <section className="resource-flow-latest" aria-label="Dernière mesure">
      <h4>Dernière mesure, au {formatDate(measurement.toTakenAt)}</h4>
      <dl>
        <div><dt>Volume produit</dt><dd>{volumeFormat.format(measurement.producedCubicMeters)} m³</dd></div>
        <div><dt>Temps de marche</dt><dd>{volumeFormat.format(hoursFromSeconds(measurement.runningSeconds))} h</dd></div>
        <div><dt>Débit en fonctionnement</dt><dd>{measurement.runningFlowCubicMetersPerHour === null ? 'La pompe n’a pas tourné' : `${flowFormat.format(measurement.runningFlowCubicMetersPerHour)} m³/h`}<FigureOrigin text={flowMeasurementOrigin(measurement)} /></dd></div>
        <div><dt>Débit moyen sur la période</dt><dd>{flowFormat.format(measurement.averageFlowCubicMetersPerHour)} m³/h</dd></div>
      </dl>

      {change === null ? (
        <p className="resource-flow-note">Cette mesure ne donne pas de débit en fonctionnement : il n’y a rien à appliquer.</p>
      ) : alreadyApplied ? (
        <p className="resource-flow-note">Cette mesure est déjà le débit de référence de la ressource.</p>
      ) : (
        <div className={change.notable ? 'resource-flow-apply resource-flow-apply-notable' : 'resource-flow-apply'}>
          <p>
            La référence passerait de <strong>{flowFormat.format(change.fromCubicMetersPerHour)} m³/h</strong>
            {' '}à <strong>{flowFormat.format(change.toCubicMetersPerHour)} m³/h</strong>
            {Number.isFinite(change.ratio) ? <>, soit <strong>{percentFormat.format(change.ratio * 100)} %</strong></> : null}.
          </p>
          <button type="button" disabled={pending} onClick={() => onApply(measurement)}>
            Mettre à jour le débit de la ressource
          </button>
        </div>
      )}
    </section>
  );
}

function ReadingHistory({
  entry,
  pending,
  correctedReadingId,
  onCorrect,
  onDelete,
  formatDate,
}: {
  entry: ResourceFlowHistoryEntry;
  pending: boolean;
  correctedReadingId: string | null;
  onCorrect: (reading: ResourceMeterReadingRecord) => void;
  onDelete: (readingId: string) => void;
  formatDate: (value: string) => string;
}) {
  const flowByReading = new Map(entry.measurements.map((item) => [item.toReadingId, item]));

  return (
    <section className="resource-flow-history" aria-label="Historique des relevés">
      <h4>Relevés</h4>
      {entry.readings.length === 0 ? (
        <p className="resource-flow-note">Aucun relevé pour cette ressource.</p>
      ) : (
        <table>
          <thead>
            <tr><th scope="col">Relevé</th><th scope="col">Index</th><th scope="col">Débit mesuré</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {[...entry.readings].reverse().map((reading) => {
              const measurement = flowByReading.get(reading.id);
              return (
                <tr key={reading.id}>
                  <td>{formatDate(reading.takenAt)}{reading.note ? <small>{reading.note}</small> : null}</td>
                  <td>{volumeFormat.format(reading.meterIndexCubicMeters)} m³</td>
                  <td>
                    {reading.meterReplaced
                      ? 'Compteur remplacé'
                      : measurement?.runningFlowCubicMetersPerHour != null
                        ? `${flowFormat.format(measurement.runningFlowCubicMetersPerHour)} m³/h`
                        : '—'}
                  </td>
                  <td className="resource-flow-row-actions">
                    <button
                      type="button"
                      disabled={pending || correctedReadingId === reading.id}
                      onClick={() => onCorrect(reading)}
                    >
                      Corriger
                    </button>
                    <button type="button" disabled={pending} onClick={() => onDelete(reading.id)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * Ce que la ressource a réellement produit, mois par mois, et la part que cela
 * occupe dans le volume autorisé par la limite de prélèvement.
 */
function ConsumptionHistory({
  measurements,
  authorisedCubicMetersPerDay,
  timeZone,
}: {
  measurements: readonly ResourceFlowMeasurement[];
  authorisedCubicMetersPerDay: number | null;
  timeZone: string;
}) {
  const periods = resourceConsumptionByMonth(measurements, timeZone).slice(-12).reverse();
  if (periods.length === 0) return null;

  const total = periods.reduce((sum, period) => sum + period.producedCubicMeters, 0);

  return (
    <section className="resource-flow-consumption" aria-label="Volumes produits">
      <h4>Volumes produits</h4>
      <table>
        <thead>
          <tr>
            <th scope="col">Mois</th>
            <th scope="col">Volume produit</th>
            <th scope="col">Relevés</th>
            {authorisedCubicMetersPerDay === null ? null : <th scope="col">Part de l’autorisé</th>}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.month}>
              <th scope="row">{monthLabel(period, timeZone)}</th>
              <td>{volumeFormat.format(period.producedCubicMeters)} m³</td>
              <td>{period.measurementCount}</td>
              {authorisedCubicMetersPerDay === null ? null : <td>{envelopeLabel(period, authorisedCubicMetersPerDay)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total affiché</th>
            <td>{volumeFormat.format(total)} m³</td>
            <td />
            {authorisedCubicMetersPerDay === null ? null : <td />}
          </tr>
        </tfoot>
      </table>
      <p className="resource-flow-note">
        Le volume d’une mesure est porté au mois de son relevé d’arrivée, sans être
        réparti entre deux mois : répartir supposerait un débit constant, ce qui est
        faux. Relever une fois par mois rend le rattachement exact.
      </p>
      {authorisedCubicMetersPerDay === null ? null : (
        <p className="resource-flow-note">
          La part de l’autorisé compare le volume du mois à la limite journalière
          multipliée par le nombre de jours. C’est une enveloppe, pas une preuve de
          conformité : une limite journalière peut être dépassée un jour sans que le
          total du mois le montre.
        </p>
      )}
    </section>
  );
}

function monthLabel(period: ResourceConsumptionPeriod, timeZone: string): string {
  const [year, month] = period.month.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone })
    .format(new Date(Date.UTC(year, month - 1, 15)));
}

function envelopeLabel(period: ResourceConsumptionPeriod, authorisedCubicMetersPerDay: number): string {
  const envelope = authorisedEnvelope(period, authorisedCubicMetersPerDay);
  if (!envelope) return '—';
  return `${ratioFormat.format(envelope.usedRatio * 100)} % de ${volumeFormat.format(envelope.allowedCubicMeters)} m³`;
}
