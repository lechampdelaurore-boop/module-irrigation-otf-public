-- Q2 (tests d'exécution de la persistance) : la contrainte
-- chk_irrigation_bed_need_override ne refuse pas un besoin calculé mémorisé
-- sans remplacement (manual_override_mm NULL, calculated_need_at_override_mm
-- renseigné) : la comparaison de NULL avec une borne vaut NULL et SQLite laisse
-- passer un CHECK indéterminé. SQLite ne permet pas de modifier une contrainte
-- CHECK sans recréer la table : ces déclencheurs refusent explicitement l'état
-- incohérent à l'insertion et à la mise à jour. Le code applicatif n'écrit
-- jamais cet état ; le filet de sécurité redevient étanche.
CREATE TRIGGER guard_irrigation_bed_need_override_insert
BEFORE INSERT ON irrigation_bed_need_decisions
WHEN NEW.manual_override_mm IS NULL AND NEW.calculated_need_at_override_mm IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'bed_need_override_inconsistent');
END;
--> statement-breakpoint
CREATE TRIGGER guard_irrigation_bed_need_override_update
BEFORE UPDATE ON irrigation_bed_need_decisions
WHEN NEW.manual_override_mm IS NULL AND NEW.calculated_need_at_override_mm IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'bed_need_override_inconsistent');
END;
