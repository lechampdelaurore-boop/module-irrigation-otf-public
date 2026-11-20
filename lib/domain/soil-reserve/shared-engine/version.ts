/**
 * La copie figée du moteur hydrique commun (docs/shared-engine-adapter-contract.md,
 * « Le moteur figé ») : sa version, le commit du dépôt commun d'où viennent
 * les fichiers, et l'empreinte SHA-256 de chacun. Le moteur et ses types sont
 * copiés tels quels de `dist/`, `NOTICE` (les mentions requises par la
 * licence) de la racine du dépôt commun ; aucun n'est modifié à la main. Ce
 * manifeste est le seul fichier du dossier écrit ici ; une nouvelle version
 * entre par sa propre PR. Un test vérifie chaque empreinte.
 */
export const SHARED_ENGINE_COPY = {
  version: '0.3.0',
  repository: 'https://github.com/lechampdelaurore-boop/moteur-hydrique-commun-public',
  // Le commit de main du dépôt commun après la fusion de ses PR n° 11 à 14, approuvées par Nicolas.
  commit: 'a36ca0d352a5390b34e1089995e7cf2b9ac78b73',
  files: {
    'moteur-hydrique.mjs': '4e71ddaf5a6d30a529edb7b7230ed390684a5128668b111313b8fb19b39e4e43',
    'moteur-hydrique.d.mts': '0f505711abea7f960f59cec6fa19603e8ea028f68a3a1171a8375e9a213f3ef5',
    'types/bilan.d.ts': '1a47ee905088ed31930ff535afb43344690a15bab38ea74f9c3fcdac0d10475e',
    'types/moteur.d.ts': 'f44b896e9a7836e9349c1ad1e12c5a9a9ec59c230b87a01a899a8e846abbbd88',
    'types/observations.d.ts': 'fbe759cb1ea7fa6b7feea0ccbcf1f8e4c48f27a2afc11cac09976e808c718006',
    'types/pas-horaire.d.ts': '2da04b79ccab80b16f9f808c3bd9d31a0ea5b863eeca967d9850118b9edf7132',
    'types/pluie.d.ts': 'ed7c6df77ffa8454aba4ef2f7da2bb14012024c3197367af5bfe7eb22ce271da',
    'types/reglages.d.ts': '699b489ccd54b41ec097210b7c3ac4a74a4328a49231adb4e3686d66df9ba57c',
    'NOTICE': '92b0b3eeb87f99aec87ca72174895c2801c22f454c8cf41f24cbcdd879f2df57',
  },
} as const;
