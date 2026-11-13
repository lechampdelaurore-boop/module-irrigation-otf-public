/**
 * Le démarrage du module (docs/demo-guided-contract.md, section 5, couches 2
 * et 3). vinext attend `register()` avant de charger la moindre page, et
 * mémorise son échec : un déploiement qui mélange démonstration et ferme
 * réelle ne sert aucune page. En démonstration, l'appel réseau est gardé avant
 * que les adaptateurs ne le lisent.
 */
export async function register(): Promise<void> {
  const { startDeployment } = await import('./lib/services/deployment-mode');
  startDeployment();
}
