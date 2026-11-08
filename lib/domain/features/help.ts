import { reliabilityThresholdsText } from '../today/reliability.ts';
import type { IrrigationPageId } from './pages';

/**
 * Le « ? » de chaque page (docs/feature-selection-contract.md, section 6) :
 * à quoi sert la page, comment la lire, ce qu'on y fait en premier. Tous les
 * textes sont ici, en phrases simples ; le porteur les relit sur le site en
 * ligne et ses corrections passent par une PR.
 */
export type PageHelp = {
  purpose: string;
  reading: string;
  firstStep: string;
};

export const PAGE_HELP: Readonly<Record<IrrigationPageId, PageHelp>> = {
  aujourdhui: {
    purpose: 'Le tableau de bord du module : savoir d’un coup d’œil ce qu’il y a à faire aujourd’hui, où en est l’eau de la semaine, le gel ou la chaleur des trois prochains jours, l’eau disponible et ce que le calcul sait de votre ferme.',
    reading: 'L’en-tête résume le jour ; ses pastilles mènent au bloc qui en parle. Chaque bloc suit une fonctionnalité cochée. Une valeur inconnue est hachurée, jamais pleine. Le nombre à côté de « Aujourd’hui », dans le menu, compte les données à rafraîchir et les arrosages en retard.',
    firstStep: 'Commencez par « Votre journée » : démarrez un arrosage à rattraper, ou, s’il a été fait sans le chrono, enregistrez-le avec « Tout est fait », tel que prévu. Puis touchez le bouton de chaque donnée à rafraîchir de « Fiabilité du calcul ».',
  },
  materiel: {
    purpose: 'Décrire votre matériel d’arrosage et dire où il est posé, planche par planche.',
    reading: 'Le plan montre vos jardins et leurs planches. Une planche arrosée porte le matériel posé et l’apport qu’il donne en millimètres par heure. Touchez une planche pour ouvrir sa fiche.',
    firstStep: 'Ajoutez un matériel, goutte-à-goutte ou aspersion, avec ses réglages, puis posez-le sur les planches qu’il arrose.',
  },
  arrosages: {
    purpose: 'Enregistrer vos arrosages : celui qui commence maintenant, ceux que vous planifiez et ceux déjà faits.',
    reading: 'En haut, l’eau engagée aujourd’hui et la limite journalière. Puis les arrosages en cours, à venir ou à terminer. Le minuteur suit l’arrosage en cours et vous prévient à la fin.',
    firstStep: 'Choisissez un matériel posé et son réglage, puis « Irriguer maintenant », « Planifier » ou « Déjà réalisée ».',
  },
  besoins: {
    purpose: 'Fixer l’eau que vos planches doivent recevoir chaque semaine, et voir ce qu’il leur manque.',
    reading: 'Le besoin d’une planche est son objectif de la semaine moins l’eau déjà reçue, arrosages et pluie. Le tableau des jours donne la pluie prévue, la pluie mesurée et l’évapotranspiration.',
    firstStep: 'Fixez un objectif en millimètres par semaine, pour la ferme, un jardin ou une planche. Après une pluie, saisissez ce qu’indique votre pluviomètre.',
  },
  planning: {
    purpose: 'Proposer, chaque semaine, quand et combien arroser pour couvrir les besoins avec votre matériel et votre eau.',
    reading: 'Chaque proposition dit le matériel, l’heure, la durée et la dose. « À venir » suit ce que vous avez validé ; « Ce qui a changé » dit ce que le dernier calcul a modifié. Le plan se recalcule chaque matin et après chaque événement.',
    firstStep: 'Lisez les propositions de la semaine et validez celles qui vous conviennent : elles deviennent des arrosages planifiés.',
  },
  ressources: {
    purpose: 'Décrire d’où vient votre eau et vos pompes, pour que le planning tienne compte des débits et des stocks.',
    reading: 'Chaque ressource montre son débit et ses relevés, chaque réserve son stock. La faisabilité dit si l’eau disponible suffit aux besoins de la semaine et, sinon, comment la répartir.',
    firstStep: 'Ajoutez une ressource, forage, réseau ou réserve, puis une pompe avec son débit maximal et l’eau qu’elle prend.',
  },
  sol: {
    purpose: 'Suivre l’eau que le sol garde pour vos cultures, jardin par jardin et planche par planche.',
    reading: 'La jauge dit ce qui reste de la réserve facilement utilisable, en pourcentage. Sous le seuil d’arrosage, il est temps d’arroser. L’eau arrosée au-delà de ce que le sol retient est signalée.',
    firstStep: 'Renseignez votre sol : la réserve utile du laboratoire, la profondeur et la part de cailloux. Ajoutez une observation quand vous vérifiez l’humidité au champ.',
  },
  cultures: {
    purpose: 'Adapter le besoin en eau à chaque culture et à son stade, à partir de la météo.',
    reading: 'L’ETM du jour est l’évapotranspiration de référence multipliée par le coefficient cultural de la culture. L’objectif proposé de la semaine en découle ; il ne compte que si vous l’adoptez.',
    firstStep: 'Vérifiez dans Réglages que vos espèces d’Ouvre ta ferme correspondent à une culture de référence, puis ajustez coefficients, profils racinaires et durées si besoin.',
  },
  'alertes-meteo': {
    purpose: 'Être prévenu sur votre téléphone quand la météo prévue franchit un seuil que vous choisissez.',
    reading: 'Chaque alerte dit sa mesure, son seuil et les jours qu’elle regarde. La prévision est prise à 2 m du sol : au ras du sol, il fait souvent 2 à 3 °C de moins, et aucune marge n’est ajoutée. L’historique garde les alertes envoyées.',
    firstStep: 'Ajoutez une alerte, par exemple une température minimale sous 2 °C dans les trois jours, et autorisez les notifications dans Réglages.',
  },
  'alertes-cultures': {
    purpose: 'Être prévenu des risques propres à vos cultures : le gel selon la culture, l’arrêt d’arrosage avant la récolte, les aspersions à reconsidérer.',
    reading: 'Chaque culture rattachée a son seuil de gel. Le curseur de microclimat décale tous les seuils de votre ferme. L’encart montre les alertes à venir et celles déjà envoyées.',
    firstStep: 'Rattachez vos espèces à une culture du jeu commun dans Réglages, puis réglez le microclimat si votre ferme est plus froide ou plus chaude que la météo de référence.',
  },
  historique: {
    purpose: 'Retrouver l’eau apportée : les cumuls par planche, par jardin et pour la ferme, l’historique des arrosages et le suivi par série.',
    reading: 'Les cumuls sont en millimètres et en mètres cubes. À l’échelle d’un jardin ou de la ferme, ils sont pondérés par la surface des planches.',
    firstStep: 'Choisissez un périmètre et une période, ou une série. « Exporter CSV » garde les chiffres dans un tableur.',
  },
  reglages: {
    purpose: 'Choisir les fonctionnalités affichées, et régler ce qui sert à plusieurs pages.',
    reading: 'Une case décochée n’est ni affichée ni prise en compte ; ses données restent enregistrées. Selon vos cases, vous trouvez aussi le lieu de la météo, les notifications du téléphone et la correspondance des espèces.',
    firstStep: 'Cochez ce qui vous sert : une case coche avec elle celles dont elle a besoin.',
  },
};

export function pageHelp(page: IrrigationPageId): PageHelp {
  return PAGE_HELP[page];
}

/**
 * Le « ? » d'une partie de page, quand elle demande plus qu'une phrase
 * (précision P38) : quelques entrées courtes, et la description du schéma qui
 * les accompagne, lue par un lecteur d'écran.
 */
export type SectionHelp = {
  entries: readonly { title: string; text: string }[];
  /** Ce que dit le schéma, pour un lecteur d’écran ; absent quand l’aide n’a pas de schéma. */
  figureLabel?: string;
};

/** Les groupes de jardins alignés, sur la page Matériel et placement. */
export const GARDEN_GROUP_HELP: SectionHelp = {
  entries: [
    {
      title: 'À quoi sert un groupe',
      text: 'Une aspersion arrose de part et d’autre de sa position : posée au bord d’un jardin, elle mouille aussi les premières planches du jardin voisin. Le groupe dit au module que ces jardins se suivent sur le terrain, pour qu’il compte cette eau.',
    },
    {
      title: 'Comment le module s’en sert',
      text: 'Il met les planches du groupe bout à bout sur une seule ligne : celles du premier jardin, la distance jusqu’au suivant, ses planches, et ainsi de suite. Une aspersion posée sur cette ligne arrose chaque planche à sa portée, selon le profil de son réglage.',
    },
    {
      title: 'Ce qu’il faut renseigner',
      text: 'Les jardins dans l’ordre où on les traverse ; pour chacun, le sens de ses planches ; et la distance en mètres entre la fin d’un jardin et le début du suivant.',
    },
    {
      title: 'Quand s’en passer',
      text: 'Le goutte-à-goutte n’arrose que les planches où il est posé : il n’a pas besoin de groupe. Une aspersion dans un jardin isolé non plus.',
    },
  ],
  figureLabel: 'Schéma : deux jardins côte à côte, A et B, séparés par 3 mètres. Une aspersion posée au bout du jardin A arrose les planches A2 et A3, et aussi B1, la première planche du jardin B, parce que les deux jardins forment un groupe.',
};

/**
 * Le « ? » du K_abri, dans « Réglages du calcul » de « Besoin par culture »
 * (retour du porteur, 7 novembre 2026, précision P42) : ce que fait le
 * coefficient, sa valeur par défaut, un exemple chiffré et quand le changer.
 */
export const SHELTER_FACTOR_HELP: SectionHelp = {
  entries: [
    {
      title: 'Ce que fait le K_abri',
      text: 'Sous un abri, la bâche filtre une partie du soleil et coupe le vent : une culture y boit moins qu’en plein champ. Le module multiplie le besoin calculé de chaque planche de l’abri par ce coefficient.',
    },
    {
      title: 'La valeur par défaut',
      text: '0,80, la valeur du CRIIAM pour un tunnel : le besoin y compte pour 80 % de celui du plein champ. Un tunnel bien ventilé descend vers 0,60 à 0,70 ; le réglage va de 0,60 à 1.',
    },
    {
      title: 'Un exemple',
      text: 'Pour un besoin de 5 mm en plein champ, un K_abri de 0,80 donne 4 mm sous l’abri ; à 0,70, il donne 3,5 mm.',
    },
    {
      title: 'Quand le changer',
      text: 'Si les planches d’un abri restent trop humides ou trop sèches avec les propositions, ajustez son K_abri. La nouvelle valeur vaut à partir du jour choisi ; les jours d’avant gardent l’ancienne.',
    },
  ],
};

/**
 * Le « ? » de la zone « Fiabilité du calcul » (audit ergonomique, point 3,
 * 3.8 quater lot 2) : ce que dit la zone, chacun de ses seuils — aucun n'est
 * caché — et ce que fait son bouton.
 */
export const RELIABILITY_HELP: SectionHelp = {
  entries: [
    {
      title: 'Ce que dit la zone',
      text: 'Les données dont l’état rend le plan douteux : le volume d’une réserve, la pluie réelle, le sol d’un jardin, les espèces sans référence, le plan lui-même. Seules comptent celles de vos fonctionnalités cochées.',
    },
    { title: 'Les seuils', text: reliabilityThresholdsText() },
    {
      title: 'Ce que fait le bouton',
      text: 'Il ouvre l’endroit où corriger la donnée, ou recalcule le plan. La ligne disparaît quand la donnée est à jour.',
    },
  ],
};
