'use client';

import { useState, useTransition, type ReactNode } from 'react';
import type { EquipmentKind } from '@/lib/domain/irrigation-domain';
import {
  COLLECTIVE_DOSE_RULE_LABELS,
  EQUIPMENT_KIND_LABELS,
  SHORTAGE_STRATEGY_LABELS,
  planningSettingsForm,
  settingsFromForm,
  settingsIssueLabel,
  summarizeSettings,
  type PlanningSettingsForm as FormValues,
} from '@/lib/domain/planning/presentation';
import type { PlanningSettings, PlanningSettingsIssue } from '@/lib/domain/planning/settings';
import { loadPlanningSettingsHistoryAction, savePlanningSettingsAction } from '../planning-actions';
import { formatDateTime } from './format';

const KINDS: readonly EquipmentKind[] = ['sprinkler', 'drip'];

/**
 * Les réglages R2 à R14 (docs/planning-contract.md, « Réglages », « Interface
 * (3.6) ») : chacun avec son numéro et son unité, enregistrés d'un bouton ;
 * une valeur absurde est refusée avec son chemin, rien n'est corrigé en
 * silence ; l'historique se lit dessous. Un réglage vaut au prochain calcul.
 * R1, l'heure du recalcul quotidien, est retiré (D-029) : l'écran dit que le
 * recalcul du matin suit la météo, à 06 h 15. Le pli reçoit sous le
 * formulaire les sections qui ont leur propre enregistrement : les créneaux
 * protégés (3.8 ter), hors du formulaire, qu'un formulaire ne peut contenir.
 */
export function PlanningSettingsForm({ initialSettings, children = null }: { initialSettings: PlanningSettings; children?: ReactNode }) {
  const [saved, setSaved] = useState(initialSettings);
  const [form, setForm] = useState<FormValues>(() => planningSettingsForm(initialSettings));
  const [issues, setIssues] = useState<PlanningSettingsIssue[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ settings: PlanningSettings; createdAt: string }[] | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (patch: Partial<FormValues>) => setForm((current) => ({ ...current, ...patch }));
  const updateDose = (kind: EquipmentKind, field: keyof FormValues['doses'][EquipmentKind], value: string) =>
    setForm((current) => ({ ...current, doses: { ...current.doses, [kind]: { ...current.doses[kind], [field]: value } } }));
  const updateWindow = (kind: EquipmentKind, field: 'start' | 'end', value: string) =>
    setForm((current) => ({ ...current, windows: { ...current.windows, [kind]: { ...current.windows[kind], [field]: value } } }));

  const save = () => {
    const parsed = settingsFromForm(form);
    setNotice(null);
    setError(null);
    if (parsed.settings === null) {
      setIssues(parsed.issues);
      return;
    }
    startTransition(async () => {
      const result = await savePlanningSettingsAction({ settings: parsed.settings });
      if (result.ok) {
        setSaved(result.settings);
        setForm(planningSettingsForm(result.settings));
        setIssues([]);
        setHistory(null);
        setNotice('Réglages enregistrés : ils valent au prochain calcul.');
      } else {
        setIssues(result.issues ?? []);
        setError(result.message);
      }
    });
  };

  const loadHistory = () => startTransition(async () => {
    const result = await loadPlanningSettingsHistoryAction();
    if (result.ok) setHistory(result.history);
    else setError(result.message);
  });

  return (
    <details className="planning-settings">
      <summary>
        <strong>Réglages du planning</strong>
        <small>{summarizeSettings(saved)}</small>
      </summary>
      <form className="planning-settings-form" aria-label="Réglages du planning" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <p className="planning-settings-note">Le recalcul du matin suit la météo, à 06 h 15 ; il ne se règle pas. Un réglage enregistré vaut au prochain calcul.</p>
        <fieldset>
          <legend>Pluie prévue</legend>
          <label>
            <span>R2 · Part de la pluie prévue déduite du besoin (%)</span>
            <input inputMode="decimal" value={form.forecastRainSharePercent} onChange={(event) => update({ forecastRainSharePercent: event.target.value })} />
          </label>
          <label>
            <span>R3 · Pluie prévue qui fait attendre (mm par jour)</span>
            <input inputMode="decimal" value={form.waitForForecastRainAboveMm} onChange={(event) => update({ waitForForecastRainAboveMm: event.target.value })} />
          </label>
        </fieldset>
        {KINDS.map((kind) => (
          <fieldset key={kind}>
            <legend>{EQUIPMENT_KIND_LABELS[kind]}</legend>
            <label><span>R4 · Dose minimale par arrosage (mm)</span><input inputMode="decimal" aria-label={`R4 dose minimale ${EQUIPMENT_KIND_LABELS[kind]}`} value={form.doses[kind].minimumMm} onChange={(event) => updateDose(kind, 'minimumMm', event.target.value)} /></label>
            <label><span>R5 · Dose maximale par arrosage (mm)</span><input inputMode="decimal" aria-label={`R5 dose maximale ${EQUIPMENT_KIND_LABELS[kind]}`} value={form.doses[kind].maximumMm} onChange={(event) => updateDose(kind, 'maximumMm', event.target.value)} /></label>
            <label><span>R6 · Arrosages par jour et par planche, au plus</span><input inputMode="numeric" aria-label={`R6 arrosages par jour ${EQUIPMENT_KIND_LABELS[kind]}`} value={form.doses[kind].irrigationsPerDay} onChange={(event) => updateDose(kind, 'irrigationsPerDay', event.target.value)} /></label>
            <label><span>R7 · Espacement entre deux arrosages d’une planche (jours)</span><input inputMode="numeric" aria-label={`R7 espacement ${EQUIPMENT_KIND_LABELS[kind]}`} value={form.doses[kind].spacingDays} onChange={(event) => updateDose(kind, 'spacingDays', event.target.value)} /></label>
            <label><span>R8 · Plage horaire, début</span><input type="time" aria-label={`R8 début de plage ${EQUIPMENT_KIND_LABELS[kind]}`} value={form.windows[kind].start} onChange={(event) => updateWindow(kind, 'start', event.target.value)} /></label>
            <label><span>R8 · Plage horaire, fin</span><input type="time" aria-label={`R8 fin de plage ${EQUIPMENT_KIND_LABELS[kind]}`} value={form.windows[kind].end} onChange={(event) => updateWindow(kind, 'end', event.target.value)} /><small>Une fin avant le début passe minuit : 21:00 – 08:00 est la nuit.</small></label>
          </fieldset>
        ))}
        <fieldset>
          <legend>Pénurie et choix entre les demandes d’eau</legend>
          <label>
            <span>R9 · Conduite en pénurie</span>
            <select value={form.shortageStrategy} onChange={(event) => update({ shortageStrategy: event.target.value as FormValues['shortageStrategy'] })}>
              {(Object.keys(SHORTAGE_STRATEGY_LABELS) as FormValues['shortageStrategy'][]).map((value) => <option key={value} value={value}>{SHORTAGE_STRATEGY_LABELS[value]}</option>)}
            </select>
          </label>
          <label className="planning-settings-toggle">
            <input type="checkbox" checked={form.carryOverDeficit} onChange={(event) => update({ carryOverDeficit: event.target.checked })} />
            <span>R10 · Reporter le déficit sur la semaine suivante</span>
          </label>
          <label>
            <span>R11 · Dose d’un matériel qui arrose plusieurs planches</span>
            <select value={form.collectiveDoseRule} onChange={(event) => update({ collectiveDoseRule: event.target.value as FormValues['collectiveDoseRule'] })}>
              {(Object.keys(COLLECTIVE_DOSE_RULE_LABELS) as FormValues['collectiveDoseRule'][]).map((value) => <option key={value} value={value}>{COLLECTIVE_DOSE_RULE_LABELS[value]}</option>)}
            </select>
          </label>
          <label>
            <span>R12 · Matériel qui sert d’abord quand deux arrosent la planche</span>
            <select value={form.preferredKindWhenBoth} onChange={(event) => update({ preferredKindWhenBoth: event.target.value as EquipmentKind })}>
              {KINDS.map((kind) => <option key={kind} value={kind}>{EQUIPMENT_KIND_LABELS[kind]}</option>)}
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>Portée du matériel</legend>
          <label>
            <span>R13 · Part du débit le plus fort en dessous de laquelle une planche ne commande pas l’arrosage (%)</span>
            <input inputMode="decimal" value={form.commandingRateSharePercent} onChange={(event) => update({ commandingRateSharePercent: event.target.value })} />
            <small>Une planche qu’une rampe arrose trop peu n’en fixe ni la dose ni l’espacement ; son eau reste comptée, son reste est affiché « portée du matériel insuffisante ».</small>
          </label>
        </fieldset>
        <fieldset>
          <legend>Suivi des arrosages</legend>
          <label>
            <span>R14 · Tolérance du retard, en min après l’heure prévue : passé ce délai, un arrosage non démarré est « en retard »</span>
            <input inputMode="numeric" value={form.lateToleranceMinutes} onChange={(event) => update({ lateToleranceMinutes: event.target.value })} />
            <small>Le logiciel n’annule jamais un arrosage en retard : il se démarre encore, ou s’annule à la main ; son eau reste comptée jusqu’à la fin de son créneau.</small>
          </label>
        </fieldset>
        {issues.length > 0 ? (
          <ul className="planning-issues" role="alert">
            {issues.map((issue) => <li key={issue.path}>{settingsIssueLabel(issue.path)} : {issue.message}</li>)}
          </ul>
        ) : null}
        {error ? <p className="planning-error" role="alert">{error}</p> : null}
        {notice ? <p className="planning-notice" role="status">{notice}</p> : null}
        <div className="planning-settings-actions">
          <button type="submit" className="primary" disabled={pending}>Enregistrer les réglages</button>
          <button type="button" disabled={pending} onClick={loadHistory}>Voir l’historique des réglages</button>
        </div>
      </form>
      {history ? (
        history.length === 0
          ? <p className="planning-empty">Aucun réglage enregistré : les valeurs de départ s’appliquent.</p>
          : (
            <ol className="planning-settings-history" aria-label="Historique des réglages">
              {history.map((entry) => (
                <li key={entry.createdAt}>
                  <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                  <span>{summarizeSettings(entry.settings)}</span>
                </li>
              ))}
            </ol>
          )
      ) : null}
      {children}
    </details>
  );
}
