'use client';

import type { TodayWeek } from '@/lib/domain/today/week';
import { Icon, type IconName } from '../line-icon';

/**
 * « La semaine » (docs/aujourdhui-tableau-de-bord-contract.md, section 3.2,
 * précision T4) : quatre tuiles pour la ferme entière, comme les lit
 * « Objectifs et besoins » pour la semaine en cours. Une valeur inconnue se
 * dit inconnue, jamais zéro (D-003) ; l'eau utilisée n'a de tuile que si le
 * tableau de l'eau existe. Un objectif posé sur une partie des planches se
 * chiffre sur elles, et chaque tuile le dit (audit final, lot A, R2, F280).
 */
export function TodayWeekTiles({ week }: { week: TodayWeek }) {
  const { tiles } = week;
  // Une quantité, pas une alerte : la couleur neutre des autres tuiles (lot H, n° 13, F440).
  const remainingTone = week.farm.remainingMm === null ? 'unknown' : week.farm.remainingMm > 0 ? 'green' : 'ok';
  return (
    <section className="today-kpis" aria-label="Cette semaine">
      <Tile tone="green" icon="calendrier" label="Objectif de la semaine" value={tiles.objective ?? 'aucun objectif posé'} detail={tiles.objectiveDetail} />
      <Tile tone="water" icon="goutte" label="Eau reçue" value={tiles.received ?? 'inconnue'} detail={tiles.receivedDetail ?? ''} />
      <Tile
        tone={remainingTone}
        icon={remainingTone === 'ok' ? 'coche' : 'horloge'}
        label="Reste à apporter"
        value={tiles.remaining ?? 'inconnu'}
        detail={tiles.remainingDetail}
      />
      {tiles.water ? <Tile tone="water" icon="cuve" label="Eau utilisée" value={tiles.water} detail={tiles.waterToday ?? ''} /> : null}
    </section>
  );
}

function Tile({ tone, icon, label, value, detail }: {
  tone: 'green' | 'water' | 'warn' | 'ok' | 'unknown';
  icon: IconName;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="today-kpi" data-tone={tone}>
      <span className="today-kpi-label"><Icon name={icon} />{label}</span>
      <strong className="today-kpi-value">{value}</strong>
      {detail ? <span className="today-kpi-detail">{detail}</span> : null}
    </div>
  );
}
