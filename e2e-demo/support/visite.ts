import { expect, type Page } from '@playwright/test';
import { ciblesTropPetites, textesPeuContrastes } from '../../e2e/support/accessibilite.ts';
import { surveillerLaConsole, verifierLEtape, type JournalDeConsole } from '../../e2e/support/parcours.ts';

/**
 * Outils des parcours de la démonstration (docs/demo-guided-contract.md,
 * sections 7 et 9 ; D3). Chaque étape vérifie ce que le contrat promet : la
 * bulle dit l'étape, l'élément présenté est souligné, le focus est sur le
 * titre de la bulle, la page ne déborde pas, la console reste propre, et la
 * visite n'a rien envoyé au serveur à la place du visiteur.
 */

/** L'adresse du serveur des parcours de la démonstration (playwright.demo.config.ts). */
const ADRESSE_DE_LA_DEMO = 'http://127.0.0.1:3200';

export type Visite = { journal: JournalDeConsole; envois: string[] };

/**
 * Ouvre la démonstration pour une ferme fictive et un moment (les témoins
 * que la bannière poserait). Toute requête qui écrit (POST, action serveur
 * autre qu'une lecture) est notée : une visite guidée ne doit jamais en faire.
 */
export async function ouvrirLaDemo(page: Page, profil: string, moment: string, chemin = '/irrigation'): Promise<Visite> {
  const journal = surveillerLaConsole(page);
  const envois: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'GET' || request.method() === 'HEAD') return;
    // Une page lit certaines données après l'affichage par une action serveur de lecture
    // (la pastille d'« Aujourd'hui ») : son nom le dit, en développement. Toute autre écrit.
    const action = request.headers()['next-action'] ?? '';
    if (/#(read|load)[A-Z]\w*Action$/.test(action)) return;
    envois.push(`${request.method()} ${request.url()} ${action}`.trim());
  });
  await page.context().addCookies([
    { name: 'demo-profil', value: profil, url: ADRESSE_DE_LA_DEMO },
    { name: 'demo-moment', value: moment, url: ADRESSE_DE_LA_DEMO },
  ]);
  await page.goto(chemin);
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  return { journal, envois };
}

const bulle = (page: Page) => page.locator('.tour-bubble');

/** L'invitation de la première ouverture : on la laisse pour plus tard. */
export async function ecarterLInvitation(page: Page): Promise<void> {
  await expect(bulle(page).getByRole('heading', { name: 'Découvrir la démonstration' })).toBeVisible();
  await bulle(page).getByRole('button', { name: 'Plus tard' }).click();
  await expect(bulle(page)).toHaveCount(0);
}

/** Ouvre la liste par le bouton de la bannière et lance une visite. */
export async function commencerLaVisite(page: Page, titre: string): Promise<void> {
  const bouton = page.getByRole('button', { name: 'Visites guidées' });
  await bouton.click();
  const liste = page.getByRole('dialog', { name: 'Visites guidées' });
  await expect(liste).toBeVisible();
  await liste.getByRole('button', { name: titre }).click();
}

export type EtapeAttendue = {
  /** Le titre de la bulle. */
  titre: string;
  /** « étape n sur N ». */
  rang: string;
  /** Le repère `data-tour` souligné ; absent pour une bulle au milieu. */
  ancre?: string;
  /** La page où l'étape se joue. */
  chemin: string;
};

/** L'étape montrée est celle attendue, et tient ses promesses (section 9). */
export async function verifierLEtapeDeVisite(page: Page, visite: Visite, attendue: EtapeAttendue): Promise<void> {
  const titre = bulle(page).getByRole('heading', { level: 2 });
  await expect(titre).toHaveText(attendue.titre);
  await expect(bulle(page).locator('.tour-progress')).toContainText(attendue.rang);
  await expect(page).toHaveURL(new RegExp(`${attendue.chemin}(\\?|$)`));
  // L'étape arrive par l'adresse d'une page à l'autre ; l'adresse ne la garde pas.
  expect(page.url()).not.toContain('visite=');
  await expect(titre).toBeFocused();
  await expect(bulle(page)).toHaveAttribute('role', 'dialog');
  await expect(page.locator('[aria-live="polite"]', { hasText: attendue.titre })).toHaveCount(1);
  const soulignes = page.locator('[data-tour-active="true"]');
  if (attendue.ancre) {
    await expect(soulignes).toHaveCount(1);
    await expect(soulignes).toHaveAttribute('data-tour', attendue.ancre);
  } else {
    await expect(soulignes).toHaveCount(0);
  }
  // La bulle tient dans l'écran, et au téléphone ne cache pas la barre des pages.
  const boite = await bulle(page).boundingBox();
  const fenetre = page.viewportSize()!;
  expect(boite).not.toBeNull();
  expect(boite!.x).toBeGreaterThanOrEqual(0);
  expect(boite!.x + boite!.width).toBeLessThanOrEqual(fenetre.width);
  expect(boite!.y).toBeGreaterThanOrEqual(0);
  expect(boite!.y + boite!.height).toBeLessThanOrEqual(fenetre.height);
  const barre = (await page.locator('nav.phone-bar').count()) > 0 ? await page.locator('nav.phone-bar').boundingBox() : null;
  if (barre && barre.height > 0) expect(boite!.y + boite!.height, 'la bulle cache la barre des pages').toBeLessThanOrEqual(barre.y);
  await verifierLEtape(page, visite.journal, `visite, ${attendue.titre}`);
  expect(visite.envois, 'la visite a écrit à la place du visiteur').toEqual([]);
}

/** « Suivant », ou « Terminer » à la dernière étape. */
export async function etapeSuivante(page: Page, bouton: 'Suivant' | 'Terminer' = 'Suivant'): Promise<void> {
  await bulle(page).getByRole('button', { name: bouton, exact: true }).click();
}

/** Joue une visite entière, étape par étape, jusqu'à « Terminer ». */
export async function jouerLaVisite(page: Page, visite: Visite, etapes: readonly EtapeAttendue[]): Promise<void> {
  for (const [index, etape] of etapes.entries()) {
    await verifierLEtapeDeVisite(page, visite, etape);
    await etapeSuivante(page, index === etapes.length - 1 ? 'Terminer' : 'Suivant');
  }
  await expect(bulle(page)).toHaveCount(0);
  // Le focus revient au bouton qui a lancé la visite.
  await expect(page.getByRole('button', { name: 'Visites guidées' })).toBeFocused();
}

/** Les cibles de 44 px et les contrastes de 4,5:1 (section 9), mesurés dans la bulle ou la liste. */
export async function verifierLAccessibiliteDe(page: Page, racine: string): Promise<void> {
  expect(await ciblesTropPetites(page, 44, racine)).toEqual([]);
  expect(await textesPeuContrastes(page, racine)).toEqual([]);
}
