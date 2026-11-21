/**
 * Le chiffrement de l'export hebdomadaire (4.5, PR 4 ; docs/tranche-4-contract.md,
 * F561, 10 bis.9, et 10 bis.14, F620). L'export de la base contient des
 * données personnelles et les jetons chiffrés des fermes : il ne quitte
 * l'ordinateur de l'exploitant que chiffré, avec un mot de passe que lui seul
 * saisit et garde.
 *
 * AES-256-GCM, la clé tirée du mot de passe par scrypt (sel tiré au hasard à
 * chaque export). L'en-tête du fichier dit le format et les réglages de
 * scrypt ; il est authentifié avec le contenu : un octet changé, dans
 * l'en-tête ou dans le contenu, et le fichier est refusé. Rien du contenu
 * n'est lisible sans le mot de passe ; l'en-tête ne dit rien de la base.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const MAGIC = 'module-irrigation-otf/export-chiffre';
const VERSION = 1;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** Les mots de passe plus courts sont refusés : le fichier peut se perdre, le mot de passe doit tenir seul. */
export const MINIMUM_PASSPHRASE_LENGTH = 12;

type ScryptSettings = { N: number; r: number; p: number };

/** 2^17 : environ 128 Mo et une demi-seconde par essai ; assez pour qu'un mot de passe volé ne se devine pas vite. */
const DEFAULT_SCRYPT: ScryptSettings = { N: 2 ** 17, r: 8, p: 1 };

type Header = { format: typeof MAGIC; version: number; kdf: 'scrypt'; scrypt: ScryptSettings; salt: string; iv: string };

export class ExportDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportDecryptionError';
  }
}

export function assertPassphrase(passphrase: string): void {
  if ([...passphrase].length < MINIMUM_PASSPHRASE_LENGTH) {
    throw new Error(`Le mot de passe doit compter au moins ${MINIMUM_PASSPHRASE_LENGTH} caractères.`);
  }
}

function keyOf(passphrase: string, salt: Buffer, { N, r, p }: ScryptSettings): Buffer {
  // La mémoire permise couvre le réglage, avec de la marge.
  return scryptSync(passphrase.normalize('NFC'), salt, KEY_BYTES, { N, r, p, maxmem: 2 * 128 * N * r * p });
}

/** Le fichier chiffré : une ligne d'en-tête en JSON, puis le contenu chiffré et son étiquette. */
export function encryptExport(plain: Buffer, passphrase: string, scrypt: ScryptSettings = DEFAULT_SCRYPT): Buffer {
  assertPassphrase(passphrase);
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const header: Header = { format: MAGIC, version: VERSION, kdf: 'scrypt', scrypt, salt: salt.toString('base64'), iv: iv.toString('base64') };
  const headerLine = Buffer.from(`${JSON.stringify(header)}\n`, 'utf8');
  const cipher = createCipheriv('aes-256-gcm', keyOf(passphrase, salt, scrypt), iv);
  cipher.setAAD(headerLine);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([headerLine, body, cipher.getAuthTag()]);
}

/** Le contenu en clair, en mémoire ; un mot de passe faux ou un fichier abîmé lèvent `ExportDecryptionError`. */
export function decryptExport(file: Buffer, passphrase: string): Buffer {
  const newline = file.indexOf(0x0a);
  if (newline < 0) throw new ExportDecryptionError('Ce fichier n’est pas un export chiffré du module.');
  const headerLine = file.subarray(0, newline + 1);
  const header = parseHeader(headerLine.toString('utf8'));
  const sealed = file.subarray(newline + 1);
  if (sealed.length < TAG_BYTES) throw new ExportDecryptionError('L’export chiffré est tronqué.');
  const decipher = createDecipheriv('aes-256-gcm', keyOf(passphrase, Buffer.from(header.salt, 'base64'), header.scrypt), Buffer.from(header.iv, 'base64'));
  decipher.setAAD(headerLine);
  decipher.setAuthTag(sealed.subarray(sealed.length - TAG_BYTES));
  try {
    return Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - TAG_BYTES)), decipher.final()]);
  } catch {
    throw new ExportDecryptionError('Mot de passe faux, ou fichier abîmé : l’export ne se déchiffre pas.');
  }
}

function parseHeader(line: string): Header {
  let header: unknown;
  try {
    header = JSON.parse(line);
  } catch {
    throw new ExportDecryptionError('Ce fichier n’est pas un export chiffré du module.');
  }
  const candidate = header as Partial<Header>;
  const scrypt = candidate.scrypt;
  const valid = candidate.format === MAGIC
    && candidate.kdf === 'scrypt'
    && typeof candidate.salt === 'string' && typeof candidate.iv === 'string'
    && Buffer.from(candidate.iv, 'base64').length === IV_BYTES
    && scrypt !== undefined && [scrypt.N, scrypt.r, scrypt.p].every((value) => Number.isInteger(value) && value > 0)
    // Un en-tête qui demanderait des milliards d'octets à scrypt est refusé avant tout calcul.
    && scrypt.N <= 2 ** 20 && scrypt.r <= 16 && scrypt.p <= 4;
  if (!valid) throw new ExportDecryptionError('Ce fichier n’est pas un export chiffré du module, ou son format est inconnu.');
  if (candidate.version !== VERSION) throw new ExportDecryptionError(`Format d’export ${String(candidate.version)} inconnu de cette version du module.`);
  return candidate as Header;
}

/** Deux saisies du même mot de passe, comparées sans fuite de temps. */
export function samePassphrase(first: string, second: string): boolean {
  const left = Buffer.from(first.normalize('NFC'), 'utf8');
  const right = Buffer.from(second.normalize('NFC'), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
