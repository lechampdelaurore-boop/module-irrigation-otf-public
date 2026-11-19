import { isFarmId } from '../farm-space.ts';

/**
 * Le coffre des jetons d'Ouvre ta ferme (4.3, PR 2 ; docs/tranche-4-contract.md,
 * F355, F356, et section 6.3 quater, F397 à F403).
 *
 * Chaque jeton (d'accès et de renouvellement) et chaque `code_verifier` est
 * chiffré avant d'entrer dans la base : AES-256-GCM (WebCrypto), un vecteur
 * aléatoire de 12 octets par chiffrement, et des données associées qui lient
 * le chiffré à sa ligne (la ferme pour un jeton, la personne et la demande
 * pour un `code_verifier`) et à son rôle. Un chiffré recopié sur une autre
 * ligne, ou pris pour un autre rôle, ne s'ouvre pas.
 *
 * Chaque chiffré porte l'empreinte courte de la clé maîtresse qui l'a fait :
 * pendant une rotation, le coffre ouvre avec l'ancienne clé ce qu'elle a
 * chiffré, et dit qu'il faut le chiffrer de nouveau avec la nouvelle (F356).
 *
 * Rien ici ne lit l'environnement : le service (`lib/services/otf-token-vault.ts`)
 * donne le texte des deux secrets. Aucune erreur ne porte une valeur : ni un
 * jeton, ni une clé, ni un chiffré.
 */

/** Les deux secrets Cloudflare du coffre, posés par le porteur seul (F368). */
export type OtfVaultSecretName = 'OTF_TOKEN_MASTER_KEY' | 'OTF_TOKEN_MASTER_KEY_PREVIOUS';

/** Le rôle d'un chiffré, et la ligne à laquelle il est lié. */
export type OtfVaultBinding =
  | { role: 'access-token' | 'refresh-token'; otfFarmId: string }
  | { role: 'code-verifier'; ownerUserId: string; requestId: string };

type OtfVaultKey = { fingerprint: string; cryptoKey: CryptoKey };

/** La clé courante, qui chiffre ; l'ancienne, le temps d'une rotation, qui ne fait plus qu'ouvrir. */
export type OtfVaultKeyring = { current: OtfVaultKey; previous: OtfVaultKey | null };

/**
 * L'état du coffre (F368, F398) : endormi sans clé maîtresse ; hors d'usage
 * quand un secret posé est illisible (rien ne s'ouvre, rien n'est effacé) ;
 * prêt sinon.
 */
export type OtfVaultState =
  | { status: 'dormant' }
  | { status: 'unavailable'; unreadable: OtfVaultSecretName[] }
  | { status: 'ready'; keyring: OtfVaultKeyring };

export type OtfVaultProblem = 'malformed' | 'unknown-key' | 'broken' | 'empty-secret' | 'invalid-binding';

const PROBLEM_MESSAGES: Readonly<Record<OtfVaultProblem, string>> = {
  malformed: 'Le coffre ne reconnaît pas la forme de ce chiffré.',
  'unknown-key': 'Ce chiffré a été fait par une clé maîtresse que le module n’a plus : la ferme doit être reliée de nouveau.',
  broken: 'Ce chiffré ne s’ouvre pas avec sa clé : il a été déplacé sur une autre ligne, pris pour un autre rôle ou altéré.',
  'empty-secret': 'Le coffre ne chiffre pas une valeur vide.',
  'invalid-binding': 'Le coffre ne chiffre que pour une ferme, ou une personne et une demande, lisibles.',
};

/** Une erreur du coffre : elle nomme le problème, jamais une valeur. */
export class OtfVaultError extends Error {
  readonly problem: OtfVaultProblem;

  constructor(problem: OtfVaultProblem) {
    super(PROBLEM_MESSAGES[problem]);
    this.name = 'OtfVaultError';
    this.problem = problem;
  }
}

const MASTER_KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FINGERPRINT_BYTES = 8;
const SEAL_VERSION = 'v1';
/** `v1.<empreinte>.<vecteur>.<chiffré et son étiquette>` : 16 chiffres hexadécimaux, puis 12 et au moins 16 octets en base64url. */
const SEAL_PATTERN = /^v1\.([0-9a-f]{16})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22,})$/;
const FINGERPRINT_LABEL = 'ouvre-ta-ferme/coffre/empreinte-de-cle/v1\n';
const ASSOCIATED_DATA_LABEL = 'ouvre-ta-ferme/coffre/v1';

/**
 * La clé maîtresse telle que le porteur la pose (F397) : 32 octets aléatoires
 * écrits en base64, comme les donne `openssl rand -base64 32`. La variante
 * base64url, l'absence de remplissage et les blancs autour sont admis ; toute
 * autre forme, ou une autre longueur, est illisible (`null`).
 */
export function decodeOtfMasterKey(text: string): Uint8Array<ArrayBuffer> | null {
  const compact = text.trim();
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact)) return null;
  const standard = compact.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  if (standard.length % 4 === 1) return null;
  let binary: string;
  try {
    binary = atob(standard + '='.repeat((4 - (standard.length % 4)) % 4));
  } catch {
    return null;
  }
  if (binary.length !== MASTER_KEY_BYTES) return null;
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/**
 * L'état du coffre d'après le texte des deux secrets. Un secret absent ou
 * vide est un secret non posé. L'ancienne clé sans la nouvelle, ou un secret
 * posé mais illisible, mettent le coffre hors d'usage : il échoue fermé,
 * plutôt que de prendre pour perdus les chiffrés d'une clé mal posée.
 */
export async function otfVaultState(secrets: { current: string | undefined; previous: string | undefined }): Promise<OtfVaultState> {
  const current = secrets.current?.trim() ? secrets.current : null;
  const previous = secrets.previous?.trim() ? secrets.previous : null;
  if (current === null && previous === null) return { status: 'dormant' };
  const currentBytes = current === null ? null : decodeOtfMasterKey(current);
  const previousBytes = previous === null ? null : decodeOtfMasterKey(previous);
  const unreadable: OtfVaultSecretName[] = [];
  if (currentBytes === null) unreadable.push('OTF_TOKEN_MASTER_KEY');
  if (previous !== null && previousBytes === null) unreadable.push('OTF_TOKEN_MASTER_KEY_PREVIOUS');
  if (currentBytes === null || unreadable.length > 0) return { status: 'unavailable', unreadable };
  const currentKey = await importMasterKey(currentBytes);
  const previousKey = previousBytes === null ? null : await importMasterKey(previousBytes);
  return {
    status: 'ready',
    keyring: { current: currentKey, previous: previousKey && previousKey.fingerprint !== currentKey.fingerprint ? previousKey : null },
  };
}

/**
 * L'empreinte courte d'une clé maîtresse : les 8 premiers octets d'un SHA-256
 * de la clé, précédée d'une étiquette propre au coffre, en hexadécimal. Elle
 * dit quelle clé a fait un chiffré sans rien apprendre de la clé.
 */
async function importMasterKey(bytes: Uint8Array<ArrayBuffer>): Promise<OtfVaultKey> {
  const label = new TextEncoder().encode(FINGERPRINT_LABEL);
  const material = new Uint8Array(label.length + bytes.length);
  material.set(label);
  material.set(bytes, label.length);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', material));
  const fingerprint = toHex(digest.subarray(0, FINGERPRINT_BYTES));
  const cryptoKey = await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return { fingerprint, cryptoKey };
}

/** Chiffre une valeur avec la clé courante, liée à sa ligne et à son rôle. */
export async function sealOtfSecret(keyring: OtfVaultKeyring, secret: string, binding: OtfVaultBinding): Promise<string> {
  if (secret === '') throw new OtfVaultError('empty-secret');
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: associatedData(binding), tagLength: TAG_BYTES * 8 },
    keyring.current.cryptoKey,
    new TextEncoder().encode(secret),
  );
  return [SEAL_VERSION, keyring.current.fingerprint, toBase64Url(iv), toBase64Url(new Uint8Array(sealed))].join('.');
}

export type OtfOpenedSecret = {
  secret: string;
  /** Le chiffré vient de l'ancienne clé : à chiffrer de nouveau avec la courante (F356). */
  resealNeeded: boolean;
};

/**
 * Ouvre un chiffré avec la clé dont l'empreinte correspond, pour la ligne et
 * le rôle donnés. Une clé que le trousseau n'a plus, un chiffré déplacé, pris
 * pour un autre rôle ou altéré : une erreur sans valeur, jamais une valeur
 * devinée.
 */
export async function openOtfSecret(keyring: OtfVaultKeyring, sealed: string, binding: OtfVaultBinding): Promise<OtfOpenedSecret> {
  const parts = parseSeal(sealed);
  if (parts === null) throw new OtfVaultError('malformed');
  const key = keyOf(keyring, parts.fingerprint);
  if (key === null) throw new OtfVaultError('unknown-key');
  const additionalData = associatedData(binding);
  let opened: ArrayBuffer;
  try {
    opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: parts.iv, additionalData, tagLength: TAG_BYTES * 8 }, key.cryptoKey, parts.data);
  } catch {
    throw new OtfVaultError('broken');
  }
  let secret: string;
  try {
    secret = new TextDecoder('utf-8', { fatal: true }).decode(opened);
  } catch {
    throw new OtfVaultError('broken');
  }
  return { secret, resealNeeded: key !== keyring.current };
}

/** La clé qui a fait un chiffré, sans l'ouvrir : la courante, l'ancienne, une autre, ou une forme inconnue. */
export function otfSealKey(keyring: OtfVaultKeyring, sealed: string): 'current' | 'previous' | 'unknown' | 'malformed' {
  const parts = parseSeal(sealed);
  if (parts === null) return 'malformed';
  const key = keyOf(keyring, parts.fingerprint);
  if (key === null) return 'unknown';
  return key === keyring.current ? 'current' : 'previous';
}

function keyOf(keyring: OtfVaultKeyring, fingerprint: string): OtfVaultKey | null {
  if (fingerprint === keyring.current.fingerprint) return keyring.current;
  if (keyring.previous !== null && fingerprint === keyring.previous.fingerprint) return keyring.previous;
  return null;
}

/**
 * Les données associées : l'étiquette du coffre, le rôle et la ligne, écrits
 * comme une liste JSON, qu'aucun caractère d'une valeur ne peut confondre
 * avec une autre liste.
 */
function associatedData(binding: OtfVaultBinding): Uint8Array<ArrayBuffer> {
  if (binding.role === 'code-verifier') {
    if (binding.ownerUserId.trim() === '' || binding.requestId.trim() === '') throw new OtfVaultError('invalid-binding');
    return new TextEncoder().encode(JSON.stringify([ASSOCIATED_DATA_LABEL, binding.role, binding.ownerUserId, binding.requestId]));
  }
  if (!isFarmId(binding.otfFarmId)) throw new OtfVaultError('invalid-binding');
  return new TextEncoder().encode(JSON.stringify([ASSOCIATED_DATA_LABEL, binding.role, binding.otfFarmId]));
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type SealParts = { fingerprint: string; iv: Uint8Array<ArrayBuffer>; data: Uint8Array<ArrayBuffer> };

/** L'empreinte, le vecteur et le chiffré d'un chiffré bien formé ; `null` pour toute autre forme. */
function parseSeal(sealed: string): SealParts | null {
  const match = SEAL_PATTERN.exec(sealed);
  if (!match) return null;
  try {
    const parts = { fingerprint: match[1], iv: fromBase64Url(match[2]), data: fromBase64Url(match[3]) };
    return parts.iv.length === IV_BYTES && parts.data.length >= TAG_BYTES ? parts : null;
  } catch {
    return null;
  }
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const standard = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(standard + '='.repeat((4 - (standard.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
