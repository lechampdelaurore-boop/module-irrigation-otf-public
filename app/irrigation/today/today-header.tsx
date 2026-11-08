'use client';

import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import type { TodayHeadline } from '@/lib/domain/today/headline';
import type { TodayPlanLine } from '@/lib/domain/today/today-view';
import { Icon, type IconName } from '../line-icon';

type Chip = TodayHeadline['chips'][number];

/** Les icônes des pastilles, au trait de la charte. */
const CHIP_ICONS: Record<Chip['icon'], IconName> = {
  clock: 'horloge',
  drop: 'goutte',
  frost: 'flocon',
  bell: 'cloche',
  cloud: 'nuage',
  check: 'coche',
  shield: 'bouclier',
};

/** Le bloc où mène une pastille : son ancre sur la page. */
const CHIP_TARGETS: Record<Chip['target'], string> = {
  day: '#today-day',
  weather: '#today-weather',
  reliability: '#today-reliability',
};

/**
 * L'en-tête du tableau de bord (docs/aujourdhui-tableau-de-bord-contract.md,
 * sections 3.2 et 3.5) : « Tableau de bord », la date en toutes lettres, la
 * ligne du dernier calcul du plan, la phrase qui résume le jour et les
 * pastilles qui mènent chacune à son bloc. Elles ne disent que ce que disent
 * les blocs présents.
 */
export function TodayHeader({ headline, plan, query, pending, onRecalculatePlan }: {
  headline: TodayHeadline;
  plan: TodayPlanLine | null;
  query: PageQuery;
  pending: boolean;
  onRecalculatePlan: () => void;
}) {
  return (
    <header className="today-head">
      <div className="today-head-main">
        <p className="today-eyebrow">Tableau de bord</p>
        <h2 className="today-date">{headline.title}</h2>
        {plan ? (
          <div className="today-plan-row">
            <Icon name={plan.linkToPlanning ? 'calendrier' : 'coche'} />
            <p className="today-plan">
              {plan.linkToPlanning ? <a href={pageHref('planning', query)}>{plan.text}</a> : plan.text}
            </p>
            {plan.linkToPlanning ? null : (
              <button type="button" className="today-plan-recalculate" aria-label="Recalculer le plan" disabled={pending} onClick={onRecalculatePlan}>
                {pending ? 'Calcul en cours…' : 'Recalculer'}
              </button>
            )}
          </div>
        ) : null}
      </div>
      {headline.chips.length > 0 ? (
        <nav className="today-chips" aria-label="Résumé du jour">
          {headline.chips.map((chip) => (
            <a key={chip.key} className="today-chip" data-tone={chip.tone} href={CHIP_TARGETS[chip.target]}>
              <span className="today-chip-dot"><Icon name={CHIP_ICONS[chip.icon]} /></span>
              {chip.text}
            </a>
          ))}
        </nav>
      ) : null}
      <p className="today-sentence">{headline.sentence}</p>
    </header>
  );
}
