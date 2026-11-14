# Contrat de la vue satellite de la parcelle (S3)

Écrit le 14 novembre 2026 sur le mandat d'autonomie de la nuit du porteur,
sans code, en Sonnet 5.5 · Moyen (travail sans code de la grille). Chantier S3
de la section 5 sexies de `ROADMAP.md`, décision D-110. **La relecture du
porteur est obligatoire avant tout code de S3.** **Validé par le porteur le
14 novembre 2026 à 15 h 41** (« 3 je valide ») ; le code commence le jour
même par la PR 1, le domaine (section 11, D-111).

## 1. Ce que le porteur a choisi

Le 8 novembre 2026 à 11 h 13, entre une carte Mapbox payante comme celle
d'Ouvre ta ferme et le gratuit, le porteur a répondu « le gratuit » :
**MapLibre GL JS** (licence BSD) avec les **orthophotos de l'IGN** (France,
sans clé), un fond interchangeable pour les fermes hors de France, **pas de
Mapbox**. Le module étant multi-fermes, rien ci-dessous ne suppose la ferme
du porteur. La recherche est dans
`/mnt/project-files/vue-satellite/recherche-vue-satellite-otf.md`.

L'onglet « Vue satellite » est un **affichage seulement** : il ne calcule
rien, n'écrit rien dans Ouvre ta ferme, ne change aucune règle d'eau (D-003,
D-047 intacts).

## 2. Les trois faits à constater, et leur état

Le fil de contrat a pour consigne de les constater sans secret et sans
dépasser quatre requêtes par seconde sur la ferme fictive « Ferme v2 »
n° 4394, en lecture seule. **Aucun des trois n'a pu être vérifié de bout en
bout cette nuit ; ils sont donc dits « non vérifiés » et deviennent des
conditions d'entrée du code (section 9).**

### Fait 1 — la forme réelle de `coordinates` : **non vérifié**

Aucun appel réel n'a été fait : l'accès à `/zoneList` et `/plotList` demande un
jeton OAuth2 de la ferme, que ce fil n'a pas et ne doit ni voir ni saisir
(AGENTS.md, « Sécurité »). Ce que la documentation d'OTF dit : `coordinates`
est un tableau de points `[longitude, latitude]`, **nullable**, sur les
parcelles (`/zoneList`) et les jardins (`/plotList`) ; aucune géométrie sur
`/bedList`. Ce que la documentation ne dit pas : anneau fermé ou non, polygone
simple ou multiple, trous, système de coordonnées (WGS 84 supposé).

Faute de constat, le contrat **ne parie pas sur une forme** : la lecture est
tolérante (F201) et le premier travail du code est de constater la forme
réelle (section 9, condition A) et de la consigner ici par une section datée.

### Fait 2 — une tuile IGN réelle : **non vérifié**

L'essai a échoué dans le bac à sable de ce fil : le relais réseau refuse
`data.geopf.fr` (« CONNECT tunnel failed, response 403 », sur la tuile comme
sur `GetCapabilities`), et la lecture par l'outil de page web a donné une
erreur de serveur sur la tuile. Ce qui est établi par une lecture partielle de
`GetCapabilities` (service `https://data.geopf.fr/wmts`) : « Fees : none » et
« AccessConstraints » renvoyant aux conditions générales de cartes.gouv.fr.
Ce qui reste à constater : le nom exact de la couche, le jeu de tuiles, le
format, l'étendue et le zoom maximal, et qu'une tuile s'obtient sans clé.

Le modèle d'adresse visé, **à confirmer par le code** (condition B), est celui
du service WMTS standard de la Géoplateforme :

```text
https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0
  &LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg
  &TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}
```

(jeu `PM` = Mercator sphérique, tuiles de 256 px, comme attend MapLibre en
source raster.)

### Fait 3 — les conditions d'usage de cartes.gouv.fr : **constaté**

Lu le 14 novembre 2026 sur `https://cartes.gouv.fr/cgu` :

- « L'utilisation des géodonnées et géoservices est gratuite (sauf licence
  spécifique) » ; les données suivent la licence que leur fournisseur
  indique, à défaut la Licence Ouverte (Etalab) ;
- la diffusion d'images tuilées WMTS est « **non soumise à limite d'usage** » ;
  les autres services ont une limite par seconde et par adresse (erreur 429) ;
- un usage abusif ou une menace pour le fonctionnement de la Géoplateforme
  peut faire **limiter ou bloquer** l'accès ; disponibilité de référence
  99,50 % par an, **sans compensation** ;
- les points d'accès publics sont libres ; une clé n'est exigée que pour les
  accès privés ;
- la page **ne dit pas** l'attribution à afficher ni l'usage commercial des
  tuiles : ces deux points restent à lire dans la licence du jeu de données
  (condition C).

Conséquences retenues : (a) aucune clé, aucun compte ; (b) pas d'aspiration
de tuiles ni de précharge, seulement ce que l'écran demande ; (c) **le fond
peut disparaître sans prévenir, l'onglet fonctionne alors sans lui** (F206) ;
(d) l'attribution « © IGN » est affichée dans tous les cas (F210).

## 3. Où et quoi

**F204 — place.** Un onglet « Vue satellite » dans le bloc de chaque parcelle
de « Matériel et placement » (`app/irrigation/materiel/`). Il suit la case
« Matériel et placement » du choix des fonctionnalités (3.8) : aucune nouvelle
case. Un seul onglet de ce bloc est ouvert à la fois ; l'onglet n'est chargé
(bibliothèque comprise) qu'à son ouverture.

**F205 — contenu.**

- carte cadrée sur la parcelle choisie (F203) ;
- trait blanc épais autour de la parcelle, son nom ;
- les jardins en contour, **vert** pour le plein champ, **autre couleur**
  (bleu eau de la charte) pour l'abri ; chacun avec son nom et son mode ;
- une bascule « Satellite / Dessin » (fond uni clair), choix mémorisé par
  appareil (`localStorage`, entouré de `try/catch`, la page s'affiche sans) ;
- échelle en mètres, zoom, plein écran, attribution du fournisseur ;
- **à côté, une liste texte des jardins** (nom, mode, surface d'OTF, état du
  contour) : alternative à la carte, au clavier comme au lecteur d'écran ;
  toucher une ligne met le jardin en évidence, toucher un jardin sur la carte
  met sa ligne en évidence ;
- la **surface affichée est celle d'OTF** (`area`), jamais recalculée à partir
  du polygone (D-003, D-047) ;
- **pas de position des planches** (OTF n'en donne pas) : la liste des
  planches reste celle du bloc, rattachée à son jardin ;
- pas de rotation ni d'inclinaison, projection Mercator.

**Hors S3** : poser le matériel (électrovannes, bassins) sur la carte, tracer
ou modifier un contour, l'impression du plan, les fonds mondiaux autres que
« Dessin ».

## 4. Les données

**F201 — lecture tolérante de `coordinates`.** Une fonction pure du domaine
(`lib/domain/otf/outline.ts`) range ce que reçoit le mapper. Elle accepte :
une liste de points `[lon, lat]` (un anneau) ; une liste d'anneaux (le
premier extérieur, les suivants des trous) ; une liste de polygones ; un objet
de type GeoJSON `Polygon` ou `MultiPolygon` ; la même chose en texte JSON. Elle
ferme un anneau ouvert, ôte les points consécutifs identiques, exige au moins
trois points distincts par anneau, des nombres finis, `lon` dans [-180, 180] et
`lat` dans [-90, 90]. **Un anneau invalide est écarté ; si rien ne reste, le
contour est « absent ». Elle ne lève jamais d'erreur et ne fait jamais
rejeter l'instantané** (comme une planche orpheline aujourd'hui).
Coordonnées arrondies à six décimales (environ 0,1 m).

**F202 — rangement : pas de migration SQL.** Le module garde l'instantané OTF
en JSON dans `otf_snapshots.payload` (`db/snapshot-cache.ts`). Les types
`Zone` et `Plot` gagnent un champ **optionnel** `outline` (liste de polygones,
chacun un anneau extérieur et des trous), le validateur
`isIrrigationSnapshot` l'accepte présent ou absent. Un ancien cache sans
contour n'est donc ni invalide ni migré : « contour absent » jusqu'à la
prochaine lecture OTF. Aucun fichier `drizzle/0031` n'est utile, et le numéro
reste libre. Au-delà de 2 000 points par contour, il est simplifié
(Douglas-Peucker, tolérance 0,5 m) pour tenir la taille du cache.
`docs/otf-contract.md` reçoit une ligne : le contour est un cache technique,
comme les noms.

**Confidentialité.** Un contour situe une ferme. Il suit l'isolation par
utilisateur, exploitation, saison et semaine comme tout l'instantané ; il
n'est jamais journalisé ni mis dans une adresse. Les tuiles étant demandées
**par le navigateur directement à l'IGN** (le Worker ne les relaie pas, il n'en
paie ni n'en cache), l'IGN voit quelle zone est regardée, pas qui la regarde
(adresse du visiteur mise à part) ; l'aide de l'onglet le dit en une phrase.

**F203 — cadrage.** L'emprise (« bounds ») est calculée à la main, sans
bibliothèque de calcul : celle de la parcelle choisie, étendue aux contours de
ses jardins, marge de 10 %. Un contour absent se cadre comme son parent
(jardin → parcelle). Aucune emprise : cas F206 a. Le passage de l'antiméridien
n'est pas géré (aucune ferme n'y est), consigné comme limite.

## 5. Les cas normaux et les pannes (F206)

« Contour absent » est **un cas normal**, jamais un onglet vide ou cassé :

- **a. aucun contour** (parcelle et jardins sans dessin dans OTF) : une carte
  n'est pas montrée ; un encart dit « Cette parcelle n'est pas dessinée dans
  Ouvre ta ferme », que le module ne dessine pas, et la liste des jardins
  reste affichée ;
- **b. des contours en partie absents** : les contours présents sont dessinés,
  la liste dit « contour non dessiné » pour les autres ;
- **c. fond indisponible** (réseau, blocage par l'IGN, tuile sans donnée, zone
  non couverte) : la carte passe d'elle-même au fond « Dessin », le message
  « Fond satellite indisponible » s'affiche, les contours restent ;
- **d. ferme hors de France** : le fond IGN n'est essayé que si le centre de
  l'emprise est dans les emprises de la France (métropole et outre-mer, listées
  dans le code et testées) ; ailleurs, fond « Dessin » et la phrase « Fond
  satellite non configuré pour cette ferme ». L'interface de fond est
  **interchangeable** (un fond = nom, adresse de tuiles, attribution, zoom
  maximal, zone couverte) pour qu'un fond mondial se branche plus tard **avec
  la clé de la ferme concernée, rangée comme les clés OTF, jamais dans le
  dépôt et jamais un achat fait à la place du porteur** ; S3 n'en livre aucun
  autre que « Dessin » ;
- **e. pas de WebGL** (navigateur ancien, essai automatisé sans carte
  graphique) : le dessin est rendu **en SVG** à partir des mêmes contours,
  même emprise, même liste. C'est aussi ce qui rend le parcours navigateur
  déterministe.

## 6. La bibliothèque

**F208.** `maplibre-gl` (licence BSD-3-Clause), **version exacte épinglée** à
la plus récente d'au moins deux semaines au moment du code, chargée par
import dynamique côté navigateur seulement, à l'ouverture de l'onglet ; sa
feuille de style importée avec elle. Le style de carte est un objet construit
par une fonction pure (fond raster ou uni, sources GeoJSON des contours,
couches `fill`, `line`, `symbol`) et testé comme tel. Les polices des noms
suivent `docs/licence-polices.md` (aucune police tierce chargée à distance :
si MapLibre exige des glyphes, ceux de la charte sont servis par le module ;
sinon les noms sont posés en HTML sur la carte). `knip` et `push:check` doivent
passer avec la nouvelle dépendance.

## 7. Téléphone et accessibilité (F213)

- 390 px de large : la carte prend la largeur, hauteur d'environ 60 % de
  l'écran, la liste dessous ; cibles tactiles d'au moins 44 px ;
- gestes coopératifs (`cooperativeGestures`) : un doigt fait défiler la page,
  deux doigts déplacent la carte, pour ne jamais piéger le défilement ;
- une carte n'est jamais le seul moyen de lire une information : tout ce
  qu'elle montre est dans la liste ;
- contraste 4,5:1 des noms sur le fond satellite (halo clair derrière le
  texte) ; mouvement de cadrage supprimé si `prefers-reduced-motion` ;
- la bascule, le plein écran et les lignes de la liste sont atteignables au
  clavier, Échap quitte le plein écran en rendant la main à son bouton.

## 8. Précisions tranchées par la recommandation (mandat de nuit)

F201 à F208 et F213 sont ci-dessus. S'y ajoutent :

- **F207** — les planches n'ont aucun dessin ; elles restent dans la liste de
  leur jardin ;
- **F209** — aucune écriture : l'onglet ne crée ni ne modifie rien en base,
  hors le choix de fond de l'appareil ;
- **F210** — attribution toujours visible sur la carte : « © IGN –
  Géoplateforme » (texte à reconfirmer sur la licence du jeu, condition C), et
  « © contributeurs d'Ouvre ta ferme » n'est pas affichée : les contours sont
  ceux de l'utilisateur ;
- **F211** — la ferme de démonstration n'a pas de contour : elle montre le cas
  « aucun contour » (F206 a) ; les jeux d'essai du code en portent, sur un
  lieu fictif ;
- **F212** — aucun secret : l'adresse des tuiles ne porte aucune clé ; aucune
  clé de ferme n'est créée par S3.

## 9. Conditions d'entrée du code et preuve de fin

**Conditions d'entrée, avant d'écrire le code (le fil de code les remplit et
les consigne ici par une section datée) :**

- **A.** constater `coordinates` sur la ferme « Ferme v2 » n° 4394, lecture
  seule, quatre requêtes par seconde au plus, avec le jeton posé par le
  porteur dans l'environnement du fil de code : forme, fermeture, trous,
  contour absent ; ajuster F201 s'il le faut ;
- **B.** obtenir une vraie tuile IGN depuis un poste dont le réseau n'est pas
  filtré (le Chrome du porteur, avec son accord, ou le poste de la CI),
  confirmer l'adresse, la couche, le zoom maximal et l'absence de clé ;
- **C.** lire la licence de la couche d'orthophotos : attribution exacte,
  usage commercial. **Si l'usage par un service multi-fermes n'est pas
  permis, S3 s'arrête et le porteur décide** (fond « Dessin » seul, ou autre
  fournisseur).

Condition A suppose qu'une parcelle de « Ferme v2 » est dessinée dans OTF ;
sinon le dessin d'un contour d'essai dans l'interface d'OTF est une action du
porteur dans son Chrome (création libre seulement dans cette ferme).

**Preuve de fin :** ce contrat validé ; des tests du domaine
(`tests/otf-outline.test.ts`) : toutes les formes de F201 acceptées, nul,
vide, anneau ouvert, doublons, hors bornes, trou, polygone multiple, plus de
2 000 points, jamais d'exception, jamais de rejet de l'instantané ; l'emprise
et le cadrage (jardin sans contour qui reprend sa parcelle, aucune emprise) ;
la décision « en France » ; la construction du style ; la validation d'un
ancien cache sans `outline` ; le parcours navigateur **P34** aux deux
largeurs (390 px et ordinateur) sur une ferme d'essai à contours : onglet,
liste, bascule, contour absent en partie et en totalité, fond indisponible,
sans débordement ni erreur de console ; la relecture du porteur sur une
vraie ferme.

**Ce que la preuve ne couvre pas :** la qualité et le millésime des photos de
l'IGN ; le rendu WebGL réel (le parcours joue le SVG si WebGL manque) ; un
fond hors de France.

## 10. Découpage conseillé

Une PR de code, après la relecture du porteur : (1) domaine et tests, sans
interface ; (2) composant, onglet et parcours P34. Un seul chantier de code à
la fois ; réglage de la roadmap : Opus 5.5 · Très élevé (ligne S3).

## 11. Le code, PR 1 : le domaine (14 novembre 2026)

Codé le 14 novembre 2026 en Opus 5.5 · Très élevé, après la validation du
porteur, sans interface (D-111). Aucune migration, aucun changement de
comportement visible : l'instantané garde désormais les contours qu'OTF
envoie déjà, et rien ne les affiche encore.

### Condition C, la licence des orthophotos : **levée**

Constaté le 14 novembre 2026 par le fil « Vérifier la licence des images
IGN », et relu par ce fil sur `https://cartes.gouv.fr/cgu` et sur la
Licence Ouverte 2.0 (`https://www.data.gouv.fr/pages/legal/licences/etalab-2.0`) :

- l'usage des géoservices de la Géoplateforme est gratuit, sans clé sur les
  points d'accès publics ; les tuiles WMTS ne sont soumises à aucune limite
  d'usage ; les offres « Essentiel » et « Premium » des conditions visent les
  fournisseurs qui hébergent leurs données, pas ceux qui les affichent ;
- les données sont sous Licence Ouverte (Etalab 2.0) : réutilisation
  permise « à des fins commerciales ou non », donc par un service
  multi-fermes ;
- obligations : mentionner la source (au moins « IGN ») et la date de
  dernière mise à jour, ce qu'un lien vers la source suffit à faire ; ne pas
  donner à la réutilisation un caractère officiel ; ne pas tromper sur les
  données (la date des photos n'est pas affichée par le module, donc jamais
  faussée) ;
- l'IGN peut limiter ou bloquer un usage abusif : le repli « Dessin »
  (F206 c) le couvre.

**Reste à faire en PR 2, avec la condition B** : le nom exact de la couche,
son zoom maximal, et la page de la couche (avec sa date) vers laquelle pointer
le lien du crédit, s'il en existe une plus précise que `cartes.gouv.fr`.

### Conditions A et B : **toujours ouvertes**

Elles ne bloquent pas la PR 1 (la lecture est tolérante, F201) mais la PR 2,
l'interface : A demande le jeton de « Ferme v2 » n° 4394 posé par le porteur
lui-même, B une tuile chargée dans son Chrome. Le fond IGN du code
(`lib/domain/satellite-view/basemaps.ts`) porte l'adresse du contrat et un
zoom maximal de 19, **provisoires** jusqu'à B.

### Précisions faites en codant (F214 à F223, par la recommandation)

- **F214 — où vit le code.** La lecture et le rangement dans
  `lib/domain/otf/outline.ts` ; le reste dans `lib/domain/satellite-view/` :
  `framing.ts` (cadrage), `basemaps.ts` (fonds et « en France »),
  `map-style.ts` (style), `view.ts` (ce que l'onglet montre),
  `svg-drawing.ts` (dessin de secours). Un contour rangé est une liste de
  polygones `{ exterior, holes }`, chaque anneau fermé ; un contour absent
  est un champ qui manque, jamais `null` ni une liste vide.
- **F215 — un point.** Deux nombres, ou trois (une altitude, permise par
  GeoJSON, ignorée) ; un seul point invalide rend son anneau invalide plutôt
  que d'être ôté, pour ne jamais déformer un dessin. La forme (anneau,
  polygone, liste de polygones) se lit à la profondeur du premier nombre
  rencontré, pas du premier élément, pour qu'un premier point abîmé ne
  trompe pas la lecture. Un texte JSON n'est lu qu'une fois.
- **F216 — la simplification.** Le seuil de 2 000 points compte tous les
  points rangés du contour, trous et points de fermeture compris ; chaque
  anneau est alors simplifié à 0,5 m sur un plan local ; un anneau réduit à
  moins de trois points distincts est écarté. Un contour qui reste au-delà
  de 2 000 points après simplification est gardé tel quel (limite consignée,
  aucune ferme connue n'en approche).
- **F217 — l'ancien cache.** Absent, le contour laisse l'instantané valide ;
  présent mais abîmé, il fait écarter le cache, comme un plan de culture
  abîmé : le module relit alors OTF.
- **F218 — la marge.** 10 % de la largeur à l'est et à l'ouest, 10 % de la
  hauteur au nord et au sud ; un contour sans largeur ou sans hauteur prend
  la marge de l'autre sens ; le cadrage s'arrête aux latitudes de Mercator
  (85,05°).
- **F219 — les noms.** Posés en HTML sur la carte (F208, son repli), sans
  couche de texte ni glyphe chargé à distance ; à un point toujours
  intérieur du plus grand morceau du contour (au milieu du plus large
  segment de sa ligne de mi-hauteur), même en L ou troué.
- **F220 — les couleurs.** Aucune couleur dans le domaine : l'interface passe
  celles de la charte. Le contour de la parcelle est blanc sur les photos, à
  l'encre de la charte sur le « Dessin », où le blanc ne se verrait pas. Un
  jardin touché se met en évidence par un état de la carte, sans refaire le
  style ; parcelle et jardin ont des clés distinctes (`zone:…`,
  `garden:…`), OTF pouvant leur donner le même numéro.
- **F221 — « en France ».** La métropole par un polygone à grands traits qui
  passe quelques kilomètres au-delà des côtes et des frontières, la Corse et
  dix territoires d'outre-mer par un rectangle chacun (Guadeloupe,
  Martinique, Guyane, La Réunion, Mayotte, Saint-Pierre-et-Miquelon,
  Saint-Martin et Saint-Barthélemy, Wallis-et-Futuna, Polynésie française,
  Nouvelle-Calédonie). Une ferme frontalière peut voir le fond IGN essayé ;
  sans image, la carte passe au « Dessin » (F206 c). Que la couche ait des
  images partout se vérifie avec B.
- **F222 — la bascule mémorisée.** Le satellite par défaut ; toute valeur
  mémorisée autre que « dessin » y revient.
- **F223 — le crédit.** « © IGN – Géoplateforme », lien vers
  `https://cartes.gouv.fr`, ouvert dans un nouvel onglet ; le « Dessin » ne
  crédite personne.

**Preuve de la PR 1** : `tests/otf-outline.test.ts` (toutes les formes de
F201, nul, vide, anneau ouvert, doublons, hors bornes, trou, polygone
multiple, plus de 2 000 points, jamais d'exception, jamais de rejet de
l'instantané, aucune requête de plus à OTF) ;
`tests/satellite-view.test.ts` (cadrage, jardin sans contour qui reprend sa
parcelle, aucune emprise, « en France », choix du fond, style, ce que
l'onglet montre, ferme de démonstration sans contour, dessin SVG) ;
`tests/snapshot-validation.test.ts` (ancien cache sans contour, contour
abîmé).
