-- Sous-tranche 2.11 : pose datée et stockage du matériel
-- (docs/equipment-placement-periods-contract.md, décision D-043).
--
-- La ligne de position reste la pose courante d'un matériel pour une saison.
-- Elle gagne une date de pose et une date de retrait. Une position existante
-- n'a pas de date de pose connue : elle reste NULL, « date de pose non
-- renseignée » (règle 7), jamais une date inventée. Sans date de retrait, le
-- matériel est posé ; avec, il est stocké.
--
-- Chaque pose qui se ferme, par un retrait ou un déplacement, est copiée dans
-- le registre des poses, en ajout seul : rien ne s'efface (règle 8). La copie
-- garde l'endroit, les planches et le réglage tels qu'ils étaient, comme une
-- irrigation garde la copie de sa position (D-006).
--
-- Migration additive (docs/migrations-contract.md) : deux colonnes nullables,
-- une table, un index, un déclencheur ; l'index unique « une position par
-- matériel et par saison » reste en place.
ALTER TABLE `irrigation_equipment_placements` ADD COLUMN `placed_at` text;
--> statement-breakpoint
ALTER TABLE `irrigation_equipment_placements` ADD COLUMN `removed_at` text;
--> statement-breakpoint
CREATE TABLE `irrigation_equipment_placement_history` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`equipment_id` text NOT NULL,
	`placement_id` text NOT NULL,
	`season` integer NOT NULL,
	`placed_at` text,
	`removed_at` text NOT NULL,
	`pose_snapshot` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`equipment_id`) REFERENCES `irrigation_equipment`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_placement_history_season" CHECK("irrigation_equipment_placement_history"."season" BETWEEN 1900 AND 9999),
	CONSTRAINT "chk_placement_history_dates" CHECK("irrigation_equipment_placement_history"."placed_at" IS NULL OR "irrigation_equipment_placement_history"."placed_at" <= "irrigation_equipment_placement_history"."removed_at")
);
--> statement-breakpoint
CREATE INDEX `idx_placement_history_equipment_season` ON `irrigation_equipment_placement_history` (`equipment_id`,`season`,`removed_at`);
--> statement-breakpoint
-- Ajout seul : une pose fermée ne se réécrit pas. Elle ne s'efface qu'avec
-- son matériel, quand celui-ci n'a jamais arrosé et que l'utilisateur le
-- supprime.
CREATE TRIGGER guard_placement_history_append_only BEFORE UPDATE ON irrigation_equipment_placement_history BEGIN SELECT RAISE(ABORT, 'placement_history_append_only'); END;
