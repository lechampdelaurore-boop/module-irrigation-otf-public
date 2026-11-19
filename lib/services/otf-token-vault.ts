import { env } from 'cloudflare:workers';
import {
  keepFarmConnection,
  listSealedFarmConnections,
  readSealedFarmTokens,
  replaceSealedFarmTokens,
  type SealedFarmConnection,
} from '@/db/otf-farm-connection-repository';
import { logJsonLine } from '@/lib/adapters/log';
import { farmSpaceOf } from '@/lib/domain/farm-space';
import {
  OtfVaultError,
  openOtfSecret,
  otfSealKey,
  otfVaultState,
  sealOtfSecret,
  type OtfVaultKeyring,
  type OtfVaultSecretName,
  type OtfVaultState,
} from '@/lib/domain/otf/token-vault';
import { isDemoDeployment } from './deployment-mode';

/**
 * Le coffre des jetons d'Ouvre ta ferme, branché sur les secrets du Worker et
 * sur la base (4.3, PR 2 ; docs/tranche-4-contract.md, F355, F356, F368, et
 * section 6.3 quater, F397 à F403).
 *
 * Endormi : sans `OTF_TOKEN_MASTER_KEY`, rien ne s'ouvre, et rien n'y range de
 * jeton avant la PR 3 (l'autorisation). Les jetons en clair ne vivent qu'en
 * mémoire, le temps d'un appel : jamais dans la base, un journal, une erreur
 * ni une réponse.
 */

function readVaultSecrets(): { current: string | undefined; previous: string | undefined } {
  // Comme ailleurs dans le module, le lanceur local (`process.env`) prime sur les réglages du Worker.
  const workerEnv = env as Partial<Record<OtfVaultSecretName, string>>;
  return {
    current: process.env.OTF_TOKEN_MASTER_KEY ?? workerEnv.OTF_TOKEN_MASTER_KEY,
    previous: process.env.OTF_TOKEN_MASTER_KEY_PREVIOUS ?? workerEnv.OTF_TOKEN_MASTER_KEY_PREVIOUS,
  };
}

/** L'état du coffre de ce déploiement. La démonstration n'en a jamais : elle ne lit jamais Ouvre ta ferme. */
export async function currentOtfVault(): Promise<OtfVaultState> {
  if (isDemoDeployment()) return { status: 'dormant' };
  return otfVaultState(readVaultSecrets());
}

/** Les jetons d'une ferme en clair, en mémoire seulement. */
export type OtfFarmTokens = { accessToken: string; refreshToken: string; accessExpiresAtMs: number };

async function sealFarmTokens(keyring: OtfVaultKeyring, otfFarmId: string, tokens: { accessToken: string; refreshToken: string }) {
  return {
    accessTokenSealed: await sealOtfSecret(keyring, tokens.accessToken, { role: 'access-token', otfFarmId }),
    refreshTokenSealed: await sealOtfSecret(keyring, tokens.refreshToken, { role: 'refresh-token', otfFarmId }),
  };
}

/**
 * Range les jetons d'une ferme que la personne vient d'autoriser (F353) :
 * chiffrés, liés à la ferme et à leur rôle, puis gardés par une seule
 * écriture conditionnelle (F351). `false` si une autre personne relie déjà
 * cette ferme : rien n'est gardé.
 */
export async function keepOtfFarmTokens(
  keyring: OtfVaultKeyring,
  connection: { spaceKey: string; farmName: string; tokens: OtfFarmTokens; connectedAt: string },
): Promise<boolean> {
  const { otfFarmId } = farmSpaceOf(connection.spaceKey);
  if (otfFarmId === null) throw new Error('Un raccordement à Ouvre ta ferme se range pour une ferme, jamais pour un espace sans ferme.');
  const sealed = await sealFarmTokens(keyring, otfFarmId, connection.tokens);
  return keepFarmConnection({
    spaceKey: connection.spaceKey,
    farmName: connection.farmName,
    sealed: { ...sealed, accessExpiresAtMs: connection.tokens.accessExpiresAtMs },
    connectedAt: connection.connectedAt,
  });
}

/**
 * Les jetons du raccordement de cet espace, ouverts ; `null` si l'espace n'a
 * pas de raccordement qui en garde (F365 : seulement sa personne et sa
 * ferme). Ceux qu'a faits l'ancienne clé sont chiffrés de nouveau avec la
 * courante à cet usage (F356). Une clé que le module n'a plus, un chiffré
 * déplacé ou altéré : `OtfVaultError`, sans valeur ; jamais un jeton deviné.
 */
export async function openOtfFarmTokens(keyring: OtfVaultKeyring, spaceKey: string): Promise<OtfFarmTokens | null> {
  const sealed = await readSealedFarmTokens(spaceKey);
  const { otfFarmId } = farmSpaceOf(spaceKey);
  if (sealed === null || otfFarmId === null) return null;
  const tokens = await openFarmTokens(keyring, { otfFarmId, ...sealed });
  if (tokens.resealNeeded) await replaceSealedFarmTokens(otfFarmId, sealed, await sealFarmTokens(keyring, otfFarmId, tokens));
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, accessExpiresAtMs: sealed.accessExpiresAtMs };
}

async function openFarmTokens(keyring: OtfVaultKeyring, connection: SealedFarmConnection) {
  const { otfFarmId } = connection;
  const access = await openOtfSecret(keyring, connection.accessTokenSealed, { role: 'access-token', otfFarmId });
  const refresh = await openOtfSecret(keyring, connection.refreshTokenSealed, { role: 'refresh-token', otfFarmId });
  return { accessToken: access.secret, refreshToken: refresh.secret, resealNeeded: access.resealNeeded || refresh.resealNeeded };
}

export type OtfVaultMorningReport =
  | { status: 'dormant' }
  | { status: 'unavailable'; unreadable: OtfVaultSecretName[] }
  | { status: 'failed' }
  | {
      status: 'done';
      /** Les raccordements qui gardent des jetons. */
      connections: number;
      /** Ceux dont les jetons viennent d'être chiffrés de nouveau avec la clé courante. */
      resealed: number;
      /** Ceux qui dépendent encore de l'ancienne clé après le passage (une écriture concurrente, par exemple). */
      withPreviousKey: number;
      /**
       * Ceux qu'aucune clé du trousseau n'ouvre : faits par une clé qui n'est
       * plus posée, ou faits par l'ancienne et qui ne s'ouvrent pas (altérés ou
       * déplacés). La PR 3 les traite comme un accès retiré (F358).
       */
      unreadable: number;
      /** L'ancienne clé est posée et plus aucun chiffré n'en dépend : le porteur peut la retirer (F356). */
      previousKeyRemovable: boolean;
    };

/**
 * La rotation au calcul du matin (F356) : les jetons encore chiffrés par
 * l'ancienne clé, ceux des fermes que la journée n'a pas lues, le sont de
 * nouveau par la courante. Le journal dit combien de raccordements en
 * dépendent encore ; à zéro, le porteur peut retirer l'ancienne clé. Un
 * raccordement illisible est compté, laissé tel quel, et n'arrête pas les
 * autres. Endormi ou hors d'usage, le coffre ne touche à rien.
 */
export async function resealOtfVaultAtMorning(vault?: OtfVaultState): Promise<OtfVaultMorningReport> {
  try {
    const state = vault ?? await currentOtfVault();
    if (state.status === 'dormant') return { status: 'dormant' };
    if (state.status === 'unavailable') {
      logJsonLine('warn', { event: 'otf_vault_unavailable', unreadable: state.unreadable });
      return { status: 'unavailable', unreadable: state.unreadable };
    }
    const { keyring } = state;
    let resealed = 0;
    const unopened = new Set<string>();
    for (const connection of await listSealedFarmConnections()) {
      if (sealKeys(keyring, connection) !== 'previous') continue;
      try {
        const tokens = await openFarmTokens(keyring, connection);
        const replaced = await replaceSealedFarmTokens(connection.otfFarmId, connection, await sealFarmTokens(keyring, connection.otfFarmId, tokens));
        if (replaced) resealed += 1;
      } catch (error) {
        // Un chiffré qui ne s'ouvre pas reste tel quel, compté comme illisible ; les autres fermes passent.
        if (!(error instanceof OtfVaultError)) throw error;
        unopened.add(connection.otfFarmId);
      }
    }
    const after = (await listSealedFarmConnections())
      .map((connection) => (unopened.has(connection.otfFarmId) ? 'unreadable' : sealKeys(keyring, connection)));
    const withPreviousKey = after.filter((keys) => keys === 'previous').length;
    const report = {
      status: 'done' as const,
      connections: after.length,
      resealed,
      withPreviousKey,
      unreadable: after.filter((keys) => keys === 'unreadable').length,
      previousKeyRemovable: keyring.previous !== null && withPreviousKey === 0,
    };
    logJsonLine('info', { event: 'otf_vault_morning', ...report, previousKey: keyring.previous !== null });
    return report;
  } catch (error) {
    // Le message d'une erreur de la base ou du coffre ne porte aucune valeur : ni jeton, ni clé, ni chiffré.
    logJsonLine('warn', { event: 'otf_vault_morning_failed', error: error instanceof Error ? error.name : 'unknown' });
    return { status: 'failed' };
  }
}

/**
 * Où en sont les deux chiffrés d'un raccordement : tous deux de la clé
 * courante ; au moins un de l'ancienne, les autres lisibles ; ou au moins un
 * qu'aucune clé du trousseau n'ouvre.
 */
function sealKeys(keyring: OtfVaultKeyring, connection: SealedFarmConnection): 'current' | 'previous' | 'unreadable' {
  const keys = [otfSealKey(keyring, connection.accessTokenSealed), otfSealKey(keyring, connection.refreshTokenSealed)];
  if (keys.some((key) => key === 'unknown' || key === 'malformed')) return 'unreadable';
  return keys.includes('previous') ? 'previous' : 'current';
}
