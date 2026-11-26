'use client';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { sortByNameNaturally } from '@/lib/domain/bed-order';
import { hydraulicMessage } from '@/lib/domain/hydraulic-message';
import type { EquipmentGardenGroup } from '@/lib/domain/equipment-by-garden';
import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import { durationSecondsForTarget } from '@/lib/domain/irrigation-timer';
import { millimetersText } from '@/lib/domain/display-numbers';
import { MINUTES_PER_HOUR } from '@/lib/domain/units';
import type { PumpDashboard } from '@/lib/services/pump-dashboard';
import {
  chosenChip,
  durationChips,
  durationMinutesOf,
  durationText,
  END_CLOCK_REFRESH_MILLISECONDS,
  hoursAndMinutes,
  MORE_OPTIONS_LABEL,
  moreOptionsOpenAtFirst,
  precautionLevel,
  preselectedEquipmentId,
  resultSentence,
  type ResultSentence,
  UNKNOWN_VOLUME_TEXT,
  startButton,
  stepAvailable,
  stepDuration,
  whereListKind,
  whereRowDetail,
} from '@/lib/domain/watering-now';
import { FigureOrigin } from '../shell/figure-origin';
import type { IrrigationPreviewResult } from './creation-panel';
import { NoteField, PumpFields } from './creation-panel';
import { HydraulicIndicator } from './irrigation-form';
import { decimalFormatter, formatRate, numericInput, pumpOriginLabel } from './presentation';
import type { CreationForm } from './use-creation-form';

/**
 * « Arroser maintenant » en trois champs (simplification S5, PR 1,
 * docs/simplification-s5-contract.md, section 3) : « 1. Où ? », « 2. Combien
 * de temps ? », puis le bouton qui dit ce qu'il fait ; la pompe, la note, la
 * saisie en mm et la durée exacte derrière « Plus d'options ». Les valeurs
 * sont celles du formulaire d'avant, écrites par les mêmes champs : aucun
 * calcul ni aucune écriture ne change. Les règles d'écran vivent dans
 * `lib/domain/watering-now.ts`.
 */
export function WateringNowForm({
  form, preview, gardens, pumpDashboard, pumpsEnabled, dose, now, pending, reply, onChooseEquipment, onSubmit,
}: {
  form: CreationForm;
  preview: IrrigationPreviewResult;
  gardens: EquipmentGardenGroup<EquipmentListItem>[];
  pumpDashboard: PumpDashboard;
  pumpsEnabled: boolean;
  dose: number | null;
  now: Date;
  pending: boolean;
  reply: ReactNode;
  onChooseEquipment: (equipmentId: string) => void;
  onSubmit: () => void;
}) {
  const { usableEquipment, reachedBeds, selectedEquipment, selectedSetting, selectedPump, selectedPumpOrigin } = preview;
  const durationSeconds = preview.previewDurationSeconds;
  const currentMinutes = durationMinutesOf(durationSeconds);
  const advisedSeconds = dose === null || preview.referenceRateMmPerHour === null ? null : durationSecondsForTarget(dose, preview.referenceRateMmPerHour);
  const chips = selectedEquipment ? durationChips(advisedSeconds) : durationChips(null);
  const chosen = chosenChip({ mode: form.preparationMode, targetMillimeters: form.targetMillimeters, durationMinutes: numericInput(form.durationHours) * MINUTES_PER_HOUR + numericInput(form.durationMinutes) }, dose);
  const clock = useMinuteClock(now);
  const button = startButton({
    equipmentName: selectedEquipment?.name ?? null,
    durationSeconds,
    reachedBeds: preview.previewApplications.length,
    now: clock,
  });
  const sentence = selectedEquipment && durationSeconds !== null && durationSeconds > 0
    ? resultSentence({
      amountsMm: preview.previewApplications.map((application) => application.amountMm),
      volumeLiters: preview.previewVolumeLiters,
      originName: selectedPumpOrigin ? pumpOriginLabel(selectedPumpOrigin, pumpDashboard) : null,
      pumpName: pumpsEnabled ? selectedPump?.name ?? null : null,
    })
    : null;
  const hydraulicTone = pumpsEnabled && selectedEquipment ? hydraulicMessage(preview.hydraulicPreview, false).tone : null;
  const hydraulicFirst = hydraulicTone !== null && precautionLevel({ kind: 'hydraulic', tone: hydraulicTone }) === 'first-level';
  const defaultPumpId = selectedEquipment ? pumpDashboard.equipmentDefaults.find((item) => item.equipmentId === selectedEquipment.id)?.pumpId ?? '' : '';
  const autoOpen = moreOptionsOpenAtFirst({ pumpChosen: form.pumpId !== '', pumpIsDefault: form.pumpId === defaultPumpId, note: form.note, millimetersEntry: form.millimetersEntry });
  const [moreChoice, setMoreChoice] = useState<boolean | null>(null);
  const moreOpen = moreChoice ?? autoOpen;
  const moreId = useId();

  /** Une durée réglée au « + », au « − » ou par une pastille fixe : le mode « Durée d'irrigation », en minutes entières. */
  const setMinutes = (minutes: number) => {
    const { hours, minutes: rest } = hoursAndMinutes(minutes);
    form.setPreparationMode('duration');
    form.setMillimetersEntry(false);
    form.setDurationHours(String(hours));
    form.setDurationMinutes(String(rest));
  };
  const step = (direction: 1 | -1) => {
    const next = stepDuration(currentMinutes, direction);
    if (next !== null) setMinutes(next);
  };
  const exact = form.preparationMode === 'duration' ? { hours: form.durationHours, minutes: form.durationMinutes }
    : currentMinutes === null ? { hours: '', minutes: '' }
      : { hours: String(hoursAndMinutes(currentMinutes).hours), minutes: String(hoursAndMinutes(currentMinutes).minutes) };

  return (
    <div className="watering-now">
      <section className="watering-block" aria-labelledby={`${moreId}-ou`} data-tour="arrosage-champs">
        <h3 id={`${moreId}-ou`}>1. Où ?</h3>
        {whereListKind(usableEquipment.length) === 'radios' ? gardens.map((garden) => (
          <fieldset key={garden.label} className="watering-where">
            <legend>{garden.label}</legend>
            {garden.items.map((item) => (
              <label key={item.id} className="watering-where-row" data-chosen={item.id === selectedEquipment?.id}>
                {/* Le nom lu est celui du matériel ; son type et ses planches en sont la description. */}
                <input type="radio" name={`${moreId}-materiel`} value={item.id} checked={item.id === selectedEquipment?.id} onChange={() => onChooseEquipment(item.id)} aria-labelledby={`${moreId}-${item.id}-nom`} aria-describedby={`${moreId}-${item.id}-detail`} />
                <span><strong id={`${moreId}-${item.id}-nom`}>{item.name}</strong><small id={`${moreId}-${item.id}-detail`}>{whereRowDetail(item.kind, reachedBeds.get(item.id) ?? 0)}</small></span>
              </label>
            ))}
          </fieldset>
        )) : (
          <label className="watering-where-select">
            <span>Où arroser ?</span>
            <select value={selectedEquipment?.id ?? ''} onChange={(event) => onChooseEquipment(event.target.value)}>
              <option value="" disabled>Choisissez un matériel</option>
              {gardens.map((garden) => (
                <optgroup key={garden.label} label={garden.label}>
                  {garden.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {whereRowDetail(item.kind, reachedBeds.get(item.id) ?? 0)}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        )}
        {preselectedEquipmentId(usableEquipment) !== null ? <p className="watering-note">Le seul matériel prêt à arroser est choisi.</p> : null}
        {selectedEquipment && selectedEquipment.settings.length > 1 ? (
          <label className="watering-setting">
            <span>Réglage</span>
            <select value={selectedSetting?.id ?? ''} onChange={(event) => { form.setSettingId(event.target.value); form.setReferenceBedId(''); }}>
              {selectedEquipment.settings.map((setting) => <option key={setting.id} value={setting.id}>{setting.name}</option>)}
            </select>
          </label>
        ) : null}
      </section>

      <section className="watering-block" aria-labelledby={`${moreId}-combien`} data-tour="arrosage-resultat">
        <h3 id={`${moreId}-combien`}>2. Combien de temps ?</h3>
        {form.millimetersEntry ? (
          <div className="watering-amount">
            <label>
              <span>Quantité souhaitée</span>
              <span className="input-with-unit">
                <input type="number" min="0.01" step="0.1" inputMode="decimal" value={form.targetMillimeters} onChange={(event) => { form.setPreparationMode('amount'); form.setTargetMillimeters(event.target.value); }} />
                <b>mm</b>
              </span>
            </label>
            <p className="watering-duration-result">soit <strong>{durationText(durationSeconds)}</strong><FigureOrigin text={preview.previewOrigin} /></p>
          </div>
        ) : (<>
          <div className="watering-stepper">
            <button type="button" aria-label="Cinq minutes de moins" disabled={!stepAvailable(currentMinutes, -1)} onClick={() => step(-1)}>−</button>
            <p className="watering-duration" aria-live="polite"><strong>{durationText(durationSeconds)}</strong><FigureOrigin text={preview.previewOrigin} /></p>
            <button type="button" aria-label="Cinq minutes de plus" disabled={!stepAvailable(currentMinutes, 1)} onClick={() => step(1)}>+</button>
          </div>
          <div className="watering-chips" role="group" aria-label="Durées proposées">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                aria-pressed={chosen === chip.id}
                onClick={() => {
                  if (chip.minutes !== null) { setMinutes(chip.minutes); return; }
                  form.setPreparationMode('amount');
                  form.setMillimetersEntry(false);
                  form.setTargetMillimeters(dose === null ? '' : String(dose));
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </>)}
        {sentence && (sentence.amount !== null || sentence.unknownBeds !== null) ? <ResultLine sentence={sentence} /> : null}
        {sentence?.pump ? <p className="watering-result">{sentence.pump}</p> : null}
        {preview.protectedSlotWarning ? <p className="irrigation-preview-warning" role="status">{preview.protectedSlotWarning}</p> : null}
        {hydraulicFirst ? <HydraulicIndicator feasibility={preview.hydraulicPreview} historical={false} /> : null}
        {sentence && preview.previewApplications.length > 0 ? (
          <details className="application-preview-details">
            <summary>Voir planche par planche</summary>
            <p className="watering-detail-line">
              {selectedEquipment?.kind === 'drip'
                ? `Intensité : ${formatRate(preview.previewApplications[0]?.rateMmPerHour ?? 0)}`
                : `Étendue : ${preview.previewApplications.length} planche${preview.previewApplications.length > 1 ? 's' : ''}`}
            </p>
            <div className="application-table-wrap">
              <table>
                <caption>Apport estimé par planche</caption>
                <thead><tr><th>Planche</th><th>mm/h</th><th>Apport</th></tr></thead>
                <tbody>
                  {preview.previewApplications.map((application) => (
                    <tr key={application.bed.id}>
                      <td>{application.bed.name}</td>
                      <td>{decimalFormatter.format(application.rateMmPerHour)}</td>
                      <td>{application.amountMm === null ? 'inconnu' : millimetersText(application.amountMm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </section>

      <div className="watering-more">
        <button type="button" className="watering-more-toggle" aria-expanded={moreOpen} aria-controls={`${moreId}-options`} onClick={() => setMoreChoice(!moreOpen)}>
          {MORE_OPTIONS_LABEL}
        </button>
        <div id={`${moreId}-options`} className="watering-more-options irrigation-form-fields" hidden={!moreOpen}>
          <label className="watering-switch">
            <input type="checkbox" checked={form.millimetersEntry} onChange={(event) => { form.setMillimetersEntry(event.target.checked); if (event.target.checked) form.setPreparationMode('amount'); }} />
            <span>Saisir en mm</span>
          </label>
          {form.millimetersEntry && selectedEquipment?.kind === 'sprinkler' ? (
            <label>
              <span>Planche de référence</span>
              <select value={preview.effectiveReferenceBedId} onChange={(event) => form.setReferenceBedId(event.target.value)}>
                {sortByNameNaturally(preview.preview?.applications ?? [], (application) => application.bed.name, (application) => application.bed.id).map((application) => (
                  <option key={application.bed.id} value={application.bed.id}>{application.bed.name} · {formatRate(application.rateMmPerHour)}</option>
                ))}
              </select>
              <small>La durée est calculée pour atteindre l’objectif sur cette planche.</small>
            </label>
          ) : null}
          <fieldset className="watering-exact">
            <legend>Durée exacte</legend>
            <label><span>Heures</span><input type="number" min="0" max="744" step="1" inputMode="numeric" value={exact.hours} onChange={(event) => { form.setPreparationMode('duration'); form.setMillimetersEntry(false); form.setDurationHours(event.target.value); form.setDurationMinutes(exact.minutes || '0'); }} /></label>
            <label><span>Minutes</span><input type="number" min="0" max="59" step="1" inputMode="numeric" value={exact.minutes} onChange={(event) => { form.setPreparationMode('duration'); form.setMillimetersEntry(false); form.setDurationMinutes(event.target.value); form.setDurationHours(exact.hours || '0'); }} /></label>
          </fieldset>
          {pumpsEnabled ? (<>
            <PumpFields form={form} preview={preview} pumpDashboard={pumpDashboard} />
            {selectedEquipment && !hydraulicFirst ? <HydraulicIndicator feasibility={preview.hydraulicPreview} historical={false} /> : null}
          </>) : null}
          <NoteField form={form} />
        </div>
      </div>

      <div className="watering-start">
        <button type="button" className="start-irrigation-button" aria-label={pending ? undefined : button.accessibleName} disabled={pending || button.disabled} onClick={onSubmit}>
          {pending ? 'Enregistrement…' : button.label}
        </button>
        {button.missing && !pending ? <p className="watering-missing">{button.missing}</p> : null}
        {reply}
        <small>Le minuteur retrouvera son état après une actualisation de la page.</small>
      </div>
    </div>
  );
}

/** « Soit 8 mm sur les 3 planches, et 470 L pris à « Bassin ». » : les chiffres en gras, estimés (section 3.3). */
function ResultLine({ sentence }: { sentence: ResultSentence }) {
  return (
    <p className="watering-result">
      Soit {sentence.amount === null ? null : <><strong>{sentence.amount}</strong> {sentence.scope}</>}
      {sentence.unknownBeds ? `${sentence.amount === null ? '' : ', '}${sentence.unknownBeds}` : null}
      {sentence.amount === null ? null : sentence.liters === null ? `, ${UNKNOWN_VOLUME_TEXT}` : <>, et <strong>{sentence.liters}</strong>{sentence.origin ? ` ${sentence.origin}` : ''}</>}.
    </p>
  );
}

/**
 * L'heure du bouton, relue chaque minute (S5-j) : la page ne la relit
 * d'elle-même que pendant un arrosage, et « fin vers » doit suivre l'horloge.
 * Le premier rendu prend l'heure de la page, la même côté serveur et client.
 */
function useMinuteClock(pageNow: Date): Date {
  const [tick, setTick] = useState(() => pageNow.getTime());
  useEffect(() => {
    const update = () => setTick(Date.now());
    const first = window.setTimeout(update, 0);
    const every = window.setInterval(update, END_CLOCK_REFRESH_MILLISECONDS);
    return () => { window.clearTimeout(first); window.clearInterval(every); };
  }, []);
  return new Date(Math.max(tick, pageNow.getTime()));
}
