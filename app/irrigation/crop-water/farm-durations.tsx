'use client';

import { useState } from 'react';
import { farmDurationsOf, type FarmDurations } from '@/lib/domain/crop-water/farm-durations';
import { monthsLabel } from '@/lib/domain/crop-water/presentation';
import { FAO_PHASES, type ReferenceCrop, type StageAnchor } from '@/lib/domain/crop-water/reference';

/**
 * Les durées propres à la ferme d'une culture de référence (5 quater, PR 3e) :
 * délais de levée, début de chaque stade en jours, durées des phases de la
 * FAO et coefficient d'abattement, jours du calendrier. Chaque champ dit la
 * valeur du jeu commun quand la ferme en a une autre. Les Kc ne se règlent
 * pas ici : ils ont leurs surcharges datées.
 */

type Field = { key: string; label: string; hint: string; value: string; common: string };

const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const DAYS_PATTERN = /^\d{1,4}$/;
const DECIMAL_PATTERN = /^\d+([.,]\d+)?$/;
const DAY_MONTH_PATTERN = /^(\d{1,2})\/(\d{1,2})$/;

export function FarmDurationsForm({ crop, common, farmVersion, pending, onSave, onReset }: {
  crop: ReferenceCrop;
  /** La culture du jeu commun ; la même que `crop` tant que la ferme n'a pas sa version. */
  common: ReferenceCrop;
  farmVersion: boolean;
  pending: boolean;
  onSave: (durations: FarmDurations) => void;
  onReset: () => void;
}) {
  const initial = fields(crop, common);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(initial.map((field) => [field.key, field.value])));
  const durations = parsedDurations(crop, values);
  const changed = initial.some((field) => values[field.key] !== field.value);
  return (
    <details className="farm-durations-wrap" suppressHydrationWarning>
      <summary>Régler les durées de la ferme</summary>
      <div className="farm-durations-form" role="group" aria-label={`Durées de la ferme · ${crop.name}`}>
        <p className="reference-crop-meta">
          {farmVersion
            ? 'La ferme a ses propres durées pour cette culture ; la valeur du jeu commun est rappelée sous chaque champ qui en diffère.'
            : 'Les durées du jeu commun comptent. Réglez-les sur ce que vous observez chez vous : le calcul les suit pour toute la saison.'}
        </p>
        {initial.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <input
              type="text"
              inputMode={field.key.startsWith('cal:') && field.key !== 'cal:establishment' ? 'text' : 'decimal'}
              value={values[field.key] ?? ''}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
            />
            <small>{field.hint}{farmVersion && values[field.key] !== field.common ? ` · jeu commun : ${field.common}` : ''}</small>
          </label>
        ))}
        <button type="button" disabled={pending || !changed || durations === null} onClick={() => durations && onSave(durations)}>
          Enregistrer les durées
        </button>
        {farmVersion ? (
          <button type="button" className="secondary" disabled={pending} onClick={onReset}>
            Revenir aux durées communes
          </button>
        ) : null}
      </div>
    </details>
  );
}

/** Les champs du formulaire, dans l'ordre de la carte, avec la valeur de la culture et celle du jeu commun. */
function fields(crop: ReferenceCrop, common: ReferenceCrop): Field[] {
  const current = farmDurationsOf(crop);
  const base = farmDurationsOf(common);
  const list: Field[] = [
    { key: 'emergence:sowing', label: 'Levée en semis direct, en jours', hint: 'Jours entre le semis et la levée', value: `${current.emergence.directSowing}`, common: `${base.emergence.directSowing}` },
    { key: 'emergence:planting', label: 'Levée en plantation, en jours', hint: 'Jours entre la plantation et la reprise', value: `${current.emergence.planting}`, common: `${base.emergence.planting}` },
  ];
  const curve = crop.curve;
  if (curve.shape === 'steps') {
    curve.sets.forEach((set, index) => {
      set.value.forEach((start, position) => {
        if (!('days' in start.anchor)) return;
        list.push({
          key: `step:${index}:${position}`,
          label: `${curve.stages[position]?.label ?? `Stade ${position + 1}`} · ${monthsLabel(set.months)}`,
          hint: anchorHint(start.anchor),
          value: `${current.stepDays?.[index]?.[position] ?? ''}`,
          common: `${base.stepDays?.[index]?.[position] ?? ''}`,
        });
      });
    });
  } else if (curve.shape === 'trapezoid') {
    const phaseKeys = ['initial', 'development', 'mid', 'late'] as const;
    curve.sets.forEach((set, index) => {
      phaseKeys.forEach((phase, position) => {
        list.push({
          key: `fao:${index}:${phase}`,
          label: `${FAO_PHASES[position].label} · ${monthsLabel(set.months)}`,
          hint: 'Durée de la phase, en jours',
          value: `${current.phaseLengths?.[index]?.[phase] ?? ''}`,
          common: `${base.phaseLengths?.[index]?.[phase] ?? ''}`,
        });
      });
    });
    list.push({
      key: 'abatement',
      label: 'Coefficient d’abattement',
      hint: 'Multiplie les Kc de la FAO, de 0 exclu à 1',
      value: decimal.format(current.abatement ?? 1),
      common: decimal.format(base.abatement ?? 1),
    });
  } else {
    curve.stages.forEach((stage, index) => {
      list.push({
        key: `cal:${index}`,
        label: `Début · ${stage.label}`,
        hint: 'Jour et mois, par exemple 15/03',
        value: dayMonth(current.calendar?.starts[index] ?? ''),
        common: dayMonth(base.calendar?.starts[index] ?? ''),
      });
    });
    list.push({ key: 'cal:end', label: 'Dernier jour du cycle', hint: 'Jour et mois, compris', value: dayMonth(current.calendar?.end ?? ''), common: dayMonth(base.calendar?.end ?? '') });
    if (current.calendar?.establishmentMonths != null) {
      list.push({
        key: 'cal:establishment',
        label: 'Installation, en mois',
        hint: 'La première année, après la plantation',
        value: `${current.calendar.establishmentMonths}`,
        common: `${base.calendar?.establishmentMonths ?? ''}`,
      });
    }
  }
  return list;
}

/** Les durées saisies, ou `null` quand un champ ne se lit pas. */
function parsedDurations(crop: ReferenceCrop, values: Record<string, string>): FarmDurations | null {
  const days = (key: string) => {
    const value = (values[key] ?? '').trim();
    return DAYS_PATTERN.test(value) ? Number(value) : null;
  };
  const directSowing = days('emergence:sowing');
  const planting = days('emergence:planting');
  if (directSowing === null || planting === null) return null;
  const base: FarmDurations = { emergence: { directSowing, planting }, stepDays: null, phaseLengths: null, abatement: null, calendar: null };
  const curve = crop.curve;
  if (curve.shape === 'steps') {
    const stepDays = curve.sets.map((set, index) => set.value.map((start, position) => ('days' in start.anchor ? days(`step:${index}:${position}`) : null)));
    const missing = curve.sets.some((set, index) => set.value.some((start, position) => 'days' in start.anchor && stepDays[index][position] === null));
    return missing ? null : { ...base, stepDays };
  }
  if (curve.shape === 'trapezoid') {
    const phaseLengths = curve.sets.map((_, index) => ({
      initial: days(`fao:${index}:initial`),
      development: days(`fao:${index}:development`),
      mid: days(`fao:${index}:mid`),
      late: days(`fao:${index}:late`),
    }));
    if (phaseLengths.some((lengths) => Object.values(lengths).some((value) => value === null))) return null;
    const abatementText = (values.abatement ?? '').trim();
    if (!DECIMAL_PATTERN.test(abatementText)) return null;
    return { ...base, phaseLengths: phaseLengths as FarmDurations['phaseLengths'], abatement: Number(abatementText.replace(',', '.')) };
  }
  const starts = curve.stages.map((_, index) => monthDay(values[`cal:${index}`] ?? ''));
  const end = monthDay(values['cal:end'] ?? '');
  if (starts.some((start) => start === null) || end === null) return null;
  const establishmentMonths = curve.establishment ? days('cal:establishment') : null;
  if (curve.establishment && establishmentMonths === null) return null;
  return { ...base, calendar: { starts: starts as string[], end, establishmentMonths } };
}

function anchorHint(anchor: StageAnchor): string {
  if (anchor.from === 'implantation') return 'Jours après l’implantation';
  if (anchor.from === 'emergence') return 'Jours après la levée';
  if (anchor.from === 'before-harvest') return 'Jours avant la dernière récolte';
  return '';
}

/** `03-15` → `15/03`. */
function dayMonth(value: string): string {
  const [month, day] = value.split('-');
  return month && day ? `${day}/${month}` : value;
}

/** `15/3` → `03-15` ; `null` quand ce n'est pas un jour et un mois. */
function monthDay(value: string): string | null {
  const match = DAY_MONTH_PATTERN.exec(value.trim());
  if (!match) return null;
  return `${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}
