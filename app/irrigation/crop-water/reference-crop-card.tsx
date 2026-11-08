'use client';

import type { StoredReferenceCrop } from '@/db/crop-water/references';
import { farmDurationsOf, type FarmDurations } from '@/lib/domain/crop-water/farm-durations';
import { FAO_PHASES, type KcCurve, type ReferenceCrop } from '@/lib/domain/crop-water/reference';
import { kcSourceLabel, monthsLabel, stageAnchorLabel } from '@/lib/domain/crop-water/presentation';
import type { KcOverrideRow } from '@/lib/domain/crop-water/settings-view';
import { referenceCropSymbol } from '@/lib/domain/crop-water/plant-vignettes';
import { referenceCropSummaryText, type ReferenceCropSummary } from '@/lib/domain/crop-water/crop-summary';
import { DetailHint } from './detail-hint';
import { ExpertsFold } from './experts-fold';
import { FarmDurationsForm } from './farm-durations';
import { KcOverrides, type KcOverrideSubmit } from './kc-overrides';
import { PlantVignette } from './plant-vignette';
import { RootingProfileSection, type RootingProfileSubmit } from './rooting-profile';
import type { RootingProfileView } from '@/lib/domain/soil-reserve/rooting-view';

/**
 * Une culture de référence, telle que la ferme la lit (5 quater, PR 3) : sa
 * source, ses Kc stade par stade, les débuts de stade par saison, ses délais
 * de levée et d'où viennent ses valeurs. Une culture inutilisable dit
 * pourquoi ; le calcul ne s'en sert pas. Depuis la PR 3e : les durées propres
 * à la ferme d'une culture du jeu commun. Depuis la 5 ter (PR 3c) : son profil
 * racinaire, la profondeur par stade et la part p.
 */

const kcFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const calendarDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const surveyDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
/** Une année sans 29 février, pour écrire un jour `MM-JJ` de calendrier. */
const COMMON_YEAR = 2025;

export function ReferenceCropCard({ stored, common, spriteHref, overrideRows, rooting, summary, today, pending, onOverride, onSaveDurations, onResetDurations, onSaveRooting }: {
  stored: StoredReferenceCrop;
  /** L'adresse des dessins d'Ouvre ta ferme de la page (précision P41) ; `null` sans dessin. */
  spriteHref: string | null;
  /** La culture du jeu commun quand la ferme a sa version ; `null` sinon. */
  common: ReferenceCrop | null;
  overrideRows: readonly KcOverrideRow[];
  rooting: RootingProfileView;
  /** Le résumé lu à droite du nom, sous le nom au téléphone (choix du porteur du 8 novembre 2026). */
  summary: ReferenceCropSummary;
  today: string;
  pending: boolean;
  onOverride: (input: KcOverrideSubmit) => void;
  onSaveDurations: (durations: FarmDurations) => void;
  onResetDurations: () => void;
  onSaveRooting: (input: RootingProfileSubmit) => void;
}) {
  const { crop } = stored;
  const unusable = stored.problems.length > 0;
  const overridden = overrideRows.filter((row) => row.inForce !== null && row.inForce.kc !== null).length;
  const farmMarks = [
    ...(stored.origin === 'farm' ? ['durées de la ferme'] : []),
    ...(unusable ? ['inutilisable'] : []),
    ...(overridden > 0 ? [`${overridden} Kc surchargé${overridden > 1 ? 's' : ''}`] : []),
    ...(rooting.inForce?.origin === 'farm' ? ['profil racinaire de la ferme'] : []),
  ];
  return (
    <details className="reference-crop-card" data-unusable={unusable} suppressHydrationWarning>
      <summary>
        <strong><PlantVignette spriteHref={spriteHref} symbol={referenceCropSymbol(crop)} />{crop.name}</strong>
        {/* La source et la forme de la courbe passent dans « Pour les experts » ; restent les réglages de la ferme (point 8). */}
        {farmMarks.length > 0 ? <small>{farmMarks.join(' · ')}</small> : null}
        {unusable ? null : <span className="reference-crop-summary">{referenceCropSummaryText(summary)}</span>}
        <DetailHint />
      </summary>
      {unusable ? (
        <ul className="reference-crop-problems" role="alert">
          {stored.problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      ) : null}
      <ExpertsFold>
        <p className="reference-crop-meta">
          {kcSourceLabel(crop.source)} · {curveLabel(crop.curve)} · {stored.origin === 'farm' ? 'durées de la ferme' : 'jeu commun'}
        </p>
        {crop.source === 'fao56' ? (
          <p className="reference-crop-note">
            Valeurs de la FAO-56, en général plus hautes que les références régionales du CRIIAM.
          </p>
        ) : null}
        <p className="reference-crop-meta">
          {stored.sourceUrl ? <>Source : <a href={stored.sourceUrl} target="_blank" rel="noreferrer">{stored.sourceUrl}</a></> : 'Source : non renseignée'}
          {stored.surveyedOn ? ` · relevée le ${surveyDay.format(new Date(`${stored.surveyedOn}T12:00:00Z`))}` : ''}
          {stored.datesSource ? ` · dates par défaut : ${stored.datesSource}` : ''}
        </p>
      </ExpertsFold>
      <CurveDetails curve={crop.curve} />
      <p className="reference-crop-meta">
        Délai de levée : {crop.emergenceDelayDays['direct-sowing']} j en semis direct, {crop.emergenceDelayDays.planting} j en plantation.
      </p>
      {unusable ? null : (
        <KcOverrides cropName={crop.name} rows={overrideRows} today={today} pending={pending} onSubmit={onOverride} />
      )}
      {unusable || (stored.origin === 'farm' && common === null) ? null : (
        <FarmDurationsForm
          key={JSON.stringify(farmDurationsOf(crop))}
          crop={crop}
          common={common ?? crop}
          farmVersion={stored.origin === 'farm'}
          pending={pending}
          onSave={onSaveDurations}
          onReset={onResetDurations}
        />
      )}
      {unusable ? null : (
        <RootingProfileSection cropName={crop.name} view={rooting} today={today} pending={pending} onSubmit={onSaveRooting} />
      )}
    </details>
  );
}

function CurveDetails({ curve }: { curve: KcCurve }) {
  if (curve.shape === 'trapezoid') {
    return (
      <>
        <dl className="reference-crop-kc">
          <div><dt>Kc début</dt><dd>{kcFormat.format(curve.kcInitial)}</dd></div>
          <div><dt>Kc pleine saison</dt><dd>{kcFormat.format(curve.kcMid)}</dd></div>
          <div><dt>Kc fin</dt><dd>{kcFormat.format(curve.kcEnd)}</dd></div>
          <div><dt>Coefficient d’abattement</dt><dd>{kcFormat.format(curve.abatement)}</dd></div>
        </dl>
        <div className="reference-crop-table-wrap">
          <table className="reference-crop-table">
            <caption>Durée des phases, en jours, selon le mois d’implantation</caption>
            <thead><tr><th scope="col">Implantation</th>{FAO_PHASES.map((phase) => <th key={phase.rank} scope="col">{phase.label}</th>)}</tr></thead>
            <tbody>
              {curve.sets.map((set) => (
                <tr key={set.months.join('-')}>
                  <th scope="row">{monthsLabel(set.months)}</th>
                  <td data-label="Début">{set.value.initial} j</td>
                  <td data-label="Développement">{set.value.development} j</td>
                  <td data-label="Pleine saison">{set.value.mid} j</td>
                  <td data-label="Fin">{set.value.late} j</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  if (curve.shape === 'calendar') {
    return (
      <div className="reference-crop-table-wrap">
        <table className="reference-crop-table">
          <caption>Calendrier de chaque année, jusqu’au {monthDay(curve.end)} compris</caption>
          <thead><tr><th scope="col">Stade</th><th scope="col">Kc</th><th scope="col">Début</th></tr></thead>
          <tbody>
            {curve.establishment ? (
              <tr>
                <th scope="row">{curve.establishment.label}</th>
                <td data-label="Kc">{kcFormat.format(curve.establishment.kc)}</td>
                <td data-label="Début">dès la plantation, pendant {curve.establishment.months} mois</td>
              </tr>
            ) : null}
            {curve.stages.map((stage) => (
              <tr key={stage.rank}>
                <th scope="row">{stage.label}</th>
                <td data-label="Kc">{kcFormat.format(stage.kc)}</td>
                <td data-label="Début">{monthDay(stage.start)}{stage.estimated ? ' (estimé)' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="reference-crop-table-wrap">
      <table className="reference-crop-table">
        <caption>Kc de chaque stade et son début, selon le mois d’implantation</caption>
        <thead>
          <tr>
            <th scope="col">Stade</th>
            <th scope="col">Kc</th>
            {curve.sets.map((set) => <th key={set.months.join('-')} scope="col">Début ({monthsLabel(set.months)})</th>)}
          </tr>
        </thead>
        <tbody>
          {curve.stages.map((stage, index) => (
            <tr key={stage.rank}>
              <th scope="row">{stage.label}</th>
              <td data-label="Kc">{kcFormat.format(stage.kc)}</td>
              {curve.sets.map((set) => {
                const start = set.value[index];
                return (
                  <td key={set.months.join('-')} data-label={`Début (${monthsLabel(set.months)})`}>
                    {start ? `${stageAnchorLabel(start.anchor)}${start.estimated ? ' (estimé)' : ''}` : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function curveLabel(curve: KcCurve): string {
  if (curve.shape === 'trapezoid') return 'trapèze';
  if (curve.shape === 'calendar') return 'calendrier fixe';
  return 'escalier';
}

function monthDay(value: string): string {
  const date = new Date(`${COMMON_YEAR}-${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : calendarDay.format(date);
}
