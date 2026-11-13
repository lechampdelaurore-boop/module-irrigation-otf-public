import type { Metadata } from 'next';
import { getAuthenticatedUser, signOutPath } from '@/app/access-auth';
import { menuPages, NOT_FOUND_LABEL, notFoundReturnLink, type IrrigationPageId } from '@/lib/domain/features/pages';
import { logJsonLine } from '@/lib/adapters/log';
import { getFeatureSelectionForUser } from '@/lib/services/feature-selection-service';
import { isDemoDeployment } from '@/lib/services/deployment-mode';
import { demoSelectionOfOwner } from '@/lib/domain/demo/catalogue';
import { DemoBanner } from './irrigation/shell/demo-banner';
import { FeatureMenu } from './irrigation/shell/feature-menu';
import { Topbar } from './irrigation/shell/topbar';
import './irrigation/irrigation.css';

export const metadata: Metadata = { title: NOT_FOUND_LABEL };

/**
 * La page introuvable (audit ergonomique, point 7, 3.8 quater) : en français,
 * avec l'en-tête et le menu du module quand la session est lue, et un lien qui
 * ramène à la page d'arrivée (« Aujourd'hui » quand elle existe, lot 2, F1).
 * Rien n'est lu d'Ouvre ta ferme ; si la ferme ne peut pas être lue, la page
 * reste utile, sans menu. La pastille de « Aujourd'hui » se lit après
 * l'affichage, sans Ouvre ta ferme non plus.
 */
export default async function NotFound() {
  const farm = await readFarm();
  const back = notFoundReturnLink(farm ? { firstVisit: farm.firstVisit, enabled: farm.enabled } : null);
  const content = (
    <section className="not-found-state" aria-labelledby="not-found-title">
      <p className="eyebrow">Erreur 404</p>
      <h1 id="not-found-title">{NOT_FOUND_LABEL}</h1>
      <p>Cette adresse ne correspond à aucune page du module. Elle a peut-être été mal tapée, ou la page a changé de nom. Aucune donnée n’a été modifiée.</p>
      <a className="primary-link" href={back.href}>{back.label}</a>
    </section>
  );

  const demo = isDemoDeployment();
  if (!farm) return <main className="app-shell">{demo ? <DemoBanner /> : null}{content}</main>;
  return (
    <main className="app-shell">
      <Topbar userName={farm.userName} signOutPath={signOutPath()} demo={demo} demoSelection={demo ? demoSelectionOfOwner(farm.userId) : null} />
      <div className="feature-layout">
        {farm.menu.length > 0 ? <FeatureMenu menu={farm.menu} current={null} query={{}} /> : null}
        <div className="feature-page">{content}</div>
      </div>
    </main>
  );
}

type FarmForNotFound = {
  userId: string;
  userName: string;
  firstVisit: boolean;
  enabled: Awaited<ReturnType<typeof getFeatureSelectionForUser>>['enabled'];
  menu: IrrigationPageId[];
};

async function readFarm(): Promise<FarmForNotFound | null> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return null;
    const selection = await getFeatureSelectionForUser(user.userId);
    return {
      userId: user.userId,
      userName: user.displayName,
      firstVisit: selection.firstVisit,
      enabled: selection.enabled,
      menu: selection.firstVisit ? [] : menuPages(selection.enabled),
    };
  } catch (error) {
    logJsonLine('warn', { event: 'not_found_farm_unreadable', message: error instanceof Error ? error.message : 'erreur inconnue' });
    return null;
  }
}
