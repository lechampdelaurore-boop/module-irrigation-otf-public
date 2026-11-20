/**
 * Chargé dans le processus de Wrangler (`node --import`) par
 * `scripts/backup/wrangler-export.ts` : l'export de la base ne touche jamais
 * le disque en clair (4.5, PR 4 ; docs/tranche-4-contract.md, 10 bis.9, et
 * 10 bis.14, F622).
 *
 * `wrangler d1 export` écrit l'export dans le fichier de `--output` avec
 * `fs.promises.writeFile`. Ici, l'écriture vers le chemin convenu (variable
 * `MODULE_IRRIGATION_EXPORT_CAPTURE`) est détournée : le contenu part par le
 * canal du processus parent, en mémoire, et rien n'est écrit. Le chemin
 * convenu est dans un dossier qui n'existe pas : si Wrangler change sa façon
 * d'écrire et que le détour ne joue plus, son écriture échoue, au lieu de
 * poser l'export en clair sur le disque.
 */
import fsPromises from 'node:fs/promises';
import path from 'node:path';

const target = process.env.MODULE_IRRIGATION_EXPORT_CAPTURE;
const CHUNK_BYTES = 512 * 1024;

function send(message) {
  return new Promise((resolve, reject) => {
    process.send(message, (error) => (error ? reject(error) : resolve()));
  });
}

async function* chunksOf(data) {
  if (typeof data === 'string') {
    yield Buffer.from(data, 'utf8');
    return;
  }
  if (data instanceof Uint8Array) {
    yield Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    return;
  }
  // Le corps de la réponse de téléchargement (un flux), ou tout itérable d'octets.
  for await (const chunk of data) yield typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : Buffer.from(chunk);
}

if (target && typeof process.send === 'function') {
  const original = fsPromises.writeFile;
  fsPromises.writeFile = async function captureExport(file, data, options) {
    if (typeof file !== 'string' || path.resolve(file) !== target) return original.call(this, file, data, options);
    let bytes = 0;
    for await (const chunk of chunksOf(data)) {
      for (let offset = 0; offset < chunk.length; offset += CHUNK_BYTES) {
        const part = chunk.subarray(offset, offset + CHUNK_BYTES);
        bytes += part.length;
        await send({ kind: 'export-chunk', data: part.toString('base64') });
      }
    }
    await send({ kind: 'export-end', bytes });
  };
}
