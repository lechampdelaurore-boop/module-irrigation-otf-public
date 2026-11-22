/**
 * L'identifiant d'alarme et l'étiquette du message du matin et du rappel du
 * soir (améliorations n° 3 et n° 2, docs/ameliorations-6-2-3-7-contract.md,
 * section 4.4, F744) : l'espace et le jour de Paris, ensemble. Le Worker de
 * notification ne garde qu'une alarme par identifiant ; sans l'espace, deux
 * fermes qui envoient le même jour se disputeraient la même alarme et l'un
 * des messages se perdrait (revue de l'isolation du 22 novembre 2026,
 * constat A). L'étiquette porte l'espace pour la même raison sur l'appareil :
 * un téléphone inscrit dans deux espaces de la même personne garde les deux
 * messages, sans que l'un remplace l'autre.
 */

export type PhoneNoticeAlarmKind = 'morning' | 'evening';

export type PhoneNoticeAlarmKeys = {
  /** « morning:<espace>:<jour> » : un seul message par jour et par espace. */
  alarmId: string;
  /** « morning-<espace>-<jour> ». */
  tag: string;
};

export function phoneNoticeAlarmKeys(kind: PhoneNoticeAlarmKind, workspaceId: string, parisDay: string): PhoneNoticeAlarmKeys {
  return { alarmId: `${kind}:${workspaceId}:${parisDay}`, tag: `${kind}-${workspaceId}-${parisDay}` };
}
