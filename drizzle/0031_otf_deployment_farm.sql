-- Tranche 4, sous-tranches 4.1 et 4.2 : la ferme de la clé du déploiement
-- (docs/tranche-4-contract.md, section 5 bis, F330, et section 5 ter, F339).
--
-- Avant la 4.3, le module lit Ouvre ta ferme avec une seule clé, celle du
-- déploiement, rattachée à une seule ferme. Cette table garde la dernière
-- ferme que `GET /me` a désignée pour elle, et l'heure de cette observation :
-- une seule ligne (`id` = 1). La connexion en tire la clé d'espace de chaque
-- personne ; la lecture d'OTF la remet à jour.
--
-- Migration additive (docs/migrations-contract.md) : une table ; aucune ligne
-- n'est écrite ici, aucune ligne existante ne change.
CREATE TABLE `otf_deployment_farm` (
  `id` integer PRIMARY KEY NOT NULL,
  `otf_farm_id` text NOT NULL,
  `observed_at` text NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  CONSTRAINT "chk_otf_deployment_farm_single_row" CHECK("otf_deployment_farm"."id" = 1)
);
