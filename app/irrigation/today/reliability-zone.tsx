'use client';

import { useState } from 'react';
import { RELIABILITY_HELP } from '@/lib/domain/features/help';
import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import type { ReliabilityCheck, ReliabilityLine, ReliabilityZone } from '@/lib/domain/today/reliability';
import { Icon, type IconName } from '../line-icon';
import { useSectionHelp } from '../shell/section-help';

const RELIABILITY_TITLE = 'Fiabilité du calcul';

/** L'écart entre deux parts de l'anneau, en centièmes de son tour. */
const RING_GAP = 2;

const CHECK_ICONS: Record<ReliabilityCheck['kind'], IconName> = {
  'reservoir-volume': 'cuve',
  'actual-rain': 'pluie',
  soil: 'jauge',
  species: 'pousse',
  plan: 'calendrier',
};

/**
 * La zone « Fiabilité du calcul » (audit ergonomique, point 3, F5, F8, F27 ;
 * tableau de bord, docs/aujourdhui-tableau-de-bord-contract.md, section 3.2,
 * précision T6) : un anneau d'une part par donnée suivie, verte à jour,
 * ambrée à rafraîchir, et la liste des données, les à-jour cochées. Chaque
 * manque garde sa phrase, sa conséquence et le bouton qui corrige la donnée ;
 * au-delà de cinq manques, les autres derrière « Voir les n autres » (F38).
 * Le « ? » écrit chaque seuil.
 */
export function ReliabilityZoneView({
  zone,
  checks,
  query,
  pending,
  onRecalculatePlan,
}: {
  zone: ReliabilityZone;
  checks: readonly ReliabilityCheck[];
  query: PageQuery;
  pending: boolean;
  onRecalculatePlan: () => void;
}) {
  const help = useSectionHelp(RELIABILITY_TITLE, RELIABILITY_HELP);
  const [showAll, setShowAll] = useState(false);
  const visible = new Set((showAll ? [...zone.shown, ...zone.hidden] : zone.shown).map((line) => line.key));
  const upToDate = checks.filter((check) => check.ok).length;

  return (
    <section className="today-block" id="today-reliability" data-kind="reliability" data-empty={zone.allClear !== null} aria-labelledby="today-reliability-title">
      <div className="today-block-heading">
        <span className="today-block-badge"><Icon name="bouclier" /></span>
        <div>
          <h2 id="today-reliability-title">{RELIABILITY_TITLE}</h2>
          <p className="today-block-sub">{zone.allClear ?? 'Ce que le plan sait de votre ferme'}</p>
        </div>
        {help.toggle}
      </div>
      {help.panel}
      <div className="reliability-board">
        <Ring checks={checks} upToDate={upToDate} />
        <ul className="reliability-checks">
          {checks.map((check) => {
            const lines = check.lines.filter((line) => visible.has(line.key));
            return (
              <li key={check.kind} className="reliability-check" data-ok={check.ok}>
                <span className="reliability-mark"><Icon name={check.ok ? 'coche' : CHECK_ICONS[check.kind]} /></span>
                <div className="reliability-check-text">
                  {/* Un manque montré dit lui-même sa phrase : le résumé ne reste que pour ce qui est à jour ou replié. */}
                  <p><b>{check.label}</b>{lines.length > 0 ? null : check.summary}</p>
                  {lines.length > 0 ? (
                    <ul className="reliability-lines">
                      {lines.map((line) => (
                        <li key={line.key} className="reliability-line" data-reliability={line.kind}>
                          <p className="reliability-line-text">{line.text}</p>
                          <ReliabilityAction line={line} query={query} pending={pending} onRecalculatePlan={onRecalculatePlan} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {zone.moreLabel ? (
        <button type="button" className="today-more" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Voir moins' : zone.moreLabel}
        </button>
      ) : null}
    </section>
  );
}

/** L'anneau : une part par donnée suivie, dessinée sur un tour de cent. */
function Ring({ checks, upToDate }: { checks: readonly ReliabilityCheck[]; upToDate: number }) {
  const part = checks.length === 0 ? 0 : 100 / checks.length;
  return (
    <div className="reliability-ring" role="img" aria-label={`${upToDate} sur ${checks.length} à jour`}>
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        {checks.map((check, index) => (
          <circle
            key={check.kind}
            cx="60"
            cy="60"
            r="48"
            pathLength={100}
            data-ok={check.ok}
            strokeDasharray={`${Math.max(0, part - RING_GAP)} ${100 - Math.max(0, part - RING_GAP)}`}
            strokeDashoffset={-index * part}
          />
        ))}
      </svg>
      <span className="reliability-ring-count"><strong>{upToDate}/{checks.length}</strong><span>à jour</span></span>
    </div>
  );
}

function ReliabilityAction({ line, query, pending, onRecalculatePlan }: {
  line: ReliabilityLine;
  query: PageQuery;
  pending: boolean;
  onRecalculatePlan: () => void;
}) {
  const action = line.action;
  if (action.kind === 'recalculate-plan') {
    return (
      <button type="button" className="primary" disabled={pending} onClick={onRecalculatePlan}>
        {pending ? 'Calcul en cours…' : action.label}
      </button>
    );
  }
  return <a className="today-action-link" href={pageHref(action.page, query, action.anchor ?? undefined)}>{action.label}</a>;
}
