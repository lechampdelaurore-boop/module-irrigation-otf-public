# Recette réelle — suivi d'exécution et replanification (3.7)

Faite le 31 octobre 2026 de 10 h 44 à 10 h 51 (Paris), sur la ferme du
porteur, dans son Chrome, par une séance lancée sur son ordinateur, sur son
« vas-y » écrit à 10 h 38 dans le fil de code de la 3.7 (contrat, décision 6 :
recette réelle dès la mise en ligne, arrosages réels complétés d'événements
fabriqués). Le protocole K0 à K7 et ses attendus ont été écrits avant tout
geste sur le site. Version à éprouver : `main` à `80e00b7` ; le code de la
3.7 est celui de la PR #215 (`ebd29e9`), fusionnée à 06 h 30 et déployée à
06 h 39, les PR #208 à #214 avant elle ; la PR #216 déployée à 07 h 00 ne
porte que des documents. Contrat : `docs/replanning-contract.md`, règles 4 à
25 et décisions 1 à 6 ; point ouvert 31 (D-030). **Les constats sont de
l'assistant, dans le navigateur du porteur ; le jugement reste au porteur**
(D-014). Les heures sont celles du poste, à la minute.

## Données de la ferme

Le logiciel n'est pas encore en service : l'assistant peut modifier les
données pour ses essais (consigne du 5 octobre 2026), à condition de relever
l'état de départ, d'écrire l'attendu avant chaque geste et de tout remettre en
état par l'écran, un dernier calcul retrouvant le plan du départ. Aucune
irrigation réelle n'existait ce jour-là — ni planifiée, ni en cours, ni
faite — : les événements ont tous été fabriqués, sur les vraies planches et
le vrai matériel, puis défaits par l'écran. Deux traces restent, dites plus
bas : la carte refusée, qui ne vaut que pour la semaine en cours et disparaît
lundi (D-030), et **la pluie de 3 mm saisie pour le 31 octobre, qu'aucun
écran ne permet de retirer** (constat 4). Les objectifs n'ont pas été
touchés. Le dépôt sur le poste du porteur n'a pas été modifié.

## L'état de départ (K0, 10 h 45)

| Donnée | Au départ |
| --- | --- |
| En-tête du plan | « calculé le 31/10/2026 06:15 (recalcul du matin) » |
| Résumé | 19 propositions · 0 validée · 0 refusée · 9 expirées (goutte-à-goutte gag2, gag4 à gag8, gag11, gag12 et gag16, samedi 06:16 → 07:31) ; 41,34 m³ ; manque d'eau 37,165 m³ ; 164 planches non servies |
| Pli « Ce qui a changé » | « depuis le calcul du 30/10/2026 06:15 · 35 changements » |
| Suggestions | aucune |
| « À venir ou à terminer » | vide : aucune irrigation réelle |
| Pluie mesurée du 31/10 | vide (la semaine affiche 0,9 mm de réanalyse) |
| Limite journalière | inactive, « Aucune limite active » ; le formulaire porte l'enregistrement désactivé du 6 au 11 octobre (quatrième recette) |
| Objectifs | objectif de ferme 20 mm, 1 objectif ciblé |
| Réglages du planning | R14 retard 30 min ; R8 aspersion 21:00 → 08:00, goutte-à-goutte 06:00 → 22:00 |
| Matériel | 34 actifs |
| Tunnels 1 à 4 | 12,1 mm proposés à chacun le samedi soir |

Le détail carte par carte a été relevé par la séance et sert à la comparaison
finale.

## Les essais, l'attendu écrit avant chacun

| N° | Geste | Attendu, écrit avant | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| K1 | Pluie mesurée du 31/10 : 3 mm, « Enregistrer » (10 h 47) | Message « La pluie mesurée a été enregistrée. » ; le plan se recalcule seul, en-tête « (après la pluie saisie au pluviomètre) » à une heure nouvelle ; le pli présent avec son nombre de changements ou « rien » | Message conforme ; recalcul immédiat, en-tête « (après la pluie saisie au pluviomètre) » ; pli : 32 changements — 12 propositions apparues, 18 déplacées avec dose changée, 1 retirée, manque d'eau de 37,17 à 29,01 m³. Les 9 créneaux expirés du matin sont reproposés à partir de 10:48 ; la dose des tunnels, sous abri, monte de 12,1 à 13,1 mm | Conforme |
| K2 | Refuser « Rampe de serre tunnel 1 », samedi 21:00 → 22:18, 13,1 mm (10 h 47) — point 31 | Statut « Refusée » ; en-tête « (après une proposition refusée) » ; ce matériel jamais reproposé sur ces heures ; le besoin replacé sur un autre créneau, ou la planche dans « Non placé » avec « créneau refusé » | « Refusée » ; en-tête « (après une proposition refusée) » ; le tunnel 1 n'est pas reproposé à 21:00 : il est replacé le même soir à 22:19 → 23:37 (13,1 mm), et le tunnel 4 prend le créneau de 21:00 ; aucune planche en « créneau refusé », le besoin ayant trouvé place ; pli : 11 changements. Détail d'écran : plusieurs lignes « Proposition déplacée » ont un départ et une arrivée identiques à la minute (par exemple gag9, « 06:00 → 07:14 » à « 06:00 → 07:14 ») | Conforme ; détail au constat 3 |
| K3 | Valider A = « rampe bloc 1 », samedi 22:19, et B = « rampe BF », dimanche 21:00 (10 h 48) | « Validée » ; les deux dans « À venir ou à terminer » ; en-tête « (après une proposition validée) » | Conforme ; le volume de B s'affiche « 841,18 L », celui de A « 1,51 m³ » | Conforme |
| K4 | Limite journalière : « Activer la limite », 0,01 m³ / jour, du 31/10 sans fin, « Enregistrer » (10 h 48) | Message « La limite journalière a été enregistrée. » ; en-tête « (après une limite journalière changée) » ; une suggestion « Annuler » par irrigation validée, avec la limite et le volume engagé pour raison, les boutons « Appliquer » et « Garder » ; le pli liste « Suggestion nouvelle : annuler » ; la note dit que le moteur ne modifie jamais un arrosage validé | Message et en-tête conformes ; deux suggestions « Annuler », chacune avec ses deux boutons ; raisons mot pour mot : « limite journalière du 31/10 : 0,01 m³ pour 1,51 m³ engagés » et « limite journalière du 01/11 : 0,01 m³ pour 0,84 m³ engagés » ; note : « Le moteur ne modifie jamais un arrosage validé : il suggère, vous décidez. » ; pli : « Suggestion nouvelle : annuler » pour chacune, et les 28 propositions retirées par la limite | Conforme |
| K5a | « Garder » sur la suggestion de B (10 h 49) | La suggestion passe parmi les gardées, repliée ; rien d'annulé ; B toujours dans « À venir » | « 1 suggestion gardée », repliée ; rien d'annulé ; B toujours à venir | Conforme |
| K5b | « Appliquer » sur la suggestion de A (10 h 49) | Message « Suggestion appliquée : l'irrigation planifiée est annulée. » ; A disparaît de « À venir ou à terminer » ; en-tête « (après une irrigation annulée) » ; la suggestion de A disparaît | A disparue de « À venir », en-tête « (après une irrigation annulée) », suggestion disparue ; **le message n'a pas été vu**, ni une ni quatre secondes après le clic | Écart, constat 2 |
| K6 | Signal « En retard » ou « Non faite », lecture seule | Lu si une irrigation planifiée a dépassé son heure | Aucune irrigation en retard à observer | Sans objet |

## La remise en état (K7)

| Geste | Attendu | Constaté | Verdict |
| --- | --- | --- | --- |
| Décocher « Activer la limite », « Enregistrer » (10 h 49) | Message « La limite journalière est désactivée pour cette période. » ; en-tête « (après une limite journalière changée) » ; plus aucune limite active | Conforme ; le formulaire garde 0,01 m³ et « Du 31/10 » comme dernier enregistrement, désactivé, à la place de celui du 6 au 11 octobre — comme après la quatrième recette, qui avait laissé le sien | Conforme |
| Annuler B par le bouton « Annuler » ordinaire de sa carte dans « À venir ou à terminer » (10 h 50) | B disparaît ; en-tête « (après une irrigation annulée) » | Conforme ; ce bouton ouvre une fenêtre de confirmation du navigateur (« Annuler cette irrigation planifiée ? »), que la séance a dû neutraliser par script avant le clic | Conforme ; détail au constat 5 |
| Remettre la pluie mesurée du 31/10 à vide | Valeur de départ retrouvée | **Impossible par l'écran** : le panneau refuse un champ vide (« La pluie mesurée doit être comprise entre 0 et 1 000 mm. ») et aucun écran ne retire une mesure ; 0 mm n'a pas été saisi, qui serait une fausse mesure « pas de pluie » passant avant la réanalyse. Les 3 mm restent : la semaine affiche 3,9 mm au lieu de 0,9 mm | Non remis ; constat 4 |
| Objectifs | inchangés | jamais modifiés | Conforme |
| Dernier calcul « Recalculer le plan » (10 h 51) | En-tête « (à la demande) » ; le plan du départ carte par carte, à la seule exception de la carte refusée en K2 | En-tête « (à la demande) ». La pluie étant restée, la comparaison se fait avec le plan de K1, calculé avec les mêmes 3 mm : il est retrouvé carte par carte, avec les effets attendus du refus — tunnel 1 refusé à 21:00 et replacé à 22:19, tunnel 4 à 21:00, rampe bloc 2 à 23:14 — ; différences minimes : tunnels 13 mm au lieu de 13,1, rampe bloc 8 9,6 mm au lieu de 9,7, goutte-à-goutte à partir de 10:52 au lieu de 10:48 ; manque d'eau 29,042 m³. Par rapport au départ, le plan diffère par les 3 mm et par les 9 créneaux expirés reproposés. **Mais les cartes de A et de B restent affichées « Validée », voir le constat 1** | Retrouvé au plan de K1 près ; constat 1 |

« À venir ou à terminer » est revenu vide ; la limite est inactive ; la
console, lue au seul final, ne montre aucune erreur ; l'onglet ouvert par la
séance a été fermé. Toutes les irrigations validées pendant la recette sont
annulées.

## Ce que la recette prouve

Sur la ferme, sur la version déployée : le plan se recalcule de lui-même après
une pluie saisie, un refus, une validation, une limite changée et une
annulation, et l'en-tête nomme chaque fois son déclencheur (règles 4 à 7) ;
le pli « Ce qui a changé » suit chaque calcul avec son nombre de changements
(règle 25) ; **le moteur lit les refus** : le créneau refusé n'est jamais
reproposé, le besoin est replacé le même soir et le tunnel 4 prend l'heure
libérée (D-030, point 31) ; une limite posée après coup fait suggérer
« Annuler » sur chaque arrosage validé, avec la limite et le volume engagé
pour raison, et le moteur n'annule rien lui-même (règles 11 à 17, décision
3) ; « Garder » fait taire une suggestion, « Appliquer » annule l'irrigation
par le circuit ordinaire et le plan se recalcule (règles 15 et 17). Tous les
recalculs sont arrivés en 0 à 4 secondes, sans rechargement.

## Au jugement du porteur

Le porteur a choisi « Oui, les quatre » le jour même à 11 h 15 : les points 1
à 4 ci-dessous sont corrigés par la PR #220, fusionnée sur son mot et
déployée à 12 h 14, vérifiée sur la ferme (section suivante). Le point 7 est
fermé avec le point 31 par le porteur à 12 h 23 ; le point 5 est renvoyé à la
3.8 ; le point 6 (la dose des tunnels montée après une pluie saisie) reste une lecture de l'assistant conforme à D-038, sans décision nouvelle du porteur.

1. **Cartes « Validée » fantômes après annulation, et doublons.** Après
   l'annulation de A (par « Appliquer ») et de B (par « Annuler »), leurs
   cartes restent affichées dans le plan « Validée · Irrigation planifiée »,
   le résumé compte « 2 validées » et le volume (45,504 m³) les inclut,
   alors que « À venir ou à terminer » est vide ; et le dernier calcul
   repropose le même matériel sur les mêmes créneaux — rampe bloc 1 samedi
   22:19, rampe BF dimanche 21:00 —, qui apparaissent donc deux fois, une
   fois « Validée », une fois « Proposée ». Cause lue dans le code après la
   recette : le registre garde le statut « validée » d'une proposition quoi
   qu'il advienne de son irrigation ; le plan relit toutes les validées de
   la semaine sans regarder si l'irrigation est encore planifiée, alors que
   le moteur, lui, lit le réel et replace le besoin. Le contrat du planning
   (statuts : « Réalisée, partielle, annulée — l'irrigation validée a vécu ;
   le plan lit le réel, jamais l'inverse ») voulait le contraire. Défaut
   antérieur à la 3.7 (il existe depuis la 3.5), révélé par elle : avant,
   une annulation ne faisait pas recalculer, et aucune recette n'avait
   annulé une irrigation validée puis recalculé. Deux cartes fantômes sont
   visibles sur la ferme jusqu'à lundi. Recommandation de l'assistant :
   corriger — la carte d'une proposition dont l'irrigation est annulée se
   lit « Annulée », hors du compte des validées et hors du volume ; de même
   « Réalisée » et « Partielle » quand l'irrigation a vécu.
2. **Le message « Suggestion appliquée : l'irrigation planifiée est
   annulée. » n'a pas été vu.** Le parcours P12 le voit, dans la
   milliseconde ; sur la ferme, il s'affiche dans la carte de la suggestion,
   que le recalcul fait disparaître en 0 à 4 secondes avec son message. Le
   contrat demande que « le message dise ce qui a été fait » : un message
   qui s'efface aussitôt ne le dit à personne. Recommandation : le montrer
   aussi dans le bandeau de la section, où il reste.
3. **« Proposition déplacée » à l'identique.** Dans le pli, des lignes
   disent une proposition déplacée d'un créneau au même créneau, à la
   minute. Cause lue dans le code : la comparaison se fait à la milliseconde
   sur les heures et au dixième de millimètre sur la dose ; une dose qui
   bouge dans le dixième change la durée de quelques secondes, donc la fin,
   et la ligne compte comme un déplacement. Recommandation : comparer les
   heures à la minute, comme elles s'affichent.
4. **Les 3 mm du 31 octobre.** Une mesure saisie ne se retire pas : le
   panneau refuse un champ vide et aucun écran ne l'efface. Les 3 mm
   fabriqués restent sur la ferme et pèsent sur le bilan d'eau du plein
   champ. Recommandation : le porteur dit ce que lit son pluviomètre
   aujourd'hui, et cette vraie mesure remplace les 3 mm (0 mm compris, si
   le jour est sec) ; et un bouton « Retirer la mesure » s'ajoute au
   panneau, pour celle-ci comme pour toute mesure saisie par erreur.
5. **Le bouton « Annuler » ordinaire passe par une fenêtre du navigateur.**
   Antérieur à la 3.7 (2.7) ; comme « Supprimer définitivement » (recette
   2.11), cette fenêtre bloque les séances de l'assistant. À revoir avec
   l'interface (3.8), pas dans la 3.7.
6. **La dose des tunnels monte après une pluie saisie** (12,1 → 13,1 mm)
   alors qu'ils sont sous abri. La pluie n'a pas changé leur besoin : elle a
   réduit celui du plein champ (manque d'eau de 37 à 29 m³), et le moteur,
   en pénurie, a redonné aux tunnels une part de l'eau libérée (parts
   réservées, D-038). Lecture de l'assistant, au jugement agronomique du
   porteur.
7. **Point 31.** Le créneau refusé du tunnel 1 n'est pas reproposé, le
   besoin est replacé le même soir : la recette sur le site est faite. Sa
   fermeture est au porteur.

## La vérification après les corrections (12 h 15 – 12 h 17)

Après le déploiement de la PR #220 (12 h 14), de 12 h 15 à 12 h 17, dans le
Chrome du porteur, un seul geste sur la ferme. Cartes A (rampe du bloc 1,
samedi 22 h 19 → 23 h 13) et B (rampe BF, dimanche 21 h 00 → 22 h 22) :
« Annulée », avec la note « Irrigation annulée : son besoin est revenu au
plan, qui l'a replacé ou le dit non placé. » ; résumé « 22 propositions · 0
validée · 1 refusée · 8 expirées », volume 39,52 m³ (45,504 m³ le matin avec
les deux). Pli « Ce qui a changé » : les 19 lignes « déplacée » à heures
identiques datent toutes du calcul de 10 h 51, d'avant la correction ; après
le calcul de 12 h 16, « 31 changements », aucune ligne de ce type. « Pluie
mesurée », date du 31 octobre 2026, un clic sur « Retirer la mesure » : « La
mesure de pluie a été retirée : la réanalyse reprend pour ce jour. », semaine
revenue à « 0,9 mm · partielle », le samedi de nouveau parmi les jours
manquants, plan « calculé le 31/10/2026 12:16 (après la pluie saisie au
pluviomètre) » en 5 s. Rien d'autre changé : objectif ferme 20 mm, aucune
limite active, R14 30 min, aucune suggestion, « À venir ou à terminer » vide.
État final : 27 propositions · 0 validée · 1 refusée · 0 expirée, 42,365 m³,
manque 39,929 m³, 164 non servies (K0 : 19 · 0 · 0 · 9, 41,34 m³, 37,165 m³,
164 ; les neuf goutte-à-goutte expirés le matin sont reproposés). Deux détails
au jugement du porteur : le fond des cartes « Annulée » presque blanc ; le
champ « Millimètres » vide pour le jour choisi, la valeur se lisant dans la
liste.

## Autres constats

- Le numéro de version n'est pas affiché dans la page ; la version a été
  établie par l'historique Git et le journal du déploiement.
- Le volume d'une carte s'affiche en litres sous 1 m³ (« 841,18 L ») et en
  mètres cubes au-dessus (« 1,51 m³ ») : convention des cartes du planning.
- Le dépôt local du poste du porteur date du 10 octobre ; la séance a suivi
  le protocole écrit dans le fil, sans relire le contrat sur place.

## Ce que cette recette ne prouve pas

- Les deux notifications sur le téléphone (règles 21 à 24) : aucune alarme de
  retard n'a pu sonner (les irrigations validées ont été annulées avant leur
  heure) et le calcul du matin est passé avant la recette. Elles restent
  prouvées par les tests du domaine, de la persistance et du service ; le
  porteur les verra au premier matin où le calcul suggère quelque chose sur
  un arrosage des prochaines 24 heures, et à la première irrigation en
  retard.
- Le signal « En retard » ou « Non faite » sur une carte (règles 18 à 20) :
  aucune irrigation n'était en retard. Prouvé par les tests ; à observer à
  la première occasion.
- « Réduire à X mm » : la limite de 0,01 m³ ne laisse place qu'à
  « Annuler ». Prouvé par les tests du domaine.
- La largeur 390 px : le parcours P12 la couvre aux deux largeurs.
