# Contrat — Planning hebdomadaire d'irrigation (cadrage 3.5.0)

Écrit le 29 septembre 2026, avant tout code du moteur, pour le porteur de
projet, qui en est le validateur agronomique (D-014). Cahier des charges,
sections 21 à 24, 26 et 27 ; roadmap, sous-tranches 3.5.0 et 3.5 à 3.7.

Ce document dit ce que le planning **proposera**, à partir de quoi, dans quel
ordre et sous quelles contraintes, et ce qu'il ne fera jamais. Chaque règle
discutable est un **réglage** avec une valeur de départ proposée, jamais une
constante cachée ; les points à trancher sont rassemblés à la fin, avec ma
recommandation pour chacun. **Le porteur a tranché les douze questions le
29 septembre 2026 au soir** (D-024, « Décisions du porteur » en fin de
document). **Le contrat est validé** : le moteur (3.5) peut s'écrire.

Tous les chiffres viennent de la ferme, relevés sur la version déployée le
29 septembre 2026 à 12 h 52 : forage principal à 0,511 m³/h de débit de
référence, réserve tampon de 60 m³ observée à 30 m³, pompe « La pompe » à
8 m³/h, objectif de 20 mm par semaine sur toute la ferme, 132 planches avec
un besoin, 79,2 m³ à planifier pour la semaine du 28 septembre.

## À quoi ça sert

Aujourd'hui le module répond à « combien ai-je arrosé ? » (cumuls), « combien
chaque planche doit-elle encore recevoir cette semaine ? » (besoins, 3.3) et
« l'eau disponible suffit-elle, et sinon qui sert-on ? » (faisabilité et
arbitrage, 3.4). Il ne répond pas encore à la dernière question du cahier des
charges : **« que devrais-je irriguer cette semaine, quand, et en quelle
quantité ? »**

Le planning y répond par des **propositions de créneaux**, du lundi au
dimanche, que le maraîcher lit, modifie, refuse ou valide. Une proposition
validée devient une irrigation planifiée ordinaire, celle que le module sait
déjà démarrer au minuteur ou saisir après coup. Le planning n'arrose rien, ne
décide rien à la place du maraîcher, et ne cache jamais un manque.

## Vocabulaire

- **Créneau** : un matériel avec son réglage et son emplacement, les planches
  qu'il arrose, une dose en millimètres, un volume en mètres cubes, un début
  et une fin, la pompe et l'origine d'eau. C'est exactement ce qu'une
  irrigation planifiée contient déjà.
- **Proposition** : un créneau que le moteur suggère et que personne n'a
  encore validé.
- **Plan de la semaine** : l'ensemble des propositions et des irrigations
  déjà validées, du lundi au dimanche.
- **Besoin restant** : les millimètres qu'une planche doit encore recevoir
  cette semaine, tels que la 3.3 les calcule (objectif − pluie réelle − pluie
  prévue − irrigation réelle − irrigation déjà planifiée, après seuil et
  remplacement manuel).
- **Budget** : l'eau et le temps de pompage réellement disponibles d'ici
  dimanche.
- **Contrainte opposable** : une limite que le moteur ne franchit jamais, même
  s'il reste un besoin. La liste est fermée, plus bas.
- **Pénurie** : le budget ne couvre pas tous les besoins. Elle est chiffrée et
  répartie, jamais dissimulée.
- **Calcul** : une exécution du moteur, datée, avec ses hypothèses. Chaque
  calcul remplace les propositions non validées du précédent.

## Ce que le planning reprend tel quel

Le moteur ne recalcule aucune règle déjà écrite ailleurs ; il les assemble.

| Règle | Où elle vit | Ce que le planning en fait |
| --- | --- | --- |
| Objectif en mm/semaine, historisé, proratisé par jour | 2.8, D-004 | la cible de chaque planche |
| Besoin restant par planche, seuil, remplacement manuel, priorité haute / normale / basse | 3.3, D-019 | la quantité à placer et l'ordre de service |
| Écart = objectif − (irrigation + pluie) ; l'ET0 informe, ne calcule pas | D-010 | l'ET0 est affichée à côté du plan, jamais dans une dose |
| Pluie : pluviomètre, sinon réanalyse, sinon prévision ; zéro sous abri | 2.8, 3.3, D-019 | l'hypothèse météo de chaque calcul, datée |
| Débit d'un matériel, mm/h au centre de la planche, surface mouillée | 2.x, 5.0 | dose ↔ durée ↔ volume |
| Stock, minimum de sécurité, débit de production, limite de prélèvement | 3.1 | le budget en eau, projeté heure par heure |
| Débit maximal d'une pompe, origines, simultanéité | 3.2 | le budget en temps de pompage |
| Limite journalière d'irrigation en m³/jour (arrêté sécheresse) | 2.8 | contrainte opposable |
| Arbitrage manuel en pénurie, cases « Servir » | 3.4 | quand une décision existe, le moteur la respecte |
| Une irrigation réelle reste toujours enregistrable ; l'historique est immuable | D-006, section 12 | le plan ne réécrit jamais le réel |

## L'objet planifié

**Une proposition validée est une irrigation planifiée au sens de la 2.7, sans
second modèle.** Elle porte le matériel, le réglage et l'emplacement tels
qu'ils sont au moment de la validation, la dose, le créneau, la pompe et
l'origine. Elle se démarre au minuteur, se saisit après coup, se met en pause,
s'annule comme toute irrigation planifiée. La seule chose qu'elle garde en
plus : le numéro du calcul qui l'a proposée et sa justification.

Les propositions non validées vivent à part, dans un registre versionné par
calcul, distinct de l'historique réel. On peut relire ce qu'un calcul a
proposé un matin donné, même après qu'un autre l'a remplacé.

## Les statuts

Cinq statuts pour une proposition, trois pour la suite, qui sont ceux de la 2.7.

| Statut | Qui le donne | Ce qui se passe |
| --- | --- | --- |
| Proposée | le moteur | visible dans le plan, modifiable, sans effet sur l'eau |
| Validée | le maraîcher | devient une irrigation planifiée ; comptée dans les besoins restants et dans les projections d'eau |
| Refusée | le maraîcher | le créneau refusé — ce matériel, à ces heures — est exclu des calculs suivants de la semaine (D-030) ; le besoin reste et se place ailleurs, ou se lit « non placé » |
| Remplacée | le moteur | un calcul suivant a proposé autre chose pour le même besoin ; l'ancienne reste lisible. Une proposition que le calcul suivant reproduit à l'identique n'est pas remplacée : elle garde son identité (3.7, règle 10, « Le recalcul sur événement ») |
| Expirée | le moteur | son jour est passé sans validation |
| Réalisée, partielle, annulée | la 2.7 | l'irrigation validée a vécu ; le plan lit le réel, jamais l'inverse : la carte se lit « Réalisée », « Partielle » ou « Annulée » ; une annulée ne compte plus parmi les validées ni dans le volume, son besoin est revenu au plan (recette réelle du 31 octobre 2026) |

**Une proposition validée n'est jamais modifiée ni annulée par le moteur.** Si
un calcul suivant conclut qu'elle est devenue inutile — une pluie est tombée —
ou insuffisante, il propose une réduction, une annulation ou un complément,
que le maraîcher confirme. C'est la replanification (3.7).

**Un refus vaut pour le reste de la semaine** (D-030, 5 octobre 2026). Le
créneau refusé, c'est le matériel de la proposition pendant les heures de
la proposition, du début à la fin ; aucun calcul suivant de la même semaine
ne propose ce matériel sur ces heures, ni sur une partie d'elles, quelle
que soit la dose. Le besoin des planches reste entier : le moteur le place
ailleurs — à une autre heure, ou un autre jour — ou le dit « non placé »
avec son motif. Le refus ne vaut que pour la semaine de son plan : le lundi
repart sans lui. Refuser deux fois exclut deux créneaux, pas le jour.

## Le cycle

- **Horizon** : la semaine civile courante, du lundi au dimanche, en
  `Europe/Paris` (D-004). Le plan couvre d'aujourd'hui à dimanche ; les jours
  écoulés ne se replanifient pas.
- **Recalcul quotidien**, après la synchronisation météo de 06 h 15 : le
  plan du jour est prêt avec les prévisions du matin. L'heure est celle de
  la météo et ne se règle pas (D-029).
- **Recalcul à la demande**, par un bouton, à tout moment.
- **Recalcul sur événement** (3.7, `docs/replanning-contract.md`, règles 4
  à 10 ; en place depuis le 30 octobre 2026, « Le recalcul sur événement »
  plus bas) : après chaque événement de la liste fermée — irrigation
  planifiée, démarrée, saisie, terminée, partielle, annulée ; pluie saisie au
  pluviomètre ; niveau de réserve observé ou débit appliqué ; limite
  journalière, objectif, seuil, priorité ou besoin à la main, arbitrage ;
  matériel posé, retiré ou réglage changé ; proposition refusée ou validée —,
  le serveur recalcule le plan de la semaine courante de lui-même, après sa
  réponse, pour la seule exploitation concernée. Le calcul nomme son
  déclencheur. Ce qui change par rapport au calcul précédent sera montré par
  la suite de la 3.7 (« Ce qui a changé »).
- **Le lundi**, une nouvelle semaine repart de l'objectif de la semaine. Le
  déficit de la semaine passée se lit dans les cumuls ; il ne se reporte pas
  de lui-même (question Q9).
- **Une irrigation validée non réalisée** à l'heure prévue est signalée « en
  retard » ; le calcul suivant la considère comme non faite, remet son eau
  dans le besoin restant et propose une suite. Elle n'est pas annulée.

Le moteur est **déterministe** : les mêmes entrées donnent le même plan. Deux
calculs sans événement entre eux proposent la même chose, et les propositions
reproduites gardent leur identité (3.7, règles 9 et 10). Un refus est un
événement : le calcul qui le suit place le besoin ailleurs (D-030).

## La quantité à placer

Pour chaque planche, le moteur part du **besoin restant à planifier** de la
3.3, tel quel. Il n'ajoute pas de formule : pas d'ET0, pas de coefficient, pas
de stade de culture (hors périmètre, section 27 du cahier des charges).

Deux précisions qui relèvent du planning :

1. **La pluie prévue.** La 3.3 la déduit en entier (D-019). Pour placer des
   arrosages, se fier à 100 % d'une pluie annoncée est optimiste ; s'en
   méfier à 100 % fait arroser avant la pluie. Le moteur déduit la pluie
   prévue à hauteur d'une **part réglable** (réglage R2, 100 % au départ pour
   rester égal à la 3.3) et, quand une pluie prévue dépasse un **seuil**
   (réglage R3, 5 mm), il place les arrosages des planches concernées
   **après** le jour de pluie plutôt qu'avant. Si la pluie ne vient pas, le
   recalcul du lendemain remet le besoin et propose le rattrapage. Sous abri,
   la pluie prévue vaut zéro comme la pluie réelle (3.3) : les tunnels ne sont
   jamais concernés. Tranché le 29 septembre 2026 : 100 %, sauf sous abri.

2. **La dose d'un arrosage.** Un besoin de 20 mm ne se donne pas
   nécessairement en une fois. Chaque nature de matériel a une **dose
   minimale** et une **dose maximale par arrosage** (réglages R4 et R5), un
   **nombre maximal d'arrosages par jour** (R6) et un **espacement minimal**
   entre deux arrosages d'une même planche (R7). Valeurs de départ proposées,
   à discuter : aspersion 5 à 15 mm, une fois par jour ; goutte-à-goutte 3 à
   10 mm, une fois par jour ; un jour d'espacement. Un besoin restant sous la
   dose minimale attend qu'il grandisse, sauf le dernier jour de la semaine.
   L'espacement se compte de début à début : un jour, c'est 24 heures, le
   lendemain à la même heure au plus tôt. Tranché le 29 septembre 2026 : ces
   valeurs de départ sont retenues, réglables à l'écran.

**Dose d'un matériel qui arrose plusieurs planches.** Une rampe de bloc arrose
dix à douze planches d'un coup, dont les besoins restants diffèrent — celles
déjà servies au goutte-à-goutte, celles sous remplacement manuel. La dose du
créneau est **le besoin restant le plus élevé** parmi les planches couvertes
qui ont encore un besoin, plafonné par la dose maximale ; les autres planches
reçoivent plus que leur besoin, et ce **sur-apport est affiché**, planche par
planche, jamais fondu dans une moyenne. Alternative : la dose la plus faible,
qui n'arrose jamais trop mais laisse des déficits (question Q4).

Dose, durée et volume se convertissent par les règles existantes : durée =
dose ÷ mm/h du réglage ; volume = dose × surface mouillée. Exemple, rampe du
bloc 2, 1,87 m³/h : les 20 mm des dix planches du bloc, 5,607 m³, demandent
3 h ; les 14,6 mm restant à planifier le 29 septembre, 4,09 m³, demandent
2 h 11.

## Où placer les créneaux dans la semaine

Dans cet ordre, pour chaque jour restant, d'aujourd'hui à dimanche :

1. **Les plages horaires.** Chaque nature de matériel a une plage dans la
   journée (réglage R8) : aspersion la nuit et le petit matin, 21 h – 8 h au
   départ, pour limiter l'évaporation et le vent ; goutte-à-goutte 6 h – 22 h.
   Un créneau tient dans sa plage ; un besoin qui n'y tient pas attend le
   lendemain ou se fractionne.
2. **La répartition.** Le besoin restant d'une planche se répartit sur les
   jours restants en respectant dose et espacement, **au plus tôt** — un
   déficit ne s'aggrave pas en attendant dimanche —, sauf devant une pluie
   prévue au-dessus du seuil, que l'on laisse passer. Alternative : un
   lissage régulier sur la semaine (question Q6).
3. **L'ordre de service dans un jour** : priorité haute avant normale avant
   basse ; à priorité égale, le déficit relatif le plus fort d'abord ; à
   égalité, l'ordre de l'inventaire. Un arbitrage 3.4 validé pour la semaine
   prime sur cet ordre.
4. **La simultanéité.** Sur une même pompe, la somme des débits des créneaux
   qui se chevauchent ne dépasse jamais son débit maximal (règle 3.2). Sur la
   ferme : 8 m³/h, donc quatre rampes de bloc à 1,85 m³/h ensemble, ou les
   rampes de serre des tunnels 1, 2 et 3 (1,28 + 2,56 + 2,56 = 6,4 m³/h) puis
   celle du tunnel 4 ensuite. Les quatre rampes de serre en même temps
   feraient 10,24 m³/h : jamais proposé.
5. **L'eau.** Le stock de la réserve est projeté heure par heure (règles 3.1) :
   le stock observé, plus le forage, moins les créneaux au fur et à mesure,
   sans jamais passer sous le minimum de sécurité ni dépasser la capacité. Sur
   la ferme, le forage remplit 0,511 m³/h, soit 12,3 m³ par jour : la réserve
   de 60 m³ observée à 30 m³ le mardi midi offre environ 97 m³ d'ici dimanche
   pour 79,2 m³ à planifier — mais pas 40 m³ la première nuit. Précisé le
   2 octobre 2026 (point ouvert 19) : la projection qui juge un créneau est
   bornée par la capacité seule — le trop-plein est perdu —, jamais par
   zéro, et court du début du créneau à la fin de l'horizon, parce que le
   moteur ne place pas dans l'ordre du temps ; un créneau qui ferait passer
   la projection sous le minimum, à son heure ou plus tard, est décalé à
   l'heure où le forage aura comblé le manque si ce manque est le sien,
   sinon raccourci à la plus longue durée que la réserve accepte, sinon
   refusé avec son motif. Le niveau *affiché* sur une proposition reste
   borné par zéro et par la capacité : une cuve n'est jamais négative.
6. **Les limites.** La limite journalière d'irrigation (2.8) et la limite de
   prélèvement d'une ressource (3.1) sont vérifiées jour civil par jour civil,
   en comptant ce qui est déjà réalisé et validé ce jour-là. Un créneau qui
   passe minuit se vérifie jour par jour depuis son début : il s'arrête à
   l'heure où le reste d'un de ses jours s'épuise, jamais en retirant à sa
   fin ce qu'un jour plus tôt a de trop (points ouverts 54 et 58, D-085).
   Quand son premier jour ne tient plus la durée minimale, il part à minuit
   si sa plage continue, sur le reste du jour suivant ; sinon un autre jour
   est essayé. La coupe d'une limite de prélèvement porte son nom, « limite
   de prélèvement », jamais celui d'une réserve : une ressource prélevée
   directement n'a ni stock ni minimum de sécurité (point ouvert 55).

Le résultat est un plan qui, en septembre sur la ferme, tient sans peine :
79,2 m³ à 8 m³/h font dix heures de pompage au minimum ; matériel par
matériel, à quatre rampes en parallèle, une douzaine d'heures réparties sur
six nuits de dix heures.

## Les contraintes opposables

Liste fermée. Le moteur ne les franchit jamais ; quand l'une d'elles bloque un
besoin, le déficit qui en résulte est chiffré et nommé.

| Contrainte | Source | Ce que le moteur fait devant elle |
| --- | --- | --- |
| Limite journalière d'irrigation, m³/jour, sur ses dates | 2.8 | plafonne le volume proposé du jour, réalisé et validé compris |
| Limite de prélèvement d'une ressource, m³/jour | 3.1 | plafonne ce que la ressource peut fournir ce jour-là ; la coupe se nomme « limite de prélèvement » |
| Minimum de sécurité d'une réserve | 3.1 | la projection ne descend jamais dessous |
| Débit maximal d'une pompe, simultanéité | 3.2 | découpe et enchaîne les créneaux |
| Origine d'eau indisponible, pompe archivée, ressource inactive sur la période | 3.1, 3.2 | aucun créneau sur cette chaîne |
| Plage horaire d'une nature de matériel | R8 | place le créneau dedans ou le reporte |
| Créneau protégé nommé, pour tout le matériel de l'exploitation | 3.8 ter, `docs/protected-slots-contract.md` (D-062) | découpe la plage autour de lui, sans exception, prioritaires et pénurie compris |
| Restriction réglementaire, arrêté préfectoral | 2.8 | c'est la limite journalière en m³/jour, qui existe déjà : un arrêté fonctionne toujours ainsi (tranché le 29 septembre 2026) ; aucune plage horaire à modéliser |

Ne sont **pas** des contraintes opposables : l'ET0, une prévision de pluie, un
seuil de planification — ils réduisent une quantité, ils n'interdisent rien.

## Pénurie : quand le budget ne suffit pas

Le moteur distingue deux manques, chacun chiffré et nommé :

- **le manque d'eau** : le volume que la réserve et les ressources ne peuvent
  pas fournir d'ici dimanche, ou pas un jour donné à cause d'une limite ;
- **le manque de temps de pompage** : les créneaux qui ne tiennent pas dans
  les plages horaires avec la simultanéité permise.

Devant un manque, la **conduite en pénurie** est un réglage (R9) parmi trois,
celles du cahier des charges (section 27) :

1. **Prioritaires d'abord, puis part égale** — valeur de départ proposée :
   la priorité haute est servie en entier, puis la normale, puis la basse ;
   à l'intérieur du niveau qui ne peut pas être servi en entier, chaque
   planche reçoit la même fraction de son besoin. C'est la règle de la 3.4,
   sans son arbitrage humain quand il n'existe pas.
2. **Part égale pour toutes**, sans distinction de priorité.
3. **Report** : les planches non servies sont proposées en premier au
   calcul qui suit un événement (décision 4 de la 3.9, D-052, 30 octobre
   2026) — de l'eau nouvelle, un arrosage validé ou fait, un stock corrigé,
   tout événement de la règle 4 du contrat de la 3.7 — ; sans événement
   depuis le calcul précédent, le calcul garde la file du précédent et
   reproduit son plan (« même entrée, même plan », règle 9), au lieu de
   servir les reportées et de reporter les premières, d'un calcul à l'autre.
   Le report reste une file d'attente, qui n'avance que quand quelque chose
   s'est passé. Il ne passe à la semaine suivante que si Q9 le permet
   (R10) ; le déficit des planches reportées reste affiché tel quel.

Dans tous les cas : un arbitrage 3.4 déjà validé pour la semaine s'impose au
moteur ; le déficit annoncé est **exactement** le besoin non couvert, planche
par planche et jour par jour ; le plan ne promet jamais ce qu'il ne place pas.
Un arbitrage absent ou vide — décision caduque, à valider de nouveau, ou sans
aucune planche allouée — ne s'impose pas : la conduite en pénurie s'applique
comme s'il n'existait pas, budgets compris.

Une limite journalière d'irrigation (2.8) borne aussi le budget d'une chaîne :
ce qu'elle laisse d'ici dimanche, jour limité par jour limité, à condition que
chaque jour de l'horizon soit limité ; la coupe est alors nommée « limite
journalière », jamais « stock et ressources », et le résumé du plan le dit.
Dès qu'un jour de l'horizon est sans limite, la limite ne borne pas le budget
de la semaine — ce jour prend ce que ses plages et la pompe permettent, le
budget ne se lit que sur l'eau — ; la limite reste vérifiée créneau par
créneau sur les jours limités, et ce qu'elle y laisse sans place porte le même
nom (point ouvert 35, corrigé le 9 octobre 2026).

**Le budget d'une réserve** est l'eau que la garde laisse passer d'ici
dimanche minuit : le stock observé moins le minimum de sécurité, plus les
apports, moins ce qui est déjà planifié. Quand le stock est sous son minimum
(décision 2 de la 3.9, D-052, 30 octobre 2026), le manque se retire
d'abord : les apports remontent la réserve au minimum avant de compter dans
le budget, comme la garde les compte. Les parts, prises sur ce budget, se
répartissent alors entre toutes les planches, au lieu de servir les unes et
de laisser les autres sans rien quand la garde arrête le placement. Les
règles du placement ne changent pas — la garde, les plages, la dose, la part
réservée — : changent le budget annoncé, les fractions et les parts qui en
découlent. Sur la ferme, le 5 octobre 2026 (calcul T3) : 25 m³ en réserve
pour un minimum de 40 m³, 75,27 m³ d'apports d'ici dimanche ; le budget est
60,27 m³ et non 75,27 m³, la priorité normale vise 73 % de son besoin et
non 91 %, et le plan plaçait déjà 60,2 m³ en tout.

La ligne de budget de chaque chaîne montre, niveau de priorité par niveau,
**la part visée et la part placée** (décision 2) : la part visée est la
fraction de la conduite, celle des parts réservées au départ — sous le
report, la part de la demande du niveau que la conduite sert au départ, une
planche reportée comptant zéro — ; la part placée est l'eau utile placée,
rapportée au besoin du niveau, comptées toutes deux sur la surface que le
propre matériel de chaque planche mouille, comme le budget. Un niveau sans aucune demande s'affiche « — ». L'écart entre les deux
se lit sans se calculer d'avance : le trop-plein d'une réserve pleine les
jours de pluie (T2 : 97 % visés, 84 % placés), une part qu'une planche ne
peut pas recevoir, ou l'eau libérée qu'une autre reçoit en plus.

**La part réservée** (D-037, point ouvert 36, 9 octobre 2026). Chaque planche
d'une chaîne d'eau a une part du budget : sa cible — la fraction de la
conduite en pénurie, ou le besoin entier quand le budget suffit —, comptée sur
la surface que son propre matériel mouille, comme le budget l'a comptée. Les
parts ne dépassent jamais le budget ; ce qui reste au-delà des parts est l'eau
non attribuée. La part attribuée à une planche lui est réservée : le créneau
d'une autre ne peut pas la consommer.

Un créneau est imputé aux parts des planches qu'il arrose utilement, chacune
au prix de son propre matériel et jusqu'à sa part ; ce qu'il verse à côté —
sur une planche sans part, au-delà d'un besoin, ou sur une surface plus large
que celle du matériel de la planche — est pris sur l'eau non attribuée, puis
sur les parts des planches qu'il sert. Le créneau est raccourci à ce que ces
parts paient : la dose dit alors « la part de la semaine réservée à ses
planches », la contrainte limitante « part de la semaine atteinte, le reste
est réservé aux autres planches », et les planches servies sous leur cible
portent le motif de la coupe de la chaîne, « stock et ressources » ou « limite
journalière ». Sous la dose minimale, le matériel ne part pas : il attend une
part plus grande. Le dernier jour de la semaine, il n'y a plus rien à
attendre : quand la première plage que le matériel peut prendre est celle du
dimanche, sa part est placée quand même, si petite soit-elle, comme un reste
hors pénurie (« exception du dernier jour », décision 5 de la 3.9, D-052),
pour ne pas laisser dans la réserve une eau que personne n'aura. Chaque
planche reçoit ainsi sa part, la dernière examinée comme la première, et la
somme des volumes d'une chaîne ne dépasse jamais son budget.

Ce qu'une planche ne peut pas recevoir — plage horaire, espacement, dose
minimale, réserve au minimum au moment voulu, matériel arrêté — est libéré à
la fin d'un tour de placement, jamais pris d'avance : les parts restantes sont
redistribuées, par la même conduite, aux planches de la chaîne encore sous
leur besoin que leur matériel peut encore servir, qui relèvent leur cible
d'autant ; un nouveau tour place le supplément, quatre tours au plus. Les
fractions affichées sont les parts réservées au départ, non le résultat : une
planche peut recevoir plus, par l'eau libérée, ou moins, par ce que son propre
créneau verse à côté ; la part placée, à côté de chacune, dit le résultat
(décision 2 de la 3.9).

**Sous un arbitrage 3.4 validé** (décision 1 de la 3.9, D-052, 30 octobre
2026), chaque allocation est une part réservée, par le même mécanisme : la
part d'une planche allouée est ce qui lui a été alloué, borné à son besoin,
compté sur la surface que son propre matériel mouille ; le reste du budget de
la chaîne est l'eau non attribuée, où puisent les planches que l'arbitrage ne
nomme pas — d'un niveau servi en entier ou d'un niveau non arbitré, qui
gardent leur besoin pour cible — et ce qu'un créneau verse à côté. Le créneau
est borné et imputé comme sous la conduite, et la coupe porte le motif de
l'arbitrage, « stock et ressources » : la dernière planche examinée reçoit son
allocation comme la première. Les parts ne dépassent jamais le budget : quand
une chaîne ne peut pas fournir toutes ses allocations — une limite
journalière, que la faisabilité ne compte pas, ou une eau que le moteur lit
autrement qu'elle —, chacune y est réduite dans la même proportion, et la
coupe porte le motif de la chaîne. Rien n'est redistribué entre planches, la
décision du maraîcher est le dernier mot : ce qu'une planche allouée ne peut
pas recevoir reste non attribué. L'écran le dit sous les cartes du résumé :
l'eau allouée, sa réduction s'il y en a une, et ce que les planches allouées
ne peuvent pas recevoir. Aucune ligne de budget ni fraction ne paraît sous un
arbitrage.

Exemple sur la ferme, réserve observée à 5 m³ un mardi midi au lieu de 30 :
le forage donne 12,3 m³ par jour, soit 67 m³ d'ici dimanche minuit, 72 m³
avec le stock, pour 79,2 m³ demandés — un manque d'eau de 7,2 m³. Si les
quatre tunnels sont en priorité haute (10,2 m³ à 20 mm), ils sont servis en
entier ; les 69 m³ des priorités normales reçoivent 61,8 m³, soit 90 % de
leur besoin chacune ; le plan affiche 7,2 m³ de déficit, répartis planche par
planche.

## Ce que chaque proposition explique

Chaque créneau porte, lisible d'un clic :

- les planches et leur besoin restant avant et après le créneau, avec le
  sur-apport éventuel ;
- la priorité qui l'a placé là, et l'arbitrage 3.4 s'il y en a un ;
- la dose et pourquoi cette dose : dose maximale atteinte, reste de la
  semaine, planche la plus demandeuse du matériel, part de la semaine réservée
  à ses planches (D-037) ;
- le jour et l'heure et pourquoi : plage horaire, pluie prévue laissée passer,
  espacement, ordre de service — le motif nommé est celui qui a fixé le jour :
  quand l'espacement repousse le créneau au-delà du jour que la pluie
  permettait, c'est « espacement », et « plage horaire » ne se dit que si rien
  d'autre n'a contraint (point ouvert 33, corrigé le 9 octobre 2026) ;
- la pompe, l'origine, le débit demandé et le débit déjà engagé à cette heure ;
- **la contrainte limitante**, s'il y en a une : « pompe saturée de 21 h à
  23 h », « stock au minimum jeudi 4 h », « limite journalière atteinte »,
  « part de la semaine atteinte, le reste est réservé aux autres planches » —
  pour la pompe, les matériels nommés sont ceux qui la tenaient au moment où
  le créneau voulait partir, ou ceux qui la prennent à l'heure où il doit
  finir, jamais une liste vide : un creux d'une minute entre deux vagues
  n'efface pas la vague (point ouvert 33, corrigé le 9 octobre 2026) ;
- les hypothèses : la date et l'heure de la prévision météo utilisée, le stock
  observé et sa date, le débit de référence du forage, le numéro du calcul.

Et à côté du plan, ce qui **n'a pas** été placé, planche par planche, avec sa
raison — c'est aussi important que ce qui l'a été.

## Ce que le maraîcher peut faire (3.6)

Lire, puis pour chaque proposition : **déplacer** le créneau, **réduire** ou
augmenter la dose, **refuser**, **ajouter** un créneau de sa main, **valider**
une proposition ou toutes celles d'un jour. Le moteur respecte ce qui est
validé et recalcule le reste autour. Une modification manuelle qui franchit
une contrainte opposable est refusée comme le serait aujourd'hui une
irrigation planifiée qui dépasse la limite journalière — sauf une irrigation
réelle, toujours enregistrable.

## Interface (3.6)

Écrite le 29 septembre 2026, avant le code de l'écran, sur le « vas-y » du
porteur. Une section **« Planning de la semaine »** sur la page d'irrigation,
entre la faisabilité (3.4) et les cumuls (2.9), lisible sur ordinateur et à
390 px sans défilement horizontal. Elle appelle les actions de la troisième PR
du moteur et n'écrit aucune règle métier : ce qu'elle calcule pour s'afficher
— regrouper par jour, compter, convertir un ajustement en durée, lire et
écrire les réglages — vit dans `lib/domain/planning/presentation.ts`, testé.

- **L'en-tête** : la semaine du lundi au dimanche ; le dernier calcul avec
  sa date et son déclencheur (à la demande, recalcul du matin, ou l'événement
  nommé : « après la pluie saisie au pluviomètre », 3.7) ; quand un événement
  est postérieur au calcul, l'avis « Plan antérieur à : …, le … — recalcul en
  cours. », puis « — le recalcul a échoué, recalculez. » si c'est le cas ; un bouton
  « Calculer le plan de la semaine », qui devient « Recalculer » quand un
  calcul existe ; les hypothèses du calcul : le nombre de jours de prévision
  et chaque réserve avec son niveau observé et la date de l'observation.
- **Le résumé** : les propositions par statut, le volume des propositions
  proposées et validées en m³ avec le nombre de créneaux au volume inconnu, le
  manque d'eau, le temps de pompage manquant et les planches non servies. Un
  manque vaut exactement ce que le moteur a chiffré, jamais arrondi à zéro.
  Quand le manque d'eau diffère de « demandé moins placé », une note sous les
  cartes l'explique avec ses chiffres : le manque se compte planche par
  planche, sur la surface que son propre matériel mouille ; l'eau versée à
  côté des planches comptées, au-delà de leur besoin ou sur une surface plus
  large que celle de leur matériel est placée sans couvrir de besoin ; ce qui
  manque pour une autre raison que l'eau — temps de pompage, espacement, dose
  minimale — n'entre pas dans le manque d'eau (D-038, point ouvert 36). Le
  budget par chaîne affiche la part réservée à chaque niveau de priorité, non
  le résultat (D-037).
- **La semaine en jours** : les sept jours, chacun avec ses propositions dans
  l'ordre des débuts — une plage qui passe minuit appartient au jour où elle
  commence —, son compte et son volume ; un jour écoulé avant le calcul le
  dit, un jour sans proposition aussi. Par jour, « Valider les N
  propositions du jour » ; en tête, « Valider toute la semaine » (D-024,
  point 10). Chacune est validée à son tour, avec sa propre réponse ; un
  refus n'arrête pas les suivantes.
- **Une proposition** est une carte : d'un coup d'œil le créneau (début, fin,
  durée), le matériel avec son réglage et sa nature, la dose de référence, le
  volume ou « volume inconnu », les planches, la pompe ou « faisabilité non
  vérifiée », son statut et, quand elle vient d'un calcul antérieur —
  validée ou refusée, relue avec le dernier calcul —, la date de ce calcul,
  les numéros repartant de p-1 à chaque calcul (constat du 29 septembre
  2026, corrigé le 2 octobre) ; d'un clic, sa justification — la priorité,
  pourquoi cette dose, pourquoi ce moment, la contrainte limitante s'il y en
  a une, la pompe avec le débit demandé et le débit déjà engagé, l'origine
  d'eau et son niveau projeté — puis chaque planche avec son besoin avant,
  l'apport, le besoin après et le sur-apport (R11), planche par planche,
  jamais fondu dans une moyenne.
- **Les gestes** sur une proposition encore proposée : **Valider** ;
  **Ajuster**, c'est-à-dire déplacer le début, réduire ou augmenter la dose,
  la durée suivant la dose au prorata et la fin suivant le début — l'écran
  montre la durée et la fin qui en résultent avant de valider — ;
  **Refuser**. Un ajustement passe par les mêmes gardes que la validation :
  matériel, réglage et position tels qu'ils sont, pompe, limite journalière ;
  et il reste dans la semaine du plan sans être déjà terminé à l'heure de
  la validation. Une proposition validée, refusée, remplacée ou expirée ne se
  touche plus ; elle reste lisible avec son statut.
- **Ajouter un créneau de sa main** : un bouton conduit au formulaire
  « Planifier » de la 2.7. L'irrigation planifiée ainsi créée compte au
  prochain calcul comme toute irrigation planifiée : le moteur recalcule
  autour.
- **Les conflits visibles** : une validation refusée par une garde affiche
  son motif sur la carte et la proposition reste proposée ; une validation qui
  aboutit avec une réserve — chevauchement d'une irrigation planifiée du même
  matériel, faisabilité non vérifiée — l'affiche à côté de « validée » ; une
  proposition expirée dit « recalculez » ; la liste **« Non placé »** donne
  chaque planche que le moteur n'a pas servie en entier, avec son jardin, sa
  priorité, son besoin, ce qui est placé, le manque et son motif. Ce qui n'a
  pas été placé est aussi important que ce qui l'a été.
- **Les réglages** R2 à R13 dans un pli « Réglages du planning » : chaque
  réglage avec son unité et son numéro, enregistrés d'un bouton ; une valeur
  absurde est refusée avec son chemin, rien n'est corrigé en silence ; les
  valeurs enregistrées précédemment se lisent dessous, datées. Un réglage
  enregistré vaut au prochain calcul, pas avant.
- Après une validation, un ajustement ou un refus, les besoins, l'eau, la
  faisabilité et la liste des irrigations à venir se rafraîchissent : une
  proposition validée est une irrigation planifiée ordinaire, visible là où
  elles le sont toutes, et s'annule ou se modifie là aussi. Et après tout
  événement, la section relit le plan jusqu'à ce que le recalcul paraisse
  (3.7, « Le recalcul sur événement »).

Rien ne s'écrit dans Ouvre ta ferme. L'écran n'arrose rien.

## Ce que le planning ne fait jamais

- Écrire dans Ouvre ta ferme, démarrer ou arrêter une irrigation.
- Modifier ou annuler une proposition validée sans confirmation.
- Réécrire une irrigation réelle, partielle ou annulée.
- Franchir une contrainte opposable, ni inventer une pompe ou un chemin d'eau
  pour y parvenir.
- Remplacer une donnée inconnue par zéro : un stock inconnu, une surface
  mouillée inconnue, un objectif absent sans besoin manuel qui en tienne lieu
  (D-033) donnent un créneau « non vérifié » ou une planche « non
  planifiable », signalés, jamais un chiffre faux (D-003).
- Faire entrer l'ET0 dans une dose (D-010).
- Décider d'une priorité : elles restent celles que le maraîcher a fixées.

## Cas limites

| Cas | Réponse |
| --- | --- |
| Planche sans objectif | planifiable si un besoin fixé à la main en tient lieu, comme la faisabilité la sert (D-033, 9 octobre 2026) ; sinon non planifiable, listée avec ce motif |
| Planche sans matériel positionné | besoin affiché, aucun créneau, motif « aucun matériel ne l'arrose » |
| Planche arrosée par deux matériels positionnés | le goutte-à-goutte d'abord, l'aspersion pour le reste (question Q5) |
| Planche arrosée par une rampe sous la part R13 | l'eau reçue est comptée dans les besoins et l'historique ; la planche ne commande ni la dose, ni « un arrosage par jour », ni l'espacement ; son reste est affiché « portée du matériel insuffisante » (D-025) |
| Matériel sans pompe habituelle | créneau proposé « faisabilité non vérifiée », sans garantie de débit ni de stock, comme la 3.2 le permet |
| Stock de la réserve inconnu | créneaux proposés « eau non vérifiée » ; le manque d'eau ne peut pas être chiffré et le dit |
| Pluie réelle absente sur des jours écoulés | règle D-019 : prévision du jour, sinon zéro, jours listés « partiel » |
| Prévision météo absente ou ancienne | pluie prévue comptée zéro, calcul marqué « sans prévision » avec la date de la dernière |
| Irrigation en cours au moment du calcul | comptée pour sa dose prévue jusqu'à sa fin, puis lue au réel |
| Semaine entamée | seuls les jours restants reçoivent des créneaux ; le réel des jours passés est déjà déduit par la 3.3 |
| Objectif ou priorité modifié en cours de semaine | recalcul ; les propositions non validées changent, les validées sont comparées et signalées |
| Pluie tombée après validation | recalcul ; proposition de réduire ou d'annuler, à confirmer |
| Arrêt anticipé, irrigation partielle | la 2.7 garde le réel ; le calcul suivant remet le reste dans le besoin |
| Irrigation réelle saisie hors plan | déduite du besoin ; les propositions concernées sont réduites ou remplacées |
| Deux semaines : série implantée en fin de semaine | hors périmètre du planning : les séries se lisent dans les cumuls, le planning raisonne par planche |
| Dimanche soir, besoin non couvert | déficit affiché ; pas de report automatique (Q9) |

## Réglages

Tous par exploitation, sauf mention ; modifiables sans redéveloppement, avec
leur historique.

| N° | Réglage | Unité | Valeur de départ proposée | Portée |
| --- | --- | --- | --- | --- |
| R2 | Part de la pluie prévue déduite du besoin | % | 100 (égal à la 3.3) | ferme |
| R3 | Seuil de pluie prévue qui fait attendre | mm/jour | 5 | ferme |
| R4 | Dose minimale par arrosage | mm | aspersion 5 · goutte-à-goutte 3 | par nature de matériel |
| R5 | Dose maximale par arrosage | mm | aspersion 15 · goutte-à-goutte 10 | par nature de matériel |
| R6 | Arrosages par jour et par planche, au plus | nombre | 1 | par nature |
| R7 | Espacement minimal entre deux arrosages d'une planche | jours | 1 | par nature |
| R8 | Plage horaire | heures | aspersion 21 h – 8 h · goutte-à-goutte 6 h – 22 h | par nature |
| R9 | Conduite en pénurie | choix | prioritaires d'abord, puis part égale | ferme |
| R10 | Report du déficit sur la semaine suivante | oui / non | non | ferme |
| R11 | Dose d'un matériel collectif | choix | besoin le plus élevé des planches couvertes | ferme |
| R12 | Matériel préféré quand deux arrosent la planche | choix | goutte-à-goutte | ferme |
| R13 | Part du débit le plus fort d'un matériel en dessous de laquelle une planche ne commande pas l'arrosage | % | 50 (D-025) | ferme |
| R14 | Tolérance du retard : minutes après l'heure prévue au bout desquelles un arrosage planifié non démarré est « en retard » | minutes | 30 (D-051, 3.7) | ferme |

R1, « heure du recalcul quotidien », a été retiré le 5 octobre 2026 (D-029) :
le recalcul du matin suit la synchronisation météo, 06 h 15, et ne se règle
pas ; la numérotation R2 à R13 est conservée. R14 est arrivé le 31 octobre
2026 avec la 3.7 (`docs/replanning-contract.md`, règle 18) ; un réglage
enregistré avant se lit avec 30 minutes, sans réécriture.

Un réglage par matériel individuel plutôt que par nature — une rampe de serre
qui ne supporte pas 15 mm — reste possible plus tard sans changer la règle.

Les plages horaires (R8) et les doses (R4 à R7) se règlent **à l'écran, par
le maraîcher, sans intervention technique**, avec l'historique de leurs
valeurs ; le moteur relit les réglages à chaque calcul (tranché le
29 septembre 2026).

## Scénarios de recette

Chiffrés sur la ferme, avec leur résultat attendu ; ce sont les tests du
moteur (3.5), puis de la recette réelle (3.9). Les valeurs de départ des
réglages s'appliquent.

1. **Semaine ordinaire.** Mardi 12 h 52, objectif 20 mm partout, aucune pluie
   prévue, 79,2 m³ à planifier, réserve à 30 m³, forage 0,511 m³/h, pompe
   8 m³/h. Attendu : tout est placé ; aucun créneau n'est en dehors de sa
   plage ; à aucune heure la pompe ne dépasse 8 m³/h ; la réserve ne passe
   jamais sous 0 m³ ni au-dessus de 60 ; le déficit vaut 0 ; la somme des
   volumes proposés vaut 79,2 m³ à l'arrondi près.
2. **Pluie prévue.** Même semaine, 12 mm annoncés jeudi. Attendu : les
   besoins de plein champ baissent de 12 mm (R2 à 100 %) ; les créneaux des
   planches concernées sont placés à partir de vendredi (R3) ; les tunnels,
   sous abri, ne changent pas. Vendredi matin, la réanalyse dit 2 mm :
   recalcul, les besoins remontent de 10 mm, de nouvelles propositions
   apparaissent, marquées « remplacent le calcul de jeudi ».
3. **Manque d'eau.** Réserve à 5 m³ au lieu de 30. Attendu : 72 m³ plaçables
   d'ici dimanche, 7,2 m³ de manque d'eau nommé « stock et forage
   insuffisants » ; avec les tunnels en priorité haute, ils sont servis en
   entier et les priorités normales à 90 % chacune ; le déficit affiché égale
   exactement la somme des besoins non couverts. Chaque planche reçoit sa
   part, la dernière examinée comme la première ; un matériel qui arrose aussi
   des planches sans part prend ce débordement sur la part de ses propres
   planches, jamais sur celle des autres ; la somme des volumes ne dépasse pas
   72 m³ (D-037).
4. **Restriction.** Limite journalière de 10 m³ du mardi au dimanche.
   Attendu : aucun jour ne dépasse 10 m³ réalisé et validé compris ; 60 m³
   placés, 19,2 m³ de manque nommé « limite journalière » ; les irrigations
   réelles saisies au-delà restent enregistrables et signalées, comme
   aujourd'hui.
5. **Pompe saturée.** Les quatre rampes de serre à arroser la même nuit,
   10,24 m³/h ensemble. Attendu : tunnels 1, 2 et 3 en même temps (6,4 m³/h),
   tunnel 4 à la suite ; jamais quatre à la fois ; si la plage horaire ne
   suffit plus à tout enchaîner, le manque est nommé « temps de pompage ».
6. **Arrosage partiel.** Le créneau validé du bloc 2 (14,6 mm) est arrêté à
   6 mm. Attendu : l'irrigation partielle reste telle quelle dans
   l'historique ; le calcul suivant remet 8,6 mm au besoin du bloc 2 et
   propose un créneau de 8,6 mm, en respectant l'espacement.
7. **Irrigation hors plan.** Une aspersion de 10 mm saisie « déjà réalisée »
   sur le tunnel 1. Attendu : le besoin des huit planches baisse de 10 mm ; la
   proposition en cours pour le tunnel 1 est remplacée par une proposition
   réduite ou disparaît, avec la mention de l'irrigation qui l'explique.
8. **Objectif modifié.** Jeudi, l'objectif passe de 20 à 30 mm pour le bloc
   fleurs. Attendu : la 3.3 recalcule au prorata des jours ; les propositions
   du bloc fleurs changent ; celles déjà validées sont comparées et signalées
   « à compléter », pas modifiées.
9. **Fin de semaine.** Dimanche à minuit, 4 mm restent non couverts sur
   trois planches. Attendu : ils se lisent comme déficit de la semaine dans
   les cumuls ; le calcul de lundi 06 h 30 repart de l'objectif de la nouvelle
   semaine, sans ces 4 mm (R10 à non). Dimanche dans la journée, tant qu'une
   plage horaire reste, ces 4 mm sont placés même sous la dose minimale :
   c'est l'exception du dernier jour.
10. **Matériel sans pompe.** gag1 n'a pas de pompe habituelle. Attendu : ses
    créneaux sont proposés, marqués « faisabilité hydraulique non vérifiée »,
    et ne consomment pas le budget de la pompe.
11. **Même calcul deux fois.** Sans événement entre les deux, le second
    calcul reproduit exactement le premier : aucune proposition
    « remplacée ».

### Valeurs exactes avec les réglages retenus

Calculées le 29 septembre 2026 avec les doses tranchées (aspersion 5 à 15 mm,
goutte-à-goutte 3 à 10 mm, un arrosage par jour, 24 h entre deux), pour le
scénario 1 sans pluie prévue. Elles deviennent les attendus des tests du
moteur.

| Matériel | Besoin | Créneaux attendus |
| --- | --- | --- |
| Rampe du bloc 2, 1,87 m³/h, dix planches à 20 mm (5,607 m³) | 20 mm | 15 mm = 4,205 m³ en 2 h 15, puis 5 mm = 1,402 m³ en 45 min, sur deux nuits, 24 h au moins entre les deux débuts |
| Rampe de serre du tunnel 2, 20 mm/h, huit planches de 16 m² mouillés | 20 mm | 15 mm = 1,92 m³ en 45 min, puis 5 mm = 0,64 m³ en 15 min |
| Rampe de serre du tunnel 1, 10 mm/h, 1,28 m³/h, arrosée 10 mm le mardi matin | 10 mm restants | un créneau de 10 mm = 1,28 m³ en 1 h, pas avant le mercredi (24 h) |
| gag1, 14 mm/h, quatre planches, 66 m², arrosé 14 mm le mardi matin | 6 mm restants | un créneau de 6 mm = 0,396 m³ en 26 min, pas avant le mercredi |
| gag2, 14 mm/h, deux planches, 33 m² | 20 mm | 10 mm = 0,33 m³ en 43 min, deux fois, sur deux jours |
| Toute la ferme, « La pompe » à 8 m³/h | — | à aucune heure la somme des débits engagés ne dépasse 8 m³/h : quatre rampes de bloc à la fois (7,4 m³/h), jamais cinq ; les rampes de serre des tunnels 2, 3 et 4 (7,68 m³/h) sans celle du tunnel 1 en plus |
| Réserve tampon, 60 m³, observée à 30 m³, forage 0,511 m³/h | — | le niveau projeté ne passe jamais sous 0 m³ ni au-dessus de 60 m³ ; 12,3 m³ entrent par jour |

## Notes de mise en œuvre (3.5)

Écrites à l'ouverture de la première PR du moteur, le 29 septembre 2026 au
soir, pour ce que le code a dû préciser sans le contredire.

- Le moteur vit dans `lib/domain/planning/` : `settings.ts` (R2 à R13),
  `windows.ts` (plages), `demand.ts` (ce qu'il reste à placer, par planche
  et par matériel), `supply.ts` (réserve, ressource, pompe et limite dans le
  temps), `chains.ts` (la chaîne d'eau de chaque matériel), `shortage.ts`
  (pénurie et arbitrage), `engine.ts` (le placement). Il n'importe que le
  domaine et réutilise les fonctions de la 2.7, de la 2.8, de la 3.1, de la
  3.2 et de la 3.3 sans les réécrire.
- Un **remplacement manuel** de la 3.3 est une quantité absolue à planifier ;
  le moteur en déduit lui-même ce qui est déjà planifié, sans quoi il la
  replacerait à chaque calcul. Il tient lieu d'objectif : une planche sans
  objectif mais au besoin fixé à la main est planifiable, comme la faisabilité
  3.4 la sert déjà (D-033, point ouvert 15, 9 octobre 2026).
- Les durées sont des secondes entières : un reste sous **un centième de
  millimètre** est un résidu d'arrondi, pas un déficit, et une planche qui
  reçoit 14,99 mm pour une dose de 15 est servie.
- Une plage qui passe minuit appartient au jour où elle commence : « la nuit
  de mardi » va de mardi 21 h à mercredi 8 h. Attendre une pluie prévue de
  jeudi, c'est ne rien placer avant la nuit de vendredi.
- L'espacement (R7) se compte de début à début : un jour vaut 24 heures. Le
  nombre d'arrosages par jour (R6) se compte par jour civil.
- Un créneau dont le volume est inconnu — une aspersion sur une planche sans
  passe-pied — n'est jamais proposé un jour où une limite journalière
  s'applique (`docs/wetted-surface-contract.md`) ; sans limite, il est
  proposé « non vérifié ». Un stock de réserve inconnu donne de même des
  créneaux « non vérifiés », jamais un refus.
- Une pluie prévue et l'ET0 entrent dans le niveau projeté d'une réserve qui
  reçoit la pluie ou s'évapore, comme dans la projection 3.1, jour par jour.
- **Le registre** (seconde PR, migration `0017`) : `irrigation_planning_settings`
  et son journal pour les réglages ; `irrigation_plan_calculations`, un par
  calcul, avec ses hypothèses, ses réglages et son résumé — planches,
  déficits, budgets — ; `irrigation_plan_proposals`, une par créneau, avec
  son statut. Un calcul marque « remplacées » les propositions encore
  proposées du calcul précédent de la même semaine, en un seul lot ; une
  proposition validée ou refusée reste telle quelle, avec son calcul
  d'origine, et se lit avec le dernier calcul, datée de ce calcul d'origine
  (`calculatedAt`, lu par jointure). « Expirée » ne s'écrit pas : une
  proposition jamais décidée dont le créneau est passé se lit ainsi.
- **Le service** assemble ce que les sous-tranches précédentes savent — les
  irrigations de la semaine toutes saisons confondues, la météo sans
  actualisation, l'infrastructure d'eau, les pompes, le matériel positionné,
  les limites, les réglages, le calcul précédent pour le report, l'arbitrage
  3.4 validé par la faisabilité — et n'écrit que le calcul.
- Une irrigation validée dont le début est passé sans avoir été démarrée ne
  compte, dans le besoin de la 3.3, que pour sa part restante : c'est la règle
  existante de l'eau planifiée. L'espacement (R7) vaut dans les deux sens : un
  créneau ne se place pas à moins de 24 h d'une irrigation validée, avant
  comme après.
- **La validation** (troisième PR) emprunte le circuit de « Planifier » : le
  matériel, son réglage et sa position **tels qu'ils sont à cet instant** —
  la couverture est recalculée, et une proposition dont le matériel n'arrose
  plus les mêmes planches, ou dont le réglage appliqué a changé, est refusée
  avec « recalculez le plan » plutôt que validée sur des bases périmées —, la
  pompe vérifiée par la 3.2, la limite journalière vérifiée par la 2.8, un
  volume inconnu sous limite refusé. L'irrigation planifiée créée porte en
  note le calcul et la proposition ; le registre retient son identifiant.
  Une proposition expirée, remplacée, déjà décidée ou d'un autre
  propriétaire ne se valide pas, et rien n'est créé.
- **Le recalcul quotidien** suit la synchronisation météo du matin : la
  même route interne, après la météo, recalcule la semaine de chaque
  exploitation pour la saison de l'année ; un échec sur une exploitation ne
  gêne pas les autres et se journalise sans nommer personne. L'heure est
  donc celle de la météo, 06 h 15. L'ancien réglage R1, qui affichait
  « recalcul à 06:30 » sans agir, est retiré le 5 octobre 2026 (D-029) ;
  l'écran dit que le recalcul du matin suit la météo, et une heure encore
  enregistrée n'est plus lue. Si l'heure doit un jour se régler, ce sera
  avec un planificateur à lui, par une nouvelle décision.

### La portée (D-025, PR de la portée, 29 septembre 2026)

- **Commander.** Pour chaque matériel positionné, le taux le plus fort parmi
  les planches qu'il arrose est son débit nominal ; une planche *commande*
  le matériel quand son taux atteint la part R13 de ce débit. Le matériel qui
  sert une planche en premier (R12) se choisit parmi ceux qu'elle commande ;
  une planche atteinte seulement sous la part est « non planifiable » avec
  le motif « portée du matériel insuffisante », son eau comptée.
- **La dose.** Parmi les planches qui commandent le matériel et gardent un
  besoin, **la mieux arrosée** fixe la dose ; à taux égal, le besoin le plus
  élevé ou le plus faible selon R11. La dose est son besoin restant, plafonné
  par R5 ; aucune planche arrosée ne dépasse R5. Une rampe à profil tourne
  donc une fois pour son centre, et ne revient pas pour ses bords.
- **R6 et R7** ne comptent que les planches qui commandent : une proposition
  n'inscrit un départ que sur elles, et une irrigation réelle ou planifiée
  n'inscrit un départ que sur les planches arrosées à la part R13 au moins
  de son taux le plus fort. Le 1,5 mm/h qui tombe sur la première planche du
  bloc voisin ne bloque plus sa rampe.
- **Les motifs.** « Portée du matériel insuffisante » pour une planche qui ne
  commande pas, et pour une planche qui commande mais que le matériel arrose
  moins vite que sa planche de référence, une fois celle-ci servie à un reste
  sous la dose minimale près. « Sous la dose minimale : attend » pour le reste
  d'une planche de référence, jusqu'au dernier jour. « Un arrosage par jour
  et espacement » quand R6 ou R7 ne laissent aucune plage. « Plus de plage
  horaire » quand la semaine n'en a plus. « Temps de pompage » ne reste que
  pour la pompe.
- **Le niveau projeté** de la réserve sur chaque proposition se relit sur le
  plan fini, à la fin de son créneau.
- Un réglage enregistré avant R13 ne le connaît pas : il prend sa valeur de
  départ à la lecture, sans réécriture.

### La garde de la réserve (point ouvert 19, PR du 2 octobre 2026)

Écrite avant le code, après la seconde recette du 29 septembre 2026 qui a
montré la garde inopérante avec un minimum de sécurité à zéro.

- **Deux lectures du même niveau.** `ReservoirTimeline.minimumLevel`
  projette le stock observé, plus les apports, moins les prélèvements, borné
  à chaque rupture par la capacité et jamais par zéro : c'est la projection
  qui juge. `levelAt`, lu par l'écran, borne le même niveau par zéro : c'est
  la projection qui s'affiche. Le niveau de départ reste borné par zéro et
  par la capacité, un stock observé n'étant ni négatif ni au-dessus de la
  cuve.
- **Jusqu'à la fin de l'horizon.** `evaluate` juge un candidat du début de
  son créneau à dimanche minuit, prélèvements déjà placés compris : un
  créneau placé tôt dans la semaine mais tard dans le calcul ne prive plus
  un créneau déjà placé après lui. Le manque est le minimum de sécurité
  moins le point le plus bas de cette projection.
- **Décaler, raccourcir, refuser.** Quand le point le plus bas tombe dans le
  créneau du candidat, le forage peut le combler : le moteur décale le début
  à l'heure où l'apport aura comblé le manque, si elle reste dans la plage.
  Quand le point le plus bas tombe après le créneau — un prélèvement déjà
  placé plus tard manquerait d'eau —, attendre ne change rien : le candidat
  est raccourci à **la plus longue durée, en secondes entières, que la
  réserve accepte**, trouvée par bissection, puisque le niveau projeté monte
  quand le prélèvement baisse ; sous la durée minimale, il est refusé
  (« réserve au minimum de sécurité au moment voulu ») et le jour suivant
  est essayé. Le raccourcissement au prorata du manque, qui ignorait
  l'apport pendant le créneau, est abandonné.
- **Une réserve déjà engagée sous son minimum** — par des irrigations
  planifiées à la main, ou validées avant la correction — refuse tout
  nouveau créneau, avec le même motif : le moteur n'ajoute pas d'eau à un
  manque, il l'annonce.
- **Le test d'invariant** (`tests/planning-engine.test.ts`) rejoue chaque
  plan sur la projection qui juge, non bornée par zéro ; un test sur les
  chiffres de la ferme — 30 m³, 0,511 m³/h, minimum 0, une première nuit
  qui demande plus que la réserve n'a — échouait avant la correction.

### Le budget de temps du calcul (D-027, PR du 4 octobre 2026)

Le calcul d'une semaine complète sur une ferme de la taille de la ferme
réelle, cent trente planches et plus, doit tenir dans un budget de 500 ms de
temps réel (D-031, 8 octobre 2026 ; 2 000 ms de D-027 jusque-là), constante
nommée du test de performance (`tests/planning-engine.test.ts`). Ce budget
est une garde contre une régression de complexité du moteur : une régression
de l'ordre de celle corrigée le 5 octobre 2026 le déclenche. Il ne mesure pas
le confort du maraîcher, qui se juge en recette sur le site. Le 4 octobre, le
calcul durait 580 à 650 ms sur le poste du porteur et environ 1,6 fois plus
sur les machines partagées de GitHub ; l'objectif d'une seconde, celui du
moteur (point ouvert 28, allègement de `minimumLevel`), est atteint depuis.
La limite ne redescend que par une décision.

Profil du 5 octobre 2026 au soir (point 28) : 73 % du temps du calcul dans
`minimumLevel`, et presque tout ce temps à construire un formateur
`Intl.DateTimeFormat` neuf à chaque rupture de la projection —
`localDateStartUtc` et `dateKeyInTimeZone` —, un formateur neuf coûtant
près de vingt fois sa réutilisation. `lib/domain/water-management.ts` en
construit désormais un par fuseau et par usage, une fois ; `minimumLevel`
ne change pas. Le calcul de la grande ferme passe de 788 à 1 052 ms à 209 à
237 ms sur le poste du porteur, pour le même plan. Sur la machine de la CI,
le job « Application » de la PR #138 a mesuré 101 ms le 5 octobre 2026 au
soir ; D-031 a ramené le budget à 500 ms le 8 octobre 2026.

### Les refus (D-030, 5 octobre 2026 ; moteur du 30 octobre 2026, 3.7)

Le moteur lit les refus de la semaine (point ouvert 31, première PR de la
3.7 ; `docs/replanning-contract.md`, règles 1 à 3). Le service passe au
moteur les créneaux refusés de la semaine du plan — chaque proposition
refusée, de n'importe quel calcul de la semaine, par son matériel, son début
et sa fin (`refusedSlots`) ; le registre étant lu par semaine, le lundi
repart sans eux. Le placement les évite comme il respecte une plage horaire
(R8) : les plages du matériel sont découpées autour de chaque refus qui les
recouvre, même en partie (`lib/domain/planning/refusals.ts`), et le créneau
se place dans ce qui reste — à la minute ronde après un refus, ou coupé
avant lui si la dose minimale y tient ; le besoin reste entier et se place
ailleurs, à une autre heure ou un autre jour, ou se lit « non placé ». La
justification le dit : « après un créneau refusé » pour le moment, « ce qui
tient avant un créneau refusé » pour la dose, « créneau refusé évité » comme
contrainte limitante. Une planche qui reste non placée parce que ses seuls
créneaux possibles ont été refusés le dit avec le motif « créneau refusé » ;
quand une autre contrainte aurait suffi à l'empêcher — espacement, plage,
eau —, c'est elle qui est nommée, comme avant. Les tests
(`tests/planning-refusals.test.ts`, `tests/db/planning-service.test.ts`)
rejouent le cas de la rampe du tunnel 4, refusée mardi 22 h 30 – 23 h 00 :
placée à 23 h le même soir, jamais sur ces heures, la dose inchangée. Le
point 31 se ferme après recette sur le site.

### La part réservée (D-037, PR du 9 octobre 2026)

Le registre des parts vit dans `lib/domain/planning/shares.ts` : un par chaîne
d'eau au budget fini, construit par `applyShortage` avec les cibles de la
conduite. Chaque planche y a sa part en m³, sa cible au prix de la surface que
son matériel mouille ; l'eau non attribuée est le budget moins les parts. Le
placement (`engine.ts`) borne chaque créneau à ce que ses parts paient : la
plus longue durée, par bissection, telle que le volume du créneau ne dépasse
pas les parts restantes des planches servies, plus l'eau non attribuée, plus
ce que les autres planches arrosées paient de leur part pour l'eau qu'elles
reçoivent utilement. La borne vient après la limite journalière et avant la
garde de la réserve, qui restent vérifiées ; la coupe porte le motif de dose
`reserved-share`, sauf quand elle ne retire qu'une seconde d'arrondi, moins
d'un centième de millimètre à la planche de référence. Sous la dose minimale,
le matériel est arrêté avec le motif de la coupe de la chaîne et marqué pour
repartir si sa part grandit, sauf sur la plage du dernier jour, où sa part
est placée telle qu'elle est (« La part du dernier jour », plus bas).

À l'imputation, chaque planche arrosée paie l'eau utile reçue au prix de son
matériel, jusqu'à sa part ; le reste du volume est pris sur l'eau non
attribuée, puis réparti entre les planches servies au prorata de l'eau reçue,
chacune jusqu'à sa part. À la fin d'un tour, les parts restantes, hors un
résidu d'arrondi sous un centième de millimètre, sont libérées et
redistribuées par la conduite — niveau par niveau, part égale, ou dans l'ordre
du report — aux planches encore sous leur besoin dont le matériel n'est pas
arrêté pour une autre raison que la part ; leur cible et leur part montent, le
motif de la coupe tombe quand la cible rejoint le besoin ; `MAX_SHARE_ROUNDS`
borne les tours à quatre. Les fractions du budget restent celles du départ.
Deux limites vues en chemin et laissées telles quelles, tranchées par le
porteur le 30 octobre 2026 (D-052) : l'arbitrage 3.4 validé, dont les
allocations sont devenues des parts réservées à la 3.9 (note suivante) ; le
budget d'une chaîne, qui compte les apports jusqu'à dimanche minuit, même
après la dernière plage, et comptait zéro, non le manque, quand le stock est
sous le minimum de sécurité : il retire le manque depuis la décision 2 de la
3.9 (« Le budget net du manque sous le minimum », plus bas) ; les apports
d'après la dernière plage restent comptés, et la part placée montre ce
qu'ils n'ont pas servi.

### L'arbitrage en parts réservées (3.9, décision 1, D-052, 8 novembre 2026)

`applyShortage` regroupe les planches par chaîne comme pour la conduite ; sous
un arbitrage validé, la cible de chaque planche allouée reste son allocation
bornée à son besoin. Chaque chaîne au budget fini qui porte une planche
allouée a son registre des parts, construit avec les seules planches
allouées : leur part est leur cible, l'eau non attribuée le budget moins les
parts. Quand les parts dépassent le budget, chaque cible de la chaîne est
multipliée par le rapport du budget aux parts, et le motif de la chaîne
s'ajoute aux planches ainsi réduites ; le motif de coupe du registre est
alors celui de la chaîne, `water-budget` sinon. Tout le matériel des planches
de la chaîne est borné par ce registre : celui d'une planche que l'arbitrage
ne nomme pas ne prend que l'eau non attribuée et ce que les planches allouées
qu'il arrose paient de leur part pour l'eau utile reçue. Le registre est sans
conduite (`strategy: null`) : `redistribute` ne libère rien et rend faux, le
placement s'arrête après un tour. Aucune ligne de budget n'est rendue.

Le plan porte alors `arbitration` (`PlanArbitration`, absent sans arbitrage :
un plan sans arbitrage reste celui d'avant) : `allocatedCubicMeters`, les
allocations bornées aux besoins ; `reservedCubicMeters`, les parts après
réduction ; `unreceivedCubicMeters` et `unreceivedBedCount`, ce que les
planches allouées n'ont pas reçu de leur part, hors un reste sous un centième
de millimètre, que le moteur tient pour reçu (D-040). La note
(`arbitrationNote`, sous les cartes du résumé) dit « Votre choix entre les
demandes d’eau s’impose : X m³ alloués, chaque allocation réservée à sa
planche. » ; puis, quand les parts sont réduites de plus d'un litre, « Le
moteur ne peut en placer que Y m³ d’ici dimanche : chaque allocation est
réduite dans la même proportion. » ; puis, quand le non-reçu dépasse un litre,
« Z m³ alloués à n planches ne peuvent pas être reçus : ils restent non
attribués, sans redistribution entre planches. » La note du manque d'eau
(D-038) reste absente sous arbitrage, faute de budget.

### Le budget net du manque sous le minimum (3.9, décision 2, D-052, 8 novembre 2026)

`ReservoirTimeline.budgetCubicMeters()` part du stock observé, borné à la
capacité, moins le minimum de sécurité, sans le borner par zéro : négatif
quand le stock est sous son minimum. Il ajoute les apports de chaque jour
jusqu'à la fin de l'horizon, retire les prélèvements déjà planifiés, et ne
borne par zéro que le total. Un stock au-dessus de son minimum donne le
budget d'avant, au millilitre.

Chaque `SupplyBudget` porte, à côté de `fractions` (les parts visées),
`demandByLevelCubicMeters`, la demande de chaque niveau, et
`placedByLevelCubicMeters`, l'eau utile placée sur les planches du niveau,
comptées sur la surface du propre matériel de chaque planche ; `placedBudgets`
(`shortage.ts`) les remplit sur le plan fini, avec les planches de chaque
chaîne qu'`applyShortage` a regroupées, pour que le regroupement reste à un
seul endroit. La part placée d'un niveau est le rapport des deux ; un niveau sans demande n'a ni part visée
ni part placée. Sous le report, `applyShortage` pose la fraction de chaque
niveau à la part de sa demande servie au départ, les planches reportées à
zéro ; elle restait à 1. `budgetLevelsText` (`presentation.ts`) écrit la ligne :
« haute — · normale 73 % visés, 73 % placés · basse — ». Un calcul enregistré
avant la correction, sans ces deux champs, garde sa ligne d'avant, les seules
fractions.

### Le report sans bascule (3.9, décision 4, D-052, 8 novembre 2026)

Sous le report, `applyShortage` sert d'abord les planches de **la file**
(`PlanningInputs.deferredBedIds`), puis les autres dans l'ordre de service
— priorité, déficit relatif, inventaire —, jusqu'à épuisement du budget. Le
plan retient la file qu'il a suivie (`WeeklyPlan.deferredQueue`, enregistrée
avec le calcul, absente quand elle est vide).

`nextDeferredQueue` (`shortage.ts`) choisit la file d'un calcul à partir du
calcul précédent de la semaine :

- **après un événement**, la file devient les planches que le calcul
  précédent a reportées : elles passent devant ;
- **sans événement**, la file reste celle du calcul précédent, et le calcul
  reproduit son plan, y compris après un calcul où la file avait avancé ;
- au premier calcul de la semaine, la file est vide ; après un calcul
  enregistré avant la correction, qui ne l'a pas retenue, aussi.

« Un événement », c'est un événement de la règle 4 du contrat de la 3.7,
inscrit au registre des événements (`irrigation_plan_events`) après le
calcul précédent et dont le recalcul n'a pas encore abouti : le service le
lit dans `pendingEvent` du plan précédent. C'est le cas du recalcul sur
événement lui-même, dont l'événement reste « en cours » pendant le calcul,
et d'un calcul à la main ou du matin qui suit un recalcul échoué. Un
événement déjà recalculé l'a été par le calcul précédent : il ne fait pas
avancer la file une seconde fois. Ne sont pas des événements, comme pour le
recalcul (règle 5) : un réglage du planning, la météo du matin, le passage
du temps, ni un changement des fonctionnalités, qui ne passe pas par le
registre. Le calcul du matin, sans événement depuis le précédent, garde
donc la file ; ses chiffres peuvent changer avec la prévision et les
besoins du jour, pas l'ordre de la file.

Le motif d'une planche reportée dit quand elle passe : « reportée : passe
en tête après le prochain événement (conduite « report ») ». Dans la liste
« Planches non servies », leur groupe s'appelle « Reportées jusqu'au
prochain événement », avec la phrase « Elles passent en tête au calcul qui
suit un événement : un arrosage validé ou fait, de l'eau nouvelle, un stock
corrigé. Recalculer sans événement ne change pas leur tour. » « Au prochain
calcul » promettait ce que le calcul sans événement ne fait plus.

### La part du dernier jour (3.9, décision 5, D-052, 8 novembre 2026)

La borne des parts (`engine.ts`, « La part réservée » plus haut) arrêtait le
matériel dès que ce que ses parts paient tombait sous la dose minimale, quel
que soit le jour. Elle tient maintenant compte de **la plage du dernier
jour** de la semaine, celle qui commence le dimanche (`interval.dateKey`,
comme toute plage : la nuit de dimanche pour l'aspersion, la journée de
dimanche pour le goutte-à-goutte) : sur cette plage, le créneau accepte
toute durée jusqu'à la seconde, comme l'exception du dernier jour le fait
pour un reste sous la dose minimale (`last-day-below-minimum`, une seconde
au moins). La garde de la réserve et la ressource directe, qui viennent
après la borne, peuvent encore raccourcir ce créneau, jusqu'à la seconde
elles aussi : quelques secondes retirées par la réserve ne refusent pas un
créneau que la part accepte.

- **Avant le dernier jour**, rien ne change : le matériel s'arrête à sa
  première plage, la coupe ne dépendant pas du jour, et attend une part plus
  grande. Un calcul de mercredi ou de samedi ne place donc pas sur dimanche
  une part sous la dose minimale ; le calcul de dimanche la place, comme un
  reste hors pénurie sous la dose minimale, qui attend le samedi (test
  « dernier jour » du moteur).
- **La part placée** est celle que les parts de ses planches paient quand le
  matériel est examiné, débordement compris : sur la plage du dimanche, le
  matériel n'attend plus la redistribution de fin de tour, comme l'exception
  du dernier jour place déjà sans attendre une part elle-même sous la dose
  minimale. Attendre la faisait fondre, l'eau libérée allant aussi à des
  planches qui ne peuvent plus rien recevoir le dimanche, et laissait de
  l'eau dans la réserve. Une part qu'une redistribution aurait agrandie est
  donc placée telle qu'elle est : la décision fait passer l'exception avant
  l'attente.
- **Le motif** reste celui de la borne (S15) : la dose dit « la part de la
  semaine réservée à ses planches », la contrainte limitante « part de la
  semaine atteinte, le reste est réservé aux autres planches ». Un créneau
  que la borne ne coupe pas, sa planche de référence ayant une cible déjà
  sous la dose minimale, garde « le reste de la semaine, sous la dose
  minimale : c'est le dernier jour ».
- **Sous un arbitrage validé**, le chemin est le même : une allocation que
  son débordement fait passer sous la dose minimale est placée le dimanche,
  au lieu de rester non attribuée.
- **Ne changent pas** : la limite journalière, la pompe, la plage horaire et
  les créneaux refusés ou protégés gardent la dose minimale, comme pour un
  reste qui l'atteint hors pénurie ; la somme des volumes d'une chaîne ne
  dépasse jamais son budget.

Exemple, la ferme du point 36 à 26 % de sa demande (S18,
`tests/planning-shortage.test.ts`) : 5,2 mm de part partout ; les rampes du
tunnel 1 et du bloc 2 versent aussi sur le bloc 1, et leurs parts ne paient
plus que 4,80 et 4,92 mm, sous les 5 mm de l'aspersion. Mardi et samedi,
elles attendent, comme avant. Le dimanche à 0 h 30, elles ne partaient
qu'après les tours, à 2,3 mm, et 1,1 m³ restait dans la réserve ; elles
partent dimanche soir à 4,80 et 4,92 mm, et la somme des volumes est le
budget. Sous un arbitrage de 5,2 mm par planche, réserve égale aux
allocations, 2,12 m³ alloués à dix-huit planches restaient non attribués le
dimanche ; il n'en reste rien.

## Notes de mise en œuvre (3.6)

Écrites à l'ouverture de la PR de l'interface, le 29 septembre 2026, pour ce
que le code a dû préciser sans contredire la section « Interface ».

- La présentation pure vit dans `lib/domain/planning/presentation.ts` : les
  libellés des statuts, des motifs de dose, de moment et de non-placement ;
  la semaine en jours (`planDays`), le résumé (`summarizePlan`), les planches
  non servies (`unplacedBeds`) ; l'ajustement d'une proposition
  (`adjustProposalTiming`) ; le formulaire des réglages dans les deux sens
  (`planningSettingsForm`, `settingsFromForm`) et son résumé d'une ligne.
  Les composants de `app/irrigation/planning/` n'ont que de l'affichage.
- **La note du manque d'eau** (`waterDeficitExplanation`, D-038) se calcule
  sur le plan enregistré : demandé, la somme des demandes du budget par
  chaîne ; placé, le volume des créneaux du calcul, tous statuts ; manque
  chiffré, la somme des manques par motif. L'eau placée sans couvrir de besoin
  compté vaut placé moins (demandé moins manque chiffré) ; le manque pour une
  autre raison que l'eau vaut manque chiffré moins manque d'eau. La note ne
  paraît que si l'eau placée à côté, en plus ou en moins, dépasse le résidu
  d'arrondi des secondes — un centième de millimètre par planche et par
  créneau qui l'arrose, au prix de la surface mouillée de l'application, et au
  moins un litre —, ou si le manque pour une autre raison dépasse un litre ;
  jamais quand un volume est inconnu ni quand le budget est absent
  (arbitrage). Le moteur coupe chaque créneau à la seconde entière et tient
  pour reçu un reste sous un centième de millimètre : l'écart qui en vient n'a
  pas de cause à nommer (D-040, point ouvert 41).
- **Un ajustement** ne change ni le matériel, ni le réglage, ni les planches :
  la durée vaut celle de la proposition multipliée par le rapport des doses,
  arrondie à la seconde ; la fin vaut le début plus la durée ; les apports
  par planche découlent de la durée par les taux du réglage, comme pour toute
  irrigation planifiée. Le service de validation reçoit l'ajustement, le
  vérifie — dose strictement positive, créneau pas déjà terminé, fin au
  plus tard dimanche minuit à la ferme — puis passe les mêmes gardes qu'une
  validation sans ajustement ; la note de l'irrigation dit « ajustée ».
- Les statuts se lisent avec l'heure de l'écran : une proposition jamais
  décidée dont le créneau est passé s'affiche « expirée », comme le registre
  la lit (`effectiveProposalStatus`).
- La page sert le dernier plan enregistré et les réglages avec le reste de
  ses données : l'écran s'affiche sans calcul, et « Calculer » n'est qu'un
  bouton. L'écran ne recalcule jamais de lui-même.
- « Ajouter un créneau de sa main » envoie le maraîcher au formulaire
  « Planifier » de la 2.7, qui s'ouvre sur l'onglet voulu.
- Le parcours navigateur P10 traverse l'écran aux deux largeurs sur la ferme
  de démonstration : réglage de la plage horaire, calcul, lecture d'une
  justification, validation d'une proposition qui paraît dans les irrigations
  à venir, ajustement, refus, liste « Non placé », puis remise en état. Ce
  qu'il ne prouve pas : la lecture agronomique d'un vrai plan sur la ferme,
  qui reste la recette réelle du moteur (3.5), à faire avec cet écran.

### Les durées du recalcul (point ouvert 34, PR du 9 octobre 2026)

Le temps d'un recalcul à la demande sur le site variait de 3 s à plus de 45 s
pour le même état (quatrième recette réelle, 5 octobre 2026), quand le moteur
seul tient la semaine sous la seconde. Mesure décidée par le porteur le 9
octobre 2026, avant toute piste moteur : des journaux de durée côté serveur,
lus par lui dans les journaux Cloudflare du Worker (`docs/publication.md`,
« Lire les journaux du Worker »).

- **Chaque calcul de la semaine** écrit une ligne JSON
  `planning_calculation_completed` (`lib/services/planning-service.ts`) :
  `trigger` (`manual`, `daily` ou `event`), `season`, `weekStart`,
  `snapshotSource` (`cache` ou `live`), `beds` et `proposals` (des nombres),
  `durationsMs` par phase — `snapshot`, la lecture de l'instantané, mesurée
  par l'appelant qui la fait, l'action « Calculer » ou le recalcul du matin ;
  `inputs`, les lectures D1 et le tableau de l'eau ; `needs`, le tableau des
  besoins ; `arbitration`, la faisabilité, seulement sous un arbitrage
  validé ; `engine`, le moteur ; `save`, l'enregistrement ; `reread`, la
  relecture du plan enregistré —, `totalMs` et `completedAt`.
- **Chaque affichage de la page** écrit une ligne `irrigation_page_loaded`
  (`app/irrigation/page.tsx`) : `season`, `snapshotSource`, `forceRefresh`,
  `durationsMs` — `snapshotAndLists`, l'instantané avec le matériel, les
  emplacements et les irrigations ; `dashboards`, l'eau, les ressources, les
  pompes, l'historique, le plan et les réglages ; `needs` —, `totalMs` et
  `loadedAt`. Après « Calculer », la page se recalcule dans la même requête :
  les deux lignes se lisent dans la même invocation, et leur somme est le
  temps serveur du clic.
- **Les durées** sont des millisecondes entières, lues au chronomètre de
  `lib/adapters/stopwatch.ts`, dont l'horloge est injectable pour les tests.
  Dans un Worker Cloudflare, l'horloge n'avance qu'aux entrées-sorties (modèle
  de sécurité des Workers) : une phase de calcul pur, le moteur, mesure 0 ms
  et son temps se reporte sur la phase suivante ; le calcul réel se lit dans
  le temps CPU de l'invocation, que les journaux Cloudflare donnent à part.
- **Aucune ligne** ne porte d'identifiant de personne, de nom de planche, de
  jeton ni de cookie : des nombres, des dates et des noms de phase. Cloudflare
  conserve les journaux sept jours.
- **Ce que la mesure ne dit pas** : le temps du réseau entre le navigateur et
  le Worker, et le rendu du navigateur. La recette compare la montre, depuis
  le navigateur, au total serveur ; l'écart est le réseau et le rendu. La
  phase la plus longue nomme le coupable ; une phase qui varie d'une fois à
  l'autre pour le même plan désigne l'extérieur — lecture OTF, base D1, isolat
  froid.

### Le recalcul sur événement (3.7, PR du 30 octobre 2026)

Le contrat est `docs/replanning-contract.md`, règles 4 à 10. Ce que le code
en fait :

- **L'appel.** Chaque action serveur qui enregistre un événement de la règle
  4 appelle `recalculatePlanAfterEvent` (`lib/services/planning-recalculation.ts`)
  après l'écriture, avec le nom de l'événement, sa saison et l'instant qu'il
  concerne : le début de l'irrigation, le jour de la pluie, la semaine de
  l'objectif, la date de pose. Un événement d'une autre semaine que la
  courante ne fait rien (règle 5) ; un événement durable — limite, objectif,
  seuil, décision de planche, arbitrage, pose, retrait, réglage, niveau
  observé, débit — compte dès qu'il n'est pas à venir. La pause et la reprise
  du minuteur, les réglages du planning et la météo n'appellent pas.
- **L'événement d'abord** (règle 6). L'action a déjà écrit quand le service
  est appelé, et le service ne lève jamais. Il inscrit l'événement dans
  `irrigation_plan_events` (migration 0019 : nom, saison, semaine, heure,
  sort du recalcul ; aucun identifiant de personne), puis confie le calcul à
  `waitUntil` de `cloudflare:workers` : le Worker l'exécute après avoir
  répondu au maraîcher. Hors Worker — tests, serveur Node —, le calcul se
  fait avant la réponse, borné par son budget de temps (D-027). Le calcul
  abouti marque l'événement « recalculé » avec le calcul produit ; un échec
  le marque « échoué » et écrit une ligne `planning_event_recalculation_failed`
  (nom de l'événement, saison, semaine, message, heure), et l'écran lit
  « Plan antérieur à : …, le … — le recalcul a échoué, recalculez. ».
- **Le déclencheur nommé** (règle 7). Le calcul retient `trigger_event`
  (migration 0019) et l'en-tête dit « calculé le … (après la pluie saisie au
  pluviomètre) » ; la ligne `planning_calculation_completed` porte
  `triggerEvent`.
- **L'identité** (règle 10). À l'enregistrement d'un calcul, les propositions
  encore proposées de la semaine sont d'abord toutes marquées « remplacées »,
  puis celles que le calcul reproduit — même matériel, même réglage, même
  début, même fin, même dose — reprennent leur ligne : même identifiant de
  registre, « proposée », rattachées au nouveau calcul avec son numéro
  `p-N`, sa justification, son volume et sa pompe. Une carte restée ouverte
  pendant un recalcul se valide donc par son identifiant tant que sa
  proposition n'a pas changé ; son numéro suit le dernier calcul. Seules les
  propositions qui changent restent « remplacées ». Deux calculs sans
  événement entre eux ne remplacent rien (règle 9).
- **Deux calculs croisés** (règle 8). Chaque écriture de l'enregistrement est
  conditionnée à l'absence d'un calcul plus récent déjà enregistré pour la
  semaine : un calcul du matin qui s'enregistrerait après un recalcul sur
  événement plus récent ne laisse rien, et sa relecture rend le plan en
  vigueur. À la même milliseconde, le dernier enregistré fait foi
  (`docs/revision-order-contract.md`).
- **L'écran.** Après un signal d'événement — les trois événements de fenêtre
  des sections et le canal entre onglets —, la section « Planning » relit le
  plan à intervalles croissants, 1 s puis 2, 3, 5, 8 et 10 s, jusqu'à ce
  qu'un nouveau calcul paraisse, que le recalcul ait échoué ou qu'aucun ne
  soit en cours, puis s'arrête ; rien ne tourne onglet caché, le retour de
  l'onglet relit le plan comme avant. L'avis « Plan antérieur à … » se lit
  entre l'en-tête et le résumé. La carte d'une proposition porte son
  identifiant de registre (`data-proposal-id`) : c'est par lui que le
  parcours P10 la retrouve à travers un recalcul.
- **Hors périmètre de cette PR** : les suggestions sur les arrosages
  validés, « Ce qui a changé », le retard et les notifications (suite du
  découpage de la 3.7).

### Les suggestions sur les arrosages validés (3.7, PR du 31 octobre 2026)

Le contrat est `docs/replanning-contract.md`, règles 11 à 17. Ce que le code
en fait, dans `lib/domain/planning/suggestions.ts`, fonction pure appelée par
le moteur à chaque calcul, sur les mêmes entrées :

- **Jamais modifiés** (règle 11). Un arrosage validé compte comme avant dans
  les besoins, l'eau, la pompe et la limite ; le moteur n'y touche pas, il
  suggère, et la suggestion vit dans le résumé du calcul (`suggestions`,
  `overcommittedDays`), relue avec lui. Les calculs antérieurs à cette PR se
  relisent avec des listes vides.
- **Les arrosages examinés** (règle 12) : les irrigations planifiées de la
  semaine, non démarrées, dont le début est après le calcul et avant dimanche
  minuit, dans l'ordre du temps puis de leur identifiant. Une irrigation en
  cours n'en est pas ; une irrigation en retard non plus, le retard a sa
  propre règle (suite de la 3.7). Les planches et les taux sont ceux de
  l'irrigation, pas ceux de la couverture du jour.
- **La dose utile** (règle 12). Pour chaque arrosage, le besoin d'avant lui
  de chaque planche qu'il commande (R13) repart des termes de la 3.3 —
  objectif ou besoin posé à la main, pluie au pluviomètre, part R2 de la
  pluie prévue, irrigation réelle, irrigations planifiées — en retirant du
  planifié cet arrosage et ceux qui le suivent (`remainingNeedExcludingMm`,
  `lib/domain/planning/demand.ts`) ; le planifié retiré est exactement ce que
  la 3.3 avait déduit pour lui. La planche de référence est la mieux arrosée
  parmi celles qui ont encore un besoin, à taux égal celle du besoin le plus
  élevé ou le plus faible (R11) ; la dose utile est son besoin d'avant,
  plafonné par la dose maximale (R5), aucune planche ne recevant plus que le
  maximum. Une planche sans besoin calculable — sans objectif, ou hors de la
  saison — ne compte pas ; si aucune planche ne l'a, rien n'est suggéré.
- **« Annuler »** (règle 13) sous la dose minimale (R4), zéro compris ; le
  dernier jour de la semaine, qui tolère une dose sous le minimum, n'annule
  que ce qui ne sert plus à rien. **« Réduire à X mm »** (règle 14) quand la
  dose prévue de la planche de référence dépasse la dose utile d'au moins la
  dose minimale : X est la dose utile, la durée suit au prorata, la fin suit
  le début, comme un ajustement 3.6. Un écart plus petit ne suggère rien.
  **Jamais allonger** (règle 15) : un arrosage devenu insuffisant garde sa
  dose, le reste du besoin se place par une proposition ordinaire.
- **Ce qui ne peut plus se faire** (règle 16). Les irrigations planifiées
  que la 2.11 empêche de démarrer — matériel stocké, ou reposé ailleurs
  (D-044) — ne comptent pas dans les calculs ; le service les lit à part
  (`blockedIrrigations`, `partitionIrrigationEventsForUser`) et le moteur
  suggère « Annuler » avec le matériel et, s'il est stocké, la date du
  retrait ; reposé au même endroit, l'irrigation compte de nouveau et la
  suggestion disparaît. Une limite journalière posée après coup : quand ce
  qu'un jour porte — réalisé, en cours, validé — dépasse sa limite, le jour
  est signalé (`overcommittedDays`) et les arrosages validés à venir de ce
  jour sont réduits jusqu'à la limite en suivant R9 à l'envers : la priorité
  haute est servie d'abord, puis la normale, puis la basse ; dans le niveau
  entamé, chaque arrosage garde la même fraction de sa dose, la plus grande
  qui tienne sous la limite, cherchée par bissection sur les volumes du jour,
  à la seconde inférieure ; une réduction sous la dose minimale devient
  « Annuler » et les autres se recalculent sans elle. Un arrosage dont le
  volume ne peut pas être vérifié — une planche sans passe-pied — est signalé
  à part, « Annuler » ou renseigner le passe-pied dans Ouvre ta ferme.
- **Une suggestion par arrosage.** Quand deux règles visent le même arrosage,
  la plus forte reste — « Annuler » avant « Réduire », la dose la plus basse
  entre deux réductions — et leurs raisons s'ajoutent.
- **Ce sur quoi elle repose** (règle 17). Chaque suggestion porte ses
  raisons : les termes du besoin de la planche de référence — objectif,
  pluie, pluie prévue déduite, arrosé, arrosages validés d'avant, besoin
  d'avant, dose utile, dose prévue, dose minimale —, le matériel et la date
  du retrait, la limite et ce que le jour porte, ou le volume invérifiable.
  L'heure de saisie d'une pluie n'est pas une entrée du moteur : l'en-tête
  du plan nomme déjà l'événement qui a déclenché le calcul.
- **« Garder »** (règle 17) : la table `irrigation_plan_suggestion_keeps`
  (migration 0020) retient, par irrigation planifiée de l'exploitation, la
  suggestion tue avec sa dose ; le plan relu marque `kept` toute suggestion de
  même nature et de même dose au dixième de millimètre affiché — elle ne
  revient que pour une autre dose, ou « Annuler » après « Réduire ». Garder
  n'est pas un événement : rien ne se recalcule.
- **Déterminisme** (règle 9) : mêmes entrées, mêmes suggestions ; elles
  s'enregistrent avec le calcul et ne dépendent d'aucune horloge.
- **Hors périmètre de cette PR** : l'écran — les boutons « Appliquer » et
  « Garder », leur action serveur et les libellés —, « Ce qui a changé », le
  retard et les notifications (suite du découpage de la 3.7).

### Ce qui a changé (3.7, PR du 31 octobre 2026)

Le contrat est `docs/replanning-contract.md`, règle 25. Ce que le code en
fait, dans `lib/domain/planning/changes.ts`, fonction pure que le service
appelle après le moteur, sur le dernier plan enregistré de la semaine et le
nouveau, et dont il enregistre le résultat dans le résumé du calcul
(`changes`) ; nul au premier calcul de la semaine, et pour les calculs
antérieurs à cette PR, qui se relisent sans réécriture :

- **Le calcul comparé** : le précédent de la même semaine, par son
  identifiant et son heure — « depuis le calcul de 6 h 15 ». Deux calculs
  sans événement entre eux ne listent rien (règle 9).
- **Les propositions**. Seules les propositions encore proposées du calcul
  précédent se comparent : une validée est devenue un arrosage, une refusée
  ne revient pas (D-030), une expirée ne peut plus l'être — le maraîcher en a
  décidé, le moteur n'y a rien changé. Les propositions d'avant et d'après
  s'apparient par matériel et réglage, la plus proche en heure d'abord,
  chaque ancienne ne servant qu'une fois. Une paire aux mêmes heures et à la
  même dose n'a pas changé — c'est celle que le registre reproduit à
  l'identique (règle 10) — et n'est pas listée. Autrement : **déplacée**
  quand ses heures changent, **de dose changée** quand sa dose de référence
  change au dixième de millimètre, les deux à la fois quand les deux
  changent ; sans paire, **apparue** ou **retirée**. Chaque ligne porte le
  créneau d'avant, celui d'après, les planches arrosées et, pour une
  proposition du nouveau calcul, son numéro, celui de sa carte. L'ordre est
  celui du temps, puis du matériel.
- **Les suggestions nouvelles** : celles que le calcul précédent ne faisait
  pas sur le même arrosage — même irrigation planifiée, même nature et, pour
  « Réduire », même dose au dixième de millimètre. Une suggestion qui change
  de dose, ou qui passe de « Réduire » à « Annuler », est nouvelle, comme
  pour « Garder » (règle 17).
- **Les planches** : celles entrées dans « Non placé » et celles qui en sont
  sorties, servies désormais ou sans besoin. « Non placé » se lit d'une seule
  règle, celle de l'écran (`isBedUnplaced`) : un manque d'eau, ou rien de
  placé avec un motif. Par nom de planche.
- **L'écart du manque d'eau** : le manque d'eau de la semaine (m³) du calcul
  précédent et celui du nouveau ; l'écart se lit de l'un à l'autre, dans les
  deux sens.
- **Une lecture** : rien n'y est modifiable, rien ici ne place un créneau,
  et la comparaison ne dépend d'aucune horloge. Son pli à l'écran est la PR
  de l'écran (suite du découpage de la 3.7).

### Le retard (3.7, PR du 31 octobre 2026)

Le contrat est `docs/replanning-contract.md`, règles 18 à 20 (D-051,
décision 4). Ce que le code en fait :

- **Le réglage R14** (`lateToleranceMinutes`, 30 minutes au départ, entier
  de 0 à 1440) vit avec les autres réglages du planning, par exploitation,
  avec leur historique, et se règle dans le pli « Réglages du planning »
  (fieldset « Suivi des arrosages »). Un réglage enregistré avant son arrivée
  se lit avec 30, sans réécriture (`parseSettings`), comme R13 avant lui.
- **Le signal** (`plannedIrrigationLateness`, `lib/domain/planned-irrigation.ts`) :
  une irrigation planifiée — validée depuis le plan ou créée par
  « Planifier » — non démarrée est « en retard » dès que l'heure courante
  atteint son début plus la tolérance, et « non faite » dès que son créneau
  est entièrement passé ; rien avant, rien pour une irrigation démarrée, en
  pause, terminée, annulée, au reliquat annulé ou sans heure. Un créneau plus
  court que la tolérance passe à « non faite » sans avoir été « en retard ».
  Le signal se calcule à la lecture, à partir de l'heure courante : rien n'est
  enregistré, et le passage en retard ne lance aucun calcul.
- **Son eau** (règle 19) ne change pas : `remainingPlannedApplications`
  compte la part du créneau qui reste à venir, donc une irrigation en retard
  pour ce qui lui reste, et plus rien une fois le créneau passé ; le calcul
  suivant replace le besoin.
- **Jamais annulée par le logiciel** (règle 20) : elle se démarre encore et
  compte alors au réel, ou s'annule à la main par les gestes existants de la
  carte.
- **Hors périmètre de cette PR** : le libellé sur la carte et dans le plan,
  les notifications (PR suivante), le parcours P12.

### Les notifications (3.7, PR du 31 octobre 2026)

Deux notifications seulement, par le Worker de notification existant
(`docs/push-worker-contract.md` ; `docs/replanning-contract.md`, règles 21
à 24 ; D-051, décision 5) :

- **« Irrigation en retard »** : une irrigation planifiée — validée depuis le
  plan ou créée par « Planifier » — porte dès sa création une alarme pour son
  début plus la tolérance R14 du moment, sous la révision d'alarme déjà en
  place (colonne `late_alarm_due_at`, migration 0021) ; la modification de
  son créneau la reprogramme sous une révision plus récente, le démarrage la
  remplace par l'alarme de fin du minuteur, l'annulation la retire. Pas
  d'alarme quand elle ne servirait à rien : créneau déjà passé, ou tolérance
  qui atteint la fin du créneau — l'irrigation serait « non faite » avant
  d'être « en retard ». Les irrigations planifiées avant cette PR n'en
  portent pas ; un changement de R14 ne touche que les irrigations planifiées
  ou modifiées ensuite. Un clic ouvre l'irrigation. Sans service configuré,
  l'irrigation se planifie sans un mot ; une panne du service le dit en
  avertissement, l'irrigation étant enregistrée quoi qu'il arrive (règle 23).
- **« Suggestions du planning »** : le calcul du matin, et lui seul, quand il
  fait une suggestion sur un arrosage validé des prochaines 24 heures —
  commencé avant demain à la même heure et pas encore fini —, en envoie une
  seule qui les regroupe dans l'ordre du temps (« 2 suggestions sur vos
  arrosages des prochaines 24 heures · Annuler Rampe bloc 2 · Réduire
  Goutte-à-goutte à 8 mm ») ; les suggestions gardées se taisent ; un clic
  ouvre le planning. C'est une alarme à échéance immédiate, sous
  l'identifiant `plan:<calcul>` : une par calcul. Jamais après un calcul à la
  demande ou sur événement : le maraîcher a le plan sous les yeux (règle 22).
  Une panne se journalise (`planning_suggestion_notification_failed`, sans
  identifiant de personne) et n'altère ni le plan ni l'historique.

Le Worker ne change pas : il reçoit titre, texte, étiquette et adresse comme
pour la fin du minuteur. Tests : `tests/db/irrigation-event.test.ts`
(l'alarme de retard : création, modification, démarrage, annulation, les cas
sans alarme), `tests/db/irrigation-push-orchestration.test.ts` (les deux
alarmes, le service non configuré), `tests/planning-notifications.test.ts`
(la fenêtre de 24 heures, les textes), `tests/db/planning-notifications.test.ts`
(l'alarme du matin, les pannes) et `tests/db/planning-service.test.ts` (le
calcul du matin seul notifie).

### L'écran du suivi (3.7, PR du 31 octobre 2026)

Dans la section « Planning de la semaine », sans réorganisation
(docs/replanning-contract.md, « L'écran ») :

- **L'en-tête** nomme le déclencheur du dernier calcul — « calculé le …
  (après la pluie saisie au pluviomètre) » — et, quand un événement est
  postérieur au plan, l'avis « Plan antérieur à : … — recalcul en cours. »
  (PR du recalcul sur événement).
- **Le pli « Ce qui a changé depuis le calcul du … »**
  (`details.planning-changes`), après les cartes de résumé : le nombre de
  changements dans son titre, ou « rien » ; une ligne par changement —
  « Proposition apparue / retirée / déplacée », « Dose changée », « Suggestion
  nouvelle : annuler … » ou « réduire à X mm … », « Entrée dans « Non
  placé » : planche (jardin), manque X mm », « Sortie de « Non placé » »,
  « Manque d'eau : de A à B m³ » quand l'écart atteint cinq litres. Une
  lecture : rien n'y est modifiable.
- **Les suggestions sur les arrosages validés** (`.planning-suggestions`),
  après les budgets : chacune avec « Annuler » ou « Réduire à X mm », le
  matériel, le créneau, la dose prévue et la durée réduite ; ses raisons —
  les termes du besoin, le matériel stocké ou reposé avec sa date, la limite
  journalière du jour avec les volumes engagés, le volume invérifiable — ;
  « Appliquer » et « Garder ». « Appliquer » relit la suggestion du dernier
  calcul et passe par l'annulation ordinaire de l'irrigation planifiée ou par
  sa modification en mode durée (minutes arrondies, au moins une) ; le message
  dit ce qui a été fait ; les autres sections relisent et le plan se recalcule
  après la réponse. « Garder » enregistre la suggestion avec sa dose : elle se
  tait tant qu'un calcul n'en fait pas une autre ; les gardées sont repliées
  sous « N suggestions gardées ».
- **Le signal « en retard » ou « non faite »** sur la carte de l'irrigation
  planifiée, dans « À venir ou à terminer » (`.event-late`, `data-lateness`),
  avec son texte — « En retard : non démarrée 35 min après l'heure prévue… »,
  « Non faite : le créneau est passé sans démarrage… » — et le bouton
  « Recalculer le plan », qui demande à la section du planning un calcul à la
  demande ; R14 dans le pli « Réglages du planning » (PR du retard).
- **Les libellés** vivent dans `lib/domain/planning/follow-up.ts`, testés
  (`tests/planning-follow-up.test.ts`) ; aucune règle dans les composants.
  Lisible sur ordinateur et à 390 px sans défilement horizontal.
- **Le parcours P12** (`e2e/p12-replanification.spec.ts`,
  docs/browser-journeys-contract.md) rejoue aux deux largeurs : une pluie
  saisie et le plan recalculé seul, un refus et le besoin replacé, une limite
  posée après coup et la suggestion « Annuler » appliquée, la remise en état.

### La semaine en tableau sur grand écran (3.8, P46, 7 novembre 2026)

Retour de visite du porteur : « les jours de la semaine en colonnes […]
peut-être pas sur la version mobile ».

- **À partir de 1 360 px de large**, la semaine est un tableau : les sept
  jours en colonnes, une ligne par matériel proposé dans la semaine (rangés
  par nom), et chaque créneau dans la case de son jour et de son matériel.
  Les lignes viennent de `lib/domain/planning/week-grid.ts`, testé
  (`tests/planning-week-grid.test.ts`) ; c'est la même liste de jours et les
  mêmes cartes qu'en dessous, rangées par la feuille de style
  (`app/irrigation/styles/planning-week.css`) : un lecteur d'écran lit
  toujours la semaine jour par jour.
- **Un créneau fermé est compact** : heure, dose et statut. Un clic l'ouvre
  en carte entière par-dessus le tableau, sur la largeur des sept jours,
  avec sa justification et ses gestes (valider, ajuster, refuser) ; une seule
  carte est ouverte à la fois. « Tout valider (N) » reste en tête de chaque
  jour.
- **En dessous de 1 360 px**, sur un téléphone notamment, la semaine reste la
  liste de jours d'avant. Le parcours P10 vérifie le tableau à 1 440 px.
- Rien ne change dans le moteur, les propositions ni les gestes.

### Les créneaux protégés (3.8 ter, D-062, nuit du 7 au 8 novembre 2026)

Des plages horaires que l'exploitant nomme — « Lavage des légumes » —,
répétées chaque semaine les jours qu'il choisit, pendant lesquelles aucun
créneau planifié, de quelque matériel, ne commence, ne se poursuit ni ne se
termine, même pour une planche prioritaire, même en pénurie. Leurs règles
sont dans `docs/protected-slots-contract.md` (précisions D-071). Le moteur
découpe chaque plage R8 autour d'eux, puis autour des refus
(`lib/domain/planning/protected-slots.ts`) ; la justification dit « après un
créneau protégé », « ce qui tient avant un créneau protégé » et « créneau
protégé « Lavage » évité » ; une planche non servie se lit « créneau
protégé : Lavage ». Sans créneau, le plan reste exactement celui d'avant. Le
service relit les créneaux de l'exploitation en base à chaque calcul
(`db/protected-slots-repository.ts`, migration 0030). Un arrosage déjà
validé qui tombe dans un créneau protégé reçoit « Réduire à X mm » à la
partie qui tient avant lui, ou « Annuler », parmi les suggestions sur les
arrosages validés ; une irrigation faite pendant l'un d'eux le dit sur sa
carte de l'historique. Les créneaux se créent, se modifient et se suppriment
dans le pli « Réglages du planning », section « Créneaux protégés », avec le
journal de leurs valeurs ; « Planifier » avertit d'un arrosage qui tombe
dans l'un d'eux, sans le bloquer. Les tests :
`tests/planning-protected-slots.test.ts`,
`tests/planning-protected-placement.test.ts`,
`tests/planning-protected-suggestions.test.ts`,
`tests/planning-protected-slots-view.test.ts`,
`tests/db/protected-slots-repository.test.ts`,
`tests/db/irrigation-history-protected-slots.test.ts` et le parcours P26
(`e2e/p26-creneaux-proteges.spec.ts`).

## Hors périmètre

Les paramètres culturaux — type, stade, enracinement, coefficient,
sensibilité — et tout besoin qui en découlerait ; l'ET0 dans une dose ; le
planning par série ; les pompes de transfert entre réserves ; la commande
automatique d'une vanne ou d'une pompe ; l'écriture vers Ouvre ta ferme ; le
plan au-delà de la semaine courante.

**Une porte laissée ouverte.** Le porteur envisage d'implanter un jour des
algorithmes d'instituts de recherche qui donnent le besoin en eau de chaque
culture à chaque stade. Le planning est écrit pour que ce jour-là, ce besoin
calculé remplace l'objectif hebdomadaire **à l'entrée de la 3.3**, planche par
planche, sans que le moteur de placement change : il ne connaît qu'un besoin
restant, d'où qu'il vienne.

La profondeur racinaire entre dans le logiciel par la réserve du sol (5 ter,
`docs/soil-reserve-contract.md`, D-041), pour la seule jauge affichée : elle
ne touche ni le besoin ni le moteur de placement.

Le besoin par culture et par stade est cadré par la 5 quater
(`docs/crop-water-need-contract.md`, D-045) : un objectif proposé, qui
n'entre dans le besoin que si l'utilisateur l'adopte ; le moteur de
placement n'en est pas changé.

## Recette réelle du 29 septembre 2026 et question R13

La première recette réelle (`docs/recette-planning.md`), faite le soir de
la mise en ligne de l'écran, valide les goutte-à-goutte, les rampes de serre,
la pompe, la réserve, les plages et l'espacement, et montre que la règle R11
telle que tranchée (D-024, point 4) ne convient pas aux **rampes de bloc à
profil** de la ferme : le réglage « 5 planches » arrose à 7,5 mm/h au centre
et 2 mm/h au bord. À besoin égal, la planche de référence est la première par
ordre de nom, une planche de bord ; la rampe s'arrête quand le centre atteint
R5 ; le moteur revient chaque nuit pour le reste du bord — 60 mm au centre
pour 17,2 demandés, 130,956 m³ proposés pour 84,178 demandés, réserve à
zéro, blocs 3, 8 et fleurs 3 sans créneau parce que leur première planche,
atteinte à 1,5 mm/h par la rampe voisine, tombe sous l'espacement R7.

✅ **Question R13, tranchée par le porteur le 29 septembre 2026 au soir
(D-025) : oui, à 50 %.** La question posée : faut-il un réglage de plus, la part
du débit nominal d'un matériel — son taux le plus fort sur les planches qu'il
couvre — en dessous de laquelle une planche **ne commande pas** l'arrosage ?
Une telle planche ne serait ni la référence de la dose, ni comptée pour
« un arrosage par jour » (R6) et l'espacement (R7) ; l'eau qu'elle reçoit
resterait comptée dans les besoins et l'historique ; son reste serait affiché
avec un motif nouveau, « portée du matériel insuffisante », à la décision du
maraîcher. Recommandation : oui, 50 % au départ, réglable à l'écran comme
les autres. Sur le bloc 10 : un créneau de 2 h, 15 mm au centre, 2,2 mm le
dernier jour ; B10-9 et B10-10 affichées avec 10,2 et 13,2 mm de reste ;
volume de la semaine de l'ordre de 70 m³ pour 93 mobilisables. L'alternative
— garder R11 et accepter le sur-apport — n'est pas recommandée.

Deux corrections d'explication accompagneront la décision : un motif
« espacement » quand c'est lui qui laisse un matériel sans plage, à la place
du « temps de pompage » mis par défaut ; et le niveau projeté de la réserve
relu sur le plan fini, pas au moment du placement.

**Seconde recette, le même soir à 21 h 20, après la PR de la portée (#114).**
La portée fait ce qui a été décidé : un créneau de 2 h par bloc, 69,243 m³
pour 92,661 mobilisables, blocs 3, 8 et fleurs 3 servis, 72 planches « portée
du matériel insuffisante » et 27 « sous la dose minimale », temps de pompage
manquant à zéro, pompe, plages et espacement tenus, les deux corrections
d'explication vérifiées. Mais elle révèle que **la garde de la réserve est
inopérante** : `ReservoirTimeline.minimumLevel` borne le niveau à zéro, et
avec le minimum de sécurité de la ferme, 0, le manque calculé par `evaluate`
vaut toujours 0 — le plan tire 21,12 m³ que la réserve n'a pas entre
mercredi 01 h 25 et 06 h 42 et annonce « Manque d'eau 0,00 m³ » ; le test
d'invariant lit le même niveau borné et ne peut pas échouer ; et `evaluate`
ne regarde que la durée du candidat alors que le moteur ne place pas dans
l'ordre du temps. **Règle à tenir par la correction, écrite avant le code** :
le niveau affiché reste borné par zéro et par la capacité ; la faisabilité
d'un créneau se juge sur le niveau borné par la capacité seule, du début du
créneau à la fin de l'horizon ; le manque annoncé est le vrai manque. Tests
d'abord, troisième recette ensuite (`docs/recette-planning.md`). — Corrigé
le 2 octobre 2026, règle précisée au point 5 de « Où placer les créneaux »
et dans la note « La garde de la réserve » ; la troisième recette reste à
faire.

## Questions posées au porteur

Pour chacune, ma recommandation ; les réponses du 29 septembre 2026 sont
consignées dans la section suivante et dans `docs/DECISIONS.md` (D-024).

1. **Q1 — Pluie prévue (R2).** La déduire à 100 % comme la 3.3, ou à une part
   moindre pour le planning seul ? Recommandation : 100 % au départ, égal à ce
   que l'écran des besoins montre déjà, et observer une saison.
2. **Q2 — Attendre la pluie (R3).** Laisser passer une pluie prévue de plus
   de 5 mm avant d'arroser les planches concernées ? Recommandation : oui,
   5 mm ; en dessous, la prévision est trop incertaine pour changer un plan.
3. **Q3 — Doses (R4 à R7).** Les fourchettes proposées — aspersion 5 à
   15 mm, goutte-à-goutte 3 à 10 mm, une fois par jour, un jour d'espacement —
   sont-elles celles de la ferme ? C'est vous qui les connaissez.
4. **Q4 — Dose d'une rampe (R11).** Le besoin le plus élevé des planches
   couvertes, avec le sur-apport affiché, ou le plus faible, avec le déficit
   affiché ? Recommandation : le plus élevé, parce qu'un déficit coûte plus
   qu'un sur-apport et que le sur-apport est lisible.
5. **Q5 — Deux matériels sur une planche (R12).** Le goutte-à-goutte d'abord ?
   Recommandation : oui, il mouille moins de surface pour la même dose.
6. **Q6 — Au plus tôt ou lissé.** Placer les créneaux au plus tôt, ou les
   répartir régulièrement sur la semaine ? Recommandation : au plus tôt, le
   déficit ne s'améliore pas en attendant ; le lissage vient de l'espacement.
7. **Q7 — Plages horaires (R8).** Aspersion 21 h – 8 h, goutte-à-goutte
   6 h – 22 h ? À ajuster à la ferme, tunnels compris.
8. **Q8 — Conduite en pénurie (R9).** Prioritaires d'abord puis part égale,
   part égale pour toutes, ou report ? Recommandation : la première, celle
   que la 3.4 applique déjà, l'arbitrage manuel gardant le dernier mot.
9. **Q9 — Report (R10).** Un déficit de fin de semaine se reporte-t-il sur la
   semaine suivante ? Recommandation : non, l'objectif est hebdomadaire et le
   déficit se lit dans les cumuls ; réglable si l'usage montre le contraire.
10. **Q10 — Restrictions d'horaire.** Un arrêté peut interdire d'arroser à
    certaines heures. Faut-il le modéliser maintenant (une plage interdite
    sur la restriction 2.8) ou plus tard ? Recommandation : plus tard, sauf
    si la ferme y est déjà soumise.
11. **Q11 — Validation.** Une par une, par jour, ou toute la semaine d'un
    coup ? Recommandation : les trois, la validation d'un jour étant l'usage
    quotidien attendu.
12. **Q12 — Il manque un indicateur ?** Section 27 du cahier des charges :
    quel indicateur agronomique faudrait-il voir dans le plan avant de le
    croire ? Ce contrat n'en ajoute aucun.

## Décisions du porteur

Prises le 29 septembre 2026 au soir, à la lecture du contrat (D-024), puis
complétées au fil des recettes.

1. ✅ **Pluie prévue** : déduite à 100 %, sauf sous abri, où elle vaut zéro.
2. ✅ **Attendre la pluie** : une pluie prévue de plus de 5 mm fait placer
   les arrosages des planches concernées après elle.
3. ✅ **Doses** : les valeurs de départ retenues après explication —
   aspersion 5 à 15 mm, goutte-à-goutte 3 à 10 mm par arrosage, un arrosage
   par jour et par planche, 24 heures au moins entre deux —, réglables à
   l'écran.
4. ✅ **Dose d'une rampe** : le besoin le plus élevé des planches couvertes,
   le sur-apport des autres affiché.
5. ✅ **Deux matériels sur une planche** : le goutte-à-goutte d'abord.
6. ✅ **Au plus tôt**, pas de lissage sur la semaine.
7. ✅ **Plages horaires** : valeurs de départ acceptées, **réglables par le
   maraîcher à l'écran**.
8. ✅ **Pénurie** : prioritaires d'abord, puis part égale, l'arbitrage 3.4
   gardant le dernier mot.
9. ✅ **Pas de report** du déficit sur la semaine suivante.
10. ✅ **Restrictions** : un arrêté préfectoral est toujours une limite en
    mètres cubes par jour ; la limite journalière de la 2.8 est son modèle,
    déjà en place ; aucune plage horaire de restriction.
11. ✅ **Validation** : une par une, par jour, ou toute la semaine.
13. ✅ **Portée (R13), tranché le 29 septembre 2026 au soir après la
    recette réelle** : une planche arrosée à moins de 50 % du débit le plus
    fort d'un matériel ne commande pas son arrosage — ni référence de dose,
    ni R6, ni R7 —, son eau reste comptée, son reste est affiché « portée du
    matériel insuffisante » ; la part se règle à l'écran. La planche la mieux
    arrosée fixe la dose ; à débit égal, le besoin le plus élevé (point 4).
12. ✅ **Indicateurs** : aucun à ajouter aujourd'hui ; des algorithmes de
    besoin par stade de culture pourront venir plus tard, en entrée de la
    3.3, sans changer le moteur (voir « Hors périmètre »).
14. ✅ **Refus (D-030), tranché le 5 octobre 2026 au soir, point ouvert 31
    de `docs/ETAT_DU_PROJET.md`** : le créneau refusé — ce matériel, à ces
    heures — est exclu pour le reste de la semaine ; le besoin reste et se
    place ailleurs. Contrat corrigé le soir même, moteur à faire (3.7).

## Preuve de fin du cadrage

1. ✅ Ce contrat relu et validé par le porteur : douze questions tranchées
   le 29 septembre 2026.
2. ✅ Les réponses consignées dans `docs/DECISIONS.md` (D-024).
3. ✅ Les scénarios ci-dessus complétés des valeurs exactes que les réglages
   retenus donnent, pour devenir les tests du moteur.
4. ✅ Les registres à jour. Le moteur (3.5) commence le 29 septembre 2026 au
   soir.
