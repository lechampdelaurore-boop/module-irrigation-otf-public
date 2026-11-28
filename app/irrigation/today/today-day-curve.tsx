'use client';

import { DAY_CURVE_TITLE, type TodayDayCurve } from '@/lib/domain/today/day-curve';
import { Icon } from '../line-icon';
import { useSectionHelp } from '../shell/section-help';

/** Les heures écrites sous la courbe : minuit, 6 h, midi et 18 h ; les autres sont dans l'infobulle. */
const AXIS_HOURS = new Set(['0 h', '6 h', '12 h', '18 h']);

/**
 * « Soif du jour, heure par heure », dans « Le détail » d'« Aujourd'hui »
 * (docs/et0-horaire-contract.md, § 7 ; D-350) : la phrase du reste à venir,
 * la courbe de la journée avec l'heure en cours marquée, les heures de
 * forte évaporation et le « ? » qui dit d'où vient la forme. Une
 * information : aucun bouton, aucun chiffre de calcul ne change.
 */
export function TodayDayCurveBlock({ curve }: { curve: TodayDayCurve }) {
  const help = useSectionHelp(DAY_CURVE_TITLE, curve.help);
  const current = curve.state === 'shown' ? curve.bars.find((bar) => bar.current) : undefined;
  return (
    <section className="today-block" id="today-day-curve" data-kind="day-curve" data-state={curve.state} data-nature={curve.state === 'shown' ? curve.nature : undefined} aria-labelledby="today-day-curve-title">
      <div className="today-block-heading">
        <span className="today-block-badge" data-tone="water"><Icon name="soleil" /></span>
        <div>
          <h2 id="today-day-curve-title">{DAY_CURVE_TITLE}</h2>
          <p className="today-block-sub">À quelle heure la journée consomme</p>
        </div>
        {help.toggle}
      </div>
      {help.panel}
      {curve.state === 'missing' ? (
        <p className="today-block-calm">{curve.text}</p>
      ) : (
        <>
          <p className="today-day-curve-sentence">{curve.sentence}</p>
          <div className="today-day-curve" role="img" aria-label={curve.label}>
            {curve.bars.map((bar, index) => (
              <span key={`${bar.hour}-${index}`} className="today-day-curve-bar" data-current={bar.current || undefined} data-strong={bar.strong || undefined} title={bar.title}>
                <span className="today-day-curve-fill" style={{ height: `${bar.heightPercent}%` }} />
                <span className="today-day-curve-hour" aria-hidden="true">{AXIS_HOURS.has(bar.hour) ? bar.hour : ''}</span>
              </span>
            ))}
          </div>
          <p className="today-day-curve-legend" aria-hidden="true">
            {current ? <span data-key="current">Maintenant, {current.hour}</span> : null}
            {curve.strongest ? <span data-key="strong">Forte évaporation</span> : null}
          </p>
          {curve.strongest ? <p className="today-day-curve-strongest">{curve.strongest}</p> : null}
          {curve.old ? <p className="today-block-calm today-day-curve-old">{curve.old}</p> : null}
        </>
      )}
    </section>
  );
}
