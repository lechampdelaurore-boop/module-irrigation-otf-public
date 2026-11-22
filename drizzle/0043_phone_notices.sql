-- Améliorations n° 3 et n° 2 (docs/ameliorations-6-2-3-7-contract.md,
-- section 4.1 et 4.2, F702, F703, F712) : le message du matin et le rappel
-- du soir.
--
-- `irrigation_phone_notice_settings` : le réglage de chaque ferme, une ligne
-- par espace, avec la personne qui l'a changé et l'heure. Une colonne vide
-- vaut le défaut (message du matin activé ; rappel du soir activé à 19 h,
-- heure de Paris, pour une ferme qui coche « Arrosages ») : aucune valeur par
-- défaut n'est écrite en base, une ferme sans ligne reçoit les défauts.
--
-- `irrigation_phone_notices` : la prise du jour de chaque message, une ligne
-- par espace et par genre (`morning`, `evening`), réécrite chaque jour. Prise
-- avant l'envoi et rendue s'il échoue : une seconde exécution du même jour de
-- Paris ne renvoie rien. Le jour et des heures, jamais le texte du message.
--
-- Les deux tables sont d'un espace : elles entrent dans le plan d'effacement
-- (`SPACE_TABLES`, F563) et partent avec lui.
--
-- Migration additive (docs/migrations-contract.md) : deux tables, vides ;
-- aucune ligne existante ne change.
CREATE TABLE `irrigation_phone_notice_settings` (
  `workspace_id` text PRIMARY KEY NOT NULL,
  `morning_message` integer,
  `evening_reminder` integer,
  `evening_time` text,
  `actor_user_id` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_phone_notice_settings_morning` CHECK (`morning_message` IS NULL OR `morning_message` IN (0, 1)),
  CONSTRAINT `chk_phone_notice_settings_evening` CHECK (`evening_reminder` IS NULL OR `evening_reminder` IN (0, 1)),
  CONSTRAINT `chk_phone_notice_settings_time` CHECK (`evening_time` IS NULL OR `evening_time` GLOB '[12][0-9]:[0-5][0-9]')
);
--> statement-breakpoint
CREATE TABLE `irrigation_phone_notices` (
  `workspace_id` text NOT NULL,
  `kind` text NOT NULL,
  `paris_day` text NOT NULL,
  `claimed_at` text NOT NULL,
  `sent_at` text,
  PRIMARY KEY(`workspace_id`, `kind`),
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_phone_notices_kind` CHECK (`kind` IN ('morning', 'evening')),
  CONSTRAINT `chk_phone_notices_day` CHECK (`paris_day` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]')
);
