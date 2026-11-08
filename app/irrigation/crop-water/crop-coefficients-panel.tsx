'use client';

import { useId, useState, useTransition } from 'react';
import type { StoredReferenceCrop } from '@/db/crop-water/references';
import { correspondenceTargetLabel, kcSourceLabel } from '@/lib/domain/crop-water/presentation';
import type { KcSource } from '@/lib/domain/crop-water/reference';
import type { CorrespondenceEntry, SeasonSpecies } from '@/lib/domain/crop-water/species';
import {
  speciesInLinkOrder,
  speciesLinkCounter,
  speciesNeedsLink,
  suggestReferenceCrop,
  WITHOUT_REFERENCE_CONSEQUENCE,
  type LinkCandidate,
} from '@/lib/domain/crop-water/species-linking';
import { matchesSearch } from '@/lib/domain/name-search';
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
import { ExpertsFold } from './experts-fold';
import { PlantVignette } from './plant-vignette';
import { SpeciesLinkSuggestion } from './species-link-suggestion';

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
            {/* Le titre et la tête en clair ; le détail technique dans « Pour les experts » (audit ergonomique, lot 3, point 8). */}
            <h2 id="crop-coefficients-title">Besoin en eau par culture</h2>
            <p>
              Une culture ne boit pas autant à la levée qu’en pleine saison. Le module suit le stade de chaque culture, jour après
              jour, pour proposer un objectif d’arrosage. Chaque espèce de vos séries suit une culture de référence, choisie{' '}
              <a href={pageHref('reglages', { season })}>dans Réglages</a>.
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
              Touchez une culture pour voir ce qu’elle boit à chaque stade, la durée de ses stades et la profondeur de ses racines,
              et les régler pour votre ferme. Une culture inutilisable dit pourquoi.
            </p>
            <ExpertsFold>
              <p>
                Le besoin d’un jour est l’ETM : l’évapotranspiration de référence (ET0) multipliée par le coefficient cultural (Kc) du
                stade. Les valeurs du CRIIAM Sud s’imposent pour ses légumes ; la FAO-56 sert de repli. Le CRIIAM donne un Kc par
                stade, en escalier ; la FAO-56, un trapèze (début, développement, pleine saison, fin). Le jeu commun est la table partagée
                par toutes les fermes ; les durées de la ferme le remplacent pour elle seule.
              </p>
            </ExpertsFold>
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

/** La recherche par nom paraît dès deux espèces (précision F64). */
const SEARCH_FROM = 2;

function SpeciesSection({ season, view, spriteHref, pending, run }: {
  season: number;
  view: Extract<CropCoefficientsView, { available: true }>;
  spriteHref: string | null;
  pending: boolean;
  run: Pending;
}) {
  const [query, setQuery] = useState('');
  const hintId = useId();
  const toLink = view.species.filter(speciesNeedsLink).length;
  const shown = speciesInLinkOrder(view.species.filter((species) => matchesSearch(species.plantName, query)));
  // La proposition ne lit que le jeu commun : une culture saisie par la ferme n'est jamais proposée (cas 9).
  const candidates: LinkCandidate[] = view.crops.map((stored) => ({
    id: stored.crop.id,
    name: stored.crop.name,
    source: stored.crop.source,
    fromCommonSet: stored.origin === 'common' || stored.crop.id in view.commonVersions,
    usable: stored.problems.length === 0,
  }));
  return (
    <section className="crop-coefficients-part" aria-labelledby="species-links-title">
      <h3 id="species-links-title">Espèces de la saison</h3>
      <p className="species-link-counter">
        <strong>{speciesLinkCounter(view.species)}</strong>
        {toLink > 0 ? <span>{WITHOUT_REFERENCE_CONSEQUENCE}</span> : null}
      </p>
      <p>
        Les espèces des séries de la saison {season} posées sur des planches, celles à rattacher d’abord. Une série peut suivre
        une autre culture que son espèce : c’est une exception. Touchez une espèce pour la rattacher ou voir ses séries.
      </p>
      {view.species.length === 0 ? <p className="crop-coefficients-empty">Aucune série de la saison n’est posée sur une planche.</p> : null}
      {view.species.length >= SEARCH_FROM ? (
        <div className="species-search">
          <label>
            <span>Chercher une espèce</span>
            <input type="search" value={query} placeholder="Tomate, carotte…" aria-describedby={hintId} onChange={(event) => setQuery(event.target.value)} />
          </label>
          {/* Une zone vivante sans le rôle « status » : celui-ci reste aux messages d'enregistrement de la section. */}
          <small id={hintId} aria-live="polite">
            {query.trim() === ''
              ? 'Tapez un nom pour réduire la liste.'
              : shown.length === 0
                ? 'Aucune espèce ne correspond à cette recherche.'
                : `${shown.length} espèce${shown.length > 1 ? 's' : ''} trouvée${shown.length > 1 ? 's' : ''}.`}
          </small>
        </div>
      ) : null}
      <div className="species-link-list">
        {shown.map((species) => {
          const suggestion = speciesNeedsLink(species) ? suggestReferenceCrop(species.plantName, candidates) : null;
          return (
            <div key={species.plantId} className="species-link-row" data-to-link={speciesNeedsLink(species)}>
              <SpeciesLinkCard season={season} species={species} crops={view.crops} spriteHref={spriteHref} pending={pending} run={run} />
              {suggestion ? (
                <SpeciesLinkSuggestion
                  plantName={species.plantName}
                  crop={suggestion}
                  pending={pending}
                  onConfirm={() => run(() => saveSpeciesCorrespondenceAction({
                    season,
                    plantId: species.plantId,
                    seriesId: null,
                    target: { kind: 'reference', referenceCropId: suggestion.id, analogy: false },
                  }))}
                />
              ) : null}
            </div>
          );
        })}
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
    <details className="species-link-card" data-linked={!speciesNeedsLink(species)} suppressHydrationWarning>
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
          <p>{WITHOUT_REFERENCE_CONSEQUENCE} La liste compte aussi les séries dont l’exception est « sans référence ».</p>
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
