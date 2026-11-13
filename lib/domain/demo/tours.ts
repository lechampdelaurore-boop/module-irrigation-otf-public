import type { IrrigationPageId } from '../features/pages.ts';

/**
 * Les sept visites guidées de la démonstration (docs/demo-guided-contract.md,
 * section 7 ; D3 de la sous-tranche 4.0). Une visite est une suite de bulles,
 * chacune accrochée à un élément de l'écran par son attribut `data-tour`,
 * jamais par son texte ni par sa place dans le menu. Une étape dont l'élément
 * manque (case décochée, page masquée, bloc vide) est sautée sans message.
 *
 * Les textes sont écrits pour quelqu'un qui n'a jamais vu le module : aucun
 * sigle sans son sens, aucun chiffre de ferme (les chiffres sont à l'écran),
 * aucun nom de ferme réelle. Ils pourront suivre l'audit ergonomique final.
 */

/** Une page du module, ou l'écran de la première ouverture (la ferme vierge). */
export type TourPage = IrrigationPageId | 'bienvenue';

export type TourStep = {
  /**
   * Les pages où l'étape se joue, par ordre de préférence. Absentes : la
   * page ouverte, quelle qu'elle soit.
   */
  pages?: readonly TourPage[];
  /** La valeur de l'attribut `data-tour` de l'élément visé ; absente, la bulle se pose au milieu. */
  anchor?: TourAnchor;
  title: string;
  text: string;
};

export type TourId = 'bienvenue' | 'arrosage' | 'planning' | 'penurie' | 'alertes' | 'a-la-carte' | 'ma-ferme';

export type Tour = {
  id: TourId;
  title: string;
  /** Ce que la visite montre, en une phrase, dans la liste des visites. */
  summary: string;
  /** La durée annoncée, en minutes (le contrat dit 2 à 4). */
  minutes: number;
  /** La ferme et le moment où la visite parle le mieux, dits dans la liste. */
  bestWith?: string;
  /**
   * Les pages sans lesquelles la visite n'a pas de sens : elle n'est offerte
   * qu'à une ferme qui en a au moins une. Absentes : offerte à toutes.
   */
  requires?: readonly TourPage[];
  steps: readonly TourStep[];
};

/**
 * Les éléments que les visites visent. Chaque valeur est posée dans le code
 * des écrans par `data-tour="…"` ; un test vérifie que chacune y figure.
 */
export const TOUR_ANCHORS = [
  'banniere',
  'banniere-choix',
  'remise-a-zero',
  'visites',
  'menu',
  'aide-page',
  'aujourdhui-journee',
  'aujourdhui-gel',
  'aujourdhui-eau',
  'arrosage-actions',
  'arrosage-champs',
  'arrosage-resultat',
  'eau-du-jour',
  'planning-semaine',
  'planning-propositions',
  'planning-non-servies',
  'planning-creneaux',
  'ressources-reserves',
  'faisabilite',
  'alertes-cultures',
  'alertes-meteo',
  'fonctionnalites',
] as const;

type TourAnchor = (typeof TOUR_ANCHORS)[number];

export const TOURS: readonly Tour[] = [
  {
    id: 'bienvenue',
    title: 'Bienvenue',
    summary: 'Ce qu’est le module, ce que la démonstration contient et comment passer d’une ferme à l’autre.',
    minutes: 2,
    steps: [
      {
        title: 'Bienvenue dans la démonstration',
        text: 'Ce module aide une ferme maraîchère à décider quand arroser et combien, planche par planche. Il lit le plan de culture de la ferme dans Ouvre ta ferme et la météo, puis il calcule. Ici, tout est inventé : les fermes, les planches et les chiffres.',
      },
      {
        anchor: 'banniere',
        title: 'Rien n’est réel ici',
        text: 'Ce bandeau reste en haut de chaque page. Aucune vraie ferme n’est lue ni modifiée, et aucune notification ne part.',
      },
      {
        anchor: 'banniere-choix',
        title: 'Une ferme, un moment de la saison',
        text: 'Choisissez l’une des fermes inventées, puis un moment : une nuit de gel au printemps, une semaine d’été ordinaire, le pic de l’été quand l’eau manque, la fin de saison. Le module se joue ce jour-là, quel que soit le jour de votre visite.',
      },
      {
        anchor: 'menu',
        title: 'Une page par fonctionnalité',
        text: 'Chaque ferme coche les fonctionnalités qui lui servent, et le menu ne montre qu’elles. Une visite saute ce que la ferme choisie n’a pas coché.',
      },
      {
        anchor: 'aide-page',
        title: 'L’aide de chaque page',
        text: 'Le point d’interrogation à côté du titre explique la page en quelques lignes.',
      },
      {
        anchor: 'visites',
        title: 'Les visites, quand vous voulez',
        text: 'Les visites se relancent d’ici, une par thème. Une visite interrompue reprend où vous l’aviez laissée.',
      },
      {
        anchor: 'remise-a-zero',
        title: 'Essayez sans crainte',
        text: 'Vos essais restent dans votre propre espace, un pour chaque ferme et chaque moment ; les autres visiteurs ne les voient pas. « Remettre à zéro » rend à la ferme et au moment ouverts leur premier jour. Sans visite pendant un jour, votre espace y revient seul, la nuit.',
      },
    ],
  },
  {
    id: 'arrosage',
    title: 'Un arrosage de A à Z',
    summary: 'Choisir un matériel et une quantité d’eau, comprendre le chiffre calculé, puis valider vous-même.',
    minutes: 4,
    bestWith: 'Avec « Maraîchage diversifié » ou « Petite exploitation ».',
    requires: ['arrosages'],
    steps: [
      {
        pages: ['arrosages'],
        anchor: 'arrosage-actions',
        title: 'Trois façons d’enregistrer un arrosage',
        text: '« Irriguer maintenant » lance un minuteur. « Planifier » prépare un arrosage pour plus tard. « Déjà réalisée » note un arrosage fait sans le module.',
      },
      {
        pages: ['arrosages'],
        anchor: 'arrosage-champs',
        title: 'Le matériel et la quantité',
        text: 'Choisissez un matériel, par exemple un goutte-à-goutte, et son réglage : le module sait déjà sur quelles planches il est posé. Donnez ensuite la quantité voulue en millimètres d’eau (1 mm, c’est 1 litre par mètre carré), ou bien une durée.',
      },
      {
        pages: ['arrosages'],
        anchor: 'arrosage-resultat',
        title: 'D’où vient ce chiffre',
        text: 'Le module en déduit la durée et le volume, planche par planche. Le petit « i » à côté d’un chiffre ouvre une bulle qui dit comment il a été calculé : quel débit, quelle surface.',
      },
      {
        pages: ['arrosages'],
        anchor: 'arrosage-resultat',
        title: 'Vous seul validez',
        text: 'Rien ne démarre sans votre clic sur le bouton du résultat. La visite ne clique jamais à votre place ; essayez si vous le souhaitez, c’est sans conséquence ici.',
      },
      {
        pages: ['arrosages'],
        anchor: 'eau-du-jour',
        title: 'L’eau du jour',
        text: 'Ce bloc additionne l’eau prévue aujourd’hui et la compare à la limite par jour que la ferme s’est fixée, si elle en a une.',
      },
      {
        pages: ['aujourdhui'],
        anchor: 'aujourdhui-journee',
        title: 'Retrouver ses arrosages',
        text: 'Sur « Aujourd’hui », la journée liste ce qui reste à faire et ce qui est en retard. Un arrosage fait comme prévu s’y coche d’un geste.',
      },
    ],
  },
  {
    id: 'planning',
    title: 'Le planning',
    summary: 'Les propositions de la semaine, les créneaux, valider ou refuser, et les planches non servies.',
    minutes: 3,
    bestWith: 'Avec « Maraîchage diversifié », en début d’été.',
    requires: ['planning'],
    steps: [
      {
        pages: ['planning'],
        anchor: 'planning-semaine',
        title: 'La semaine en un coup d’œil',
        text: 'Chaque matin, le module calcule des propositions d’arrosage jusqu’à dimanche, d’après le besoin des cultures, la pluie prévue et le matériel posé. Ces cases résument la semaine : ce qui attend votre accord, ce qui est fait, ce qui manque.',
      },
      {
        pages: ['planning'],
        anchor: 'planning-propositions',
        title: 'Des propositions, pas des ordres',
        text: 'Chaque proposition donne un jour, une heure, une durée et les planches servies. Vous la validez ou la refusez, une à une ou toutes ensemble : rien n’est arrosé sans vous.',
      },
      {
        pages: ['planning'],
        anchor: 'planning-non-servies',
        title: 'Les planches non servies',
        text: 'Ce sont les planches qui ont besoin d’eau mais pour lesquelles le module n’a pas trouvé de place : pas assez d’eau, pas de matériel libre ou pas d’heure possible. Le module ne les cache pas : il dit ce qui manque.',
      },
      {
        pages: ['planning'],
        anchor: 'planning-creneaux',
        title: 'Les créneaux protégés',
        text: 'Des heures où le module ne propose aucun arrosage, par exemple pendant une récolte ou le marché.',
      },
    ],
  },
  {
    id: 'penurie',
    title: 'Quand l’eau manque',
    summary: 'La réserve basse, le manque d’eau chiffré et les planches qui passent après les autres.',
    minutes: 3,
    bestWith: 'Avec « Maraîchage diversifié », au pic de l’été.',
    requires: ['planning', 'ressources'],
    steps: [
      {
        pages: ['aujourdhui'],
        anchor: 'aujourdhui-eau',
        title: 'L’eau disponible',
        text: 'Le niveau de chaque réserve, tel qu’il a été relevé. Au pic de l’été, le bassin de la ferme inventée est presque vide, et le puits qui le remplit est à sec.',
      },
      {
        pages: ['ressources'],
        anchor: 'ressources-reserves',
        title: 'Les réserves et leur minimum',
        text: 'Chaque réserve a sa capacité, son niveau relevé et un minimum de sécurité. Le module ne compte jamais l’eau qui se trouve sous ce minimum.',
      },
      {
        pages: ['planning'],
        anchor: 'planning-semaine',
        title: 'Le manque chiffré',
        text: 'Le planning dit combien d’eau manque cette semaine : ce que les réserves et les ressources ne couvrent pas, en mètres cubes.',
      },
      {
        pages: ['planning'],
        anchor: 'planning-non-servies',
        title: 'Qui passe après les autres',
        text: 'Quand l’eau ne suffit pas pour tout, des planches restent non servies, avec leur manque chiffré, pour que vous décidiez en connaissance de cause.',
      },
      {
        pages: ['ressources'],
        anchor: 'faisabilite',
        title: 'La faisabilité de la semaine',
        text: 'Ce calcul confronte les besoins de la semaine à l’eau qu’on peut mobiliser jusqu’à dimanche, et dit comment la répartir entre les planches.',
      },
    ],
  },
  {
    id: 'alertes',
    title: 'Les alertes',
    summary: 'Le gel prévu culture par culture, la marge de sécurité, et l’alerte qui vous parvient.',
    minutes: 3,
    bestWith: 'Avec « Maraîchage diversifié », au printemps, la nuit de gel.',
    requires: ['alertes-meteo', 'alertes-cultures'],
    steps: [
      {
        pages: ['aujourdhui'],
        anchor: 'aujourdhui-gel',
        title: 'Gel ou chaleur',
        text: 'Les trois prochains jours, avec la température la plus basse et la plus haute prévues. Quand une culture risque de geler, son nom apparaît sous le jour.',
      },
      {
        pages: ['alertes-cultures'],
        anchor: 'alertes-cultures',
        title: 'Un seuil de gel par culture',
        text: 'Chaque culture a sa température de dégâts, prise dans un jeu commun de repères. Une marge fait alerter un peu avant ce seuil, et le réglage du microclimat corrige pour un lieu plus froid ou plus doux que la prévision.',
      },
      {
        pages: ['alertes-meteo'],
        anchor: 'alertes-meteo',
        title: 'Les alertes météo',
        text: 'Pluie forte, chaleur, vent : la ferme choisit les seuils qui comptent pour elle.',
      },
      {
        pages: ['alertes-cultures', 'alertes-meteo', 'aujourdhui'],
        title: 'L’alerte qui vous parvient',
        text: 'Dans le vrai module, une alerte arrive aussi en notification sur le téléphone, une seule fois par événement. En démonstration, aucune notification n’est envoyée.',
      },
    ],
  },
  {
    id: 'a-la-carte',
    title: 'Le module à la carte',
    summary: 'Cocher et décocher des fonctionnalités : le module ne montre que ce qui sert à la ferme.',
    minutes: 2,
    bestWith: 'Avec « Le matériel et les alertes seulement » ou la « Ferme vierge ».',
    steps: [
      {
        pages: ['reglages', 'bienvenue'],
        anchor: 'fonctionnalites',
        title: 'Cochez ce qui vous sert',
        text: 'Chaque case est une fonctionnalité. Une ferme qui ne veut que le matériel et les alertes ne coche que cela : le reste disparaît du menu et des calculs.',
      },
      {
        pages: ['reglages', 'bienvenue'],
        anchor: 'fonctionnalites',
        title: 'Sans rien perdre',
        text: 'Certaines fonctionnalités en demandent d’autres et les cochent avec elles. Décocher ne perd rien : tout revient quand on recoche. Essayez si vous voulez ; enregistrer reste votre geste.',
      },
      {
        anchor: 'menu',
        title: 'Le menu suit vos cases',
        text: 'Une page n’apparaît au menu que si sa fonctionnalité est cochée.',
      },
    ],
  },
  {
    id: 'ma-ferme',
    title: 'Et pour ma ferme ?',
    summary: 'Comment on relierait votre propre ferme, sans rien saisir ici.',
    minutes: 2,
    steps: [
      {
        title: 'Relier sa propre ferme',
        text: 'Le module lit le plan de culture d’une ferme dans Ouvre ta ferme : ses parcelles, ses planches, ses séries et ses espèces. Il ne fait que lire : il n’écrit jamais rien dans Ouvre ta ferme.',
      },
      {
        title: 'Ce qu’il faudrait',
        text: 'Une clé d’accès à votre ferme, créée dans Ouvre ta ferme et saisie par vous seul. Le module s’en servirait pour lire, jamais pour écrire. Cette démonstration n’en demande aucune.',
      },
      {
        title: 'Pour la suite',
        text: 'L’ouverture du module à d’autres fermes se prépare. D’ici là, cette démonstration montre tout ce qu’il sait faire : changez de ferme ou de moment dans le bandeau du haut.',
      },
    ],
  },
];

export function tourById(id: string | null | undefined): Tour | undefined {
  return TOURS.find((tour) => tour.id === id);
}
