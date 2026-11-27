import type { Metadata } from 'next';
import { pageLabel, type IrrigationPageId } from '@/lib/domain/features/pages';
import { WELCOME_HEADING } from '@/lib/domain/features/start';

/**
 * Le titre de l'onglet de chaque page (audit ergonomique, point 7, 3.8
 * quater) : le nom de la page, que le gabarit du module complète en
 * « Planning de la semaine · Irrigation » (`app/layout.tsx`).
 */
export function pageMetadata(page: IrrigationPageId): Metadata {
  return { title: pageLabel(page) };
}

/** La première ouverture, où la ferme choisit comment commencer (R5 ; simplification, lot S6, section 3). */
export const WELCOME_TITLE = WELCOME_HEADING;
