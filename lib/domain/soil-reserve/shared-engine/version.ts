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
  version: '0.2.0',
  repository: 'https://github.com/lechampdelaurore-boop/moteur-hydrique-commun-public',
  // La PR n° 13 du dépôt commun, empilée sur les n° 11 et 12 : à remplacer par le commit de main après leur fusion.
  commit: 'b8c22a19ebdf25576d31e7c4d055bf1832d2bcfb',
  files: {
    'moteur-hydrique.mjs': '451b16b839ff58be460f4b7802f5a34ac0ab9795681c52289cbe4559dcd00e7c',
    'moteur-hydrique.d.mts': '2d30d457574af2e70b06d0a308e0fcca0a939329c0f5af79b3c5f1d18361bb4f',
    'types/bilan.d.ts': '269798fd20126ab2d05422c372df120284ee8ea3d4ab5e66b79d2f844ef50e7e',
    'types/moteur.d.ts': '4707424158d7566332bbd597284f09ca5a9b1607a0f3672cf31ce7250b72dfdd',
    'types/observations.d.ts': 'a9f97ad724760d32801efec16286629a42380b0c8e26cd355cff39f598c15c94',
    'types/pas-horaire.d.ts': '2ab87c9a8ab50d12130580a8f06f66aabb45b8935c8d3447e18bed7b5461e6fd',
    'types/pluie.d.ts': '38c27b38f53d6d7d3accf18dfd916fb7e3da323bd0e0710fc00704c243cec55c',
    'types/reglages.d.ts': '7e6a8dd043ba37d5304185cc6deb214b4ee4dee7d7091482c040e5908ba88df3',
    'NOTICE': '92b0b3eeb87f99aec87ca72174895c2801c22f454c8cf41f24cbcdd879f2df57',
  },
} as const;
