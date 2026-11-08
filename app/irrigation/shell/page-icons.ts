import type { FeatureId } from '@/lib/domain/features/catalogue';
import type { IrrigationPageId } from '@/lib/domain/features/pages';
import type { IconName } from '../line-icon';

/** L'icône au trait de chaque page, dans le menu et dans la liste des cases (charte, section 7). */
export const PAGE_ICONS: Record<IrrigationPageId | FeatureId, IconName> = {
  aujourdhui: 'soleil',
  materiel: 'plan',
  arrosages: 'goutte',
  besoins: 'pluie',
  planning: 'calendrier',
  ressources: 'cuve',
  sol: 'jauge',
  cultures: 'pousse',
  'alertes-meteo': 'cloche',
  'alertes-cultures': 'alerte',
  historique: 'courbe',
  // Une case sans page : son icône ne sert que dans la liste des cases.
  calculateur: 'calcul',
  reglages: 'reglages',
};
