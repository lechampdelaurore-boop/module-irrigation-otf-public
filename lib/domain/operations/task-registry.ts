import { HOURS_PER_DAY } from '../units.ts';

/**
 * Le registre des tâches attendues (4.5, PR 1 ; docs/tranche-4-contract.md,
 * section 10 bis, F560, et 10 bis.11, F600 à F607).
 *
 * Chaque tâche automatique du module est déclarée ici, en code, pour se
 * relire en revue : son rythme attendu, ses seuils (orange, puis rouge) avec
 * leur raison, l'effet d'un manque et l'endroit où sa dernière réussite est
 * gardée. Un seuil changé passe par une PR. L'état d'une tâche ne se recopie
 * nulle part : il se calcule à la lecture (`task-state.ts`), à partir de la
 * dernière réussite et de l'heure.
 *
 * Chaque déclencheur planifié des configurations Wrangler (celles de la
 * racine et celles des Workers du dossier `cloudflare`) est rangé dans `TASK_TRIGGERS` :
 * `tests/task-registry.test.ts` lit les configurations et échoue pour un
 * déclencheur absent d'ici (F560, règle v ; F569). Les alarmes du Worker de
 * notification ne sont pas des déclencheurs planifiés : chacune suit un
 * arrosage, sans rythme attendu, et n'est pas une tâche du registre.
 *
 * L'effacement des fermes qui l'ont demandé (4.5, PR 3 ; 10 bis.17, F645),
 * puis les purges de conservation (4.5, PR 5 ; 10 bis.18, F650) finissent
 * le matin.
 *
 * L'export de la base hors de Cloudflare (4.5, PR 4 ; 10 bis.14, F624) et
 * l'essai de restauration (10 bis.16, F636) y sont aussi, bien que faits par
 * l'exploitant : aucun déclencheur ne les lance (`OPERATOR_GESTURE`), un
 * geste de la page d'état note leur réussite, et la veille les surveille
 * comme les autres.
 */

/** Les tâches du registre ; la clé est aussi celle de la ligne qui garde leurs exécutions. */
export type TaskKey =
  | 'weather-forecast'
  | 'weather-reanalysis'
  | 'morning-calculation'
  | 'otf-vault-morning'
  | 'farm-erasure'
  | 'retention-purge'
  | 'offsite-export'
  | 'restore-rehearsal'
  | 'operator-watch'
  | 'evening-reminder';

export type TriggerKey = 'weather-morning' | 'operator-watch' | 'evening-reminder' | 'demo-nightly-reset';

/**
 * Une tâche faite par l'exploitant, hors du Worker, et notée par un geste de
 * la page d'état : aucun déclencheur ne la lance, mais la veille la surveille
 * comme les autres (10 bis.9 ; 10 bis.14, F625 ; 10 bis.16, F636).
 */
export const OPERATOR_GESTURE = 'operator-gesture';

export type TaskDeclaration = {
  key: TaskKey;
  /** Le nom de la tâche, en mots simples, tel que l'exploitant le lit. */
  label: string;
  /** Le rythme attendu, en clair. */
  rhythm: string;
  /** Au-delà, sans réussite, la tâche est « en retard » (orange). */
  lateAfterHours: number;
  /** Au-delà, sans réussite, la tâche est « en panne » (rouge). */
  brokenAfterHours: number;
  /** Pourquoi ces deux seuils. */
  thresholdReason: string;
  /** Ce qui manque aux fermes quand la tâche manque. */
  ifMissing: string;
  /** Où est gardée sa dernière réussite. */
  successKeptIn: string;
  trigger: TriggerKey | typeof OPERATOR_GESTURE;
};

/** Un déclencheur planifié d'une configuration Wrangler. */
export type TriggerDeclaration = {
  key: TriggerKey;
  /** Le fichier de configuration, depuis la racine du dépôt. */
  config: string;
  /** L'expression `cron`, telle qu'écrite dans la configuration (heure UTC). */
  cron: string;
  /** Ce que fait le déclencheur, en clair. */
  description: string;
} & (
  | { monitored: true }
  /** Un déclencheur hors de la veille de la production, avec sa raison. */
  | { monitored: false; reason: string }
);

/**
 * Trois exécutions manquées de suite font une panne, même quand une réussite
 * récente existe (R2) : un échec qui se répète n'est plus « passager ». Trois,
 * c'est trois matins pour une tâche du matin, ou trois relances à la main
 * qui échouent toutes (F560, iv ; F603).
 */
export const REPEATED_FAILURES_FOR_BROKEN = 3;

/**
 * Les tâches du matin passent chaque jour vers 6 h 15, heure de Paris, et
 * leur réussite s'enregistre quelques minutes après. Orange à 26 heures :
 * un jour et deux heures de marge, assez pour un matin plus lent ou un jour
 * de 25 heures au changement d'heure, et assez tôt pour que la veille de
 * 9 h (4.5, PR 2) voie le matin même un 6 h 15 manqué ; à 30 heures, elle ne
 * l'aurait vu que le lendemain (F601). Rouge à 36 heures, le seuil de
 * l'avertissement de la météo (D-165) : au moins un matin a manqué.
 */
const MORNING_THRESHOLDS = {
  lateAfterHours: 26,
  brokenAfterHours: 36,
  thresholdReason: 'Une exécution par jour vers 6 h 15 : orange à 26 heures (un jour et deux heures de marge, vu par la veille de 9 h le matin même), rouge à 36 heures (au moins un matin manqué, D-165).',
} as const;

export const TASK_TRIGGERS: readonly TriggerDeclaration[] = [
  {
    key: 'weather-morning',
    config: 'cloudflare/irrigation-weather-scheduler/wrangler.jsonc',
    cron: '15 4,5 * * *',
    description: 'Le planificateur appelle le site à 6 h 15, heure de Paris (l\'un des deux créneaux UTC, selon l\'heure d\'été) : météo, puis calculs du matin, puis coffre des jetons, puis effacement des fermes qui l\'ont demandé, puis purges de conservation.',
    monitored: true,
  },
  {
    key: 'operator-watch',
    config: 'cloudflare/irrigation-weather-scheduler/wrangler.jsonc',
    cron: '0 7,8 * * *',
    description: 'Le planificateur appelle la veille de l\'exploitant à 9 h, heure de Paris : un déclencheur distinct de ceux qu\'elle surveille (R5).',
    monitored: true,
  },
  {
    key: 'evening-reminder',
    config: 'cloudflare/irrigation-weather-scheduler/wrangler.jsonc',
    cron: '5 * * * *',
    description: 'Le planificateur appelle le passage du rappel du soir à chaque heure et cinq minutes : chaque ferme règle son heure, de 17 h à 22 h au quart d\'heure, et le passage envoie les rappels dus (amélioration n° 2, F705, F714). Avant 17 h, heure de Paris, il ne lit rien.',
    monitored: true,
  },
  {
    key: 'demo-nightly-reset',
    config: 'wrangler.demo.jsonc',
    cron: '17 2 * * *',
    description: 'La remise à zéro, chaque nuit, des espaces de la démonstration où personne n\'est passé depuis 24 heures.',
    monitored: false,
    reason: 'La démonstration a sa propre base, que la veille de la production ne lit pas ; aucune ferme ne dépend d\'elle. Un manque se voit à l\'écran de la démonstration (espaces non remis à zéro).',
  },
];

export const TASK_REGISTRY: readonly TaskDeclaration[] = [
  {
    key: 'weather-forecast',
    label: 'Prévisions météo de 6 h 15',
    rhythm: '1 par jour, vers 6 h 15 (heure de Paris)',
    ...MORNING_THRESHOLDS,
    ifMissing: 'Les prévisions, les alertes météo et de gel et le planning de la semaine restent sur les valeurs de la veille.',
    successKeptIn: 'Ligne « task:weather-forecast » de irrigation_background_jobs (réussie quand chaque lieu a reçu ses prévisions).',
    trigger: 'weather-morning',
  },
  {
    key: 'weather-reanalysis',
    label: 'Pluie estimée après coup (réanalyse)',
    rhythm: '1 par jour, vers 6 h 15 (heure de Paris)',
    ...MORNING_THRESHOLDS,
    ifMissing: 'La pluie des jours passés reste inconnue : le bilan de la semaine et la réserve du sol la comptent comme manquante.',
    successKeptIn: 'Ligne « task:weather-reanalysis » de irrigation_background_jobs, distincte des prévisions : le 14 novembre 2026, les prévisions passaient, la réanalyse non.',
    trigger: 'weather-morning',
  },
  {
    key: 'morning-calculation',
    label: 'Calcul du matin (planning, eau des cultures, réserve du sol, séchage)',
    rhythm: '1 par jour, après la météo de 6 h 15',
    ...MORNING_THRESHOLDS,
    ifMissing: 'Le planning de la semaine, l\'eau des cultures et la réserve du sol ne sont pas recalculés ; l\'arrêt d\'arrosage avant récolte n\'est pas prévenu.',
    successKeptIn: 'Ligne « task:morning-calculation » de irrigation_background_jobs (réussie quand aucune ferme n\'a échoué).',
    trigger: 'weather-morning',
  },
  {
    key: 'otf-vault-morning',
    label: 'Rotation du coffre des jetons d\'Ouvre ta ferme',
    rhythm: '1 par jour, à la fin du matin',
    ...MORNING_THRESHOLDS,
    ifMissing: 'Les jetons chiffrés avec l\'ancienne clé ne sont pas chiffrés de nouveau ; un jeton illisible n\'est pas signalé.',
    successKeptIn: 'Ligne « task:otf-vault-morning » de irrigation_background_jobs (réussie quand le coffre est endormi sans clé, ou quand chaque jeton se lit).',
    trigger: 'weather-morning',
  },
  {
    key: 'farm-erasure',
    label: 'Effacement des fermes qui l\'ont demandé',
    rhythm: '1 par jour, à la fin du matin : efface, par lots, les espaces dont la demande a plus de 7 jours ; ce qui reste reprend au passage suivant',
    ...MORNING_THRESHOLDS,
    ifMissing: 'Une ferme qui a demandé l\'effacement de ses données les garde au-delà des 7 jours promis (elle reste figée : aucun calcul, aucune notification).',
    successKeptIn: 'Ligne « task:farm-erasure » de irrigation_background_jobs (réussie quand aucune demande échue ne reste à effacer : sans demande, chaque matin réussit).',
    trigger: 'weather-morning',
  },
  {
    key: 'retention-purge',
    label: 'Purges de conservation',
    rhythm: '1 par jour, à la fin du matin : efface, par lots, les lignes plus vieilles que leur durée écrite (journal des appels à Ouvre ta ferme, notifications de la veille) ; ce qui reste reprend au passage suivant',
    ...MORNING_THRESHOLDS,
    ifMissing: 'Des données techniques restent au-delà de la durée écrite au contrat et dans la politique de confidentialité ; rien ne manque aux fermes.',
    successKeptIn: 'Ligne « task:retention-purge » de irrigation_background_jobs (réussie quand chaque purge est allée au bout).',
    trigger: 'weather-morning',
  },
  {
    key: 'offsite-export',
    label: 'Export de la base hors de Cloudflare',
    rhythm: '1 par semaine, le soir, fait par l\'exploitant sur son ordinateur (pnpm backup:export), puis noté ici',
    lateAfterHours: 8 * HOURS_PER_DAY,
    brokenAfterHours: 10 * HOURS_PER_DAY,
    thresholdReason: 'Une fois par semaine : orange à 8 jours (un jour de marge), rouge à 10 jours (la semaine est manquée). L\'historique de 30 jours de Cloudflare ne protège pas d\'une perte du compte : seule cette copie le fait (10 bis.9).',
    ifMissing: 'Si le compte Cloudflare était perdu, les fermes perdraient tout ce qui a été saisi depuis le dernier export gardé hors de Cloudflare.',
    successKeptIn: 'Ligne « task:offsite-export » de irrigation_background_jobs, écrite par le geste « J\'ai fait l\'export du … » de la page d\'état (le jour noté, jamais en recul).',
    trigger: OPERATOR_GESTURE,
  },
  {
    key: 'restore-rehearsal',
    label: 'Essai de restauration',
    rhythm: '1 par trimestre, et après un changement de schéma important : joué sur une base d\'essai par le flux « Essai de restauration » de GitHub Actions (pnpm backup:rehearse), sur le « vas-y » de l\'exploitant, puis noté ici',
    lateAfterHours: 100 * HOURS_PER_DAY,
    brokenAfterHours: 120 * HOURS_PER_DAY,
    thresholdReason: 'Une fois par trimestre : orange à 100 jours (un trimestre et neuf jours de marge), rouge à 120 jours (quatre mois : le trimestre est manqué). Une sauvegarde dont la restauration n\'est pas essayée peut ne rien rendre le jour où il le faut (10 bis.8).',
    ifMissing: 'Rien ne prouve plus que l\'historique de Cloudflare et l\'export de la semaine rendraient la base : un défaut ne se verrait que le jour d\'une restauration.',
    successKeptIn: 'Ligne « task:restore-rehearsal » de irrigation_background_jobs, écrite par le geste « J\'ai fait l\'essai du … » de la page d\'état (le jour noté, jamais en recul).',
    trigger: OPERATOR_GESTURE,
  },
  {
    key: 'operator-watch',
    label: 'Veille de l\'exploitant',
    rhythm: '1 par jour, à 9 h (heure de Paris)',
    lateAfterHours: 26,
    brokenAfterHours: 36,
    thresholdReason: 'Une exécution par jour à 9 h : orange à 26 heures (un jour et deux heures de marge), rouge à 36 heures (au moins un jour sans veille). Si la veille ne passe plus, la notification « tout va bien » du dimanche manque : l\'exploitant sait qu\'il doit regarder (F566).',
    ifMissing: 'Une panne d\'une autre tâche ne remonte plus à l\'exploitant sans qu\'il ouvre la page d\'état.',
    successKeptIn: 'Ligne « task:operator-watch » de irrigation_background_jobs (réussie quand la veille a lu le registre et que la notification due, s\'il y en avait une, est partie vers un appareil de l\'exploitant).',
    trigger: 'operator-watch',
  },
  {
    key: 'evening-reminder',
    label: 'Rappel du soir des arrosages non confirmés',
    rhythm: '1 passage par heure, à l\'heure et cinq minutes ; chaque ferme reçoit son rappel au premier passage après l\'heure qu\'elle a réglée',
    lateAfterHours: 3,
    brokenAfterHours: 6,
    thresholdReason: 'Un passage par heure : orange à 3 heures (deux passages manqués), rouge à 6 heures (une soirée de rappels peut être perdue, puisqu\'un rappel n\'est plus envoyé deux heures après l\'heure réglée).',
    ifMissing: 'Les fermes ne reçoivent pas le rappel des arrosages validés du jour jamais confirmés ; rien n\'est confirmé à leur place.',
    successKeptIn: 'Ligne « task:evening-reminder » de irrigation_background_jobs (réussi quand chaque rappel dû est parti, ou qu\'aucun n\'était dû).',
    trigger: 'evening-reminder',
  },
];

export function taskDeclaration(key: TaskKey): TaskDeclaration {
  const declaration = TASK_REGISTRY.find((task) => task.key === key);
  if (!declaration) throw new Error(`Tâche absente du registre : ${key}`);
  return declaration;
}

/** Les tâches qu'un déclencheur lance, dans l'ordre du registre. */
export function tasksOfTrigger(trigger: TriggerKey): TaskKey[] {
  return TASK_REGISTRY.filter((task) => task.trigger === trigger).map((task) => task.key);
}
