import type { Metadata } from 'next';
import { pageLabel, type IrrigationPageId } from '@/lib/domain/features/pages';

/**
 * Le titre de l'onglet de chaque page (audit ergonomique, point 7, 3.8
 * quater) : le nom de la page, que le gabarit du module complète en
 * « Planning de la semaine · Irrigation » (`app/layout.tsx`).
 */
export function pageMetadata(page: IrrigationPageId): Metadata {
  return { title: pageLabel(page) };
}

/** La première ouverture, où la ferme choisit ses fonctionnalités (R5). */
export const WELCOME_TITLE = 'Choisissez vos fonctionnalités';
