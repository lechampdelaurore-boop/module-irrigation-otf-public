import type { Metadata } from 'next';
import { PAGE_TITLE_TEMPLATE } from '@/lib/domain/features/pages';
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
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
