import type { Metadata } from 'next';
import { browserClockScript } from '@/lib/domain/demo/browser-clock';
import { PAGE_TITLE_TEMPLATE } from '@/lib/domain/features/pages';
import { currentSimulatedOffsetMs } from '@/lib/services/demo-clock';
import './globals.css';

export const metadata: Metadata = {
  // Chaque page du module donne son nom à l'onglet (audit ergonomique, point 7) ;
  // une adresse sans titre propre garde celui du module.
  title: { default: 'Irrigation · Ouvre ta ferme', template: PAGE_TITLE_TEMPLATE },
  description:
    "Module de suivi et d'aide à l'irrigation connecté à Ouvre ta ferme.",
  manifest: '/manifest.webmanifest',
  themeColor: '#0f6849',
  openGraph: {
    title: 'Irrigation · Ouvre ta ferme',
    description:
      'Parcourez vos saisons, parcelles, jardins et planches en lecture seule.',
    locale: 'fr_FR',
    type: 'website',
    images: [
      {
        url: '/irrigation-social-card.png',
        width: 1200,
        height: 630,
        alt: 'Planches maraîchères et lignes d’irrigation vues du ciel',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // En démonstration seulement, le navigateur lit le jour du moment, comme le
  // serveur (docs/demo-guided-contract.md, F160) ; ailleurs, aucun script.
  const offset = currentSimulatedOffsetMs();
  return (
    <html lang="fr">
      {offset === null ? null : (
        <head>
          <script dangerouslySetInnerHTML={{ __html: browserClockScript(offset) }} />
        </head>
      )}
      <body>{children}</body>
    </html>
  );
}
