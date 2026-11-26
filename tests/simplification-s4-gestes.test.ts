import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { historyCsvHref, weekExportLink } from '../lib/domain/irrigation-history/csv-href';
import { DEFAULT_HISTORY_STATUS_FILTER } from '../lib/domain/irrigation-history/status-filter';
import { weekForecastUnavailable } from '../lib/domain/semaine/week-detail';
import { FORECAST_UNAVAILABLE, forecastUnavailableText } from '../lib/domain/today/today-view';

/**
 * Simplifier l'usage du module, lot S4, PR 3 : les gestes de la page
 * « Semaine » (docs/simplification-s4-contract.md, sections 4.5, 4.6 et 8) :
 * « Comprendre ces chiffres », « Changer l'eau visée », « Noter la pluie »
 * depuis ses trois entrées, les flèches qui changent de semaine sans quitter
 * la page, « Exporter », les états rares. Ce qui existe est appelé, jamais
 * refait : les tuiles d'« Aujourd'hui », la fenêtre de S2, le constructeur
 * d'adresse de l'historique.
 */

const read = (path: string) => readFileSync(path, 'utf8');

// « Exporter » (section 4.6).

test('« Exporter » : la semaine affichée, période « semaine », au format et à la route de l’historique, inchangés', () => {
  const link = weekExportLink({ season: 2026, weekStart: '2026-11-23', weekEnd: '2026-11-29' });
  assert.equal(link.href, '/irrigation/historique.csv?season=2026&mode=week&level=farm&anchor=2026-11-23&start=2026-11-23&end=2026-11-29&status=done');
  assert.equal(link.href, historyCsvHref({ season: 2026, mode: 'week', level: 'farm', startDate: '2026-11-23', endDate: '2026-11-29', status: DEFAULT_HISTORY_STATUS_FILTER }));
  assert.equal(link.label, 'Exporter CSV · réalisées, du 23/11/2026 au 29/11/2026', 'les mots du bouton de « Les cumuls »');
  // Une semaine à cheval sur deux années garde ses deux dates.
  assert.match(weekExportLink({ season: 2026, weekStart: '2026-12-28', weekEnd: '2027-01-03' }).href, /anchor=2026-12-28&start=2026-12-28&end=2027-01-03/);
});

test('« Exporter » : le constructeur de l’historique est appelé, pas recopié ; le lien n’existe que la case Historique cochée', () => {
  const history = read('app/irrigation/irrigation-history-dashboard.tsx');
  assert.match(history, /return historyCsvHref\(\{/);
  assert.doesNotMatch(history, /historique\.csv\?/, 'l’adresse ne s’écrit qu’à un endroit');
  const page = read('app/irrigation/semaine/page.tsx');
  assert.match(page, /const exportLink = context\.enabled\.includes\('historique'\)\s+\? weekExportLink\(/);
  assert.match(page, /\{exportLink \? \(\s+<p className="week-export"><a className="week-export-link" href=\{exportLink\.href\}>\{exportLink\.label\}<\/a><\/p>/);
});

// Les états rares (section 8.5) : la météo indisponible.

const day = (date: string, et0Mm: number | null, forecastRainMm: number | null) => ({ date, et0Mm, forecastRainMm });

test('météo indisponible : la phrase d’« Aujourd’hui », jamais un zéro ; les jours passés n’y comptent pas', () => {
  const days = [day('2026-11-23', null, null), day('2026-11-24', null, null), day('2026-11-25', 1.2, 0), day('2026-11-26', null, null), day('2026-11-27', null, null)];
  assert.equal(weekForecastUnavailable(days, '2026-11-26', true), FORECAST_UNAVAILABLE, 'aucun jour d’aujourd’hui à dimanche n’a sa prévision');
  assert.equal(FORECAST_UNAVAILABLE, 'Prévision indisponible : à vérifier.');
  const partial = [day('2026-11-26', 1.1, 0), day('2026-11-27', null, 3), day('2026-11-28', 0.9, null)];
  assert.equal(weekForecastUnavailable(partial, '2026-11-26', true), 'Prévision indisponible le ven. 27 nov. et le sam. 28 nov. : à vérifier.');
  assert.equal(weekForecastUnavailable(partial, '2026-11-26', false), 'Prévision indisponible le ven. 27 nov. : à vérifier.', 'sous abri, la pluie prévue ne manque pas (D-032)');
  assert.equal(weekForecastUnavailable([day('2026-11-26', 1.1, 0), day('2026-11-27', 0.8, 0)], '2026-11-26', true), null, 'une prévision nulle n’est pas une prévision absente');
  assert.equal(forecastUnavailableText([], 3), null);
});

test('météo indisponible : dans l’encadré d’attention de la semaine en cours, en ambre, et la même fonction qu’« Aujourd’hui »', () => {
  const premier = read('app/irrigation/semaine/week-first-level.tsx');
  assert.match(premier, /const forecast = current \? weekForecastUnavailable\(water\.days, today, rainMatters\) : null;/);
  assert.match(premier, /\{forecast \? <p className="week-attention-line" role="note">\{forecast\}<\/p> : null\}/);
  const today = read('lib/domain/today/today-view.ts');
  assert.match(today, /const unavailable = forecastUnavailableText\(missing, days\.length\);/);
  assert.match(read('app/irrigation/styles/la-semaine.css'), /\.week-attention \{[^}]*background: var\(--warn-soft\);/);
});

// « Comprendre ces chiffres » (section 8.1) et « Changer l'eau visée » (8.2).

test('« Comprendre ces chiffres » : un pli sous le bilan, les tuiles d’« Aujourd’hui » réutilisées, sans un calcul de plus', () => {
  const summary = read('app/irrigation/semaine/week-summary.tsx');
  assert.match(summary, /<button type="button" className="week-bilan-link" aria-expanded=\{understand\} aria-controls=\{understandId\}/);
  assert.match(summary, /<div id=\{understandId\} className="week-understand" hidden=\{!understand\}>\s+\{tiles\}/);
  const premier = read('app/irrigation/semaine/week-first-level.tsx');
  assert.match(premier, /tiles=\{<WaterSummaryTiles dashboard=\{water\} farmObjective=\{needs\.farmObjective \?\? null\} today=\{today\} \/>\}/);
  const dashboard = read('app/irrigation/water-management-dashboard.tsx');
  assert.match(dashboard, /<WaterSummaryTiles dashboard=\{dashboard\} farmObjective=\{farmObjective\} today=\{today\} \/>/, 'une seule fonction pour les deux places');
  assert.doesNotMatch(dashboard, /function SummaryCard/, 'les tuiles ne sont pas recopiées');
});

test('« Changer l’eau visée » : le pli des objectifs, sans changer de page, le premier champ au clavier ; seulement quand une eau est visée', () => {
  const summary = read('app/irrigation/semaine/week-summary.tsx');
  assert.match(summary, /\{goalSet \? <a className="week-bilan-link" href=\{goalsHref\} onClick=\{\(event\) => openGoals\(event, goalsHref\)\}>Changer l’eau visée<\/a> : null\}/);
  const open = summary.slice(summary.indexOf('export function openGoals'), summary.indexOf('export function WeekGardensList'));
  assert.match(open, /window\.dispatchEvent\(new HashChangeEvent\('hashchange'\)\)/, 'une ancre déjà dans l’adresse rouvre ses plis');
  assert.match(open, /field\.focus\(\);/);
  assert.match(read('app/irrigation/semaine/week-first-level.tsx'), /const GOALS_ANCHOR = 'objectifs-de-la-semaine';/);
});

// « Noter la pluie » (section 8.3).

test('« Noter la pluie » : la fenêtre de S2 appelée, pas refaite ; le jour d’une ligne est le jour proposé ; la semaine se relit après', () => {
  const rain = read('app/irrigation/semaine/week-rain.tsx');
  assert.match(rain, /import \{ RainEntryDialog \} from '\.\.\/rain-entry-dialog';/);
  assert.match(rain, /const result = await readRainEntryAction\(\);/, 'les jours et les mesures se lisent à l’ouverture');
  assert.match(rain, /const defaultDate = date && result\.entry\.days\.some\(\(day\) => day\.date === date\) \? date : result\.entry\.defaultDate;/);
  assert.match(rain, /const saved = \(text: string\) => \{\s+setShown\(false\);\s+setReplies\(\[actionReply\(origin \?\? 'bilan', 'notice', text\)\]\);\s+notifyRainNoted\(\);/, 'rien n’est dit avant la réponse du serveur');
  assert.match(rain, /const value: WeekRain \| null = rainMatters \? \{/, 'une ferme toute sous abri n’a pas ce geste (D-032)');
  assert.match(rain, /besoinsHref=\{`#\$\{MEASURED_RAIN_ANCHOR\}`\}/, '« Retirer la mesure » reste dans « Pluie mesurée »');
  const signals = read('app/irrigation/semaine/week-signals.ts');
  assert.match(signals, /window\.dispatchEvent\(new CustomEvent\(WEEK_RAIN_NOTED\)\);\s+window\.dispatchEvent\(new CustomEvent\('irrigation-needs-source-changed'\)\);/);
  assert.match(read('app/irrigation/water-management-dashboard.tsx'), /WEEK_RAIN_NOTED/, 'le tableau de l’eau se relit');
  assert.match(read('app/irrigation/planning/weekly-plan-state.tsx'), /const REFRESH_SIGNALS = \['irrigation-events-changed', 'irrigation-needs-source-changed'/, 'le plan recalculé se relit');
});

test('« Noter la pluie » : ses trois entrées, le bilan, « Calcul approximatif », la ligne d’un jour ; aucune pour une semaine à venir', () => {
  const premier = read('app/irrigation/semaine/week-first-level.tsx');
  assert.match(premier, /const bilanRain = rain && heading\.state !== 'upcoming' \? \{ open: \(\) => rain\.open\(RAIN_BILAN\)/);
  assert.match(premier, /onOpenRain=\{rain \? \(\) => rain\.open\(RAIN_APPROXIMATE\) : undefined\}/);
  const days = read('app/irrigation/semaine/week-days.tsx');
  assert.match(days, /data-scope="day" data-date=\{line\.dateKey\} disabled=\{rain\.pending\} aria-label=\{`Noter la pluie du \$\{lowerFirst\(line\.label\)\}`\} onClick=\{\(\) => rain\.open\(rainOrigin, line\.dateKey\)\}/);
  assert.match(days, /data-scope="run" data-date=\{runRainDate\} disabled=\{rain\.pending\} aria-label=\{`Noter la pluie, \$\{runDays\}`\} onClick=\{\(\) => rain\.open\(rainOrigin, runRainDate\)\}/);
  const summary = read('app/irrigation/semaine/week-summary.tsx');
  assert.match(summary, /\{rain \? <button type="button" className="week-bilan-link" disabled=\{rain\.pending\} onClick=\{rain\.open\}>Noter la pluie<\/button> : null\}/);
  // La fenêtre se ferme sur le lien vers « Pluie mesurée » (le pli s'ouvre par son ancre).
  assert.match(read('app/irrigation/rain-entry-dialog.tsx'), /<a href=\{besoinsHref\} onClick=\{onClose\}>\{besoinsLabel\}<\/a>/);
});

// Aller et venir entre les semaines (section 8.4).

test('les flèches : un lien du routeur, sans recharger la page ; l’adresse dit la semaine ; une semaine neuve remet le client à zéro', () => {
  const premier = read('app/irrigation/semaine/week-first-level.tsx');
  assert.match(premier, /import Link from 'next\/link';/);
  const navigation = premier.slice(premier.indexOf('function WeekNavigation'), premier.indexOf('const RAIN_BILAN'));
  assert.equal(navigation.match(/<Link className="week-arrow" href=\{href\(heading\.(previous|next)\)\} prefetch=\{false\}/g)?.length, 2);
  assert.match(navigation, /pageHref\('semaine', \{ season, zone: query\.zone, week \}\)/);
  assert.doesNotMatch(navigation, /<a /, 'aucune flèche ne recharge la page');
  assert.match(read('app/irrigation/semaine/page.tsx'), /<WeekRainProvider key=\{weekStart\} planning=\{planning !== null\} rainMatters=\{rainMatters\}>/);
});

test('les cibles des gestes font 44 px ; la ligne d’une suite de jours calmes porte son seul « Noter la pluie » au téléphone', () => {
  const css = read('app/irrigation/styles/la-semaine.css');
  assert.match(css, /\.week-bilan-actions \.week-bilan-link,\s+\.week-day \.week-day-rain button \{[^}]*min-height: var\(--touch-target\);/);
  assert.match(css, /\.week-export-link \{[^}]*min-height: var\(--touch-target\);/);
  assert.match(css, /\.week-day\[data-calm-run="start"\] \.week-day-rain \[data-scope="day"\] \{\s+display: none;/);
  assert.match(css, /\.week-day\[data-calm-run="start"\] \.week-day-rain \[data-scope="run"\] \{\s+display: inline-flex;/);
});
