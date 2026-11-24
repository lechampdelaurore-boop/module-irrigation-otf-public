# Contrat — La lenteur du module (correctif du 24 novembre 2026)

Roadmap section 6 duodecies. Décisions D-322 (N1), D-323 (N2), puis la
suivante pour N3. Ce contrat dit le constat, les mesures et les règles des trois
corrections ; chacune a sa PR.

## 1. Le constat

Le 24 novembre 2026 à 22 h 33 (heure de Paris), le porteur écrit : « Le
logiciel rame, que faire ? », sur le téléphone (application installée le
matin même, D-302) comme à l'ordinateur ; « L'ouverture du logiciel, c'est le
pire, ensuite le moindre changement de page. »

## 2. Les mesures (avant tout code)

Sur une copie locale de la démonstration, sans toucher la ferme réelle ni
Cloudflare :

- **Les PR du 24 novembre ne sont pas en cause.** Avant (`e88dcb7`, 22 novembre)
  et après (`89b7ca8`, O3) : 173 puis 175 lectures de la base pour ouvrir
  « Aujourd'hui », deux de plus sur les autres pages, des temps égaux à 10 %
  près. Le service du navigateur de D-302 n'intercepte aucune requête (il n'a
  pas de gestionnaire `fetch`).
- **Trois freins anciens**, mesurés sur la copie construite comme en ligne
  (`vinext build`, Worker local), un téléphone simulé (Pixel 7, processeur
  ralenti quatre fois, réseau 4G à 40 ms) et 20 ms par lecture de la base
  (l'ordre de grandeur d'une base D1 éloignée du Worker, supposé, pas mesuré) :
  1. **Chaque clic du menu recharge toute l'application** : les liens du menu
     sont des liens simples ; le navigateur redemande la page entière,
     relance une quarantaine de scripts et refait tout l'écran. Environ 2 s
     par changement de page.
  2. **L'ouverture charge deux pages de suite** : l'adresse de départ de
     l'application, `/irrigation`, montre « Ouverture du module… », attend
     que tous les scripts soient chargés, puis recharge vers « Aujourd'hui ».
     Environ 0,4 s de plus qu'en ouvrant « Aujourd'hui » directement.
  3. **Le serveur relit la base trop souvent** : environ 175 lectures pour
     « Aujourd'hui », dont 49 fois l'identifiant du même espace ; environ 120
     par autre page. À 20 ms la lecture, le calcul d'« Aujourd'hui » passe de
     1,15 s à 0,77 s quand cet identifiant n'est lu qu'une fois par requête.

La mesure sur le téléphone réel du porteur, dans son Chrome, reste à faire
quand il l'autorisera : elle dira la part de chaque frein.

## 3. Les règles

**N1. Le menu change de page sans recharger le module (D-322).** Les liens du
menu (menu de gauche, barre du bas et feuille « Plus » au téléphone, encart
« Aujourd'hui ») suivent la page par le routeur de l'application : seul le
contenu de la page est demandé au serveur, sans relancer les scripts.

- Rien n'est demandé d'avance : chaque page reste calculée à la demande, au
  moment du clic. Lire d'avance les pages de la barre multiplierait le travail
  du serveur à l'ouverture (mesuré : 6,2 s au lieu de 3,0 s).
- Ce que l'on voyait après un chargement reste vrai : le titre de la page et
  de l'onglet, la marque de la page dans le menu, la feuille « Plus »
  refermée, la pastille d'« Aujourd'hui » relue, l'adresse nettoyée de
  « Actualiser » et de la page non cochée, le retour du navigateur.
- Le clavier et le lecteur d'écran repartent du contenu de la nouvelle page
  (`#contenu`), comme après un chargement, au lieu de rester sur le lien du
  menu. Un clic sur la page déjà ouverte ne déplace rien.
- Les autres liens (tuiles, jauges, « Actualiser », bandeaux) ne changent pas
  dans cette PR : un geste à la fois.
- Parcours P59, aux deux largeurs.

**N2. L'adresse de départ mène à la page d'arrivée sans attendre les
scripts (D-323).** L'application installée s'ouvre sur `/irrigation`, comme le
logo du module et les favoris : la page d'attente « Ouverture du module… »
attendait que tous les scripts du module soient chargés et l'écran repris,
puis rechargeait vers la page d'arrivée.

- Sans ancre, un script lu avec la page conduit aussitôt à la page d'arrivée
  (« Aujourd'hui », ou la première page cochée), avec la saison, la semaine et
  « Actualiser » de l'adresse, comme avant.
- Avec une ancre, celle des anciennes notifications `/irrigation#…`, qui ne
  parvient jamais au serveur, rien ne change : la conduite reste celle du
  navigateur (`legacyRedirect`).
- L'adresse de départ du manifeste ne change pas : une application déjà
  installée en profite sans rien refaire.
- Mesuré (même banc que la section 2) : environ 0,4 s de moins à l'ouverture.
- Parcours P59 : tous les scripts du module refusés, `/irrigation` mène
  encore à « Aujourd'hui ».

**N3. L'identifiant de l'espace n'est lu qu'une fois par requête** (fil à
part, en Opus 5.5 · Max : il touche à la résolution de l'espace d'une ferme,
donc à l'isolation).

## 4. Ce qui ne change pas

Aucune migration, aucun calcul, aucun texte, aucun réglage de Cloudflare ;
toutes les fermes voient les mêmes pages, plus vite.
