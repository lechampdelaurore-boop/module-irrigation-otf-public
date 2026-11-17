/**
 * L'adresse de retour après une autorisation dans Ouvre ta ferme (sous-tranche
 * 4.8, docs/tranche-4-contract.md, section 9, T4-19 ; D-153). Elle est fixée
 * maintenant parce qu'elle est donnée au formulaire d'Ouvre ta ferme et ne
 * doit plus changer ; la connexion elle-même (échange du code, coffre des
 * jetons) appartient à la 4.3. D'ici là, la route ne lit, ne garde, ne
 * journalise et ne renvoie rien de ce que l'adresse porte (`code`, `state`) :
 * elle dit seulement que la connexion n'est pas encore ouverte.
 */

/** Le chemin fixe, servi derrière la connexion du module. */
export const OTF_OAUTH_RETURN_PATH = '/api/otf/oauth/retour';

export type OtfOauthReturnResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

/** La page servie à l'adresse de retour tant que la 4.3 n'est pas faite. */
export function otfOauthReturnNotOpenYet(): OtfOauthReturnResponse {
  return {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Le code d'autorisation est dans l'adresse : jamais en cache, jamais transmis par un lien suivi.
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    },
    body: `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connexion à Ouvre ta ferme</title>
</head>
<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.6;">
<main>
<h1>La connexion à Ouvre ta ferme n'est pas encore ouverte</h1>
<p>Le module ne sait pas encore se relier à Ouvre ta ferme par cette voie. Aucune donnée n'a été lue ni enregistrée.</p>
<p><a href="/irrigation" style="display: inline-flex; align-items: center; min-height: 44px;">Revenir au module</a></p>
</main>
</body>
</html>
`,
  };
}
