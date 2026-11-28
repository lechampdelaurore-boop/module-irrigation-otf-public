-- L'ET0 horaire, la forme de la journée (docs/et0-horaire-contract.md, § 5 ;
-- D-349, PR HR2). Migration additive : une table neuve, aucune ligne
-- existante ne change, aucune table n'est recréée, aucun export de la base
-- demandé avant la fusion (comme 0046).
--
-- Une ligne par lieu, jour civil du lieu et source de la prévision : les
-- parts de la journée (une par heure, 23, 24 ou 25 ; leur somme vaut 1), en
-- tableau JSON borné, la nature (`provider-hourly` : l'heure du fournisseur ;
-- `computed-hourly` : l'heure calculée par le module) et l'heure de lecture.
-- La forme théorique du soleil ne s'écrit pas : elle se calcule à l'écran.
--
-- Le lieu (`place_key`) est celui de la lecture partagée de la météo
-- (latitude et longitude de la commune à six décimales, fuseau) : une
-- lecture par lieu, la même forme pour toutes les fermes de ce lieu. La
-- source (`open-meteo:<modèle>`, `visual-crossing`…) est celle de la ligne
-- du jour : une ferme lit la forme du modèle de sa propre ligne, jamais une
-- autre (contrat, § 9 ; D-339).
--
-- Seuls J0 à J+2 s'écrivent, au matin et aux relectures de la journée :
-- au plus 3 lignes par lieu, source et lecture. La purge du matin garde
-- 8 jours. Aucune ligne n'est d'une ferme : la table n'est pas au plan
-- d'effacement d'une ferme (`KEPT_TABLES` dit pourquoi).
--
-- Numéro 0054 : après 0051 (S6, #235), 0052 (hors saison, #256) et 0053
-- (météo multi-modèles, #250), réglé par fusion de `main`, jamais un rebase.
CREATE TABLE `irrigation_weather_day_shapes` (
  `place_key` text NOT NULL,
  `day` text NOT NULL,
  `source` text NOT NULL,
  `nature` text NOT NULL,
  `hour_count` integer NOT NULL,
  `shares` text NOT NULL,
  `fetched_at` text NOT NULL,
  PRIMARY KEY (`place_key`, `day`, `source`),
  CONSTRAINT `chk_day_shapes_day` CHECK (`day` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  CONSTRAINT `chk_day_shapes_nature` CHECK (`nature` IN ('provider-hourly', 'computed-hourly')),
  CONSTRAINT `chk_day_shapes_hours` CHECK (`hour_count` BETWEEN 23 AND 25),
  CONSTRAINT `chk_day_shapes_shares` CHECK (json_valid(`shares`) AND json_type(`shares`) = 'array' AND json_array_length(`shares`) = `hour_count`),
  CONSTRAINT `chk_day_shapes_source` CHECK (length(`source`) BETWEEN 1 AND 128),
  CONSTRAINT `chk_day_shapes_place` CHECK (length(`place_key`) BETWEEN 1 AND 128)
);
--> statement-breakpoint
CREATE INDEX `idx_day_shapes_day` ON `irrigation_weather_day_shapes` (`day`);
