import { env } from 'cloudflare:workers';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createJwksFetcher, verifyAccessJwt } from '@/lib/services/access-jwt';

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
  if (process.env.NODE_ENV !== 'production' && process.env.LOCAL_DEMO_USER === 'true') {
    return demoUser((await cookies()).get(DEMO_FARM_COOKIE)?.value);
  }
  return readAccessUser(await headers());
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (user) return user;
  redirect(signInPath());
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
    jwksFetcher = createJwksFetcher({ teamDomain: settings.teamDomain, fetchImpl: (url) => fetch(url) });
    jwksTeamDomain = settings.teamDomain;
  }
  const result = await verifyAccessJwt(token, {
    teamDomain: settings.teamDomain,
    audience: settings.audience,
    fetchJwks: jwksFetcher,
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
