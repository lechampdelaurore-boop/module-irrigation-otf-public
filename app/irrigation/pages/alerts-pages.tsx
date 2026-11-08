'use client';

import { useState, type ReactNode } from 'react';
import type { WaterDashboard } from '@/lib/services/water-dashboard';
import { CropAlertsPanel } from '../crop-alerts-panel';
import { WeatherAlertsPanel } from '../weather-alerts-panel';

/**
 * Les pages « Alertes météo » et « Alertes cultures » (3.8,
 * docs/feature-selection-contract.md, section 5) : l'encart et ses réglages,
 * tels qu'ils étaient sous le tableau de l'eau de la semaine. Leurs actions
 * rendent ce tableau ; la page en garde l'encart.
 */
export function WeatherAlertsPage({ season, initialDashboard, cropAlertsHref }: {
  season: number;
  initialDashboard: WaterDashboard;
  /** La page « Alertes cultures » quand elle est cochée, `null` sinon (précision P43). */
  cropAlertsHref: string | null;
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  if (!dashboard.weatherAlerts) return null;
  return <WeatherAlertsPanel season={season} weekStart={dashboard.weekStart} view={dashboard.weatherAlerts} cropAlertsHref={cropAlertsHref} onDashboard={setDashboard} />;
}

export function CropAlertsPage({ season, initialDashboard, sprinklerUnavailable }: {
  season: number;
  initialDashboard: WaterDashboard;
  /** La ligne qui remplace les aspersions à reconsidérer sans le planning (P1), ou `null`. */
  sprinklerUnavailable: ReactNode;
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  if (!dashboard.cropAlerts) return null;
  return <CropAlertsPanel season={season} weekStart={dashboard.weekStart} view={dashboard.cropAlerts} onDashboard={setDashboard} sprinklerUnavailable={sprinklerUnavailable} />;
}
