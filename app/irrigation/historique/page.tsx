import { redirectToWeekPage, type IrrigationSearchParams } from '../page-context';
import { UnavailableState } from '../shell/unavailable-state';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('historique');

/**
 * L'ancienne adresse de « Historique et cumuls » (simplification, lot S4,
 * docs/simplification-s4-contract.md, section 3.3, précision S4-o) : elle
 * mène à la page « Semaine », avec ses paramètres et son ancre, et n'est
 * jamais retirée. Ne s'affiche ici que l'écran d'une personne qui n'entre
 * pas dans son espace.
 */
export default async function HistoriquePage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  return <UnavailableState {...await redirectToWeekPage('historique', searchParams)} />;
}
