'use client';

import { useState, useTransition } from 'react';
import type { SoilReserveView } from '@/lib/services/soil-reserve-view';
import type { SoilReserveActionResult } from '../soil-reserve-actions';
import { SoilCursorMarks, SoilGaugePart } from './soil-gauge';
import { SoilSettingsPart } from './soil-settings';
import { WaterSurplusBadge } from './water-surplus';

/**
 * Le bloc « Réserve du sol » de la section « Planning de la semaine »
 * (docs/soil-reserve-contract.md, « L'écran », 5 ter, PR 3), avec en tête la
 * pastille de l'eau arrosée en trop. La jauge est une information : elle ne
 * change ni le besoin, ni le plan, ni les priorités (D-047).
 */
export function SoilReserveSection({ initialView }: { initialView: SoilReserveView }) {
  const [view, setView] = useState(initialView);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (operation: () => Promise<SoilReserveActionResult>) => startTransition(async () => {
    const result = await operation();
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) setView(result.view);
  });
  return (
    <section className="soil-reserve" aria-labelledby="soil-reserve-title" aria-busy={pending}>
      {/* Le titre de la page le dit déjà : celui du bloc reste pour les lecteurs d’écran sans niveau sauté (audit du 19 novembre 2026, lot J, n° 18, F456). */}
      <h2 id="soil-reserve-title" className="sr-only">Réserve du sol</h2>
      {/* L'explication fixe, et que la jauge n'est qu'une information (D-041), sont dans le « ? » de la page (simplification S1, F826). */}
      {message ? <p className={message.ok ? 'planning-notice' : 'planning-error'} role={message.ok ? 'status' : 'alert'}>{message.text}</p> : null}
      {view.waterSurplus ? <WaterSurplusBadge surplus={view.waterSurplus} /> : null}
      <SoilCursorMarks />
      {view.gauge ? <SoilGaugePart season={view.season} gauge={view.gauge} pending={pending} run={run} /> : <p className="crop-coefficients-empty">{view.gaugeUnavailable}</p>}
      <SoilSettingsPart season={view.season} view={view.settings} pending={pending} run={run} />
    </section>
  );
}
