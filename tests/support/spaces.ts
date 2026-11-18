/**
 * Les deux espaces des tests de persistance, ALICE et BOB (4.2,
 * docs/tranche-4-contract.md, section 5 bis, F336).
 *
 * Par défaut, deux personnes sans ferme, comme avant la 4.1. `pnpm test`
 * rejoue ensuite les mêmes tests de `tests/db/` deux fois, et chaque test qui
 * prouvait que Bob ne voit rien d'Alice prouve alors l'isolation des fermes :
 * - passage « fermes » : une même personne sur deux fermes, avec les mêmes
 *   identifiants d'Ouvre ta ferme dans l'une et l'autre ;
 * - passage « personnes » : deux personnes sur une même ferme ;
 * - passage « rattachement » : l'espace sans ferme d'une personne et son
 *   espace de ferme, le cas du rattachement quand les données viennent d'une
 *   autre ferme (F331 ; constat C2 de la revue de l'isolation du
 *   18 novembre 2026, docs/tranche-4-contract.md, F379).
 * Le passage est choisi par `tests/support/isolation-fermes.mjs`,
 * `tests/support/isolation-personnes.mjs` ou
 * `tests/support/isolation-rattachement.mjs`, chargés par `--import`.
 */
import { farmSpaceKey } from '../../lib/domain/farm-space.ts';

type IsolationPass = 'fermes' | 'personnes' | 'rattachement' | 'sans-ferme';

function isolationPass(): IsolationPass {
  const value = process.env.ISOLATION_SPACES;
  return value === 'fermes' || value === 'personnes' || value === 'rattachement' ? value : 'sans-ferme';
}

const SPACES: Record<IsolationPass, { alice: string; bob: string }> = {
  'sans-ferme': { alice: 'alice', bob: 'bob' },
  fermes: { alice: farmSpaceKey('alice', '7'), bob: farmSpaceKey('alice', '8') },
  personnes: { alice: farmSpaceKey('alice', '7'), bob: farmSpaceKey('bob', '7') },
  rattachement: { alice: 'alice', bob: farmSpaceKey('alice', '7') },
};

export const ISOLATION_PASS = isolationPass();
export const ALICE = SPACES[ISOLATION_PASS].alice;
export const BOB = SPACES[ISOLATION_PASS].bob;
