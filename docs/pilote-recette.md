# Pilote multi-fermes : grille de recette et protocole d'isolation

> Écrite le 20 novembre 2026 (4.6, PR 1, F573 et F574 du contrat `docs/tranche-4-contract.md`, section 10 ter). Modèle **vide**, à remplir pendant le pilote, par ferme.
>
> **Règles de ce fichier public** : les fermes se nomment « ferme A » (celle du porteur) et « ferme pilote 1 », « ferme pilote 2 » ; aucun nom de personne ou de ferme, aucune adresse, aucune capture, aucun chiffre d'une ferme pilote, aucune valeur secrète. **L'assistant n'ouvre jamais l'espace d'une ferme pilote** ni ses données ni ses journaux : ce que voit la ferme pilote est constaté et dit **par la personne elle-même** (contrainte 4 de 10 ter.2).

## 1. Les étapes

| Étape | Contenu | Qui |
| --- | --- | --- |
| S0 | Préparation à blanc : la fiche d'entrée (`docs/pilote-fiche-entree.md`) est complète et le porteur a écrit « vas-y » | assistant, porteur |
| S1 | La personne ouvre le module, passe l'accueil, autorise sa ferme dans Ouvre ta ferme **elle-même** (l'assistant ne voit jamais le jeton), avec le porteur au téléphone ou en visio | personne de la ferme, porteur |
| S2 | Une **semaine** d'usage libre ; notifications possibles si la personne les active ; le porteur regarde la page d'état et la veille chaque matin | personne, porteur |
| S3 | La grille du paragraphe 3 et le protocole du paragraphe 2 | personne, porteur |
| S4 | La deuxième ferme, **seulement si S3 est conforme et sans défaut grave** | idem |
| S5 | Le bilan (F577), écrit par l'assistant et jugé par le porteur | assistant, porteur |

Une seule ferme d'abord ; la deuxième après une semaine d'usage de la première sans défaut grave.

## 2. Protocole « A ne voit jamais B » (F573)

Joué **une fois à la fin de la première semaine (S3)**, puis **après tout changement touchant l'isolation**. Chaque ligne se conclut « conforme », « non conforme » (avec la cause) ou « non vérifié en réel » (avec la raison).

| N° | Contrôle | Qui constate | Constat |
| --- | --- | --- | --- |
| I1 | **Côté A** : rien de la ferme pilote n'apparaît dans les pages de l'espace du porteur : ni plantation, ni planche, ni matériel, ni message d'alerte, ni ligne de la page d'état autre que « 2 fermes reliées » et leurs compteurs par identifiant interne | assistant, dans le Chrome du porteur, **avec son accord à chaque fois**, en lecture seule | |
| I2 | **Côté B** : rien de la ferme A n'apparaît chez la ferme pilote : aucun nom de planche, de culture, de matériel ou de jardin qui ne soit pas le sien (questions oui/non du paragraphe 4) | **la personne de la ferme pilote** | |
| I3 | **L'appareil** : si les deux personnes n'ont aucun appareil commun, le cas de la revue du 18 novembre 2026 (D-159, un appareil, une personne) n'est pas jouable en réel ; il l'est avec l'appareil du porteur si le porteur a deux identités dans Access [NON VÉRIFIÉ] ; sinon la preuve reste celle des tests (#92) et **le constat le dit** | porteur | |
| I4 | **Les compteurs** : la page d'état montre un compte d'appels **séparé par ferme** ; un appel de B ne change pas celui de A ; le total reste sous le budget du jour de chacune (F363) | assistant (côté A), porteur | |
| I5 | **La base** : le contrôle de cohérence des espaces (F380) rejoué sur une copie de l'export hebdomadaire déchiffré par le porteur, sur son ordinateur : « n lignes vérifiées, 0 qui désigne un autre espace », **sans aucune valeur**. Ce contrôle est le seul code de la 4.6 (PR 2). **Tant qu'il n'existe pas, cette ligne reste « non vérifié en réel »** | porteur | |

Si I1, I2, I4 ou I5 est « non conforme », ou si un doute existe, **le pilote s'arrête tout de suite** (F576, cas 1) et le porteur est prévenu aussitôt dans le chat du projet.

## 3. Grille de recette par page (F574)

**À dresser au début de S3 depuis le menu réel du module** [À FAIRE] : la liste des pages change avec les sous-tranches. Point de départ (pages présentes dans l'application au 20 novembre 2026, à confirmer contre le menu réel) : Aujourd'hui, Planning, Besoins, Matériel, Ressources, Cultures, Sol, Arrosages, Historique, Alertes météo, Alertes cultures, Réglages, et l'accueil de la ferme.

Pour **chaque page**, aux **deux largeurs** (ordinateur et 390 px), on pose à la personne trois questions :

1. Voyez-vous votre plan, pas celui d'un autre ?
2. Un chiffre vous paraît-il faux ou absurde pour votre ferme ?
3. Un mot ou un bouton n'est-il pas clair ?

| Page | Largeur | Q1 plan à soi | Q2 chiffre faux | Q3 mot ou bouton | Constat | Cause, PR si non conforme |
| --- | --- | --- | --- | --- | --- | --- |
| | ordinateur | | | | | |
| | 390 px | | | | | |

Constats : **« conforme »** ou **« non conforme » avec sa cause**. Les chiffres de la ferme pilote **ne sont pas copiés** dans le dépôt.

### Ce qui doit se voir pour une ferme neuve

- Aucun faux zéro : « à renseigner » là où rien n'est connu (F422, section 8 bis.6 du contrat).
- La ferme exclue (hors France métropolitaine, plusieurs structures) est **dite avant toute saisie**.
- Les valeurs de départ sont celles de l'accueil de la 4.4 ; **aucun réglage agronomique du porteur** n'est repris.

## 4. Questions oui/non pour la personne de la ferme pilote (I2)

À lui lire ou à lui envoyer ; elle répond **sur sa propre ferme**, sans rien me montrer d'autre que ses réponses :

1. Tous les jardins, planches et cultures que vous voyez sont-ils bien les vôtres ? **oui / non**
2. Voyez-vous un nom de planche, de culture, de matériel ou de jardin que vous ne reconnaissez pas ? **oui / non** (si oui, ne le recopiez pas : dites seulement sur quelle page)
3. Les alertes et notifications reçues parlent-elles toutes de votre ferme ? **oui / non**
4. La page d'état (si vous y avez accès) ne montre-t-elle que votre ferme ? **oui / non / pas d'accès**
5. Avez-vous un appareil (téléphone, ordinateur) que vous partagez avec une autre ferme du module ? **oui / non**

Toute réponse « non » à 1, 3 ou 4, ou « oui » à 2, arrête le pilote (F576, cas 1).

## 5. Défauts

- Un défaut trouvé donne **une PR de correction à part**, comme toujours.
- **Un défaut d'isolation arrête le pilote** (F576) : constat écrit sans nom (quoi, quand, d'où vient la découverte), aucune reprise avant la correction et une nouvelle revue de ce qui a été touché.
- Un retour qui demande de changer une valeur agronomique est **consigné, pas appliqué** (F571) ; la décision est réservée au porteur.
