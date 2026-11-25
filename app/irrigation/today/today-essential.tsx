'use client';

import type { ReactNode } from 'react';
import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import { APPROXIMATE_TITLE, type TodayApproximate, type TodayWaterAlert, type TodayWeatherAlert, type TodayWeekBar } from '@/lib/domain/today/essential';
import type { TodayUnposedFrost } from '@/lib/domain/today/today-view';
import type { TodayWeatherScale } from '@/lib/domain/today/weather-days';
import { Icon } from '../line-icon';
import { ReliabilityAction } from './reliability-zone';
import { WeatherDay } from './today-weather';

/**
 * Le premier niveau de « Aujourd'hui » (simplification, lot S2, PR 5,
 * docs/simplification-s2-contract.md, section 8) : ce que chaque bloc garde
 * hors du pli « Le détail ». Les mots, les chiffres et les gestes viennent
 * du domaine (`lib/domain/today/essential.ts`) et des blocs existants ; rien
 * ne se décide ici. « + n autres » ouvre le pli sur le bloc entier.
 */

/** « Gel ou chaleur » au premier niveau : le jour en alerte, en carte ; la prévision qui manque ; le gel sans alerte posée (J14). */
export function TodayWeatherAlertView({ alert, unposedFrost, scale, query }: {
  alert: TodayWeatherAlert | null;
  unposedFrost: TodayUnposedFrost | null;
  scale: TodayWeatherScale;
  query: PageQuery;
}) {
  if (!alert && !unposedFrost) return null;
  return (
    <section className="today-block today-essential" id="today-weather-alert" data-kind="weather" data-tone={alert?.days.length ? 'alert' : 'unknown'} aria-labelledby="today-weather-alert-title">
      <h2 id="today-weather-alert-title" className="today-essential-title"><Icon name={alert?.days.length ? 'flocon' : 'nuage'} />Gel ou chaleur</h2>
      {alert && alert.days.length > 0 ? (
        <ul className="today-days">
          {alert.days.map((day) => <WeatherDay key={day.date} day={day} zeroPercent={scale.zeroPercent} query={query} />)}
        </ul>
      ) : null}
      {alert?.unavailable ? <p className="today-essential-warn" role="note">{alert.unavailable}</p> : null}
      {unposedFrost ? (
        <p className="today-unposed-frost" role="note">
          <span>{unposedFrost.text}</span>
          <a href={pageHref(unposedFrost.link.page, query, unposedFrost.link.anchor)}>{unposedFrost.link.label}</a>
        </p>
      ) : null}
    </section>
  );
}

/**
 * « La semaine » : une barre pour la ferme, la phrase de l'objectif de S1,
 * l'eau reçue et ce qui manque ; « Voir la semaine » et « Noter la pluie ».
 * Sans objectif : la phrase et « Poser un objectif ».
 */
export function TodayWeekBarView({ bar, query, pending, onOpenRain, reply }: {
  bar: TodayWeekBar;
  query: PageQuery;
  pending: boolean;
  /** Ouvre « Noter la pluie » ; absent : pas de bouton (toute sous abri, ou sans « Objectifs et besoins »). */
  onOpenRain?: () => void;
  reply: ReactNode;
}) {
  return (
    <section className="today-block today-essential" id="today-week" data-kind="week" aria-labelledby="today-week-title">
      <h2 id="today-week-title" className="today-essential-title"><Icon name="pluie" />La semaine</h2>
      <p className="today-week-sentence">{bar.sentence}</p>
      {bar.kind === 'bar' ? (
        <>
          <span className="today-bar today-week-bar" aria-hidden="true">
            <i data-tone="irrigation" style={{ width: `${bar.bars.irrigationPercent}%` }} />
            <i data-tone="rain" style={{ width: `${bar.bars.rainPercent}%` }} />
            {bar.bars.objectivePercent === null ? null : <b style={{ left: `${bar.bars.objectivePercent}%` }} />}
          </span>
          {bar.detail ? <p className="today-week-detail">{bar.detail}</p> : null}
        </>
      ) : null}
      <div className="today-essential-actions">
        <a className="today-action-link" href={pageHref(bar.link.page, query, bar.link.anchor)}>{bar.link.label}</a>
        {onOpenRain ? <button type="button" disabled={pending} onClick={onOpenRain}>Noter la pluie</button> : null}
      </div>
      {reply}
    </section>
  );
}

/** Une seule ligne « Calcul approximatif » : la première donnée qui manque, son geste, et « + n autres » vers « Fiabilité du calcul ». */
export function TodayApproximateView({ approximate, query, pending, onRecalculatePlan, onOpenRain, onReveal }: {
  approximate: TodayApproximate;
  query: PageQuery;
  pending: boolean;
  onRecalculatePlan: () => void;
  onOpenRain?: () => void;
  onReveal: (id: string) => void;
}) {
  return (
    <section className="today-essential-line" id="today-approximate" data-tone="warn" aria-labelledby="today-approximate-title">
      <p className="today-essential-line-text">
        <strong id="today-approximate-title">{APPROXIMATE_TITLE}</strong> {approximate.line.text}
      </p>
      <div className="today-essential-actions">
        <ReliabilityAction line={approximate.line} query={query} pending={pending} onRecalculatePlan={onRecalculatePlan} onOpenRain={onOpenRain} />
        {approximate.othersLabel ? <RevealLink id="today-reliability" label={approximate.othersLabel} onReveal={onReveal} /> : null}
      </div>
    </section>
  );
}

/** La ligne d'eau, seulement quand elle dit quelque chose (S2-h) : la réserve ou la limite à regarder, sa page. */
export function TodayWaterAlertView({ alert, query, onReveal }: { alert: TodayWaterAlert; query: PageQuery; onReveal: (id: string) => void }) {
  return (
    <section className="today-essential-line" id="today-water-alert" data-tone="water" aria-label="Eau disponible">
      <p className="today-essential-line-text"><Icon name="cuve" /><a href={pageHref('ressources', query, alert.anchor)}>{alert.label}</a></p>
      {alert.othersLabel ? <div className="today-essential-actions"><RevealLink id="today-water" label={alert.othersLabel} onReveal={onReveal} /></div> : null}
    </section>
  );
}

/** Un lien qui ouvre « Le détail » sur un bloc : l'ancre reste l'adresse, le pli s'ouvre même quand l'adresse la porte déjà. */
function RevealLink({ id, label, onReveal, className = 'today-action-link' }: { id: string; label: string; onReveal: (id: string) => void; className?: string }) {
  return (
    <a
      className={className}
      href={`#${id}`}
      onClick={(event) => {
        event.preventDefault();
        onReveal(id);
      }}
    >
      {label}
    </a>
  );
}
