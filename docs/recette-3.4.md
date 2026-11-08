# Recette utilisateur de la sous-tranche 3.4 — Faisabilité et répartition de l'eau

Protocole préparé le 18 septembre 2026. La recette se fait sur le site privé,
avec les données réelles de la ferme, par le porteur de projet. Elle clôt les
points ouverts 1 et 2 du registre d'état et vérifie au passage la correction
3.3.1. Aucune opération destructrice : les seuls gestes sont des réglages
réversibles, remis à leur valeur initiale en fin de recette.

Résultat attendu de la recette : chaque ligne des tableaux ci-dessous porte un
constat et un verdict OK ou KO. Un KO devient un défaut à corriger dans une
branche dédiée ; la 3.4 n'est clôturée qu'avec zéro KO bloquant.

## 0. Préalables

| Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- |
| Le site privé exécute la version de `main` incluant la PR #17 | Dans « Voir le calcul » d'une planche de la section Besoins, la ligne ET0 porte la mention « Information · hors calcul » et il n'y a plus de ligne « Demande retenue » | | |
| Semaine sélectionnée | Semaine civile courante, du lundi au dimanche, affichée en tête des sections Besoins et Faisabilité | | |
| Navigateur | Ordinateur, puis smartphone ou fenêtre réduite à 390 px de large | | |

## A. Synchronisation météo automatique (point ouvert 2)

À faire sans cliquer sur « Actualiser la météo ».

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| A1 | Panneau « Météo de référence », ligne « Dernière synchronisation automatique » | Une date du jour même, autour de 06 h 15 heure de Paris | 20/09/2026 : « Dernière synchronisation automatique : 20/09/2026 06:15 », heure programmée du planificateur (04 h 15 UTC, rattrapage 05 h 15) | OK, premier matin |
| A2 | Ligne « Dernière mise à jour » | Date du jour ou de la veille, sans mention « données anciennes » | 20/09/2026 : « 15/09/2026 18:24 · données anciennes » le matin même d’une synchronisation réussie. Cause : la date comptait les prévisions figées des jours passés, que plus aucune actualisation ne renouvelle. 21/09/2026 au soir, après déploiement : « Dernière mise à jour : 21/09/2026 21:01 », sans mention | KO le 20/09, corrigé le même jour (PR #46, règle précisée dans le contrat météo) ; **OK le 21/09/2026**. La lecture est concluante : les prévisions du 16 au 18 septembre récupérées le 15 à 18:24 sont toujours en base et ne seront jamais renouvelées, donc le défaut aurait affiché la même date qu’avant, quelle qu’ait été l’actualisation |
| A3 | Section Besoins, planche quelconque, « Pourquoi ? » ou « Voir le calcul » | Pluie prévue et ET0 disponibles pour tous les jours restants de la semaine, aucune date manquante | 20/09/2026, planche B1-1 : pluie prévue 0 mm et ET0 23,4 mm présentes. Constat annexe : pluie réelle « Non calculable », les 16, 17 et 18 septembre n’ayant pas de réanalyse (retard de cinq jours du fournisseur, aucune consultation du 15 au 19), d’où un besoin non calculable | OK sur l’attendu ; constat annexe reporté en D |
| A4 | Le lendemain matin, sans action de ta part, refaire A1 | Nouvelle date du jour, de nouveau autour de 06 h 15 | 21/09/2026 : « Dernière synchronisation automatique : 21/09/2026 06:15 », deuxième matin consécutif, sans aucune action du porteur | **OK, deuxième matin** |
| A5 | Si une pluie manuelle a été saisie sur un jour passé | Elle est conservée après la synchronisation, la réanalyse ne l'a pas écrasée | Pluie de 5 mm saisie le 21/09/2026 sur la journée du 21. Relu le 28/09/2026 au soir sur la version déployée (`5c2265a`, déploiement du 26/09 réussi), constat de l’assistant dans le navigateur du porteur, à sa demande : semaine du 21 au 27 septembre, tableau journalier « lun. 21 sept. 2026 … 5 mm · mesurée », l’ET0 du même jour étant marquée « réanalyse », donc la réanalyse du 21 est bien arrivée ; « Pourquoi ? » de la planche B1-1 : « Pluie réelle : 5 mm », besoin réel 15 mm pour un objectif de 20 mm. Réanalyse Open-Meteo interrogée directement pour le 21/09 aux coordonnées de la ferme : 0 mm, la lecture départage donc bien les deux valeurs | **OK le 28/09/2026.** La mesure du pluviomètre a survécu à l’arrivée d’une réanalyse différente (0 mm) et reste celle que le calcul retient |

A1 et A4 réussies sur deux matins consécutifs ferment le point ouvert 2 :
**fermé le 21 septembre 2026**.

La lecture de A4 peut se faire à toute heure de la journée : la ligne
« Dernière synchronisation automatique » n’est écrite que par le planificateur
nocturne (`db/automatic-weather-repository.ts`), jamais par un clic sur
« Actualiser la météo ».

## B. Faisabilité et répartition (point ouvert 1)

Menée le 24 septembre 2026 au soir, sur le site privé, données réelles de la
ferme. **Les constats de B1 à B5 et de C ont été relevés par l'assistant dans le
navigateur du porteur**, qui lui en avait donné l'accès et l'autorisation
explicite de modifier les données, le logiciel n'étant pas encore en service
opérationnel. Le porteur a constaté lui-même les préalables et B1.1. B6 lui
reste : c'est le seul point que l'assistant ne pouvait pas éprouver.

Deux écarts au protocole, motivés plus bas en D, et un mot sur l'outil :
les clics de souris synthétiques de l'assistant n'atteignaient pas les
gestionnaires de la page — les éléments n'ont répondu qu'au clavier ou à un
événement déclenché sur l'élément réel. Le geste de pointage lui-même n'est
donc pas éprouvé par ces constats ; c'est B6.1 qui le couvre.

### B1. Chargement et cohérence

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| B1.1 | Faire défiler la page jusqu'à la section « Faisabilité et répartition de l'eau » | Le calcul se lance tout seul à l'approche de la section, puis affiche « Semaine du … au … · Calculé le … » | 24/09/2026, constaté par le porteur puis deux fois par l'assistant : « Semaine du 2026-09-21 au 2026-09-27 · Calculé le 24/09/2026 21:09 ». Le déclenchement demande un vrai défilement : un `scrollIntoView` programmé laisse la section sur « Les besoins et ressources seront chargés » | OK |
| B1.2 | Tuile « Besoins totaux » | Égale à la somme des besoins effectifs en m³ de la section Besoins, ou « Partie connue » si une planche est non calculable | Tuile 54,645 m³ ; somme des 164 planches affichées 54,658 m³. Écart 0,013 m³, soit 13 litres, très en deçà de l'enveloppe d'arrondi (0,082 m³ au maximum pour 164 valeurs à trois chiffres significatifs). Aucune planche non calculable | OK |
| B1.3 | Tuile « Eau mobilisable actuellement » | Égale à la somme des volumes actuels des réserves de la section Ressources, moins leurs minima de sécurité | Tuile 30,00 m³ ; réserve tampon actuel 30 m³, minimum de sécurité 0 m³ | OK |
| B1.4 | « Voir les ressources prises en compte » | Chaque réserve et ressource active apparaît avec son volume actuel et son prévisionnel restant | Réserve tampon : actuel 30,00 m³, prévisionnel restant 60,00 m³. Forage principal : actuel 0,00 m³, prévisionnel restant 54,195 m³. Les deux y sont. Vérifié aussi en creux : le forage disparaît de la liste dès qu'il est indisponible, la liste ne portant que les ressources actives | OK |
| B1.5 | Bouton « Recalculer la faisabilité » | Même résultat qu'au chargement, date de calcul mise à jour | 21:09 → 21:14, les huit tuiles strictement identiques | OK |

### B2. Couverture complète

Situation attendue si l'eau suffit pour tous les besoins de la semaine.

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| B2.1 | Chaque planche ayant un besoin | Statut « Besoin entièrement satisfait en volume », déficit résiduel 0 mm, satisfaction 100 % | Les 164 planches contrôlées une à une : toutes portent le statut attendu, déficit résiduel 0 mm, satisfaction 100 %. Aucune exception | OK |
| B2.2 | Planche sans besoin | Statut « Aucun besoin », allocation 0 | **Rien à observer** : les 164 planches du périmètre ont toutes un besoin de 15 mm cette semaine. Le cas ne se présente pas | Non observable |
| B2.3 | Tuiles globales | Déficit global 0 m³, taux de couverture 100 % | Déficit global 0,00 m³, taux de couverture 100 % | OK |
| B2.4 | « Volume satisfait », détail « Dont chaîne connue » | Inférieur ou égal au volume satisfait ; si inférieur, une raison hydraulique explicite apparaît sur les planches concernées | Satisfait 54,645 m³, dont chaîne connue 8,438 m³. Resommé : les 25 planches sans avertissement pèsent 8,44 m³, les 139 autres 46,218 m³ et portent toutes « Faisabilité hydraulique non vérifiée : pompe, origine ou liaison jusqu'à la planche à préciser ». Le bandeau annonce en écho 46,207 m³ « potentiellement utilisable » | OK |

### B3. Pénurie et arbitrage manuel

Provoquer une pénurie sans toucher aux ressources : dans la section Besoins,
activer « Remplacer le besoin calculé » sur deux planches de même priorité avec
un besoin manuel élevé, par exemple 60 mm, raison « recette 3.4 ». Noter les
valeurs initiales pour les remettre en B5.

**Écart au protocole, 24/09/2026.** La prémisse ne tient pas sur cette ferme :
les planches font 24 m² et l'eau disponible 114 m³. Deux besoins manuels de
60 mm pèsent 2,88 m³ — aucune pénurie. Il aurait fallu inscrire 2 400 mm par
planche, chiffre absurde qui n'aurait rien prouvé de lisible. La rareté a donc
été créée par l'autre bout, et de façon réaliste : forage passé en
indisponible, réserve corrigée de 30 m³ à 1 m³, soit un été sec. Les deux
planches retenues, **B11-8 et B11-9**, de surfaces identiques pour que B3.6 se
lise, ont été montées en **priorité haute** — sans quoi, toutes les priorités
étant à « normale », il n'existait aucune priorité inférieure pour B3.4 et la
pénurie aurait jeté les 164 planches en arbitrage d'un coup. État initial noté
avant toute modification : toutes priorités normales, seuil 5 mm, réserve
30 m³, forage disponible, aucune limite de prélèvement.

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| B3.1 | Après enregistrement des deux besoins manuels | La section Faisabilité se recalcule seule ; la priorité concernée affiche « Arbitrage manuel nécessaire » | Recalcul spontané après l'enregistrement, sans aucun clic : 21:19 → 21:21. Besoins totaux passés de 54,645 à 56,805 m³, l'écart exact des deux planches (0,36 → 1,44 m³ chacune). Priorité Haute : « Arbitrage manuel nécessaire ⓘ » avec « 1,00 m³ disponibles au maximum pour 2,88 m³ de besoins » | OK |
| B3.2 | Les deux planches | Statut « Arbitrage nécessaire », cases « Servir … » disponibles, aucune quantité à saisir | Les deux portent « Arbitrage nécessaire », cases « Servir B11-8 » et « Servir B11-9 », allocation 0 avant décision. La consigne le dit en toutes lettres : « Sélectionnez les planches à servir ; aucune quantité n'est à saisir » | OK |
| B3.3 | Tuile « Volume affectable » | Détail « Maximum théorique avant arbitrage » ; « Déficit global » avec détail « Déficit minimal avant votre décision » | « Volume affectable 1,00 m³ · Maximum théorique avant arbitrage » et « Déficit global 55,805 m³ · Déficit minimal avant votre décision ». Les deux libellés n'apparaissent qu'en situation d'arbitrage : hors pénurie ils valent « Après sélection et seuil minimal » et « Besoins non couverts » | OK |
| B3.4 | Priorités inférieures | Message « Résolvez d'abord la priorité précédente », statut « En attente de la priorité précédente » | Priorité Normale, 162 planches : « Résolvez d'abord la priorité précédente ou ses données manquantes. » et, sur chaque planche, « En attente de la priorité précédente » | OK |
| B3.5 | Cocher une seule planche, « Valider la sélection » | Elle reçoit le maximum disponible ; l'autre passe « Non retenue lors de l'arbitrage » avec allocation 0 et une explication | B11-8 seule cochée : elle reçoit 41,67 mm · 1,00 m³, soit tout le disponible, déficit résiduel 18,33 mm · 0,44 m³, satisfaction 69,44 %, statut « Besoin partiellement satisfait » avec « Eau compatible disponible insuffisante pour couvrir ce besoin après les priorités précédentes ». B11-9 : allocation 0, statut « Non retenue lors de l'arbitrage », explication « Non retenue lors de l'arbitrage manuel » | OK |
| B3.6 | Cocher les deux planches, valider | Si l'eau manque encore, même fraction du besoin pour chacune ; le déficit résiduel de chacune est explicite | Chacune reçoit exactement 20,83 mm · 0,50 m³, soit 34,72 % de son besoin — la même fraction au centième — et affiche son déficit résiduel, 39,17 mm · 0,94 m³. La somme fait 1,00 m³, tout le disponible, sans perte | OK |
| B3.7 | Décocher tout, valider | Message indiquant qu'aucune planche ne sera retenue ; le reliquat passe aux priorités inférieures | Avant validation : « 0 planche(s) sélectionnée(s) · aucune planche ne sera retenue ». Après : Haute satisfait 0,00 m³, et la priorité Normale bascule en « Arbitrage manuel nécessaire » avec « 1,00 m³ disponibles au maximum pour 53,925 m³ de besoins ». Le reliquat est bien descendu | OK |
| B3.8 | Après validation | « Arbitrage enregistré » avec « Dernière décision : date » ; le rechargement de la page conserve la décision | « Arbitrage enregistré ⓘ · Dernière décision : 24/09/2026 21:22 ». Après rechargement complet de la page : les deux cases toujours cochées, allocations conservées à 20,83 mm · 0,50 m³, même horodatage de décision | OK |

### B4. Revalidation et seuil

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| B4.1 | Changer la priorité manuelle d'une des deux planches arbitrées | La priorité affiche « Arbitrage à valider de nouveau » ; l'ancienne exclusion n'est pas appliquée en silence | Arbitrage validé en ne retenant que B11-8, donc B11-9 exclue ; puis B11-8 repassée en normale. **La garantie de fond tient** : B11-9, seule restante, reçoit aussitôt 41,67 mm · 1,00 m³ — son exclusion n'est pas rejouée. Le libellé « Arbitrage à valider de nouveau », lui, n'apparaît pas, et c'est cohérent : une planche seule à son niveau ne demande plus aucun choix, il n'y a donc plus d'arbitrage à revalider. Le protocole supposait un groupe restant arbitrable ; voir B4.2, où le cas se présente | OK, avec la réserve ci-contre |
| B4.2 | Remettre la priorité initiale | Le message de revalidation reste : il faut valider de nouveau | B11-8 remise en haute : « **Arbitrage à valider de nouveau ⓘ** », « Dernière décision : 24/09/2026 21:26 » conservée, cases dans l'état de la décision précédente — mais **allocations remises à 0,00 m³ et statut « Arbitrage nécessaire » tant qu'on n'a pas revalidé**. La décision passée sert de point de départ, jamais de résultat | OK |
| B4.3 | Fixer le seuil minimal de planification très haut, par exemple 40 mm, dans la section Besoins | Les planches dont l'allocation passe sous le seuil affichent « Allocation inférieure au seuil » avec la proposition brute et « Volume non affecté » | Seuil porté à 40 mm : les deux planches, allouées à 20,83 mm, affichent « Allocation inférieure au seuil » et « Proposition brute : 0,50 m³ · seuil 40 mm. Volume non affecté. ». Les tuiles suivent : « Volume affectable 0,00 m³ », « Volume non affecté 1,00 m³ · Dont sous seuil : 1,00 m³ ». Les 162 planches à 15 mm sortent aussi des besoins totaux, tombés à 2,88 m³ | OK |
| B4.4 | Remettre le seuil initial | Retour aux statuts précédents | Seuil ramené à 5 mm : allocations revenues à 20,83 mm · 0,50 m³, satisfaction 34,72 %, besoins totaux de nouveau 56,805 m³ | OK |

### B5. Remise en état

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| B5.1 | Désactiver les deux besoins manuels de B3 | Retour aux besoins calculés ; la faisabilité se recalcule seule | Besoins manuels désactivés et priorités remises en normale : les deux planches repassent à 15 mm · 0,36 m³. Réserve recorrigée à 30 m³, forage remis en disponible | OK |
| B5.2 | Rechargement de la page | Aucun besoin manuel « recette 3.4 » ne subsiste ; la faisabilité affiche la situation réelle | Aucune occurrence de « recette 3.4 » dans la page. Besoins totaux 54,645 m³, mobilisable 30,00 m³, satisfait 54,645 m³ dont chaîne connue 8,438, déficit 0,00 m³, couverture 100 % : les chiffres du début, à l'identique. La disponibilité prévisionnelle passe de 114,195 à 113,798 m³, les vingt minutes de forage écoulées entre-temps. **Et le logiciel annonce de lui-même** : « L'ancien arbitrage Haute n'est plus applicable ; les exclusions ne seront pas réactivées automatiquement. » | OK |

### B6. Smartphone

**La part mesurable est passée au parcours automatisé le 25 septembre 2026**
(`e2e/p7-arbitrage-penurie.spec.ts`). Il recrée la pénurie sur les données de
démonstration — il coupe ses propres ressources, comme un été sec, et les
rétablit —, puis éprouve l'écran d'arbitrage aux deux largeurs, à chaque
exécution. Ce qui restait à faire une fois est désormais vérifié à chaque PR.

Restait au porteur ce qu'aucune émulation ne remplace : le confort réel sur son
appareil. Le projet `telephone` est un navigateur de bureau à 390 px de large,
déclaré `isMobile: false` : il envoie des événements de souris, pas de toucher,
et ne reproduit ni la taille de police réglée sur le téléphone, ni la barre du
navigateur qui mange de la hauteur.

**Fait le 25 septembre 2026.** L'assistant a provoqué la pénurie sur la ferme
réelle à sa demande — forage rendu indisponible, réserve corrigée à 1 m³, soit
1,00 m³ disponible pour 54,645 m³ de besoins et 164 cases « Servir » —, le
porteur a vérifié sur son téléphone, puis l'assistant a tout rétabli et
revérifié : forage disponible à 1,125 m³/h, réserve à 30 m³, besoins couverts à
100 %, aucun arbitrage en attente. **Le groupe B6 est clos.**

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| B6.1 | Section Faisabilité à 390 px | Aucun défilement horizontal, tuiles lisibles, cases « Servir » et bouton « Valider la sélection » atteignables au pouce | **Absence de débordement horizontal éprouvée par P7 à 390 px**, à chacune des six étapes du parcours ; cibles mesurées à 44 px au moins pour le bouton « Valider la sélection » et l'étiquette « Servir … ». **Et constaté par le porteur sur son propre téléphone le 25 septembre 2026**, sur une pénurie réelle de sa ferme — 1,00 m³ disponible pour 54,645 m³ de besoins, 164 cases « Servir » : « tout va bien » | OK |
| B6.2 | Boutons d'aide ⓘ | Ouverture au toucher, fermeture par « Fermer » | **Ouverture et fermeture éprouvées par P7 aux deux largeurs** sur la bulle « Faisabilité préliminaire », au clic. Le toucher, que les parcours n'émulent pas, a été **constaté par le porteur sur son téléphone le 25 septembre 2026** | OK |

## C. Vérification de la 3.3.1 au passage

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| C1 | Une planche, « Voir le calcul » | L'objectif porte la mention « Renseigné · demande de la semaine » ; le reste réel vaut objectif − pluie réelle − irrigation réelle, sans plafonnement par l'ET0 | Planche B11-8 : « Objectif de la semaine : 20 mm — calculable », besoin réel 15 mm = 20 − 5 de pluie réelle − 0 d'irrigation. Aucun plafonnement : l'ET0 vaut 22,3 mm et ne borne rien. Sur cette planche la mention est « hérité de la ferme », l'objectif étant posé au niveau ferme ; le libellé attendu « Renseigné · demande de la semaine » s'affiche bien, lui, sur les planches portant un objectif propre, vérifié sur T2-1. Les deux libellés existent et disent lequel des deux niveaux s'applique | OK |
| C2 | Semaine où l'ET0 est inférieure à l'objectif | Le besoin affiché n'est pas réduit à l'ET0 | **Rien à observer cette semaine** : l'ET0 vaut 22,3 mm pour un objectif de 20 mm. Rejoint le point ouvert 4 du registre d'état | Non observable |
| C3 | Ligne ET0 | Valeur affichée pour information, ou « partielle » avec ses jours manquants, sans rendre le besoin « Non calculable » | « ET0 ⓘ Information · hors calcul 22,3 mm », et dans le détail « ET0, information hors calcul : 22,3 mm · Réanalyse : non disponible · Prévision : 22,3 mm · n'entre pas dans le besoin ». Le besoin reste chiffré à 15 mm, qualifié « partiel, pluie réelle manquante les 22, 23, 24 septembre » — la règle D-019 à l'œuvre | OK |

## D. Clôture

- Défauts constatés, avec numéro de ligne et capture d'écran si possible :
  - A2, 20/09/2026, capture du panneau météo : date affichée trompeuse ;
    corrigé dans la branche `fix/recette-3.4-a2-date-meteo`.
  - Hors protocole, 20/09/2026, capture de la planche B1-1 : pluie réelle non
    calculable du 16 au 18 septembre (limite documentée du contrat météo :
    réanalyses à J-5, aucune consultation entre le 15 et le 19). Décision du
    porteur attendue : saisir les relevés de pluviomètre, ou afficher un besoin
    partiel avec ses jours manquants comme pour l’ET0. Tranché le 20/09/2026
    par le porteur (D-019) : besoin toujours chiffré, pluie d’un jour écoulé
    reprise de la prévision à défaut de réanalyse, jours concernés signalés.
    **Revérifié sur le site le 21/09/2026 : un besoin chiffré s’affiche, la
    mention « Non calculable » a disparu.** La règle est donc éprouvée sur les
    données réelles de la ferme, et non seulement par les tests.
  - Hors protocole, 20/09/2026, même capture : irrigation réelle de 598,2 mm
    sur la planche B1-1 (16,5 m²) pour la semaine, soit près de 10 m³ ;
    vraisemblablement un minuteur resté en marche plusieurs jours. Heure de fin
    réelle de l’événement à vérifier par le porteur.
- A5, conservation de la pluie saisie au pluviomètre : **vérifiée le
  28/09/2026**, voir la ligne A5. Plus rien n’est en attente dans la partie A.
- **Partie B menée le 24 septembre 2026 : aucun défaut.** Vingt vérifications
  sur vingt-deux passent ; B2.2 et C2 n'ont pas de cas à observer sur la ferme
  cette semaine, et B6 reste au porteur. Rien n'a été trouvé qui demande une
  correction.
- Trois constats annexes, non bloquants, relevés le 24/09/2026 :
  - **139 planches sur 164 n'avaient ni pompe, ni origine, ni liaison définie**,
    d'où une couverture confirmée de 15,44 % quand la couverture volumétrique
    était de 100 %. Ce n'était pas un défaut du logiciel — il le disait
    clairement, planche par planche — mais un manque dans les données de la
    ferme. **Comblé le 24 septembre 2026 au soir**, à la demande du porteur :
    le matériel réel a été saisi avec l'outil existant, sans aucune
    modification de code. La couverture confirmée est passée à **100 %**, zéro
    planche sans chaîne. Voir le journal de `ETAT_DU_PROJET.md`. Corrigé dans
    la foulée : l'irrigation sous serre est de l'**aspersion**, non du
    goutte-à-goutte.
  - Dans l'en-tête de la section, la semaine s'affichait en format brut
    (`2026-09-21 au 2026-09-27`) alors que la date de calcul était à la
    française (`24/09/2026 21:09`). **Corrigé le 25 septembre 2026** : les deux
    dates sont à la française, et le parcours P7 le vérifie.
  - **Aucun parcours navigateur ne couvrait l'écran d'arbitrage**, ni à 1280 ni
    à 390 px : la P2 ne faisait que mentionner la faisabilité en commentaire.
    C'est l'écran où un clic engage de l'eau. **Comblé le 25 septembre 2026** par
    le parcours P7, qui reprend du même coup la part mesurable de B6. L'écran
    des réglages de matériel a reçu le sien le 24 septembre (P6) ; **reste celui
    du placement**, encore sans filet
    (`docs/recette-materiel-reglages.md`).
- Deux constats supplémentaires du 24 septembre 2026, tous deux mineurs et
  relevés en corrigeant l'équipement des serres :
  - **Archiver un matériel affiche « Ce matériel est introuvable »** alors que
    l'archivage réussit. Reproduit trois fois sur trois. L'action aboutit et la
    liste est juste après rechargement, mais le message laisse croire à un
    échec et pousserait l'utilisateur à recommencer.
  - L'inventaire annonçait « 34 matériels actifs … 37 positionnés » : les
    matériels **archivés** conservaient leur position et restaient comptés
    dans « positionnés », d'où plus de positions que de matériels actifs.
    **Corrigé le 25 septembre 2026** : seuls les matériels actifs sont comptés,
    et le parcours P8 le vérifie en archivant un matériel encore posé.
- Le chevauchement d'aspersion signalé par le porteur sur la planche B6-10,
  deux matériels sur une même planche, **n'est pas un défaut**. La bulle
  l'explique : « rampe bloc 6 : 2 mm/h · rampe BF3 : 1,16 mm/h ». Le groupe de
  jardins alignés « Ouest » déclare Bloc Fleurs 3 adjacent au bloc 6 à un
  mètre ; une portée de 7,8 m franchit donc la limite du jardin. C'est la
  raison d'être des groupes alignés, et l'écran le dit correctement.
- Point ouvert 2 du registre d'état (synchronisation météo automatique) :
  **fermé le 21 septembre 2026**, A1 et A4 réussies les 20 et 21 septembre sans
  aucune action du porteur.
- Point ouvert 1 du registre d'état (faisabilité) : **fermé le 25 septembre
  2026**. B1 à B5 et C closes le 24 septembre sans défaut ; B6 close le 25, la
  part mesurable passée au parcours P7 et le geste sur l'appareil constaté par
  le porteur. **La recette 3.4 est entièrement passée, sans un seul défaut
  bloquant.** Deux lignes seulement, B2.2 et C2, n'avaient pas de cas à observer
  sur cette ferme cette semaine-là.

Une fois le protocole rempli, il est enregistré tel quel dans `docs/` et le
registre d'état, le journal des changements et la roadmap sont mis à jour dans
la même PR.
