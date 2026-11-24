-- L'objectif automatique sur l'ET0, PR O3 (docs/objectif-automatique-contract.md,
-- section 3, règle 6 ; D-309, D-318) : une semaine finie ne bouge plus.
-- Chaque matin, après la météo, la tâche du matin enregistre l'objectif
-- automatique de chaque semaine close (son dimanche est passé) où le réglage
-- de la ferme était allumé au moins un jour : une ligne par planche de la
-- saison, avec les jours allumés de la semaine, chacun avec sa valeur et la
-- nature de son ET0, ou ce qui l'empêchait ce matin-là (`days`, un tableau
-- JSON d'un à sept jours), et la semaine sans culture (`no_crop_week`).
--
-- Une ligne n'est jamais réécrite : relire la météo, corriger un Kc ou un
-- stade après coup ne change pas une semaine close, que ses lecteurs lisent
-- ici. Une semaine close sans ligne encore se relit et se dit provisoire ;
-- le matin suivant la rattrape. Les lignes se gardent autant que la ferme et
-- partent avec elle (plan d'effacement, `SPACE_TABLES`).
--
-- Rien ne s'y écrit tant qu'aucun écran n'allume le réglage (O4). La
-- faisabilité ne la lit pas : elle porte sur la semaine en cours et la
-- suivante, jamais sur une semaine close ; aucun déclencheur.
--
-- Migration additive (docs/migrations-contract.md) : une table ; aucune ligne
-- existante ne change.
CREATE TABLE `irrigation_automatic_objective_weeks` (
  `workspace_id` text NOT NULL,
  `season` integer NOT NULL,
  `week_start` text NOT NULL,
  `otf_bed_id` text NOT NULL,
  `no_crop_week` integer NOT NULL,
  `days` text NOT NULL,
  `recorded_at` text NOT NULL,
  PRIMARY KEY (`workspace_id`, `season`, `week_start`, `otf_bed_id`),
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_automatic_objective_week_season` CHECK (`season` BETWEEN 1900 AND 9999),
  CONSTRAINT `chk_automatic_objective_week_start` CHECK (`week_start` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' AND strftime('%w', `week_start`) = '1'),
  CONSTRAINT `chk_automatic_objective_week_no_crop` CHECK (`no_crop_week` IN (0, 1)),
  CONSTRAINT `chk_automatic_objective_week_days` CHECK (json_valid(`days`) AND json_type(`days`) = 'array' AND json_array_length(`days`) BETWEEN 1 AND 7)
);
