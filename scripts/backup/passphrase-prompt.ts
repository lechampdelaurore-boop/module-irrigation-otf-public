/**
 * La saisie du mot de passe de l'export (4.5, PR 4 ; docs/tranche-4-contract.md,
 * 10 bis.9, et 10 bis.14, F621) : au clavier seulement, sans écho, jamais
 * par un argument ni une variable d'environnement, qui resteraient dans
 * l'historique du terminal.
 */
import { assertPassphrase, samePassphrase } from './export-crypto.ts';

type Keyboard = NodeJS.ReadStream;
type Screen = { write(text: string): unknown };

class PassphraseInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PassphraseInputError';
  }
}

/** Ce que les touches tapées donnent : l'effacement retire un caractère, les flèches et touches de contrôle ne comptent pas. */
export function typedText(keys: string): { text: string; submitted: boolean; interrupted: boolean } {
  let text = '';
  let escape = false;
  for (const key of keys) {
    if (escape) {
      // Une séquence d'échappement (flèche, touche de fonction) finit par une lettre ou par « ~ ».
      if (/[A-Za-z~]/.test(key)) escape = false;
      continue;
    }
    if (key === '\u001b') { escape = true; continue; }
    if (key === '\r' || key === '\n') return { text, submitted: true, interrupted: false };
    if (key === '\u0003' || key === '\u0004') return { text: '', submitted: false, interrupted: true };
    if (key === '\u007f' || key === '\b') { text = [...text].slice(0, -1).join(''); continue; }
    if (key < ' ') continue;
    text += key;
  }
  return { text, submitted: false, interrupted: false };
}

/** Une saisie sans écho ; refusée hors d'un terminal (un mot de passe ne se donne pas par un tuyau). */
export function askHidden(question: string, keyboard: Keyboard = process.stdin, screen: Screen = process.stderr): Promise<string> {
  if (!keyboard.isTTY || typeof keyboard.setRawMode !== 'function') {
    return Promise.reject(new PassphraseInputError('Le mot de passe se tape au clavier, dans un terminal : lancez la commande vous-même, sans la rediriger.'));
  }
  screen.write(question);
  keyboard.setRawMode(true);
  keyboard.setEncoding('utf8');
  keyboard.resume();
  return new Promise((resolve, reject) => {
    let keys = '';
    const stop = () => {
      keyboard.off('data', onKeys);
      keyboard.setRawMode(false);
      keyboard.pause();
      screen.write('\n');
    };
    const onKeys = (chunk: string) => {
      keys += chunk;
      const typed = typedText(keys);
      if (typed.interrupted) {
        stop();
        reject(new PassphraseInputError('Saisie interrompue : rien n’a été fait.'));
      } else if (typed.submitted) {
        stop();
        resolve(typed.text);
      }
    };
    keyboard.on('data', onKeys);
  });
}

/** Un mot de passe nouveau : assez long, tapé deux fois à l'identique. */
export async function askNewPassphrase(ask: (question: string) => Promise<string> = (question) => askHidden(question)): Promise<string> {
  const first = await ask('Mot de passe de l’export (12 caractères au moins, rien ne s’affiche) : ');
  assertPassphrase(first);
  const second = await ask('Le même mot de passe, une seconde fois : ');
  if (!samePassphrase(first, second)) throw new PassphraseInputError('Les deux saisies diffèrent : rien n’a été fait.');
  return first;
}
