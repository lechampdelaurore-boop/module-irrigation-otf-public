# Contrat court — l'objectif automatique se voit et se modifie ; ignorer l'irrigation hors saison (6 quaterdecies)

Écrit le 26 novembre 2026, sans code, sur la demande du porteur du jour
(10 h 24 et 10 h 26, heure de Paris) : « Quand je coche objectif
automatique, ça ne remplit pas les objectifs en fonction de l'ET0 [...]
Je veux que, lorsqu'on coche, les millimètres que je dois rajouter par
rapport à l'évapotranspiration se renseignent automatiquement partout,
[et que je puisse le modifier]. En hiver, je n'ai pas besoin d'irriguer
dehors : un petit système de filtre pour ignorer certaines planches,
certains jardins, ou tout le plein champ, ou tout le sous-abri. » Puis :
« Pour le filtre, je veux juste pouvoir ignorer l'irrigation. Par contre,
je veux que l'historique de l'eau tombée par précipitation dehors soit
maintenu dans tous les endroits où c'est enregistré. »

Contrat écrit en Sonnet 5.5 · Moyen (travail sans code, grille générale).
Il **complète** `docs/objectif-automatique-contract.md` (6 decies, D-309,
D-316 à D-319) sans en changer la règle : rien de ce qui y est tranché
n'est rouvert.

**Logiciel multi-fermes.** Rien ici ne suppose la ferme du porteur : une
ferme sans sous-abri, sans plein champ, sans parcelle ou avec des jardins
« à classer » doit avoir un écran juste (section 6).

## 1. Pourquoi l'écran actuel est incompris (cause établie dans le code)

L'objectif automatique d'O1 à O4 est **calculé à la lecture, jamais écrit**
(contrat 6 decies, règle 5 : « Rien n'est enregistré jour après jour »).
Il ne remplit donc aucune des deux choses que le porteur regarde en
cochant :

1. **La liste et le champ du volet « Objectifs de la semaine »**
   (`app/irrigation/water-management-dashboard.tsx`). Elle ne montre que
   les objectifs **saisis** : réglage allumé, elle dit toujours « Aucun
   objectif pour cette semaine. », et le champ « mm / semaine » reste vide.
   L'interrupteur est au-dessus, avec une phrase ; la valeur
   automatique, elle, n'apparaît que loin de là (tableau des besoins,
   bulle « D'où vient cet objectif ? », tuile d'« Aujourd'hui »).
2. **Les planches qui gardent un objectif saisi.** Un objectif saisi, même
   « Toute la ferme », passe toujours avant (règle 2). Une ferme qui en a
   un voit donc **rien changer** en allumant le réglage ; l'écran le dit
   plus bas (« N planches gardent un objectif saisi »), après l'interrupteur
   et sans lien avec le geste du porteur.

Autrement dit : le calcul fait ce qu'il doit, mais l'écran n'a jamais
montré le résultat à l'endroit où l'on saisit, ni dit tout de suite
pourquoi il ne change rien. C'est un défaut de lisibilité, pas de calcul.

## 2. Ce que veut le porteur, en deux demandes

- **A. Voir et modifier les mm automatiques partout.** Allumé, l'objectif
  de chaque planche, jardin et parcelle se lit dans le volet comme un
  objectif, avec sa valeur ; on le corrige en saisissant : la saisie passe
  avant (règle 2), le reste de la ferme continue de suivre l'ET0.
- **B. Ignorer l'irrigation hors saison.** Un filtre qui met des planches,
  des jardins, des parcelles, tout le plein champ ou tout le sous-abri
  « hors saison » : plus d'objectif, plus de proposition d'irrigation. **Et
  rien d'autre** (section 4).

## 3. Demande A — l'objectif automatique se voit et se modifie

Choix de l'assistant, sans question à fixer (aucune agronomie, aucun
calcul changé ; chacun reste modifiable par le porteur) :

1. **Calculé et affiché, pas écrit.** Les valeurs ne deviennent pas des
   objectifs enregistrés chaque matin : écrire chaque matin effacerait la
   différence entre « saisi » et « automatique », ferait passer une
   valeur automatique de la veille avant celle du lendemain, et un simple
   « Vider les objectifs » laisserait la ferme sans repère. La règle 2
   (un objectif saisi passe avant) et le journal ne changent pas.
2. **La liste dit les deux.** Dans le volet « Objectifs de la semaine »,
   réglage allumé, chaque ligne de la liste est soit un objectif saisi (comme
   aujourd'hui), soit une ligne **« automatique »** par jardin (et par
   planche quand elle s'écarte de son jardin) avec ses mm de la semaine et
   son origine (culture, ET0, ET0 sous abri), dans les mots de F791. Les
   semaines à venir lisent l'ET0 prévue et le disent (« prévu »).
3. **Le champ est prérempli.** Choisir un endroit dans le sélecteur
   (ferme, parcelle, jardin, planche) montre dans « mm / semaine » la valeur
   en vigueur, marquée « automatique » ou « saisie » ; la modifier puis
   « Enregistrer » pose un objectif saisi, le geste existant. Un champ
   laissé tel quel n'écrit rien.
4. **Retour à l'automatique d'un geste.** Une ligne saisie propose
   « Revenir à l'automatique » (le geste « vider » de cet endroit seul, le
   geste existant), sans toucher aux autres.
5. **Allumer dit ce qui change, avant.** Si des objectifs saisis couvrent
   des planches de la saison, allumer ouvre une fenêtre : « N planches ont un
   objectif saisi, qui passe avant l'objectif automatique. » avec trois
   boutons : « Allumer, garder mes objectifs » (le défaut), « Allumer et
   vider les objectifs » (rouge, comme « Vider les objectifs » existant,
   F414-F415) et « Annuler ». L'écran ne vide jamais seul sans ce choix
   (règle 2 du 6 decies). Sans objectif saisi, allumer n'ouvre rien.
6. **Une phrase de résultat sous l'interrupteur**, tant qu'il est
   allumé : « Cette semaine : 24 mm en moyenne sur 7 planches, d'après
   l'ET0 ; 2 planches gardent un objectif saisi. » (mêmes chiffres que
   `farmObjective`, S1, D-328 : un seul calcul).
7. **« Partout »** s'entend : le volet des objectifs, le tableau des
   besoins, la tuile d'« Aujourd'hui », le planning, l'historique : ils
   lisent déjà la même fonction (`objectiveForBed`) et disent déjà
   l'origine (F791). Ce lot n'ajoute que la liste et le champ du volet,
   la fenêtre d'allumage et la phrase de résultat. Aucune autre page ne
   change.

Réglage éteint, l'écran est celui d'avant, mot pour mot.

## 4. Demande B — le filtre « hors saison » : ignorer l'irrigation, rien d'autre

### 4.1 Ce que le filtre fait

Un endroit « hors saison » (une planche, un jardin, une parcelle, **tout le
plein champ**, **tout le sous-abri**) **ne reçoit plus d'irrigation
calculée** :

- **pas d'objectif** : ni l'objectif saisi, ni l'objectif automatique n'y
  compte ; la planche n'a pas d'objectif et le dit « hors saison », jamais
  « sans objectif » ni zéro (D-003) ;
- **pas de proposition d'arrosage** : ni le planning, ni « Aujourd'hui » ne
  proposent d'irriguer ses planches ; la pénurie et la faisabilité ne les
  comptent pas dans la demande ;
- **elle sort des comptes d'objectif**, qui le disent : « 7 planches sur 10
  ont un objectif » devient « 7 planches sur 7 ont un objectif, 3 hors
  saison » ; la moyenne de la ferme (`farmObjective`) se fait sur les
  planches en saison.

### 4.2 Ce que le filtre ne fait jamais (règle de la demande du porteur)

**Il n'ignore que l'irrigation.** Hors saison, comme en saison :

- **la pluie tombée dehors reste enregistrée et suivie partout où elle l'est
  aujourd'hui** : la pluie mesurée au pluviomètre (y compris `0 mm`, qui
  prime, D-019 et AGENTS.md), la pluie estimée par la réanalyse, la pluie
  prévue ; son historique par semaine, jour et planche ; les bilans ; la
  réserve du sol (RFU) et son graphique ; l'archivage des prévisions. Sous
  abri, la pluie vaut `0`, comme avant ;
- **l'ET0, la météo et ses alertes** (gel, vent, chaleur, alertes par
  culture) continuent : un gel d'hiver sur des poireaux dehors doit
  toujours alerter ;
- **une irrigation réelle** reste toujours enregistrable ; elle compte dans
  l'historique et ses cumuls, sans dépassement de rien inventé (règle de la
  restriction, AGENTS.md) ;
- **le passé ne bouge pas** : le filtre compte **à partir de son jour**, en
  heure de Paris, comme une révision d'objectif (D-034, D-039) ; une
  semaine déjà close garde l'objectif qu'elle avait (D-318) ; l'historique
  est immuable (D-006) ;
- **une irrigation déjà planifiée ou validée** n'est pas réécrite (« Le
  cycle », `docs/planning-contract.md`) : voir la question 2, section 10 ;
- **les cultures, les stades, les séries** restent lus : l'ETM et l'objectif
  proposé restent calculables et affichés, marqués « hors saison », pour
  que la reprise ne parte pas de rien.

Les deux règles sont des **tests de garde** (section 8) : un filtre actif
ne change aucun chiffre de pluie, de réserve du sol ni d'alerte.

### 4.3 Qui se filtre, et comment

Cinq portées, au même vocabulaire que les objectifs saisis (parcelle, jardin,
planche) et que `PlotMode` (`garden` = plein champ, `greenhouse` = sous
abri, `unclassified` = à classer) :

| Portée | Ce qu'elle couvre |
| --- | --- |
| Une planche | elle seule |
| Un jardin ou un abri | toutes ses planches |
| Une parcelle | tous ses jardins et abris |
| **Tout le plein champ** | tous les jardins de mode plein champ de la ferme |
| **Tout le sous-abri** | tous les jardins de mode sous abri |

- **Évaluées à la lecture**, comme les objectifs saisis : un jardin
  reclassé plein champ → sous abri suit la portée qui le couvre à ce
  moment-là ; l'écran le dit au moment de reclasser.
- Un jardin **« à classer »** n'est couvert ni par « tout le plein champ »
  ni par « tout le sous-abri » : l'écran l'écrit en toutes lettres sous
  les deux boutons et le propose en une ligne (« 2 jardins à classer :
  les classer, ou les mettre hors saison un par un »). Il ne devine jamais
  le mode (D-003).
- Plusieurs portées peuvent se recouvrir (un jardin et tout le plein champ) :
  une planche est hors saison si **une** portée active la couvre. Lever une
  portée ne lève pas celles qui la recouvrent ; l'écran dit lesquelles
  restent (« Le jardin Nord reste hors saison : ... »).
- Une ferme **sans sous-abri** (ou sans plein champ) ne voit pas le bouton
  « tout le sous-abri » ; une ferme sans aucun jardin classé ne voit que
  parcelle, jardin et planche.

### 4.4 Où

Dans « Objectifs de la semaine », sous la liste, un bloc **« Hors saison »** :
les portées actives en puces (« Tout le plein champ · depuis le 20 nov. »)
et un bouton « Mettre hors saison » qui ouvre le choix des cinq portées.
Même geste, même fenêtre au téléphone et à l'ordinateur ; chaque puce a
« Reprendre ». Après S4, le bloc vit dans le pli « Objectifs de la semaine »
de la page « La semaine » (`docs/simplification-s4-contract.md`, section
8.1) : même place, même geste.

Un **raccourci**, sans règle de plus : la tuile « Objectif de la semaine »
d'« Aujourd'hui » dit « 3 planches hors saison » avec un lien vers ce bloc
quand il y en a.

### 4.5 Le geste

Mettre hors saison et reprendre sont des gestes **datés**, écrits au journal
des modifications (« jardin-hors-saison », « reprise-saison », même schéma
que le réglage d'O2), annulables, qui **rendent la faisabilité à refaire**
(comme un objectif qui change) et recalculent le plan du jour. Un geste
sans effet n'écrit rien et le dit. Mettre hors saison **ne supprime aucune
donnée** : aucune planche, aucune série, aucun objectif saisi n'est effacé ;
un objectif saisi sous une portée active reste là, inactif, et s'applique
de nouveau à la reprise.

### 4.6 Un seul endroit pour la règle

Comme l'objectif automatique : **une fonction** (`lib/domain/off-season.ts`,
nom à confirmer en codant) répond « cette planche est-elle hors saison ce
jour-là ? » ; `objectiveForBed` la reçoit, jour par jour, et rend « hors
saison » ; **aucun lecteur ne la refait**. La pluie, la RFU, l'ET0, les
alertes n'appellent pas cette fonction : le test de garde le prouve
(section 8).

## 5. Cas chiffrés

Semaine du lundi au dimanche, ET0 des sept jours : 4,0 · 4,2 · 3,8 · 4,5 ·
5,0 · 4,6 · 3,9 mm (30,0 mm). Objectif automatique allumé, sauf mention.

| Cas | Situation | Résultat |
| --- | --- | --- |
| 1 | plein champ « hors saison » toute la semaine, objectif de ferme saisi 20 mm | planche : hors saison, pas d'objectif (le 20 mm saisi est inactif, conservé) ; sous abri : 20 mm |
| 2 | plein champ hors saison depuis le jeudi | 3 jours d'objectif (lundi à mercredi), puis hors saison : la semaine dit « hors saison depuis jeudi » |
| 3 | plein champ hors saison, il pleut 12 mm dehors lundi (pluviomètre) | la pluie du lundi reste dans l'historique, le bilan et la RFU ; l'objectif n'y compte pas |
| 4 | « tout le plein champ » + jardin Nord (plein champ) hors saison ; on reprend « tout le plein champ » | le jardin Nord reste hors saison, dit |
| 5 | « tout le sous-abri » ; un jardin « à classer » | le jardin à classer n'est pas couvert, dit |
| 6 | irrigation réelle enregistrée mardi sur une planche hors saison | enregistrée, comptée dans l'historique, sans objectif auquel la comparer (« hors saison ») |
| 7 | semaine déjà close avant la pause | objectif d'avant, enregistré (D-318), inchangé |
| 8 | gel prévu vendredi, culture dehors hors saison | l'alerte de gel part comme avant |
| 9 | pause levée mercredi | objectif à partir du mercredi (3,8 + 4,5 + 5,0 + 4,6 + 3,9 = 21,8 mm), lundi et mardi « hors saison » |
| 10 | réglage « Objectif automatique » éteint, plein champ hors saison | pas d'objectif saisi non plus ; l'irrigation y est ignorée comme réglage allumé (le filtre ne dépend pas de l'automatique) |

## 6. Précisions et cas limites (multi-fermes)

- Le filtre **vit par ferme** (isolation par utilisateur, exploitation,
  saison, D-001) ; chaque portée est datée.
- Il **ne dépend pas** de l'objectif automatique : il ignore aussi les
  objectifs saisis (cas 10).
- La saison courante seule : une portée de planche, jardin ou parcelle est
  attachée à l'identifiant OTF et suit la planche d'une saison à l'autre ;
  les portées « tout le plein champ » et « tout le sous-abri » valent pour
  toutes les saisons de la ferme tant qu'elles sont actives. Une ferme
  qui change de saison garde ses portées et le voit dit au premier écran.
- La démonstration garde le filtre vide dans tous ses profils : rien ne l'y
  active.
- Une planche hors saison **apparaît** encore au tableau des besoins, grisée
  et dite « hors saison », avec sa pluie ; elle n'est pas masquée.
- L'écran n'écrit jamais seul un filtre : même pas à l'entrée de l'hiver ;
  aucune date automatique, aucun calendrier supposé (voir question 1).

## 7. Livraison en quatre PR, une à la fois

À coder **après la fusion des PR S4 et S6** (#231 à #238), qui touchent le
même volet : le coordinateur lance le code au réglage de la ligne 34.

| PR | Objet | Fichiers principaux | Preuve | Réglage |
| --- | --- | --- | --- | --- |
| **A1 · Voir et modifier** | la liste « automatique » du volet, le champ prérempli, « Revenir à l'automatique », la fenêtre d'allumage, la phrase de résultat ; aucune migration, aucune règle | `app/irrigation/water-management-dashboard.tsx`, `lib/services/water-dashboard.ts`, `lib/domain/objective-reading.ts` | tests du domaine (liste, préremplissage), parcours aux deux largeurs : allumer avec un objectif de ferme, lire, corriger, revenir | Opus 5.5 · Élevé |
| **B1 · La règle** | `off-season.ts` et son entrée dans `objectiveForBed` ; filtre toujours vide, rien ne change | `lib/domain/off-season.ts`, `lib/domain/irrigation-needs.ts`, `lib/domain/farm-objective.ts` | tests du domaine : les dix cas ; garde « pluie, RFU, alertes inchangées » | Opus 5.5 · Max |
| **B2 · Le stockage et les lecteurs** | une migration (portées datées), journal, tous les lecteurs de l'objectif et du planning reçoivent le filtre ; semaine close inchangée ; aucun écran ne l'active | une migration, `db/`, services des besoins, du planning, de la faisabilité, de la pénurie, d'« Aujourd'hui », de l'historique | tests de persistance à deux fermes ; pluie, RFU, historique de pluie, alertes identiques filtre actif et inactif | Opus 5.5 · Max |
| **B3 · Les écrans** | le bloc « Hors saison », la fenêtre « annuler les arrosages planifiés ? », la ligne « hors saison » au tableau des besoins, la tuile d'« Aujourd'hui », les aides | volet, tableau des besoins, `app/irrigation/today/`, `lib/domain/features/help.ts` | parcours nouveau aux deux largeurs : mettre tout le plein champ hors saison, lire, reprendre | Opus 5.5 · Élevé |

A1 est indépendante de B1 à B3 ; B1 peut commencer avant la fusion de
S4/S6 (domaine seul, aucun écran). B2 et B3 attendent cette fusion. Une PR
à la fois en fusion ; les registres de chaque PR sont mis à jour dans la
même PR.

## 8. Preuves exigées

- les dix cas de la section 5 en tests du domaine ;
- **garde de la pluie** (la demande du porteur) : à deux fermes, avec et sans
  filtre actif, la pluie du pluviomètre, la pluie estimée, la pluie
  prévue, la RFU (valeur et graphique), l'historique de la pluie par jour
  et par semaine, l'archivage des prévisions et les alertes météo
  **donnent les mêmes valeurs** ;
- contre-épreuve : un test qui lit une pluie, une RFU ou une alerte à
  travers la fonction « hors saison » échoue (la règle ne s'y appelle pas) ;
- une semaine close, un objectif saisi sous une portée, une irrigation
  planifiée déjà là : inchangés ;
- parcours : P58 repris pour A1 ; un parcours nouveau pour B3.

## 9. Ce que le contrat ne prouve pas

- Qu'un objectif égal à l'ET0 convienne à une ferme (contrat 6 decies, 7).
- Qu'une planche cesse d'avoir besoin d'eau en hiver : le filtre n'éteint
  que les propositions du module ; une planche dehors peut encore avoir
  besoin d'eau (serre froide, plants repiqués) et c'est le porteur qui le
  décide, planche par planche, jamais le module.

## 10. Questions au porteur (agronomie et conduite de la ferme)

Posées une par une, sur cartes, avec recommandation ; la question 2 est
écrite sur l'option recommandée, modifiable :

1. **La reprise** — *répondue par le porteur le 26 novembre 2026 à 11 h 37* :
   **à la main seulement**, par « Reprendre ». Ni date de reprise, ni
   calendrier : le filtre ne se lève jamais seul.
2. **Les arrosages déjà planifiés ou validés** — *répondue par le porteur
   le 26 novembre 2026 à 11 h 37* : **le module propose de les annuler**.
   En mettant hors saison, une fenêtre compte les arrosages planifiés ou
   validés des planches concernées et propose « Les annuler » ou « Les
   garder » (le défaut) ; rien n'est annulé sans ce choix, et l'annulation
   passe par le geste existant du planning, planche par planche, jamais
   par réécriture (« Le cycle », `docs/planning-contract.md`). Un arrosage
   déjà démarré n'est pas proposé : il se termine. Ce geste est livré
   par B3 (écran) ; B2 fournit la liste des arrosages concernés.
