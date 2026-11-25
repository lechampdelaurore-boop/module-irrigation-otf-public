import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';

/**
 * Le journal des modifications se relit sans recharger la page
 * (amélioration n° 7, docs/ameliorations-6-2-3-7-contract.md, §5.5, F746 ;
 * D-294 ; écart E1 de la recette du 22 novembre 2026). Chaque action
 * serveur que la page « Réglages » peut appeler est rangée ici : elle
 * prévient la section du journal quand elle a réussi, elle recharge la page,
 * ou elle n'écrit pas au journal, avec sa raison. Le test relit le code de
 * la page et de tout ce qu'elle affiche : une action nouvelle, absente de
 * la liste, le fait échouer, comme l'inventaire des écrivains (F717).
 */

const ROOT = resolve(import.meta.dirname, '..');
const PAGE = 'app/irrigation/reglages/page.tsx';
const SIGNAL = 'notifyChangeJournalChanged(';

type Rangement =
  | { kind: 'previent'; file: string }
  | { kind: 'recharge'; file: string }
  | { kind: 'hors-journal'; reason: string };

/** Le geste qui écrit au journal le dit à la section, dans ce fichier. */
const previent = (file: string): Rangement => ({ kind: 'previent', file });
/** Le geste recharge la page, qui relit tout, journal compris. */
const recharge = (file: string): Rangement => ({ kind: 'recharge', file });
/** Le geste n'écrit pas au journal (§5.1) : rien à relire. */
const horsJournal = (reason: string): Rangement => ({ kind: 'hors-journal', reason });

const NOTIFICATIONS = 'app/irrigation/reglages/notification-settings.tsx';
const WATER = 'app/irrigation/water-management-dashboard.tsx';
// Toutes les actions de la correspondance des espèces et du besoin par culture passent par le `run` du panneau.
const CROP_PANEL = 'app/irrigation/crop-water/crop-coefficients-panel.tsx';
const SHELTERS = 'app/irrigation/reglages/plot-shelter-settings.tsx';

const RANGEMENT: Readonly<Record<string, Rangement>> = {
  // Les messages de la ferme (n° 2 et 3).
  saveMorningMessageAction: previent(NOTIFICATIONS),
  saveEveningReminderAction: previent(NOTIFICATIONS),
  // Les heures de silence (6 undecies, H3).
  saveQuietHoursAction: previent(NOTIFICATIONS),
  // Le lieu de la météo, et les parts du tableau de l'eau affichées ailleurs (objectif, limite d'eau du jour).
  saveWeatherLocationAction: previent(WATER),
  restoreOtfWeatherLocationAction: previent(WATER),
  saveHydricGoalAction: previent(WATER),
  clearHydricGoalsAction: previent(WATER),
  // Le réglage « Objectif automatique » (6 decies, O4, D-319) : un geste au journal, comme un objectif.
  saveAutomaticObjectiveAction: previent(WATER),
  saveDailyWaterLimitAction: previent(WATER),
  // La correspondance des espèces, et le besoin par culture du même panneau.
  saveSpeciesCorrespondenceAction: previent(CROP_PANEL),
  deleteSpeciesCorrespondenceAction: previent(CROP_PANEL),
  linkProposedSpeciesAction: previent(CROP_PANEL),
  addKcOverrideAction: previent(CROP_PANEL),
  saveFarmDurationsAction: previent(CROP_PANEL),
  resetFarmDurationsAction: previent(CROP_PANEL),
  saveRootingProfileAction: previent(CROP_PANEL),
  saveSensitiveStagesAction: previent(CROP_PANEL),
  addShelterFactorAction: previent(CROP_PANEL),
  saveBedMulchAction: previent(CROP_PANEL),
  addShadeNetAction: previent(CROP_PANEL),
  removeShadeNetAction: previent(CROP_PANEL),
  saveCropWaterOptionsAction: previent(CROP_PANEL),
  // Les parcelles et les abris (4.4).
  savePlotShelterAction: previent(SHELTERS),
  confirmRemainingProposalsAction: previent(SHELTERS),
  // Rechargent la page.
  saveFeatureSelectionAction: recharge('app/irrigation/reglages/feature-settings.tsx'),
  requestFarmErasureAction: recharge('app/irrigation/reglages/farm-erasure-settings.tsx'),
  resetDemoSpaceAction: recharge('app/irrigation/shell/demo-reset.tsx'),
  // N'écrivent pas au journal.
  loadChangeJournalPageAction: horsJournal('La lecture du journal lui-même : elle relit, elle n’écrit rien.'),
  loadWaterDashboardAction: horsJournal('La lecture du tableau de l’eau ; l’actualisation de la météo est une synchronisation, hors du journal (§5.1).'),
  searchWeatherLocationsAction: horsJournal('La recherche d’une commune : une lecture, rien n’est enregistré avant le choix.'),
  saveManualRainfallAction: horsJournal('Une pluie mesurée est une observation, pas un réglage : hors du journal (§5.1).'),
  removeManualRainfallAction: horsJournal('Le retrait d’une pluie mesurée : une observation, pas un réglage, hors du journal (§5.1).'),
  confirmSpeciesStepAction: horsJournal('L’étape « Cultures » de l’accueil confirmée : l’avancement de l’accueil est hors du journal (4.4).'),
  answerSettingsGroupAction: horsJournal('« Réglages à relire » : l’avancement de l’accueil (4.4), hors du journal ; aucun réglage ne change.'),
  dismissFeatureBannerAction: horsJournal('Le bandeau des fonctionnalités fermé : ni case cochée ni décochée, sans objet au journal.'),
  readTodayBadgeAction: horsJournal('La pastille de « Aujourd’hui » : une lecture, rien n’est enregistré.'),
  cancelFarmErasureAction: horsJournal('L’effacement de la ferme annulé : un acte sur l’espace entier, hors du journal (4.5).'),
  getIrrigationPushConfigurationAction: horsJournal('La configuration des notifications de l’appareil : une lecture.'),
  registerIrrigationPushSubscriptionAction: horsJournal('L’abonnement d’un appareil aux notifications : propre à l’appareil, pas un réglage de la ferme.'),
  unregisterIrrigationPushSubscriptionAction: horsJournal('Le désabonnement d’un appareil : propre à l’appareil, pas un réglage de la ferme.'),
};

/** Un chemin d'import du module, résolu vers son fichier ; `null` hors du dépôt (React, Next…). */
function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/') ? resolve(ROOT, specifier.slice(2))
    : specifier.startsWith('.') ? resolve(dirname(from), specifier)
      : null;
  if (base === null) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const IMPORT = /^import\s+(type\s+)?([\s\S]*?)\s+from\s+'([^']+)';/gm;

/** Les actions serveur que la page peut appeler, et les fichiers qui les importent. */
function actionsOfPage(): Map<string, Set<string>> {
  const actions = new Map<string, Set<string>>();
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const [, typeOnly, clause, specifier] of source.matchAll(IMPORT)) {
      if (typeOnly) continue;
      const target = resolveImport(file, specifier);
      if (target === null || !relative(ROOT, target).startsWith('app/')) continue;
      if (/^\s*'use server';/.test(readFileSync(target, 'utf8'))) {
        const names = (/\{([\s\S]*)\}/.exec(clause)?.[1] ?? '').split(',').map((name) => name.trim()).filter((name) => name !== '' && !name.startsWith('type '));
        for (const name of names) actions.set(name, (actions.get(name) ?? new Set()).add(relative(ROOT, file)));
        continue;
      }
      visit(target);
    }
  };
  visit(resolve(ROOT, PAGE));
  return actions;
}

const actions = actionsOfPage();

test('chaque action serveur que « Réglages » peut appeler est rangée, et la liste ne nomme que des actions réelles', () => {
  const found = [...actions.keys()].sort();
  const listed = Object.keys(RANGEMENT).sort();
  assert.ok(found.includes('saveMorningMessageAction'), 'le relevé voit les actions des composants de la page');
  assert.ok(found.includes('addShadeNetAction'), 'le relevé suit les composants jusqu’au bout');
  assert.deepEqual(found.filter((name) => !listed.includes(name)), [], 'une action de « Réglages » à ranger : elle prévient le journal, recharge la page, ou n’écrit pas au journal');
  assert.deepEqual(listed.filter((name) => !found.includes(name)), [], 'une action rangée que « Réglages » n’appelle plus');
});

test('une action qui écrit au journal le dit à la section ; une action qui recharge la page la recharge', () => {
  for (const [name, rangement] of Object.entries(RANGEMENT)) {
    if (rangement.kind === 'hors-journal') {
      assert.ok(rangement.reason.trim().length > 40, `${name} : hors du journal avec sa raison`);
      continue;
    }
    const source = readFileSync(resolve(ROOT, rangement.file), 'utf8');
    if (rangement.kind === 'previent') assert.ok(source.includes(SIGNAL), `${name} : ${rangement.file} prévient le journal (${SIGNAL})`);
    else assert.match(source, /window\.location\.(assign|reload)\(/, `${name} : ${rangement.file} recharge la page`);
  }
});
