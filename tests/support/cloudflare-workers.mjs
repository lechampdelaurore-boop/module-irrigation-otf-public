// Remplaçant de `cloudflare:workers` pour les tests Node.
//
// `env` est un objet vide et modifiable : sans liaison ni variable, le code
// applicatif suit ses branches « non configuré ». La base D1 des tests n'est
// pas posée ici mais par `overrideDatabase` de `db/binding.ts`.
export const env = {};
