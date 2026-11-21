// Ce qu'un journal du module ne contient jamais (docs/tranche-4-contract.md,
// F564 ; 10 bis.13, F617) : un jeton, un paramètre d'autorisation d'OTF, une
// adresse de retour, une adresse électronique, un nom de ferme. Le garde des
// essais (`log-guard.mjs`) passe chaque ligne écrite pendant les tests par
// `sensitiveValuesIn` ; l'essai témoin (`tests/log-safety.test.ts`) le
// prouve sur des valeurs piégées.
//
// Les motifs reconnaissent des formes, pas des valeurs connues : un jeton
// nouveau, ou une ferme que les essais n'ont jamais nommée, est trouvé de
// même. Les noms des fermes des jeux d'essai s'y ajoutent, parce qu'un nom
// comme « Ferme de démonstration » n'a pas de forme reconnaissable.

/** Les noms de ferme des jeux d'essai qu'aucun motif ne reconnaît. */
const FIXTURE_FARM_NAMES = ['Ferme de démonstration', 'Ferme de test', 'Ferme fictive', 'Ferme des essais'];

/** Chaque motif, avec ce qu'il trouve, en mots. */
export const SENSITIVE_LOG_PATTERNS = [
  { kind: 'jeton JWT', pattern: /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/ },
  { kind: 'en-tête d’autorisation', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{4,}/i },
  { kind: 'paramètre d’autorisation', pattern: /[?&#;](?:code|state|code_verifier|access_token|refresh_token|id_token|client_secret|client_id)=/i },
  {
    kind: 'champ secret',
    pattern: /["']?\b(?:access_?token|refresh_?token|id_?token|client_?secret|code_?verifier|password|authorization)\b["']?\s*[:=]\s*["']?(?!null\b|undefined\b|false\b|true\b)[^\s"',}\]]{4,}/i,
  },
  { kind: 'adresse de retour', pattern: /\/oauth\/retour\?/ },
  { kind: 'adresse électronique', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/ },
  { kind: 'nom de ferme', pattern: /\bFerme\s+(?:(?:de\s+la|de|des|du)\s+|d['’]\s*)?(?:\p{Lu}|\d)/u },
  { kind: 'nom de ferme', pattern: new RegExp(FIXTURE_FARM_NAMES.join('|')) },
  { kind: 'chaîne opaque', pattern: /(?<![A-Za-z0-9_-])(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{40,}(?![A-Za-z0-9_-])/ },
];

/** Ce que la ligne contient de sensible : la nature de chaque valeur trouvée, jamais la valeur. */
export function sensitiveValuesIn(line) {
  return SENSITIVE_LOG_PATTERNS.filter(({ pattern }) => pattern.test(line)).map(({ kind }) => kind);
}
