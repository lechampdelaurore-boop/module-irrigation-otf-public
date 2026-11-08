# Sous-tranche 3.3 — Besoins planifiables et priorités

Cette sous-tranche répond uniquement à la question « combien d’eau chaque planche doit-elle encore recevoir cette semaine ? ». Elle ne vérifie ni la ressource en eau, ni la pompe, ni un créneau : ces faisabilités restent hors périmètre et seront traitées à partir de la 3.4.

## Période et sources

La période est la semaine civile courante, du lundi 00:00 au lundi suivant 00:00, dans le fuseau `Europe/Paris`. L’échéance affichée est le dimanche en fin de journée. Les planches, jardins, parcelles et le statut d’abri viennent exclusivement de l’instantané OTF autorisé. Un abri est reconnu par `Plot.mode === 'greenhouse'`, jamais par son nom.

Le service réutilise en une seule agrégation les événements d’irrigation, les révisions d’objectifs et les sept valeurs quotidiennes déjà présentes dans le cache météo de la 2.8. Il ne provoque aucun nouvel appel externe.

## Calcul par planche

- `demande de la semaine = objectif historique applicable` ; l’ET0 n’y entre pas (décision D-010, cahier des charges sections 10 et 11).
- `reste réel = max(0, objectif − pluie réelle − irrigation réelle confirmée)`.
- `reste brut à planifier = max(0, objectif − pluie réelle − pluie prévue − irrigation réelle confirmée − irrigation future planifiée)`.
- le seuil d’exploitation met à zéro uniquement un reste brut strictement inférieur au seuil ; la valeur brute demeure affichée ;
- le besoin effectif est le calcul après seuil, sauf lorsqu’un remplacement manuel hebdomadaire, y compris `0`, est actif ;
- `volume m³ = besoin effectif en mm × surface mouillée en m² / 1000`. La surface mouillée est celle du matériel positionné sur la planche (`docs/wetted-surface-contract.md`, D-022) : la planche seule en goutte-à-goutte, la planche et son passe-pied en aspersion, la plus grande quand les deux y sont, la planche seule quand rien n'y est posé. Une aspersion sur une planche sans passe-pied connu rend le volume inconnu, jamais nul (D-003) ; les millimètres restent calculables.

La pluie retenue pour un jour écoulé est, dans l'ordre : la mesure du pluviomètre — qui se retire par l'écran quand elle a été saisie par erreur, « Retirer la mesure », la réanalyse reprenant alors (31 octobre 2026) —, sinon la réanalyse, sinon la prévision enregistrée pour ce jour-là, sinon `0`. Pour un jour à venir, c'est la prévision, sinon `0` (décision D-019). Chaque jour de la semaine compte une seule fois ; le jour courant est rattaché aux jours écoulés et n'est jamais déduit une seconde fois au titre de la prévision. Sous abri, la pluie extérieure réelle et prévue vaut explicitement `0`. Un zéro reçu du fournisseur reste un zéro valide. Le déficit relatif vaut `reste réel / objectif × 100`, ou `0 %` lorsque l’objectif est nul.

L’ET0 de la période, `réanalyse disponible depuis lundi + prévision disponible jusqu’à dimanche`, est affichée pour information à côté de l’objectif, avec sa part réanalysée, sa part prévue et ses jours manquants. Elle n’entre dans aucune formule et une ET0 incomplète ne rend jamais le besoin incalculable. Jusqu’au 18 septembre 2026, la demande était plafonnée par `min(ET0 période, objectif)` ; ce plafond a été retiré par la sous-tranche 3.3.1.

Seul un objectif hebdomadaire absent rend un besoin non calculable : sans cible, il n'y a rien à calculer, et un zéro ferait passer une planche oubliée pour une planche servie. Un objectif posé en cours de semaine vaut pour ses jours restants : la demande de la semaine est la somme des septièmes de l’objectif sur les jours qu’il couvre, et seule une semaine dont aucun jour n’est couvert est sans objectif ; les jours sans objectif ne sont pas une donnée manquante, ils n’avaient pas de cible (D-034, point ouvert 16, 9 octobre 2026). Une donnée météo manquante ne rend jamais un besoin non calculable (décision D-019). Chaque planche expose la liste exacte des dates sans pluie réelle et, parmi elles, celles reprises de la prévision ; les autres ont été comptées zéro. L'interface affiche alors le besoin suivi de la mention « partiel » et de ces dates, comme elle le fait déjà pour l'ET0. La complétude reste publiée par étape, demande, reste réel et reste à planifier, mais elle qualifie désormais la confiance dans la valeur, non sa disponibilité.

Les objectifs sont relus comme un historique journalier. Une modification en milieu de semaine s’applique à partir de son jour civil ; une reprise automatique de la semaine précédente s’applique dès le lundi.

## Décisions persistées

La migration `0011_irrigation_needs_priorities` conserve uniquement le seuil minimal commun à l’exploitation, la priorité hebdomadaire de chaque planche (`low`, `normal`, `high`, par défaut `normal`), un remplacement manuel facultatif et sa raison, ainsi que la valeur calculée au moment du remplacement, l’utilisateur, la date, la saison et la semaine. Un journal append-only trace les changements.

Les valeurs dérivées ne sont jamais stockées. Priorités et remplacements sont recherchés par exploitation, saison, semaine et identifiant de planche ; ils expirent donc naturellement le lundi suivant. Toutes les écritures vérifient la session, l’exploitation et l’existence des identifiants dans l’instantané OTF de la saison.

## Agrégats et contrat aval

Au niveau jardin, les millimètres sont pondérés par la surface **de la planche** : `Σ(mm × m²) / Σ(m²)`, jamais par la surface mouillée. Les volumes sont additionnés ; un volume inconnu laisse le total du jardin inconnu. Les priorités ne sont pas moyennées : l’interface affiche leur nombre par niveau.

Le service `getIrrigationNeedsDashboardForUser` fournit aux futures sous-tranches le détail complet par planche, la complétude séparée de la demande, du besoin réel et du besoin à planifier, les dates météo manquantes, l'origine de l'objectif, la date de calcul, le seuil et les agrégats. Il ne fournit aucun score combiné, aucun ordre automatique et aucune décision de faisabilité.
