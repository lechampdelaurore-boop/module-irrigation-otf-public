-- Sous-tranche 3.8 bis : le calculateur d'irrigation, la provenance d'un
-- réglage de matériel (docs/irrigation-calculator-contract.md, section 10,
-- D-061).
--
-- Une ligne au plus par réglage : « calculé » ou « estimé » par le
-- calculateur, avec la manière, les entrées et la version des formules pour
-- rouvrir le calculateur prérempli, le mm/h théorique, la part d'eau sur la
-- zone et l'eau pompée ; ou « mesuré », par la case de l'utilisateur, sans
-- entrées. Pas de ligne : le réglage est « saisi », comme tous ceux d'avant
-- ce lot. Les valeurs du réglage restent dans leurs tables : le moteur ne lit
-- pas celle-ci.
--
-- Migration additive (docs/migrations-contract.md) : une table ; aucun
-- réglage existant n'est touché, aucune ligne écrite.
CREATE TABLE `irrigation_equipment_setting_calculations` (
  `setting_id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `level` text NOT NULL,
  `method` text,
  `inputs_json` text,
  `theoretical_rate_mm_per_hour` real,
  `zone_share_percent` real,
  `nominal_flow_liters_per_hour` real,
  `calculated_at` text NOT NULL,
  FOREIGN KEY (`setting_id`) REFERENCES `irrigation_equipment_settings`(`id`) ON DELETE cascade,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_setting_calculation_level` CHECK (`level` IN ('calculated', 'estimated', 'measured')),
  CONSTRAINT `chk_setting_calculation_method` CHECK (
    (`level` = 'measured' AND `method` IS NULL AND `inputs_json` IS NULL)
    OR (`level` != 'measured' AND `method` IN ('drip_per_bed', 'drip_per_valve', 'sprinkler_mean', 'sprinkler_cone')
        AND `inputs_json` IS NOT NULL AND json_valid(`inputs_json`))
  ),
  CONSTRAINT `chk_setting_calculation_values` CHECK (
    (`theoretical_rate_mm_per_hour` IS NULL OR `theoretical_rate_mm_per_hour` >= 0)
    AND (`zone_share_percent` IS NULL OR `zone_share_percent` BETWEEN 1 AND 100)
    AND (`nominal_flow_liters_per_hour` IS NULL OR `nominal_flow_liters_per_hour` >= 0)
  )
);--> statement-breakpoint
CREATE INDEX `idx_setting_calculations_workspace` ON `irrigation_equipment_setting_calculations` (`workspace_id`);
