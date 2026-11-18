import { env } from 'cloudflare:workers';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createJwksFetcher, verifyAccessJwt } from '@/lib/services/access-jwt';
import { DEMO_MOMENT_COOKIE, DEMO_PROFILE_COOKIE, demoOwnerUserId, resolveDemoChoice } from '@/lib/domain/demo/catalogue';
import { FARM_UNIDENTIFIED_MESSAGE } from '@/lib/domain/snapshot-policy';
import { isDemoDeployment } from '@/lib/services/deployment-mode';
import { realNow } from '@/lib/services/demo-clock';
import { recordDemoVisit } from '@/lib/services/demo-reset';
import { prepareDemoSpace } from '@/lib/services/demo-space';
import { FarmIdentityUnavailableError, resolveSpaceKey } from '@/lib/services/farm-identity-service';

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

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const user = await readUser();
  if (!user) return null;
  return isDemoDeployment() ? demoSpaceUser(user) : farmSpaceUser(user);
}

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

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
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
