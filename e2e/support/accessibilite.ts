import type { Page } from '@playwright/test';

/**
 * Les mesures d'accessibilité du parcours P31c (audit ergonomique, lot 3,
 * point 14, docs/audit-ergonomie-lot3-contract.md, section 5, cas 13,
 * précisions F49 et F69 à F71) : la hauteur de chaque cible et le contraste
 * de chaque texte, mesurés dans la page telle que le navigateur la peint.
 * Elles disent ce qui échoue, avec le nom de l'élément, pour que la
 * correction se trouve sans rejouer le parcours.
 */

export type CibleMesuree = { cible: string; hauteur: number };
export type TexteMesure = { texte: string; ratio: number; couleur: string; fond: string; taille: number };

/**
 * Les cibles visibles de moins de 44 px de haut, hors liens pris dans une phrase (exception du WCAG 2.5.5).
 * `racine` : où chercher ; `main` par défaut, la bulle d'une visite guidée (posée hors de `main`) sinon.
 */
export async function ciblesTropPetites(page: Page, minimum = 44, racine = 'main'): Promise<CibleMesuree[]> {
  return page.evaluate(({ min, racine }) => {
    const selecteur = [
      'a[href]', 'button', 'select', 'textarea', 'summary', '[role="tab"]', '[role="menuitem"]',
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"])',
      'label:has(> input[type="checkbox"]), label:has(> input[type="radio"])',
    ].join(', ');
    const nom = (element: Element) => {
      const etiquette = element.closest('label')?.innerText ?? element.getAttribute('placeholder') ?? '';
      const texte = (element.getAttribute('aria-label') ?? ((element as HTMLElement).innerText || etiquette)).replace(/\s+/g, ' ').trim();
      const classe = element.getAttribute('class')?.split(' ')[0] ?? element.parentElement?.getAttribute('class')?.split(' ')[0];
      return `${element.tagName.toLowerCase()}${classe ? `.${classe}` : ''} « ${texte.slice(0, 60)} »`;
    };
    // Une zone invisible posée par un pseudo-élément agrandit la cible sans grandir le dessin (cloche et initiale, F22).
    const hauteurTouchee = (element: Element, hauteur: number) => {
      const zone = getComputedStyle(element, '::after');
      if (zone.content === 'none' || zone.position !== 'absolute') return hauteur;
      const etendue = Number.parseFloat(zone.height);
      return Number.isFinite(etendue) ? Math.max(hauteur, etendue) : hauteur;
    };
    const dansUnePhrase = (element: Element) => element.tagName === 'A'
      && getComputedStyle(element).display === 'inline'
      && element.parentElement !== null
      && ['P', 'LI', 'SMALL', 'SPAN', 'TD', 'DD', 'LABEL', 'EM', 'STRONG'].includes(element.parentElement.tagName);
    const mesures: { cible: string; hauteur: number }[] = [];
    for (const element of document.querySelectorAll(`${racine} ${selecteur.split(', ').join(`, ${racine} `)}`)) {
      if (!(element as HTMLElement).checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      if (element.closest('[aria-hidden="true"], .skip-link')) continue;
      if (dansUnePhrase(element)) continue;
      const boite = element.getBoundingClientRect();
      if (boite.width === 0 || boite.height === 0) continue;
      const hauteur = Math.round(hauteurTouchee(element, boite.height));
      if (hauteur < min) mesures.push({ cible: nom(element), hauteur });
    }
    return mesures;
  }, { min: minimum, racine });
}

/** Les textes visibles dont le contraste est sous 4,5:1 (3:1 pour un grand texte), fond calculé par superposition. */
export async function textesPeuContrastes(page: Page, racine = 'main'): Promise<TexteMesure[]> {
  return page.evaluate((racine) => {
    type Rgba = [number, number, number, number];
    const lire = (valeur: string): Rgba | null => {
      const trouve = valeur.match(/rgba?\(([^)]+)\)/);
      if (!trouve) return null;
      const parts = trouve[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    };
    const sur = (dessus: Rgba, dessous: Rgba): Rgba => {
      const a = dessus[3] + dessous[3] * (1 - dessus[3]);
      if (a === 0) return [0, 0, 0, 0];
      return [0, 1, 2].map((i) => (dessus[i] * dessus[3] + dessous[i] * dessous[3] * (1 - dessus[3])) / a).concat(a) as Rgba;
    };
    const lineaire = (canal: number) => {
      const c = canal / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (c: Rgba) => 0.2126 * lineaire(c[0]) + 0.7152 * lineaire(c[1]) + 0.0722 * lineaire(c[2]);
    const fondDe = (element: Element): Rgba => {
      const couches: Rgba[] = [];
      for (let courant: Element | null = element; courant; courant = courant.parentElement) {
        const fond = lire(getComputedStyle(courant).backgroundColor);
        if (fond && fond[3] > 0) {
          couches.push(fond);
          if (fond[3] >= 1) break;
        }
      }
      return couches.reduceRight<Rgba>((dessous, dessus) => sur(dessus, dessous), [255, 255, 255, 1]);
    };
    const opacite = (element: Element) => {
      let produit = 1;
      for (let courant: Element | null = element; courant; courant = courant.parentElement) produit *= Number(getComputedStyle(courant).opacity);
      return produit;
    };
    const hex = (c: Rgba) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
    const mesures: { texte: string; ratio: number; couleur: string; fond: string; taille: number }[] = [];
    const vus = new Set<Element>();
    const marcheur = document.createTreeWalker(document.querySelector(racine) ?? document.body, NodeFilter.SHOW_TEXT);
    for (let noeud = marcheur.nextNode(); noeud; noeud = marcheur.nextNode()) {
      const texte = noeud.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const element = noeud.parentElement;
      if (!texte || !element || vus.has(element)) continue;
      vus.add(element);
      if (!element.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      if (element.closest('svg, [aria-hidden="true"], :disabled, [aria-disabled="true"], .skip-link')) continue;
      const style = getComputedStyle(element);
      const couleur = lire(style.color);
      if (!couleur) continue;
      const fond = fondDe(element);
      const visible = sur([couleur[0], couleur[1], couleur[2], couleur[3] * opacite(element)], fond);
      const clair = Math.max(luminance(visible), luminance(fond));
      const sombre = Math.min(luminance(visible), luminance(fond));
      const ratio = (clair + 0.05) / (sombre + 0.05);
      const taille = Number.parseFloat(style.fontSize);
      const grand = taille >= 24 || (taille >= 18.66 && Number(style.fontWeight) >= 700);
      if (ratio < (grand ? 3 : 4.5)) {
        mesures.push({ texte: texte.slice(0, 60), ratio: Math.round(ratio * 100) / 100, couleur: hex(visible), fond: hex(fond), taille });
      }
    }
    return mesures;
  }, racine);
}
