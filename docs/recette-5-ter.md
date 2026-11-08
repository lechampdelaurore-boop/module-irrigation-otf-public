# Recette réelle — réserve du sol (5 ter) et pastille « eau arrosée en trop »

Faite le 6 novembre 2026 de 21 h 52 à 22 h 05 (Paris), sur la ferme du
porteur, dans le navigateur de l'application Claude sur son ordinateur, sur
son « vas-y » écrit à 21 h 50. Version éprouvée : `main` à `018f796`, la
5 ter entière (PR #245 à #250) et la pastille (#251), déployées. Contrat :
`docs/soil-reserve-contract.md`, « Preuve de fin ». **Les constats sont de
l'assistant ; le jugement agronomique reste au porteur** (D-014).

Ouvre ta ferme est resté en lecture seule du début à la fin. Dans le module,
deux enregistrements ont été faits, chacun sur la réponse du porteur, et
gardés : ce sont ses vraies valeurs (« Les enregistrements », plus bas).

## L'état trouvé

| Constat | Valeur |
| --- | --- |
| Bloc « Réserve du sol » | présent sous le tableau des besoins, avec sa phrase « C'est une information : elle ne change ni le besoin, ni le plan, ni les priorités » |
| Réglages du sol | « 0 parcelle sur 1 renseignée · seuil selon la culture » |
| Jauges | les 18 jardins et abris « inconnue », raison « RFU non saisie » ; aucune observation |
| Pastille | « Eau arrosée en trop sur sept jours : aucune », du vendredi 30 octobre au jeudi 5 novembre ; dans le pli, « Aucune irrigation de ces sept jours n'a dépassé ce que le sol pouvait retenir » et la règle du partage avec la pluie |
| Irrigations réalisées | 0 mm la semaine du 26 octobre et celle du 2 novembre : la pastille dit juste |
| Profils racinaires (page « Coefficients culturaux ») | 32 cultures ; tomate 0,65 m au stade 3, courgette 0,50 m, melon 0,60 m au plus, asperge 0,60 m ; céleri p 0,20 et 0,30 m « proposés, à vérifier », patate douce p 0,50 sans valeur saisie : conformes au contrat |

## Les enregistrements, sur les réponses du porteur

| Heure | Geste | Constat |
| --- | --- | --- |
| 21 h 57 | Sol de la parcelle Clémentière (carte 1 sur 2, choisie à 21 h 56) : laboratoire 62 mm/m, cailloux 18 %, part de référence 2/3, provenance analyse, TEW 14 mm, REW 7 mm, Ze 10 cm, depuis le 6 novembre | « RFU du sol : 51 mm/m » avant l'enregistrement ; « Le sol de la parcelle est enregistré. » ; « 1 parcelle sur 1 renseignée » ; le rappel de vérifier à la bêche ou à la tarière s'affiche |
| 21 h 58 | Observation du plein champ, 50 % du plein (carte 2 sur 2, puis son message : « plutôt 50 % ») | « Maintenant » refusé, voir « Le défaut trouvé » ; enregistrée par « plus tôt, aujourd'hui ou hier » à 21 h 58 : « L'observation de la parcelle, 50 % du plein, est enregistrée pour ses jardins de plein champ. » |

Après le sol seul, les planches sans départ restent « inconnue : pas encore
de départ » ; le Bloc 11 passe à « aucune planche cultivée ». Après
l'observation, les blocs 1 à 10 et le Bloc Fleurs 1 sont « 50 % du plein
maintenant », les abris gardent le leur.

## Cinq planches recalculées à la main

RFU du sol 51 mm/m ; seuil = capacité × (1 − p / (2/3)).

| Planche, culture | Affiché | À la main |
| --- | --- | --- |
| B2-1, radis rave (navet, 0,70 m, p 0,50) | 17,8 mm sur 35,7 mm, seuil 8,9 mm | 51 × 0,70 = 35,7 ; 50 % = 17,85 ; 35,7 × 0,25 = 8,9 |
| B2-3, choux (crucifères, 0,50 m, p 0,45) | 12,8 mm sur 25,5 mm, seuil 8,3 mm | 51 × 0,50 = 25,5 ; 12,75 ; 25,5 × 0,325 = 8,3 |
| B2-8 (0,25 m, p 0,20) | 6,4 mm sur 12,8 mm, seuil 8,9 mm, « sous le seuil, 6,4 mm conseillés » | 51 × 0,25 = 12,75 ; seuil 12,75 × 0,70 = 8,9 ; dose 12,75 − 6,4 = 6,4 |
| B2-6, engrais vert levé (0,30 m) | 7,6 mm sur 15,3 mm, seuil 3,8 mm | 51 × 0,30 = 15,3 ; 15,3 × 0,25 = 3,8 |
| B1-0, sol nu (0,30 m) | 7,7 mm sur 15,3 mm | 15,3 × 50 % = 7,65 |

Les planches à fleurs sans Kc (B1-4, B1-5, BF2-5) sont « inconnue depuis le
vendredi 6 novembre : pas d'ETM pour … », cultures nommées (D-003).

Au téléphone (390 px), le bloc ne déborde pas ; les choix « maintenant » et
« plus tôt » ont des libellés de 44 px.

## Le défaut trouvé, corrigé

« Maintenant » était refusé : « L'heure de l'observation est dans le futur ».
L'horloge de l'ordinateur avançait de 13 s sur celle du serveur (en-tête
`Date` d'une réponse du site). Comme pour la date d'une pose (point ouvert 47
de la 2.11), une avance de deux minutes au plus vaut maintenant l'heure du
serveur ; au-delà, l'heure reste refusée. Corrigé le soir même, avec un
test, sur l'option recommandée de la question posée au porteur (D-060).

## Ce que le porteur a à juger

- **Le départ sous les tunnels par une proposition non validée.** Sans
  observation, les planches cultivées du Tunnel 1 (chicorée, scarole,
  mesclun) partent « par un apport le vendredi 6 novembre » : l'apport est la
  proposition du plan de 21 h à 22 h 30 (15 mm), « passée sans décision »,
  comptée en entier, comme le veut le contrat (aujourd'hui est prévu). Le
  « drainage aujourd'hui : 2,3 mm » affiché (15 − 12,75) suppose le sol vide
  avant l'apport : c'est un minimum. À garder, ou à réserver aux irrigations
  réalisées.
- **Le contrôle de la profondeur des racines à la bêche sous abri**, prévu
  par la preuve de fin, reste à faire par lui.
- L'observation de 50 % a été choisie pour la recette ; il la remplace par
  ce qu'il observe à son prochain passage.
