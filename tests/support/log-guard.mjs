// Le garde des journaux (docs/tranche-4-contract.md, F564 ; 10 bis.13,
// F617) : chaque ligne que les essais écrivent dans la console, ou donnent à
// une console remplacée par `mock.method`, passe par `sensitiveValuesIn`.
// Après le dernier essai du fichier, une ligne sensible fait échouer le
// fichier, avec la nature de la valeur trouvée et la ligne coupée.
//
// Chargé par `register.mjs`, donc par chaque processus d'essais, y compris
// ceux de l'isolation des fermes et des personnes.
import { after, mock } from 'node:test';
import { inspect } from 'node:util';
import { sensitiveValuesIn } from './log-safety.mjs';

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'];
const EXCERPT_LENGTH = 240;
const findings = [];
let scanned = 0;

function textOf(part) {
  return typeof part === 'string' ? part : inspect(part, { depth: 8, breakLength: Infinity });
}

function scan(parts) {
  const line = parts.map(textOf).join(' ');
  scanned += 1;
  const kinds = sensitiveValuesIn(line);
  if (kinds.length > 0) findings.push({ kinds, line: line.slice(0, EXCERPT_LENGTH) });
}

for (const method of CONSOLE_METHODS) {
  const original = console[method];
  console[method] = function guardedConsole(...parts) {
    scan(parts);
    return original.apply(this, parts);
  };
}

// Un essai qui remplace la console pour lire ses lignes les lit encore ; le
// garde les voit avant lui.
const mockMethod = mock.method.bind(mock);
mock.method = (object, methodName, implementation, options) => {
  if (object === console && typeof implementation === 'function') {
    return mockMethod(object, methodName, function guardedMock(...parts) {
      scan(parts);
      return implementation.apply(this, parts);
    }, options);
  }
  return mockMethod(object, methodName, implementation, options);
};

/** Les lignes passées par le garde dans ce processus : l'essai témoin vérifie qu'il les voit. */
export function guardedLineCount() {
  return scanned;
}

/** Les lignes sensibles trouvées jusqu'ici, et les oublie : l'essai témoin les lit lui-même. */
export function takeLogFindings() {
  return findings.splice(0, findings.length);
}

after(() => {
  if (findings.length === 0) return;
  const report = findings.map(({ kinds, line }) => `- ${[...new Set(kinds)].join(', ')} : ${line}`).join('\n');
  throw new Error(`${findings.length} ligne(s) de journal contiennent une valeur sensible (F564) :\n${report}`);
});
