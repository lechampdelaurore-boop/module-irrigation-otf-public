-- Amélioration n° 4 : les stades sensibles au manque d'eau
-- (docs/ameliorations-4-5-contract.md, §3.1, F730 ; D-290). Migration
-- additive : deux tables neuves, aucune ligne existante ne change.
--
-- `irrigation_crop_sensitive_stage_common` : la liste préremplie commune, une
-- ligne par stade sensible d'une culture du jeu commun, avec sa source, sa
-- confiance (« source-directe » : la culture est dans le tableau 2 de la FAO ;
-- « analogie » : elle est rapprochée d'une culture voisine qui y est) et sa
-- date. Elle reprend ligne pour ligne la liste que le porteur a validée telle
-- quelle le 21 novembre 2026 à 22 h 51
-- (stades-sensibles-proposition-2026-11-21.md) ; rien n'y est ajouté. Le
-- poireau, l'oignon vert, la patate douce et l'asperge n'y ont aucune ligne :
-- aucun stade sensible tant que la ferme n'en coche pas. La reprise après
-- plantation n'est cochée nulle part.
--
-- `irrigation_crop_sensitive_stages` : le choix d'une ferme pour un stade,
-- sensible ou non, quoi que dise la liste préremplie, avec la personne qui le
-- fait et la date ; il ne vaut que pour cette ferme. La culture est désignée
-- par sa clé (`crop_key`) : la commune, ou la version de la ferme qui la
-- remplace.
--
-- Un choix et une ligne de la liste désignent un stade par son rang ET son
-- nom : quand la table des stades d'une culture change, ce qui ne correspond
-- plus au stade de ce rang ne s'applique pas.
CREATE TABLE `irrigation_crop_sensitive_stage_common` (
  `crop_key` text NOT NULL,
  `stage_rank` integer NOT NULL,
  `stage_label` text NOT NULL,
  `confidence` text NOT NULL,
  `source` text NOT NULL,
  `recorded_on` text NOT NULL,
  PRIMARY KEY (`crop_key`, `stage_rank`),
  FOREIGN KEY (`crop_key`) REFERENCES `irrigation_crop_reference_crops`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_sensitive_common_rank` CHECK (`stage_rank` >= 1),
  CONSTRAINT `chk_crop_sensitive_common_label` CHECK (length(`stage_label`) BETWEEN 1 AND 120),
  CONSTRAINT `chk_crop_sensitive_common_confidence` CHECK (`confidence` IN ('source-directe', 'analogie')),
  CONSTRAINT `chk_crop_sensitive_common_source` CHECK (length(`source`) >= 1),
  CONSTRAINT `chk_crop_sensitive_common_date` CHECK (`recorded_on` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE TABLE `irrigation_crop_sensitive_stages` (
  `workspace_id` text NOT NULL,
  `crop_key` text NOT NULL,
  `stage_rank` integer NOT NULL,
  `stage_label` text NOT NULL,
  `sensitive` integer NOT NULL,
  `actor_user_id` text NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  PRIMARY KEY (`workspace_id`, `crop_key`, `stage_rank`),
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_sensitive_stage_key` CHECK (length(`crop_key`) BETWEEN 1 AND 80),
  CONSTRAINT `chk_crop_sensitive_stage_rank` CHECK (`stage_rank` >= 1),
  CONSTRAINT `chk_crop_sensitive_stage_label` CHECK (length(`stage_label`) BETWEEN 1 AND 120),
  CONSTRAINT `chk_crop_sensitive_stage_value` CHECK (`sensitive` IN (0, 1)),
  CONSTRAINT `chk_crop_sensitive_stage_actor` CHECK (length(`actor_user_id`) >= 1)
);
--> statement-breakpoint
INSERT INTO `irrigation_crop_sensitive_stage_common` (`crop_key`, `stage_rank`, `stage_label`, `confidence`, `source`, `recorded_on`) VALUES
  ('criiam-tomate', 2, 'Reprise → Floraison 3e bouquet', 'source-directe', 'Floraison, puis formation des fruits : tomate « flowering more than yield formation », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm) ; fiche « Tomato » de la FAO (https://www.fao.org/land-water/databases-and-software/crop-information/tomato)', '2026-11-21'),
  ('criiam-tomate', 3, 'Floraison 3e bouquet → Mi-récolte', 'source-directe', 'Floraison, puis formation des fruits : tomate « flowering more than yield formation », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm) ; fiche « Tomato » de la FAO (https://www.fao.org/land-water/databases-and-software/crop-information/tomato)', '2026-11-21'),
  ('criiam-poivron', 1, 'Plantation → Début floraison', 'source-directe', 'Sensible tout le cycle : poivron « throughout », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-poivron', 2, 'Début floraison → Croissance 3e étage', 'source-directe', 'Sensible tout le cycle : poivron « throughout », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-poivron', 3, 'Croissance 3e étage → Mi-récolte', 'source-directe', 'Sensible tout le cycle : poivron « throughout », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-poivron', 4, 'Mi-récolte → Fin récolte', 'source-directe', 'Sensible tout le cycle : poivron « throughout », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-haricot', 2, 'Floraison → Formation gousses', 'source-directe', 'Floraison et remplissage des gousses : haricot « flowering and pod filling », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-haricot', 3, 'Formation gousses → Récolte', 'source-directe', 'Floraison et remplissage des gousses : haricot « flowering and pod filling », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-pomme-de-terre', 2, '20 j → Fin tubérisation', 'source-directe', 'Stolons et début de tubérisation : pomme de terre « stolonization and tuber initiation », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-oignon', 3, '60 j → Début maturité', 'source-directe', 'Grossissement du bulbe : oignon « bulb enlargement », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('fao-cruciferes', 3, 'Pleine saison', 'source-directe', 'Pommaison et maturité : chou « head enlargement and ripening », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('fao-cruciferes', 4, 'Fin', 'source-directe', 'Pommaison et maturité : chou « head enlargement and ripening », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('fao-petit-pois', 3, 'Pleine saison', 'source-directe', 'Floraison et formation des gousses : petit pois frais « flowering and yield formation », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('fao-pasteque', 3, 'Pleine saison', 'source-directe', 'Floraison et remplissage des fruits : pastèque « flowering and fruit filling », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-aubergine', 2, 'Début floraison → Croissance 3e étage', 'analogie', 'Comme la tomate (même famille, mêmes étapes) : tomate « flowering more than yield formation », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-aubergine', 3, 'Croissance 3e étage → Mi-récolte', 'analogie', 'Comme la tomate (même famille, mêmes étapes) : tomate « flowering more than yield formation », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-melon', 2, 'Début floraison → Nouaison', 'analogie', 'Comme la pastèque (floraison, remplissage) ; la fin, moins arrosée, aide le sucre : pastèque « flowering and fruit filling », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-melon', 3, 'Nouaison → Grossissement fruits', 'analogie', 'Comme la pastèque (floraison, remplissage) ; la fin, moins arrosée, aide le sucre : pastèque « flowering and fruit filling », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-courgette', 2, 'Floraison → Mi-récolte', 'analogie', 'Comme la pastèque ; la courgette fleurit et grossit ses fruits jusqu''à la fin : pastèque « flowering and fruit filling », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-courgette', 3, 'Mi-récolte → Fin récolte', 'analogie', 'Comme la pastèque ; la courgette fleurit et grossit ses fruits jusqu''à la fin : pastèque « flowering and fruit filling », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-ail', 2, 'Formation bulbe → Grossissement maxi', 'analogie', 'Comme l''oignon (grossissement du bulbe) : oignon « bulb enlargement », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-chou-fleur', 3, 'Début formation des choux → Récolte', 'analogie', 'Comme le chou (formation de la pomme) : chou « head enlargement and ripening », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-betterave', 1, 'Semis → 30 j après', 'analogie', 'Comme la betterave sucrière (premier mois après la levée) : betterave sucrière « first month after emergence », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-carotte', 1, 'Semis → 30 j après', 'analogie', 'Comme la betterave : la levée et le premier mois : betterave sucrière « first month after emergence », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-salade-ete', 2, 'Début croissance active → Récolte', 'analogie', 'Légume-feuille, classé très sensible par la FAO : tableau 1 du même chapitre, FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2 (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-fraisier', 3, 'Floraison → Grossissement fruits', 'analogie', 'Floraison et remplissage des fruits, comme les fruits du tableau 2 : FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-fraisier', 4, 'Grossissement fruits → Récolte', 'analogie', 'Floraison et remplissage des fruits, comme les fruits du tableau 2 : FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-fraisier-remontant', 3, 'Floraison → Grossissement fruits', 'analogie', 'Floraison et remplissage des fruits, comme les fruits du tableau 2 : FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-fraisier-remontant', 4, 'Grossissement fruits → Récolte', 'analogie', 'Floraison et remplissage des fruits, comme les fruits du tableau 2 : FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-artichaut-non-remontant', 3, 'Montée des capitules → 15 j avant 1re récolte', 'analogie', 'Formation de la tête, comme le chou : chou « head enlargement and ripening », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-artichaut-non-remontant', 4, '15 j avant 1re récolte → Fin 1re récolte', 'analogie', 'Formation de la tête, comme le chou : chou « head enlargement and ripening », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-artichaut-remontant', 3, 'Montée des capitules → 15 j avant 1re récolte', 'analogie', 'Formation de la tête, comme le chou : chou « head enlargement and ripening », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('criiam-artichaut-remontant', 4, '15 j avant 1re récolte → Fin 1re récolte', 'analogie', 'Formation de la tête, comme le chou : chou « head enlargement and ripening », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2, tableau 2 « Periods sensitive to water shortages » (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('fao-brocoli', 3, 'Pleine saison', 'analogie', 'Règle générale de la FAO, la pleine saison : « the mid-season stage is most sensitive to water shortages », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2 (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('fao-concombre', 3, 'Pleine saison', 'analogie', 'Règle générale de la FAO, la pleine saison : « the mid-season stage is most sensitive to water shortages », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2 (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('fao-celeri', 3, 'Pleine saison', 'analogie', 'Règle générale de la FAO, la pleine saison : « the mid-season stage is most sensitive to water shortages », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2 (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('fao-feve', 3, 'Pleine saison', 'analogie', 'Règle générale de la FAO, la pleine saison : « the mid-season stage is most sensitive to water shortages », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2 (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('fao-navet', 3, 'Pleine saison', 'analogie', 'Règle générale de la FAO, la pleine saison : « the mid-season stage is most sensitive to water shortages », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2 (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('fao-potiron', 3, 'Pleine saison', 'analogie', 'Règle générale de la FAO, la pleine saison : « the mid-season stage is most sensitive to water shortages », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2 (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('fao-radis', 3, 'Pleine saison', 'analogie', 'Règle générale de la FAO, la pleine saison : « the mid-season stage is most sensitive to water shortages », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2 (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21'),
  ('fao-epinard', 3, 'Pleine saison', 'analogie', 'Règle générale de la FAO, la pleine saison : « the mid-season stage is most sensitive to water shortages », FAO, Irrigation Water Management: Irrigation Scheduling, chapitre 2 (https://www.fao.org/4/t7202e/t7202e05.htm)', '2026-11-21');
