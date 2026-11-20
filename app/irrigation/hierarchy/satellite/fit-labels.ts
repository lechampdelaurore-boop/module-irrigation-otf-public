import { shortenedLabels } from '@/lib/domain/satellite-view/labels';

/** La pastille d'un numéro est au moins aussi large que haute. */
const MIN_SHORT_WIDTH = 24;

/**
 * Pose les noms des jardins de la carte ou du dessin (audit du 19 novembre
 * 2026, lot K, n° 16, F468) : chaque nom remis entier, mesuré, puis ceux qui
 * en chevaucheraient un autre remplacés par leur numéro, celui de la liste à
 * côté. Un nom caché (onglet fermé) n'est ni mesuré ni changé.
 */
export function fitGardenLabels(root: HTMLElement): void {
  const labels = Array.from(root.querySelectorAll<HTMLElement>('.satellite-label[data-number]'));
  for (const label of labels) {
    label.textContent = label.dataset.name ?? label.textContent;
    label.dataset.short = 'false';
  }
  const shown = labels
    .map((label) => ({ label, box: label.getBoundingClientRect() }))
    .filter(({ box }) => box.width > 0 && box.height > 0);
  const shortened = shortenedLabels(shown.map(({ box }) => ({
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    width: box.width,
    height: box.height,
    shortWidth: Math.max(box.height, MIN_SHORT_WIDTH),
  })));
  shown.forEach(({ label }, index) => {
    if (!shortened[index]) return;
    label.textContent = label.dataset.number ?? '';
    label.dataset.short = 'true';
  });
}
