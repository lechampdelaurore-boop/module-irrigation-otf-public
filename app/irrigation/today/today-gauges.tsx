'use client';

import { useState } from 'react';
import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
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
 */

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
        <a className="today-block-more" href={pageHref('besoins', query)}>Objectifs et besoins</a>
      </div>
      <ul className="today-bars">
        <WeekBar row={week.farm} total />
        {rows.map((row) => <WeekBar key={row.key} row={row} />)}
      </ul>
      {week.moreLabel ? (
        <button type="button" className="today-more" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Voir moins' : week.moreLabel}
        </button>
      ) : null}
      <p className="today-legend" aria-hidden="true">
        <span><i data-tone="irrigation" />Irrigation</span>
        <span><i data-tone="rain" />Pluie mesurée</span>
        <span><i data-tone="goal" />Objectif</span>
        <span>Échelle : 0 à {week.scaleMaxMm} mm</span>
      </p>
    </section>
  );
}

function WeekBar({ row, total = false }: { row: WeekRow; total?: boolean }) {
  return (
    <li className="today-bar-row" data-total={total || undefined}>
      <span className="today-bar-name">{row.name}</span>
      <span className="today-bar" role="img" aria-label={`${row.name} : ${row.text}`} data-unknown={row.rainMm === null || undefined}>
        <i data-tone="irrigation" style={{ width: `${row.bars.irrigationPercent}%` }} />
        <i data-tone="rain" style={{ width: `${row.bars.rainPercent}%` }} />
        {row.bars.objectivePercent === null ? null : <b style={{ left: `${row.bars.objectivePercent}%` }} />}
      </span>
      <span className="today-bar-text">{row.text}</span>
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
          {gardens.map((garden) => <SoilBar key={garden.plotId} garden={garden} />)}
        </ul>
      ) : null}
      {soil.moreLabel ? (
        <button type="button" className="today-more" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Voir moins' : soil.moreLabel}
        </button>
      ) : null}
      {soil.unavailable ? null : <p className="today-legend">Part de la réserve facilement utilisable, estimée planche par planche.</p>}
    </section>
  );
}

function SoilBar({ garden }: { garden: SoilGarden }) {
  return (
    <li className="today-bar-row" data-kind="soil">
      <span className="today-bar-name">{garden.name}</span>
      <span className="today-soil-bar" role="img" aria-label={`${garden.name} : ${garden.text}${garden.lowestText ? `, ${garden.lowestText}` : ''}`} data-unknown={garden.barPercent === null || undefined}>
        {garden.barPercent === null ? null : <i style={{ width: `${garden.barPercent}%` }} />}
      </span>
      <span className="today-bar-text">{garden.text}</span>
      {garden.lowestText ? <span className="today-bar-note">{garden.lowestText}</span> : null}
    </li>
  );
}

/**
 * « Eau disponible » : une cuve dessinée par réserve, remplie à son niveau ;
 * un relevé de plus de sept jours ou jamais saisi la grise. Une barre par
 * prélèvement limité. Les phrases du bloc restent pour un lecteur d'écran.
 */
export function TodayWaterBlockView({ block }: { block: WaterBlock }) {
  return (
    <section className="today-block" id="today-water" data-kind="water" data-empty={block.empty !== null} aria-labelledby="today-water-title">
      <div className="today-block-heading">
        <span className="today-block-badge" data-tone="water"><Icon name="cuve" /></span>
        <div>
          <h2 id="today-water-title">Eau disponible</h2>
          <p className="today-block-sub">{block.empty ?? 'Réserves et prélèvements limités'}</p>
        </div>
      </div>
      {block.reservoirs.length > 0 ? (
        <ul className="today-tanks" aria-hidden="true">
          {block.reservoirs.map((reservoir) => (
            <li key={reservoir.id} className="today-tank-row" data-stale={reservoir.stale}>
              <span className="today-tank">{reservoir.fillPercent === null ? null : <i style={{ height: `${reservoir.fillPercent}%` }} />}</span>
              <span className="today-tank-text">
                <b>{reservoir.name}</b>
                <span className="today-tank-volume">{reservoir.volumeText ?? 'volume inconnu'} <small>{reservoir.capacityText}</small></span>
                <span className="today-tank-age">{reservoir.observedText}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {block.limits.map((limit) => (
        <div key={limit.id} className="today-limit" aria-hidden="true">
          <p className="today-limit-top"><b>{limit.name}</b><span>{limit.text}</span></p>
          <span className="today-limit-bar"><i style={{ width: `${limit.takenPercent}%` }} /></span>
          <p className="today-limit-bottom">{limit.takenText}</p>
        </div>
      ))}
      {block.lines.length > 0 ? (
        <ul className="sr-only">
          {block.lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}
    </section>
  );
}
