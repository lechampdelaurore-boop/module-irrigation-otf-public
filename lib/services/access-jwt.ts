import { MILLISECONDS_PER_HOUR, secondsFromMilliseconds } from '@/lib/domain/units';
/**
 * Vérification du jeton émis par Cloudflare Access (`Cf-Access-Jwt-Assertion`).
 *
 * Module pur : aucune dépendance à Next, à `cloudflare:workers` ni au réseau.
 * La récupération des clés publiques est injectée, ce qui permet de tester la
 * vérification de bout en bout avec des clés générées localement.
 *
 * Règles vérifiées, dans l'ordre : forme du jeton, algorithme RS256, clé
 * connue, signature, émetteur (domaine Access de l'équipe), audience
 * (identifiant de l'application Access), fenêtre de validité, présence du sujet.
 */

type AccessJwtPayload = {
  sub: string;
  email?: string;
  name?: string;
  aud: string | string[];
  iss: string;
  exp: number;
  iat?: number;
  nbf?: number;
};

export type AccessJwk = JsonWebKey & { kid?: string; kty: string; alg?: string };
export type AccessJwks = { keys: AccessJwk[] };

type VerifyAccessJwtFailure =
  | 'malformed'
  | 'unsupported_alg'
  | 'unknown_key'
  | 'bad_signature'
  | 'wrong_issuer'
  | 'wrong_audience'
  | 'expired'
  | 'not_yet_valid'
  | 'missing_subject';

export type VerifyAccessJwtResult =
  | { ok: true; payload: AccessJwtPayload }
  | { ok: false; reason: VerifyAccessJwtFailure };

export type JwksFetcher = (options: { forceRefresh: boolean }) => Promise<AccessJwks>;

export type VerifyAccessJwtOptions = {
  /** Domaine Access de l'équipe, par exemple `https://ferme.cloudflareaccess.com`. */
  teamDomain: string;
  /** Identifiant d'audience (AUD tag) de l'application Access. */
  audience: string;
  fetchJwks: JwksFetcher;
  now?: Date;
  subtle?: SubtleCrypto;
  /** Tolérance d'horloge en secondes. */
  clockSkewSeconds?: number;
};

const DEFAULT_CLOCK_SKEW_SECONDS = 60;

export function accessCertificatesUrl(teamDomain: string): string {
  return `${normalizeIssuer(teamDomain)}/cdn-cgi/access/certs`;
}

function normalizeIssuer(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/**
 * Fabrique un lecteur de clés publiques avec cache en mémoire. Un `kid`
 * inconnu déclenche une seule relecture forcée par vérification.
 */
export function createJwksFetcher(input: {
  teamDomain: string;
  fetchImpl: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  ttlMs?: number;
  now?: () => number;
}): JwksFetcher {
  const url = accessCertificatesUrl(input.teamDomain);
  const ttl = input.ttlMs ?? MILLISECONDS_PER_HOUR;
  const clock = input.now ?? (() => Date.now());
  let cached: { keys: AccessJwks; fetchedAt: number } | null = null;
  return async ({ forceRefresh }) => {
    if (!forceRefresh && cached && clock() - cached.fetchedAt < ttl) return cached.keys;
    const response = await input.fetchImpl(url);
    if (!response.ok) throw new Error(`Clés Access indisponibles (HTTP ${response.status}).`);
    const body = (await response.json()) as Partial<AccessJwks> | null;
    const keys = Array.isArray(body?.keys) ? body.keys : [];
    cached = { keys: { keys }, fetchedAt: clock() };
    return cached.keys;
  };
}

export async function verifyAccessJwt(token: string, options: VerifyAccessJwtOptions): Promise<VerifyAccessJwtResult> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return { ok: false, reason: 'malformed' };
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  let header: { alg?: unknown; kid?: unknown };
  let payload: Partial<AccessJwtPayload>;
  let signature: Uint8Array;
  try {
    header = JSON.parse(bytesToString(base64UrlToBytes(encodedHeader))) as { alg?: unknown; kid?: unknown };
    payload = JSON.parse(bytesToString(base64UrlToBytes(encodedPayload))) as Partial<AccessJwtPayload>;
    signature = base64UrlToBytes(encodedSignature);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (header.alg !== 'RS256') return { ok: false, reason: 'unsupported_alg' };
  const kid = typeof header.kid === 'string' ? header.kid : null;

  const subtle = options.subtle ?? globalThis.crypto.subtle;
  let jwk = findKey(await options.fetchJwks({ forceRefresh: false }), kid);
  if (!jwk) jwk = findKey(await options.fetchJwks({ forceRefresh: true }), kid);
  if (!jwk) return { ok: false, reason: 'unknown_key' };

  let key: CryptoKey;
  try {
    key = await subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  } catch {
    return { ok: false, reason: 'unknown_key' };
  }
  const signed = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const valid = await subtle.verify('RSASSA-PKCS1-v1_5', key, signature as BufferSource, signed);
  if (!valid) return { ok: false, reason: 'bad_signature' };

  if (typeof payload.iss !== 'string' || normalizeIssuer(payload.iss) !== normalizeIssuer(options.teamDomain)) {
    return { ok: false, reason: 'wrong_issuer' };
  }
  const audiences = Array.isArray(payload.aud) ? payload.aud : typeof payload.aud === 'string' ? [payload.aud] : [];
  if (!audiences.includes(options.audience)) return { ok: false, reason: 'wrong_audience' };

  const nowSeconds = Math.floor(secondsFromMilliseconds((options.now ?? new Date()).getTime()));
  const skew = options.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS;
  if (typeof payload.exp !== 'number' || payload.exp + skew <= nowSeconds) return { ok: false, reason: 'expired' };
  const notBefore = typeof payload.nbf === 'number' ? payload.nbf : typeof payload.iat === 'number' ? payload.iat : null;
  if (notBefore !== null && notBefore - skew > nowSeconds) return { ok: false, reason: 'not_yet_valid' };
  if (typeof payload.sub !== 'string' || payload.sub.trim() === '') return { ok: false, reason: 'missing_subject' };

  return { ok: true, payload: payload as AccessJwtPayload };
}

function findKey(jwks: AccessJwks, kid: string | null): AccessJwk | null {
  const candidates = jwks.keys.filter((key) => key.kty === 'RSA' && (key.alg === undefined || key.alg === 'RS256'));
  if (kid === null) return candidates.length === 1 ? candidates[0] : null;
  return candidates.find((key) => key.kid === kid) ?? null;
}

export function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
