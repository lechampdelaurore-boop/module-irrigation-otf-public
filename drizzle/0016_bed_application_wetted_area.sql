-- Étape 5.0 : surface mouillée en aspersion (docs/wetted-surface-contract.md).
--
-- Une application d'irrigation garde `bed_area_square_meters`, la surface de
-- la planche, qui pondère les millimètres. Elle gagne la surface qui convertit
-- ces millimètres en volume : la planche seule en goutte-à-goutte, la planche
-- et son passe-pied en aspersion, inconnue (NULL) quand le passe-pied n'est pas
-- renseigné dans Ouvre ta ferme.
--
-- Les lignes existantes reçoivent leur surface de planche (décision D-023) :
-- leurs volumes ne bougent pas, et un NULL ne veut plus dire qu'une chose,
-- une surface inconnue au moment de l'enregistrement.
ALTER TABLE `irrigation_bed_applications`
  ADD COLUMN `wetted_area_square_meters` real
  CHECK (`wetted_area_square_meters` IS NULL OR `wetted_area_square_meters` > 0);
--> statement-breakpoint
UPDATE `irrigation_bed_applications`
SET `wetted_area_square_meters` = `bed_area_square_meters`
WHERE `wetted_area_square_meters` IS NULL;
