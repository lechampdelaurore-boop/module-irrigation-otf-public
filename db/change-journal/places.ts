import type { ValidGardenGroupInput } from '@/lib/domain/garden-group-domain';
import { journalCreation, journalDeletion, journalUpdate, plainNumber, sqlLiteral, type JournalGesture, type JournalLine, type JournalTarget } from './statements';

/**
 * Les lignes du journal des modifications pour les lieux de la ferme
 * (amélioration n° 7, F718 ; D-289) : un jardin classé sous abri ou de plein
 * champ, les groupes de jardins, le lieu de la météo. Mêmes règles que les
 * autres réglages (D-286, F716).
 */

// --- Les jardins sous abri -------------------------------------------------------

function shelterLine(subject: 'jardin-sous-abri', gesture: JournalGesture, plotId: string): JournalLine {
  return { ...gesture, subject, objectId: plotId, context: { plotId: { value: plotId } } };
}

function shelterTarget(gesture: JournalGesture, plotId: string): JournalTarget {
  return { table: 'irrigation_plot_shelters', where: 'current.workspace_id = ? AND current.otf_plot_id = ?', params: [gesture.workspaceId, plotId] };
}

/**
 * Un jardin classé sous abri ou de plein champ, ou remis « à classer »
 * (`null`) : placée avant l'écriture. La proposition du module, gardée à
 * côté, n'est pas un geste : seul le classement compte.
 */
export function plotShelterJournal(subject: 'jardin-sous-abri', gesture: JournalGesture, plotId: string, sheltered: boolean | null): D1PreparedStatement {
  const field = { key: 'sheltered', current: 'current.sheltered' };
  return sheltered === null
    ? journalDeletion(shelterLine(subject, gesture, plotId), shelterTarget(gesture, plotId), [field])
    : journalUpdate(shelterLine(subject, gesture, plotId), shelterTarget(gesture, plotId), [{ ...field, next: sheltered }], 'create');
}

// --- Les groupes de jardins -------------------------------------------------------

/** Les jardins d'un groupe, dans leur ordre : `[[jardin, sens, écart], …]`. */
const MEMBERS_TEXT = `('' || (SELECT json_group_array(json_array(otf_plot_id, bed_order, ${plainNumber('gap_before_meters')}))
  FROM (SELECT otf_plot_id, bed_order, gap_before_meters FROM irrigation_garden_group_members WHERE group_id = current.id ORDER BY position)))`;

function membersText(group: ValidGardenGroupInput): string {
  return JSON.stringify([...group.members].sort((a, b) => a.position - b.position).map((member) => [member.otfPlotId, member.bedOrder, member.gapBeforeMeters]));
}

function groupTarget(gesture: JournalGesture, groupId: string, season: number): JournalTarget {
  return { table: 'irrigation_garden_groups', where: 'current.id = ? AND current.workspace_id = ? AND current.season = ?', params: [groupId, gesture.workspaceId, season] };
}

function groupLine(subject: 'groupe-de-jardins', gesture: JournalGesture, groupId: string, season: number): JournalLine {
  return { ...gesture, subject, objectId: groupId, context: { name: { sql: 'current.name' }, season: { value: season } } };
}

const GROUP_FIELDS = [
  { key: 'name', current: 'current.name' },
  { key: 'members', current: MEMBERS_TEXT },
] as const;

/** Un groupe de jardins créé : placée après l'insertion du groupe et de ses jardins. */
export function gardenGroupCreationJournal(subject: 'groupe-de-jardins', gesture: JournalGesture, groupId: string, season: number): D1PreparedStatement {
  return journalCreation(groupLine(subject, gesture, groupId, season), groupTarget(gesture, groupId, season), GROUP_FIELDS);
}

/** Un groupe de jardins modifié, son nom ou ses jardins : placée avant l'écriture. */
export function gardenGroupUpdateJournal(subject: 'groupe-de-jardins', gesture: JournalGesture, groupId: string, group: ValidGardenGroupInput): D1PreparedStatement {
  const next: Record<string, unknown> = { name: group.name, members: membersText(group) };
  return journalUpdate(
    groupLine(subject, gesture, groupId, group.season),
    groupTarget(gesture, groupId, group.season),
    GROUP_FIELDS.map((field) => ({ ...field, next: next[field.key] })),
  );
}

/** Un groupe de jardins supprimé : placée avant l'effacement, ses jardins compris. */
export function gardenGroupDeletionJournal(subject: 'groupe-de-jardins', gesture: JournalGesture, groupId: string, season: number): D1PreparedStatement {
  return journalDeletion(groupLine(subject, gesture, groupId, season), groupTarget(gesture, groupId, season), GROUP_FIELDS);
}

// --- Le lieu de la météo -----------------------------------------------------------

/** Le lieu de la météo : l'adresse de la ferme dans Ouvre ta ferme (le départ) ou une commune choisie. */
export function weatherLocationJournal(
  subject: 'lieu-meteo',
  gesture: JournalGesture,
  preference: { locationMode: 'otf' | 'custom'; customCity: string | null; customPostcode: string | null },
): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: null },
    { table: 'irrigation_weather_preferences', where: 'current.workspace_id = ?', params: [gesture.workspaceId] },
    [
      { key: 'locationMode', current: `COALESCE(current.location_mode, ${sqlLiteral('otf')})`, next: preference.locationMode },
      { key: 'customCity', current: 'current.custom_city', next: preference.customCity },
      { key: 'customPostcode', current: 'current.custom_postcode', next: preference.customPostcode },
    ],
    'defaults',
  );
}
