'use client';

import { useState } from 'react';
import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import { SEE_THE_WEEK } from '@/lib/domain/today/essential';
import type { TodaySoil } from '@/lib/domain/today/soil';
import type { TodayBlock } from '@/lib/domain/today/today-view';
import type { TodayWeek } from '@/lib/domain/today/week';
import { Icon } from '../line-icon';

type WaterBlock = Extract<TodayBlock, { kind: 'water' }>;
type WeekRow = TodayWeek['farm'];
type SoilGarden = TodaySoil['shown'][number];

/**
 * Les jauges du tableau de bord (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.2) : l'eau de la semaine par jardin, la réserve du sol par
 * jardin, les cuves et les prélèvements limités. Chaque dessin porte son
 * texte : le chiffre est écrit à côté de la barre, et le nom de la barre le
 * dit à un lecteur d'écran. Une valeur inconnue se dessine hachurée, jamais
 * pleine ni vide (D-003).
 *
 * Chaque ligne, chaque cuve et chaque ressource mène à sa page
 * (docs/aujourdhui-liens-contract.md, L2, D-311) : le lien porte la phrase
 * écrite pour un lecteur d'écran, le dessin lui reste caché. Au téléphone, le
 * lien d'en-tête du bloc passe en bas, sur toute la largeur.
 */

/** Le lien d'en-tête d'un bloc, répété en bas pour le téléphone, où l'en-tête le cache (L2, règle 4). */
function BlockFootLink({ href, label }: { href: string; label: string }) {
  return <a className="today-action-link today-block-foot" href={href}>{label}</a>;
}

/** « Eau de la semaine » : une barre pour la ferme, puis une par jardin ; les autres derrière « Voir les n autres jardins » (T9). */
export function TodayWeekWater({ week, query }: { week: TodayWeek; query: PageQuery }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? [...week.shown, ...week.hidden] : week.shown;
  return (
    <section className="today-block" id="today-week-water" data-kind="week" aria-labelledby="today-week-water-title">
      <div className="today-block-heading">
        <span className="today-block-badge" data-tone="water"><Icon name="pluie" /></span>
        <div>
          <h2 id="today-week-water-title">Eau de la semaine</h2>
          <p className="today-block-sub">Reçue par rapport à l’objectif, {week.label}</p>
        </div>
        <a className="today-block-more" href={pageHref('semaine', query)}>{SEE_THE_WEEK}</a>
      </div>
      <ul className="today-bars">
        <WeekBar row={week.farm} href={pageHref('semaine', query, week.farm.anchor)} total />
        {rows.map((row) => <WeekBar key={row.key} row={row} href={pageHref('semaine', query, row.anchor)} />)}
      </ul>
      {week.moreLabel ? (
        <button type="button" className="today-more" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Voir moins' : week.moreLabel}
        </button>
      ) : null}
      <p className="today-legend" aria-hidden="true">
        <span><i data-tone="irrigation" />Irrigation</span>
        <span><i data-tone="rain" />{week.rainLegend}</span>
        <span><i data-tone="goal" />Objectif</span>
        <span>Échelle : 0 à {week.scaleMaxMm} mm</span>
      </p>
      <BlockFootLink href={pageHref('semaine', query)} label={SEE_THE_WEEK} />
    </section>
  );
}

function WeekBar({ row, href, total = false }: { row: WeekRow; href: string; total?: boolean }) {
  return (
    <li>
      <a className="today-bar-row" data-total={total || undefined} href={href}>
        <span className="today-bar-name" aria-hidden="true">{row.name}</span>
        <span className="today-bar" aria-hidden="true" data-unknown={row.rainMm === null || undefined}>
          <i data-tone="irrigation" style={{ width: `${row.bars.irrigationPercent}%` }} />
          <i data-tone="rain" style={{ width: `${row.bars.rainPercent}%` }} />
          {row.bars.objectivePercent === null ? null : <b style={{ left: `${row.bars.objectivePercent}%` }} />}
        </span>
        <span className="today-bar-text" aria-hidden="true">{row.text}</span>
        <span className="sr-only">{row.label}</span>
      </a>
    </li>
  );
}

/** « Réserve du sol » : une jauge par jardin, pour information (D-041, D-047), la planche la plus sèche nommée (T7). */
export function TodaySoilBlock({ soil, query }: { soil: TodaySoil; query: PageQuery }) {
  const [showAll, setShowAll] = useState(false);
  const gardens = showAll ? [...soil.shown, ...soil.hidden] : soil.shown;
  return (
    <section className="today-block" id="today-soil" data-kind="soil" aria-labelledby="today-soil-title">
      <div className="today-block-heading">
        <span className="today-block-badge"><Icon name="jauge" /></span>
        <div>
          <h2 id="today-soil-title">Réserve du sol</h2>
          <p className="today-block-sub">Estimée maintenant, pour information</p>
        </div>
        <a className="today-block-more" href={pageHref('sol', query)}>Voir le sol</a>
      </div>
      {soil.unavailable ? <p className="today-block-calm">{soil.unavailable}</p> : null}
      {gardens.length > 0 ? (
        <ul className="today-bars">
          {gardens.map((garden) => <SoilBar key={garden.plotId} garden={garden} href={pageHref('sol', query, garden.anchor)} />)}
        </ul>
      ) : null}
      {soil.moreLabel ? (
        <button type="button" className="today-more" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Voir moins' : soil.moreLabel}
        </button>
      ) : null}
      {soil.unavailable ? null : <p className="today-legend">Part de la réserve facilement utilisable, estimée planche par planche.</p>}
      <BlockFootLink href={pageHref('sol', query)} label="Voir le sol" />
    </section>
  );
}

function SoilBar({ garden, href }: { garden: SoilGarden; href: string }) {
  return (
    <li>
      <a className="today-bar-row" data-kind="soil" href={href}>
        <span className="today-bar-name" aria-hidden="true">{garden.name}</span>
        <span className="today-soil-bar" aria-hidden="true" data-unknown={garden.barPercent === null || undefined}>
          {garden.barPercent === null ? null : <i style={{ width: `${garden.barPercent}%` }} />}
        </span>
        <span className="today-bar-text" aria-hidden="true">{garden.text}</span>
        {garden.lowestText ? <span className="today-bar-note" aria-hidden="true">{garden.lowestText}</span> : null}
        <span className="sr-only">{garden.label}</span>
      </a>
    </li>
  );
}

/**
 * « Eau disponible » : une cuve dessinée par réserve, remplie à son niveau ;
 * un relevé de plus de sept jours ou jamais saisi la grise. Une barre par
 * prélèvement limité. Les phrases du bloc restent pour un lecteur d'écran :
 * chacune est le nom du lien de sa cuve ou de sa ressource (L2).
 */
export function TodayWaterBlockView({ block, query }: { block: WaterBlock; query: PageQuery }) {
  return (
    <section className="today-block" id="today-water" data-tour="aujourdhui-eau" data-kind="water" data-empty={block.empty !== null} aria-labelledby="today-water-title">
      <div className="today-block-heading">
        <span className="today-block-badge" data-tone="water"><Icon name="cuve" /></span>
        <div>
          <h2 id="today-water-title">Eau disponible</h2>
          <p className="today-block-sub">{block.empty ?? 'Réserves et prélèvements limités'}</p>
        </div>
        <a className="today-block-more" href={pageHref('ressources', query)}>Ressources et pompes</a>
      </div>
      {block.reservoirs.length > 0 ? (
        <ul className="today-tanks">
          {block.reservoirs.map((reservoir) => (
            <li key={reservoir.id}>
              <a className="today-tank-row" href={pageHref('ressources', query, reservoir.anchor)} data-stale={reservoir.stale} data-below-minimum={reservoir.belowMinimumText !== null}>
                <span className="today-tank" aria-hidden="true">{reservoir.fillPercent === null ? null : <i style={{ height: `${reservoir.fillPercent}%` }} />}</span>
                <span className="today-tank-text" aria-hidden="true">
                  <b>{reservoir.name}</b>
                  <span className="today-tank-volume">{reservoir.volumeText ?? 'volume inconnu'} <small>{reservoir.capacityText}</small></span>
                  {reservoir.belowMinimumText ? <span className="today-tank-minimum">{reservoir.belowMinimumText}</span> : null}
                  <span className="today-tank-age">{reservoir.observedText}</span>
                </span>
                <span className="sr-only">{reservoir.label}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {block.limits.map((limit) => (
        <a key={limit.id} className="today-limit" href={pageHref('ressources', query, limit.anchor)}>
          <span className="today-limit-top" aria-hidden="true"><b>{limit.name}</b><span>{limit.text}</span></span>
          <span className="today-limit-bar" aria-hidden="true"><i style={{ width: `${limit.takenPercent}%` }} /></span>
          <span className="today-limit-bottom" aria-hidden="true">{limit.takenText}</span>
          <span className="sr-only">{limit.label}</span>
        </a>
      ))}
      <BlockFootLink href={pageHref('ressources', query)} label="Ressources et pompes" />
    </section>
  );
}
