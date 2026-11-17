import { CNIL_URL, MODULE_URL, OAUTH_RETURN_URL, OTF_URL, PAGE_PATHS, SOURCE_URL } from './addresses.ts';
import { escapeHtml, renderPage } from './layout.ts';

/**
 * Le texte des trois pages publiques (sous-tranche 4.8,
 * docs/tranche-4-contract.md, section 9, T4-18 ; D-153). Il décrit ce que
 * fait réellement le code à la date indiquée : toute évolution du module qui
 * change ce qui est lu, gardé ou envoyé à l'extérieur met ce texte à jour dans
 * la même PR. Ce n'est pas un avis juridique (T4-20) : il sera relu par une
 * personne compétente avant qu'une autre ferme soit reliée.
 */

export const RESPONSIBLE = "François PREZEAU, GAEC Le Champ de l'Aurore";
const TEXT_DATE = '17 novembre 2026';

/** Une adresse électronique plausible : une valeur mal saisie ne s'affiche pas. */
const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

/**
 * Le moyen de contact. L'adresse est saisie par le porteur lui-même dans un
 * réglage du Worker (`SITE_CONTACT_EMAIL`), jamais écrite dans le dépôt ;
 * tant qu'elle manque, la page renvoie à la page publique du projet.
 */
export function contactHtml(contactEmail: string | undefined): string {
  const email = contactEmail?.trim();
  if (email && EMAIL_PATTERN.test(email)) {
    const safe = escapeHtml(email);
    return `par courriel, à l'adresse <a href="mailto:${safe}">${safe}</a>`;
  }
  return `par la <a href="${SOURCE_URL}/issues">page publique du projet</a> (l'adresse de contact est en cours de mise en place)`;
}

export function homePage(contactEmail: string | undefined): string {
  return renderPage({
    id: 'home',
    title: 'Accueil',
    description: "Un module d'aide à l'irrigation pour les fermes maraîchères qui utilisent Ouvre ta ferme.",
    body: `<h1>Un module d'aide à l'irrigation pour les fermes qui utilisent Ouvre ta ferme</h1>
<p class="lead">Le module aide une ferme maraîchère à prévoir, planifier et suivre ses arrosages, planche par planche, à partir du plan de ferme qu'elle tient déjà dans <a href="${OTF_URL}">Ouvre ta ferme</a>.</p>
<h2>Ce qu'il fait</h2>
<ul>
<li>Il lit le plan de la ferme dans Ouvre ta ferme : parcelles, jardins, planches, séries et cultures. Il ne fait que lire : il n'écrit jamais rien dans Ouvre ta ferme.</li>
<li>Il fixe un objectif d'eau par semaine, en millimètres, et compare ce qui est prévu, ce qui a été arrosé et la pluie mesurée.</li>
<li>Il décrit le matériel d'arrosage et les ressources en eau (forage, réserve, pompe) et vérifie qu'ils suffisent.</li>
<li>Il propose un planning d'arrosage pour la semaine, y compris quand l'eau manque, et prévient du gel ou de la chaleur annoncés.</li>
</ul>
<h2>Pour qui</h2>
<p>Pour les fermes maraîchères qui tiennent leur plan dans Ouvre ta ferme et ont l'abonnement qui ouvre son interface de programmation (API). Les AMAP n'y ont pas accès : le module ne peut pas les servir.</p>
<h2>Ce qu'il ne fait pas</h2>
<ul>
<li>Il ne pilote aucune vanne ni aucun capteur.</li>
<li>Il ne remplace pas le jugement de l'exploitant : ses calculs sont une aide à la décision, pas une garantie.</li>
<li>Il n'est pas encore ouvert à toutes les fermes : il est en essai sur une ferme, puis sur quelques fermes amies.</li>
</ul>
<h2>L'essayer</h2>
<p>Le module lui-même est réservé aux fermes reliées, après connexion. Une démonstration avec des fermes fictives existe, sur invitation : demandez-la ${contactHtml(contactEmail)}.</p>
<h2>Contact</h2>
<p>Responsable : ${RESPONSIBLE}. Pour toute question, ${contactHtml(contactEmail)}.</p>
<p>Lire aussi la <a href="${PAGE_PATHS.privacy}">politique de confidentialité</a> et les <a href="${PAGE_PATHS.terms}">conditions d'utilisation</a>. Le code du module est public : <a href="${SOURCE_URL}">page du projet</a>.</p>`,
  });
}

export function privacyPage(contactEmail: string | undefined): string {
  const contact = contactHtml(contactEmail);
  return renderPage({
    id: 'privacy',
    title: 'Politique de confidentialité',
    description: "Ce que le module d'irrigation lit, garde et envoie, combien de temps, et comment faire effacer ses données.",
    body: `<h1>Politique de confidentialité</h1>
<p class="updated">Texte du ${TEXT_DATE}.</p>
<p class="note">Ce texte décrit honnêtement ce que fait le module aujourd'hui. Il n'a pas encore été relu par un juriste ; il le sera avant qu'une autre ferme que celle du responsable soit reliée.</p>

<h2>Qui est responsable</h2>
<p>${RESPONSIBLE}. Pour toute question ou demande sur vos données : ${contact}.</p>

<h2>Ce que le module lit dans Ouvre ta ferme</h2>
<p>Le module lit, et ne fait que lire, le plan de votre ferme dans Ouvre ta ferme. Il n'écrit jamais rien dans Ouvre ta ferme et n'y modifie rien. Il demande seulement ces droits, en lecture :</p>
<ul>
<li>structure et configuration : la ferme reliée, ses saisons ;</li>
<li>parcellaire : parcelles, jardins et planches ;</li>
<li>cultures : séries et emplacements ;</li>
<li>espèces et variétés ;</li>
<li>interventions : pour reconnaître les semis et les plantations.</li>
</ul>
<p>Il ne demande rien sur les ventes, les clients, la gestion ni l'équipe.</p>

<h2>Ce que le module garde</h2>
<ul>
<li><strong>Une copie du plan lu dans Ouvre ta ferme</strong>, renouvelée quand le module en a besoin (à l'usage, au calcul du planning du matin, ou quand vous demandez une actualisation) ; une copie de moins de quatre heures est réutilisée telle quelle. La dernière copie réussie est gardée pour que le module reste utilisable quand Ouvre ta ferme ne répond pas.</li>
<li><strong>Ce que vous saisissez dans le module</strong> : matériel d'arrosage, ressources en eau, arrosages faits, pluie mesurée, observations du sol, objectifs, réglages et alertes.</li>
<li><strong>La météo de votre commune</strong> : prévisions et valeurs passées, jour par jour.</li>
<li><strong>Un identifiant de connexion</strong> fourni par le service de connexion (une suite de caractères, pas votre adresse électronique). Votre adresse s'affiche à l'écran une fois connecté, mais le module ne l'enregistre pas.</li>
<li><strong>Si vous activez les notifications</strong> : l'adresse technique que votre navigateur fournit pour les recevoir.</li>
<li><strong>Dans votre navigateur</strong> : deux préférences d'affichage (le fond de carte choisi, l'avancement de la visite guidée). Aucun témoin (cookie) publicitaire ni de mesure d'audience ; le seul témoin est celui de la connexion.</li>
</ul>

<h2>Combien de temps</h2>
<ul>
<li>Vos données de ferme sont gardées tant que la ferme utilise le module. Sur demande, elles sont effacées entièrement, dans un délai d'un mois au plus.</li>
<li>Les journaux techniques du module (erreurs, durées) sont gardés sept jours par l'hébergeur.</li>
<li>L'abonnement aux notifications est gardé jusqu'à ce que vous les désactiviez ou que votre navigateur le retire.</li>
</ul>

<h2>Où sont les données</h2>
<p>Chez l'hébergeur Cloudflare (société américaine Cloudflare, Inc.), dans sa base de données D1 et ses serveurs Workers. L'emplacement exact des serveurs n'est pas choisi par le responsable du module.</p>

<h2>Ce qui sort vers l'extérieur</h2>
<p>Rien n'est vendu, loué ni transmis à des fins commerciales. Seuls ces échanges ont lieu, chacun pour faire fonctionner le module :</p>
<ul>
<li><strong>Météo</strong> : le nom et le code postal de la commune sont envoyés à Open-Meteo pour trouver ses coordonnées ; les coordonnées de la commune sont envoyées à Open-Meteo et à Visual Crossing pour lire la météo. Aucun nom de personne ni de ferme.</li>
<li><strong>Vue satellite</strong> : les images viennent de l'IGN (Géoplateforme) ; votre navigateur les demande directement pour la zone affichée, l'IGN voit donc votre adresse IP.</li>
<li><strong>Notifications</strong> : elles passent par le service de votre navigateur (Google, Mozilla, Apple…), sous une forme chiffrée.</li>
<li><strong>Connexion</strong> : le code de connexion vous est envoyé par courriel par le service de connexion de Cloudflare (Cloudflare Access), qui garde la trace des connexions.</li>
<li><strong>Ouvre ta ferme</strong> : le module ne lui envoie que ses demandes de lecture ; Ouvre ta ferme garde de son côté un journal de ces lectures, visible par la ferme.</li>
</ul>

<h2>Ce site public</h2>
<p>Les pages que vous lisez ici ne gardent aucune trace des visites : aucun journal, aucun témoin, aucune mesure d'audience. Comme pour tout site, l'hébergeur traite techniquement chaque demande pour la servir.</p>

<h2>Vos droits</h2>
<p>Vous pouvez demander à voir vos données, les corriger, les faire effacer, en recevoir une copie ou vous opposer à leur usage : ${contact}. Vous pouvez aussi retirer à tout moment l'accès du module à votre ferme depuis Ouvre ta ferme. Si une réponse ne vous satisfait pas, vous pouvez vous adresser à la <a href="${CNIL_URL}">CNIL</a>.</p>

<h2>Si Ouvre ta ferme change ou s'arrête</h2>
<p>Le module garde la dernière copie lue et dit de quand elle date ; il n'invente aucune donnée. Si Ouvre ta ferme retire l'accès, le module cesse de lire, et vos données peuvent être effacées sur demande.</p>

<h2>Adresses du module</h2>
<p>Le module : <code>${MODULE_URL}</code>. Adresse de retour après autorisation dans Ouvre ta ferme : <code>${OAUTH_RETURN_URL}</code>.</p>

<h2>Changements de ce texte</h2>
<p>Toute modification est datée en tête de cette page. Le texte suit ce que fait le code ; son historique est public sur la <a href="${SOURCE_URL}">page du projet</a>.</p>`,
  });
}

export function termsPage(contactEmail: string | undefined): string {
  return renderPage({
    id: 'terms',
    title: "Conditions d'utilisation",
    description: "Les conditions d'utilisation du module d'irrigation pour Ouvre ta ferme.",
    body: `<h1>Conditions d'utilisation</h1>
<p class="updated">Texte du ${TEXT_DATE}.</p>
<ul>
<li><strong>Un service fourni tel quel.</strong> Le module est en essai, gratuit pendant le pilote, sans garantie de disponibilité ni d'absence d'erreur.</li>
<li><strong>Une aide à la décision.</strong> Les besoins, plannings et alertes sont des calculs à partir de vos réglages et de la météo. Ils ne garantissent aucun résultat : les décisions d'arrosage restent celles de l'exploitant.</li>
<li><strong>Votre ferme sous votre responsabilité.</strong> L'exploitant reste responsable de sa ferme, de son eau et du respect des arrêtés de restriction.</li>
<li><strong>Lecture seule.</strong> Le module ne modifie rien dans Ouvre ta ferme. L'accès se retire à tout moment depuis Ouvre ta ferme.</li>
<li><strong>Vos données.</strong> Elles sont traitées comme le dit la <a href="${PAGE_PATHS.privacy}">politique de confidentialité</a>.</li>
<li><strong>Arrêt.</strong> Vous pouvez arrêter quand vous voulez et demander l'effacement de vos données. Si le service s'arrête, vous en serez prévenu à l'avance autant que possible.</li>
</ul>
<p>Responsable : ${RESPONSIBLE}. Contact : ${contactHtml(contactEmail)}.</p>`,
  });
}
