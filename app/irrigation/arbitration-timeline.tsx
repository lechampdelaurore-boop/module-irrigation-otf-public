'use client';

import { ARBITRATION_WEEKS_AFTER, ARBITRATION_WEEKS_BEFORE, type ArbitrationTimelineCrop } from '@/lib/domain/arbitration-crops';
import { addDaysToDateKey } from '@/lib/domain/water-management';
import { weekKeyFromDateKey } from '@/lib/domain/week-keys';

/**
 * La frise des cultures d'une planche sur l'écran d'arbitrage
 * (docs/shortage-contract.md, 2 bis, point 3) : dix-huit semaines à
 * l'ordinateur, huit au téléphone, où la feuille de style ne montre que les
 * trois semaines d'avant et les quatre d'après. La semaine en cours est
 * marquée ; la récolte hachurée ; une culture prévue en pointillé.
 */

const FIRST = -ARBITRATION_WEEKS_BEFORE;
const LAST = ARBITRATION_WEEKS_AFTER;
const WEEKS = LAST - FIRST + 1;
const at = (weeks: number) => `${(weeks / WEEKS * 100).toFixed(4)}%`;
const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });

export function ArbitrationTimeline({ crops }: { crops: readonly ArbitrationTimelineCrop[] | null }) {
  if (crops === null) return <div className="arbitration-timeline is-empty" aria-hidden="true" />;
  const label = crops.length ? crops.map((crop) => crop.title).join(' ; ') : 'Aucune culture sur ces semaines';
  return <div className="arbitration-timeline" role="img" aria-label={label}>
    <div className="arbitration-track">
      <span className="arbitration-now" style={{ left: at(-FIRST), width: at(1) }} />
      {crops.map((crop, index) => {
        const start = Math.max(crop.startWeek, FIRST);
        const end = Math.min(crop.endWeek ?? LAST, LAST);
        if (end < start) return null;
        const span = end - start + 1;
        const harvest = crop.harvestWeek === null || crop.harvestWeek > end ? null : (Math.max(crop.harvestWeek, start) - start) / span * 100;
        const classes = ['arbitration-crop', `tone-${crop.tone}`, crop.planned ? 'is-planned' : '', crop.startWeek < FIRST ? 'is-cut-start' : '', (crop.endWeek ?? Infinity) > LAST ? 'is-cut-end' : ''];
        return <span key={`${crop.label}:${crop.startWeek}:${index}`} className={classes.filter(Boolean).join(' ')} style={{ left: at(start - FIRST), width: at(span) }} title={crop.title}>
          {harvest === null ? null : <span className="arbitration-harvest" style={{ left: `${harvest.toFixed(4)}%` }} />}
          <span className="arbitration-crop-name">{crop.planned ? `prévu : ${crop.label}` : crop.label}</span>
        </span>;
      })}
    </div>
  </div>;
}

/**
 * Les numéros de semaine au-dessus des frises d'un jardin, et le mois quand il
 * change. Une semaine sur deux, comptée depuis la semaine en cours, perd son
 * numéro quand la frise est étroite (la feuille de style en décide).
 */
export function ArbitrationTimelineHeader({ weekStart }: { weekStart: string }) {
  const weeks = Array.from({ length: WEEKS }, (_, index) => {
    const monday = addDaysToDateKey(weekStart, (FIRST + index) * 7);
    const previous = addDaysToDateKey(monday, -7);
    return { offset: FIRST + index, number: Number(weekKeyFromDateKey(monday).slice(-2)), month: index === 0 || monday.slice(5, 7) !== previous.slice(5, 7) ? monthName.format(new Date(`${monday}T12:00:00Z`)) : null };
  });
  return <div className="arbitration-timeline is-header" aria-hidden="true">
    <div className="arbitration-track">
      {weeks.map((week) => <span key={week.offset} className={`arbitration-week-number${week.offset === 0 ? ' is-now' : ''}${week.offset % 2 !== 0 ? ' is-odd' : ''}`} style={{ left: at(week.offset - FIRST), width: at(1) }}>
        {week.month ? <em>{week.month}</em> : null}<span>{week.number}</span>
      </span>)}
    </div>
  </div>;
}
