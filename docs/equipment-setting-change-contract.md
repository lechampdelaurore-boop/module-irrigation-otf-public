# Contrat — changer le réglage appliqué sans déplacer le matériel

Écrit le 24 septembre 2026, avant le code, à la demande du porteur de projet :
« je voudrais que le changement de réglage, je n'aie pas besoin de passer par
l'option déplacer. Je veux pouvoir le faire indépendamment. Ce qui correspond à
la réalité, car en général, une rampe d'aspersion n'est pas déplacée lorsqu'on
modifie le réglage. Ça doit être deux actions distinctes. »

## La règle

**Changer le réglage appliqué à un matériel est une action distincte du
placement.** Elle ne touche ni l'ancrage, ni les planches sélectionnées, ni le
jardin, ni le groupe aligné. Elle ne demande donc pas d'ouvrir le plan.

Trois actions cohabitent, et il faut les nommer pour ne plus les confondre :

| Action | Ce qu'elle change | Où |
| --- | --- | --- |
| Modifier un réglage | Les valeurs d'un réglage : débit uniforme, ou profil distance/débit | « Configurer les réglages » |
| **Changer le réglage appliqué** | **Lequel des réglages du matériel s'applique à sa position actuelle** | **Sur la fiche du matériel** |
| Déplacer | L'ancrage et les planches alimentées | « Déplacer » |

## Pourquoi c'est sans danger

Le point qui aurait pu tout compliquer ne se pose pas. Les planches couvertes ne
sont pas recopiées au moment du placement :

- pour une **aspersion**, `calculateIrrigationCoverage` les déduit de l'ancrage
  et du profil du réglage, à chaque calcul ;
- pour un **goutte-à-goutte**, elles viennent des planches sélectionnées, que le
  réglage ne touche pas — un réglage de goutte-à-goutte ne porte qu'un débit
  uniforme.

Changer le seul `setting_id` de la position suffit donc, et la couverture suit
d'elle-même. Passer d'une portée de 7,8 m à 4 m rétrécit l'arrosage sans qu'on
ait rien d'autre à recalculer, et c'est le comportement attendu.

## Ce que l'action refuse

- Un réglage qui n'appartient pas à ce matériel.
- Un réglage dont la nature ne correspond pas à celle du matériel : un profil
  d'aspersion sur un goutte-à-goutte, ou l'inverse.
- Un matériel archivé, ou appartenant à un autre propriétaire : la réponse est
  « introuvable », sans distinction, comme partout ailleurs.
- Un matériel sans position pour cette saison : il n'y a alors rien à changer,
  c'est « Placer » qu'il faut.

## Ce que l'action garantit

- **Elle n'écrit que `setting_id` et `updated_at`.** L'ancrage, le jardin, le
  groupe et les planches sélectionnées sont laissés intacts, et une lecture
  après coup le vérifie.
- **Elle ne touche pas à l'historique.** Une irrigation déjà enregistrée garde
  la copie du matériel, du réglage et de la position sous lesquels elle a eu
  lieu (D-006), ce qu'éprouve déjà le test de persistance ajouté le même jour.
- **Elle fait recalculer la faisabilité**, puisque changer la portée change les
  planches arrosées et donc la chaîne hydraulique. L'écran ne doit pas rester
  sur des chiffres périmés : leçon de la 3.1 bis, où une action avait rafraîchi
  un fragment au lieu du tableau de bord.

## Interface

Sur la fiche d'un matériel **positionné** qui possède **au moins deux
réglages**, une liste déroulante « Réglage appliqué ». Elle n'apparaît pas
autrement : un seul réglage ne laisse aucun choix, et un matériel non posé n'a
pas de position à modifier.

Le choix s'applique immédiatement, sans bouton de validation supplémentaire :
c'est un réglage réversible d'un seul clic, pas une décision engageante comme
l'arbitrage de la pénurie. Un message confirme, et la faisabilité se recalcule.

## Preuve de fin

Tests de persistance : le réglage appliqué change et rien d'autre ne bouge ;
un réglage étranger au matériel est refusé ; un matériel sans position est
refusé ; l'isolation par propriétaire tient. Lignes de recette ajoutées à
`docs/recette-materiel-reglages.md`. Registres à jour.
