-- Tranche 4, sous-tranche 4.5, PR 2 (seconde partie) : l'observation par
-- ferme (docs/tranche-4-contract.md, section 10 bis, F564, et section
-- 10 bis.13, F614 à F619).
--
-- La page d'état de l'exploitant montre, pour chaque ferme, le taux
-- d'erreurs de ses appels à Ouvre ta ferme sur 24 heures et sur 7 jours, et
-- sa dernière lecture complète :
-- - `otf_call_outcomes` compte les appels envoyés de chaque ferme, par heure
--   pleine et par résultat (réussi, `401`, `403`, `429`, `5xx`, autre refus,
--   délai dépassé, réseau) ; une ligne par ferme, heure et résultat, gardée
--   huit jours ;
-- - `otf_farm_reads` garde en plus l'heure de la dernière lecture complète
--   de la ferme (`last_complete_at`).
-- Aucune adresse, aucun jeton, aucune personne : des fermes (leur
-- identifiant OTF, la clé du compteur), des heures et des nombres.
--
-- Migration additive (docs/migrations-contract.md) : une table, son index et
-- une colonne nulle ; aucune ligne existante ne change.
CREATE TABLE `otf_call_outcomes` (
  `pace_key` text NOT NULL,
  `hour_start_ms` integer NOT NULL,
  `outcome` text NOT NULL,
  `calls` integer DEFAULT 0 NOT NULL,
  PRIMARY KEY(`pace_key`, `hour_start_ms`, `outcome`),
  CONSTRAINT "chk_otf_call_outcomes_outcome" CHECK("otf_call_outcomes"."outcome" IN ('ok', 'unauthorized', 'forbidden', 'rate-limited', 'server', 'refused', 'timeout', 'network')),
  CONSTRAINT "chk_otf_call_outcomes_calls" CHECK("otf_call_outcomes"."calls" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_otf_call_outcomes_hour` ON `otf_call_outcomes` (`hour_start_ms`);
--> statement-breakpoint
ALTER TABLE `otf_farm_reads` ADD `last_complete_at` text;
