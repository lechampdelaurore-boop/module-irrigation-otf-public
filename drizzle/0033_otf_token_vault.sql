-- Tranche 4, sous-tranche 4.3, PR 2 : le coffre des jetons d'Ouvre ta ferme
-- (docs/tranche-4-contract.md, section 6.3, F351, F355, F356, et section
-- 6.3 quater, F397 à F403).
--
-- `otf_farm_connections` : le raccordement de chaque ferme à OTF (F351), la
-- seule ligne où ses jetons entrent dans la base. Une ferme n'a qu'un
-- raccordement (sa clé est l'identifiant OTF de la ferme), à la personne qui
-- l'a autorisée. Les deux jetons y sont chiffrés par le coffre (F355) : la
-- base ne voit que des chiffrés `v1.<empreinte de la clé>.<vecteur>.<chiffré>`,
-- liés à la ferme et à leur rôle ; la clé maîtresse n'est jamais dans la base.
-- En « reconnexion demandée », les jetons sont effacés (F358) : la contrainte
-- `chk_otf_farm_connections_tokens` l'impose, et impose des jetons à une
-- ferme « reliée » ou en « lecture refusée ».
--
-- Endormie : rien n'écrit dans cette table avant la PR 3 (l'autorisation,
-- F352, F353), et celle-ci attend `OTF_OAUTH_CLIENT_ID` et la clé maîtresse
-- (F368).
--
-- Migration additive (docs/migrations-contract.md) : une table et son index ;
-- aucune ligne existante ne change.
CREATE TABLE `otf_farm_connections` (
  `otf_farm_id` text PRIMARY KEY NOT NULL,
  `owner_user_id` text NOT NULL,
  `farm_name` text NOT NULL,
  `state` text DEFAULT 'linked' NOT NULL,
  `state_reason` text,
  `access_token_sealed` text,
  `access_expires_at_ms` integer,
  `refresh_token_sealed` text,
  `connected_at` text NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  CONSTRAINT "chk_otf_farm_connections_state" CHECK("otf_farm_connections"."state" IN ('linked', 'reconnect-required', 'read-refused')),
  CONSTRAINT "chk_otf_farm_connections_tokens" CHECK(
    ("otf_farm_connections"."state" = 'reconnect-required'
      AND "otf_farm_connections"."access_token_sealed" IS NULL
      AND "otf_farm_connections"."refresh_token_sealed" IS NULL
      AND "otf_farm_connections"."access_expires_at_ms" IS NULL)
    OR ("otf_farm_connections"."state" <> 'reconnect-required'
      AND "otf_farm_connections"."access_token_sealed" IS NOT NULL
      AND "otf_farm_connections"."refresh_token_sealed" IS NOT NULL
      AND "otf_farm_connections"."access_expires_at_ms" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE INDEX `idx_otf_farm_connections_owner` ON `otf_farm_connections` (`owner_user_id`);
