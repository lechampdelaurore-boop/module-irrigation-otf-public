'use client';

import { useState } from 'react';
import { RELIABILITY_HELP } from '@/lib/domain/features/help';
import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import { MISSING_BY_BED_ANCHOR, type MissingByBed } from '@/lib/domain/today/missing-by-bed';
import type { ReliabilityAction as ReliabilityGesture, ReliabilityCheck, ReliabilityLine, ReliabilityZone } from '@/lib/domain/today/reliability';
import { Icon, type IconName } from '../line-icon';
import { ActionReply, type ActionReplyMessage } from '../shell/action-reply';
import { AnchoredFold } from '../shell/page-settings-fold';
import { useSectionHelp } from '../shell/section-help';
import { PLAN_RELIABILITY_REPLY, TODAY_REPLY_CLASSES } from './today-replies';

const RELIABILITY_TITLE = 'Fiabilité du calcul';

/** L'écart entre deux parts de l'anneau, en centièmes de son tour. */
const RING_GAP = 2;

const CHECK_ICONS: Record<ReliabilityCheck['kind'], IconName> = {
  'reservoir-volume': 'cuve',
  'actual-rain': 'pluie',
  'automatic-objective': 'soleil',
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
  byBed,
  query,
  pending,
  replies = [],
  onRecalculatePlan,
}: {
  zone: ReliabilityZone;
  checks: readonly ReliabilityCheck[];
  /** Le dépliant « Par planche » (amélioration n° 6) ; `null` sans ses cases. */
  byBed: MissingByBed | null;
  query: PageQuery;
  pending: boolean;
  /** La réponse de « Recalculer le plan », sous la ligne du plan, qui reste quand le plan est à jour (L4, D-313). */
  replies?: readonly ActionReplyMessage[];
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
                  {/* À jour, la ligne mène à la page où vit sa donnée (6 nonies, L3, D-312). */}
                  {check.link ? (
                    <a className="reliability-check-link" href={pageHref(check.link.page, query, check.link.anchor ?? undefined)}>
                      <b>{check.label}</b>{check.summary}<Icon name="chevron" />
                    </a>
                  ) : <p><b>{check.label}</b>{lines.length > 0 ? null : check.summary}</p>}
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
                  {check.kind === 'plan' ? <ActionReply messages={replies} origin={PLAN_RELIABILITY_REPLY} classNames={TODAY_REPLY_CLASSES} /> : null}
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
      {byBed ? <MissingByBedFold byBed={byBed} query={query} /> : null}
    </section>
  );
}

/**
 * Le dépliant « Par planche » (amélioration n° 6, docs/ameliorations-6-2-3-7-contract.md,
 * section 3, F700, F701, F710 et F711) : les planches qui ont une donnée manquante, par
 * culture puis par planche, chacune avec sa phrase et son geste ; cinq
 * planches d'emblée, les autres derrière « Voir les n autres ». Fermé, il dit
 * le total ; son ancre l'ouvre, depuis la fin de l'accueil (4.4).
 */
function MissingByBedFold({ byBed, query }: { byBed: MissingByBed; query: PageQuery }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <AnchoredFold
      id={MISSING_BY_BED_ANCHOR}
      className="reliability-by-bed"
      summary={<><strong>Par planche</strong><small>{byBed.total ?? byBed.allClear}</small></>}
      bodyClassName="reliability-by-bed-body"
    >
      {byBed.allClear ? <p className="reliability-by-bed-clear">{byBed.allClear}</p> : null}
      {byBed.groups.map((group) => {
        const beds = group.beds.filter((bed) => showAll || !bed.hidden);
        if (beds.length === 0) return null;
        return (
          <section key={group.culture} className="reliability-by-bed-group" aria-label={group.culture}>
            <h3>{group.culture}</h3>
            <ul className="reliability-by-bed-beds">
              {beds.map((bed) => (
                <li key={bed.bedId} className="reliability-by-bed-bed" data-bed={bed.bedId}>
                  <p className="reliability-by-bed-name"><b>{bed.bedName}</b>{bed.plotName ? <small>{bed.plotName}</small> : null}</p>
                  <ul className="reliability-by-bed-lines">
                    {bed.lines.map((line) => (
                      <li key={line.key} className="reliability-by-bed-line" data-missing={line.kind}>
                        <p className="reliability-line-text">{line.text}</p>
                        <GestureLink action={line.action} query={query} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {byBed.moreLabel ? (
        <button type="button" className="today-more" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Voir moins' : byBed.moreLabel}
        </button>
      ) : null}
    </AnchoredFold>
  );
}

/** Le lien d'un geste : la page, sa parcelle quand le formulaire en dépend, et l'ancre du formulaire. */
function GestureLink({ action, query }: { action: Extract<ReliabilityGesture, { kind: 'link' }>; query: PageQuery }) {
  const target = action.zone ? { ...query, zone: action.zone } : query;
  return <a className="today-action-link" href={pageHref(action.page, target, action.anchor ?? undefined)}>{action.label}</a>;
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
  return <GestureLink action={action} query={query} />;
}
