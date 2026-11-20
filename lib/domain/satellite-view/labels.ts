/**
 * Les noms des jardins sur la vue satellite (audit du 19 novembre 2026,
 * lot K, n° 16, F468) : là où les jardins sont serrés, un nom qui en
 * chevaucherait un autre devient le numéro du jardin, celui de la liste à
 * côté de la carte, qui sert de légende. Le calcul se fait sur les
 * rectangles affichés, en pixels ; il se refait à chaque zoom.
 */

export interface LabelBox {
  /** Le centre du nom, en pixels de la carte. */
  x: number;
  y: number;
  /** La taille du nom entier. */
  width: number;
  height: number;
  /** La largeur de la pastille du numéro. */
  shortWidth: number;
}

interface Rect { left: number; top: number; right: number; bottom: number }

/** Deux pixels d'air entre deux noms : collés, ils se lisent comme un seul. */
const GAP = 2;

function rect(x: number, y: number, width: number, height: number): Rect {
  return { left: x - width / 2, top: y - height / 2, right: x + width / 2, bottom: y + height / 2 };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right + GAP && b.left < a.right + GAP && a.top < b.bottom + GAP && b.top < a.bottom + GAP;
}

/**
 * Pour chaque nom, dans l'ordre de la liste : `true` s'il devient un numéro.
 * Un nom garde sa place s'il ne chevauche aucun de ceux déjà posés ; sinon,
 * son numéro prend la place, plus petite, et les suivants l'évitent aussi.
 */
export function shortenedLabels(boxes: readonly LabelBox[]): boolean[] {
  const placed: Rect[] = [];
  return boxes.map((box) => {
    const full = rect(box.x, box.y, box.width, box.height);
    if (!placed.some((other) => overlaps(full, other))) {
      placed.push(full);
      return false;
    }
    placed.push(rect(box.x, box.y, box.shortWidth, box.height));
    return true;
  });
}
