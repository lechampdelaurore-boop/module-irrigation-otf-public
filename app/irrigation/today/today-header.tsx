'use client';

import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import type { TodayShortage } from '@/lib/domain/today/ahead';
import type { TodayHeadline } from '@/lib/domain/today/headline';
import type { TodayPlanLine } from '@/lib/domain/today/today-view';
import { Icon, type IconName } from '../line-icon';
import { ActionReply, type ActionReplyMessage } from '../shell/action-reply';
import { PLAN_HEADER_REPLY, TODAY_REPLY_CLASSES } from './today-replies';

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
  calendar: 'calendrier',
};

/** Le bloc où mène une pastille : son ancre sur la page. */
const CHIP_TARGETS: Record<Chip['target'], string> = {
  day: '#today-day',
  weather: '#today-weather',
  reliability: '#today-reliability',
  shortage: '#today-shortage',
};

/**
 * L'en-tête du tableau de bord (docs/aujourdhui-tableau-de-bord-contract.md,
 * sections 3.2 et 3.5) : la date en toutes lettres sous le titre de la page
 * (audit final, lot A, J13, F285), la
 * ligne du dernier calcul du plan, la phrase qui résume le jour et les
 * pastilles qui mènent chacune à son bloc. Elles ne disent que ce que disent
 * les blocs présents. Quand l'eau manque à la semaine, un encadré redit la
 * phrase du planning et son lien « Répartir l'eau » (audit ergonomique final,
 * lot A, R1, F276).
 */
export function TodayHeader({ headline, plan, shortage, query, pending, replies = [], onRecalculatePlan }: {
  headline: TodayHeadline;
  plan: TodayPlanLine | null;
  shortage: TodayShortage | null;
  query: PageQuery;
  pending: boolean;
  /** La réponse de « Recalculer », sous la ligne du plan (6 nonies, L4, D-313). */
  replies?: readonly ActionReplyMessage[];
  onRecalculatePlan: () => void;
}) {
  return (
    <header className="today-head">
      <div className="today-head-main">
        {/* Un seul titre, celui de la page ; la date en sous-titre (audit final, lot A, J13, F285). */}
        <p className="today-date">{headline.title}</p>
        {plan ? (
          <div className="today-plan-row">
            <Icon name={plan.linkToPlanning ? 'calendrier' : 'coche'} />
            <p className="today-plan">
              {/* Le plan, calculé ou non, mène au planning de la semaine (6 nonies, L3, D-312) : la ligne n'existe que « Planning » coché. */}
              <a href={pageHref('planning', query)}>{plan.text}</a>
            </p>
            {plan.linkToPlanning ? null : (
              <button type="button" className="today-plan-recalculate" aria-label="Recalculer le plan" disabled={pending} onClick={onRecalculatePlan}>
                {pending ? 'Calcul en cours…' : 'Recalculer'}
              </button>
            )}
          </div>
        ) : null}
        <ActionReply messages={replies} origin={PLAN_HEADER_REPLY} classNames={TODAY_REPLY_CLASSES} />
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
      {shortage ? (
        <p className="today-shortage" id="today-shortage" role="note">
          <span>{shortage.sentence}</span>
          {shortage.link ? <a href={pageHref(shortage.link.page, query, shortage.link.anchor)}>{shortage.link.label}</a> : null}
        </p>
      ) : null}
      {headline.sentence ? <p className="today-sentence">{headline.sentence}</p> : null}
    </header>
  );
}
