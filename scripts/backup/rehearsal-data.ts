/**
 * Les données fictives de l'essai de restauration (4.5, PR 4 ;
 * docs/tranche-4-contract.md, F561, point 1, et 10 bis.15) : deux fermes
 * fictives, « Ferme v2 » n° 4394 en copie fictive et une ferme n° 9001,
 * écrites par les vrais dépôts du module dans une base migrée, en mémoire,
 * puis rendues en SQL rangé pour l'import, prêtes pour la base d'essai.
 *
 * Chaque ferme a son matériel, ses irrigations et son raccordement à Ouvre ta
 * ferme, dont les jetons, fictifs, sont chiffrés par une clé de coffre tirée
 * pour cet essai seulement. La clé et les jetons ne quittent jamais la
 * mémoire : l'essai garde leur empreinte, et vérifie qu'ils ne paraissent
 * nulle part en clair.
 */
import { createHash, randomBytes } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { overrideDatabase } from '../../db/binding.ts';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create.ts';
import { ensureWorkspaceForUser } from '../../db/workspace-repository.ts';
import { farmSpaceKey } from '../../lib/domain/farm-space.ts';
import { otfVaultState } from '../../lib/domain/otf/token-vault.ts';
import { keepOtfFarmTokens, type OtfFarmTokens } from '../../lib/services/otf-token-vault.ts';
import { createD1FromSqlite, createMigratedSqliteDatabase } from '../../tests/support/d1-sqlite.ts';
import { completedDraft, createDripFixture } from '../../tests/support/irrigation-fixtures.ts';
import { recordD1Migrations, restorableDump } from './sqlite-dump.ts';

const MIGRATION_FILE = /^\d{4}_.+\.sql$/;

export type RehearsalFarm = {
  label: 'A' | 'B';
  otfFarmId: string;
  spaceKey: string;
  workspaceId: string;
  /** Le nom du matériel de la ferme : chaque ferme ne lit que le sien. */
  equipmentName: string;
  /** Le nombre d'irrigations écrites pour la ferme. */
  events: number;
};

export type RehearsalSource = {
  sql: string;
  farms: [RehearsalFarm, RehearsalFarm];
  /** La clé du coffre de l'essai, en base64 : en mémoire seulement, jamais écrite ni affichée. */
  vaultKey: string;
  /** L'empreinte des jetons fictifs de chaque ferme, par clé d'espace. */
  tokenDigests: Record<string, string>;
  /** Ce qui ne doit paraître en clair dans aucun export ni dans le compte rendu : la clé et les jetons. */
  secrets: string[];
};

export function tokenDigest(tokens: Pick<OtfFarmTokens, 'accessToken' | 'refreshToken'>): string {
  return createHash('sha256').update(`${tokens.accessToken}\n${tokens.refreshToken}`).digest('hex');
}

/** Une clé de coffre neuve, comme `openssl rand -base64 32`. */
export function newVaultKey(): string {
  return randomBytes(32).toString('base64');
}

const FARMS = [
  { label: 'A', person: 'essai-restauration-personne-a', otfFarmId: '4394', farmName: 'Ferme v2 (copie fictive)', equipmentName: 'Goutte-à-goutte fictif A', events: 3 },
  { label: 'B', person: 'essai-restauration-personne-b', otfFarmId: '9001', farmName: 'Ferme fictive B', equipmentName: 'Goutte-à-goutte fictif B', events: 2 },
] as const;

/** Les deux fermes fictives, écrites par les dépôts du module, et leur export. */
export async function buildRehearsalSource(migrationsDir = 'drizzle'): Promise<RehearsalSource> {
  const sqlite = createMigratedSqliteDatabase(migrationsDir);
  recordD1Migrations(sqlite, readdirSync(migrationsDir).filter((name) => MIGRATION_FILE.test(name)).sort(), '2026-11-20 20:30:00');
  const vaultKey = newVaultKey();
  const vault = await otfVaultState({ current: vaultKey, previous: undefined });
  if (vault.status !== 'ready') throw new Error('La clé de coffre de l’essai n’est pas lisible.');
  overrideDatabase(createD1FromSqlite(sqlite));
  try {
    const farms: RehearsalFarm[] = [];
    const tokenDigests: Record<string, string> = {};
    const secrets = [vaultKey];
    for (const farm of FARMS) {
      const spaceKey = farmSpaceKey(farm.person, farm.otfFarmId);
      const workspaceId = await ensureWorkspaceForUser(spaceKey);
      const fixture = await createDripFixture(spaceKey, { name: farm.equipmentName, beds: [`planche-${farm.label}-1`, `planche-${farm.label}-2`] });
      for (let day = 1; day <= farm.events; day += 1) {
        const date = `2026-06-${String(day * 3).padStart(2, '0')}`;
        await createIrrigationEventForUser(spaceKey, completedDraft(fixture, { startAt: `${date}T06:00:00.000Z`, endAt: `${date}T06:45:00.000Z`, durationSeconds: 2700 }));
      }
      const tokens: OtfFarmTokens = {
        accessToken: `essai-acces-${randomBytes(24).toString('hex')}`,
        refreshToken: `essai-renouvellement-${randomBytes(24).toString('hex')}`,
        accessExpiresAtMs: Date.parse('2026-11-21T08:00:00.000Z'),
      };
      if (!await keepOtfFarmTokens(vault.keyring, { spaceKey, farmName: farm.farmName, tokens, connectedAt: '2026-11-20T08:00:00.000Z' })) {
        throw new Error('Le raccordement fictif n’a pas été gardé.');
      }
      tokenDigests[spaceKey] = tokenDigest(tokens);
      secrets.push(tokens.accessToken, tokens.refreshToken);
      farms.push({ label: farm.label, otfFarmId: farm.otfFarmId, spaceKey, workspaceId, equipmentName: farm.equipmentName, events: farm.events });
    }
    return { sql: restorableDump(sqlite), farms: farms as [RehearsalFarm, RehearsalFarm], vaultKey, tokenDigests, secrets };
  } finally {
    overrideDatabase(null);
    sqlite.close();
  }
}

/** Les secrets de l'essai trouvés en clair dans un texte : leur nombre seulement, jamais lesquels. */
export function secretsFoundIn(text: string, secrets: readonly string[]): number {
  return secrets.filter((secret) => secret !== '' && text.includes(secret)).length;
}
