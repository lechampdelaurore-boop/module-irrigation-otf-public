# Contrat court — les heures de silence des notifications (6 undecies)

Écrit le 24 novembre 2026, sans code, en Sonnet 5.5 · Moyen (grille du travail
sans code). L'idée est rangée sans engagement depuis le 7 novembre 2026
(D-065, roadmap section 6 ter : « une plage de la nuit où le téléphone ne
reçoit pas les alertes non urgentes »). Le porteur demande son contrat le
24 novembre 2026 à 20 h 24, heure de Paris : « Lance le contrat, mais tu
réponds à toutes tes questions par tes propres recommandations. »

**Ce que ce contrat n'est pas.** Il ne lance aucun code : le code des heures
de silence se fera après O4 de l'objectif automatique (roadmap section
6 decies), qui touche les mêmes réglages par ferme. Il ne demande aucun
budget : pas de déclencheur de plus, pas de service de plus, le Worker de
notification ne change pas (section 5).

## 1. Ce qui existe

Toutes les notifications du module partent par le Worker Web Push, en
priorité haute, valables une heure (`docs/push-worker-contract.md`,
« Priorité et toucher », D-060). Elles arrivent sur **chaque appareil de la
ferme** qui les a activées : une ferme est un destinataire (`recipientKey`,
l'espace). Les voici, avec l'heure à laquelle chacune peut partir :

| Notification | Quand elle part | Voie |
| --- | --- | --- |
| Fin d'un arrosage démarré (minuteur ou irrigation) | à l'heure de fin, n'importe quand | alarme |
| Retard d'une irrigation planifiée non démarrée | début prévu + tolérance R14 | alarme |
| Message du matin « Votre journée » (ou les suggestions du planning) | après le calcul du matin, vers 6 h 15, heure de Paris | alarme immédiate |
| Rappel du soir | à l'heure réglée par la ferme, de 17 h à 22 h | alarme immédiate |
| Alerte météo (critère de la ferme) | après chaque lecture des prévisions : 6 h 15, 9 h 30, 12 h 30, 15 h 30, 18 h 30, 21 h 30 | envoi immédiat |
| Alertes par culture : gel, séchage, aspersions | mêmes lectures | envoi immédiat |
| La veille de l'exploitant (9 h) et son « tout va bien » du dimanche | 9 h, aux seuls appareils de l'exploitant, pas à une ferme | envoi immédiat |

Aujourd'hui, rien ne distingue la nuit du jour : une alerte lue à 21 h 30
sonne à 21 h 30, une fin d'arrosage à 3 h sonne à 3 h. Les réglages de
notification de la ferme vivent déjà dans `irrigation_phone_notice_settings`
(migration 0043, une ligne par espace, avec la personne et l'heure du
changement), dans le pli « Messages de la ferme » de « Notifications du
téléphone » (F715).

## 2. Les choix faits par Claude (24 novembre 2026, 20 h 24)

Le porteur a demandé de répondre soi-même à toutes les questions par les
options recommandées. Aucune n'est un budget ; aucune n'est une question
agronomique réservée (aucun coefficient, aucun seuil de culture). Le choix 5
touche à ce qui compte comme urgent pour les cultures : il est pris du côté
prudent (le gel passe) et se défait par une case ; le porteur peut le
renverser d'un mot avant le code.

| N° | Question | Choix (option recommandée) | Raison |
| --- | --- | --- | --- |
| 1 | Pour qui est la plage | **Par ferme**, un réglage, comme le message du matin et le rappel du soir | Les notifications partent à la ferme, jamais à une personne (F371) ; un réglage par appareil demanderait un identifiant d'appareil qu'on ne garde pas. Limite dite à l'écran : tous les appareils de la ferme partagent la plage |
| 2 | Allumé ou éteint au départ | **Éteint** ; la ferme l'allume | Aucune ferme ne change sans son geste (D-028). Une ferme existante garde ses alertes de nuit |
| 3 | Les heures offertes | **Début de 20 h à 23 h 45, fin de 4 h à 9 h**, au quart d'heure, heure de Paris (D-004) ; proposition à l'allumage : **22 h à 6 h** | Une nuit enjambe toujours minuit : pas de plage de jour à gérer. Bornes proches du rappel du soir (17 h à 22 h) et de la veille de 9 h |
| 4 | Que devient une notification dans la plage | **Retenue** : elle part à la fin de la plage, jamais perdue, sauf deux cas (6 et 7) | Le contenu d'une alerte dit lui-même qu'elle est prévue et datée de sa lecture (« Prévision du 30 octobre, 06 h 15 ») : arrivée plus tard, elle ne ment pas |
| 5 | Ce qui passe toujours | **La fin d'un arrosage démarré** ; **les alertes de gel**, tant que leur case est cochée (cochée par défaut) | Une eau qui coule seule ou un gel annoncé la veille ne s'attendent pas le matin ; la case existe pour la ferme qui préfère dormir |
| 6 | Le rappel du soir tombe dans la plage | **Il ne part pas**, il n'est pas retenu | « Les avez-vous faits ? » le lendemain matin n'a plus de sens : le message du matin dit la journée. L'écran avertit la ferme dont l'heure du rappel tombe dans sa plage |
| 7 | La veille de l'exploitant | **Hors de la règle** | Elle ne va pas à une ferme mais à la personne du déploiement, à 9 h : la plage finit au plus tard à 9 h |
| 8 | Le suivi des alertes non délivrées (C2, C3) | **Une alerte retenue n'est pas non délivrée** tant que sa fin de plage n'est pas passée d'une heure | Sans cela la veille alerterait chaque nuit pour des alertes volontairement retenues |
| 9 | Le moyen technique | **Le Worker ne change pas** : la retenue est une alarme à échéance, la route qui existe déjà (`dueAt`) | Aucun déclencheur de plus, aucun coût de plus |
| 10 | Une pause ponctuelle, des jours de la semaine, un réglage par appareil | **Hors périmètre**, listés en section 7 | Une plage fixe chaque nuit couvre la demande ; le « Ne pas déranger » du téléphone reste l'outil de la personne |

## 3. La règle

Elle vit en un seul endroit du domaine, une fonction pure
(`lib/domain/notification-quiet-hours.ts`), appelée par chaque envoyeur : le
même texte de règle pour toutes les notifications, jamais recopié.

**S1. Être dans la plage.** À l'heure de Paris `t` d'un envoi, avec un début
`d` et une fin `f` (toujours `d` ≥ 20 h et `f` ≤ 9 h) : `t` est dans la
plage si `t ≥ d` ou `t < f`. Le début est inclus, la fin exclue. La fin
visée est la prochaine fin à l'heure de Paris : celle du lendemain si
`t ≥ d`, celle du jour si `t < f`. Elle se calcule sur l'horloge de Paris,
jamais en ajoutant des heures UTC : les nuits du changement d'heure ne
décalent pas la fin d'une heure.

**S2. Réglage éteint ou absent : rien ne change.** Aucune retenue, aucun
message de plus ; le comportement d'aujourd'hui, pour toutes les fermes qui
n'ont pas allumé la plage.

**S3. Ce qui passe toujours.** Dans la plage, partent sans attendre :

- la **fin d'un arrosage démarré** par une personne (minuteur ou irrigation
  enregistrée) ;
- les **alertes de gel**, quand la case « Laisser passer les alertes de
  gel » est cochée (cochée par défaut à l'allumage). Sont du gel : l'alerte
  par culture de gel (`crop-frost`) et l'alerte météo d'un critère sur la
  **température minimale du jour, « en dessous de »** un seuil. Les autres
  alertes ne sont jamais du gel, même pour un seuil bas : le module ne
  devine pas l'intention de la ferme.

**S4. Ce qui est retenu.** Tout le reste, dans la plage : le message du
matin (et les suggestions du planning), le retard d'une irrigation planifiée,
les alertes de chaleur, de pluie, de séchage et d'aspersions, les critères
météo autres que le gel, et le gel quand la case est décochée. Une
notification retenue part **à la fin de la plage** : même texte, même
étiquette, même page ouverte au toucher. Plusieurs retenues partent ensemble
à la fin, chacune sous son étiquette ; deux notifications de même étiquette
n'en font qu'une, comme aujourd'hui.

**S5. Le rappel du soir** dans la plage n'est pas envoyé et n'est pas retenu
(choix 6). La prise du jour est rendue comme pour tout envoi non fait, et le
passage ne compte pas la ferme en échec : ne pas envoyer est ici le
comportement voulu.

**S6. Un message du matin retenu** part à la fin de la plage s'il y a
toujours quelque chose à dire à ce moment ; le message est composé au calcul
du matin et daté de ce calcul, le texte ne change pas.

**S7. Une retenue ne dure jamais plus d'une plage.** Si la fin tombe plus de
**13 heures** après l'envoi retenu (cela n'arrive pas avec les bornes de
S1 ; la règle borne un réglage corrompu), la notification est envoyée tout
de suite et le défaut est journalisé sans nom.

**S8. Une panne n'altère rien.** Comme le message du matin (règle 23 du
contrat des suggestions) : si la retenue échoue, la notification est
envoyée tout de suite plutôt que perdue, et l'incident est journalisé sans
nommer ni ferme ni personne. Une alerte de gel perdue coûte plus cher qu'une
alerte qui sonne la nuit.

**S9. L'alerte enregistrée ne dépend pas de la plage.** L'alerte météo ou
par culture est enregistrée, visible dans l'application et dans
l'historique dès qu'elle naît (D-006) ; la plage ne retient que le message
sur le téléphone. Son état de remise gagne une valeur, **« retenue jusqu'à
6 h 00 »**, dite avec l'heure de fin (choix 8), qui devient « envoyée » à
l'heure ou « non délivrée » selon le résultat, comme aujourd'hui.

**S10. Deux fermes, deux plages.** Chaque envoi lit le réglage de sa ferme,
jamais celui d'une autre. L'identifiant d'une retenue porte l'espace, comme
le message du matin et le rappel du soir (F744, D-293) : sans cela, deux
fermes retenant la même nuit se disputeraient la même alarme dans le Worker,
qui n'en garde qu'une par identifiant. Une seule fonction le compose.

## 4. Le réglage et son écran

**Stockage.** Les colonnes s'ajoutent à `irrigation_phone_notice_settings`,
sans nouvelle table : `quiet_hours` (0 ou 1, vide = éteint), `quiet_start`
et `quiet_end` (« HH:MM », vides = 22:00 et 06:00 à l'allumage),
`quiet_frost_passes` (0 ou 1, vide = 1). La table est déjà dans le plan
d'effacement (`SPACE_TABLES`, F563) : rien à y ajouter. Une contrainte
vérifie les bornes de S1, comme celle de l'heure du soir. Le changement
passe par le journal des modifications (amélioration n° 7) : l'inventaire
`db/change-journal/inventory.ts` reçoit son écrivain avec l'ancre
`heures-de-silence`, sans quoi la CI échoue (« aucun écrivain oublié »).

**Écran.** Dans le pli « Messages de la ferme » de « Réglages », sous « Notifications
du téléphone » : une case « Heures de silence », puis, allumée, les deux
heures (début, fin) et la case « Laisser passer les alertes de gel ». Le
texte dit en une phrase ce qui passe toujours (la fin d'un arrosage et, si la
case est cochée, le gel) et ce qui attend la fin des heures de silence. Trois
avertissements, un par cause, sans bloquer l'enregistrement :

- l'heure du rappel du soir tombe dans la plage : « Le rappel du soir
  (21 h 30) ne partira pas » ;
- la plage s'applique à tous les appareils de la ferme ;
- une ferme sans appareil inscrit n'a rien à retenir : la ligne le dit.

La ligne du pli fermé dit le réglage (« silence de 22 h à 6 h »). L'ancre
`#heures-de-silence` ouvre le pli. L'écran existe aux deux largeurs (390 et
1 440 px) ; le texte est celui de la charte du module (vouvoiement, phrases
simples).

## 5. Ce que le code touche, et ce qu'il ne touche pas

- **Le Worker `cloudflare/irrigation-push` ne change pas.** Une retenue passe
  par la route d'alarme existante, avec `dueAt` à la fin de la plage, un
  identifiant par espace et par étiquette, une révision neuve ; elle est
  idempotente comme les alarmes du matin et du soir. Une retenue annulée ou
  refaite (la ferme éteint sa plage dans la nuit) n'est pas annulée : elle
  part à sa fin, c'est un message déjà décidé (limite dite en section 7).
- **Les envoyeurs** qui lisent la règle : l'alarme de retard
  (`lib/services/irrigation-push-orchestration.ts`), le message du matin
  (`lib/services/planning-notifications.ts`), le rappel du soir, les alertes
  météo (`weather-alerts-service.ts`) et par culture
  (`crop-alerts-service.ts`). La fin d'arrosage ne lit pas la règle (S3).
  La veille (`operator-watch.ts`) non plus (choix 7).
- **Le suivi** : `lib/domain/operations/undelivered-alerts.ts` compte une
  alerte « retenue » pour ni délivrée ni non délivrée avant la fin de plage
  plus une heure (choix 8) ; une retenue jamais partie passé ce délai se
  compte comme non délivrée, et la veille la dit.
- **Aucun déclencheur, aucune lecture externe, aucun appel à Ouvre ta ferme,
  aucun coût** de plus.

## 6. Livraison en trois PR, une à la fois, après O4

| PR | Objet | Preuve |
| --- | --- | --- |
| H1 · La règle et le réglage | la fonction pure S1 à S4, S7, une migration additive, le service et le journal des modifications ; aucun envoyeur ne la lit encore | tests du domaine (les scénarios de la section 8) ; test de persistance à deux fermes ; contrainte de bornes ; plan d'effacement et inventaire du journal |
| H2 · Les envoyeurs | les cinq envoyeurs lisent la règle ; l'état « retenue » ; le suivi C2/C3 | tests de service avec un Worker simulé : une retenue programmée à la bonne heure, la fin d'arrosage et le gel qui passent, le rappel du soir qui ne part pas ; test à deux fermes (S10) ; contre-épreuve : chaque altération de la règle fait échouer un test |
| H3 · L'écran | le réglage et ses avertissements, la ligne du pli, l'ancre | parcours nouveau aux deux largeurs : allumer, régler, lire l'avertissement du rappel, éteindre ; aucune ferme ne change tant que H3 n'est pas en ligne : l'écran est la seule façon d'allumer |

Code : règle et persistance (H1) et envoyeurs (H2) en **Opus 5.5 · Max**, une
alerte de gel perdue étant la panne la plus coûteuse ; écran (H3) en
**Opus 5.5 · Élevé**, comme O4. Le coordinateur lit la ligne de la roadmap
avant de lancer. Le code attend la fin d'O4 (mêmes réglages, mêmes fichiers
de réglage par ferme) ; aucun fichier de code n'est touché par ce contrat.

## 7. Hors périmètre

- Une pause ponctuelle (« Silence jusqu'à demain ») ou des jours de la
  semaine différents : une seule plage, la même chaque nuit.
- Un réglage par appareil ou par personne.
- Retenir ou regrouper les alertes en un seul message de fin de plage : chaque
  retenue part sous son étiquette.
- Annuler une retenue quand l'alerte disparaît dans la nuit : le texte est
  daté de sa lecture, et l'alerte enregistrée dit l'état à jour.
- Une plage de jour (sieste) : le début est de 20 h à 23 h 45.
- Toute modification du Worker de notification.

## 8. Scénarios chiffrés (heure de Paris)

Plage 22 h à 6 h, gel qui passe, sauf mention contraire.

| N° | Situation | Résultat |
| --- | --- | --- |
| 1 | Alerte de chaleur lue à 21 h 30 | hors plage : part à 21 h 30 |
| 2 | Alerte de chaleur lue à 22 h 00 | début inclus : retenue, part à 6 h 00 le lendemain |
| 3 | Alerte de pluie lue à 5 h 59 | retenue, part à 6 h 00 le même jour |
| 4 | Alerte de pluie lue à 6 h 00 | fin exclue : part tout de suite |
| 5 | Alerte de gel par culture à 22 h 30 | S3 : part tout de suite |
| 6 | Même alerte, case « gel » décochée | retenue, part à 6 h 00 |
| 7 | Critère météo « température minimale en dessous de 2 °C » à 23 h | du gel : part tout de suite |
| 8 | Critère « température maximale au-dessus de 35 °C » | pas du gel : retenue |
| 9 | Fin d'un minuteur à 2 h 15 | S3 : part à 2 h 15 |
| 10 | Rappel du soir réglé à 22 h 30 | ne part pas ; l'écran l'avait dit |
| 11 | Message du matin composé à 6 h 15, plage de 22 h à 7 h | retenu, part à 7 h 00 |
| 12 | Plage éteinte ou jamais réglée | rien ne change (S2) |
| 13 | Ferme A plage 21 h à 7 h, ferme B sans plage, même alerte à 21 h 30 | A : retenue à 7 h ; B : part à 21 h 30 ; identifiants distincts (S10) |
| 14 | Nuit du 28 mars 2027 (heure d'été), plage 22 h à 6 h, alerte à 23 h | fin à 6 h 00 heure de Paris, pas à 5 h ni 7 h (S1) |
| 15 | Retenue programmée à 6 h 00, aucun appareil inscrit | état « non délivrée », cause « aucun appareil » : après 7 h 00 la veille la compte (choix 8) |
| 16 | Le Worker refuse la retenue | envoyée tout de suite, incident journalisé sans nom (S8) |
| 17 | Réglage corrompu : début 15 h | refusé à l'écriture (contrainte) ; à la lecture, plage ignorée comme éteinte et défaut journalisé |

## 9. Ce que le contrat ne prouve pas

- Qu'un téléphone affiche à 6 h 00 une notification programmée la nuit : la
  recette réelle sur l'appareil du porteur le dira, jamais jouée sans son
  accord (ferme réelle, D-028).
- Qu'une plage convient à une ferme où plusieurs personnes ont des
  rythmes différents : elle est la même pour tous ses appareils (choix 1).
- La priorité haute d'une alarme future : le service Push du téléphone la
  remet à l'échéance comme les autres alarmes ; à constater en recette.

## 10. Questions pour le porteur

Aucune n'est posée : toutes sont répondues par l'option recommandée, section 2.
Le choix 5 (le gel passe, case pour le retenir) est le seul qui touche à ce
qui est urgent pour les cultures ; il se renverse d'un mot avant le code.

## 11. Précisions faites en codant H1 (24 novembre 2026, D-321)

La règle vit dans `lib/domain/notification-quiet-hours.ts`
(`quietHoursDecision`, et `quietHoldAlarmId` pour S10) ; le réglage, dans
quatre colonnes de `irrigation_phone_notice_settings` (migration additive
0049), écrit par `saveQuietHoursForUser` (`db/phone-notice-repository.ts`)
au journal des modifications. Aucun envoyeur ne lit encore la règle (H2) et
aucun écran ne l'allume (H3) : rien ne change pour aucune ferme. Six cas que
les sections 3 et 4 ne tranchaient pas, réglés par l'option la plus
prudente :

- **F797, l'instant jugé** : la règle juge l'instant où la notification
  partirait, pas celui où elle est décidée : l'heure de l'envoi pour une
  alerte ou un message qui part tout de suite, l'échéance pour une alarme
  programmée d'avance (le retard d'une irrigation planifiée se juge à son
  début prévu plus la tolérance). Elle répond « part », « retenue jusqu'à »
  la fin de la plage (un instant UTC), ou « ne part pas » (le rappel du
  soir, S5) ; « part » dit le défaut quand c'est un défaut qui la fait
  partir (S7, S17).
- **F798, l'ordre de la règle** : la fin d'un arrosage démarré part sans
  lire le réglage, même corrompu (S3) ; puis la plage éteinte ou absente ne
  change rien (S2) ; puis un réglage hors des bornes est ignoré comme
  éteint et dit son défaut (S17) ; puis le gel passe, case cochée (S3) ;
  puis ce qui tombe hors de la plage part ; dans la plage, le rappel du soir
  ne part pas (S5), et le reste est retenu jusqu'à la fin (S4, S6), sauf
  au-delà de S7. Sont du gel l'alerte par culture de nature `frost` (ses
  étiquettes commencent par `crop-frost:`) et l'alerte météo d'un critère
  sur la température minimale (`minimum-temperature`) « en dessous de »
  (`below`) : la règle lit la nature de la notification, le champ et le
  sens du critère, jamais un texte, une étiquette ni un seuil.
- **F799, S7 sur l'horloge de Paris** : les treize heures se comptent sur
  l'horloge de Paris, comme la fin (S1). La nuit du passage à l'heure
  d'hiver (25 octobre 2026), la plage la plus longue, de 20 h à 9 h, dure
  quatorze heures réelles sans être un défaut : comptées en temps réel,
  elles l'auraient fait partir tout de suite. Aucune plage dans les bornes
  n'atteint la borne : elle ne joue que pour une plage corrompue, que S17
  arrête avant, et se prouve par la règle d'une plage donnée
  (`quietWindowDecision`). Le rappel du soir n'est jamais retenu : même
  là, il ne part pas.
- **F800, l'identifiant d'une retenue** (S10) : une alerte météo ou par
  culture, qui part aujourd'hui par l'envoi immédiat, part retenue par une
  alarme d'identifiant « quiet: », l'espace, puis son étiquette, composé
  par `quietHoldAlarmId` ; une étiquette qui ferait dépasser les 128
  caractères d'un identifiant du Worker est remplacée par son empreinte,
  toujours propre à l'espace. Deux alertes de même étiquette d'une même
  ferme n'en font qu'une, comme aujourd'hui (S4). Le message du matin et le
  retard d'une irrigation gardent leur propre alarme, qui porte déjà
  l'espace et le jour (F744) ou l'arrosage, avec une échéance à la fin de
  la plage : le démarrage d'une irrigation remplace ainsi l'alarme de
  retard retenue par celle de la fin, comme aujourd'hui.
- **F801, le réglage lu** : les quatre colonnes vides valent leurs défauts
  (éteinte, 22:00, 06:00, le gel qui passe), et lire ne crée aucune ligne.
  Une valeur écrite se lit telle quelle, jamais remplacée par un défaut :
  une heure hors des bornes passerait sinon pour une plage de 22 h à 6 h ;
  la règle l'ignore comme éteinte et dit le défaut (S17). Deux gardes à
  l'écriture : le service refuse un réglage hors des bornes avant toute
  écriture, sans créer ni espace, ni ligne, ni journal, avec la phrase
  « Choisissez un début de 20 h à 23 h 45 et une fin de 4 h à 9 h, au
  quart d'heure. » ; la contrainte de la base tient les mêmes listes de
  quarts d'heure que la règle, écrites en clair.
- **F802, un geste écrit les quatre valeurs** : la case, le début, la fin
  et la case du gel s'écrivent ensemble ; éteinte, la plage garde ses
  heures, et la rallumer retrouve celles d'avant. Le message du matin et le
  rappel du soir, sur la même ligne, n'en changent pas, et l'inverse. Le
  journal des modifications (ancre `heures-de-silence`, famille
  « Réglage ») dit l'avant et l'après des seuls champs changés ; un geste
  sans changement n'écrit rien. La ligne s'efface avec la ferme
  (`SPACE_TABLES`, F563 : rien à ajouter).

Preuve : `tests/heures-de-silence.test.ts` (les heures offertes ; les
défauts ; les scénarios 1 à 14 et 17 de la section 8, les scénarios 15 et
16 étant ceux des envoyeurs, H2 ; la nuit du passage à l'heure d'hiver ;
S7 ; l'identifiant d'une étiquette longue, accepté par le Worker) et
`tests/db/heures-de-silence.test.ts` (à deux fermes : les défauts sans rien
écrit ; chacune sa plage, éteinte qui garde ses heures ; aucun effet sur
le message du matin ni le rappel du soir ; un réglage hors des bornes
refusé avant toute écriture ; la contrainte quart d'heure par quart
d'heure ; le scénario 17 en base ; le journal ; l'effacement d'une ferme
qui laisse l'autre). Contre-épreuve : trente-cinq altérations de la règle,
du réglage ou du journal font chacune échouer au moins un test (PR H1).

## 12. Précisions faites en codant H2 (24 novembre 2026, D-324)

Les cinq envoyeurs lisent la règle, chacun avec le réglage de sa ferme, à
l'instant où sa notification partirait (F797) : les alertes météo
(`lib/services/weather-alerts-service.ts`) et par culture
(`lib/services/crop-alerts-service.ts`), qui partagent la retenue de
`lib/services/quiet-hours-delivery.ts` ; le message du matin
(`lib/services/morning-message.ts`, que la section 5 nommait de son nom
d'avant) ; le rappel du soir ; le retard d'une irrigation planifiée
(`lib/services/irrigation-push-orchestration.ts`). La fin d'un arrosage
démarré et la veille de l'exploitant ne lisent pas le réglage (S3,
choix 7). Le Worker de notification ne change pas. Sept cas que les
sections 3, 5 et 8 ne tranchaient pas, réglés par l'option la plus
prudente :

- **F803, la retenue d'une alerte** : une alerte météo ou par culture
  retenue part par l'alarme du Worker d'identifiant « quiet: », l'espace,
  son étiquette (F800), à échéance de la fin de la plage, avec le même
  titre, le même texte, la même étiquette, la même page au toucher et une
  révision neuve. Le Worker la garde (`scheduled`), ou garde déjà sous cet
  identifiant une retenue plus récente de la même étiquette (`stale`), qui
  partira à la même fin : dans les deux cas, l'alerte est retenue. Le
  réglage de la ferme est lu une seule fois par évaluation, au premier
  envoi qui en a besoin ; sans alerte à envoyer, il n'est pas lu.
- **F804, l'état « retenue » et le scénario 15** : le Worker ne dit jamais
  ce que devient une alarme ; il ne répond qu'à sa programmation, et il ne
  change pas (choix 9). Une retenue gardée compte donc comme envoyée, comme
  le message du matin (F745) : l'alerte est enregistrée « envoyée » à son
  heure (S9), avec la fin de sa retenue (`held_until`, migration additive
  0050, une colonne vide sur chacune des deux tables d'alertes, vide pour
  toute alerte d'avant et pour toute alerte partie tout de suite).
  L'historique dit « Retenue jusqu'à 6 h (heures de silence) » tant que la
  fin n'est pas venue, puis « Envoyée à 6 h, à la fin des heures de
  silence », l'heure dite comme partout dans le module (« 6 h »,
  « 6 h 30 »). Aucune valeur nouvelle dans l'état de remise : sa contrainte
  aurait demandé de refaire les tables. Le suivi des alertes non délivrées
  (C2, C3) ne compte jamais une retenue pour non délivrée : le choix 8 est
  tenu. **Limite** : le scénario 15 (une retenue sans appareil inscrit,
  « non délivrée » le matin) n'est pas tenu, le module ne pouvant le savoir
  sans changer le Worker ; une ferme sans appareil se voit aux alertes de
  la journée, qui partent tout de suite et disent « Aucun appareil
  abonné », et la veille les compte comme avant.
- **F805, le message du matin** (S4, S6, S8) : retenu, il part par sa
  propre alarme du jour (F744), à échéance de la fin de la plage, avec le
  texte composé et daté au calcul du matin. Le Worker ne recompose rien :
  « s'il y a toujours quelque chose à dire » (S6) se juge au calcul, et le
  message part tel quel à la fin de la plage, au plus tard à 9 h. Gardée
  par le Worker, la retenue compte comme envoyée (F745) : le passage
  suivant du matin ne renvoie rien. Si la retenue échoue, le même message
  part tout de suite, sous la même alarme et la même révision (le Worker
  remplace une alarme de même révision : une retenue gardée malgré
  l'erreur ne se double pas), et l'incident se dit sans nom.
- **F806, le rappel du soir** (S5) : il se juge à l'heure réelle de son
  passage, chaque heure à 5 minutes, pas à l'heure réglée (F797) : un
  rappel réglé à 21 h 30 part au passage de 22 h 05, et ne part donc pas
  avec une plage qui commence à 22 h. Pour la ferme dont le rappel tombe
  dans la plage, rien n'est lu ni pris ; le passage la compte à part
  (`silenced`, dans sa ligne de journal) et jamais en panne. **Pour H3** :
  l'avertissement de l'écran juge l'heure du premier passage qui suit
  l'heure réglée, pas l'heure réglée seule.
- **F807, le retard d'une irrigation planifiée** (F797, S4, S8) : il se
  juge à son échéance (le début prévu plus la tolérance), avec le réglage
  de la ferme au moment où son alarme est programmée. Dans la plage, la
  même alarme (l'identifiant de l'arrosage, la même révision, le même
  texte) prend pour échéance la fin de la plage ; la base garde l'échéance
  d'origine, que l'écran dit comme avant. Démarrer l'irrigation remplace
  l'alarme comme aujourd'hui (F800). Un réglage illisible laisse
  l'échéance d'origine (S8) ; un défaut se dit sans nom. **Limite, pour
  H3** : un retard programmé avant que la ferme allume ou change sa plage
  garde l'échéance d'alors ; l'enregistrement du réglage reprogrammera les
  retards à venir de la ferme.
- **F808, Arrosages décochée dans la nuit** (P29) : un retard dont
  l'échéance est passée mais que la plage retient encore n'est pas parti :
  il est retiré avec les alarmes à venir. La liste des alarmes à venir
  garde pour cela les retards échus depuis moins de quatorze heures (la
  plus longue retenue, treize heures de l'horloge de Paris, plus l'heure
  du passage à l'heure d'hiver) ; le service écarte ceux que la plage de la
  ferme ne retient plus. Une alarme partie ne se retire toujours pas. Un
  réglage illisible n'empêche pas le retrait : la plage compte pour
  éteinte et un retard échu pour parti, comme avant H2, et l'incident se
  dit sans nom.
- **F809, le journal** : une retenue refusée (`quiet_hold_failed`, avec la
  phrase de l'erreur), un réglage illisible (`quiet_hours_unreadable`), un
  défaut de la règle (`quiet_hours_defect`, avec sa nature : S7 ou S17), le
  message du matin retenu (`morning_message_held`, avec la fin de la
  plage) ; la fin de la retenue dans la ligne de chaque alerte évaluée ; le
  nombre de rappels du soir tus dans celle du passage. Aucune ligne ne
  nomme ni ferme ni personne.

Preuve : `tests/db/heures-de-silence-alertes.test.ts` (à deux fermes et
Worker simulé : les scénarios 5 à 8, 12, 13 et 16 ; une maximale basse et
une minimale haute qui ne sont pas du gel ; `stale` qui retient, le service
non configuré qui envoie comme avant ; le scénario 17 et le réglage
illisible ; les alertes par culture, le gel qui passe, case cochée ou non,
et l'arrêt d'arrosage avant récolte retenu ; l'historique des deux encarts
avant et après la fin de la plage) et
`tests/db/heures-de-silence-messages.test.ts` (les scénarios 10, 11 et 16
pour le message du matin ; le retard jugé à son échéance, la base qui garde
la sienne, de jour ou sans plage rien ne change ; la fin d'un minuteur qui
ne lit pas le réglage ; le réglage illisible ; le retrait des alarmes la
nuit, réglage lisible ou non ; le scénario 17 pour les trois envoyeurs à
alarme). Contre-épreuve :
quarante altérations des envoyeurs, de la retenue, de son
enregistrement et de son affichage font chacune échouer au moins un test
(PR H2).

## 13. Précisions faites en codant H3 (25 novembre 2026, D-326)

L'écran (`app/irrigation/reglages/notification-settings.tsx`), ses phrases
(`lib/domain/quiet-hours-screen.ts`), l'enregistrement
(`lib/services/quiet-hours-setting.ts`, l'action
`saveQuietHoursAction`) et la reprogrammation des retards
(`rescheduleLateAlarmsForQuietHours`,
`lib/services/irrigation-push-orchestration.ts`). Le Worker de notification
ne change pas ; aucune migration. Cinq cas que la section 4 et les
précisions F806 et F807 ne tranchaient pas :

- **F817, où le réglage se montre.** Pour toute ferme qui reçoit des
  notifications (cases 2, 4, 8 ou 9), pas seulement avec le Planning (le
  message du matin) ou les Arrosages (le rappel du soir) : les alertes
  météo et par culture se retiennent aussi. Rien en démonstration, où les
  notifications sont coupées (F455). Allumée, la plage reprend les heures
  gardées, 22 h à 6 h si la ferme ne les a jamais réglées ; éteinte, elle
  les cache et les garde. Chaque geste écrit les quatre valeurs (F802). La
  ligne du pli : « Silence de 22 h à 6 h. » ou « Heures de silence
  coupées. ».
- **F818, la ligne « aucun appareil ».** Le Worker ne dit pas combien
  d'appareils une ferme a (choix 9) : la ligne se lit à la dernière alerte
  météo ou par culture partie tout de suite, « Aucun appareil abonné » ;
  une retenue (comptée envoyée sans rien atteindre, F804), un échec ou une
  nouvelle tentative ne disent rien des appareils et n'y comptent pas. Une
  ferme qui n'a jamais envoyé d'alerte ne voit pas la ligne : l'écran ne
  devine pas.
- **F819, l'avertissement du rappel du soir.** Il juge le premier passage
  horaire (hh:05) qui suit l'heure réglée (F806) : réglé à 21 h 30, le
  rappel part à 22 h 05 ; « Le rappel du soir (21 h 30) ne partira pas :
  son envoi, à 22 h 05, tombe dans les heures de silence. » Il se relit
  sans recharger quand l'heure du rappel change dans le même pli, et ne
  paraît que plage allumée, rappel activé et Arrosages cochée. Un passage
  à hh:05 ne tombe jamais sur un début au quart d'heure : le début inclus
  ou exclu donne le même avertissement.
- **F820, les retards à venir** (limite de F807). À l'enregistrement,
  chaque retard d'irrigation encore confié au Worker reçoit l'échéance que
  la plage nouvelle lui donne (la fin de la plage s'il y tombe, son
  échéance d'origine sinon), même identifiant, même révision, même texte ;
  un retard échu que la plage d'avant retenait encore n'est pas parti, et
  part tout de suite si la plage nouvelle ne le retient plus. Un retard
  déjà parti, la fin d'un minuteur ou une échéance inchangée n'envoient
  rien. Le réglage d'avant illisible ne bloque rien : chaque retard à venir
  est reprogrammé. Un refus du Worker laisse le retard à son échéance
  d'avant et le réglage enregistré ; l'écran le dit (« Des alertes de
  retard déjà programmées n'ont pas pu suivre ce réglage »), le journal le
  compte sans nom (`quiet_hours_late_alarms_rescheduled`).
- **F821, le parcours.** P60, aux deux largeurs : allumer, régler, lire
  l'avertissement du rappel, éteindre (section 6).

Preuve : `tests/heures-de-silence-ecran.test.ts` (la ligne du pli, la
phrase avec et sans le gel, l'avertissement du rappel, dont chaque heure du
rappel contre chaque début) et `tests/db/heures-de-silence-ecran.test.ts`
(à deux fermes et Worker simulé : la plage allumée l'après-midi qui
déplace le retard de la nuit et pas celui du jour, ni la fin d'un minuteur,
ni l'autre ferme ; la même plage enregistrée de nouveau qui n'envoie rien ;
la plage éteinte à 1 h qui fait partir le retard retenu ; le refus du
Worker ; le réglage hors des bornes ; le réglage d'avant illisible ; la
ligne « aucun appareil » à deux fermes) ; parcours P60. Contre-épreuve :
trente altérations de l'écran, de la reprogrammation et de la ligne
« aucun appareil » font chacune échouer au moins un test (PR H3).
