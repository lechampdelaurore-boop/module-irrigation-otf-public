'use client';

import { useState } from 'react';
import {
  parseDecimal,
  parseShare,
  shareLabel,
  type PlaceSoil,
  type SoilRecordView,
  type SoilSettingsView,
  type ZoneSoilSetting,
} from '@/lib/domain/soil-reserve/settings-view';
import {
  FARM_THRESHOLD,
  labRfuWarning,
  SOIL_DEFAULTS,
  soilRfuMmPerMeter,
  type SoilRecord,
  type SoilSettings,
} from '@/lib/domain/soil-reserve/soil';
import { saveSoilRecordAction, saveSoilSettingsAction, type SoilReserveActionResult } from '../soil-reserve-actions';

/**
 * Les réglages de la réserve du sol (docs/soil-reserve-contract.md,
 * « L'écran », 5 ter, PR 3a) : par parcelle, la RFU du laboratoire, les
 * cailloux et la RFU du sol calculée, la part de référence, TEW, REW, Ze,
 * le plafond de sol, la provenance et la source ; par jardin ou abri, sa
 * valeur propre ; pour l'exploitation, le seuil d'arrosage (D-059), les
 * coefficients des états de surface et la part de pluie sous paillage
 * plastique. Chaque enregistrement est une révision datée.
 */

type Run = (operation: () => Promise<SoilReserveActionResult>) => void;

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const PERCENT = 100;
const PROVENANCES: { value: SoilRecord['provenance']; label: string }[] = [
  { value: 'analysis', label: 'analyse' },
  { value: 'estimate', label: 'estimation' },
  { value: 'default', label: 'par défaut' },
];

export function SoilSettingsPart({ season, view, pending, run }: { season: number; view: SoilSettingsView; pending: boolean; run: Run }) {
  return (
    <details className="soil-settings" suppressHydrationWarning>
      <summary>
        <strong>Réglages du sol</strong>
        <small>{summaryLabel(view)}</small>
      </summary>
      <p className="reference-crop-meta">
        La RFU se saisit par parcelle, en mm par mètre de sol ; un jardin ou un abri peut porter sa valeur propre, qui prime sur celle de
        sa parcelle. Chaque enregistrement vaut à partir de son jour ; l’histoire reste lisible.
      </p>
      {view.zones.length === 0 ? <p className="crop-coefficients-empty">Aucune parcelle cette saison.</p> : null}
      {view.zones.map((zone) => <ZoneSoil key={zone.zoneId} season={season} zone={zone} today={view.today} pending={pending} run={run} />)}
      <FarmSettingsForm key={JSON.stringify(view.farm.current)} season={season} view={view} pending={pending} run={run} />
    </details>
  );
}

function summaryLabel(view: SoilSettingsView): string {
  const entered = view.zones.filter((zone) => zone.soil.current !== null).length;
  return `${entered} parcelle${entered > 1 ? 's' : ''} sur ${view.zones.length} renseignée${entered > 1 ? 's' : ''} · seuil ${
    view.farm.current.threshold.mode === 'farm' ? `réglé à ${view.farm.current.threshold.percent} % du plein` : 'selon la culture'
  }`;
}

function ZoneSoil({ season, zone, today, pending, run }: { season: number; zone: ZoneSoilSetting; today: string; pending: boolean; run: Run }) {
  const zoneRecord = zone.soil.current?.record ?? null;
  return (
    <section className="crop-water-settings-block soil-place" aria-label={`Sol · ${zone.name}`}>
      <h4>Parcelle {zone.name}</h4>
      <CurrentSoil soil={zone.soil} empty="Aucune RFU saisie : la jauge de ses planches reste inconnue." />
      <SoilRecordForm
        key={`${zone.zoneId}|${zone.soil.history.length}`}
        title="Enregistrer le sol de la parcelle"
        initial={zoneRecord}
        place={{ zoneId: zone.zoneId, plotId: null }}
        season={season}
        today={today}
        pending={pending}
        run={run}
        folded
      />
      {zone.plots.length > 0 ? (
        <ul className="crop-water-settings-list" aria-label={`Jardins et abris · ${zone.name}`}>
          {zone.plots.map((plot) => (
            <li key={plot.plotId}>
              <strong>{plot.name}{plot.sheltered ? ' · abri' : ''}</strong>
              {plot.soil.current ? (
                <CurrentSoil soil={plot.soil} empty="" />
              ) : (
                <small>{zoneRecord ? 'Valeur de la parcelle.' : 'Rien de saisi pour sa parcelle.'}</small>
              )}
              <SoilRecordForm
                key={`${plot.plotId}|${plot.soil.history.length}|${zone.soil.history.length}`}
                title="Saisir une valeur propre"
                initial={plot.soil.current?.record ?? zoneRecord}
                place={{ zoneId: zone.zoneId, plotId: plot.plotId }}
                season={season}
                today={today}
                pending={pending}
                run={run}
                folded
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CurrentSoil({ soil, empty }: { soil: PlaceSoil; empty: string }) {
  const current = soil.current;
  if (!current) return empty ? <p className="crop-coefficients-empty">{empty}</p> : null;
  const older = soil.history.filter((view) => view.record !== current.record);
  return (
    <div className="soil-current">
      <p>
        <strong>RFU du sol : {current.soilRfuMmPerMeter} mm/m</strong> · {recordLine(current)}
      </p>
      {current.record.stoneSharePercent === null ? <p className="soil-mention">Part de cailloux non renseignée : comptée pour 0.</p> : null}
      {current.warning ? <p className="soil-warning" role="alert">{current.warning}</p> : null}
      <small>
        L’analyse ne décrit que l’horizon prélevé{current.record.sampledDepthCm ? ` (0-${number.format(current.record.sampledDepthCm)} cm)` : ''} ;
        le calcul suppose la même texture en dessous. Une semelle de labour ou un sous-sol différent change la profondeur réellement
        explorée : à vérifier à la bêche ou à la tarière.
      </small>
      {older.length > 0 ? (
        <small>Avant : {older.map((view) => `${view.soilRfuMmPerMeter} mm/m à partir du ${day(view.record.effectiveFrom)}`).join(' ; ')}</small>
      ) : null}
    </div>
  );
}

function recordLine(view: SoilRecordView): string {
  const record = view.record;
  return [
    `laboratoire ${number.format(record.labRfuMmPerMeter)} mm/m`,
    record.stoneSharePercent === null ? 'cailloux non renseignés' : `cailloux ${number.format(record.stoneSharePercent)} %`,
    `part de référence ${shareLabel(record.referenceShare)}`,
    `TEW ${number.format(record.tewMm)} mm, REW ${number.format(record.rewMm)} mm, Ze ${number.format(record.surfaceLayerCm)} cm`,
    record.soilDepthCeilingM === null ? null : `sol limité à ${number.format(record.soilDepthCeilingM)} m`,
    PROVENANCES.find((item) => item.value === record.provenance)?.label ?? record.provenance,
    record.source || null,
    `depuis le ${day(record.effectiveFrom)}`,
  ].filter((part): part is string => part !== null).join(' · ');
}

type Fields = {
  lab: string;
  stones: string;
  share: string;
  provenance: SoilRecord['provenance'];
  sampled: string;
  source: string;
  tew: string;
  rew: string;
  ze: string;
  ceiling: string;
  effectiveFrom: string;
};

function fieldsOf(record: SoilRecord | null, today: string): Fields {
  const text = (value: number | null | undefined) => (value === null || value === undefined ? '' : number.format(value));
  return {
    lab: text(record?.labRfuMmPerMeter),
    stones: text(record?.stoneSharePercent),
    share: shareLabel(record?.referenceShare ?? SOIL_DEFAULTS.referenceShare),
    provenance: record?.provenance ?? 'analysis',
    sampled: text(record?.sampledDepthCm),
    source: record?.source ?? '',
    tew: text(record?.tewMm ?? SOIL_DEFAULTS.tewMm),
    rew: text(record?.rewMm ?? SOIL_DEFAULTS.rewMm),
    ze: text(record?.surfaceLayerCm ?? SOIL_DEFAULTS.surfaceLayerCm),
    ceiling: text(record?.soilDepthCeilingM),
    effectiveFrom: today,
  };
}

function SoilRecordForm({ title, initial, place, season, today, pending, run, folded = false }: {
  title: string;
  initial: SoilRecord | null;
  place: { zoneId: string; plotId: string | null };
  season: number;
  today: string;
  pending: boolean;
  run: Run;
  folded?: boolean;
}) {
  const [fields, setFields] = useState<Fields>(() => fieldsOf(initial, today));
  const set = (key: keyof Fields) => (event: { target: { value: string } }) => setFields((current) => ({ ...current, [key]: event.target.value }));
  const lab = parseDecimal(fields.lab);
  const stones = fields.stones.trim() === '' ? null : parseDecimal(fields.stones);
  const optional = (text: string) => (text.trim() === '' ? null : parseDecimal(text));
  const values = {
    share: parseShare(fields.share),
    tew: parseDecimal(fields.tew),
    rew: parseDecimal(fields.rew),
    ze: parseDecimal(fields.ze),
  };
  const readable = lab !== null && (fields.stones.trim() === '' || stones !== null) && values.share !== null && values.tew !== null
    && values.rew !== null && values.ze !== null && (fields.sampled.trim() === '' || optional(fields.sampled) !== null)
    && (fields.ceiling.trim() === '' || optional(fields.ceiling) !== null) && fields.effectiveFrom !== '';
  const warning = lab === null ? null : labRfuWarning(lab);
  const submit = () => {
    const { share, tew, rew, ze } = values;
    if (!readable || lab === null || share === null || tew === null || rew === null || ze === null) return;
    const record: Omit<SoilRecord, 'recordedAt'> = {
      zoneId: place.zoneId,
      plotId: place.plotId,
      labRfuMmPerMeter: lab,
      stoneSharePercent: stones,
      referenceShare: share,
      provenance: fields.provenance,
      sampledDepthCm: optional(fields.sampled),
      source: fields.source.trim(),
      tewMm: tew,
      rewMm: rew,
      surfaceLayerCm: ze,
      soilDepthCeilingM: optional(fields.ceiling),
      effectiveFrom: fields.effectiveFrom,
    };
    run(() => saveSoilRecordAction({ season, record }));
  };
  const form = (
    <div className="crop-water-inline-form soil-record-form" role="group" aria-label={title}>
      <label><span>RFU du laboratoire (mm/m)</span><input type="text" inputMode="decimal" placeholder="par exemple 62" value={fields.lab} onChange={set('lab')} /></label>
      <label><span>Part de cailloux (%)</span><input type="text" inputMode="decimal" placeholder="facultatif" value={fields.stones} onChange={set('stones')} /></label>
      <p className="soil-computed" aria-live="polite">
        RFU du sol : {lab === null ? '—' : `${soilRfuMmPerMeter(lab, stones)} mm/m`}
      </p>
      <label><span>Part de référence</span><input type="text" inputMode="decimal" value={fields.share} onChange={set('share')} /></label>
      <label>
        <span>Provenance</span>
        <select value={fields.provenance} onChange={(event) => setFields((current) => ({ ...current, provenance: event.target.value as SoilRecord['provenance'] }))}>
          {PROVENANCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label><span>Profondeur prélevée (cm)</span><input type="text" inputMode="decimal" placeholder="facultatif" value={fields.sampled} onChange={set('sampled')} /></label>
      <label className="soil-source"><span>Source (laboratoire, référence, date, remarque)</span><input type="text" value={fields.source} onChange={set('source')} /></label>
      <label><span>Eau évaporable TEW (mm)</span><input type="text" inputMode="decimal" value={fields.tew} onChange={set('tew')} /></label>
      <label><span>Eau facilement évaporable REW (mm)</span><input type="text" inputMode="decimal" value={fields.rew} onChange={set('rew')} /></label>
      <label><span>Couche de surface Ze (cm)</span><input type="text" inputMode="decimal" value={fields.ze} onChange={set('ze')} /></label>
      <label><span>Profondeur de sol (m)</span><input type="text" inputMode="decimal" placeholder="facultatif : obstacle, semelle" value={fields.ceiling} onChange={set('ceiling')} /></label>
      <label><span>À partir du</span><input type="date" value={fields.effectiveFrom} onChange={set('effectiveFrom')} /></label>
      {warning ? <p className="soil-warning" role="alert">{warning}</p> : null}
      <button type="button" disabled={pending || !readable} onClick={submit}>{title}</button>
    </div>
  );
  if (!folded) return form;
  return (
    <details className="soil-record-fold" suppressHydrationWarning>
      <summary>{title}</summary>
      {form}
    </details>
  );
}

function FarmSettingsForm({ season, view, pending, run }: { season: number; view: SoilSettingsView; pending: boolean; run: Run }) {
  const current = view.farm.current;
  const [mode, setMode] = useState(current.threshold.mode);
  const [thresholdPercent, setThresholdPercent] = useState(current.threshold.mode === 'farm' ? current.threshold.percent : FARM_THRESHOLD.proposedPercent);
  const [fields, setFields] = useState(() => ({
    permeable: number.format(current.surface.permeableTarpEvaporation * PERCENT),
    mulched: number.format(current.surface.mulchedEvaporation * PERCENT),
    emergence: number.format(current.surface.greenManureEmergenceKc),
    partial: number.format(current.surface.greenManurePartialKc),
    full: number.format(current.surface.greenManureFullKc),
    grass: number.format(current.surface.grassKc),
    rain: number.format(current.plasticMulchRainShare * PERCENT),
    effectiveFrom: view.today,
  }));
  const set = (key: keyof typeof fields) => (event: { target: { value: string } }) => setFields((value) => ({ ...value, [key]: event.target.value }));
  const parsed = {
    permeable: parseDecimal(fields.permeable),
    mulched: parseDecimal(fields.mulched),
    emergence: parseDecimal(fields.emergence),
    partial: parseDecimal(fields.partial),
    full: parseDecimal(fields.full),
    grass: parseDecimal(fields.grass),
    rain: parseDecimal(fields.rain),
  };
  const readable = Object.values(parsed).every((value) => value !== null) && fields.effectiveFrom !== '';
  const percents: number[] = [];
  for (let value = FARM_THRESHOLD.minimumPercent; value <= FARM_THRESHOLD.maximumPercent; value += FARM_THRESHOLD.stepPercent) percents.push(value);
  const submit = () => {
    if (!readable) return;
    const settings: SoilSettings = {
      threshold: mode === 'farm' ? { mode: 'farm', percent: thresholdPercent } : { mode: 'crop' },
      surface: {
        permeableTarpEvaporation: (parsed.permeable ?? 0) / PERCENT,
        mulchedEvaporation: (parsed.mulched ?? 0) / PERCENT,
        greenManureEmergenceKc: parsed.emergence ?? 0,
        greenManurePartialKc: parsed.partial ?? 0,
        greenManureFullKc: parsed.full ?? 0,
        grassKc: parsed.grass ?? 0,
      },
      plasticMulchRainShare: (parsed.rain ?? 0) / PERCENT,
    };
    run(() => saveSoilSettingsAction({ season, revision: { ...settings, effectiveFrom: fields.effectiveFrom } }));
  };
  return (
    <section className="crop-water-settings-block soil-farm-settings" aria-label="Réglages de l’exploitation">
      <h4>Pour l’exploitation{view.farm.isDefault ? ' · valeurs de départ' : ''}</h4>
      <fieldset className="soil-threshold">
        <legend>Seuil d’arrosage</legend>
        <label className="crop-water-option">
          <input type="radio" name="soil-threshold" checked={mode === 'crop'} onChange={() => setMode('crop')} />
          <span>
            <strong>Selon la culture</strong>
            <small>Le seuil de chaque planche vient de la part p de sa culture : 55 % du plein pour une salade, 40 % pour une tomate.</small>
          </span>
        </label>
        <label className="crop-water-option">
          <input type="radio" name="soil-threshold" checked={mode === 'farm'} onChange={() => setMode('farm')} />
          <span>
            <strong>Réglé par l’exploitation</strong>
            <small>Un seul seuil, en % du plein, pour toutes les planches cultivées ; le seuil de la culture reste rappelé à côté.</small>
          </span>
        </label>
        {mode === 'farm' ? (
          <label className="soil-threshold-percent">
            <span>Conseiller d’arroser sous</span>
            <select value={thresholdPercent} onChange={(event) => setThresholdPercent(Number(event.target.value))}>
              {percents.map((value) => <option key={value} value={value}>{value} % du plein</option>)}
            </select>
          </label>
        ) : null}
      </fieldset>
      <div className="crop-water-inline-form" role="group" aria-label="Coefficients des états de surface">
        <label><span>Évaporation sous bâche perméable (%)</span><input type="text" inputMode="decimal" value={fields.permeable} onChange={set('permeable')} /></label>
        <label><span>Évaporation sous paillage (%)</span><input type="text" inputMode="decimal" value={fields.mulched} onChange={set('mulched')} /></label>
        <label><span>Kc engrais vert, levée</span><input type="text" inputMode="decimal" value={fields.emergence} onChange={set('emergence')} /></label>
        <label><span>Kc engrais vert, couverture partielle</span><input type="text" inputMode="decimal" value={fields.partial} onChange={set('partial')} /></label>
        <label><span>Kc engrais vert, couverture totale</span><input type="text" inputMode="decimal" value={fields.full} onChange={set('full')} /></label>
        <label><span>Kc planche enherbée</span><input type="text" inputMode="decimal" value={fields.grass} onChange={set('grass')} /></label>
        <label><span>Pluie comptée sous paillage plastique (%)</span><input type="text" inputMode="decimal" value={fields.rain} onChange={set('rain')} /></label>
        <label><span>À partir du</span><input type="date" value={fields.effectiveFrom} onChange={set('effectiveFrom')} /></label>
        <button type="button" disabled={pending || !readable} onClick={submit}>Enregistrer les réglages</button>
      </div>
      {view.farm.history.length > 0 ? (
        <small>
          Enregistrés : {view.farm.history.map((revision) => `${revision.threshold.mode === 'farm' ? `seuil ${revision.threshold.percent} %` : 'seuil selon la culture'} à partir du ${day(revision.effectiveFrom)}`).join(' ; ')}
        </small>
      ) : null}
    </section>
  );
}

function day(value: string): string {
  return dayFormat.format(new Date(`${value}T12:00:00Z`));
}
