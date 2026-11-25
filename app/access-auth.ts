import { env } from 'cloudflare:workers';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createJwksFetcher, verifyAccessJwt } from '@/lib/services/access-jwt';
import { DEMO_MOMENT_COOKIE, DEMO_PROFILE_COOKIE, demoOwnerUserId, resolveDemoChoice } from '@/lib/domain/demo/catalogue';
import { FARM_UNIDENTIFIED_MESSAGE } from '@/lib/domain/snapshot-policy';
import { isDemoDeployment } from '@/lib/services/deployment-mode';
import { realNow } from '@/lib/services/demo-clock';
import { recordDemoVisit } from '@/lib/services/demo-reset';
import { prepareDemoSpace } from '@/lib/services/demo-space';
import { FarmIdentityUnavailableError, resolveSpaceKey } from '@/lib/services/farm-identity-service';
import { assertSpaceNotFrozen, FarmFrozenError } from '@/lib/services/farm-erasure-request';
// La mémoire de chaque requête, posée avant que toute page ne lise la base (section 5 sexies du contrat de la tranche 4).
import './request-memo';

/**
 * Identité de l'utilisateur connecté.
 *
 * Cloudflare Access protège le Worker et transmet un jeton signé dans
 * `Cf-Access-Jwt-Assertion`, vérifié ici avec les clés publiques du domaine
 * Access de l'équipe : émetteur, audience, signature et validité. L'identifiant
 * utilisateur est le sujet du jeton ; le courriel et le nom servent à
 * l'affichage. Hors production, `LOCAL_DEMO_USER=true` fournit un utilisateur
 * de démonstration ; un parcours navigateur peut y choisir une autre ferme de
 * démonstration par le témoin `demo-farm` (3.8 : la première ouverture se
 * vérifie sur une ferme neuve, docs/browser-journeys-contract.md).
 */
export type AuthenticatedUser = {
  /**
   * La clé de l'espace où la personne travaille (docs/tranche-4-contract.md,
   * F327) : sa personne et sa ferme, ou en démonstration la ferme fictive et
   * le moment choisis. Jamais l'identifiant de la personne seul.
   */
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const ACCESS_JWT_HEADER = 'cf-access-jwt-assertion';
const ACCESS_LOGIN_PATH = '/cdn-cgi/access/login';
const ACCESS_LOGOUT_PATH = '/cdn-cgi/access/logout';

const DEMO_USER: AuthenticatedUser = {
  userId: 'local-demo-user',
  displayName: 'Ferme de démonstration',
  email: 'demo@local.invalid',
  fullName: 'Ferme de démonstration',
};

const DEMO_FARM_COOKIE = 'demo-farm';
const DEMO_FARM_PATTERN = /^[a-z0-9-]{1,40}$/;

/** Une autre ferme de démonstration, toujours sous le préfixe `local-demo-`, jamais hors développement. */
function demoUser(farm: string | undefined): AuthenticatedUser {
  if (!farm || !DEMO_FARM_PATTERN.test(farm)) return DEMO_USER;
  return { ...DEMO_USER, userId: `local-demo-${farm}` };
}

/**
 * La personne connectée et son espace. Un espace qui a une demande
 * d'effacement ouverte est figé (docs/tranche-4-contract.md, F647, F666) :
 * `FarmFrozenError`, avant toute lecture d'Ouvre ta ferme et toute saisie,
 * sauf pour qui le demande (`allowFrozen` : l'annulation, la page d'état de
 * l'exploitant, qui ne touche pas aux données de sa ferme).
 */
export async function getAuthenticatedUser({ allowFrozen = false }: { allowFrozen?: boolean } = {}): Promise<AuthenticatedUser | null> {
  const user = await authenticatedUserOfRender(allowFrozen);
  // Une copie par appelant : ce que l'un change ne se voit pas chez l'autre.
  return user ? { ...user } : null;
}

/**
 * Lue une fois par rendu de page, pour chaque valeur de `allowFrozen`
 * (section 5 sexies du contrat de la tranche 4) : la page la demande, et la
 * page introuvable que son rendu prépare avec elle la redemandait deux fois,
 * avec la vérification du jeton, la ferme et l'effacement. `cache` de React la
 * garde le temps du rendu d'une page, jamais d'une requête à l'autre ; hors
 * d'un rendu (une action, une route, le premier passage de vinext sur une
 * page), elle est lue à chaque appel, comme avant : le rendu qui suit une
 * action voit l'espace qu'elle vient de figer ou de rattacher. Une erreur vaut
 * pour tout le rendu.
 */
const authenticatedUserOfRender = cache(async (allowFrozen: boolean): Promise<AuthenticatedUser | null> => {
  const user = await readUser();
  if (!user) return null;
  if (isDemoDeployment()) return demoSpaceUser(user);
  const spaceUser = await farmSpaceUser(user);
  if (!allowFrozen) await assertSpaceNotFrozen(spaceUser.userId, spaceUser.displayName);
  return spaceUser;
});

/**
 * Hors démonstration, la personne travaille dans l'espace de sa ferme
 * (docs/tranche-4-contract.md, F327, F331, F340) : la clé vient du serveur,
 * jamais du navigateur, et son espace d'avant la 4.1 est rattaché à sa ferme
 * au passage. Sans ferme établie, rien n'est montré :
 * `FarmIdentityUnavailableError` (F341).
 */
async function farmSpaceUser(user: AuthenticatedUser): Promise<AuthenticatedUser> {
  try {
    return { ...user, userId: await resolveSpaceKey(user.userId) };
  } catch (error) {
    if (error instanceof FarmIdentityUnavailableError) throw new FarmIdentityUnavailableError(user.displayName);
    throw error;
  }
}

async function readUser(): Promise<AuthenticatedUser | null> {
  if (process.env.NODE_ENV !== 'production' && process.env.LOCAL_DEMO_USER === 'true') {
    return demoUser((await cookies()).get(DEMO_FARM_COOKIE)?.value);
  }
  return readAccessUser(await headers());
}

/**
 * En démonstration, l'invité travaille dans l'espace de la ferme fictive et
 * du moment qu'il a choisis (docs/demo-guided-contract.md, sections 4 à 6) :
 * un espace par invité, par ferme et par moment, préparé à sa première
 * ouverture. Son nom reste le sien.
 */
async function demoSpaceUser(user: AuthenticatedUser): Promise<AuthenticatedUser> {
  const jar = await cookies();
  const choice = resolveDemoChoice(jar.get(DEMO_PROFILE_COOKIE)?.value, jar.get(DEMO_MOMENT_COOKIE)?.value);
  const userId = demoOwnerUserId(user.userId, choice);
  await prepareDemoSpace(userId, choice);
  // Le passage de l'invité, pour la remise à zéro de nuit des espaces inactifs (D4).
  await recordDemoVisit(userId);
  return { ...user, userId };
}

export async function requireAuthenticatedUser(options: { allowFrozen?: boolean } = {}): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(options);
  if (user) return user;
  redirect(signInPath());
}

/**
 * Pour une route qui rend un fichier plutôt qu'une page : la personne
 * connectée, ou la réponse qui refuse la demande, session expirée ou ferme de
 * la clé pas encore établie (docs/tranche-4-contract.md, F341).
 */
export async function authenticatedUserOrRefusal(): Promise<AuthenticatedUser | Response> {
  try {
    return (await getAuthenticatedUser()) ?? new Response('Session expirée.', { status: 401 });
  } catch (error) {
    // L'espace est figé par une demande d'effacement : rien ne se lit (F666).
    if (error instanceof FarmFrozenError) return new Response(error.view.title, { status: 423, headers: { 'Cache-Control': 'no-store' } });
    if (!(error instanceof FarmIdentityUnavailableError)) throw error;
    return new Response(FARM_UNIDENTIFIED_MESSAGE, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

/** Access ramène l'utilisateur sur la page demandée après connexion. */
function signInPath(): string {
  return ACCESS_LOGIN_PATH;
}

export function signOutPath(): string {
  return ACCESS_LOGOUT_PATH;
}

let jwksFetcher: ReturnType<typeof createJwksFetcher> | null = null;
let jwksTeamDomain: string | null = null;

function accessSettings(): { teamDomain: string; audience: string } | null {
  const teamDomain = (process.env.ACCESS_TEAM_DOMAIN ?? env.ACCESS_TEAM_DOMAIN)?.trim();
  const audience = (process.env.ACCESS_AUD ?? env.ACCESS_AUD)?.trim();
  return teamDomain && audience ? { teamDomain, audience } : null;
}

async function readAccessUser(requestHeaders: Headers): Promise<AuthenticatedUser | null> {
  const token = requestHeaders.get(ACCESS_JWT_HEADER);
  const settings = accessSettings();
  if (!token || !settings) return null;
  if (!jwksFetcher || jwksTeamDomain !== settings.teamDomain) {
    // L'heure réelle, jamais celle du jour simulé de la démonstration (D-112).
    jwksFetcher = createJwksFetcher({ teamDomain: settings.teamDomain, fetchImpl: (url) => fetch(url), now: realNow });
    jwksTeamDomain = settings.teamDomain;
  }
  const result = await verifyAccessJwt(token, {
    teamDomain: settings.teamDomain,
    audience: settings.audience,
    fetchJwks: jwksFetcher,
    now: new Date(realNow()),
  });
  if (!result.ok) return null;
  const email = result.payload.email?.trim() ?? '';
  const fullName = result.payload.name?.trim() || null;
  return {
    userId: result.payload.sub,
    email,
    fullName,
    displayName: fullName ?? (email || result.payload.sub),
  };
}
