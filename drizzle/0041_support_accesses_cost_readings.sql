-- Tranche 4, sous-tranche 4.5, PR 5 (troisième partie) : le journal d'accès
-- du support et le relevé des coûts (docs/tranche-4-contract.md, section
-- 10 bis, F565 point 6, F567, F568, et section 10 bis.21, F660 à F664).
--
-- `irrigation_support_accesses` : chaque fois que l'exploitant regarde les
-- données d'une ferme pour l'aider ou corriger une panne, il le note sur la
-- page d'état : le jour, la ferme (son identifiant d'Ouvre ta ferme) et la
-- raison en une ligne, jamais ce qu'il a vu. Gardé 12 mois (la purge du
-- matin), et effacé avec le dernier espace de la ferme. Une table commune,
-- d'aucun espace.
--
-- `irrigation_cost_readings` : le relevé du mois, copié à la main depuis le
-- tableau de bord de Cloudflare (requêtes, calcul, lignes lues et écrites,
-- stockage, facture). Des nombres du déploiement, d'aucune ferme ; un relevé
-- par mois, qu'un nouveau relevé du même mois remplace.
--
-- Migration additive (docs/migrations-contract.md) : deux tables et un
-- index ; aucune ligne n'est écrite ici, aucune ligne existante ne change.
CREATE TABLE `irrigation_support_accesses` (
  `id` text PRIMARY KEY NOT NULL,
  `otf_farm_id` text NOT NULL,
  `accessed_on` text NOT NULL,
  `reason` text NOT NULL,
  `recorded_at` text NOT NULL,
  CONSTRAINT "chk_irrigation_support_accesses_day" CHECK(length("irrigation_support_accesses"."accessed_on") = 10),
  CONSTRAINT "chk_irrigation_support_accesses_reason" CHECK(length(trim("irrigation_support_accesses"."reason")) BETWEEN 3 AND 200)
);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_support_accesses_day` ON `irrigation_support_accesses` (`accessed_on`);
--> statement-breakpoint
CREATE TABLE `irrigation_cost_readings` (
  `month` text PRIMARY KEY NOT NULL,
  `workers_requests` integer NOT NULL,
  `workers_cpu_ms` integer NOT NULL,
  `d1_rows_read` integer NOT NULL,
  `d1_rows_written` integer NOT NULL,
  `d1_storage_mb` real NOT NULL,
  `billed_usd` real,
  `recorded_at` text NOT NULL,
  CONSTRAINT "chk_irrigation_cost_readings_month" CHECK(length("irrigation_cost_readings"."month") = 7),
  CONSTRAINT "chk_irrigation_cost_readings_counts" CHECK("irrigation_cost_readings"."workers_requests" >= 0 AND "irrigation_cost_readings"."workers_cpu_ms" >= 0 AND "irrigation_cost_readings"."d1_rows_read" >= 0 AND "irrigation_cost_readings"."d1_rows_written" >= 0 AND "irrigation_cost_readings"."d1_storage_mb" >= 0),
  CONSTRAINT "chk_irrigation_cost_readings_billed" CHECK("irrigation_cost_readings"."billed_usd" IS NULL OR "irrigation_cost_readings"."billed_usd" >= 0)
);
