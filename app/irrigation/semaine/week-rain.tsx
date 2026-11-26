'use client';

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';
import { MEASURED_RAIN_ANCHOR } from '@/lib/domain/today/reliability';
import type { RainEntry } from '@/lib/domain/today/rain-entry';
import { RainEntryDialog } from '../rain-entry-dialog';
import { ActionReply, actionReply, type ActionReplyMessage } from '../shell/action-reply';
import { readRainEntryAction } from '../water-actions';
import { notifyRainNoted } from './week-signals';

/**
 * « Noter la pluie » sur la page « Semaine » (simplification, lot S4, PR 3,
 * docs/simplification-s4-contract.md, section 8.3) : la fenêtre de S2,
 * appelée, pas refaite (`RainEntryDialog`, `rain-entry.ts`). Trois entrées :
 * le lien du bilan, la ligne « Calcul approximatif », la ligne d'un jour
 * passé dont la pluie manque, qui choisit ce jour. Les jours proposés et les
 * mesures déjà notées se lisent à l'ouverture (`readRainEntryAction`, comme
 * le « + »), jamais avec la page. Après l'enregistrement, que le serveur a
 * dit, la réponse s'écrit sous le geste qui a ouvert la fenêtre, et la
 * semaine se relit (le tableau de l'eau, les besoins, le plan recalculé).
 * « Retirer la mesure » et un jour plus ancien restent dans « Pluie
 * mesurée » du détail (`manual-rain`), où mène le lien de la fenêtre.
 */

export type WeekRain = {
  /** Ouvre la fenêtre ; `date` : le jour d'une ligne, s'il est proposé. */
  open: (origin: string, date?: string) => void;
  pending: boolean;
  /** La réponse du geste, écrite sous lui. */
  reply: (origin: string) => ReactNode;
};

const WeekRainContext = createContext<WeekRain | null>(null);

/** Le geste de la page, ou `null` quand la pluie ne compte pas pour la ferme (toute sous abri, D-032). */
export function useWeekRain(): WeekRain | null {
  return useContext(WeekRainContext);
}

const REPLY_CLASSES = { notice: 'week-rain-reply', warning: 'week-rain-reply', error: 'planning-error' } as const;

export function WeekRainProvider({ planning, rainMatters, children }: {
  /** « Le plan se recalcule » ne se dit que « Planning » coché. */
  planning: boolean;
  rainMatters: boolean;
  children: ReactNode;
}) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ entry: RainEntry; season: number } | null>(null);
  const [shown, setShown] = useState(false);
  const [replies, setReplies] = useState<ActionReplyMessage[]>([]);
  const [pending, startTransition] = useTransition();

  const open = (from: string, date?: string) => {
    if (pending) return;
    setOrigin(from);
    setReplies([]);
    startTransition(async () => {
      const result = await readRainEntryAction();
      if (!result.ok) {
        setReplies([actionReply(from, 'error', result.message)]);
        return;
      }
      // Le jour de la ligne, quand la fenêtre le propose ; sinon son jour par défaut, hier.
      const defaultDate = date && result.entry.days.some((day) => day.date === date) ? date : result.entry.defaultDate;
      setOpened({ entry: { ...result.entry, defaultDate }, season: result.season });
      setShown(true);
    });
  };

  const saved = (text: string) => {
    setShown(false);
    setReplies([actionReply(origin ?? 'bilan', 'notice', text)]);
    notifyRainNoted();
  };

  const value: WeekRain | null = rainMatters ? {
    open,
    pending,
    reply: (from: string) => <ActionReply messages={replies} origin={from} classNames={REPLY_CLASSES} />,
  } : null;

  return (
    <WeekRainContext.Provider value={value}>
      {children}
      {rainMatters && opened ? (
        <RainEntryDialog
          // Une fenêtre neuve à chaque lecture : le jour choisi par la ligne devient son jour par défaut.
          key={`${opened.entry.defaultDate}:${opened.entry.days.map((day) => day.measuredMm ?? '').join(',')}`}
          open={shown}
          entry={opened.entry}
          season={opened.season}
          planning={planning}
          besoinsHref={`#${MEASURED_RAIN_ANCHOR}`}
          besoinsLabel="dans « Pluie mesurée », plus bas"
          onClose={() => setShown(false)}
          onSaved={saved}
        />
      ) : null}
    </WeekRainContext.Provider>
  );
}
