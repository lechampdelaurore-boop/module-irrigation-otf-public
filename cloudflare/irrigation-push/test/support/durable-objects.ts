/**
 * Une mémoire de test à la place de l'exécution Cloudflare des Durable
 * Objects, pour faire tourner les vraies classes du Worker sous Node
 * (docs/tranche-4-contract.md, F378 ; constat C3 de la revue de l'isolation).
 *
 * Ce qui est imité, et seulement cela :
 * - une instance par nom et par espace de noms, créée à son premier appel ;
 * - le stockage SQL d'une instance, sur une base `node:sqlite` en mémoire, et
 *   son stockage clé-valeur, avec son alarme ;
 * - `blockConcurrencyWhile`, qui fait passer ses blocs l'un après l'autre ;
 * - les appels d'une instance à l'autre, asynchrones, leurs arguments et
 *   leurs résultats copiés comme s'ils traversaient le réseau.
 * Les alarmes ne partent pas seules : le test les déclenche (`fireAlarms`).
 */
import { DatabaseSync } from 'node:sqlite';

type SqlValue = null | number | bigint | string | Uint8Array;
type Row = Record<string, SqlValue>;
type DurableObjectClass<T> = new (ctx: DurableObjectState, env: Env) => T;

const READ_STATEMENT = /^\s*(?:SELECT|WITH|PRAGMA)\b/i;

class MemorySqlStorage {
  private readonly database = new DatabaseSync(':memory:');

  exec(query: string, ...bindings: SqlValue[]) {
    const statement = this.database.prepare(query);
    const rows = READ_STATEMENT.test(query) ? statement.all(...bindings) as Row[] : (statement.run(...bindings), []);
    return {
      toArray: () => rows,
      one: () => {
        if (rows.length !== 1) throw new Error(`Une ligne attendue, ${rows.length} obtenues.`);
        return rows[0];
      },
    };
  }
}

class MemoryState {
  private readonly values = new Map<string, unknown>();
  private queue: Promise<unknown> = Promise.resolve();
  alarmAt: number | null = null;
  readonly id: { name: string };
  readonly storage;

  constructor(id: { name: string }) {
    this.id = id;
    const sql = new MemorySqlStorage();
    this.storage = {
      sql,
      get: async <T>(key: string) => structuredClone(this.values.get(key)) as T | undefined,
      put: async (key: string, value: unknown) => {
        this.values.set(key, structuredClone(value));
      },
      delete: async (key: string) => this.values.delete(key),
      deleteAll: async () => {
        this.values.clear();
        this.alarmAt = null;
      },
      setAlarm: async (time: number) => {
        this.alarmAt = time;
      },
      deleteAlarm: async () => {
        this.alarmAt = null;
      },
    };
  }

  /** Les clés gardées par l'instance, pour qu'un test vérifie ce qui a été oublié. */
  keys(): string[] {
    return [...this.values.keys()];
  }

  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    const run = this.queue.then(callback);
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }
}

export class MemoryNamespace<T extends object> {
  private readonly instances = new Map<string, { object: T; state: MemoryState }>();
  private readonly objectClass: DurableObjectClass<T>;
  private readonly env: () => Env;

  constructor(objectClass: DurableObjectClass<T>, env: () => Env) {
    this.objectClass = objectClass;
    this.env = env;
  }

  idFromName(name: string) {
    return { name, toString: () => name };
  }

  get(id: { name: string }): T {
    const instance = this.instance(id.name);
    return new Proxy(instance.object, {
      get: (target, property) => {
        const member = Reflect.get(target, property) as unknown;
        if (typeof member !== 'function') return member;
        return async (...args: unknown[]) => structuredClone(
          await (member as (...values: unknown[]) => unknown).apply(target, structuredClone(args)),
        );
      },
    });
  }

  /** Les noms des instances créées, dans l'ordre de leur premier appel. */
  names(): string[] {
    return [...this.instances.keys()];
  }

  /** Les clés gardées par une instance, vide si elle n'existe pas. */
  storedKeys(name: string): string[] {
    return this.instances.get(name)?.state.keys() ?? [];
  }

  /** Déclenche l'alarme de chaque instance qui en a une ; rend les noms des instances déclenchées. */
  async fireAlarms(): Promise<string[]> {
    const fired: string[] = [];
    for (const [name, { object, state }] of this.instances) {
      if (state.alarmAt === null) continue;
      state.alarmAt = null;
      fired.push(name);
      await (object as unknown as { alarm: () => Promise<void> }).alarm();
    }
    return fired;
  }

  private instance(name: string) {
    let instance = this.instances.get(name);
    if (!instance) {
      const state = new MemoryState({ name });
      instance = { object: new this.objectClass(state as unknown as DurableObjectState, this.env()), state };
      this.instances.set(name, instance);
    }
    return instance;
  }
}
