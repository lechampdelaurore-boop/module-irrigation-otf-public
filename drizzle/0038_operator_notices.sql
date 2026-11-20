-- Tranche 4, sous-tranche 4.5, PR 2 : la veille de l'exploitant
-- (docs/tranche-4-contract.md, section 10 bis, F566, et section 10 bis.12,
-- F608 à F613).
--
-- Chaque jour à 9 h, la veille lit le registre des tâches et, s'il le faut,
-- envoie une notification à l'exploitant : une alerte quand une tâche est en
-- retard ou en panne, « tout va bien » le dimanche. Cette table garde la
-- notification de chaque jour de Paris (`paris_day`, « 2026-11-14 ») : une
-- veille relancée le même jour ne la renvoie pas. Une ligne par jour au plus,
-- prise avant l'envoi et rendue si l'envoi échoue, pour qu'une relance
-- puisse réessayer. Une table commune : le genre de la notification, le
-- nombre de tâches en cause et l'heure, jamais une donnée d'une ferme.
--
-- Migration additive (docs/migrations-contract.md) : une table ; aucune ligne
-- n'est écrite ici, aucune ligne existante ne change.
CREATE TABLE `irrigation_operator_notices` (
  `paris_day` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `problems` integer NOT NULL,
  `claimed_at` text NOT NULL,
  `sent_at` text,
  CONSTRAINT "chk_irrigation_operator_notices_kind" CHECK("irrigation_operator_notices"."kind" IN ('alert', 'all-good')),
  CONSTRAINT "chk_irrigation_operator_notices_problems" CHECK("irrigation_operator_notices"."problems" >= 0)
);
