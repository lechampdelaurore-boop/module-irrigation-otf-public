import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TOURS } from '../lib/domain/demo/tours.ts';

/**
 * Simplifier l'usage du module, lot S5, PR 3 : l'entrée de la page et les mots
 * (docs/simplification-s5-contract.md, sections 6.1, 7, 9.1 et 10 ; D-334).
 * L'ordre de la page, le retour « ‹ Aujourd'hui » après un geste du « + »,
 * le lien après « Démarrer », « C'est fait » sur « Arrosages », les ancres de
 * la visite. Le budget de hauteur est mesuré par P64, aux deux largeurs.
 */

const MANAGER = 'app/irrigation/irrigation-event-manager.tsx';
const PANEL = 'app/irrigation/irrigation-manager/creation-panel.tsx';
const FORM = 'app/irrigation/irrigation-manager/watering-form.tsx';
const read = (path: string) => readFileSync(path, 'utf8');

test('l’ordre de la page (S5-m) : l’en-cours, le formulaire, l’à-venir, puis le résumé', () => {
  const manager = read(MANAGER);
  const render = manager.slice(manager.lastIndexOf('  return (\n    <section className="irrigation-events-section"'));
  // Les alertes du téléphone, dans tous leurs états, sous le formulaire (section 5, F908).
  const order = ['aria-label="Irrigations en cours"', '<CreationPanel', '{notificationReadiness}', '<UpcomingIrrigations', 'className="irrigation-events-summary"', 'aria-label="Résumé des irrigations"'];
  const positions = order.map((marker) => render.indexOf(marker));
  assert.ok(positions.every((position) => position > 0), JSON.stringify(positions));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  // Le titre de la section tient sur une ligne au téléphone.
  assert.match(render, /<h2 id="irrigation-events-title">Arroser ou noter<\/h2>/);
  const heading = render.slice(render.indexOf('<header className="irrigation-events-heading">'), render.indexOf('</header>'));
  assert.doesNotMatch(heading, /irrigation-event-counts/);
  assert.equal(render.split('{notificationReadiness}').length, 2, 'les alertes du téléphone à une seule place');
});

test('l’arrosage en cours raccourci au téléphone (F909) : mêmes gestes, rangés côte à côte', () => {
  const css = read('app/irrigation/styles/arroser-maintenant.css');
  const phone = css.slice(css.indexOf('L\'arrosage en cours, plus court au téléphone'));
  assert.match(phone, /@media \(max-width: 560px\)/);
  assert.match(phone, /\.active-irrigation-card > header \{[^}]*flex-direction: row;/);
  assert.match(phone, /\.active-timer-details \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(phone, /\.active-timer-actions \{[^}]*flex-direction: row;/);
  // Les boutons gardent leurs 52 px du téléphone (irrigation-records.css) : rien n'y touche ici.
  assert.doesNotMatch(phone, /min-height/);
});

test('arrivé par un geste du « + » : le retour « ‹ Aujourd’hui » en tête du formulaire (section 7)', () => {
  const manager = read(MANAGER);
  assert.match(manager, /const openRequestedForm = \(event: Event\) => \{\s*openForm\(\(event as CustomEvent<unknown>\)\.detail\);\s*setFromGesture\(true\);/);
  assert.match(manager, /todayHref=\{pageHref\('aujourdhui', \{ season \}\)\}/);
  // « Ajouter un créneau » du planning n'est pas un geste du « + » : pas de retour.
  assert.match(manager, /const openPlannedForm = \(\) => openForm\('planned'\);/);
  const panel = read(PANEL);
  assert.match(panel, /\{fromGesture \? <Link className="watering-back" href=\{todayHref\} prefetch=\{false\}>‹ Aujourd’hui<\/Link> : null\}/);
  assert.ok(panel.indexOf('className="watering-back"') < panel.indexOf('role="tablist"'), 'le retour avant les onglets');
  const css = read('app/irrigation/styles/arroser-maintenant.css');
  assert.match(css, /\.watering-back,\s*\.watering-after-start \{[^}]*min-height: var\(--touch-target\);/);
});

test('après « Démarrer », la page reste ; un lien mène à la carte d’« Aujourd’hui » (S5-g)', () => {
  const manager = read(MANAGER);
  assert.match(manager, /setJustStarted\(creationKind === 'running' && !editingEventEquipmentId\);/);
  assert.match(manager, /setExcess\(null\);\s*setJustStarted\(false\);/);
  assert.match(read(PANEL), /afterStart=\{justStarted \? <Link className="watering-after-start" href=\{todayHref\} prefetch=\{false\}>Voir l’arrosage en cours sur Aujourd’hui<\/Link> : null\}/);
  const form = read(FORM);
  const start = form.slice(form.indexOf('<div className="watering-start" data-tour="arrosage-bouton">'));
  assert.ok(start.indexOf('{reply}') < start.indexOf("{kind === 'running' ? afterStart : null}"), 'le lien sous la réponse');
});

test('« C’est fait » sur « Arrosages », le mot d’« Aujourd’hui » ; la confirmation inchangée (section 6.1)', () => {
  const button = read('app/irrigation/done-as-planned-button.tsx');
  assert.match(button, /aria-label=\{`C’est fait : \$\{title\}`\}/);
  assert.match(button, /<Icon name="coche" \/>\s*C’est fait\s*<\/button>/);
  assert.match(button, /<h3 id=\{titleId\}>Fait comme prévu \?<\/h3>/);
  assert.match(button, /'Enregistrer comme faite'/);
  assert.doesNotMatch(button, />\s*Fait comme prévu\s*<\/button>/);
});

test('la visite suit les trois blocs : « 1. Où ? », « 2. Combien de temps ? », le bouton', () => {
  const steps = TOURS.flatMap((tour) => tour.steps).filter((step) => step.pages?.includes('arrosages'));
  const byAnchor = (anchor: string) => steps.filter((step) => step.anchor === anchor).map((step) => step.title);
  assert.deepEqual(byAnchor('arrosage-champs'), ['1. Où ?']);
  assert.deepEqual(byAnchor('arrosage-resultat'), ['2. Combien de temps ?']);
  assert.deepEqual(byAnchor('arrosage-bouton'), ['Vous seul validez']);
  const form = read(FORM);
  assert.match(form, /data-tour="arrosage-champs"/);
  assert.match(form, /data-tour="arrosage-resultat"/);
  assert.match(form, /<div className="watering-start" data-tour="arrosage-bouton">/);
  assert.match(read('lib/domain/demo/tours.ts'), /« Démarrer · fin vers … »/);
});
