# Contrat de la réserve du sol (RFU)

Écrit le 27 octobre 2026 à partir des réponses du porteur dans la séance du
jour, sur son mot ; extension 5 ter de `ROADMAP.md`, décision D-041. Il fixe
les règles avant tout code. Précisé le 30 octobre 2026 par le porteur : la
RFU s'exprime toujours en mm par mètre de sol (D-046, section datée à la
fin). Révisé le même jour sur le complément « jauge RFU » fourni par le
porteur : la consommation devient l'ETM de la 5 quater, la RFU du sol se
corrige des cailloux, un seuil de déclenchement par culture s'ajoute, la
jauge reste une information (D-047, section datée à la fin). **Relu par le
porteur le 31 octobre 2026, point par point** : seuils sur la part de
référence des deux tiers, parts p et profondeurs de toutes les cultures de
référence, jauge continue sur une planche sans culture avec le modèle de sol
nu de la FAO-56 et les états de surface, réglages confirmés ou changés
(D-053, section datée à la fin). **Révisé le 3 novembre 2026 sur le
complément « profondeurs racinaires par stade » du porteur, point par
point** : une profondeur par stade au lieu de la moitié au premier stade,
tomate et courgette remises à leur place, plafond de sol par parcelle, melon
et asperge plafonnés à 0,60 m (D-056, section datée à la fin). Les choix
faits en écrivant ces révisions sont rassemblés à la fin, pour qu'il les
confirme à la relecture de la PR. **Précisé le 6 novembre 2026** en codant le
domaine, sur le mandat du porteur de trancher lui-même chaque question : le
seuil d'arrosage réglable par l'exploitation (D-059) et dix-sept précisions
(D-060), sections datées à la fin.

## Objet

Mettre sous les yeux du maraîcher, au moment de décider d'un arrosage, où en
est la réserve facilement utilisable (RFU) du sol de chaque jardin : le plein
est-il fait, que reste-t-il, que deviendra-t-elle d'ici dimanche avec la météo
et le plan de la semaine. La jauge suit chaque planche sans interruption,
qu'elle porte une culture ou non (D-053).

La jauge est une **information**. Elle n'entre ni dans le besoin, ni dans le
moteur de planning, ni dans la dose : le besoin part de l'objectif seul
(D-010) et le logiciel expose les faits, l'utilisateur décide (D-028). Le
seuil de déclenchement et la dose conseillée qu'elle affiche sont aussi des
informations : une planche sous son seuil ne monte pas d'elle-même dans les
priorités, le maraîcher les règle à la main s'il le veut (D-047, choix du
porteur du 30 octobre 2026).

## Vocabulaire

- **Réserve du sol** ou **RFU** : l'eau du sol que les racines prélèvent sans
  stress, toujours exprimée en mm par mètre de sol, en mm/m (D-046). Jamais
  « réserve » seule, qui désigne dans tout le logiciel la réserve d'eau de la
  ferme alimentée par le forage (`docs/water-resources-contract.md`).
- **Réserve utile** : toute l'eau que le sol retient pour les plantes ; la
  RFU en est une part.
- **Part de référence** : la part de la réserve utile que représente la RFU
  du laboratoire, sans unité ; 2/3 par défaut, celle du CRIIAM (D-053).
- **Profondeur prélevée** : celle de l'échantillon analysé, qui n'est qu'une
  information ; elle ne change pas la RFU.
- **RFU du laboratoire** : la RFU donnée par l'analyse, en mm/m.
- **Part de cailloux** : la part du volume de sol occupée par les cailloux,
  que le laboratoire, qui tamise l'échantillon, ne compte pas ; en %.
- **RFU du sol** : RFU du laboratoire × (1 − part de cailloux), arrondie au
  mm/m entier ; c'est elle qui sert au calcul.
- **RFU par cm** : RFU du sol ÷ 100, en mm/cm.
- **Profondeur racinaire** : la profondeur explorée par les racines d'une
  culture, en cm.
- **Profondeur de référence** : la profondeur sur laquelle est suivie une
  planche sans culture, en cm.
- **Capacité** d'une planche : RFU par cm × profondeur racinaire, ou
  profondeur de référence sans culture, en mm.
- **Plein** : la planche à sa capacité, 100 %.
- **Jauge** : l'état de la réserve du sol, en mm et en % du plein.
- **Curseur** : le geste par lequel l'utilisateur enregistre l'état du sol
  qu'il observe.
- **Consommation** : l'eau que la culture tire du sol en un jour, son ETM
  en mm/j (`docs/crop-water-need-contract.md`, 5 quater).
- **Part utilisable p** : la part de la réserve utile qu'une culture consomme
  sans souffrir, d'après le tableau 22 de la FAO-56, sans unité.
- **Seuil de déclenchement** : l'état de la jauge, en mm, sous lequel il est
  temps d'arroser la planche.
- **Drainage** : l'eau apportée au-delà de ce que le sol retient, perdue en
  profondeur, en mm.
- **État de surface** : ce qui couvre une planche sans culture : nue, bâchée
  imperméable, bâchée perméable, paillée, engrais vert, enherbée (D-053).
- **Couche de surface** : les premiers centimètres du sol, d'épaisseur Ze,
  10 cm par défaut, d'où s'évapore l'eau d'un sol sans culture (FAO-56,
  chapitre 7).
- **Eau évaporable (TEW)** : ce que la couche de surface peut perdre par
  évaporation entre l'état humide et l'état sec, en mm.
- **Eau facilement évaporable (REW)** : la part de TEW qui s'évapore à pleine
  vitesse ; au-delà, l'évaporation ralentit ; en mm.
- **Épuisement de surface De** : l'eau perdue par la couche de surface depuis
  son dernier mouillage, en mm, de 0 à TEW.
- **Réserve profonde** : la RFU sous la couche de surface, jusqu'à la
  profondeur de référence, que l'évaporation d'un sol nu ne touche pas.

## Données saisies par l'utilisateur

### Le sol

Il se renseigne **par parcelle**. Un jardin ou un abri peut porter sa
**valeur propre** de RFU, qui prime sur celle de sa parcelle.

| Champ | Unité | Règle |
| --- | --- | --- |
| RFU du laboratoire | mm/m | strictement positive |
| Part de cailloux | % | de 0 à 99, facultative |
| Part de référence | — | strictement entre 0 et 1 ; 2/3 par défaut |
| Provenance | — | « analyse », « estimation » ou « par défaut » |
| Profondeur prélevée | cm | facultative, information |
| Source | texte | laboratoire, référence et date d'analyse, remarque |
| Eau évaporable TEW | mm | strictement positive ; 14 par défaut |
| Eau facilement évaporable REW | mm | strictement positive, inférieure à TEW ; 7 par défaut |
| Épaisseur de la couche de surface Ze | cm | strictement positive ; 10 par défaut |

- La **RFU du sol** se calcule : RFU du laboratoire × (1 − part de cailloux),
  arrondie au mm/m entier, la précision d'une analyse. Elle s'affiche à côté
  de la saisie.
- Une **part de cailloux non renseignée** compte pour 0, et l'écran le
  signale à côté de la jauge.
- La **part de référence** dépend de la méthode du laboratoire, pas de la
  culture : la moitié pour la FRAB AuRA, les deux tiers pour le CRIIAM. Le
  porteur retient les deux tiers le 31 octobre 2026, « le CRIIAM donne les
  protocoles les plus pratiques et éprouvés » (D-053) ; elle se change avec
  l'analyse si le laboratoire en indique une autre.
- **TEW, REW et Ze** viennent du tableau 19 de la FAO-56 pour un limon
  sableux, la classe du sol de la ferme (59 % de sables), Ze de 10 cm :
  TEW de 15 à 20 mm et REW de 6 à 10 mm, milieux de fourchette corrigés des
  18 % de cailloux, 17,5 × 0,82 ≈ 14 mm et 8 × 0,82 ≈ 7 mm. Ce sont des
  valeurs de départ par parcelle, modifiables.
- Un **jardin de plein champ** sans valeur propre prend la RFU de sa
  parcelle.
- Un **abri** sans valeur propre prend celle de sa parcelle, **sans
  mention** : la RFU vaut pour toute la parcelle (D-053, qui retire la
  mention « non mesuré » de D-047). Une analyse saisie plus tard pour l'abri
  devient sa valeur propre.
- Chaque saisie est une révision datée, conservée ; la plus récente vaut à
  partir de sa date (D-006).
- **Avertissement de vraisemblance** : quand la RFU du laboratoire saisie
  dépasse 200 mm/m, soit 2 mm/cm, l'écran avertit que la valeur dépasse ce
  qu'un sol retient d'ordinaire et rappelle que la RFU se saisit en mm par
  mètre de sol. L'enregistrement n'est pas bloqué.
- **Limites affichées** à côté de la RFU : l'analyse ne décrit que l'horizon
  prélevé (0-20 cm sur la ferme) et le calcul suppose la même texture en
  dessous ; une semelle de labour ou un sous-sol différent change la
  profondeur réellement explorée, à vérifier à la bêche ou à la tarière.

Cas de la ferme du porteur, au 27 octobre 2026 : analyse Celesta-lab du 31
mars 2025, plein champ, Tronget, RFU « estimée » à 62 mm, échantillon prélevé
sur 0-20 cm, sable argilo-limoneux (argiles 12 %, limons 29 %, sables 59 %
dont 46 % de sables grossiers), 0 % de cailloux, densité apparente 1,3. Le
rapport ne dit ni la profondeur de calcul ni la méthode. Sur 20 cm, la RFU par
cm vaudrait 3,1 mm/cm, au-delà du vraisemblable pour ce sol ; sur une
profondeur d'enracinement par défaut d'environ 60 cm, environ 1 mm/cm. La
saisie de départ est donc 62 mm sur 60 cm, au statut « hypothèse », jusqu'à
la réponse du laboratoire (point ouvert 42 de `ETAT_DU_PROJET.md`).

Réponse du porteur le 30 octobre 2026, après confirmation du laboratoire :
« c'est 62mm sur 1m », puis « la RFU s'exprime toujours en mm par mètre ». La
ferme se saisit donc 62 mm/m, soit 0,62 mm/cm, sous le seuil de vraisemblance.

Complément du porteur le même jour (D-047) : rapport Celesta-lab / Auréa
52405639, sol sablo-argileux, matière organique 3,9 %. Le rapport indique 0 %
de cailloux, compté sur l'échantillon tamisé ; le porteur estime la part de
cailloux de sa parcelle à **18 %**. La saisie de départ est donc : RFU du
laboratoire 62 mm/m, part de cailloux 18 %, provenance « estimation » pour
les cailloux ; RFU du sol 62 × 0,82 = 50,84, arrondie à **51 mm/m**, soit
0,51 mm/cm. Repères donnés pour comparaison, sans servir au calcul : la
méthode de la FRAB AuRA (réserve utile 110 mm/m × 0,5 × 0,82) donne 45 mm/m,
borne basse ; le repère du CRIIAM (120 mm/m × 2/3 × 0,82) donne 66 mm/m.
L'hypothèse de 60 cm et le statut « hypothèse » disparaissent ; le point
ouvert 42 est fermé. Une culture enracinée sur 30 cm y dispose d'une capacité
de 15,3 mm (51 × 0,30 ; le contrat du 30 octobre écrivait 18,6 mm, chiffre à
62 mm/m, corrigé le 31 octobre 2026).

Relecture du 31 octobre 2026 (D-053) : part de référence 2/3, TEW 14 mm, REW
7 mm, Ze 10 cm.

### La profondeur racinaire et la part utilisable des cultures

Une table « culture → profondeur racinaire par stade (m) et part utilisable
p », modifiable par l'utilisateur, chaque modification datée et conservée, la
valeur d'origine et sa source gardées. Elle porte sur les **cultures de
référence** de la 5 quater ; une espèce d'Ouvre ta ferme (`GET /plantList`)
y est rattachée par la table de correspondance de la 5 quater
(`docs/crop-water-need-contract.md`). Elle s'affiche dans la page
« Coefficients culturaux », à côté des Kc.

Valeurs de départ, validées par le porteur le 31 octobre 2026 (D-053), puis
**profondeurs révisées le 3 novembre 2026 sur son complément (D-056)**. Aucune
source (ITAB, FAO-56, CRIIAM, Ctifl) ne donne de profondeur par stade : les
valeurs sont **construites** ainsi, et restent à vérifier à la tarière.

- **Profondeur initiale** : 0,15 m pour un semis, un bulbille ou une petite
  motte de salade ; 0,20 m pour un plant en motte ou un tubercule
  (hypothèse, sans source chiffrée).
- **Profondeur maximale** : le milieu de la fourchette ITAB quand elle existe
  (fiche « Réserve utile en eau » de la FRAB AuRA, avril 2026, source ITAB),
  sinon la petite valeur de la FAO-56, tableau 22 (la FAO réserve les petites
  valeurs au pilotage de l'irrigation). Les profondeurs de la recherche
  documentaire du 31 octobre 2026 (D-053) ne servent plus que de repère.
- **Croissance linéaire** de la profondeur initiale à la maximale jusqu'à la
  fin de la phase « début + développement » de la FAO-56, puis constante.
- **Valeur par stade** : la valeur lue vers le milieu du stade, arrondie à
  5 cm. Quand la profondeur monte pendant le stade (carotte stade 2,
  poireau), elle est progressive : `profondeur(j) = min(profondeur_fin ;
  profondeur_début + (profondeur_fin − profondeur_début) × jours_dans_stade
  / jours_progression)`.
- **Source enregistrée** pour chaque ligne : « ITAB » ou « FAO-56 tableau
  22 », plus « construit par stade, 3 novembre 2026, à vérifier à la
  tarière ». La règle de construction s'affiche dans la page de référence.
- **Chiffres du porteur du 3 novembre 2026** : tomate 0,65 m (ITAB 50-80 ; le
  « repère » de 50 cm d'un autre document de la formation est un repère plat
  sans stades, non retenu) ; **melon et asperge plafonnés à 0,60 m** (les
  valeurs FAO de 0,80 m et 1,20 m restent notées, mais ne servent pas tant
  qu'aucune observation à la tarière ne les confirme) ; courgette et
  concombre 0,50 m (ITAB 40-60).

- **p** : tableau 22 de la FAO-56 (valeurs pour une ETM d'environ 5 mm/j),
  pour toutes les cultures qui y figurent ; le poireau et le chou kale, qui
  n'y figurent pas, prennent la valeur de leur famille (oignon et ail 0,30 ;
  choux 0,45), choix du porteur du 31 octobre 2026 (« ok pour le chou
  kale »).

**Part utilisable p et seuil** (profondeurs dans les deux tables suivantes) :

| Culture de référence | p | Seuil, en % du plein |
| --- | --- | --- |
| Laitue, salade d'été ; radis ; oignon ; oignon vert ; poireau (famille) ; poivron ; ail | 0,30 | 55 % |
| Épinard ; mâche ; céleri ; fraisier | 0,20 | 70 % |
| Pomme de terre ; carotte ; petit pois ; potiron, courges d'hiver | 0,35 | 47,5 % |
| Tomate ; melon ; pastèque | 0,40 | 40 % |
| Aubergine ; artichaut ; asperge ; chou-fleur ; brocoli ; chou pommé ; chou kale (famille) ; chou de Bruxelles ; haricot ; fève | 0,45 | 32,5 % |
| Courgette ; concombre ; betterave ; navet ; culture sans p | 0,50 | 25 % |

Mâche : p de l'épinard ; navet : p de la betterave (FAO-56, tableau 22).

**Profondeur par stade des dix-sept cultures du CRIIAM** (en m ; stades du
CRIIAM, `docs/crop-water-need-contract.md`) :

| Culture | Stades et profondeur | Source du maximum |
| --- | --- | --- |
| Ail | 1 Fin levée → Formation bulbe : 0,20 · 2 → Grossissement maxi : 0,30 · 3 → 20 j avant récolte : 0,30 · 4 → Récolte : 0,30 | FAO 0,3-0,5 |
| Artichaut | 1 Plantation → 2 mois : 0,30 · 2 → Montée des capitules : 0,60 · 3, 4, 5 : 0,60 ; à partir de la 2e année : 0,60 à tous les stades | FAO 0,6-0,9 |
| Asperge | tous les stades : **0,60** (culture installée ; FAO 1,2-1,8 non retenue, D-056) | plafond du porteur |
| Aubergine | 1 Plantation → Début floraison : 0,30 · 2 → Croissance 3e étage : 0,55 · 3 → Mi-récolte : 0,65 · 4 → Fin culture : 0,65 | ITAB tomate-poivron par analogie (FAO 0,7-1,2) |
| Betterave | 1 Semis → 30 j : 0,20 · 2 → Début tubérisation : 0,50 · 3 → Récolte : 0,70 | ITAB 60-80 |
| Carotte | 1 Semis → 30 j : 0,20 · 2 → Récolte : progressif de 0,40 à 0,70 sur 40 j, puis 0,70 | ITAB 60-80 |
| Chou-fleur | 1 Plantation → Inflorescences : 0,30 · 2 → Début formation : 0,40 · 3 → Récolte : 0,40 | FAO 0,4-0,7 |
| Courgette | 1 Plantation → Floraison : 0,30 · 2 → Mi-récolte : 0,50 · 3 → Fin récolte : 0,50 | ITAB 40-60 |
| Fraisier | tous les stades : 0,25 (culture installée) ; année de plantation : 0,15 au stade 1 | FAO 0,2-0,3 |
| Haricot | 1 30 j après levée → Floraison : 0,35 · 2 → Formation gousses : 0,50 · 3 → Récolte : 0,50 | FAO 0,5-0,7 |
| Melon | 1 Plantation → Début floraison : 0,30 · 2 → Nouaison : 0,55 · 3 → Grossissement : **0,60** · 4 → Récolte : **0,60** | plafond du porteur (FAO melon doux 0,8-1,5 non retenue, D-056) |
| Oignon | 1 Levée → 30 j : 0,20 · 2 → 60 j : 0,35 · 3, 4, 5 : 0,35 | ITAB 30-40 |
| Poireau | 1 Reprise → Récolte : progressif de 0,20 à 0,35 sur 60 j, puis 0,35 | ITAB 30-40 (absent de la FAO) |
| Poivron | 1 Plantation → Début floraison : 0,30 · 2 → Croissance 3e étage : 0,55 · 3 → Mi-récolte : 0,65 · 4 → Fin récolte : 0,65 | ITAB 50-80 |
| Pomme de terre | 1 Levée → 20 j : 0,25 · 2 → Fin tubérisation : 0,50 · 3, 4 : 0,50 | ITAB 40-60 |
| Salade d'été | 1 Plantation → Début croissance active : 0,15 · 2 → Récolte : 0,25 | ITAB 20-30 |
| Tomate | 1 Plantation → Reprise : 0,20 · 2 → Floraison 3e bouquet : 0,45 · 3 → Mi-récolte : 0,65 · 4 → Fin culture : 0,65 | ITAB 50-80 |

**Cultures hors CRIIAM** qui passent par la FAO-56 (`docs/crop-water-need-contract.md`) :
même règle de construction, appliquée sur les durées FAO « début +
développement », en profondeur progressive. Pour les cultures que le
complément du porteur ne nomme pas, les valeurs ci-dessous **résultent de
l'application de la règle** (choix du porteur du 3 novembre 2026, D-056) et
sont listées pour sa relecture de la PR :

| Culture | Profondeur | Source du maximum |
| --- | --- | --- |
| Épinard, mâche | de 0,15 à 0,25 sur 40 j, puis 0,25 | ITAB 20-30 |
| Concombre | comme la courgette | ITAB 40-60 |
| Navet | comme la betterave | ITAB 60-80 |
| Céleri | 0,30 fixe, avec avertissement | proposé, sans source |
| Radis | de 0,15 à 0,30 sur 15 j | FAO 0,3-0,5 |
| Oignon vert | de 0,15 à 0,30 sur 55 j | FAO 0,3-0,6 |
| Brocoli | de 0,20 à 0,40 sur 50 j | FAO 0,4-0,6 |
| Chou pommé, chou kale | de 0,20 à 0,50 sur 50 j | FAO 0,5-0,8 |
| Chou de Bruxelles | de 0,20 à 0,40 sur 50 j (0,75 en D-053, GEI 60-90) | FAO 0,4-0,6 |
| Petit pois | de 0,15 à 0,60 sur 40 j | FAO 0,6-1,0 |
| Fève | de 0,15 à 0,50 sur 135 j | FAO 0,5-0,7 |
| Pastèque, potiron, courges d'hiver | de 0,20 à 0,50 sur 50 j (ITAB de la courgette, sources en désaccord ; FAO 0,8-1,5 non retenue) | analogie |

Les sources sont faibles pour l'ail, l'artichaut, l'aubergine, le melon, la
pastèque, le potiron et le chou de Bruxelles : à vérifier à la bêche à
l'occasion.

Adresses des sources de la recherche :
GEI <https://www.hs-geisenheim.de/fileadmin/redaktion/FORSCHUNG/Institut_fuer_Gemuesebau/Ueberblick_Institut_fuer_Gemuesebau/Geisenheimer_Steuerung/Crop-coefficients_FAO56_2022.pdf> ;
UC <https://oc4h.ucanr.edu/sites/default/files/2017-01/142583.pdf> ;
EQ <https://www.agrireseau.net/agriculturebiologique/documents/MARAI_Chapitre_11Irrigation.pdf> ;
SB <https://www.agrobio-bretagne.org/wp-content/uploads/2017/07/FICHE_IRRIGATION_BD.pdf> ;
GRAB <https://www.grab.fr/wp-content/uploads/2020/09/A19PACA01108_-tomate.pdf>,
<https://www.grab.fr/wp-content/uploads/2021/05/M20PACA01108-REDUCEAU.pdf>,
<https://grab.fr/967> ;
CA33 <https://gironde.chambre-agriculture.fr/fileadmin/user_upload/Nouvelle-Aquitaine/100_Inst-Gironde/Documents/pdf_diversifier_votre_activite/2024_fichediv_artichaut_vf_web.pdf> ;
IRDA <https://irda.qc.ca/media/y0zhj3za/irda-irrigationfraise-fichessyntheses-2012.pdf> ;
WB <https://soilandhealth.org/wp-content/uploads/01aglibrary/010137veg.roots/010137toc.html> ;
FAO-56, tableau 22 <https://www.fao.org/4/X0490E/x0490e0e.htm>.

Les lignes hors cultures du CRIIAM dépendent du rattachement des espèces que
fixe la 5 quater.

- **Selon le stade** : la profondeur du jour est celle du stade de la culture
  (5 quater), ou la valeur progressive du stade quand il y en a une. La règle
  « moitié de la profondeur au premier stade » de D-053 est supprimée (D-056).
  Quand la profondeur change d'un stade à l'autre, la jauge garde son
  taux de remplissage : `réserve_nouvelle = (réserve_ancienne /
  capacité_ancienne) × capacité_nouvelle` (règle 7 du calcul). Asperge et
  fraisier installés : une seule profondeur à tous les stades.
- **Plafond de sol** : si la parcelle a une profondeur de sol renseignée
  (obstacle, semelle, roche), la profondeur utilisée est la plus petite de
  celle de la table et de celle du sol. Champ facultatif par parcelle,
  `profondeur_sol_max_m` ; vide, il ne plafonne rien (D-056).
- **Modèle de données prévu** : `enracinement (culture_ref, ordre_stade NULL,
  profondeur_m, profondeur_fin_m NULL, jours_progression NULL, p_fao56 NULL,
  source, note)` ; `sol_parcelle` + `profondeur_sol_max_m NULL`. Chargement
  par migration versionnée, valeurs modifiables dans l'interface.
- **Sous abri**, la profondeur est la même qu'en plein champ. Le GRAB trouve
  sous abri en goutte-à-goutte l'essentiel des racines de la tomate et du
  concombre dans les 30 premiers cm ; le porteur choisit de ne pas réduire la
  profondeur pour l'instant, à vérifier à la bêche à la recette (D-053).
- **Culture sans profondeur** : 30 cm sont proposés en attendant une saisie,
  avec un avertissement à côté de la jauge ; la jauge n'est pas inconnue.
  Révisé le 30 octobre 2026 (D-047) : le contrat du 27 octobre la rendait
  inconnue.
- **Culture sans p** : p vaut 0,5, la valeur des légumes les moins sensibles
  du tableau 22 ; son seuil est donc 25 % du plein. Choix du porteur du
  31 octobre 2026 (D-053) : avec la part de référence de 2/3, la règle du
  30 octobre, p égale à la part de référence, n'aurait jamais alerté avant la
  planche vide, plus tard que la courgette.
- **p est fixe** par culture : l'ajustement de la FAO selon l'ETM du jour
  (+ 0,04 par mm/j sous 5 mm/j, − 0,04 au-dessus) n'est pas appliqué
  (D-053).

### Le seuil de déclenchement

La RFU du laboratoire est la part de référence de la réserve utile. Une
culture de p plus faible souffre avant d'avoir vidé sa capacité : elle ne
peut consommer que p / part de référence de celle-ci, et il faut l'arroser
quand il en reste le complément.

```text
seuil (mm) = capacité × (1 − min(1 ; p / part de référence))
```

Avec la part de référence de 2/3 : épinard, céleri et fraisier à 70 % de la
capacité ; laitue, oignon, poireau, poivron, ail, radis et oignon vert à
55 % ; pomme de terre, carotte, petit pois et potiron à 47,5 % ; tomate,
melon et pastèque à 40 % ; aubergine, choux, haricot, fève, artichaut et
asperge à 32,5 % ; courgette, concombre, betterave et cultures sans p à 25 %.

Le complément du 30 octobre 2026 écrivait `capacité × min(1 ; p / 0,5)` :
cette formule rend le seuil d'autant plus bas que la culture est sensible, et
place la courgette en alerte dès que la planche n'est plus pleine. Corrigée
en écrivant le contrat (D-047). Le 31 octobre 2026, la part de référence
remplace le 0,5 écrit en dur (D-053).

**Plusieurs cultures sur une planche** : le seuil se calcule sur la capacité
de la planche, celle de la culture la moins profonde, avec la plus petite
part p des cultures présentes, la plus sensible (D-053).

**Une planche sans culture n'a pas de seuil**, sauf un engrais vert, couvert
semé qui consomme comme une culture : il prend p 0,5, faute de valeur, et
alerte à 25 % (choix fait en écrivant, confirmé le 31 octobre 2026).

### L'observation : le curseur

L'utilisateur règle la jauge à tout moment sur l'état du sol qu'il observe, en
% du plein. Le curseur n'a que les crans de ses quatre repères : **sec** à
25 %, **frais** à 50 %, **humide** à 75 %, **détrempé** à 100 % (le porteur, en
ligne le 7 novembre 2026, précision P40 de
`docs/feature-selection-contract.md` ; il allait de 0 à 100 % depuis D-053).
Le serveur accepte toujours 0 à 100 % : une observation plus ancienne entre
deux crans se relit telle quelle, et le curseur part du cran le plus proche.

- **Un curseur par parcelle** règle d'un coup tous ses **jardins de plein
  champ** ; **un curseur par jardin ou par abri** règle ce seul jardin ou cet
  abri. Le curseur de parcelle ne règle pas les abris (D-053, qui change le
  choix du 27 octobre) : on règle surtout la parcelle après une pluie, qui
  n'entre pas sous les abris. Il n'y a pas de curseur par planche.
- Un réglage est une donnée **observée**, horodatée. L'heure est celle du
  geste par défaut ; elle peut être reportée au jour même ou à la veille,
  jamais plus tôt, jamais dans le futur. Une avance de deux minutes au plus
  sur l'heure du serveur, celle d'une horloge d'appareil un peu en avance,
  vaut l'heure du serveur (recette du 6 novembre 2026, comme la date d'une
  pose au point ouvert 47).
- Pour une planche, l'observation qui vaut est la plus récente de celles qui
  la couvrent, de sa parcelle (plein champ) ou de son jardin.
- Une observation n'est jamais modifiée ni effacée : une nouvelle la remplace
  à partir de son heure. L'écart entre ce que le logiciel estimait et ce qui
  a été observé reste lisible.
- Le curseur règle aussi les planches sans culture. Sur l'une d'elles, un
  état t du plein (de 0 à 1) se traduit dans les deux compartiments du modèle
  de sol nu par : De = (1 − t) × TEW, et réserve profonde = t × capacité −
  max(0 ; RFU de surface − De), de sorte que la jauge vaut exactement t ×
  capacité (choix fait en écrivant, confirmé le 31 octobre 2026).

### Quand la jauge est inconnue

La règle « une donnée inconnue n'est jamais inventée » (D-003) ne joue qu'à
deux moments (D-053) :

- **au départ** : avant toute observation, la jauge est **inconnue** ; aucune
  valeur par défaut n'est supposée ;
- **sur un trou de données** : un jour sans pluie connue (hors abri), sans
  ET0, ou, sur une planche cultivée, sans ETM — culture sans Kc ou sans stade
  (5 quater) —, rend la jauge inconnue à partir de ce jour ; l'écran nomme le
  jour et la donnée qui manquent, ou la culture.

Une jauge inconnue repart :

- à la **prochaine observation** qui couvre la planche ;
- ou à la fin d'un **jour d'apports qui remplit la planche**, pluie et
  irrigation, mention « départ par un apport » : sur une planche cultivée,
  des apports qui atteignent sa capacité ; sur une planche sans culture, des
  apports qui atteignent TEW + réserve profonde à son plafond, soit 24,2 mm
  sur 30 cm de la ferme (choix fait en écrivant, confirmé le 31 octobre 2026).

Hors de ces deux moments, la jauge **ne s'arrête jamais** : entre deux
cultures, elle continue avec le modèle de sol nu ou celui de l'état de
surface déclaré.

## Le calcul de la jauge

Le calcul vit dans `lib/domain/` et s'y teste ; l'écran et la persistance
l'appellent.

### Par planche cultivée

1. **Profondeur racinaire** : celle des cultures des séries qui occupent la
   planche ce jour-là (occupation de `docs/series-contract.md`), à leur stade
   du jour (profondeur progressive comprise). Plusieurs cultures : la **plus
   faible** profondeur, celle de la culture qui souffre la première. Un
   plafond de sol de la parcelle, s'il est renseigné, borne cette profondeur.
2. **Capacité** = RFU par cm du jardin × profondeur racinaire, en mm.
3. **Seuil** : sur cette capacité, avec la plus petite part p des cultures
   présentes (voir « Le seuil de déclenchement »).
4. **Départ** : la dernière observation qui couvre la planche ; l'état vaut
   le % observé × la capacité ; à défaut, le départ par un apport ; ou l'état
   repris d'une planche sans culture, en gardant son % du plein.
5. **Chaque jour**, en heure de Paris (D-004), à partir de l'observation :
   état + pluie + irrigation réelle − consommation, borné à 0 en bas et à la
   capacité en haut. L'eau au-dessus de la capacité est perdue par drainage :
   elle est affichée, et ne change aucun cumul existant.
6. **Le jour de l'observation** ne compte qu'après son heure : la pluie et la
   consommation du jour au prorata des heures qui restent dans la journée
   (23 ou 25 heures les jours de changement d'heure), l'irrigation pour la
   part apportée après l'heure observée.
7. **Changement de capacité** (une série qui arrive ou part, un changement de
   stade, une profondeur ou une RFU révisée) : la jauge garde son % du plein ;
   l'état en mm suit la nouvelle capacité.

### Par planche sans culture (D-053)

Une planche sans série ce jour-là porte un **état de surface**, modifiable
depuis sa fiche : **nue** par défaut, si rien n'est déclaré. Quand une série
se termine (au dimanche de la plus tardive de ses semaines de récolte,
réalisées ou attendues, D-057, quand le suivi par série garde sa règle,
`docs/series-contract.md`, D-022 ; pour une culture pluriannuelle, à la fin
de son calendrier de stades, voir « Ce qui dépend de la 5 quater »), la planche passe d'elle-même à « nue » et l'écran
invite à préciser l'état ; quand une série commence, la culture remplace
l'état de surface.

**Profondeur de référence** : celle du premier stade de la prochaine série
de la planche quand elle est connue d'Ouvre ta ferme, sinon 30 cm. Sur la
ferme, à 30 cm : RFU de surface 51 × 0,10 = 5,1 mm, réserve profonde 51 ×
0,20 = 10,2 mm, capacité 15,3 mm.

**Modèle de sol nu** (FAO-56, chapitre 7, simplifié) : sans culture, seule la
couche de surface perd de l'eau, par évaporation ; forte juste après un
mouillage, elle s'arrête d'elle-même quand la surface est sèche ; la réserve
profonde reste en place. La planche est suivie en deux compartiments :

```text
ET0_corr = ET0 × K_abri               (K_abri de la 5 quater : 0,8 sous abri, 1 en plein champ)
Kc_max   = 1,20                       (FAO-56, équation 72, sans couvert)

si De ≤ REW :  Kr = 1                 (phase 1 : surface humide, évaporation maximale)
sinon :        Kr = (TEW − De) / (TEW − REW)

E = min( Kr × Kc_max × ET0_corr ; TEW − De )     (mm/j)

remplissage_surface = min( apports ; De(veille) )
excédent            = apports − remplissage_surface
De                  = De(veille) + E − remplissage_surface          (entre 0 et TEW)
réserve profonde    = min( RFU profonde ; réserve profonde(veille) + excédent ), le surplus drainé
jauge               = max( 0 ; RFU de surface − De ) + réserve profonde
capacité            = RFU de surface + RFU profonde
```

où apports = pluie réelle + irrigation réelle, la pluie valant 0 sous abri.
Une planche nue perd au plus TEW, 14 mm, après un mouillage, dont la RFU de
surface, 5,1 mm ; la réserve profonde reste en place. Ce qui peut encore
entrer dans le sol vaut De + (RFU profonde − réserve profonde).

**Les autres états de surface** : des valeurs de départ, des hypothèses que
le porteur juge assez justes pour la pratique, **réglables par
l'utilisateur** pour l'exploitation, chaque modification datée et conservée
(D-053) :

| État | Évaporation | Pluie comptée | Remarque |
| --- | --- | --- | --- |
| nue | modèle de sol nu | 100 % | état par défaut |
| bâchée imperméable (bâche d'ensilage, plastique plein) | 0 | 0 % | réserve figée ; date de pose affichée ; à la dépose, De = 0 si De était au plus REW à la pose (surface humide, le plastique la garde), sinon la valeur de la pose |
| bâchée perméable (toile tissée) | 10 % du modèle de sol nu | 100 % | |
| paillée (paille, foin, BRF, sans culture) | 50 % du modèle de sol nu | 100 % | |
| engrais vert, levée | ET0 × K_abri × Kc 0,3 | 100 % | profondeur 30 cm, un seul compartiment |
| engrais vert, couverture partielle | Kc 0,6 | 100 % | idem |
| engrais vert, couverture totale | Kc 1,0 | 100 % | idem ; consomme comme une culture, peut atteindre son seuil |
| engrais vert détruit (roulé, fauché, laissé sur place) | comme « paillée » | 100 % | |
| enherbée | Kc 0,6 | 100 % | avertissement « adventices : consommation non maîtrisée » ; un seul compartiment, 30 cm |

Le stade de l'engrais vert se déclare depuis la fiche de la planche, comme
l'état.

**Passages** : d'une planche sans culture à une culture, et retour, la
jauge garde son % du plein (règle 7 ci-dessus) ; à l'arrivée d'une culture,
le bilan repasse à un compartiment ; au départ, l'état t se répartit dans les
deux compartiments comme pour une observation (voir « Le curseur »). Le
complément du porteur répartissait la fin de culture par De = TEW × (1 − t)
et réserve profonde = t × RFU profonde, ce qui faisait perdre d'un coup une
partie de la jauge (9,0 mm devenant 6,0 mm, scénario 28) ; corrigé en
écrivant (D-053). L'arrosage de plantation est une irrigation comme les
autres : il ne met pas la jauge à plein d'office.

**Confiance** : chaque valeur de jauge porte la mention « réglée le … » (dernière
observation ou dernier départ par un apport) ou « calculée depuis N jours ».
Au-delà de 30 jours sans réglage, l'écran propose un contrôle à la bêche ou
au tensiomètre, sans arrêter le calcul.

### Les apports et la consommation

- **Pluie** : la pluie réelle du jour, selon les règles existantes — le
  pluviomètre prime, `0 mm` compris, sur la réanalyse
  (`docs/weather-contract.md`). **Sous abri, la pluie vaut 0** : seule
  l'irrigation remplit la jauge.
- **Paillage plastique sur une planche cultivée** (donnée de la 5 quater) :
  la pluie est comptée **en entier** par défaut, avec la mention « pluie
  comptée en entier malgré le paillage » ; la part de la pluie qui traverse
  le paillage est un réglage de l'exploitation, 100 % au départ, que
  l'utilisateur peut baisser ; la mention dit alors la part comptée (D-053).
- **Irrigation** : les mm reçus par la planche tels que le logiciel les
  calcule déjà pour le besoin, rapportés à la surface mouillée du matériel
  (`docs/wetted-surface-contract.md`). Simplification assumée : un
  goutte-à-goutte ne mouille qu'une bande, la jauge compte ses mm comme le
  besoin les compte.
- **Consommation d'une planche cultivée** = l'ETM du jour de la planche,
  calculée par la 5 quater (`docs/crop-water-need-contract.md`) : ET0 ×
  K_abri × Kc du stade × facteurs, la plus élevée quand plusieurs cultures
  occupent la planche. Révisé le 30 octobre 2026 (D-047) : le contrat du
  27 octobre comptait l'ET0 × un coefficient réglable, qui disparaît.
- **Sur une planche sans culture** : l'évaporation du modèle de sol nu, ou la
  consommation de l'état de surface, à partir de l'ET0 du jour et de sa
  nature (réanalyse, estimée, prévue), selon les règles de la 5 quater.

### Par jardin et par parcelle

Les mm ne s'additionnent pas entre surfaces. Le jardin affiche son % du plein
pondéré par la surface de ses planches cultivées et de ses engrais verts,
Σ(état × m²) / Σ(capacité × m²), et nomme la plus basse ; les planches sans
culture sont comptées à part, avec leur état de surface (choix fait en
écrivant, confirmé le 31 octobre 2026). Une planche à la jauge inconnue est exclue de la
moyenne et comptée à part (« 2 planches inconnues »). Le détail par planche
s'ouvre à la demande.

### Estimé et prévu

- Jusqu'à maintenant, la jauge est **estimée**, à partir de la dernière
  observation et des données réelles.
- De maintenant à dimanche, elle est **prévue** : pluie prévue, réduite à la
  part retenue par le planning (réglage R2, `docs/planning-contract.md`), ETM
  ou évaporation prévue, irrigations planifiées et propositions du plan de la
  semaine. Les irrigations planifiées comptent **exactement comme le planning
  les compte**, par la même règle, jamais par une copie : une irrigation en
  retard compte jusqu'à la fin de son créneau (`docs/replanning-contract.md`,
  D-051), une irrigation qui ne peut pas démarrer ne compte plus (D-044).
- Observé, estimé et prévu ne sont jamais confondus dans une même valeur ni un
  même libellé (D-006).

## Les signaux

Tous sont des informations ; aucun ne change une dose, un besoin ni un plan
(D-028).

- **Dose au-delà de ce que le sol retient** : quand un arrosage planifié ou
  proposé apporte à une planche plus de mm que ce qui peut encore entrer dans
  le sol au début de l'arrosage — capacité moins état prévu sur une planche
  cultivée —, la proposition l'indique : « X mm au-delà de ce que le sol peut
  retenir, perdus en drainage ». Rien n'est dit quand la jauge est inconnue.
- **Seuil atteint** (planche cultivée ou engrais vert) : une jauge au seuil
  ou en dessous, estimée ou prévue, est mise en évidence avec le jour où elle
  l'atteint.
- **Jours avant le seuil** : quand la jauge prévue atteint le seuil d'ici
  dimanche, l'écran donne ce jour-là ; sinon, il donne le nombre de jours
  avant le seuil au rythme de l'ETM moyenne des trois derniers jours connus,
  en jours entiers arrondis vers le bas, avec la mention « au rythme des trois
  derniers jours, sans pluie ni arrosage » (D-053).
- **Dose conseillée** : sous le seuil, la dose qui refait le plein, capacité −
  état, jamais plus que la capacité, pour que l'eau tienne dans le sol. En
  goutte-à-goutte, elle se répartit sur un ou plusieurs apports du jour ; en
  aspersion, elle correspond à un apport tous les deux à cinq jours.
  Information seulement : elle ne change ni la dose du planning, ni les
  priorités (D-047).
- **Arrêt avant récolte** : quand la 5 quater met le Kc à 0 (ail et pomme de
  terre, vingt derniers jours), la jauge affiche « arrêt avant récolte » au
  lieu du seuil atteint et de la dose conseillée (D-053).
- **Réserve du sol épuisée** : une jauge à 0, estimée ou prévue, est mise en
  évidence avec le jour où elle y arrive. Aucune notification dans la 5 ter.
- **Drainage** : l'eau perdue au-delà de ce que le sol retient, le jour où
  elle l'est.
- **Valeur invraisemblable** : voir « Le sol ».
- **Mentions** : cailloux non renseignés ; profondeur proposée ; pluie
  comptée malgré le paillage ; adventices ; confiance et contrôle proposé au
  bout de 30 jours.

Aucun conseil d'arrosage avant une plantation ou un semis : le porteur l'a
écarté le 31 octobre 2026 (D-053).

## L'écran

- Dans la section « Planning de la semaine », un bloc « Réserve du sol » par
  jardin : le % du plein estimé maintenant, le prévu jour par jour jusqu'à
  dimanche, la date de la dernière observation, le curseur avec ses quatre
  repères, les mentions (« inconnue » avec sa raison, cailloux non
  renseignés, profondeur proposée, confiance), les planches sans culture
  comptées à part avec leur état. Le curseur de la parcelle est en tête du
  bloc, avec la mention qu'il règle le plein champ.
- Le détail d'une planche : son état sur sa capacité, son seuil, le jour du
  seuil ou les jours avant le seuil, la dose conseillée quand le seuil est
  atteint ou « arrêt avant récolte », le drainage du jour s'il y en a ; sans
  culture, son état de surface et, s'il y a lieu, le stade de l'engrais vert
  ou la date de pose de la bâche, modifiables.
- Dans les réglages : par parcelle, la RFU du laboratoire, la part de
  cailloux, la RFU du sol calculée, la part de référence, TEW, REW et Ze, la
  provenance, la source et la date de l'analyse ; les valeurs propres par
  jardin ou abri ; pour l'exploitation, les coefficients des états de surface
  et la part de pluie qui traverse un paillage plastique. La table des
  profondeurs et des p se règle dans la page « Coefficients culturaux » de la
  5 quater.
- Ordinateur et 390 px de large ; la 3.8 rangera ensuite ce bloc avec le
  reste de l'interface.
- En tête de chaque parcelle, depuis le 14 novembre 2026, la vue
  d'ensemble par jardin : une barre par jardin ou abri, ses planches en
  points (section « La vue d'ensemble par jardin », à la fin, D-109).

## Ce qui dépend de la 5 quater

- Le **rattachement des espèces** d'Ouvre ta ferme aux cultures de référence
  fixe les lignes de la table des profondeurs qui serviront.
- La **durée de chaque stade** (par exemple la reprise de la tomate en 15 ou
  30 jours) fixe le jour où la profondeur change ; pour les stades à
  profondeur progressive, le nombre de jours dans le stade fixe la valeur.
- Le **délai de levée**, s'il est retenu : la 5 quater doit dire quel Kc
  s'applique avant la levée ; sans ETM pendant ce délai, la jauge serait
  inconnue.
- Les **cultures pluriannuelles** (artichaut, asperge, fraisier) : à la
  relecture de la 5 quater, le 31 octobre 2026, le porteur retient un
  calendrier fixe de stades dans l'année, corrigé par le stade déclaré, et
  leur maintien sur la planche après la dernière récolte jusqu'à la fin de ce
  calendrier, par exception à D-022 ; la 5 quater le consigne. La jauge les
  suit alors comme une planche cultivée, avec leur ETM, et non comme une
  planche nue ; sans calendrier ni stade, leur jauge est inconnue, raison
  nommée.
- K_abri et le paillage plastique changent l'ETM, donc la jauge.

Sur la ferme, d'après le relevé des 79 espèces de la saison 2026 fait le
31 octobre 2026 pour la relecture de la 5 quater : une quarantaine
d'espèces, surtout des fleurs et des aromatiques, n'ont pas de Kc publié ;
leurs planches auront une jauge inconnue, culture nommée, tant qu'un Kc
n'est pas saisi. Une culture rattachée à une référence absente de la table
des profondeurs (le navet ou la patate douce, si la 5 quater les retient)
prend 30 cm proposés avec un avertissement, et p 0,5. L'artichaut,
l'asperge, le fraisier, la pomme de terre et le chou-fleur n'ont pas de
série cette saison.

## Hors périmètre

La jauge qui règle la dose, l'espacement, les priorités ou le besoin, qui
demande une décision nouvelle (D-047) ; un conseil d'arrosage avant
plantation ou semis (écarté par le porteur, D-053) ; les remontées
capillaires, le ruissellement et la pluie efficace hors paillage : la jauge
s'arrête à un bilan simple plafonné à ce que le sol retient ; la réserve utile
totale, la RFU par couche de sol au-delà des deux compartiments du sol nu ;
une profondeur réduite sous abri ; l'ajustement de p à l'ETM du jour ; les
capteurs (tensiomètre, sonde) ; une notification sur jauge basse, qui
relèverait des alertes de la 5 bis ; un curseur par planche ; l'écriture vers
Ouvre ta ferme.

## Découpage et preuve de fin

En PR courtes, tests d'abord, **après le domaine de la 5 quater**, dont la
jauge consomme l'ETM :

1. **Le domaine**, en deux PR, faites en une seule le 6 novembre 2026 (D-060) :
   1. les planches cultivées : la RFU du sol, la part de référence, la
      capacité selon le stade, le seuil, la jauge jour par jour, le départ,
      le prorata du jour d'observation, l'inconnue et son redémarrage, la
      moyenne du jardin, le prévu, le jour ou les jours avant le seuil, la
      dose conseillée, l'arrêt avant récolte, le drainage, le paillage ;
   2. les planches sans culture : le modèle de sol nu en deux compartiments,
      les états de surface, les passages entre culture et sol nu, la
      confiance ;
   avec les scénarios ci-dessous en tests.
2. **La persistance** : une migration additive (RFU du laboratoire, cailloux,
   part de référence, TEW, REW, Ze et valeurs propres ; profondeurs et p de
   départ avec leur source et leur date ; états de surface et stade de
   l'engrais vert ; coefficients des états et part de pluie sous paillage,
   révisions datées ; observations ; état du jour avec De, évaporation,
   réserve profonde, mode, profondeur de référence et confiance) et ses
   tests de persistance.
3. **L'écran** : les réglages, le bloc « Réserve du sol », le curseur, l'état
   de surface, un parcours navigateur aux deux largeurs.

Preuve de fin : les scénarios en tests, les tests de persistance, le parcours
navigateur, puis une recette réelle sur la ferme, sur ordinateur et à 390 px,
le constat à l'assistant et le jugement au porteur (D-014) ; à la recette, un
contrôle de la profondeur des racines à la bêche sous abri.

### Scénarios chiffrés

Valeurs d'exemple, choisies pour un calcul simple. Les scénarios 1 à 9
prennent une RFU du sol de 62 mm/m, soit 0,62 mm/cm, une culture d'exemple à
50 cm à son deuxième stade, capacité 31,0 mm ; l'ETM du jour est donnée ; le
seuil n'y est pas regardé. Les scénarios 10 à 41 prennent la ferme : 51 mm/m,
part de référence 2/3, TEW 14 mm, REW 7 mm, Ze 10 cm.

1. **Plein champ.** Observation lundi 00 h 00 à 100 % : 31,0 mm. Lundi, pluie
   0, ETM 4,0 : 27,0. Mardi, irrigation 10 mm, ETM 4,0 : 33,0 borné à 31,0,
   2,0 mm drainés. Mercredi, pluie 20 mm, ETM 2,0 : 31,0.
2. **Jour d'observation.** Observation lundi 18 h 00 à 50 % : 15,5 mm ; ETM du
   lundi 4,0 comptée pour 6 heures sur 24, soit 1,0 : 14,5 à minuit.
3. **Sous abri.** Même planche sous abri, valeur propre identique, 20 mm de
   pluie mercredi : la pluie compte 0, la jauge baisse de l'ETM.
4. **Abri sans valeur propre** : il prend la RFU de sa parcelle, 62 mm/m,
   capacité 31,0 mm, sans mention.
5. **Donnée manquante.** ETM du mercredi inconnue, ET0 absente : jauge
   inconnue dès mercredi, l'écran nomme « ET0 du mercredi » ; une observation
   jeudi la rétablit. De même pour une culture sans Kc, nommée.
6. **Deux séries.** Une culture à 50 cm et une à 100 cm sur la même planche :
   capacité 31,0 mm, celle des 50 cm.
7. **Dose au-delà.** État prévu 20,0 mm au début d'un créneau de 15 mm :
   capacité 31,0 − 20,0 = 11,0 ; le signal dit « 4,0 mm au-delà ».
8. **Moyenne du jardin.** Planche cultivée A de 10 m² à 31,0 sur 31,0,
   planche cultivée B de 30 m² à 0 sur 62,0 : (31 × 10 + 0 × 30) / (31 × 10
   + 62 × 30) = 310 / 2 170, soit 14 %, planche la plus basse B.
9. **Curseur de parcelle puis de jardin.** Parcelle à 100 % lundi 08 h, jardin
   J à 40 % lundi 12 h : les planches de J partent de 40 % à 12 h, les autres
   jardins de plein champ de 100 % à 8 h ; l'abri A de la parcelle garde la
   jauge de son propre curseur ; un nouveau curseur de parcelle mardi règle à
   nouveau tous les jardins de plein champ, pas l'abri.
10. **RFU du sol.** RFU du laboratoire 62 mm/m, cailloux 18 % : 62 × 0,82 =
    50,84, RFU du sol **51 mm/m**. Cailloux non renseignés : **62 mm/m**,
    avec l'avertissement.
11. **Capacité et seuil.** Tomate installée, 65 cm : capacité 51 × 0,65 =
    **33,15 mm**, affichés 33,2 ; p 0,40, seuil 33,15 × (1 − 0,40 / (2/3)) =
    33,15 × 0,40 = **13,26 mm**. Courgette, 50 cm : **25,5 mm** ; p 0,50,
    seuil 25 % = **6,4 mm**. Laitue, 25 cm : **12,75 mm**, affichés 12,8 ; p 0,30, seuil
    12,75 × 0,55 = **7,0 mm**. Épinard, 25 cm : 12,75 mm ; p 0,20, seuil
    12,75 × 0,70 = **8,9 mm**. Carotte, 70 cm : **35,7 mm** ; p 0,35, seuil
    35,7 × 0,475 = **17,0 mm**.
12. **Profondeur par stade.** Tomate au stade « Plantation → Reprise » :
    20 cm, capacité **10,2 mm** ; « Reprise → Floraison 3e bouquet » : 45 cm,
    **22,95 mm** ; « → Mi-récolte » : 65 cm, **33,15 mm**. Au passage du
    stade 1 au stade 2, avec 5,1 mm sur 10,2 (50 %) : réserve **11,475 mm**,
    toujours 50 %.
13. **Bilan et jours avant le seuil.** Tomate installée, 33,15 mm au jour 0,
    ETM 3,5 mm/j, ni pluie ni irrigation : 29,65 ; 26,15 ; 22,65 ; 19,15 ;
    15,65 ; 12,15 mm ; le seuil de 13,26 mm est atteint au jour 6. Au jour 0,
    hors de la semaine prévue, jours avant le seuil : (33,15 − 13,26) / 3,5 =
    5,7, affiché **5** (partie entière).
14. **Plafond.** État 30,0 mm, irrigation 10 mm, capacité 33,15 : état
    **33,15 mm**, drainage **6,85 mm**.
15. **Dose conseillée.** Tomate à 4,5 mm, sous son seuil : dose conseillée
    33,15 − 4,5 = **28,65 mm** ; la priorité de la planche ne change pas.
16. **Culture sans profondeur.** Une culture de référence sans profondeur
    saisie : 30 cm proposés, capacité 51 × 0,30 = **15,3 mm**, avertissement,
    rien ne s'arrête.
17. **Départ par un apport.** Aucune observation ; mardi, 30 mm de pluie sur
    une planche cultivée de capacité 25,5 : la jauge part à 25,5 mm, 100 %, à
    la fin de mardi, mention « départ par un apport ».
18. **Non-régression.** Les tests existants et les scénarios de la 5 quater
    passent sans changement.
19. **Sol nu, été.** Planche nue à 30 cm, pleine (15,3 mm : surface 5,1,
    profonde 10,2), surface mouillée (De 0), plein champ, ET0 6 mm/j :
    évaporation 7,2 puis 6,8 puis 0 mm ; De 7,2 puis 14 puis 14 ; jauge
    **10,2 mm** dès le jour 1, constante ensuite.
20. **Sol nu, printemps.** Même planche, ET0 2 mm/j pendant 7 jours :
    évaporation 2,4 ; 2,4 ; 2,4 ; 2,33 ; 1,53 ; 1,01 ; 0,66 mm, cumul entre
    12,5 et 13,0 mm, celle du jour 7 sous 1 mm ; jauge 12,9 mm le jour 1,
    10,5 mm le jour 2, **10,2 mm** à partir du jour 3.
21. **Petite pluie sur sol sec.** De 14, pluie 5 mm : De 9, jauge inchangée ;
    le lendemain, ET0 6 : Kr = 5 / 7, évaporation 5,1 plafonnée à **5,0 mm**,
    De 14 ; jauge identique à celle d'avant la pluie.
22. **Grosse pluie sur sol sec.** De 14, réserve profonde 6,0 mm, pluie
    20 mm : 14 mm remplissent la surface (De 0), 6 mm portent la réserve
    profonde à 10,2 mm, **1,8 mm** drainés ; jauge pleine à **15,3 mm**.
23. **Bâche imperméable.** 10 jours, ET0 6, pluie 12 mm : De et jauge
    inchangés.
24. **Paillée.** Surface mouillée, ET0 6 : évaporation du jour 1 = **3,6 mm**
    (50 % de 7,2).
25. **Engrais vert en couverture totale.** Plein champ, ET0 5 : consommation
    **5,0 mm/j** ; 30 cm, capacité 15,3 mm, p 0,5 faute de valeur, seuil 25 %
    = **3,8 mm** ; la jauge peut l'atteindre et le signal le dit.
26. **De sol nu à culture.** Planche nue à 30 cm, à 60 % (9,2 mm) ; une
    laitue est plantée, premier stade 15 cm, capacité 7,65 mm : jauge
    **4,6 mm**, 60 % ; seuil de la laitue, p 0,30, 55 % = **4,2 mm** : pas de
    seuil atteint, et aucun conseil d'arrosage. Le complément du porteur
    donnait un seuil de 3,8 mm, calculé avec la formule inversée corrigée le
    30 octobre.
27. **Arrosage de plantation.** Tomate au premier stade, 20 cm, capacité
    10,2 mm, état 2,0 mm, arrosage de plantation 6 mm, sans consommation ce
    jour-là : **8,0 mm**, 78 %, pas plein.
28. **De culture à sol nu.** Tomate installée, 15,0 mm sur 33,15 (45,2 %) ;
    la série se termine : planche nue à 30 cm, capacité 15,3 mm, jauge
    **6,9 mm** ; De = 0,548 × 14 = **7,7 mm**, surface à 0, réserve profonde
    **6,9 mm**. Le complément du 3 novembre 2026 donnait une réserve profonde
    de 4,6 mm (45,2 % de 10,2 mm), la répartition que D-053 avait corrigée
    parce qu'elle fait perdre d'un coup une partie de la jauge ; la
    correction est gardée.
29. **Planche sans état déclaré.** Sans série et sans état : traitée « nue »,
    l'écran invite à préciser l'état ; la jauge ne s'arrête pas.
30. **Curseur sur sol nu.** Planche nue à 30 cm réglée « sec », 25 % : De
    10,5, surface 0, réserve profonde 3,8 ; jauge **3,8 mm**. Réglée
    « humide », 75 % : De 3,5, surface 1,6, réserve profonde 9,9 ; jauge
    **11,5 mm**.
31. **Redémarrage d'une planche nue inconnue.** Pluie 20 mm : la jauge reste
    inconnue ; pluie 25 mm, au moins TEW + RFU profonde = 24,2 mm : jauge
    pleine, 15,3 mm, « départ par un apport ».
32. **Deux cultures, un seuil.** Tomate (65 cm, p 0,40) et épinard (25 cm,
    p 0,20) : capacité 12,75 mm, celle de l'épinard ; seuil avec p 0,20,
    70 % = **8,9 mm**, et non 13,3 mm, le seuil de la tomate sur sa propre
    capacité.
33. **Arrêt avant récolte.** Ail, 30 cm, capacité 15,3 mm, seuil 8,4 mm, dix
    jours avant la récolte, jauge à 6,0 mm : ETM 0, jauge stable ; l'écran
    affiche « arrêt avant récolte », ni seuil atteint ni dose conseillée.
34. **Paillage plastique.** Planche cultivée paillée, pluie 20 mm : 20 mm
    comptés, mention « pluie comptée en entier malgré le paillage » ; part
    réglée à 50 % : **10 mm** comptés.
35. **Jour du seuil dans la semaine.** Tomate pleine lundi matin, 33,15 mm,
    seuil 13,26 mm, ETM prévue 5 mm/j, sans pluie ni arrosage planifié :
    28,15 ; 23,15 ; 18,15 ; 13,15 mm ; l'écran dit « seuil atteint jeudi »,
    même si l'ETM des trois derniers jours, 3,5 mm/j, donnerait 5 jours.
36. **Profondeur progressive.** Carotte à 50 jours après le semis, soit 20 j
    dans le stade 2 : 0,40 + 0,30 × 20 / 40 = **0,55 m**, capacité 28,05 mm,
    seuil 47,5 % = **13,3 mm** ; à J+80 : **0,70 m**.
37. **Trou de données puis apport.** ETM du mercredi inconnue : jauge
    inconnue dès mercredi ; jeudi, 30 mm de pluie sur une planche cultivée de
    capacité 25,5 : jauge pleine à la fin de jeudi, « départ par un apport ».
38. **Plafond de sol.** Tomate au stade 3 (65 cm) sur une parcelle de
    profondeur de sol 0,50 m : profondeur **0,50 m**, capacité **25,5 mm**.
    Asperge (0,60 m) sur un sol de 0,40 m : **0,40 m**, **20,4 mm**. Champ
    vide : aucune limite.
39. **Melon et asperge plafonnés.** Melon au stade 3 : **0,60 m**, capacité
    **30,6 mm**, seuil 40 % = 12,2 mm. Asperge installée : **0,60 m**,
    **30,6 mm**, seuil 32,5 % = 9,9 mm.
40. **Culture hors CRIIAM, profondeur progressive.** Brocoli à 25 j après la
    plantation : 0,20 + 0,20 × 25 / 50 = **0,30 m**, capacité **15,3 mm** ;
    à 50 j et au-delà : **0,40 m**, 20,4 mm.
41. **Seuils et p.** Toutes les cultures de la table ont un p ; betterave,
    navet, courgette, concombre et culture sans p tombent à 25 % du plein ;
    aucune n'a un seuil à 100 %.

## Choix faits en écrivant, confirmés à la relecture

Le porteur a suivi les recommandations de l'assistant le 27 octobre 2026.
Ces points-ci avaient été précisés en écrivant le contrat, sans question
posée ; il les a relus le 31 octobre 2026 (D-053) :

1. le seuil de l'avertissement de vraisemblance, 200 mm/m (2 mm/cm) :
   confirmé, appliqué à la RFU du laboratoire saisie ;
2. ~~le coefficient de consommation réglable par parcelle, jardin ou abri~~ :
   remplacé le 30 octobre 2026 par l'ETM de la 5 quater (D-047) ;
3. ~~le curseur de parcelle qui règle aussi ses abris~~ : changé le
   31 octobre 2026, le curseur de parcelle ne règle que le plein champ ;
4. le prorata du jour d'observation : confirmé ;
5. la jauge qui garde son % du plein quand la capacité change : confirmé ;
6. la jauge inconnue dès qu'une pluie ou une ETM manque, jusqu'à la
   prochaine observation : confirmé, et complété : ou jusqu'à un jour
   d'apports qui remplit la planche ;
7. la pluie prévue de la projection réduite par R2, comme dans le planning :
   confirmé ;
8. le % du jardin pondéré par la surface des planches, la plus basse nommée :
   confirmé.

## Choix faits en écrivant la révision du 31 octobre 2026, confirmés

Précisés en portant au contrat les réponses du porteur et le complément
« planches sans culture », sans question posée ; soumis au porteur et
confirmés par lui le 31 octobre 2026 (« ok pour les précisions », D-053) :

1. la traduction d'un état t du plein dans les deux compartiments du sol nu :
   De = (1 − t) × TEW, réserve profonde = t × capacité − max(0 ; RFU de
   surface − De), pour une jauge continue ; elle corrige la fin de culture du
   complément (scénario 28) ;
2. le redémarrage d'une planche nue inconnue par des apports d'au moins
   TEW + RFU profonde, 24,2 mm sur 30 cm ;
3. pas de seuil sur une planche sans culture, sauf l'engrais vert, à p 0,5 ;
4. la moyenne du jardin et la planche la plus basse sur les planches
   cultivées et les engrais verts, les planches sans culture comptées à part ;
5. à la dépose d'une bâche imperméable, De = 0 si De était au plus REW à la
   pose ;
6. TEW, REW et Ze par parcelle, 14 mm, 7 mm et 10 cm au départ ;
   coefficients des états de surface et part de pluie sous paillage réglés
   pour l'exploitation, en révisions datées ;
7. l'enherbée suivie comme l'engrais vert, sur 30 cm, sans seuil.

## Précision du 30 octobre 2026 : la RFU en mm par mètre (D-046)

Le contrat du 27 octobre 2026 saisissait la RFU en mm avec sa profondeur de
calcul, et un statut « confirmée par le laboratoire » ou « hypothèse », parce
que le rapport de la ferme ne disait pas sur quelle profondeur portaient ses
62 mm. Le porteur tranche le 30 octobre 2026 : « la RFU s'exprime toujours en
mm par mètre », après la réponse du laboratoire (« c'est 62mm sur 1m »). La
RFU se saisit donc en mm/m ; la profondeur de calcul et son statut
disparaissent, avec la mention « hypothèse » à côté des jauges. La RFU par cm
vaut la RFU ÷ 100, et la capacité d'une planche se calcule comme avant. Le
seuil de vraisemblance, 2 mm/cm, s'écrit 200 mm/m. Les scénarios chiffrés
gardent leurs résultats : 62 mm/m sur une culture d'exemple à 50 cm donnent
les mêmes 31,0 mm que 62 mm sur 60 cm sur une culture à 30 cm. Choix
recommandé par l'assistant et retenu par le porteur le jour même.

## Révision du 30 octobre 2026 : la jauge par l'ETM (D-047)

Le porteur fournit le 30 octobre 2026 un complément à son document de travail
du besoin par culture et par stade (5 quater), consacré à la jauge. Relu
contre le dépôt, il change ce contrat en sept points :

1. **La consommation** devient l'ETM de la 5 quater ; le coefficient de
   consommation réglable disparaît. La 5 ter se code donc après le domaine
   de la 5 quater.
2. **La RFU du sol** se corrige des cailloux : RFU du laboratoire × (1 −
   part de cailloux), arrondie au mm/m entier. Sur la ferme : 62 mm/m du
   laboratoire, 18 % de cailloux estimés par le porteur, **51 mm/m**. La
   RFU reste en mm par mètre (D-046).
3. **Un abri sans analyse** prend la RFU de sa parcelle, marquée « non
   mesuré », au lieu d'une RFU inconnue.
4. **La profondeur racinaire** a des valeurs de départ, fournies par le
   porteur (ITAB, par la FRAB AuRA) ; elle vaut la moitié au premier stade ;
   une culture sans profondeur reçoit 30 cm proposés avec un avertissement,
   au lieu d'une jauge inconnue.
5. **Un seuil de déclenchement** par culture, d'après sa part utilisable p
   (FAO-56, tableau 22) : capacité × (1 − min(1 ; p / 0,5)). Le complément
   écrivait capacité × min(1 ; p / 0,5), formule inversée, corrigée ici.
6. **Les jours avant le seuil, la dose conseillée et le drainage** s'affichent.
   Le complément faisait remonter la planche sous son seuil dans les
   priorités d'irrigation ; le porteur choisit le 30 octobre 2026 à 19 h 05
   « Information seulement » : la jauge ne change aucune priorité ni aucune
   dose, D-041 et D-028 tiennent.
7. **Le départ** : avant toute observation, un jour d'apports qui atteignent
   la capacité fait partir la jauge pleine.

Restaient à valider par le porteur avant le code : la moitié de la profondeur
au premier stade, la RFU des abris sans analyse, les seuils des cultures
sensibles, le départ de la jauge en début de saison. Validés le 31 octobre
2026 (D-053, section suivante).

## Relecture du 31 octobre 2026 : les réponses du porteur (D-053)

Le porteur relit le contrat le 31 octobre 2026, question par question, dans
la conversation « Préparer la relecture du contrat 5 ter », sur les
recommandations de l'assistant ; il fait faire une recherche documentaire
sur les profondeurs racinaires manquantes, et fournit un complément sur les
planches sans culture, préparé avec un autre assistant. Ce qui change :

1. **Les seuils** se calculent sur une **part de référence de 2/3**, celle du
   CRIIAM, enregistrée avec l'analyse, au lieu de 0,5 : « prenons les 2/3 ».
   Tous les seuils montent (tomate de 20 % à 40 %).
2. **La part p de la FAO-56** vaut pour toutes les cultures qui en ont une ;
   le contrat avait oublié la pomme de terre (0,35), la carotte (0,35) et le
   concombre (0,50). Le poireau et le chou kale, absents de la FAO, prennent
   la valeur de leur famille, 0,30 et 0,45 ; une culture sans valeur prend
   0,5, soit 25 %. p reste fixe, sans l'ajustement à l'ETM du jour.
3. **Les profondeurs** des vingt cultures de référence absentes de la fiche
   ITAB viennent de la recherche documentaire du 31 octobre 2026, la méthode
   de Geisenheim surtout : milieu de fourchette, arrondi aux 5 cm inférieurs ;
   pastèque et potiron à la valeur ITAB de la courgette. Pas de profondeur
   réduite sous abri pour l'instant.
4. **La moitié de profondeur au premier stade** est confirmée, sauf le
   poireau (30 jours) et l'asperge et le fraisier (jamais).
5. **Un abri sans analyse** prend la RFU de sa parcelle **sans mention** :
   « la RFU vaut pour la parcelle ».
6. **Le curseur de parcelle** ne règle plus que les jardins de plein champ ;
   le curseur garde sa plage de 0 à 100 %, avec quatre repères, sec, frais,
   humide, détrempé, à 25, 50, 75 et 100 %. (Changé le 7 novembre 2026,
   précision P40 : à l'écran, le curseur n'a plus que ces quatre crans.)
7. **La jauge continue sur une planche sans culture**, avec le modèle de sol
   nu de la FAO-56 (chapitre 7) et, pour la ferme, TEW 14 mm et REW 7 mm, au
   lieu de « pas de jauge » ; six états de surface avec leurs coefficients de
   départ, que le porteur juge assez justes pour la pratique, réglables par
   l'utilisateur. Le complément ne laissait plus jamais la jauge inconnue et
   la faisait partir de 50 % à défaut de réglage : la jauge reste inconnue
   au départ et sur un trou de données (D-003), puis ne s'arrête plus. Il
   remplaçait le curseur par quatre niveaux : le curseur reste, avec les
   quatre repères. Il faisait entrer un conseil d'arrosage avant plantation
   dans les priorités : le porteur écarte ce conseil, « ne l'affiche pas ».
   Deux erreurs du complément sont corrigées : son test de passage du sol nu
   à la laitue employait la formule du seuil inversée (scénario 26) ; sa fin
   de culture faisait chuter la jauge (scénario 28).
8. **Une jauge inconnue** repart aussi par un jour d'apports qui remplit la
   planche, pas seulement par une observation.
9. **Les cas que le contrat ne réglait pas** : le seuil d'une planche à
   plusieurs cultures, sur la capacité de la planche avec la culture la plus
   sensible ; le jour du seuil donné par la jauge prévue quand il tombe
   avant dimanche ; « arrêt avant récolte » au lieu de la dose conseillée
   quand le Kc vaut 0 ; la pluie comptée en entier sous un paillage
   plastique, part réglable, avec une mention ; les irrigations prévues
   comptées par la règle du planning.
10. **Les choix du 27 octobre** sont confirmés, sauf le curseur de parcelle
    (point 6) ; la jauge inconnue repart aussi par un apport (point 8).
11. **Une erreur de calcul** est corrigée : 30 cm à 51 mm/m font 15,3 mm,
    non 18,6 mm.
12. **Les sept précisions faites en écrivant cette révision**, et la valeur
    du chou kale, lui sont soumises avant la fusion ; il les confirme :
    « ok pour le chou kale, ok pour les précisions ».

Ne changent pas : D-003, D-006, D-010, D-028 ; D-041, D-046 et D-047, hors
les points ci-dessus.

## Relecture du 3 novembre 2026 : profondeurs racinaires par stade (D-056)

Le porteur fournit le 3 novembre 2026 un complément, « profondeurs racinaires
par stade », puis une synthèse de la formation FRAB AuRA SMACC2. Il tranche,
une question à la fois (sept) :

1. **Le seuil de déclenchement** reste celui de D-053, part de référence 2/3.
   Le complément écrivait `capacité × min(1 ; p / 0,5)`, la formule inversée
   que D-047 avait corrigée ; sa remarque sur la carotte (« déclenchée à
   100 % ») visait la version du 30 octobre : elle est déjà à 47,5 %.
2. **La profondeur par stade** et sa règle de construction sont adoptées ;
   la moitié de profondeur au premier stade est supprimée.
3. **Melon et asperge** : plafonnés à 0,60 m (valeurs FAO de 0,80 m et
   1,20 m non retenues) jusqu'à une observation à la tarière.
4. **Tomate** : 0,65 m au maximum (ITAB 50-80, exemple de la fiche FRAB) ;
   le repère de 50 cm de la synthèse FRAB SMACC2 n'est pas retenu.
5. **Méthode de seuil** : celle de D-053, non celle de la synthèse FRAB
   (RFU = p × RU), qui alerterait bien plus tard (laitue 2,8 jours au lieu de
   1,3 ; tomate de 0,50 m 4,9 jours au lieu de 2,9).
6. **Les cultures que le complément ne nomme pas** suivent la même règle de
   construction (radis, oignon vert, brocoli, chou pommé, chou kale, chou de
   Bruxelles, petit pois, fève, pastèque, potiron) ; leurs valeurs sont
   listées dans la table pour la relecture de la PR.
7. **Le plafond de sol** facultatif par parcelle est ajouté.

**Erreurs du complément corrigées ou gardées telles que décidées.** Tomate et
poivron (50-80) et courgette et concombre (40-60) étaient inversés dans la
table du 31 octobre : corrigé. La répartition de fin de culture du test 28
(réserve profonde 4,6 mm, jauge qui tombe de 6,9 à 4,6 mm) est celle que
D-053 avait corrigée : le scénario 28 garde 6,9 mm. Le céleri garde 0,30 m
avec avertissement.

**Choix faits en écrivant, à confirmer à la relecture de la PR.** Les valeurs
des dix cultures de la question 6 ; pastèque et potiron à 0,50 m par analogie
avec la courgette (D-053 avait déjà retenu l'ITAB de la courgette) ; chou de
Bruxelles à 0,40 m (petite valeur FAO) au lieu de 0,75 m (GEI) ; poireau et
carotte en profondeur progressive ; les scénarios 11 à 15, 26 à 28, 32, 33,
35 et 36 recalculés, les scénarios 38 à 41 ajoutés.

**Non traité ici, à reprendre pour la 3.9 et un contrat à part** : les
restrictions horaires, les priorités par stade critique, l'ombrage (nouveau),
l'efficience (goutte-à-goutte 0,9 ; aspersion 0,75) et le temps d'irrigation
de la synthèse FRAB. Le dossier `Plan_eau_SMACC2` qu'elle cite n'est pas dans
les fichiers du projet.

Ne changent pas : D-046, D-047, D-053, hors la moitié de profondeur au
premier stade et les profondeurs de la table.

## Précision du 5 novembre 2026 : la fin d'une culture (D-057)

Réponse du porteur en cours de code du domaine de la 5 quater, le
5 novembre 2026 (« Jusqu'à la plus tardive des récoltes ») : pour la jauge
comme pour l'ETM, une culture reste sur sa planche jusqu'au dimanche de la
plus tardive de ses semaines de récolte, réalisées ou attendues ; le suivi
par série garde sa règle (D-022). Une tomate récoltée en juillet et encore
attendue jusqu'en octobre reste donc une planche cultivée, avec son ETM, au
lieu de passer à « nue » après sa dernière semaine réalisée. Les cultures
pluriannuelles restent jusqu'à la fin de leur calendrier, comme avant.

Ne changent pas : D-022 pour le suivi par série, D-053, D-056.

## Le seuil d'arrosage réglable (D-059, précisé le 6 novembre 2026, D-060)

Le porteur décide le 6 novembre 2026, au placement des idées de la
comparaison avec Tlaloc, que l'exploitant règle lui-même le seuil de
déclenchement (« conseiller quand la réserve facile passe sous X % »), en plus
de la part p par culture ; la formule de D-053 devient la valeur par défaut
(D-059). Les bornes et l'écran restaient à écrire. Le porteur ayant demandé
le même jour que l'assistant tranche lui-même chaque question de la 5 ter en
prenant son option recommandée (« si tu as des questions à me poser, tu vas
y répondre toi-même en choisissant ta réponse recommandée »), elles sont
fixées ainsi, sans question posée (D-060) :

- **Deux modes, réglés pour l'exploitation**, en révisions datées (D-006) :
  - **selon la culture**, par défaut : la formule de D-053,
    `capacité × (1 − min(1 ; p / part de référence))`, la plus petite part
    p des cultures présentes ;
  - **seuil de la ferme** : `capacité × X %`, le même pour toutes les
    cultures et les engrais verts, X de **20 à 80 % du plein, par pas de
    5 %**, **50 %** proposés quand on choisit ce mode (la valeur de Tlaloc).
- La part p de chaque culture reste saisie et affichée dans la page
  « Coefficients culturaux » ; en mode « seuil de la ferme », le détail
  d'une planche rappelle le seuil selon la culture, en % du plein, quand
  celui de la ferme passe dessous (« la laitue souffre dès 55 % »), sans rien
  bloquer : c'est un choix de l'exploitation.
- Le seuil, quel que soit son mode, reste une information (D-047) : il ne
  change ni priorité, ni dose, ni plan.
- Une planche enherbée ou sans culture n'a toujours pas de seuil.

Option écartée : un X % pris dans la seule part facilement utilisable de la
culture, `capacité × ((1 − f) + X × f)` avec `f = min(1 ; p / part de
référence)`, plus fidèle à la part p mais difficile à expliquer sur un
écran ; elle peut revenir sur une décision nouvelle.

## Précisions faites en codant le domaine (6 novembre 2026, D-060)

Le domaine est codé le 6 novembre 2026 (`lib/domain/soil-reserve/`), en
Opus 5.5 · Très élevé, conforme à la ligne de la roadmap, sur le mandat du
porteur cité plus haut : chaque point que le contrat ne réglait pas est
tranché par l'assistant, sur son option recommandée, et consigné ici pour
que le porteur le relise et le change s'il le veut.

1. **Une seule PR pour le domaine**, au lieu des deux prévues (planches
   cultivées, puis sans culture) : la jauge est continue entre culture et sol
   nu (D-053), et la couper en deux aurait demandé un état intermédiaire
   jetable. Le découpage devient : le domaine, la persistance, l'écran.
2. **La pluie d'un jour passé** : le pluviomètre, sinon la réanalyse, sinon
   la prévision enregistrée pour ce jour, marquée estimée, comme l'ET0 de la
   5 quater ; sans aucune des trois, la pluie est inconnue (D-003).
3. **Aujourd'hui est prévu** : la jauge d'aujourd'hui compte les irrigations
   déjà faites et ce qui reste des irrigations planifiées et proposées, la
   pluie du pluviomètre si elle est saisie, sinon la pluie prévue réduite par
   R2. **« Maintenant »** est l'état au début d'aujourd'hui, ou à l'heure de
   l'observation du jour.
4. **Une culture sans ETM** parmi d'autres sur la planche rend la jauge
   inconnue, culture nommée (D-003), même quand les autres en ont une.
5. **Sans RFU saisie** pour la parcelle ni pour le jardin, la jauge est
   inconnue, raison « RFU non saisie ».
6. **La valeur propre d'un jardin ou d'un abri** porte tous les champs de la
   saisie d'une parcelle (RFU, cailloux, part de référence, TEW, REW, Ze,
   profondeur de sol) : l'écran la préremplit avec ceux de la parcelle.
7. **Profondeur progressive** : elle se compte depuis le début du stade ;
   pour la ligne de tous les stades d'une culture de la FAO (trapèze), depuis
   l'origine du cycle (scénario 40).
8. **La profondeur de référence d'une planche sans culture** est la
   profondeur de départ du premier stade de la prochaine culture placée sur
   la planche, plafond de sol compris ; la couche de surface ne dépasse
   jamais cette profondeur.
9. **Une série d'engrais vert** (espèce rattachée à « engrais vert » dans la
   correspondance de la 5 quater) dont le stade n'est pas déclaré est suivie
   comme un engrais vert levé (Kc 0,3) ; l'écran invite à déclarer le stade.
10. **Un état de surface déclaré** pendant une période sans culture prend fin
    à l'arrivée d'une culture ; après elle, la planche est « nue » jusqu'à une
    déclaration nouvelle.
11. **Sous une bâche imperméable**, l'irrigation compte (un goutte-à-goutte
    peut passer dessous), la pluie et l'évaporation non ; l'ET0 n'y est pas
    demandée.
12. **Le départ par un apport** joue aussi un jour où une donnée manque, si
    les apports connus suffisent à remplir la planche (une pluie inconnue
    compte alors pour 0).
13. **Les jours avant le seuil**, quand la jauge prévue ne l'atteint pas d'ici
    dimanche, partent de l'état de maintenant :
    `⌊(état − seuil) / rythme⌋`, le rythme étant la consommation moyenne des
    trois derniers jours estimés connus, sur une planche cultivée ou un
    couvert (moins de trois s'il n'y en a pas plus) ; rien sans rythme.
14. **La dose au-delà de ce que le sol retient** : l'état au début de
    l'arrosage vaut l'état du début du jour, plus la pluie moins la
    consommation au prorata de l'heure, plus les arrosages d'avant le même
    jour ; aussi sur une planche sans culture, avec ce qui peut encore entrer
    dans le sol, `De + (RFU profonde − réserve profonde)`.
15. **Le seuil atteint** est le premier jour, estimé ou prévu, où la jauge
    finit au seuil ou dessous ; si elle y est déjà ce matin, le premier jour
    de cette période. **La dose conseillée** s'affiche dès que l'état de
    maintenant est au seuil ou dessous.
16. **La moyenne du jardin** se calcule sur l'état de maintenant ; l'enherbée
    est comptée avec les planches sans culture, l'engrais vert dans la
    moyenne.
17. **Bornes des saisies** : p strictement entre 0 et 1 ; profondeur entre 0
    exclu et 3 m ; une profondeur progressive demande sa profondeur finale et
    un nombre de jours ; parts d'évaporation et part de pluie sous paillage de
    0 à 100 % ; Kc des couverts de 0 à 1,3.

Ne changent pas : D-003, D-006, D-010, D-028, D-047, D-053, D-056, D-057.

## Précisions faites en codant la persistance (6 novembre 2026, D-060)

La persistance est codée le 6 novembre 2026 (migration additive 0025,
`db/soil-reserve/`), en Opus 5.5, sur le même mandat. Points tranchés par
l'assistant, sur son option recommandée :

1. **Sept tables** : le sol (parcelle, ou valeur propre d'un jardin ou d'un
   abri), les profils racinaires et leurs lignes par stade, les états de
   surface déclarés, les réglages de l'exploitation, les observations du
   curseur, l'état du jour. Les six premières sont des révisions jamais
   modifiées ni effacées (D-006), gardées par des déclencheurs ; le jeu
   commun des profils, qui appartient aux migrations, ne se modifie pas mais
   peut être vidé et réécrit par l'import d'un export de la base
   (`scripts/import-d1-export.ts`).
2. **Aucune valeur de sol n'est écrite par la migration** : chaque ferme
   saisit la sienne (logiciel multi-fermes). Celle du porteur, 62 mm/m et
   18 % de cailloux, se saisira par l'écran.
3. **Le jeu commun des profils racinaires** est écrit par la migration, avec
   sa source, valable depuis toujours (`1900-01-01`) ; une ferme enregistre
   un profil entier (p et toutes ses lignes) à partir d'un jour, qui
   remplace le commun pour elle seule ; le commun reste lisible. Un profil ne
   s'enregistre que pour une culture de référence que la ferme voit, commune
   ou saisie par elle.
4. **Trente et un profils communs** : les dix-neuf cultures du CRIIAM et
   douze des treize cultures de la FAO-56 de la 5 quater. La **patate douce**
   n'a pas de profil : 30 cm proposés avec avertissement, p 0,5 (« Ce qui
   dépend de la 5 quater »). Le **céleri** a son p, 0,20, sans profondeur :
   30 cm proposés avec avertissement, comme le dit la table de D-056
   (« 0,30 fixe, avec avertissement »).
5. **Une ligne « tous les stades »** pour l'asperge (0,60 m), les fraisiers
   (0,25 m) et les cultures de la FAO (profondeur progressive depuis
   l'origine du cycle, sur « début + développement » de leur premier jeu de
   saison) ; l'artichaut a sa ligne du stade 1 (0,30 m) et 0,60 m pour les
   autres, son stade 1 n'existant que l'année de plantation.
6. **Le navet** part de 0,15 m, la profondeur d'un semis selon la règle de
   D-056, et monte à 0,70 m, le maximum de la betterave, en 40 jours.
7. **Ce qu'un stade ne dit pas** reste en note du profil, à saisir par une
   révision de la ferme : le fraisier l'année de plantation (0,15 m au stade
   1), le chou de Bruxelles (de 0,20 à 0,40 m), qui n'a pas sa propre culture
   de référence et suit les crucifères (de 0,20 à 0,50 m). La mâche suit
   l'épinard par la correspondance des espèces.
8. **Une observation** s'enregistre à l'heure UTC ; la règle « le jour même
   ou la veille » se lit au jour de la ferme (Europe/Paris), à l'heure de
   l'enregistrement.
9. **L'état du jour** ne garde que les jours passés : un recalcul remplace la
   ligne du même jour, comme l'ETM du jour ; les jours prévus ne
   s'enregistrent pas. Il n'a pas de saison : la jauge continue d'une saison
   à l'autre. Rien ne l'écrit encore ; le service de l'écran l'écrira.
10. **La base refuse ce que le domaine refuse** : un % hors de 0 à 100, un
    état de surface inconnu, une profondeur hors de 0 à 3 m, deux lignes pour
    le même stade, un seuil réglé hors de 20 à 80 % ou hors pas de 5 %.

Ne changent pas : D-003, D-006, D-047, D-053, D-056.


## Précisions faites en codant l'écran des réglages (6 novembre 2026, D-060)

L'écran est découpé en trois PR : **3a**, les réglages du sol ; **3b**, le
bloc « Réserve du sol » par jardin (jauge, prévu, curseur, détail d'une
planche, état de surface) et l'état du jour enregistré ; **3c**, la table des
profondeurs et des p dans la page « Coefficients culturaux ». La 3a est codée
le 6 novembre 2026, sur le même mandat. Points tranchés par l'assistant, sur
son option recommandée :

1. **La place** : un pli « Réglages du sol » dans le bloc « Réserve du sol »,
   lui-même dans la section « Planning de la semaine », au-dessus des
   réglages du planning ; son résumé dit combien de parcelles sont
   renseignées et quel seuil vaut. La 3.8 rangera ce bloc avec le reste.
2. **Seules les parcelles et les jardins de la saison affichée** sont
   proposés ; une saisie n'a pas de saison et vaut tant qu'une autre ne la
   remplace pas.
3. **La RFU du sol se calcule pendant la saisie** (62 mm/m et 18 % de
   cailloux : 51 mm/m) ; l'avertissement d'une RFU de laboratoire au-delà de
   200 mm/m paraît avant l'enregistrement, sans l'empêcher (D-046).
4. **La part de référence** se saisit en fraction (« 2/3 ») ou en décimal, et
   se relit en fraction simple quand elle en est une.
5. **La date de l'analyse s'écrit dans la source** ; le champ « À partir du »
   est le jour où la saisie vaut, aujourd'hui par défaut, et peut être un jour
   passé pour couvrir le début de la saison.
6. **Chaque saisie se fait dans un pli**, refermé par défaut, sous la valeur
   qui vaut aujourd'hui, pour que l'écran reste court à 390 px. La valeur
   propre d'un jardin ou d'un abri part de la valeur de sa parcelle ; sans
   valeur propre, la ligne dit « Valeur de la parcelle. ». Revenir à la valeur de la parcelle après une
   valeur propre ne se fait pas encore : il faut ressaisir les mêmes valeurs
   (noté pour la recette).
7. **Le seuil de l'exploitation** (D-059) : deux choix, « Selon la culture »
   (par défaut) ou « Réglé par l'exploitation », avec la liste de 20 à 80 %
   par pas de 5 %, 50 % proposés ; les coefficients d'évaporation et la part
   de pluie sous paillage plastique se saisissent en %, les Kc tels quels.
8. **L'histoire reste lisible** : les saisies plus anciennes d'un lieu et les
   réglages enregistrés de l'exploitation sont rappelés avec leur date.

Ne changent pas : D-003, D-006, D-046, D-047, D-059.

## Précisions faites en codant le bloc par jardin (6 novembre 2026, D-060)

La 3b est codée le 6 novembre 2026, sur le même mandat. Ce qu'elle laisse
passe dans une **3d** : l'état du jour enregistré chaque matin et la « dose
au-delà de ce que le sol retient » sur les propositions du planning. Points
tranchés par l'assistant, sur son option recommandée :

1. **La place** : dans le bloc « Réserve du sol », au-dessus du pli « Réglages
   du sol », une partie par parcelle de la saison ; en tête, le curseur de la
   parcelle quand elle a des jardins de plein champ, avec la mention qu'il les
   règle ; puis un pli par jardin ou abri, refermé par défaut, qui dit dans
   son résumé le % du plein de maintenant, la planche la plus basse, les
   planches inconnues et les planches sans culture ; dans le pli, le prévu
   jusqu'à dimanche, le curseur du jardin ou de l'abri, puis un pli par
   planche.
2. **Le départ suivi** : le jour de la dernière observation qui couvre chaque
   jardin, sinon trente jours en arrière, pour laisser à un jour d'apports le
   temps de remplir la planche ; jamais plus de quatre-vingt-dix jours en
   arrière, jamais avant le 1er janvier de la saison. La jauge ne se calcule
   que pour la saison en cours, dont seul le plan de culture est lu, et
   attend que ce plan ait été lu ; sinon, le bloc le dit en une phrase.
3. **La pluie de chaque jour** : le pluviomètre prime, 0 mm compris ; avant
   aujourd'hui, la réanalyse, à défaut la dernière prévision enregistrée,
   comptée comme estimée ; aujourd'hui et ensuite, la dernière prévision. Un
   jour sans valeur laisse la pluie inconnue, jamais 0 (D-003).
4. **Les irrigations** : une irrigation réalisée compte ses mm réels sur ses
   heures de fonctionnement, réparties au prorata quand elle a été
   interrompue ; une irrigation planifiée compte par la règle même du
   planning (D-044, D-051) ; une proposition du plan de la semaine compte sur
   son créneau tant qu'elle est proposée, jamais une fois refusée ou échue.
   Comme le planning, toutes les irrigations de la planche comptent, quelle
   que soit leur saison.
5. **Le curseur** : de 0 à 100 % par pas de 5 %, avec ses quatre repères ;
   « maintenant » par défaut, ou « plus tôt, aujourd'hui ou hier » avec le
   jour et l'heure, refusé au-delà de la veille avec la règle. La dernière
   observation qui vaut est rappelée sous le curseur, avec son jour et son
   heure, et « par la parcelle » quand elle vient d'elle.
6. **Le jardin** : maintenant, c'est le début du jour, ou l'heure de
   l'observation du jour ; le prévu, c'est la fin de chaque jour,
   d'aujourd'hui à dimanche, marqué « prévu » ; la ligne n'est montrée que si
   une planche au moins est comptée.
7. **Le détail d'une planche** : son état en mm sur sa capacité et en % du
   plein, dit « estimé au début du jour » ou « à l'heure de l'observation du
   jour », la profondeur des racines ; son seuil en mm et, quand
   l'exploitation l'a réglé, le % que la culture conseillerait ; les signaux
   (arrêt avant récolte ; sous le seuil depuis tel jour et la dose
   conseillée ; seuil atteint tel jour, prévu ; ou les jours avant le seuil
   au rythme des trois derniers jours, avec ce rythme en mm par jour ;
   réserve épuisée depuis tel jour, ou tel jour, prévu) ; le drainage du
   jour ; les cultures avec leur culture de référence et leur profondeur,
   « proposée » quand elle n'a pas été vérifiée ; les mentions. Les jours de
   la semaine sont marqués « prévu » ou « estimé », jamais confondus (D-006).
8. **L'état de surface d'une planche sans culture** : les neuf états, en
   français (« sol nu », « bâche imperméable », « bâche perméable »,
   « paillée », les quatre stades de l'engrais vert — levée, couverture
   partielle, couverture totale, détruit —, « enherbée ») ; il se déclare à
   partir d'un jour, aujourd'hui par défaut, ce qui donne aussi la date de
   pose d'une bâche ; tant qu'il n'est pas déclaré, « sol nu » est proposé,
   avec la mention de le déclarer s'il diffère. Le formulaire est offert aux
   planches sans culture et à celles dont le mode est inconnu.
9. **Une précision du domaine** : sur une planche observée ou déjà partie,
   un jour qui manque (pluie, ET0, ETM d'une culture sans Kc ou sans stade)
   est nommé, au lieu de « pas encore de départ ». La phrase de l'inconnue
   nomme le jour et la donnée qui manquent, ou la culture (D-003).

Ne changent pas : D-003, D-006, D-028, D-044, D-047, D-051, D-053, D-059.

## Précisions faites en codant les profils racinaires (6 novembre 2026, D-060)

La 3c est codée le 6 novembre 2026, sur le même mandat. Points tranchés par
l'assistant, sur son option recommandée :

1. **La place** : dans la carte de chaque culture de référence utilisable de
   la page « Coefficients culturaux », sous ses Kc, ses surcharges et ses
   durées, un bloc « Racines et part utilisable » : la part p, une ligne par
   stade avec sa profondeur, fixe ou qui augmente (« de 0,40 à 0,70 m en 40
   jours, puis 0,70 m »), la ligne « Tous les stades » en dernier, les stades
   sans ligne à 0,30 m proposés, la source et la note. Le résumé de la carte
   dit « profil racinaire de la ferme » quand la ferme en a un. Une culture
   inutilisable n'a pas ce bloc, comme ses surcharges.
2. **Le jeu commun reste à côté** : quand le profil de la ferme compte,
   chaque valeur qui diffère du jeu commun le rappelle (« jeu commun :
   0,20 m ») ; les profils de la ferme sont rappelés avec leur jour et leur
   source, ceux d'un jour à venir compris.
3. **Un profil entier à la fois** : le formulaire part du profil qui compte
   et règle la part p (vide : 0,5 comptés) et chaque ligne — une profondeur,
   ou une profondeur qui augmente jusqu'à une profondeur finale en un nombre
   de jours —, en ajoute pour un stade sans ligne ou pour tous les stades, en
   retire ; la source est obligatoire, la note facultative, « À partir du »
   aujourd'hui par défaut. Les règles du domaine (p strictement entre 0 et 1,
   profondeur de plus de 0 à 3 m, une ligne par stade) sont dites avant
   l'enregistrement.
4. **Reprendre le jeu commun** remplit le formulaire avec ses valeurs ;
   enregistré, il devient un profil de la ferme aux valeurs communes, sans
   effet sur la jauge, et rien n'est effacé (D-006). Un retour qui suivrait
   les révisions futures du jeu commun n'est pas fait : noté pour la
   recette.
5. **Sans espace de ferme**, la page lit le jeu commun seul.

Ne changent pas : D-006, D-053, D-056.

## Précisions faites en codant l'état du jour et la dose au-delà du sol (6 novembre 2026, D-060)

La 3d est codée le 6 novembre 2026, sur le même mandat ; elle termine
l'écran de la 5 ter. Points tranchés par l'assistant, sur son option
recommandée :

1. **L'état du jour s'enregistre chaque matin**, après la météo du matin et
   l'ETM du jour : pour chaque ferme, la jauge de chaque planche de la saison
   en cours est recalculée et l'état des sept jours d'avant est enregistré,
   depuis le départ de la jauge, comme l'ETM ; jamais aujourd'hui ni un jour
   prévu. Un recalcul remplace l'état du même jour. La jauge ne relit pas ces
   états : ils gardent la trace de ce qu'elle a montré. L'échec d'une ferme
   n'arrête pas les autres ; la route interne de la météo compte les fermes
   enregistrées et celles en échec.
2. **La dose au-delà de ce que le sol retient** se dit sous chaque
   proposition encore proposée du plan de la semaine, planche par planche :
   « N03 : 4 mm au-delà de ce que le sol peut retenir, perdus en drainage. »
   Elle se calcule au chargement de la page, sur la jauge qui compte déjà la
   proposition ; rien sous un dixième de mm, rien quand la jauge de la
   planche est inconnue. Un plan recalculé sans recharger la page ne la
   montre qu'au chargement suivant. Une irrigation validée ou planifiée ne
   la porte pas : c'est la proposition qui l'indique.

Ne changent pas : D-028, D-047, D-053.

## La pastille de l'eau arrosée en trop (6 novembre 2026, D-060)

Idée 8 de la comparaison avec Tlaloc, placée par le porteur le 6 novembre
2026 juste après la 5 ter (« petite PR », Opus 5.5 · Élevé) ; elle n'avait
pas de contrat. Elle est écrite et codée le même jour, sur le mandat D-060,
chaque point tranché par l'assistant sur son option recommandée :

1. **Ce qu'elle compte** : l'eau d'irrigation que le sol n'a pas pu retenir,
   perdue sous les racines, c'est-à-dire le drainage de la jauge les jours
   d'irrigation réalisée. Le besoin de la 5 quater y entre par la
   consommation de la jauge. Option écartée : l'irrigation au-delà de
   l'objectif hebdomadaire saisi, qui dépend d'un objectif que la ferme peut
   ne pas tenir à jour (les objectifs de novembre du porteur sont quatre à
   dix fois au-dessus du besoin calculé), et qui ignore la pluie et le sol.
2. **La pluie et l'irrigation se partagent le drainage d'un jour** au
   prorata de leurs mm comptés : une irrigation faite un jour de forte pluie
   n'est comptée en trop que pour sa part.
3. **Sur les sept derniers jours passés**, d'il y a sept jours à hier, sans le jour
   en cours, dont le drainage est encore prévu (D-006) : la pastille se lit
   n'importe quel jour de la semaine, le lundi compris.
4. **En mm par planche et en m³** : le volume suit la surface mouillée de
   chaque irrigation (`docs/wetted-surface-contract.md`) ; une surface
   inconnue laisse le volume de la planche inconnu, et le total devient « au
   moins ». Une planche n'est citée qu'au-delà d'un dixième de mm.
5. **Une planche arrosée un jour où sa jauge est inconnue** (pas de sol, pas
   de départ, pluie ou ETM manquante, jour d'avant le départ) est dite à part,
   jamais comptée pour 0 (D-003).
6. **La place** : en tête du bloc « Réserve du sol », un pli refermé dont le
   résumé dit le total de la semaine écoulée (« Eau arrosée en trop sur sept
   jours : 0,4 m³ », ou « aucune ») et la période ; dedans, le détail par
   planche, avec ses jours, et la règle du partage avec la pluie. Rien
   n'est envoyé ni notifié.
7. **Une information** : rien ne change un besoin, un plan ni une dose
   (D-028, D-047). Le sur-apport d'une proposition (R11) et la dose au-delà
   de ce que le sol retient (3d) restent sur les propositions.

Ne changent pas : D-003, D-006, D-028, D-047.

## La vue d'ensemble par jardin (14 novembre 2026, S2, D-109)

Demandée par le porteur le 8 novembre 2026 (« une représentation graphique
des réserves du sol par bloc, un peu jolie »), lue « par jardin ».
**Variante B choisie par lui le jour même** sur maquette
(https://claude.ai/artifact/U6EPngGTvs7qpKfyJ8YfNj) : une barre par jardin,
les planches en points. C'est un affichage : **aucun calcul nouveau, aucun
chiffre qui ne soit déjà sur la page** (D-047 inchangée). Le module
`lib/domain/soil-reserve/garden-bars.ts` range ce que la jauge a déjà
calculé (`garden.percent`, `week`, le résumé de chaque planche) ; il ne lit
rien d'autre. Chantier S2 de la roadmap (section 5 sexies), écrit et codé la
nuit du 13 au 14 novembre 2026 sur le mandat d'autonomie du porteur.

1. **Place.** En tête de chaque parcelle du bloc « Réserve du sol », sous
   son nom, au-dessus de son curseur et de ses jardins repliés ; la pastille
   de l'eau arrosée en trop reste en tête du bloc. Un graphique par
   parcelle.
2. **Une barre par jardin ou abri**, dans l'ordre de la page. La barre va
   de 0 à 100 % du plein ; son remplissage, en bleu eau, vaut le % du plein
   du jardin maintenant (`garden.percent`, la même valeur que le titre du
   pli). Le chiffre est écrit à droite, arrondi à l'unité comme le pli, en
   chiffres tabulaires. Sous le nom : « plein champ » ou « abri », et
   « n sous le seuil » s'il y en a.
3. **Les planches en points.** Chaque planche comptée dans le % du jardin
   (cultivée ou engrais vert, état connu) est un point placé à son % du
   plein maintenant, celui de son pli. Un point est orange quand la planche
   est sous son seuil, sa dose conseillée affichée ; une planche en arrêt
   avant récolte garde un point bleu, pour ne pas inviter à l'arroser. Les
   planches sans culture et les planches inconnues ne sont pas des points ;
   elles restent comptées dans la ligne du pli comme avant.
4. **Le prévu de dimanche** : un trait vertical en pointillés au % prévu de
   la fin de dimanche (dernier jour de `week` du jardin), quand il est
   connu. Prévu et estimé ne se confondent jamais (D-006) : le trait est la
   seule marque du prévu, nommée dans la légende (« jardin maintenant »,
   « planche sous son seuil », « prévu dimanche »).
5. **Inconnue.** Un jardin dont le % est inconnu montre une barre vide en
   pointillés marquée « inconnue » et un tiret à la place du chiffre,
   jamais zéro (D-003). Un jardin sans planche cultivée dit « aucune
   planche cultivée », sans barre.
6. **Repères** sous les barres : 0 %, sec 25, frais 50, humide 75, 100 %
   (les crans du curseur, P40).
7. **Toucher une barre** ouvre le pli du jardin en dessous et y fait
   défiler la page.
8. **Accessibilité.** Chaque barre est un bouton dont le nom, lu par un
   lecteur d'écran, dit tout ce qu'elle dessine : « Jardin 2 : 47 % du plein
   maintenant, 27 % prévu dimanche, 2 planches sous le seuil ». Le graphique
   n'est jamais la seule source d'un chiffre : tout reste écrit dans les
   plis.
9. **Téléphone (390 px).** Le nom passe au-dessus de la barre, le chiffre
   reste à droite ; rien ne déborde ; chaque barre fait au moins 44 px de
   haut.
10. **Charte.** Couleurs par les jetons de la charte (bleu eau `--water`,
    son fond `--water-soft`, son encre `--water-ink`, attention `--warn`) ;
    le chiffre dans la police des titres, au poids des tuiles de la
    troisième passe (`finitions.css`, S1).

**Précisions faites en codant** (14 novembre 2026, D-109), tranchées par la
recommandation sur le mandat du porteur, aucune agronomique :

- **F194 — une seule règle pour les points et le %.** La règle qui dit
  quelles planches entrent dans le % du jardin vit en un seul endroit
  (`countsInGardenPercent`, `signals.ts`) ; le graphique l'appelle, pour
  qu'un point ne paraisse jamais pour une planche que le % ne compte pas.
- **F195 — rien de dessiné sur une barre inconnue.** Ni point ni trait du
  prévu, même si un jour prévu était connu : une barre vide ne porte pas de
  chiffre. Son nom pour un lecteur d'écran : « Tunnel 1, abri : réserve
  inconnue ».
- **F196 — une barre inconnue se touche aussi.** Elle ouvre le pli du
  jardin, où « Observer » attend (point 13 de l'audit, lot 3). La ligne
  « aucune planche cultivée » n'est pas une barre et ne se touche pas.
- **F197 — un jardin rangé dans un pli de jardins pareils** (point 13) :
  toucher sa barre ouvre aussi le pli qui le range.
- **F198 — au téléphone, les repères perdent leur mot** (« 25 », « 50 »,
  « 75 » entre « 0 % » et « 100 % ») : à 390 px, « humide 75 » et
  « 100 % » se chevauchaient.
- **F199 — un % hors de 0 à 100 se place au bord** de la barre, son chiffre
  écrit tel quel.
- **F200 — la légende à chaque parcelle**, au-dessus de ses barres : chaque
  graphique se lit seul, la page pouvant compter plusieurs parcelles.

Preuves : `tests/soil-reserve-garden-bars.test.ts`, un test par règle
d'affichage (barre connue, inconnue, abri, sous le seuil, arrêt avant
récolte, sans planche cultivée, planches qui sont des points, prévu absent,
place et repères) ; le parcours navigateur P33 sur ordinateur et à
390 px ; la relecture du porteur sur la version déployée.

Ne changent pas : D-003, D-006, D-047, D-053.
