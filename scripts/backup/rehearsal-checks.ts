/**
 * Les contrôles de l'essai de restauration joués sur une copie locale de la
 * base reconstruite (4.5, PR 4 ; docs/tranche-4-contract.md, F561, point 2,
 * et 10 bis.15) : l'isolation des deux fermes (S2) et le coffre des jetons
 * sans sa clé (S3). La copie est branchée sous les vrais dépôts du module,
 * comme la base du Worker ; rien n'y est lu autrement qu'eux le font.
 *
 * Chaque contrôle se dit en une ligne, avec des nombres et des noms de
 * tables : ni jeton, ni clé, ni donnée.
 */
import type { DatabaseSync } from 'node:sqlite';
import { overrideDatabase } from '../../db/binding.ts';
import { listEquipmentForUser } from '../../db/equipment/read.ts';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read.ts';
import { readSealedFarmTokens } from '../../db/otf-farm-connection-repository.ts';
import { farmSpaceKey, farmSpaceOf } from '../../lib/domain/farm-space.ts';
import { OtfVaultError, otfVaultState } from '../../lib/domain/otf/token-vault.ts';
import { openOtfFarmTokens, resealOtfVaultAtMorning } from '../../lib/services/otf-token-vault.ts';
import { createD1FromSqlite } from '../../tests/support/d1-sqlite.ts';
import { crossSpaceReferences } from '../../tests/support/space-coherence.ts';
import { summarizeDatabase } from './export-inspection.ts';
import { newVaultKey, secretsFoundIn, tokenDigest, type RehearsalFarm, type RehearsalSource } from './rehearsal-data.ts';

export type Check = { ok: boolean; text: string };

const check = (ok: boolean, text: string): Check => ({ ok, text });

async function onCopy<T>(copy: DatabaseSync, action: () => Promise<T>): Promise<T> {
  overrideDatabase(createD1FromSqlite(copy));
  try {
    return await action();
  } finally {
    overrideDatabase(null);
  }
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

/**
 * S2, après la reconstruction : le contrôle de cohérence des espaces (F380),
 * puis, pour chaque ferme, ce que lisent les dépôts du module : son matériel
 * et ses irrigations, rien de l'autre ; la même personne sur l'autre ferme,
 * rien ; l'autre personne sur cette ferme, aucun raccordement.
 */
export async function isolationChecks(copy: DatabaseSync, farms: readonly RehearsalFarm[]): Promise<Check[]> {
  const checks: Check[] = [];
  const crossing = crossSpaceReferences(copy);
  checks.push(check(crossing.length === 0, crossing.length === 0
    ? 'Cohérence des espaces (F380) : aucune ligne ne désigne une ligne d’une autre ferme.'
    : `Cohérence des espaces (F380) : ${crossing.length} ligne${crossing.length > 1 ? 's désignent' : ' désigne'} une ligne d’une autre ferme.`));
  await onCopy(copy, async () => {
    for (const farm of farms) {
      const other = farms.find((candidate) => candidate !== farm);
      if (!other) continue;
      const equipment = (await listEquipmentForUser(farm.spaceKey)).map((item) => item.name);
      const events = (await listIrrigationEventsForUser(farm.spaceKey)).map((event) => event.id);
      const stored = (copy.prepare('SELECT id FROM irrigation_events WHERE workspace_id = ?').all(farm.workspaceId) as { id: string }[]).map(({ id }) => id);
      const othersEvents = (copy.prepare('SELECT id FROM irrigation_events WHERE workspace_id = ?').all(other.workspaceId) as { id: string }[]).map(({ id }) => id);
      checks.push(check(
        sameList(equipment, [farm.equipmentName]) && sameList(events, stored) && events.length === farm.events && !events.some((id) => othersEvents.includes(id)),
        `Ferme ${farm.label} : les dépôts lisent son matériel (${equipment.length}) et ses ${events.length} irrigations, rien de la ferme ${other.label}.`,
      ));
      const person = farmSpaceOf(farm.spaceKey).ownerUserId;
      const otherPerson = farmSpaceOf(other.spaceKey).ownerUserId;
      const samePersonElsewhere = farmSpaceKey(person, other.otfFarmId);
      const elsewhereEquipment = await listEquipmentForUser(samePersonElsewhere);
      const elsewhereEvents = await listIrrigationEventsForUser(samePersonElsewhere);
      checks.push(check(
        elsewhereEquipment.length === 0 && elsewhereEvents.length === 0,
        `La personne de la ferme ${farm.label}, sur la ferme ${other.label} : aucun matériel, aucune irrigation.`,
      ));
      const ownConnection = await readSealedFarmTokens(farm.spaceKey);
      const foreignConnection = await readSealedFarmTokens(farmSpaceKey(otherPerson, farm.otfFarmId));
      checks.push(check(
        ownConnection !== null && foreignConnection === null,
        `Raccordement de la ferme ${farm.label} : lu par sa personne, jamais par celle de la ferme ${other.label}.`,
      ));
    }
  });
  return checks;
}

/** Les lignes que le coffre écrit dans le journal pendant un geste, retenues pour être lues au lieu d'être affichées. */
async function quietly<T>(lines: string[], action: () => Promise<T>): Promise<T> {
  const { info, warn } = console;
  console.info = (...parts: unknown[]) => { lines.push(parts.map(String).join(' ')); };
  console.warn = (...parts: unknown[]) => { lines.push(parts.map(String).join(' ')); };
  try {
    return await action();
  } finally {
    console.info = info;
    console.warn = warn;
  }
}

async function readsAllTokens(source: Pick<RehearsalSource, 'farms' | 'tokenDigests'>, vaultKey: string): Promise<boolean> {
  const vault = await otfVaultState({ current: vaultKey, previous: undefined });
  if (vault.status !== 'ready') return false;
  try {
    for (const farm of source.farms) {
      const tokens = await openOtfFarmTokens(vault.keyring, farm.spaceKey);
      if (tokens === null || tokenDigest(tokens) !== source.tokenDigests[farm.spaceKey]) return false;
    }
    return true;
  } catch (error) {
    if (error instanceof OtfVaultError) return false;
    throw error;
  }
}

/**
 * S3, sur la base reconstruite : avec la bonne clé, les jetons des deux
 * fermes se lisent ; clé perdue et une neuve posée, chaque raccordement est
 * illisible et chaque ferme doit être reliée de nouveau, sans que rien ne
 * soit effacé ; sans clé, le coffre est endormi et ne touche à rien ; la
 * bonne clé retrouvée, tout se lit encore. Le journal du coffre ne contient
 * ni la clé ni un jeton.
 */
export async function vaultChecks(copy: DatabaseSync, source: Pick<RehearsalSource, 'farms' | 'tokenDigests' | 'vaultKey' | 'secrets'>): Promise<Check[]> {
  const checks: Check[] = [];
  const journal: string[] = [];
  const before = summarizeDatabase(copy).digest;
  await onCopy(copy, () => quietly(journal, async () => {
    checks.push(check(await readsAllTokens(source, source.vaultKey), `Avec la bonne clé : les jetons des ${source.farms.length} fermes se lisent, identiques à ceux d’avant l’export.`));

    const lostKeyVault = await otfVaultState({ current: newVaultKey(), previous: undefined });
    if (lostKeyVault.status !== 'ready') {
      checks.push(check(false, 'Clé perdue : la clé neuve de l’essai n’est pas lisible.'));
    } else {
      const morning = await resealOtfVaultAtMorning(lostKeyVault);
      const unreadable = morning.status === 'done' ? morning.unreadable : -1;
      let askedToReconnect = 0;
      for (const farm of source.farms) {
        try {
          await openOtfFarmTokens(lostKeyVault.keyring, farm.spaceKey);
        } catch (error) {
          if (error instanceof OtfVaultError && error.problem === 'unknown-key' && error.message.includes('reliée de nouveau')) askedToReconnect += 1;
        }
      }
      checks.push(check(
        unreadable === source.farms.length && askedToReconnect === source.farms.length,
        `Clé perdue, une neuve posée : ${unreadable} raccordement${unreadable > 1 ? 's' : ''} sur ${source.farms.length} illisible${unreadable > 1 ? 's' : ''} au passage du matin ; ${askedToReconnect} ferme${askedToReconnect > 1 ? 's' : ''} sur ${source.farms.length} invitée${askedToReconnect > 1 ? 's' : ''} à se relier de nouveau (« la ferme doit être reliée de nouveau »).`,
      ));
    }

    const noKeyVault = await otfVaultState({ current: undefined, previous: undefined });
    const noKeyMorning = await resealOtfVaultAtMorning(noKeyVault);
    checks.push(check(
      noKeyVault.status === 'dormant' && noKeyMorning.status === 'dormant',
      'Sans clé : le coffre est endormi ; le passage du matin ne touche à rien.',
    ));

    checks.push(check(await readsAllTokens(source, source.vaultKey), 'La bonne clé retrouvée : les jetons se lisent encore.'));
  }));
  checks.push(check(summarizeDatabase(copy).digest === before, 'Rien n’a été effacé ni réécrit dans la base par ces essais du coffre (même empreinte).'));
  const leaked = secretsFoundIn(journal.join('\n'), source.secrets);
  checks.push(check(leaked === 0, `Journal du coffre (${journal.length} ligne${journal.length > 1 ? 's' : ''}) : ${leaked === 0 ? 'ni clé ni jeton en clair' : `${leaked} secret${leaked > 1 ? 's' : ''} en clair`}.`));
  return checks;
}
