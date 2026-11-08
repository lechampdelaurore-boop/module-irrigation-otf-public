# Contrat — pilotage des électrovannes (C3)

Écrit le 7 novembre 2026, avant tout code, d'après la recherche `connexions-materiel/C3-pilotage-electrovannes-recherche.md` et les décisions du porteur des 6 et 7 novembre 2026 : **le module doit piloter** ; **B, confirmation du porteur à chaque ouverture** ; **premiers essais sur un relais local (famille Shelly Gen2) en banc hors ferme** ; **aucun budget fixé, rien n'est acheté**. Ligne C3 de la section 6 bis de la roadmap (D-063, PR #261) : recherche en Sonnet 5.5 · Moyen, « code : à fixer au contrat ». Ce contrat est du travail sans code (Sonnet 5.5 · Moyen, AGENTS.md, « Économie de jetons »). **Les quatre questions de la section 14 ont été tranchées le 7 novembre 2026 sur l'option recommandée**, selon la consigne du porteur du même jour (pour les recherches et contrats, une question non agronomique se tranche sur la recommandation et se consigne ; le porteur garde l'agronomie, les budgets et achats, et tout ce qui touche la ferme réelle). Rien n'est codé, rien n'est acheté, rien ne touche la ferme réelle.

Le logiciel est **multi-fermes** : rien ici ne suppose le matériel de la ferme du porteur. Le relais Shelly Gen2 est le **premier exemple d'essai**, pas une dépendance du contrat.

## 1. Objet

Permettre au module d'**ouvrir une vanne pour une durée donnée, après la confirmation du porteur, et de la fermer**, avec des règles de sécurité écrites pour être testées une à une. Le module cesse ainsi de seulement conseiller : c'est un changement de nature (D-063), d'où une sécurité en couches et un contrat avant toute ligne de code.

## 2. Ce qui ne change pas

- **Le moteur de planification, la pompe, la réserve, la limite journalière et la pénurie ne changent pas.** Le pilotage lit leurs résultats ; il ne recalcule rien en parallèle (calculateur, `docs/irrigation-calculator-contract.md`).
- **Aucun automatisme.** Le mode automatique complet reste écarté (D-054). Chaque ouverture exige la confirmation du porteur (D-028 : le logiciel propose, le maraîcher décide).
- **Le conseil seul continue d'exister** : une vanne non pilotée, ou un pilotage suspendu, se comporte exactement comme aujourd'hui. **Le pilotage est désactivé par défaut**, vanne par vanne.
- L'historique est immuable (D-006). Une donnée inconnue reste `null` (D-003), jamais zéro. Les dates et heures sont en `Europe/Paris`, heures locales murales (D-004).
- Une irrigation saisie après coup reste toujours enregistrable ; le pilotage n'en refuse aucune.

## 3. Vocabulaire

- **Vanne pilotable** : une vanne rattachée à un matériel du module, à un **adaptateur** et à des plafonds saisis.
- **Adaptateur** : la petite couche qui parle à une famille de matériel (relais local, programmateur à API officielle…). Un adaptateur par famille, une interface commune.
- **Ordre** : « ouvrir cette vanne pour N minutes », avec un identifiant unique.
- **Minuteur matériel** : la fermeture automatique **exécutée par l'appareil lui-même**, même si le module, internet et le courant du réseau disparaissent.
- **Passerelle** : ce qui relie le module (hébergé en ligne) à l'appareil de la ferme. Son choix est une décision d'essai (section 12), pas de ce contrat.

## 4. Interface commune (les quatre actions)

Tout adaptateur offre exactement ces quatre actions, rien de plus au départ :

| Action | Entrée | Réponse |
| --- | --- | --- |
| **Lire l'état** | la vanne | un état (ci-dessous), le temps restant avant fermeture si l'appareil le sait, l'heure de la lecture |
| **Ouvrir pour N minutes** | la vanne, N, l'identifiant de l'ordre | accepté ou refusé, **et le temps de fermeture programmé que l'appareil confirme** |
| **Fermer** | la vanne | accepté ou refusé |
| **Suspendre** | la vanne ou l'exploitation | accepté ou refusé ; plus aucune ouverture ne passe tant que ce n'est pas levé |

**États possibles** (liste fermée) : `inconnu`, `ouverture demandée`, `ouvert`, `fermeture demandée`, `fermé`, `à vérifier`, `manuel`.

- L'écran n'affiche **jamais « ouvert » avant que l'appareil l'ait confirmé** (délai possible d'une minute sur certaines liaisons). Entre-temps : « ouverture demandée ».
- `à vérifier` : l'état relu ne correspond pas à ce que le module attendait. `manuel` : l'appareil dit avoir été actionné à la main.
- **Erreurs** (liste fermée) : `liaison perdue`, `refusé par l'appareil`, `pas de réponse`, `réponse en double`, `état contraire`, `minuteur non confirmé`, `ordre expiré`, `vanne non pilotable`.
- **Capacités déclarées par l'adaptateur** : minuteur matériel (oui/non), lecture du temps restant (oui/non), compteur d'eau (oui/non), délai maximal de réponse. **Une capacité non déclarée est « non » ; on ne devine pas.**

## 5. Les règles de sécurité (testables)

Les règles S1 à S10 sont les **garde-fous durs** : aucun réglage, aucun calcul, aucune alerte ne les contourne. Chacune a un cas en section 9.

**S1. Fermeture portée par le matériel.** Une vanne n'est pilotable que si son adaptateur déclare un minuteur matériel **et** que la réponse à chaque ordre confirme le temps de fermeture programmé. Pas de confirmation, pas d'ouverture : l'ordre est annulé par un ordre « Fermer » et l'erreur `minuteur non confirmé` est journalisée.

**S2. Plafonds saisis, jamais devinés.** Une vanne n'est pilotable que si l'exploitant a saisi une **durée maximale par ordre** (minutes) et que l'exploitation a un **volume maximal par jour** (celui qui existe déjà). Aucun plafond n'est livré par défaut : sans plafond saisi, `vanne non pilotable`. Durée d'un ordre = le plus petit de : durée calculée, plafond de la vanne.

**S3. Durée et volume connus avant l'ordre.** Durée = besoin (mm) ÷ mm/h reçu (calculateur). Volume de l'ordre = durée × débit de la vanne. Si le débit ou le mm/h est inconnu (`null`), **l'ordre est refusé** et l'écran dit lequel manque (réponse 2 sur 4). Un volume qui dépasse le reste de la limite journalière est refusé.

**S4. Une zone à la fois par défaut.** Un seul ordre ouvert par exploitation. Ouvrir une deuxième vanne en même temps n'est permis que si la somme des débits demandés (D-022) reste sous le débit de la pompe **et** que l'exploitant a saisi un **décalage minimal entre ordres** (coup de bélier). Valeur non établie ici : sans décalage saisi, un seul ordre à la fois.

**S5. Limite d'ordres par heure.** Un nombre maximal d'ordres d'ouverture par exploitation et par heure, saisi par l'exploitant ; sans valeur, un seul ordre par tranche de 10 minutes (proposition). Un ordre « Fermer » n'est jamais compté ni limité.

**S6. Confirmation à chaque ouverture, au moment de l'ouverture** (réponse 4 sur 4). La carte de confirmation dit : quelle vanne, quelle planche, combien de minutes, combien de litres et de millimètres, l'heure de fermeture prévue, les créneaux protégés et alertes en cours. **Elle vaut 2 minutes** (réglable) ; au-delà, l'ordre expire (`ordre expiré`) et rien n'est envoyé. Pas d'ordre différé dans cette version.

**S7. Créneaux protégés** (D-062, `docs/protected-slots-contract.md`). Au moment de la confirmation **et** de l'envoi, si l'intervalle [maintenant, maintenant + durée] touche un créneau protégé : l'ordre est **bloqué**, avec le nom du créneau. Le porteur peut le raccourcir pour qu'il tienne avant le créneau (même mécanique que « Réduire », durée ≥ dose minimale) mais **le pilotage n'a pas de contournement** (réponse 1 sur 4). L'ajout d'un arrosage à la main reste libre et signalé (règle 12 de D-062) : seul l'**envoi à la vanne** est bloqué.

**S8. Commande manuelle prioritaire.** Le module **relit l'état avant et après** chaque ordre. Si l'appareil est actionné à la main (état `manuel`) ou si l'état relu contredit l'attendu (`état contraire`, `à vérifier`), le module **ne renvoie aucun ordre pour « corriger »** : il affiche l'état réel, journalise, et attend le geste du porteur. Une vanne fermée à la main n'est jamais rouverte par le module.

**S9. « Fermer » est toujours possible.** Le bouton « Fermer » et « Suspendre le pilotage » ne demandent aucune confirmation, ne passent par aucune limite (S4, S5, S7), passent avant toute file d'attente, et sont disponibles même quand l'état est `inconnu`. Le « Fermer » est renvoyé jusqu'à ce que l'état `fermé` soit confirmé, avec un délai croissant ; il reste affiché « fermeture demandée » tant que ce n'est pas confirmé.

**S10. Perte de liaison.** Si l'adaptateur ne répond plus : l'état devient `inconnu` après le délai déclaré (jamais « ouvert » ni « fermé » supposé) ; **aucun nouvel ordre d'ouverture n'est possible** tant qu'une lecture n'a pas réussi ; la fermeture à l'heure prévue est portée par le minuteur matériel (S1) ; à la reconnexion, le module **relit l'état avant tout autre ordre** et journalise l'écart. Si le temps restant est lisible et que la vanne est encore ouverte après l'heure prévue + marge, alerte forte (notification) et `à vérifier`.

**S11. Pas de doublon.** Chaque ordre a un identifiant unique ; le renvoyer (réponse perdue, réessai) ne prolonge ni ne double l'ouverture. Une réponse en double est ignorée et journalisée.

**S12. Vérification après coup.** Après la fin prévue : l'état réel est relu (« fermé » confirmé ou `à vérifier`). Avec compteur d'eau déclaré : volume mesuré comparé au volume attendu, écart signalé (fuite ou vanne bloquée). **Sans compteur, l'écran dit « volume non vérifié »**, jamais « volume vérifié ».

**S13. Journal immuable.** Chaque ordre est conservé comme l'historique d'irrigation (D-006) : identifiant, vanne, durée et volume demandés, auteur, heure de confirmation, réponses de l'appareil (état, temps de fermeture confirmé), erreurs, état relu final. Aucune ligne n'est modifiée ni supprimée. Aucun secret n'y entre.

**S14. Secrets.** Les clés ou accès de l'appareil ou du service de l'appareil sont **saisis par l'utilisateur lui-même**, stockés **chiffrés, par exploitation**, jamais dans le code, la mémoire du projet, le journal ni un message. Le module ne les affiche jamais en clair après la saisie.

**S15. Interrupteur général.** « Suspendre le pilotage » (exploitation) ferme, si l'état le permet, ce que le module a ouvert, puis refuse toute ouverture jusqu'à ce que le porteur le lève. Au démarrage du module, le pilotage est **suspendu** tant que l'exploitant ne l'a pas activé ; un redéploiement ne rouvre rien.

## 6. Parcours d'un ordre (mode B)

1. Le porteur choisit **« Ouvrir cette vanne »** depuis une planche, une suggestion ou la vue du matériel (jamais depuis une notification seule).
2. Le module calcule durée, litres, millimètres (S3), contrôle S2, S4, S5, S7, S15 et affiche la **carte de confirmation** (S6).
3. Le porteur confirme. Le module envoie l'ordre, état « ouverture demandée ».
4. L'appareil répond : état + temps de fermeture confirmé (S1). Sinon : fermeture et erreur.
5. L'écran passe à « ouvert », avec le temps restant lu si l'appareil le donne.
6. À l'heure prévue : relecture, « fermé » confirmé ou `à vérifier` (S12) ; l'arrosage réel est enregistré comme **irrigation faite** (même flux que la saisie après coup), avec la durée **mesurée** par les états relus, et non la durée demandée.
7. Un arrêt à la main (S9) enregistre la durée réellement écoulée.

## 7. Liens avec les contrats existants

- **Calculateur** : fournit mm/h reçu, surface mouillée, débit demandé à la pompe. Rien à y changer.
- **Créneaux protégés (D-062)** : S7. Le pilotage ne lit que leur résultat ; il ne les modifie pas.
- **Alertes météo (5 quinquies)** : une alerte de gel ou de vent en cours **s'affiche sur la carte de confirmation** et n'interdit pas l'ordre, puisque le porteur décide (réponse 3 sur 4). Aucune suspension automatique.
- **Pénurie et réserve** : le volume de l'ordre compte dans la limite journalière ; le pilotage ne contourne pas la pénurie.
- **Notifications** : l'alerte forte de S10 passe par les notifications existantes.

## 8. Le simulateur de pannes

Un **faux appareil** logiciel, dans le code de test uniquement (jamais livré en production), qui implémente l'interface de la section 4 avec une **horloge pilotée** (pas d'attente réelle) et des **pannes injectées** :

| Panne | Ce que le simulateur fait | Ce que le module doit faire |
| --- | --- | --- |
| Liaison perdue pendant l'ouverture | plus aucune réponse | état `inconnu`, aucun nouvel ordre (S10) ; le minuteur simulé ferme à l'heure |
| Ordre perdu avant réception | l'ordre n'arrive jamais | pas de « ouvert » affiché ; erreur `pas de réponse`, réessai sans doublon (S11) |
| Réponse lente | réponse après 60 s | « ouverture demandée » jusqu'à la réponse, jamais « ouvert » avant |
| Réponse en double | deux réponses au même ordre | ignorée, journalisée (S11) |
| Minuteur absent | accepte l'ordre sans temps de fermeture | ordre annulé par « Fermer » (S1) |
| **Minuteur oublié** | le simulateur « redémarre » et perd le minuteur | écart détecté à la relecture, alerte, « Fermer » renvoyé (S10) |
| État contraire | la vanne est ouverte à la main | `manuel`, aucun ordre de correction (S8) |
| Fermeture refusée | « Fermer » refusé | renvoyé avec délai croissant, alerte, « fermeture demandée » affiché (S9) |
| Compteur muet ou faux | volume absent ou 3 fois trop fort | « non vérifié » ou écart signalé (S12) |
| Deux ordres simultanés | deux clics rapides | un seul passe (S4, S11) |
| Confirmation tardive | ordre arrivant après 2 min | `ordre expiré`, rien d'envoyé (S6) |
| Redémarrage du module | arrêt en pleine ouverture | au redémarrage : pilotage suspendu, état relu avant tout (S15, S10) |

**Aucun adaptateur réel n'est branché avant que toutes ces pannes passent sur le simulateur.** Un adaptateur réel doit ensuite passer la **même suite de tests de conformité** que le simulateur (étape 4 de la recherche).

## 9. Cas chiffrés (la preuve de fin les met en tests)

Vanne de test : plafond de durée 30 min ; débit 2 m³/h (≈ 33 l/min) ; goutte-à-goutte à 8 mm/h reçu ; limite journalière 20 m³ ; aucun créneau protégé sauf mention.

| Cas | Entrée | Attendu |
| --- | --- | --- |
| 1. Ordre nominal | besoin 4 mm sur 60 m², 30 min demandées | durée 30 min, 1 000 l, carte de confirmation ; après confirmation : « ouverture demandée » puis « ouvert » à la réponse |
| 2. Plafond | besoin demandant 45 min | durée **30 min** (S2), l'écran dit « limitée à 30 min » ; le reste n'est pas envoyé |
| 3. Pas de plafond saisi | vanne sans durée maximale | `vanne non pilotable`, aucun ordre |
| 4. Débit inconnu | débit `null` | ordre refusé, « débit de la vanne manquant » (S3) |
| 5. Volume > reste du jour | 19 m³ déjà faits, ordre de 2 m³ | refusé, reste du jour affiché |
| 6. Minuteur non confirmé | réponse sans temps de fermeture | « Fermer » envoyé, erreur journalisée (S1) |
| 7. Deux vannes | pompe à 3 m³/h, deux ordres de 2 m³/h | le second refusé (S4) |
| 8. Trop d'ordres | plus que la limite horaire | refus ; « Fermer » toujours accepté (S5, S9) |
| 9. Créneau protégé | ordre à 21 h 30, « Lavage » 22 h – 23 h, durée 30 min | accepté jusqu'à 22 h (30 min tiennent) ; durée 45 min → bloqué avec le nom « Lavage » ou proposition « Réduire à 30 min » (S7) |
| 10. Créneau en cours | ordre pendant le créneau | bloqué, aucun contournement (S7) |
| 11. Confirmation périmée | confirmée 3 min après l'affichage | `ordre expiré`, rien envoyé (S6) |
| 12. Fermé à la main | pendant l'ordre, la vanne est fermée à la main | `manuel`, aucun ordre de correction, durée réelle journalisée (S8) |
| 13. Liaison perdue | réponses coupées à la 10e minute sur 30 | état `inconnu`, pas de nouvel ordre, minuteur ferme à la 30e ; à la reconnexion : relecture, écart journalisé (S10) |
| 14. Minuteur oublié | la vanne reste ouverte après l'heure prévue + marge | alerte forte, `à vérifier`, « Fermer » renvoyé (S10) |
| 15. Fermer sans confirmation | état `inconnu` | « Fermer » possible, sans carte, sans limite (S9) |
| 16. Doublon | même identifiant envoyé deux fois | une seule ouverture de 30 min (S11) |
| 17. Compteur | volume mesuré 600 l pour 1 000 attendus | écart signalé ; sans compteur : « volume non vérifié » (S12) |
| 18. Journal | n'importe quel ordre | une ligne immuable avec toutes les réponses, aucun secret (S13, S14) |
| 19. Interrupteur | « Suspendre le pilotage » pendant une ouverture | « Fermer » envoyé, plus aucune ouverture possible (S15) |
| 20. Redémarrage | redéploiement pendant une ouverture | pilotage suspendu au démarrage, état relu, rien rouvert (S15) |
| 21. Alerte de gel | alerte active à l'instant de l'ordre | affichée sur la carte, ordre permis après confirmation |
| 22. Multi-fermes | deux exploitations, une vanne chez A | **aucun effet, aucune lecture chez B** |
| 23. Pilotage désactivé | vanne non activée | aucune action « Ouvrir » ; le conseil seul est inchangé |
| 24. Irrigation enregistrée | ordre terminé après 28 min | irrigation faite de 28 min (mesurée), pas 30 |

## 10. Données (rien à créer maintenant)

Au moment du code, migrations **additives** (prochain numéro libre, `docs/migrations-contract.md`) : les vannes pilotables (adaptateur, plafond de durée, capacités déclarées, état d'activation), les ordres et leur journal (immuable), les accès chiffrés par exploitation. Aucun réglage existant ne change ; aucune vanne n'est pilotable au départ.

## 11. Écran

Une section **« Pilotage des vannes »** dans la vue du matériel : état de chaque vanne (les sept états, libellés en français), bouton **« Ouvrir »** (carte de confirmation), bouton **« Fermer »** toujours visible, interrupteur **« Suspendre le pilotage »**, journal des ordres. Lisible à 390 px. Charte du module (`/mnt/project-files/charte-module/`) : aucun style hors charte.

## 12. Architecture et découpage

- Le domaine (`lib/domain/valve-control/`, sans dépendance hors `lib/domain/`) porte les règles S1 à S15 et l'**interface** de la section 4 ; les adaptateurs sont à part ; la lecture et l'écriture sont dans `db/`. Fichiers sous 600 lignes. Aucun nombre magique d'unité (`units.ts`).
- **La passerelle** : le module est hébergé en ligne et ne joint pas directement un relais sur le réseau d'une ferme ; il faut un chemin (service du fabricant, courtier de messages, petite passerelle sur place…). Ce choix **dépend du banc** et n'est pas pris ici ; il fera l'objet d'une fiche à l'étape 4, avec chiffrage préalable et accord du porteur sur tout achat. La recherche est faite : le document de recherche « passerelle et banc d'essai » du projet (quatre options, recommandation : courtier MQTT, liste du banc, tests de banc obligatoires), à verser au dépôt avec le contrat de la sous-tranche de code.
- **Découpage proposé du code** (Opus 5.5 · Élevé, à confirmer à la roadmap ; l'action touche la ferme réelle, le réglage définitif revient au porteur) :
  1. interface, états, erreurs, règles S1 à S15 en domaine pur et leurs tests ;
  2. simulateur de pannes et suite de conformité ;
  3. persistance (vannes, ordres, journal) ;
  4. écran et parcours navigateur (sur le simulateur) ;
  5. un adaptateur réel de banc (relais Shelly Gen2), **sur le « vas-y » exprès du porteur et son accord sur le montant** ;
  6. recette à la ferme, **une seule vanne, avec le porteur présent**, mode B seul.
- Une PR par lot, une à la fois, registres à jour dans chacune.

## 13. Hors périmètre

Programme déposé dans le matériel (architecture C) ; ordres différés ou programmés ; pilotage automatique (D) ; pilotage de programmateurs à API non officielle (Solem) ; capteurs météo et tensiomètres (C1, C2) ; choix de la passerelle ; tout achat ; toute action sur la ferme réelle.

## 14. Questions tranchées (7 novembre 2026, sur l'option recommandée)

1. ✅ **Créneaux protégés** : le pilotage ne contourne jamais un créneau protégé ; l'ordre est bloqué avec le nom du créneau, ou raccourci pour tenir avant lui (S7).
2. ✅ **Débit inconnu** : un ordre dont le débit ou le mm/h est inconnu est refusé (S3).
3. ✅ **Alerte météo** : elle s'affiche sur la carte de confirmation sans bloquer ; le porteur décide (section 7).
4. ✅ **Quand confirmer** : au moment de l'ouverture seulement, « Ouvrir maintenant » ; aucun ordre différé (S6, section 13).

Restent au porteur, hors de ce contrat : le montant du banc d'essai (devis réels d'abord), le choix de la passerelle, le « vas-y » exprès de la recette à la ferme.
