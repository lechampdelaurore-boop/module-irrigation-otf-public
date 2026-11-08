ALTER TABLE `irrigation_workspaces` ADD `water_budget_revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER `irrigation_water_budget_revision_guard`
BEFORE UPDATE OF `water_budget_revision` ON `irrigation_workspaces`
WHEN NEW.water_budget_revision != OLD.water_budget_revision + 1
BEGIN
  SELECT RAISE(ABORT, 'WATER_BUDGET_CHANGED');
END;
