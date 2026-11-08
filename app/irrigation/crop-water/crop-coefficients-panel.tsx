'use client';

import { useState, useTransition } from 'react';
import type { StoredReferenceCrop } from '@/db/crop-water/references';
import { correspondenceTargetLabel, kcSourceLabel } from '@/lib/domain/crop-water/presentation';
import type { KcSource } from '@/lib/domain/crop-water/reference';
import type { CorrespondenceEntry, SeasonSpecies } from '@/lib/domain/crop-water/species';
import type { CropCoefficientsView } from '@/lib/services/crop-water-coefficients';
import { pageHref } from '@/lib/domain/features/pages';
import { kcOverrideRows } from '@/lib/domain/crop-water/settings-view';
import { plantVignetteSpriteHref, referenceCropSymbol, speciesSymbol } from '@/lib/domain/crop-water/plant-vignettes';
import { rootingProfileView } from '@/lib/domain/soil-reserve/rooting-view';
import {
  addKcOverrideAction,
  deleteSpeciesCorrespondenceAction,
  resetFarmDurationsAction,
  saveFarmDurationsAction,
  saveRootingProfileAction,
  saveSpeciesCorrespondenceAction,
  type CropWaterActionResult,
} from '../crop-water-actions';
import { CropWaterSettingsSection } from './crop-water-settings';
import { ReferenceCropCard } from './reference-crop-card';
import { referenceCropSummary } from '@/lib/domain/crop-water/crop-summary';
import { DetailHint } from './detail-hint';
import { PlantVignette } from './plant-vignette';

/**
 * La page « Coefficients culturaux » (docs/crop-water-need-contract.md,
 * « L'écran », 5 quater, PR 3) : la correspondance des espèces de la saison,
 * par espèce avec une exception possible par série, la liste « sans
 * référence Kc » et les tables des cultures de référence. Une espèce sans
 * rattachement garde son objectif saisi ; rien n'est deviné. Depuis la PR
 * 3c : les surcharges de Kc de chaque culture et les réglages du calcul ;
 * depuis la PR 3e, les durées propres à la ferme ; depuis la 5 ter (PR 3c),
 * le profil racinaire de chaque culture.
 */

type Target = CorrespondenceEntry['target'];
type Pending = (operation: () => Promise<CropWaterActionResult>) => void;

const SOURCES: readonly KcSource[] = ['criiam', 'fao56', 'local'];
const WITHOUT_REFERENCE = 'without-reference';
const SURFACE_STATE = 'surface-state';
const CROP_PREFIX = 'crop:';

/**
 * Depuis la 3.8 (docs/feature-selection-contract.md, précision P3), la
 * correspondance des espèces et la liste « sans référence Kc » sont dans
 * Réglages (`part="especes"`) : les alertes de gel en ont besoin sans les
 * coefficients. La page « Besoin par culture » garde les cultures de
 * référence et les réglages du calcul (`part="coefficients"`).
 */
export function CropCoefficientsPanel({ season, initialView, part = 'coefficients' }: {
  season: number;
  initialView: CropCoefficientsView;
  part?: 'coefficients' | 'especes';
}) {
  const [view, setView] = useState(initialView);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run: Pending = (operation) => startTransition(async () => {
    const result = await operation();
    if (result.ok) { setView(result.view); setNotice(result.message); setError(null); }
    else { setError(result.message); setNotice(null); }
  });
  const species = part === 'especes';
  const spriteHref = !view.available ? null : species
    ? plantVignetteSpriteHref(view.species.map((item) => speciesSymbol(item.plantName)))
    : plantVignetteSpriteHref(view.crops.map((stored) => referenceCropSymbol(stored.crop)));

  return (
    <section className="crop-coefficients" aria-labelledby={species ? 'species-correspondence-title' : 'crop-coefficients-title'}>
      <header className="crop-coefficients-heading">
        {species ? (
          <>
            <h2 id="species-correspondence-title">Correspondance des espèces</h2>
            <p>
              Rattachez chaque espèce de vos séries à une culture de référence : le besoin par culture et les alertes de gel s’en
              servent. Une espèce non rattachée n’a pas d’objectif proposé : son objectif saisi reste seul.
            </p>
          </>
        ) : (
          <>
            <h2 id="crop-coefficients-title">Coefficients culturaux</h2>
            <p>
              Le besoin en eau d’une culture suit son stade : c’est son coefficient cultural, le Kc. Chaque espèce de vos séries se
              rattache à une culture de référence <a href={pageHref('reglages', { season })}>dans Réglages</a>.
            </p>
          </>
        )}
      </header>
      {notice ? <p className="water-notice" role="status">{notice}</p> : null}
      {error ? <p className="water-error" role="alert">{error}</p> : null}
      {!view.available ? (
        <p className="crop-coefficients-empty">
          Le plan de culture d’Ouvre ta ferme n’est pas encore lu pour la saison {view.season} : actualisez la lecture pour rattacher ses espèces.
        </p>
      ) : species ? (
        <>
          <SpeciesSection season={season} view={view} spriteHref={spriteHref} pending={pending} run={run} />
          <WithoutReferenceSection view={view} />
        </>
      ) : (
        <>
          <section className="crop-coefficients-part" aria-labelledby="reference-crops-title">
            <h3 id="reference-crops-title">Cultures de référence</h3>
            <p>
              Les valeurs du CRIIAM Sud s’imposent pour ses légumes ; la FAO-56 sert de repli. Une culture inutilisable dit pourquoi.
              Touchez une culture pour voir ses Kc, ses durées et son profil racinaire, et les régler.
            </p>
            <div className="reference-crop-list">
              {view.crops.map((stored) => {
                const overrideRows = kcOverrideRows(stored.crop, view.overrides, view.settings.today);
                const rooting = rootingProfileView(stored.crop, view.rootingProfiles, view.settings.today);
                return (
                  <ReferenceCropCard
                    key={stored.crop.id}
                    stored={stored}
                    spriteHref={spriteHref}
                    common={view.commonVersions[stored.crop.id] ?? null}
                    overrideRows={overrideRows}
                    rooting={rooting}
                    summary={referenceCropSummary(stored.crop.id, overrideRows, rooting, view.species)}
                    today={view.settings.today}
                    pending={pending}
                    onOverride={(input) => run(() => addKcOverrideAction({ season, referenceCropId: stored.crop.id, ...input }))}
                    onSaveDurations={(durations) => run(() => saveFarmDurationsAction({ season, referenceCropId: stored.crop.id, durations }))}
                    onResetDurations={() => run(() => resetFarmDurationsAction({ season, referenceCropId: stored.crop.id }))}
                    onSaveRooting={(input) => run(() => saveRootingProfileAction({ season, referenceCropId: stored.crop.id, ...input }))}
                  />
                );
              })}
            </div>
          </section>
          <CropWaterSettingsSection season={season} settings={view.settings} pending={pending} run={run} />
        </>
      )}
    </section>
  );
}

function SpeciesSection({ season, view, spriteHref, pending, run }: {
  season: number;
  view: Extract<CropCoefficientsView, { available: true }>;
  spriteHref: string | null;
  pending: boolean;
  run: Pending;
}) {
  const linked = view.species.filter((species) => species.link !== null).length;
  return (
    <section className="crop-coefficients-part" aria-labelledby="species-links-title">
      <h3 id="species-links-title">Espèces de la saison</h3>
      <p>
        {linked} espèce{linked > 1 ? 's' : ''} rattachée{linked > 1 ? 's' : ''} sur {view.species.length}, pour les séries de la
        saison {season} posées sur des planches. Une série peut suivre une autre culture que son espèce : c’est une exception.
        Touchez une espèce pour la rattacher ou voir ses séries.
      </p>
      {view.species.length === 0 ? <p className="crop-coefficients-empty">Aucune série de la saison n’est posée sur une planche.</p> : null}
      <div className="species-link-list">
        {view.species.map((species) => (
          <SpeciesLinkCard key={species.plantId} season={season} species={species} crops={view.crops} spriteHref={spriteHref} pending={pending} run={run} />
        ))}
      </div>
    </section>
  );
}

function SpeciesLinkCard({ season, species, crops, spriteHref, pending, run }: {
  season: number;
  species: SeasonSpecies;
  crops: readonly StoredReferenceCrop[];
  spriteHref: string | null;
  pending: boolean;
  run: Pending;
}) {
  const cropName = (id: string) => crops.find((stored) => stored.crop.id === id)?.crop.name ?? null;
  // Une carte ouverte avant que React ne reprenne la main est un geste de l'utilisateur, pas un écart à signaler.
  return (
    <details className="species-link-card" data-linked={species.link !== null} suppressHydrationWarning>
      <summary>
        <strong><PlantVignette spriteHref={spriteHref} symbol={speciesSymbol(species.plantName)} />{species.plantName}</strong>
        <small>
          {correspondenceTargetLabel(species.link?.target ?? null, cropName)}
          {' · '}{species.series.length} série{species.series.length > 1 ? 's' : ''}
          {species.exceptions.length > 0 ? ` · ${species.exceptions.length} exception${species.exceptions.length > 1 ? 's' : ''}` : ''}
        </small>
        <DetailHint />
      </summary>
      <CorrespondenceForm
        key={formKey(species.link?.target ?? null)}
        label={`Rattachement de l’espèce ${species.plantName}`}
        crops={crops}
        current={species.link?.target ?? null}
        pending={pending}
        onSave={(target) => run(() => saveSpeciesCorrespondenceAction({ season, plantId: species.plantId, seriesId: null, target }))}
        onRemove={species.link ? () => run(() => deleteSpeciesCorrespondenceAction({ season, plantId: species.plantId, seriesId: null })) : null}
        removeLabel="Retirer le rattachement"
      />
      <details className="species-exceptions" suppressHydrationWarning>
        <summary>Exceptions par série</summary>
        <ul>
          {species.series.map((series) => {
            const exception = species.exceptions.find((entry) => entry.seriesId === series.id) ?? null;
            return (
              <li key={series.id}>
                <strong>{series.name}</strong>
                <small>{exception ? `Exception : ${correspondenceTargetLabel(exception.target, cropName)}` : 'Suit le rattachement de l’espèce'}</small>
                <CorrespondenceForm
                  key={formKey(exception?.target ?? null)}
                  label={`Exception de la série ${series.name}`}
                  crops={crops}
                  current={exception?.target ?? null}
                  pending={pending}
                  onSave={(target) => run(() => saveSpeciesCorrespondenceAction({ season, plantId: species.plantId, seriesId: series.id, target }))}
                  onRemove={exception ? () => run(() => deleteSpeciesCorrespondenceAction({ season, plantId: species.plantId, seriesId: series.id })) : null}
                  removeLabel="Retirer l’exception"
                />
              </li>
            );
          })}
        </ul>
      </details>
    </details>
  );
}

function CorrespondenceForm({ label, crops, current, pending, onSave, onRemove, removeLabel }: {
  label: string;
  crops: readonly StoredReferenceCrop[];
  current: Target | null;
  pending: boolean;
  onSave: (target: Target) => void;
  onRemove: (() => void) | null;
  removeLabel: string;
}) {
  const [choice, setChoice] = useState(choiceOf(current));
  const [analogy, setAnalogy] = useState(current?.kind === 'reference' && current.analogy);
  const target = targetOf(choice, analogy);
  return (
    <div className="correspondence-form" role="group" aria-label={label}>
      <label>
        <span>Culture de référence</span>
        <select value={choice} onChange={(event) => setChoice(event.target.value)}>
          <option value="">— Choisir —</option>
          {SOURCES.map((source) => {
            const options = crops.filter((stored) => stored.crop.source === source);
            return options.length === 0 ? null : (
              <optgroup key={source} label={kcSourceLabel(source)}>
                {options.map((stored) => (
                  <option key={stored.crop.id} value={`${CROP_PREFIX}${stored.crop.id}`} disabled={stored.problems.length > 0}>
                    {stored.crop.name}{stored.problems.length > 0 ? ' (inutilisable)' : ''}
                  </option>
                ))}
              </optgroup>
            );
          })}
          <optgroup label="Autres">
            <option value={WITHOUT_REFERENCE}>Sans référence Kc</option>
            <option value={SURFACE_STATE}>Engrais vert : état de la surface du sol</option>
          </optgroup>
        </select>
      </label>
      {choice.startsWith(CROP_PREFIX) ? (
        <label className="correspondence-analogy">
          <input type="checkbox" checked={analogy} onChange={(event) => setAnalogy(event.target.checked)} />
          Par analogie (culture proche, pas la même)
        </label>
      ) : null}
      <div className="correspondence-buttons">
        <button type="button" disabled={pending || target === null} onClick={() => target && onSave(target)}>Enregistrer</button>
        {onRemove ? <button type="button" className="secondary" disabled={pending} onClick={onRemove}>{removeLabel}</button> : null}
      </div>
    </div>
  );
}

function WithoutReferenceSection({ view }: { view: Extract<CropCoefficientsView, { available: true }> }) {
  return (
    <section className="crop-coefficients-part" aria-labelledby="without-reference-title">
      <h3 id="without-reference-title">Espèces sans référence Kc</h3>
      {view.withoutReference.length === 0 ? (
        <p>Toutes les espèces de la saison ont une culture de référence ou sont de l’engrais vert.</p>
      ) : (
        <>
          <p>Pas d’objectif proposé pour ces espèces : leur objectif saisi reste seul.</p>
          <ul className="without-reference-list" aria-label="Espèces sans référence Kc">
            {view.withoutReference.map((item) => (
              <li key={`${item.plantId}:${item.reason}`}>
                <strong>{item.plantName}</strong>
                <small>
                  {item.reason === 'missing' ? 'aucun rattachement saisi' : 'rattachée à « sans référence »'}
                  {' · '}{item.seriesIds.length} série{item.seriesIds.length > 1 ? 's' : ''}
                </small>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function choiceOf(target: Target | null): string {
  if (target === null) return '';
  if (target.kind === 'reference') return `${CROP_PREFIX}${target.referenceCropId}`;
  return target.kind;
}

/** Un formulaire repart de ce qui est enregistré dès que l'enregistrement change. */
function formKey(target: Target | null): string {
  return `${choiceOf(target)}|${target?.kind === 'reference' && target.analogy ? 'analogie' : ''}`;
}

function targetOf(choice: string, analogy: boolean): Target | null {
  if (choice.startsWith(CROP_PREFIX)) return { kind: 'reference', referenceCropId: choice.slice(CROP_PREFIX.length), analogy };
  if (choice === WITHOUT_REFERENCE) return { kind: 'without-reference' };
  if (choice === SURFACE_STATE) return { kind: 'surface-state' };
  return null;
}
