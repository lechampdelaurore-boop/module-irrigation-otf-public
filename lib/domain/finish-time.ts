/**
 * « Heure réelle de fin » à la minute (audit du 19 novembre 2026, lot K,
 * n° 21, F472) : le champ ne montre plus les secondes ; laissé tel quel, il
 * rend l'heure proposée à la seconde, celle du minuteur, pour que la durée
 * enregistrée ne perde rien. Une heure tapée se lit à la minute.
 */
export function finishInputText(precise: string): string {
  return precise.slice(0, 16);
}

export function finishValueToSend(input: string, precise: string): string {
  return input === finishInputText(precise) ? precise : input;
}
