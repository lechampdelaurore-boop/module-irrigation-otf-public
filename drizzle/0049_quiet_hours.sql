-- Les heures de silence des notifications, PR H1 (docs/heures-de-silence-contract.md,
-- section 4 ; D-320) : le réglage d'une ferme, dans la ligne de ses messages du
-- téléphone, sans nouvelle table. Une colonne vide vaut le défaut, jamais écrit
-- en base : plage éteinte (choix 2, D-028), de 22 h à 6 h à l'allumage (choix 3),
-- le gel qui passe (choix 5). Aucune ferme ne change tant qu'elle n'allume pas
-- la plage.
--
-- `quiet_hours` : la plage allumée (1) ou éteinte (0).
-- `quiet_start` : son début, « HH:MM » de 20:00 à 23:45 au quart d'heure, heure de Paris.
-- `quiet_end` : sa fin, « HH:MM » de 04:00 à 09:00 au quart d'heure, heure de Paris.
-- `quiet_frost_passes` : « Laisser passer les alertes de gel », cochée (1) ou non (0).
--
-- Les contraintes tiennent les bornes de la règle S1, comme celle de l'heure du
-- rappel du soir : un réglage hors des bornes est refusé à l'écriture.
--
-- La table est déjà dans le plan d'effacement (`SPACE_TABLES`, F563) : ses
-- colonnes partent avec elle.
--
-- Migration additive (docs/migrations-contract.md) : quatre colonnes acceptant
-- NULL ; aucune ligne existante ne change.
ALTER TABLE `irrigation_phone_notice_settings` ADD `quiet_hours` integer CONSTRAINT `chk_phone_notice_settings_quiet` CHECK (`quiet_hours` IS NULL OR `quiet_hours` IN (0, 1));--> statement-breakpoint
ALTER TABLE `irrigation_phone_notice_settings` ADD `quiet_start` text CONSTRAINT `chk_phone_notice_settings_quiet_start` CHECK (`quiet_start` IS NULL OR `quiet_start` IN ('20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45'));--> statement-breakpoint
ALTER TABLE `irrigation_phone_notice_settings` ADD `quiet_end` text CONSTRAINT `chk_phone_notice_settings_quiet_end` CHECK (`quiet_end` IS NULL OR `quiet_end` IN ('04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45', '06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45', '09:00'));--> statement-breakpoint
ALTER TABLE `irrigation_phone_notice_settings` ADD `quiet_frost_passes` integer CONSTRAINT `chk_phone_notice_settings_quiet_frost` CHECK (`quiet_frost_passes` IS NULL OR `quiet_frost_passes` IN (0, 1));
