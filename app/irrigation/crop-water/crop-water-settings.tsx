'use client';

import { useState } from 'react';
import { compareNamesNaturally } from '@/lib/domain/bed-order';
import { KC_SMOOTHING_DAYS } from '@/lib/domain/crop-water/kc';
import type { BedSetting, CropWaterSettingsView, ShelterSetting } from '@/lib/domain/crop-water/settings-view';
import {
  addShadeNetAction,
  addShelterFactorAction,
  removeShadeNetAction,
  saveBedMulchAction,
  saveCropWaterOptionsAction,
  type CropWaterActionResult,
} from '../crop-water-actions';
import { SHELTER_FACTOR_HELP } from '@/lib/domain/features/help';
import { useSectionHelp } from '../shell/section-help';

/**
 * Les réglages du besoin par culture (docs/crop-water-need-contract.md,
 * « Les facteurs », « L'écran », 5 quater, PR 3c) : les options de la ferme
 * avec une phrase qui dit ce que chacune fait, le K_abri de chaque abri, le
 * paillage plastique de chaque planche pour la saison et les filets
 * d'ombrage. Un K_abri est une révision datée ; un filet retiré garde ses
 * dates.
 */

type Run = (operation: () => Promise<CropWaterActionResult>) => void;

const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function CropWaterSettingsSection({ season, settings, pending, run }: {
  season: number;
  settings: CropWaterSettingsView;
  pending: boolean;
  run: Run;
}) {
  return (
    <section className="crop-coefficients-part crop-water-settings" aria-labelledby="crop-water-settings-title">
      <h3 id="crop-water-settings-title">Réglages du calcul</h3>
      <p>Ils corrigent l’ETM de chaque planche : ETM = ET0 × K_abri × Kc × K_paillage × K_ombrage.</p>
      <OptionsForm key={`${settings.options.smoothing}|${settings.options.shading}`} season={season} settings={settings} pending={pending} run={run} />
      <SheltersPart season={season} settings={settings} pending={pending} run={run} />
      <MulchPart season={season} beds={settings.beds} pending={pending} run={run} />
      <ShadeNetsPart key={settings.beds.reduce((count, bed) => count + bed.nets.length, 0)} season={season} settings={settings} pending={pending} run={run} />
    </section>
  );
}

function OptionsForm({ season, settings, pending, run }: { season: number; settings: CropWaterSettingsView; pending: boolean; run: Run }) {
  const [smoothing, setSmoothing] = useState(settings.options.smoothing);
  const [shading, setShading] = useState(settings.options.shading);
  const changed = smoothing !== settings.options.smoothing || shading !== settings.options.shading;
  return (
    <div className="crop-water-settings-block" role="group" aria-label="Options du calcul">
      <h4>Options</h4>
      <label className="crop-water-option">
        <input type="checkbox" checked={smoothing} onChange={(event) => setSmoothing(event.target.checked)} />
        <span>
          <strong>Lissage des passages de stade</strong> · {settings.options.smoothing ? 'activé' : 'désactivé'}
          <small>
            Le Kc passe d’un stade au suivant en ligne droite sur {KC_SMOOTHING_DAYS} jours, au lieu de changer d’un coup le jour du
            passage.
          </small>
        </span>
      </label>
      <label className="crop-water-option">
        <input type="checkbox" checked={shading} onChange={(event) => setShading(event.target.checked)} />
        <span>
          <strong>Ombrage</strong> · {settings.options.shading ? 'activé' : 'désactivé'}
          <small>
            Un filet d’ombrage posé sur une planche réduit son besoin : ETM × √(1 − taux), soit 0,87 pour un filet de 25 %. C’est une
            hypothèse tirée des formules de serre, pas une norme.
          </small>
        </span>
      </label>
      <button type="button" disabled={pending || !changed} onClick={() => run(() => saveCropWaterOptionsAction({ season, smoothing, shading }))}>
        Enregistrer les options
      </button>
    </div>
  );
}

function SheltersPart({ season, settings, pending, run }: { season: number; settings: CropWaterSettingsView; pending: boolean; run: Run }) {
  const help = useSectionHelp('K_abri, par abri', SHELTER_FACTOR_HELP);
  return (
    <div className="crop-water-settings-block">
      <div className="section-title-row"><h4>K_abri, par abri</h4>{help.toggle}</div>
      {help.panel}
      <p className="reference-crop-meta">
        Sous abri, l’ETM est multipliée par K_abri : 0,80 par défaut (CRIIAM), réglable de 0,60 à 1. En plein champ, il vaut 1.
      </p>
      {settings.shelters.length === 0 ? (
        <p className="crop-coefficients-empty">Aucun jardin n’est sous abri cette saison.</p>
      ) : (
        <ul className="crop-water-settings-list" aria-label="K_abri des abris">
          {settings.shelters.map((shelter) => (
            <ShelterItem key={`${shelter.plotId}|${shelter.history.length}`} season={season} shelter={shelter} today={settings.today} pending={pending} run={run} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ShelterItem({ season, shelter, today, pending, run }: { season: number; shelter: ShelterSetting; today: string; pending: boolean; run: Run }) {
  const [value, setValue] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const factor = parseDecimal(value);
  return (
    <li>
      <strong>{shelter.name}</strong>
      <span>
        K_abri aujourd’hui : {decimal.format(shelter.factor)}{shelter.isDefault ? ', valeur par défaut' : ', valeur de la ferme'}
      </span>
      {shelter.history.length > 0 ? (
        <small>
          {shelter.history.map((revision) => `${decimal.format(revision.value)} à partir du ${day(revision.effectiveFrom)}`).join(' ; ')}
        </small>
      ) : null}
      <div className="crop-water-inline-form" role="group" aria-label={`Régler le K_abri · ${shelter.name}`}>
        <label>
          <span>Nouveau K_abri</span>
          <input type="text" inputMode="decimal" placeholder="par exemple 0,70" value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
        <label>
          <span>À partir du</span>
          <input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
        </label>
        <button
          type="button"
          disabled={pending || factor === null || effectiveFrom === ''}
          onClick={() => factor !== null && run(() => addShelterFactorAction({ season, plotId: shelter.plotId, value: factor, effectiveFrom }))}
        >
          Enregistrer le K_abri
        </button>
      </div>
    </li>
  );
}

function MulchPart({ season, beds, pending, run }: { season: number; beds: readonly BedSetting[]; pending: boolean; run: Run }) {
  const plots = [...new Set(beds.map((bed) => bed.plotName))];
  const mulched = beds.filter((bed) => bed.plasticMulch).length;
  return (
    <details className="crop-water-settings-block" suppressHydrationWarning>
      <summary>
        <strong>Paillage plastique, saison {season}</strong>
        <small>{mulched === 0 ? 'aucune planche paillée' : `${mulched} planche${mulched > 1 ? 's' : ''} paillée${mulched > 1 ? 's' : ''}`}</small>
      </summary>
      <p className="reference-crop-meta">Une planche paillée de plastique a un Kc multiplié par 0,9 pour toute la saison.</p>
      {plots.map((plotName) => (
        <fieldset key={plotName} className="crop-water-mulch">
          <legend>{plotName}</legend>
          {beds.filter((bed) => bed.plotName === plotName).map((bed) => (
            <label key={bed.bedId}>
              <input
                type="checkbox"
                checked={bed.plasticMulch}
                disabled={pending}
                onChange={(event) => {
                  const plasticMulch = event.target.checked;
                  run(() => saveBedMulchAction({ season, bedId: bed.bedId, plasticMulch }));
                }}
              />
              Planche {bed.name}
            </label>
          ))}
        </fieldset>
      ))}
    </details>
  );
}

function ShadeNetsPart({ season, settings, pending, run }: { season: number; settings: CropWaterSettingsView; pending: boolean; run: Run }) {
  const [bedId, setBedId] = useState('');
  const [rate, setRate] = useState('');
  const [from, setFrom] = useState(settings.today);
  const [to, setTo] = useState('');
  const ratePercent = parseDecimal(rate);
  const placed = settings.beds.flatMap((bed) => bed.nets.map((net) => ({ bed, net })));
  return (
    <div className="crop-water-settings-block">
      <h4>Filets d’ombrage</h4>
      <p className="reference-crop-meta">
        {settings.options.shading
          ? 'L’option d’ombrage est activée : un filet posé réduit l’ETM de sa planche pendant ses jours de pose.'
          : 'L’option d’ombrage est désactivée : un filet posé est gardé, mais il ne change pas le calcul.'}
      </p>
      {placed.length > 0 ? (
        <ul className="crop-water-settings-list" aria-label="Filets d’ombrage">
          {placed.map(({ bed, net }) => (
            <li key={net.id}>
              <strong>Planche {bed.name} · {bed.plotName}</strong>
              <span>
                {percent.format(net.rate * 100)} % · posé le {day(net.from)}{net.to ? `, retiré le ${day(net.to)}` : ', toujours posé'}
              </span>
              {net.to === null && net.from <= settings.today ? (
                <button
                  type="button"
                  className="secondary"
                  disabled={pending}
                  onClick={() => run(() => removeShadeNetAction({ season, netId: net.id, removedOn: settings.today }))}
                >
                  Retirer aujourd’hui
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="crop-water-inline-form" role="group" aria-label="Poser un filet d’ombrage">
        <label>
          <span>Planche</span>
          <select value={bedId} onChange={(event) => setBedId(event.target.value)}>
            <option value="">— Choisir —</option>
            {/* Rangées par jardin puis dans l'ordre naturel des planches (audit ergonomique, point 4). */}
            {[...settings.beds]
              .sort((left, right) => compareNamesNaturally(left.plotName, right.plotName) || compareNamesNaturally(left.name, right.name))
              .map((bed) => <option key={bed.bedId} value={bed.bedId}>{bed.plotName} · {bed.name}</option>)}
          </select>
        </label>
        <label>
          <span>Taux, en %</span>
          <input type="text" inputMode="decimal" placeholder="par exemple 25" value={rate} onChange={(event) => setRate(event.target.value)} />
        </label>
        <label>
          <span>Posé le</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          <span>Retiré le (facultatif)</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button
          type="button"
          disabled={pending || bedId === '' || ratePercent === null || from === ''}
          onClick={() => ratePercent !== null && run(() => addShadeNetAction({ season, bedId, ratePercent, from, to: to === '' ? null : to }))}
        >
          Poser le filet
        </button>
      </div>
    </div>
  );
}

function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

function day(value: string): string {
  return dayFormat.format(new Date(`${value}T12:00:00Z`));
}
