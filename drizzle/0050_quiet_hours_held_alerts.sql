-- Les heures de silence des notifications, PR H2 (docs/heures-de-silence-contract.md,
-- S9 ; D-324) : une alerte météo ou par culture retenue pendant les heures de
-- silence part à la fin de la plage, par une alarme du Worker de notification.
-- L'alerte est enregistrée à son heure, comme avant (D-006) ; `held_until` dit
-- jusqu'à quand son message a été retenu sur le téléphone : un instant UTC, la
-- fin de la plage. Vide pour toute alerte partie tout de suite, et pour toutes
-- les alertes d'avant : rien ne change pour elles.
ALTER TABLE `irrigation_weather_alerts` ADD `held_until` text;--> statement-breakpoint
ALTER TABLE `irrigation_crop_alerts` ADD `held_until` text;
