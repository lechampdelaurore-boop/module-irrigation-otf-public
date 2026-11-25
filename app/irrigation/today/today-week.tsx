'use client';

import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import type { TodayTileLink, TodayWeek } from '@/lib/domain/today/week';
import { Icon, type IconName } from '../line-icon';
import { SIMPLE_WORDS } from '@/lib/domain/simple-words';

/**
 * « La semaine » (docs/aujourdhui-tableau-de-bord-contract.md, section 3.2,
 * précision T4) : quatre tuiles pour la ferme entière, comme les lit
 * « Objectifs et besoins » pour la semaine en cours. Une valeur inconnue se
 * dit inconnue, jamais zéro (D-003) ; l'eau utilisée n'a de tuile que si le
 * tableau de l'eau existe. Un objectif posé sur une partie des planches se
 * chiffre sur elles, et chaque tuile le dit (audit final, lot A, R2, F280).
 *
 * Chaque tuile entière mène à son menu, le mot d'action écrit en bas
 * (docs/aujourdhui-liens-contract.md, L1, D-310) : le mot et la cible
 * viennent du domaine ; le lien n'enregistre rien (D-028).
 */
export function TodayWeekTiles({ week, query }: { week: TodayWeek; query: PageQuery }) {
  const { tiles, links } = week;
  // Une quantité, pas une alerte : la couleur neutre des autres tuiles (lot H, n° 13, F440).
  const remainingTone = week.farm.remainingMm === null ? 'unknown' : week.farm.remainingMm > 0 ? 'green' : 'ok';
  const href = (link: TodayTileLink) => pageHref(link.page, query, link.anchor);
  return (
    <section className="today-kpis" aria-label="Cette semaine">
      <Tile tone="green" icon="calendrier" label={SIMPLE_WORDS.weekGoal} value={tiles.objective ?? 'aucun objectif posé'} detail={tiles.objectiveDetail} link={links.objective} href={href(links.objective)} />
      <Tile tone="water" icon="goutte" label="Eau reçue" value={tiles.received ?? 'inconnue'} detail={tiles.receivedDetail ?? ''} link={links.received} href={href(links.received)} />
      <Tile
        tone={remainingTone}
        icon={remainingTone === 'ok' ? 'coche' : 'horloge'}
        label={SIMPLE_WORDS.stillMissing}
        value={tiles.remaining ?? 'inconnu'}
        detail={tiles.remainingDetail}
        link={links.remaining}
        href={href(links.remaining)}
      />
      {tiles.water ? <Tile tone="water" icon="cuve" label="Eau utilisée" value={tiles.water} detail={tiles.waterToday ?? ''} link={links.water} href={href(links.water)} /> : null}
    </section>
  );
}

/**
 * Une tuile, lien entier : le nom lu par un lecteur d'écran est le titre, le
 * chiffre, le détail, puis le mot d'action (section 3, règle 2).
 */
function Tile({ tone, icon, label, value, detail, link, href }: {
  tone: 'green' | 'water' | 'warn' | 'ok' | 'unknown';
  icon: IconName;
  label: string;
  value: string;
  detail: string;
  link: TodayTileLink;
  href: string;
}) {
  return (
    <a className="today-kpi" data-tone={tone} href={href}>
      <span className="today-kpi-label"><Icon name={icon} />{label}</span>
      <strong className="today-kpi-value">{value}</strong>
      {detail ? <span className="today-kpi-detail">{detail}</span> : null}
      <span className="today-kpi-action"><ActionWords label={link.label} /></span>
    </a>
  );
}

/** Le dernier mot et le chevron ne se séparent jamais : au téléphone, le chevron ne passe pas seul à la ligne. */
function ActionWords({ label }: { label: string }) {
  const cut = label.lastIndexOf(' ');
  return <>{label.slice(0, cut + 1)}<span className="today-kpi-action-end">{label.slice(cut + 1)}<Icon name="chevron" /></span></>;
}
