UPDATE `irrigation_garden_group_members`
SET `position` = `position` + 100
WHERE `group_id` = 'e23f91f7-405a-4caa-81b1-f93299fdf260'
  AND `otf_plot_id` IN ('51', '54', '55', '56', '57', '58', '30564');
--> statement-breakpoint
UPDATE `irrigation_garden_group_members`
SET
  `position` = CASE `otf_plot_id`
    WHEN '51' THEN 1
    WHEN '54' THEN 2
    WHEN '55' THEN 3
    WHEN '56' THEN 4
    WHEN '57' THEN 5
    WHEN '58' THEN 6
    WHEN '30564' THEN 7
  END,
  `gap_before_meters` = CASE `otf_plot_id`
    WHEN '51' THEN 0
    WHEN '30564' THEN 1
    ELSE 1.65
  END,
  `updated_at` = CURRENT_TIMESTAMP
WHERE `group_id` = 'e23f91f7-405a-4caa-81b1-f93299fdf260'
  AND `otf_plot_id` IN ('51', '54', '55', '56', '57', '58', '30564');
