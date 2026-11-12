# Sous-tranche 3.2 — Pompes et contraintes hydrauliques simples

## Périmètre

La chaîne métier est `origine d’eau → pompe d’irrigation → irrigation`. Une origine est une ressource directe ou une réserve définie par la 3.1. Une pompe porte une seule contrainte hydraulique : son débit maximal en m³/h. La pression, la HMT, les pertes de charge, les conduites, les pompes de transfert, l’électricité et la planification automatique sont hors périmètre.

La configuration est progressive et facultative. Sans pompe, une irrigation reste enregistrable, planifiable et démarrable ; son état est « Faisabilité hydraulique non vérifiée », jamais « impossible ».

## Données et relations

- `irrigation_pumps` contient l’identifiant stable, le workspace, le nom, le débit maximal, l’état actif/archivé et les notes.
- `irrigation_pump_origins` est une relation multiple. Une pompe peut avoir zéro, une ou plusieurs origines et au plus une origine par défaut. Une même réserve peut alimenter plusieurs pompes.
- `irrigation_equipment_pump_defaults` associe facultativement un matériel à sa pompe habituelle. Cette valeur est seulement présélectionnée et peut être remplacée pour une irrigation.
- `irrigation_event_equipment` conserve la pompe et l’origine choisies, le débit calculé et des snapshots immuables du nom et du débit maximal de la pompe ainsi que de l’origine.
- `irrigation_pump_log` trace les créations, modifications, archivages, réactivations et associations.

Changer l’origine ponctuellement ne modifie pas l’origine par défaut. Renommer une pompe, réduire sa capacité ou modifier son origine par défaut ne réécrit jamais les irrigations historiques.

## La fiche d’une pompe

Sur la page « Ressources et pompes » (3.8), la fiche d’une pompe propose pour origines possibles les ressources et les réserves de l’exploitation telles qu’elles sont, pas telles qu’elles étaient au chargement de la page : une ressource ou une réserve créée, modifiée ou rendue inactive dans le panneau des ressources paraît aussitôt dans la fiche, sous son nom et son état, et dans les origines des cartes des pompes. La gestion des pompes relit pour cela son tableau au serveur quand le panneau des ressources lui signale un changement, sans rien recevoir d’autre que ce signal ; le serveur vérifie toujours, à l’enregistrement, que chaque origine appartient à l’exploitation (`assertOriginsOwned`). Précisé le 9 novembre 2026 (point ouvert 60, D-093) : la fiche disait « Créez d’abord une ressource ou une réserve » juste après « La réserve a été créée. », jusqu’au rechargement de la page.

## Calcul et simultanéité

Le débit demandé réutilise les applications par planche issues du moteur de couverture existant : `débit (m³/h) = somme(mm/h × m²) / 1000`. Aucun second moteur de débit n’est introduit.

Les intervalles se chevauchant sur une même pompe sont découpés aux heures de début et de fin ; les débits sont additionnés dans chaque segment. Les pompes différentes sont indépendantes. Une irrigation en pause, terminée ou annulée ne consomme aucune capacité future. Une reprise est revalidée.

Une action nouvelle ou planifiée est refusée si la pompe est archivée, si la capacité est dépassée ou si l’origine connue est indisponible. Une irrigation déjà réalisée est toujours conservée : un dépassement devient un avertissement historique.

## Intégration 3.1

La capacité de pompe (m³/h), le stock (m³) et une limite de prélèvement (m³/jour) restent trois informations distinctes. Les services de la 3.1 déterminent si une ressource est active sur la période, si sa limite quotidienne est disponible, ou si le stock mobilisable d’une réserve suffit. Un volume de réserve inconnu n’empêche pas de valider le débit de la pompe ; la disponibilité du volume est alors « non vérifiable ». Le jour d’un créneau — pour sa période de disponibilité, la limite en vigueur et les prélèvements déjà faits ce jour-là — est celui de la ferme, `Europe/Paris` (D-004), jamais celui d’UTC : un créneau de 0 h 30 compte pour son propre jour, comme dans le moteur de planning (précisé le 9 octobre 2026, point ouvert 14). Les prélèvements déjà faits ce jour-là comptent tout ce que la ressource a fourni, prélèvements directs d’irrigation et apports à une réserve, comme dans le moteur de planning et par la même fonction du domaine, `actualWithdrawalsByResourceAndDate` (D-035, point ouvert 38, 9 octobre 2026).

## Concurrence et performance

Les recherches D1 sont bornées à la pompe et à l’intervalle concernés. Les validations de création, planification, démarrage, reprise et modification sont répétées côté serveur. La révision atomique `hydraulic_revision` empêche deux validations simultanées de confirmer le même état hydraulique observé.

## Service destiné aux prochaines sous-tranches

`validatePumpAssignmentForUser` renvoie l’affectation historisable et un résultat explicable : faisabilité, débit demandé, débit déjà engagé, total, capacité, capacité restante, dépassement, irrigations en conflit et disponibilité de l’origine. Les sous-tranches suivantes doivent réutiliser ce service et ne pas réimplémenter ces règles.
