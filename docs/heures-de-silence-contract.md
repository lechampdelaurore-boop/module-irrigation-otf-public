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
