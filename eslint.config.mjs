import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Frontières entre zones (sous-tranche Q3) : docs/boundaries-contract.md.
// Chaque zone déclare ce qu'elle n'a pas le droit d'importer ; un import
// interdit fait échouer le lint. Le test tests/lint-boundaries.test.ts vérifie
// ces règles sur des cas négatifs et positifs.
const CONTRACT = 'docs/boundaries-contract.md';
const because = (text) => `${text} Voir ${CONTRACT}.`;

const FRAMEWORKS = ['react', 'react/**', 'react-dom', 'react-dom/**', 'next', 'next/**'];
const RUNTIME = 'cloudflare:workers';
/** Chemins d'un dossier racine, en alias et en relatif jusqu'à trois niveaux. */
const folder = (name) => [`@/${name}/**`, `../${name}/**`, `../../${name}/**`, `../../../${name}/**`];
const zone = (name) => [`@/lib/${name}/**`, `../${name}/**`, `../../${name}/**`, `../../../${name}/**`];

const noApp = { group: folder('app'), message: because('Rien n’importe app/ : la couche interface dépend des autres, jamais l’inverse.') };
const noFrameworks = { group: FRAMEWORKS, message: because('React et Next restent dans app/.') };
const noRuntime = { name: RUNTIME, message: because('Seuls lib/services et db/binding.ts touchent l’exécution Cloudflare.') };

const boundaryRules = [
  {
    files: ['lib/domain/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: [noRuntime],
        patterns: [
          noFrameworks,
          noApp,
          { group: [...zone('services'), ...zone('adapters')], message: because('lib/domain n’importe que lib/domain.') },
          // Exception de Q3 levée en Q6 : les enregistrements sont descendus
          // dans lib/domain, le domaine n’a donc plus rien à lire dans db/,
          // même en type (décision D-020).
          { group: folder('db'), message: because('lib/domain n’importe rien de db/ : les enregistrements vivent dans lib/domain.') },
        ],
      }],
    },
  },
  {
    files: ['lib/adapters/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: [noRuntime],
        patterns: [
          noFrameworks,
          noApp,
          { group: [...zone('services'), ...folder('db')], message: because('lib/adapters n’importe que lib/domain et lib/adapters.') },
        ],
      }],
    },
  },
  {
    files: ['lib/services/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [noFrameworks, noApp] }],
    },
  },
  {
    files: ['db/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [
          noFrameworks,
          noApp,
          { group: [...zone('services'), ...zone('adapters')], message: because('db/ n’importe que lib/domain.') },
        ],
      }],
    },
  },
  {
    // Composants clients : tout .tsx de app/ hors page.tsx, layout.tsx et
    // not-found.tsx (la page introuvable, serveur, audit ergonomique point 7),
    // plus les modules clients sans JSX que Q6 a extraits (hooks, formats), qui
    // portent eux aussi la directive 'use client'.
    files: ['app/**/*.tsx', 'app/irrigation/irrigation-manager/**/*.ts'],
    ignores: ['app/**/page.tsx', 'app/**/layout.tsx', 'app/**/not-found.tsx'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: [noRuntime],
        patterns: [
          { group: folder('db'), allowTypeImports: true, message: because('Un composant client n’importe db/ qu’en type.') },
        ],
      }],
    },
  },
  {
    // Unités : les facteurs de conversion vivent dans lib/domain/units.ts ; les
    // Workers, sans accès à ce module, et les tests restent libres.
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['lib/domain/units.ts', 'tests/**', 'cloudflare/**', '**/*.d.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        // 1000 n'est interdit que comme facteur (× ou ÷) : une borne de saisie ou une longueur de texte restent libres.
        { selector: 'BinaryExpression[operator="*"] > Literal[value=1000], BinaryExpression[operator="/"] > Literal[value=1000]', message: because('Facteur d’unité : litres, millimètres sur m² ou millisecondes passent par lib/domain/units.ts.') },
        { selector: 'Literal[value=3600]', message: because('Facteur d’unité : heures et secondes passent par lib/domain/units.ts.') },
        { selector: 'Literal[value=60000]', message: because('Facteur d’unité : minutes et millisecondes passent par lib/domain/units.ts.') },
      ],
    },
  },
  {
    // Taille des fichiers : en erreur depuis la clôture de Q6, le 21 septembre
    // 2026. Deux exceptions déclarées : la description du schéma, qui est une
    // liste de tables, et les types engendrés par Wrangler. Les fichiers de
    // styles, qu'ESLint ne lit pas, sont tenus par leur propre test.
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['db/schema.ts', '**/*.d.ts'],
    rules: {
      'max-lines': ['error', { max: 600, skipBlankLines: true, skipComments: true }],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundaryRules,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'cloudflare/irrigation-push/worker-configuration.d.ts',
    'cloudflare/irrigation-weather-scheduler/worker-configuration.d.ts',
  ]),
]);

export default eslintConfig;
