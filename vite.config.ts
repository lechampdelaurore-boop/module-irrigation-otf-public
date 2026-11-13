import vinext from 'vinext';
import { defineConfig } from 'vite';

/**
 * Cible unique de déploiement : Worker et base D1 du compte du porteur,
 * décrits par `wrangler.jsonc` ; connexion par Cloudflare Access (D-016).
 * En développement local, les valeurs viennent de `.dev.vars`.
 */
export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in the ignored `.dev.vars` file.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  const viteEnvironment = { name: 'rsc', childEnvironments: ['ssr'] };

  return {
    // Les parcours de la démonstration démarrent la même application sur une
    // configuration locale écrite à part (scripts/demo-e2e-server.mjs), sans
    // toucher celle de la production.
    plugins: [vinext(), cloudflare({ viteEnvironment, configPath: process.env.IRRIGATION_WRANGLER_CONFIG ?? 'wrangler.jsonc' })],
  };
});
