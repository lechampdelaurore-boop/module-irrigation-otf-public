// Remplaçant de `cloudflare:workers` pour les tests Node du Worker Push.
//
// La classe de base des Durable Objects ne fait que garder l'état et
// l'environnement que la mémoire de test (`durable-objects.ts`) lui donne :
// le code des classes du Worker s'exécute tel quel.
export class DurableObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
}
