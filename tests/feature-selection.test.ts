import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FEATURES,
  FEATURES_BEFORE_SELECTION,
  FEATURE_IDS,
  PAGE_FEATURE_IDS,
  featureLabel,
  isFeatureId,
  isPageFeatureId,
  type FeatureId,
} from '../lib/domain/features/catalogue';
import {
  checkFeature,
  featuresBroughtBy,
  featuresRequiring,
  firstEnabledFeature,
  isCompleteSelection,
  isEnabled,
  normalizeSelection,
  resolveFeatureSelection,
  selectionChangeCancelsIrrigationAlarms,
  selectionChangeRecalculatesPlan,
  uncheckFeature,
  withRequirements,
} from '../lib/domain/features/selection';
import {
  featurePart,
  isPartActive,
  usesPushNotifications,
  usesSpeciesCorrespondence,
  usesWeather,
} from '../lib/domain/features/socle';
import { uncheckWarning } from '../lib/domain/features/warnings';
import {
  ABSENT_FEATURE_NOTICE,
  isIrrigationPageId,
  legacyRedirect,
  menuPages,
  pageAccess,
  pageFromPathname,
  pageHref,
  pagePath,
  WELCOME_PATH,
} from '../lib/domain/features/pages';
import {
  checkConfirmation,
  featureBannerText,
  featureChoiceLine,
  featureChoiceRows,
  joinLabels,
} from '../lib/domain/features/choice';

// docs/feature-selection-contract.md, sections 2 à 5 (3.8, D-067).

test('les onze cases, dans l’ordre de la liste et sous les noms validés par le porteur', () => {
  assert.deepEqual(FEATURES.map((feature) => feature.label), [
    'Arrosages',
    'Planning de la semaine',
    'Objectifs et besoins',
    'Réserve du sol',
    'Besoin par culture',
    'Matériel et placement',
    'Calculateur d’irrigation',
    'Ressources et pompes',
    'Alertes météo',
    'Alertes cultures',
    'Historique et cumuls',
  ]);
  assert.deepEqual(FEATURES.map((feature) => feature.id), [...FEATURE_IDS]);
  assert.deepEqual([...FEATURES_BEFORE_SELECTION], FEATURE_IDS.filter((id) => id !== 'calculateur'),
    'les fermes d’avant la 3.8 ont les dix cases d’alors ; le calculateur (3.8 bis) arrive décoché (R7)');
  assert.deepEqual([...PAGE_FEATURE_IDS], FEATURE_IDS.filter((id) => id !== 'calculateur'), 'le calculateur n’a pas de page à lui');
  assert.ok(!isPageFeatureId('calculateur'));
  assert.ok(isPageFeatureId('materiel'));
  assert.equal(featureLabel('sol'), 'Réserve du sol');
  assert.ok(isFeatureId('planning'));
  assert.ok(isFeatureId('calculateur'), 'le calculateur est une case depuis la 3.8 bis');
  assert.ok(!isFeatureId(3));
  for (const feature of FEATURES) assert.ok(feature.summary.length > 20, `${feature.id} a sa ligne d’explication`);
});

test('cocher une case entraîne, de proche en proche, les cases dont elle a besoin (section 2)', () => {
  const expected: Record<FeatureId, FeatureId[]> = {
    materiel: ['materiel'],
    calculateur: ['materiel', 'calculateur'],
    arrosages: ['arrosages', 'materiel'],
    besoins: ['arrosages', 'besoins', 'materiel'],
    planning: ['arrosages', 'planning', 'besoins', 'materiel'],
    ressources: ['arrosages', 'materiel', 'ressources'],
    sol: ['arrosages', 'besoins', 'sol', 'cultures', 'materiel'],
    cultures: ['arrosages', 'besoins', 'cultures', 'materiel'],
    'alertes-meteo': ['alertes-meteo'],
    'alertes-cultures': ['alertes-cultures'],
    historique: ['arrosages', 'materiel', 'historique'],
  };
  for (const id of FEATURE_IDS) assert.deepEqual(withRequirements([id]), expected[id], id);
  assert.deepEqual(checkFeature(['alertes-meteo'], 'planning'), ['arrosages', 'planning', 'besoins', 'materiel', 'alertes-meteo']);
  assert.deepEqual(featuresBroughtBy(['materiel'], 'planning'), ['arrosages', 'besoins'], 'chaque case entraînée se dit « nécessaire pour … »');
  assert.deepEqual(featuresBroughtBy(['materiel', 'arrosages'], 'historique'), []);
});

test('une case nécessaire à une case cochée ne se décoche pas ; on décoche d’abord celle qui en a besoin (R3)', () => {
  const selection = withRequirements(['planning', 'historique']);
  assert.deepEqual(featuresRequiring(selection, 'arrosages'), ['planning', 'besoins', 'historique']);
  assert.deepEqual(uncheckFeature(selection, 'arrosages'), {
    ok: false,
    reason: 'required',
    requiredBy: ['planning', 'besoins', 'historique'],
  });
  assert.deepEqual(uncheckFeature(selection, 'planning'), {
    ok: true,
    selection: ['arrosages', 'besoins', 'materiel', 'historique'],
  }, 'décocher le Planning ne décoche pas ce qu’il avait entraîné (P6)');
  assert.deepEqual(uncheckFeature(selection, 'sol'), { ok: true, selection }, 'une case déjà décochée ne change rien');
  assert.deepEqual(uncheckFeature(['alertes-meteo'], 'alertes-meteo'), { ok: false, reason: 'last' }, 'au moins une case reste cochée (P7)');
});

test('un choix enregistré se relit cohérent : inconnus écartés, dépendances complétées, ordre de la liste', () => {
  assert.deepEqual(normalizeSelection(['historique', 'inconnue', 42, 'historique']), ['arrosages', 'materiel', 'historique']);
  assert.deepEqual(normalizeSelection([]), []);
  assert.ok(isCompleteSelection(['materiel', 'arrosages']));
  assert.ok(isCompleteSelection(['alertes-cultures']));
  assert.ok(!isCompleteSelection([]), 'un choix vide ne s’enregistre pas');
  assert.ok(!isCompleteSelection(['planning']), 'il manque ce dont le Planning a besoin');
  assert.ok(!isCompleteSelection(['materiel', 'materiel']), 'pas de doublon');
  assert.ok(!isCompleteSelection(['materiel', 'inconnue']), 'pas d’identifiant inconnu');
  assert.ok(!isCompleteSelection(['calculateur']), 'il manque le matériel dont le calculateur a besoin');
});

test('la première ouverture : rien coché d’avance ; une ferme d’avant la 3.8 : tout coché et le bandeau (R5, R6)', () => {
  assert.deepEqual(resolveFeatureSelection({ kind: 'first-visit' }), { firstVisit: true, enabled: [], banner: null, known: [] });
  assert.deepEqual(resolveFeatureSelection({ kind: 'before-selection' }), {
    firstVisit: false,
    enabled: [...FEATURES_BEFORE_SELECTION],
    banner: { kind: 'introduction' },
    known: [...FEATURES_BEFORE_SELECTION],
  });
});

test('un choix enregistré n’a pas de bandeau ; une case apparue depuis arrive décochée et s’annonce une fois (R7, P2)', () => {
  const chosen = resolveFeatureSelection({
    kind: 'stored',
    enabled: ['alertes-meteo'],
    known: [...FEATURE_IDS],
    chosenAt: '2026-11-07T13:00:00.000Z',
    bannerDismissedAt: null,
  });
  assert.deepEqual(chosen, { firstVisit: false, enabled: ['alertes-meteo'], banner: null, known: [...FEATURE_IDS] });

  // Une ferme qui a choisi avant que « Historique et cumuls » n'existe ne la voit pas cochée d'elle-même.
  const knownBefore = FEATURE_IDS.filter((id) => id !== 'historique');
  const later = resolveFeatureSelection({
    kind: 'stored',
    enabled: ['materiel', 'arrosages'],
    known: knownBefore,
    chosenAt: '2026-11-07T13:00:00.000Z',
    bannerDismissedAt: '2026-11-07T13:05:00.000Z',
  });
  assert.deepEqual(later.enabled, ['arrosages', 'materiel']);
  assert.deepEqual(later.banner, { kind: 'new-features', features: ['historique'] });

  const dismissedOnly = resolveFeatureSelection({
    kind: 'stored',
    enabled: [...FEATURE_IDS],
    known: [...FEATURE_IDS],
    chosenAt: null,
    bannerDismissedAt: '2026-11-07T13:05:00.000Z',
  });
  assert.equal(dismissedOnly.banner, null, 'le bandeau fermé ne revient pas');

  const empty = resolveFeatureSelection({ kind: 'stored', enabled: [], known: [...FEATURE_IDS], chosenAt: '2026-11-07T13:00:00.000Z', bannerDismissedAt: null });
  assert.deepEqual(empty.enabled, [...FEATURES_BEFORE_SELECTION], 'un choix vide rencontré quand même ne fait rien disparaître');

  // La ferme qui a choisi ses cases avant la 3.8 bis : le calculateur arrive décoché, annoncé par le bandeau (R7).
  const beforeCalculator = resolveFeatureSelection({
    kind: 'stored',
    enabled: [...FEATURES_BEFORE_SELECTION],
    known: [...FEATURES_BEFORE_SELECTION],
    chosenAt: '2026-11-07T13:00:00.000Z',
    bannerDismissedAt: null,
  });
  assert.ok(!beforeCalculator.enabled.includes('calculateur'));
  assert.deepEqual(beforeCalculator.banner, { kind: 'new-features', features: ['calculateur'] });
  assert.equal(featureBannerText(beforeCalculator.banner!), 'Nouvelle fonctionnalité : Calculateur d’irrigation. Elle n’est pas cochée ; vous pouvez la cocher dans Réglages.');
  assert.equal(firstEnabledFeature(['materiel', 'calculateur']), 'materiel', 'une case sans page n’est jamais la première page');
  assert.deepEqual(menuPages(['materiel', 'calculateur']), ['materiel', 'reglages']);
  assert.ok(!isIrrigationPageId('calculateur'), 'pas d’adresse /irrigation/calculateur');
});

test('la première page est la première case cochée de la liste (P10)', () => {
  assert.equal(firstEnabledFeature([...FEATURE_IDS]), 'arrosages');
  assert.equal(firstEnabledFeature(['alertes-cultures', 'alertes-meteo']), 'alertes-meteo');
  assert.equal(firstEnabledFeature([]), null);
  assert.ok(isEnabled(['sol'], 'sol'));
  assert.ok(!isEnabled(['sol'], 'planning'));
});

test('le socle paraît dès qu’une case cochée en a besoin (section 3)', () => {
  for (const id of FEATURE_IDS) {
    assert.equal(usesWeather([id]), ['besoins', 'sol', 'cultures', 'alertes-meteo', 'alertes-cultures'].includes(id), `météo : ${id}`);
    assert.equal(usesPushNotifications([id]), ['arrosages', 'planning', 'alertes-meteo', 'alertes-cultures'].includes(id), `notifications : ${id}`);
    assert.equal(usesSpeciesCorrespondence([id]), ['cultures', 'alertes-cultures'].includes(id), `espèces : ${id}`);
  }
  assert.ok(!usesWeather(['materiel', 'arrosages', 'ressources', 'historique']), 'une ferme sans case météo n’est plus relevée (P4)');
});

test('une partie de case qui a besoin d’une autre case ne paraît qu’avec elle, et ne l’impose pas (P1)', () => {
  assert.ok(!isPartActive(['alertes-cultures'], 'sprinkler-reconsideration'));
  assert.ok(isPartActive(withRequirements(['alertes-cultures', 'planning']), 'sprinkler-reconsideration'));
  assert.ok(!isPartActive(withRequirements(['ressources']), 'feasibility'));
  assert.ok(isPartActive(withRequirements(['ressources', 'besoins']), 'feasibility'));
  assert.ok(!isPartActive(['planning'], 'sprinkler-reconsideration'), 'la partie appartient aux Alertes cultures');
  assert.equal(featurePart('sprinkler-reconsideration').missingNotice, 'Les aspersions à reconsidérer demandent le Planning de la semaine.');
  assert.deepEqual(withRequirements(['alertes-cultures']), ['alertes-cultures'], 'l’alerte de gel seule n’impose pas le Planning');
});

test('l’avertissement dit ce qui reste et ce qui change ; sans donnée, pas de fenêtre (R2)', () => {
  assert.equal(
    uncheckWarning('ressources', { resources: 2, pumps: 1 }),
    '2 ressources et 1 pompe restent enregistrées. Le planning ne tiendra plus compte de leurs débits ni de leurs stocks : il se calculera comme pour une ferme sans pompe ni ressource déclarée.',
  );
  assert.equal(uncheckWarning('ressources', { pumps: 1 })?.startsWith('1 pompe reste enregistrée.'), true);
  assert.equal(uncheckWarning('ressources', {}), null);
  assert.equal(uncheckWarning('materiel', { equipment: 1 })?.startsWith('1 matériel, avec ses réglages et ses poses, reste enregistré.'), true);
  assert.equal(uncheckWarning('materiel', { equipment: 3 })?.startsWith('3 matériels, avec leurs réglages et leurs poses, restent enregistrés.'), true);
  assert.equal(uncheckWarning('arrosages', { irrigationEvents: 12 })?.startsWith('12 arrosages enregistrés restent dans le module.'), true);
  assert.equal(uncheckWarning('besoins', { goals: 2, rainMeasures: 1 })?.startsWith('2 objectifs et 1 mesure de pluie restent enregistrés.'), true);
  assert.equal(uncheckWarning('besoins', { rainMeasures: 1 })?.startsWith('1 mesure de pluie reste enregistrée.'), true);
  assert.equal(uncheckWarning('besoins', { goals: 1 })?.startsWith('1 objectif reste enregistré.'), true);
  assert.match(uncheckWarning('planning', { plans: 4 }) ?? '', /^4 plans déjà calculés restent enregistrés\. .*notification du matin ne part plus\.$/);
  assert.match(uncheckWarning('planning', { protectedSlots: 1 }) ?? '', /^1 créneau protégé reste enregistré\. /, 'un créneau protégé seul suffit à avertir (3.8 ter)');
  assert.equal(uncheckWarning('planning', { plans: 0, protectedSlots: 0 }), null);
  assert.match(uncheckWarning('sol', { soilRecords: 1 }) ?? '', /^1 saisie du sol reste enregistrée\./);
  assert.match(uncheckWarning('cultures', { cropSettings: 2 }) ?? '', /^2 réglages de culture restent enregistrés\. L’ETM/);
  assert.match(uncheckWarning('alertes-meteo', { weatherAlertCriteria: 1 }) ?? '', /^1 alerte réglée reste enregistrée\. Plus aucune alerte météo/);
  assert.match(uncheckWarning('alertes-cultures', { cropAlertSettings: 3 }) ?? '', /^3 réglages restent enregistrés\./);
  assert.equal(uncheckWarning('historique', { irrigationEvents: 12 }), null, 'l’historique n’a pas de donnée à lui');
  for (const id of FEATURE_IDS) assert.equal(uncheckWarning(id, {}), null, `${id} sans donnée`);
  assert.equal(uncheckWarning('materiel', { equipment: Number.NaN }), null, 'un compte illisible vaut zéro');
});

test('une page par case, plus Réglages ; la saison, la parcelle et la semaine suivent dans l’adresse (section 5, P12)', () => {
  assert.equal(pagePath('alertes-meteo'), '/irrigation/alertes-meteo');
  assert.equal(pageHref('materiel', { season: 2026, zone: 'z-1' }), '/irrigation/materiel?season=2026&zone=z-1');
  assert.equal(pageHref('besoins', { season: 2026, week: '2026-11-04', refresh: true }, '#weather'), '/irrigation/besoins?season=2026&week=2026-11-04&refresh=1#weather');
  assert.equal(pageHref('reglages'), '/irrigation/reglages');
  assert.equal(WELCOME_PATH, '/irrigation/bienvenue');
  assert.equal(pageFromPathname('/irrigation/planning'), 'planning');
  assert.equal(pageFromPathname('/irrigation/reglages/'), 'reglages');
  assert.equal(pageFromPathname('/irrigation'), null);
  assert.equal(pageFromPathname('/irrigation/inconnue'), null);
  assert.ok(isIrrigationPageId('reglages'));
  assert.ok(!isIrrigationPageId('bienvenue'));
  assert.deepEqual(menuPages(['alertes-meteo', 'materiel']), ['aujourdhui', 'materiel', 'alertes-meteo', 'reglages']);
  assert.ok(isIrrigationPageId('aujourdhui'));
  assert.equal(pageFromPathname('/irrigation/aujourdhui'), 'aujourdhui');
});

test('les anciennes adresses des notifications conduisent à la page qui porte le bloc (P14)', () => {
  const all = [...FEATURE_IDS];
  // Sans ancre, la page d'arrivée : « Aujourd'hui » quand elle existe (audit ergonomique, lot 2, F1).
  assert.deepEqual(legacyRedirect('', all), { page: 'aujourdhui', notEnabled: false });
  assert.deepEqual(legacyRedirect('', ['materiel', 'calculateur']), { page: 'materiel', notEnabled: false });
  assert.deepEqual(legacyRedirect('#weather', all), { page: 'besoins', notEnabled: false });
  assert.deepEqual(legacyRedirect('#weather', ['alertes-meteo']), { page: 'alertes-meteo', notEnabled: false });
  assert.deepEqual(legacyRedirect('#irrigation-eq-1', all), { page: 'arrosages', notEnabled: false });
  assert.deepEqual(legacyRedirect('#series-water-title', all), { page: 'historique', notEnabled: false });
  assert.deepEqual(legacyRedirect('#series-water-title', ['alertes-cultures']), { page: 'alertes-cultures', notEnabled: false });
  assert.deepEqual(legacyRedirect('#planning', all), { page: 'planning', notEnabled: false });
  assert.deepEqual(legacyRedirect('#planning-title', ['alertes-cultures']), { page: 'alertes-cultures', notEnabled: false });
  assert.deepEqual(legacyRedirect('#farm-plan', ['alertes-meteo']), { page: 'aujourdhui', notEnabled: false }, 'une ancre sans règle mène à la page d’arrivée');
  assert.deepEqual(legacyRedirect('#irrigation-eq-1', ['alertes-meteo']), { page: 'aujourdhui', notEnabled: true }, 'la fonctionnalité n’est pas cochée : la page d’arrivée, avec la ligne qui le dit');
  assert.deepEqual(legacyRedirect('#irrigation-eq-1', ['materiel']), { page: 'materiel', notEnabled: true });
  assert.deepEqual(legacyRedirect('#weather', []), { page: 'reglages', notEnabled: true });
});

test('une page non cochée conduit à la page d’arrivée, avec la ligne qui le dit ; la première ouverture, au choix (R1, R5, P10)', () => {
  assert.deepEqual(pageAccess('planning', true, []), { kind: 'welcome' });
  assert.deepEqual(pageAccess('reglages', true, []), { kind: 'welcome' });
  assert.deepEqual(pageAccess('planning', false, [...FEATURE_IDS]), { kind: 'open' });
  assert.deepEqual(pageAccess('reglages', false, ['alertes-meteo']), { kind: 'open' }, 'Réglages s’ouvre toujours');
  // La page d'arrivée : « Aujourd'hui » quand elle existe (lot 2, F1), sinon la première page cochée.
  assert.deepEqual(pageAccess('historique', false, ['materiel', 'arrosages']), { kind: 'not-enabled', page: 'aujourdhui' });
  assert.deepEqual(pageAccess('materiel', false, ['alertes-cultures']), { kind: 'not-enabled', page: 'aujourdhui' });
  assert.deepEqual(pageAccess('arrosages', false, ['materiel', 'calculateur']), { kind: 'not-enabled', page: 'materiel' });
  assert.equal(pageHref('materiel', { season: 2026, absent: true }), '/irrigation/materiel?season=2026&absente=1');
  assert.equal(ABSENT_FEATURE_NOTICE, 'Cette fonctionnalité n’est pas cochée pour votre ferme.');
});

test('la liste dit pourquoi une case reste cochée et ce qu’une case cochera avec elle (R3)', () => {
  assert.equal(joinLabels([]), '');
  assert.equal(joinLabels(['A']), 'A');
  assert.equal(joinLabels(['A', 'B', 'C']), 'A, B et C');

  const empty = featureChoiceRows([]);
  assert.deepEqual(empty.map((row) => row.id), [...FEATURE_IDS], 'les dix cases, dans l’ordre');
  assert.ok(empty.every((row) => !row.checked && row.requiredBy.length === 0), 'rien coché d’avance (R5)');
  const planning = empty.find((row) => row.id === 'planning')!;
  assert.deepEqual(planning.brings, ['Arrosages', 'Objectifs et besoins', 'Matériel et placement']);
  assert.equal(featureChoiceLine(planning), 'Cochera aussi Arrosages, Objectifs et besoins et Matériel et placement, dont elle a besoin.');
  assert.equal(featureChoiceLine(empty.find((row) => row.id === 'arrosages')!), 'Cochera aussi Matériel et placement, dont elle a besoin.');
  assert.equal(featureChoiceLine(empty.find((row) => row.id === 'alertes-meteo')!), null, 'une case sans besoin vient seule');

  const chosen = featureChoiceRows(checkFeature([], 'planning'));
  const materiel = chosen.find((row) => row.id === 'materiel')!;
  assert.ok(materiel.checked);
  assert.deepEqual(materiel.requiredBy, ['Arrosages', 'Planning de la semaine', 'Objectifs et besoins']);
  assert.equal(featureChoiceLine(materiel), 'Nécessaire pour Arrosages, Planning de la semaine et Objectifs et besoins.');
  const planningChecked = chosen.find((row) => row.id === 'planning')!;
  assert.equal(featureChoiceLine(planningChecked), null, 'aucune case cochée n’a besoin du planning : il se décoche');
  const sol = chosen.find((row) => row.id === 'sol')!;
  assert.deepEqual(sol.brings, ['Besoin par culture'], 'seulement ce qui manque encore');
});

test('cocher dans Réglages annonce les cases entraînées ; le bandeau dit le choix ou les cases nouvelles (R3, R6, R7)', () => {
  assert.equal(checkConfirmation([], 'planning'), 'Cocher « Planning de la semaine » coche aussi Arrosages, Objectifs et besoins et Matériel et placement, dont elle a besoin.');
  assert.equal(checkConfirmation(['materiel', 'arrosages'], 'historique'), null, 'tout ce qu’il lui faut est déjà coché');
  assert.equal(checkConfirmation([], 'alertes-meteo'), null);
  assert.equal(featureBannerText({ kind: 'introduction' }), 'Vous pouvez maintenant choisir les fonctionnalités affichées, dans Réglages.');
  assert.equal(featureBannerText({ kind: 'new-features', features: ['historique'] }), 'Nouvelle fonctionnalité : Historique et cumuls. Elle n’est pas cochée ; vous pouvez la cocher dans Réglages.');
  assert.equal(featureBannerText({ kind: 'new-features', features: ['sol', 'historique'] }), 'Nouvelles fonctionnalités : Réserve du sol et Historique et cumuls. Elles ne sont pas cochées ; vous pouvez les cocher dans Réglages.');
});

test('un changement de cases recalcule le plan quand il le touche, et retire les alarmes quand Arrosages est décochée (R9, P8, P28, P29)', () => {
  const all = [...FEATURE_IDS];
  const withoutResources = all.filter((id) => id !== 'ressources');
  const planning = withRequirements(['planning']);
  assert.equal(selectionChangeRecalculatesPlan(all, withoutResources), true, 'Ressources et pompes décochée, Planning coché');
  assert.equal(selectionChangeRecalculatesPlan(withoutResources, all), true, 'Ressources et pompes recochée');
  assert.equal(selectionChangeRecalculatesPlan(withRequirements(['historique']), planning), true, 'le Planning vient d’être coché');
  assert.equal(selectionChangeRecalculatesPlan(all, all.filter((id) => id !== 'sol')), false, 'les notes du sol se lisent à l’ouverture');
  assert.equal(selectionChangeRecalculatesPlan(all, all.filter((id) => id !== 'alertes-meteo')), false);
  assert.equal(selectionChangeRecalculatesPlan(withRequirements(['planning', 'ressources']), withRequirements(['ressources'])), false, 'sans Planning, rien à recalculer');
  assert.equal(selectionChangeRecalculatesPlan([], planning), false, 'la première ouverture n’a pas de plan à refaire');

  assert.equal(selectionChangeCancelsIrrigationAlarms(withRequirements(['arrosages']), ['materiel']), true);
  assert.equal(selectionChangeCancelsIrrigationAlarms(['materiel'], withRequirements(['arrosages'])), false);
  assert.equal(selectionChangeCancelsIrrigationAlarms(all, withoutResources), false);
  assert.equal(selectionChangeCancelsIrrigationAlarms([], ['materiel']), false);
});
