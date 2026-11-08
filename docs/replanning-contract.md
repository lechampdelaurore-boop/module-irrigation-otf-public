# Contrat du suivi d'exécution et de la replanification (3.7)

Écrit le 30 octobre 2026, avant tout code, pour le porteur de projet, qui en
est le validateur agronomique (D-014). Sous-tranche 3.7 de `ROADMAP.md`,
17ᵉ de l'ordre d'exécution ; décision D-030 et point ouvert 31 de
`ETAT_DU_PROJET.md` ; il prolonge `docs/planning-contract.md` (statuts,
cycle, cas limites) sans en changer les règles tranchées. Rien n'est codé ;
le code ne commence qu'une fois ce contrat validé par le porteur et la 2.11
close. Les six questions qui lui reviennent sont rassemblées à la fin, avec
une recommandation pour chacune. **Le porteur a tranché les six questions le
30 octobre 2026 à 21 h 19** : « Je suis d'accord avec toutes tes
suggestions. » (« Décisions du porteur », en fin de document). **Le contrat
est validé** (D-051) ; la 2.11 est close le soir même, le code commence à
son tour.

Brouillon commencé en Opus 5.5 · Élevé, écart signalé au porteur à
l'ouverture ; sur son mot du jour même à 21 h 04, relu et complété en
Fable 5.1 · Très élevé, le réglage que la roadmap recommande pour la 3.7
(D-049).

## Le constat

Ce que le logiciel fait aujourd'hui, relevé dans le code de `main` le
30 octobre 2026 (`b872704`).

- **Le plan ne se recalcule que deux fois** : le matin, après la
  synchronisation météo de 06 h 15, et à la demande, par le bouton
  « Recalculer ». Le registre prévoit un troisième déclencheur,
  « événement » (`PlanCalculationTrigger`,
  `lib/domain/planning/contract.ts` ; contrainte
  `chk_plan_calculation_trigger`, `db/schema.ts`), mais rien ne l'écrit.
- **Après un événement réel**, les besoins, l'eau et la faisabilité se
  rafraîchissent aussitôt, mais le plan reste celui du dernier calcul : une
  irrigation arrêtée à mi-parcours, une pluie saisie au pluviomètre ou un
  matériel retiré laissent à l'écran des propositions faites sans eux,
  jusqu'au matin suivant ou au prochain clic. La section « Planning » ne
  relit le plan qu'au retour de l'onglet
  (`app/irrigation/planning/weekly-plan-view.tsx`).
- **Le moteur ne lit pas les refus** (point ouvert 31) : le 5 octobre 2026,
  la proposition p-8, rampe de serre du tunnel 4, mardi 22 h 30 → 23 h 00,
  5 mm, 1,28 m³, refusée à 14 h 04, est revenue à 14 h 11 au même créneau,
  à la même dose, par le même matériel. `engine.ts` reçoit les besoins,
  l'eau, le matériel et les réglages, jamais les décisions du maraîcher.
- **Chaque calcul remplace toutes les propositions encore proposées** du
  calcul précédent, même identiques, en un seul lot. Une carte restée
  ouverte pendant le calcul est alors refusée à la validation, « recalculez
  le plan ». Rare aujourd'hui, ce refus deviendrait courant si le plan se
  recalculait à chaque événement.
- **Une irrigation validée n'est jamais touchée par le moteur**, ce qui est
  voulu ; mais rien ne dit qu'elle est devenue inutile après une pluie, ou
  trop forte après un objectif baissé. Le contrat du planning promet une
  suggestion de réduction ou d'annulation (« Les statuts ») : elle n'existe
  pas.
- **« En retard » n'existe pas.** Le contrat du planning le promet (« Le
  cycle »). Dans le code, une irrigation planifiée dont l'heure de début est
  passée sans démarrage compte, dans les besoins et les réserves, pour la
  part de son créneau qui reste à venir, puis plus du tout une fois son
  créneau fini (`remainingPlannedApplications`,
  `lib/domain/planned-irrigation.ts`) ; rien ne le signale.
- **Une restriction nouvelle** : la limite journalière est vérifiée à la
  création d'une irrigation et à son démarrage (`enforceDailyLimitForStart`,
  `app/irrigation/irrigation-event-actions.ts`). Une irrigation validée qui
  dépasse une limite ajoutée après coup est refusée au démarrage, sans
  avertissement préalable.
- **Un matériel retiré** : ses irrigations planifiées ne comptent plus et
  sont signalées (D-044) ; une proposition qui l'utilise ne se valide pas,
  avec un message (règle 14 de la 2.11). « Le recalcul déclenché par
  l'événement lui-même relève de la 3.7 » : c'est ce contrat.
- **Le Worker de notification** ne connaît qu'une alarme par irrigation, la
  fin du minuteur (`docs/push-worker-contract.md`). Le titre, le texte et
  l'adresse ouverte au clic lui sont fournis par l'application à chaque
  programmation (`IrrigationPushNotification`,
  `cloudflare/irrigation-push/src/contract.ts`) ; une alarme plus récente
  remplace la précédente par sa révision.

## Objet

Le plan suit la semaine réelle. Quand il se passe quelque chose — un
arrosage fait en partie, annulé ou pas démarré, une pluie mesurée, une
réserve corrigée, une restriction, un besoin modifié, un matériel déplacé,
un refus —, le plan se recalcule, montre ce qui a changé et, pour les
arrosages déjà validés, **suggère** une réduction ou une annulation que le
maraîcher confirme. Un arrosage en retard est signalé. Rien de réel n'est
réécrit, aucun arrosage validé n'est modifié sans le geste du maraîcher.

## Vocabulaire

- **Événement** : un enregistrement fait par le maraîcher, ou par le
  logiciel pour lui, qui change ce que le moteur doit savoir. La liste est
  fermée (règle 4).
- **Recalcul sur événement** : un calcul du plan lancé par le serveur juste
  après l'enregistrement d'un événement, avec le déclencheur « événement »
  et le nom de l'événement.
- **Dose utile** d'un arrosage validé : la dose que le moteur proposerait
  aujourd'hui pour ce même matériel sur ces mêmes planches, en comptant tout
  sauf cet arrosage lui-même et ceux qui le suivent.
- **Suggestion** : « Réduire à … mm » ou « Annuler », affichée sur un
  arrosage validé, que le maraîcher applique ou garde. Elle n'agit jamais
  seule.
- **Ce qui a changé** : la comparaison d'un calcul avec le précédent de la
  même semaine.
- **En retard** : une irrigation planifiée qui n'a pas démarré à son heure,
  passé une tolérance.
- **Non faite** : une irrigation planifiée dont tout le créneau est passé
  sans démarrage.

## Les règles

### Les décisions du maraîcher (D-030, point ouvert 31)

1. **Le moteur lit les refus de la semaine.** À chaque calcul, le service
   lui passe les créneaux refusés de la semaine du plan, chacun par son
   matériel, son début et sa fin. Le placement les évite comme il respecte
   une plage horaire (R8) : aucun créneau de ce matériel ne recouvre ces
   heures, même en partie, quelle que soit la dose. Le besoin des planches
   reste entier et se place ailleurs, à une autre heure ou un autre jour, ou
   se lit « non placé ».
2. **Le motif « créneau refusé ».** Une planche qui reste non placée parce
   que ses seuls créneaux possibles ont été refusés le dit, avec ce motif,
   dans la liste « Non placé ». Quand une autre contrainte aurait suffi à
   l'empêcher (plage, espacement, eau), c'est elle qui est nommée, comme
   aujourd'hui.
3. Un refus ne vaut que pour la semaine de son plan ; le lundi repart sans
   lui. Deux refus excluent deux créneaux, pas le jour (D-030, inchangé).
   L'arbitrage 3.4 validé reste lu comme aujourd'hui.

### Les événements qui font recalculer (question 1)

4. **La liste.** Le plan de la semaine courante se recalcule de lui-même,
   côté serveur, pour la seule exploitation concernée et la saison de
   l'événement, juste après l'enregistrement de :
   - une irrigation planifiée à la main, démarrée, saisie après coup,
     terminée, terminée en partie, dont le reste est annulé, ou annulée,
     dans la semaine courante ;
   - une pluie saisie au pluviomètre, `0 mm` compris, ou une mesure retirée
     (« Retirer la mesure », 31 octobre 2026 : la réanalyse reprend) ;
   - un niveau de réserve observé, ou un débit de ressource appliqué ;
   - une limite journalière posée, changée ou levée ;
   - un objectif hydrique posé ou retiré, un seuil, une priorité ou un
     besoin fixé à la main changés, un arbitrage 3.4 validé ;
   - un matériel posé, retiré, reposé ou dont le réglage appliqué change
     (2.11) ;
   - une proposition refusée.
5. **Ce qui ne fait pas recalculer** : un réglage du planning, qui vaut au
   prochain calcul (contrat 3.6, inchangé) ; la pause ou la reprise d'un
   minuteur ; la météo actualisée à l'ouverture de la page, le plan du
   matin ayant la prévision du matin (D-028) ; le simple passage du temps,
   dont un arrosage qui passe « en retard » (règle 20) ; un événement daté
   d'une autre semaine que la semaine courante, qui ne change pas son plan.
6. **L'événement d'abord.** L'enregistrement de l'événement ne dépend jamais
   du recalcul : si le calcul échoue, l'événement reste enregistré, l'échec
   se journalise sans nommer personne et l'en-tête du plan dit « plan
   antérieur à : pluie saisie mardi 7 h 10 — recalculez ». Le calcul se
   lance après la réponse au maraîcher, pour ne pas allonger son geste, et
   la section « Planning » relit le plan dès qu'il est prêt, comme les
   besoins et la faisabilité se rafraîchissent déjà après un événement. Si
   l'hébergement ne permet pas de travailler après la réponse, le calcul se
   fait avant elle, borné dans le temps, l'événement restant enregistré
   quoi qu'il arrive.
7. **Le déclencheur est nommé.** Le calcul retient « événement » et le nom de
   l'événement ; l'en-tête l'affiche : « recalculé à 7 h 10 après la pluie
   saisie au pluviomètre ». Il écrit ses durées par phase comme les autres
   calculs (point ouvert 34, en veille) : chaque recalcul sur événement est
   une occasion de plus d'observer le 3 s à 45 s.
8. Plusieurs événements de suite donnent plusieurs calculs ; le moteur étant
   déterministe, le dernier dit l'état juste.

### Même entrée, même plan

9. **Idempotence.** Deux calculs sans événement entre eux donnent les mêmes
   propositions, les mêmes suggestions, aucune notification, et « Ce qui a
   changé » dit « rien n'a changé ».
10. **Une proposition reproduite garde son identité.** Quand un calcul
    refait une proposition identique — même matériel, même réglage, même
    début, même fin, même dose —, elle reste la même proposition, toujours
    « proposée », avec le même identifiant, et l'écran la montre comme une
    proposition du dernier calcul ; sa justification est celle du dernier
    calcul. Seules les propositions qui changent sont « remplacées ». Une
    carte restée ouverte pendant un recalcul se valide donc tant que sa
    proposition n'a pas changé. Le détail du registre se règle au code.

### Les arrosages validés : suggestions (questions 2 et 3)

11. **Jamais modifiés par le moteur** (inchangé). Ils comptent comme
    aujourd'hui dans les besoins, l'eau, la pompe et la limite journalière,
    suggestion ou pas, jusqu'au geste du maraîcher.
12. **La dose utile.** À chaque calcul, pour chaque irrigation planifiée de
    la semaine encore à venir et non démarrée, le moteur calcule sa dose
    utile avec ses propres règles du jour — R11 et R13 pour le matériel
    collectif, la pluie prévue selon R2, la dose maximale R5, la tolérance
    du dernier jour sous la dose minimale —, en comptant le réel, la pluie
    et les irrigations validées qui la précèdent, mais pas elle-même ni
    celles qui la suivent. Les arrosages validés sont examinés dans l'ordre
    du temps : si une pluie rend inutile l'un de deux arrosages d'une
    planche, c'est le dernier qui reçoit la suggestion, le plus tôt restant
    servi (D-024, point 5). Une irrigation en cours ne reçoit jamais de
    suggestion.
13. **Annuler.** Quand la dose utile est inférieure à la dose minimale de sa
    nature (R4 : aspersion 5 mm, goutte-à-goutte 3 mm), zéro compris, le
    moteur suggère « Annuler ».
14. **Réduire.** Sinon, quand la dose prévue dépasse la dose utile d'au moins
    la dose minimale de sa nature, il suggère « Réduire à X mm » ; la durée
    suit la dose au prorata, la fin suit le début, comme un ajustement 3.6.
    Un écart plus petit ne fait rien suggérer : le sur-apport se lit dans la
    justification, comme aujourd'hui.

    Exemples : une aspersion validée à 10 mm pour mercredi soir, 8 mm de
    pluie au pluviomètre mercredi matin : dose utile 2 mm, sous les 5 mm
    minimum, suggestion « Annuler ». Un goutte-à-goutte validé à 8 mm,
    objectif baissé : dose utile 4 mm, écart 4 mm, au moins les 3 mm minimum,
    suggestion « Réduire à 4 mm ». Le même avec une dose utile de 6 mm :
    écart 2 mm, rien n'est suggéré.
15. **Jamais allonger.** Un arrosage validé devenu insuffisant n'est pas
    allongé : le reste du besoin est proposé à part, par une proposition
    ordinaire, sous les mêmes règles (R6, R7), ou se lit « non placé » avec
    son motif. Le maraîcher reste libre de modifier lui-même l'arrosage
    validé, par le circuit existant.
16. **Ce qui ne peut plus se faire.**
    - Matériel retiré ou reposé ailleurs (D-044) : suggestion « Annuler »,
      avec le message de la 2.11 (matériel, date du retrait). Reposé au même
      endroit, la suggestion disparaît.
    - Limite journalière posée après coup, que les irrigations validées d'un
      jour dépassent : le jour est signalé, « ces irrigations seront refusées
      au démarrage », et le moteur suggère de les réduire jusqu'à la limite
      en suivant la conduite en pénurie (R9) à l'envers : la priorité basse
      d'abord, puis la normale, puis la haute ; dans le niveau qui est
      entamé, chaque arrosage garde la même fraction de sa dose. Une
      réduction sous la dose minimale devient « Annuler ». Une irrigation
      dont le volume ne peut pas être vérifié — une aspersion sur une planche
      sans passe-pied — est signalée de même, avec « Annuler » ou renseigner
      le passe-pied dans Ouvre ta ferme.
17. **Les gestes.** « Appliquer » passe par le circuit existant de
    modification ou d'annulation d'une irrigation planifiée, avec les mêmes
    gardes ; c'est un événement, qui fait recalculer (règle 4). « Garder »
    fait taire la suggestion ; elle ne revient que si un calcul suivant en
    fait une autre (une autre dose, ou « Annuler » après « Réduire »). Chaque
    suggestion dit sur quoi elle repose : « pluie de 8 mm saisie mercredi
    7 h 10 », « pluie prévue de 12 mm jeudi », « objectif baissé à 15 mm »,
    « rampe bloc 3 retirée le 28 octobre ». Le logiciel expose, le maraîcher
    décide (D-028).

### Les arrosages en retard (question 4)

18. **Le signal.** Toute irrigation planifiée — validée depuis le plan ou
    créée par « Planifier » — qui n'a pas démarré une **tolérance** après son
    heure de début est « en retard », sur sa carte dans « À venir ou à
    terminer » et dans le plan. La tolérance est un réglage nouveau, **R14,
    30 minutes au départ**, par exploitation, réglable à l'écran avec son
    historique comme les autres.
19. **Son eau.** La règle actuelle de l'eau planifiée ne change pas : une
    irrigation en retard compte pour la part de son créneau qui reste à
    venir ; une fois tout son créneau passé sans démarrage, elle est « non
    faite » et ne compte plus. Le calcul suivant — du matin, à la demande ou
    sur événement — replace le besoin. C'est la lecture précisée de la phrase
    du contrat du planning « le calcul suivant la considère comme non
    faite ».
20. **Jamais annulée par le logiciel.** Elle se démarre encore — elle compte
    alors au réel —, ou s'annule à la main. Sa carte propose « Démarrer »,
    « Annuler » et « Recalculer le plan ». Le passage en retard ne lance pas
    de calcul.

### Les notifications (question 5)

21. **Deux cas seulement**, par le Worker de notification existant :
    - une irrigation passe « en retard » ;
    - un calcul que le maraîcher n'a pas lancé lui-même — celui du matin —
      fait une suggestion sur un arrosage validé des prochaines 24 heures.
22. Au plus une notification par calcul, qui regroupe ses suggestions ; un
    clic ouvre le planning de `/irrigation`. Aucune notification pour un
    calcul qui suit un geste fait à l'écran : le maraîcher a le plan sous les
    yeux.
23. Une panne de notification n'altère jamais le plan ni l'historique
    (inchangé).
24. Piste technique, à vérifier au code. Le Worker reçoit déjà de
    l'application le titre, le texte et l'adresse de chaque alarme : l'alarme
    « en retard » est une alarme de la sorte existante, programmée à la
    création de l'irrigation planifiée pour son début plus R14, que le
    démarrage remplace par l'alarme de fin du minuteur et que l'annulation
    ou la saisie après coup retire, par la révision déjà en place ; la
    notification du matin peut passer par la même route, une alarme à
    échéance immédiate sous un identifiant du calcul. Le Worker ne devrait
    pas changer ; s'il doit, son code se déploie par la CI à la fusion,
    comme le reste. Aucun réglage Cloudflare n'est touché.

### Ce qui a changé

25. Après chaque calcul, un pli « Ce qui a changé depuis le calcul de
    6 h 15 » liste : les propositions apparues, retirées, déplacées — à la
    minute, comme l'écran les montre — ou de dose changée — au dixième de
    millimètre — ; les suggestions nouvelles sur les arrosages validés ; les
    planches entrées dans « Non placé » ou sorties ; l'écart du manque d'eau.
    Rien n'y est modifiable : c'est une lecture.

## Ce qui ne change pas

L'historique réel est immuable (D-006) ; le moteur ne modifie ni n'annule
jamais un arrosage validé ; l'ET0 n'entre dans aucune dose (D-010) ; les
règles tranchées du planning (D-024, D-025, D-030, D-037, D-038, D-040) ; la
pluie au pluviomètre prime (invariant) ; une irrigation planifiée qui ne peut
pas démarrer ne compte pas (D-044) ; une irrigation réelle reste toujours
enregistrable ; Ouvre ta ferme est lu, jamais écrit (D-001, D-002) ;
l'isolation par exploitation. Le moteur de placement ne gagne aucune règle
agronomique nouvelle : il lit les refus, et la dose utile réutilise ses
propres règles.

## L'écran

Dans la section « Planning de la semaine », sans réorganisation, que la 3.8
fera :

- l'en-tête nomme le déclencheur du dernier calcul, ou dit que le plan est
  antérieur à un événement (règles 6 et 7) ;
- le pli « Ce qui a changé » (règle 25) ;
- sur chaque arrosage validé qui en porte une, la suggestion, sa raison et
  ses deux boutons ;
- le signal « en retard » ou « non faite », ici et dans « À venir ou à
  terminer », avec ses boutons ;
- le motif « créneau refusé » dans « Non placé » ;
- R14 dans le pli « Réglages du planning ».

Lisible sur ordinateur et à 390 px sans défilement horizontal. Aucune règle
dans les composants : la présentation vit dans
`lib/domain/planning/presentation.ts`, testée.

## Données

À préciser au code, sans migration destructive
(`docs/migrations-contract.md`) : le nom de l'événement qui a déclenché un
calcul ; « Garder » sur une suggestion, avec sa dose, pour qu'elle se taise ;
R14 avec les autres réglages et leur journal. Les refus sont déjà au
registre ; la dose utile, le retard et « Ce qui a changé » se calculent.

## Découpage et preuve de fin

En PR courtes, chacune verte en CI, tests d'abord :

1. **La lecture des refus** (D-030) : le moteur et le service, le test qui
   rejoue la rampe du tunnel 4 refusée mardi 22 h 30 – 23 h 00 et placée
   ailleurs, jamais sur ces heures ; le motif « créneau refusé ». Ferme le
   point 31 après recette sur le site.
2. **Le recalcul sur événement** : l'identité des propositions reproduites,
   l'idempotence, le déclencheur nommé, l'appel après chaque événement de la
   règle 4, l'échec qui ne bloque pas l'événement.
3. **Les suggestions** : dose utile, réduire, annuler, matériel retiré,
   limite posée après coup, « Garder », « Ce qui a changé », dans le domaine
   avec leurs scénarios.
4. **Le retard et les notifications** : R14, les signaux, les deux
   notifications, le Worker s'il doit changer.
5. **L'écran** et un parcours navigateur P12 aux deux largeurs : une pluie
   saisie, le plan recalculé seul, la suggestion « Annuler » sur un arrosage
   validé, appliquée ; un refus, le besoin placé ailleurs ; remise en état.

Preuve de fin, celle de la roadmap : les scénarios de replanification en
tests, l'idempotence d'un recalcul sans changement, le refus du tunnel 4
rejoué en test, les tests de persistance, le parcours navigateur, une recette
réelle sur une semaine d'exploitation (question 6).

## Questions au porteur

Chacune avec ma recommandation et sa raison ; les réponses du 30 octobre
2026 sont consignées dans la section « Décisions du porteur ».

1. **Recalculer tout seul après un événement ?** Le plan se recalcule de
   lui-même après chaque événement de la règle 4, ou bien il affiche
   seulement « le plan n'est plus à jour, recalculez ». Recommandation : tout
   seul. Le plan qu'on lit est alors toujours celui des faits du moment, et
   l'identité des propositions reproduites (règle 10) évite qu'un recalcul
   dérange une carte qu'on est en train de valider.
2. **Quand suggérer de réduire ou d'annuler un arrosage validé ?**
   Recommandation : la règle des points 12 à 14, avec pour seuil la dose
   minimale déjà réglée (R4) : annuler sous la dose minimale, réduire quand
   l'écart l'atteint, rien en dessous. Pas de chiffre nouveau à régler, et un
   écart plus petit qu'un arrosage minimal ne vaut pas de vous déranger.
   L'autre voie, un réglage dédié à l'écart (par exemple en %), reste
   possible plus tard si l'usage montre que le seuil est trop large.
3. **Une restriction posée après coup** : quand les arrosages validés d'un
   jour dépassent une limite journalière nouvelle, suggérer de les réduire en
   commençant par la priorité basse (point 16), ou seulement les signaler et
   vous laisser choisir ? Recommandation : suggérer, en suivant la même
   conduite que le moteur en pénurie, toujours à confirmer : sans quoi ils
   seront refusés au démarrage sans que vous l'ayez vu venir.
4. **Quand un arrosage est-il « en retard » ?** Recommandation : 30 minutes
   après l'heure prévue sans démarrage, réglable (R14) ; son eau reste
   comptée jusqu'à la fin de son créneau, puis elle est replacée ; jamais
   annulé par le logiciel. La règle actuelle de l'eau planifiée ne change
   pas, et une demi-heure laisse le temps d'aller ouvrir la vanne.
5. **Quelles notifications sur le téléphone ?** Recommandation : deux
   seulement, l'arrosage en retard et la suggestion du calcul du matin sur un
   arrosage des prochaines 24 heures, une seule par calcul, jamais après un
   geste fait à l'écran. Au-delà, les notifications deviennent un bruit qu'on
   n'écoute plus. Elles passent par le Worker de notification existant ;
   aucun réglage Cloudflare n'est touché.
6. **La recette sur une semaine d'exploitation** : fin octobre, la ferme
   arrose peu. Recommandation : la faire dès la mise en ligne, sur les
   arrosages réels de la ferme s'il y en a, complétés par des événements
   fabriqués sur les données expérimentales, remises en état ensuite
   (consigne du 5 octobre 2026), avec votre « vas-y » au moment de la faire,
   puisqu'elle touche la ferme réelle ; le jugement reste le vôtre.

## Décisions du porteur

Prises le 30 octobre 2026 à 21 h 19, à la lecture du contrat : « Je suis
d'accord avec toutes tes suggestions. » Les six recommandations deviennent
les règles, consignées dans `docs/DECISIONS.md` (D-051).

1. ✅ **Recalcul sur événement** : le plan se recalcule de lui-même après
   chaque événement de la règle 4 ; une proposition reproduite garde son
   identité.
2. ✅ **Suggestions** : le seuil est la dose minimale R4 ; « Annuler » sous
   la dose minimale, « Réduire » quand l'écart l'atteint, rien en dessous ;
   aucun réglage nouveau.
3. ✅ **Restriction posée après coup** : le moteur suggère de réduire
   jusqu'à la limite, priorité basse d'abord, puis normale, puis haute, à
   confirmer ; jamais appliqué seul.
4. ✅ **En retard** : 30 minutes après l'heure prévue sans démarrage,
   réglage R14 ; l'eau comptée jusqu'à la fin du créneau, puis replacée ;
   jamais annulé par le logiciel.
5. ✅ **Notifications** : deux seulement, l'arrosage en retard et la
   suggestion du calcul du matin sur un arrosage des prochaines 24 heures,
   une par calcul, jamais après un geste fait à l'écran.
6. ✅ **Recette réelle** : dès la mise en ligne, arrosages réels complétés
   d'événements fabriqués sur les données expérimentales remises en état,
   sur son « vas-y » le jour même.

## Choix faits en écrivant, confirmés à la relecture

Techniques, sans effet sur l'arrosage ; retenus, aucune objection à la
relecture du 30 octobre 2026 :

- une proposition reproduite à l'identique garde son identité (règle 10) ;
- une pause ou une reprise du minuteur, et un événement d'une autre semaine,
  ne font pas recalculer (règle 5) ;
- l'échec d'un recalcul ne bloque jamais l'événement, et le calcul se fait
  après la réponse au maraîcher quand l'hébergement le permet (règle 6) ;
- les arrosages validés sont examinés dans l'ordre du temps pour la dose
  utile (règle 12) ;
- les notifications réutilisent l'alarme existante du Worker (règle 24) ;
- le réglage du retard prend le numéro R14, la numérotation R2 à R13 étant
  conservée.
