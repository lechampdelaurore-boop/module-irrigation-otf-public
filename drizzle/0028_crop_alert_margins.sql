-- Les marges de gel réglables (retour du porteur, 7 novembre 2026, précision P44 de docs/feature-selection-contract.md) :
-- deux colonnes ajoutées aux révisions des réglages des alertes par culture. Les révisions déjà enregistrées prennent
-- les valeurs du contrat, 3 °C pour une culture sensible et 2 °C pour une rustique : rien ne change pour une ferme
-- tant qu'elle ne les règle pas. Additif.
ALTER TABLE `irrigation_crop_alert_settings` ADD `frost_margin_sensitive_celsius` real DEFAULT 3 NOT NULL CONSTRAINT `chk_crop_alert_settings_margin_sensitive` CHECK (`frost_margin_sensitive_celsius` BETWEEN 0 AND 5 AND `frost_margin_sensitive_celsius` * 2 = round(`frost_margin_sensitive_celsius` * 2));--> statement-breakpoint
ALTER TABLE `irrigation_crop_alert_settings` ADD `frost_margin_hardy_celsius` real DEFAULT 2 NOT NULL CONSTRAINT `chk_crop_alert_settings_margin_hardy` CHECK (`frost_margin_hardy_celsius` BETWEEN 0 AND 5 AND `frost_margin_hardy_celsius` * 2 = round(`frost_margin_hardy_celsius` * 2));
