# Pilote multi-fermes : fiche d'entrée

> Écrite le 20 novembre 2026 (4.6, PR 1, F570 du contrat `docs/tranche-4-contract.md`, section 10 ter.3). **Fiche vide.** Elle recopie les douze conditions d'entrée ; chacune se coche **avec la preuve constatée à la source** (numéro de PR, date, extrait d'un résultat, jamais une valeur secrète), jamais de mémoire (consigne 7 du projet).
>
> **On ne la remplit qu'au moment où il reste moins de trois lignes ouvertes.** Elle se met à jour par PR, comme les registres.
>
> **Le pilote commence quand les douze lignes sont cochées et que le porteur a écrit « vas-y » sous la fiche.** Une seule ligne manque : il ne commence pas, et le dire est un résultat, pas un échec.

Marques : **[RÉSERVÉ]** = acte ou décision du porteur que l'assistant ne prend pas. E3, E6 et E12 touchent au budget, au juridique ou à Cloudflare : réservés. E6 est **levée** par le porteur le 22 novembre 2026 à 17 h 50 (D-299) ; une ligne levée compte pour le total des douze, avec sa preuve, comme une ligne cochée. Le reste de la fiche reste vide.

| N° | Condition | Où se vérifie | Qui | Cochée ? | Preuve constatée (PR, date, résultat) |
| --- | --- | --- | --- | --- | --- |
| E1 | Ouvre ta ferme a validé la demande ; le porteur a posé les secrets de la 4.3 (F368) | page des demandes d'OTF ; la commande de pose se lit, jamais la valeur | porteur | ☐ | |
| E2 | 4.3 PR 3 et PR 4 en ligne ; essai de bout en bout conforme sur « Ferme v2 » n° 4394 ; la ferme du porteur reliée ; `OTF_API_TOKEN` et le chemin de la clé du déploiement retirés (F366, étapes 4 et 5) ; test « une personne inconnue n'ouvre aucune ferme » vert | roadmap 4.3, registres, tests | assistant ; porteur pour les actes | ☐ | |
| E3 | Part du quota de la ferme du porteur fixée (F363), question due à partir du 3 décembre 2026 | journal des appels, F363 | porteur [RÉSERVÉ] | ☐ | |
| E4 | 4.4 en ligne (cinq PR) et essai réel conforme sur « Ferme v2 » n° 4394, aux deux largeurs | roadmap 4.4, section 8 bis.6 | assistant ; recette dans le Chrome du porteur avec son accord | ☐ | |
| E5 | 4.5 en ligne (cinq PR) : la veille prévient en vrai, y compris d'une alerte non délivrée sur une ferme (C3, D-305), l'effacement d'une ferme est complet et prouvé, la restauration est jouée (S1, S2, S3), la phrase des 30 jours est dans la confidentialité | roadmap 4.5, section 10 bis.7 | assistant | ☐ | |
| E6 | Relecture juridique de la confidentialité, des conditions et du modèle d'accord (`docs/pilote-accord-modele.md`) faite par le réseau du porteur, gratuite ; retour reçu, remarques reprises | retour du porteur ; PR de reprise | porteur [RÉSERVÉ] | ☑ levée | **Condition levée par décision du porteur le 22 novembre 2026 à 17 h 50** (D-299) : aucun relecteur trouvé, il prend la responsabilité des textes tels quels. Ce n'est pas une relecture faite : les textes restent non relus par un juriste. |
| E7 | Le texte de confidentialité en ligne dit ce que fait le code : clé chiffrée gardée puis effacée, l'exploitant peut techniquement lire les données (F367, D6), conservation (4.5), effacement sous sept jours | page publique lue contre le code, ligne à ligne | assistant ; porteur relit | ☐ | |
| E8 | Revue d'isolation de la 4.3 à la 4.5 par un fil à part, sur `main` : coffre, raccordements, accueil, veille et effacement ne mélangent pas les fermes ; points D2 à D5 de la revue du 18 novembre 2026 fermés ou écartés par écrit ; le contrôle de cohérence (F380) couvre toute table nouvelle | rapport de la revue déposé dans le projet | assistant (fil indépendant, Opus 5.5 · Max) | ☐ | |
| E9 | Le modèle d'accord, la grille de recette et la fiche de retour existent dans `docs/` (F572, F574, F575) | dépôt : `pilote-accord-modele.md`, `pilote-recette.md`, `pilote-retour-modele.md` | assistant | ☐ | |
| E10 | Essai à blanc du retour en arrière (F576) joué une fois : déconnexion d'une ferme fictive, retrait de la personne d'Access, effacement sous sept jours, vérification | compte rendu dans la PR | assistant ; porteur pour Access [RÉSERVÉ] | ☐ | |
| E11 | La démonstration (4.0) a été essayée par la ferme pilote avant tout raccordement (constat B de la revue du 18 novembre 2026) | retour de la ferme | porteur (contact) | ☐ | |
| E12 | Le coût est relu : abonnement Workers, alerte de budget présente, nombre de personnes dans Access loin de 50 | tableau de bord Cloudflare, dans le Chrome du porteur avec son accord | porteur | ☐ | |

## Feu vert

Lignes cochées : ___ sur 12.

Le porteur écrit ici « vas-y » et la date, **seulement quand les douze lignes sont cochées avec leur preuve** :

> *(vide)*

Rappel : la fiche ne contient **aucun nom de ferme, de personne ni adresse**. Les fermes se nomment « ferme pilote 1 » et « ferme pilote 2 ».
