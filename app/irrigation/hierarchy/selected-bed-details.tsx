'use client';
import { formatIrrigationRate, formatMeasure, formatOptionalMeasure } from './presentation';

import type { Bed, Plot } from '@/lib/domain/domain';
import { coverageOrigin, type BedIrrigationCoverage } from '@/lib/domain/irrigation-coverage';
import { FigureOrigin } from '../shell/figure-origin';

export function SelectedBedDetails({
  bed,
  plot,
  coverage,
}: {
  bed: Bed;
  plot: Plot;
  coverage: BedIrrigationCoverage | null;
}) {
  return (
    <section className="selected-bed-details" aria-live="polite">
      <div className="selected-bed-heading">
        <small>{plot.name}</small>
        <strong>Planche {bed.name}</strong>
      </div>
      <dl>
        <div><dt>Longueur</dt><dd>{formatMeasure(bed.length, 'm')}</dd></div>
        <div><dt>Largeur</dt><dd>{formatMeasure(bed.width, 'm', true)}</dd></div>
        <div><dt>Passe-pied</dt><dd>{formatOptionalMeasure(bed.alleyWidth, 'm', true)}</dd></div>
        <div><dt>Surface</dt><dd>{formatMeasure(bed.area, 'm²')}</dd></div>
        <div data-irrigated={Boolean(coverage)}>
          <dt>Apport horaire</dt>
          <dd>{coverage ? formatIrrigationRate(coverage.totalRateMmPerHour) : 'Aucun'}{coverage ? <FigureOrigin text={coverageOrigin(coverage)} /> : null}</dd>
          {coverage ? (
            <small>{coverage.contributions.length} matériel{coverage.contributions.length > 1 ? 's' : ''}</small>
          ) : null}
        </div>
      </dl>
    </section>
  );
}
