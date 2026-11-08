# Recette réelle — pose datée et stockage du matériel (2.11)

Faite le 30 octobre 2026 de 10 h 17 à 10 h 38, sur la ferme du porteur, dans
son Chrome, par une séance lancée sur son ordinateur, sur son « vas-y ». Le
protocole et ses attendus ont été écrits le même matin, avant tout geste sur
le site. Version à éprouver : `def3453`, fusion de la
PR #188, déploiement terminé le 29 octobre 2026 à 22 h 48. Contrat :
`docs/equipment-placement-periods-contract.md`, « L'écran », règles 1 à 15
et précisions des PR 2, 3a et 3b. **Les constats sont de l'assistant, dans le
navigateur du porteur ; le jugement reste au porteur** (D-014).

## Données de la ferme

Le logiciel n'est pas encore en service : l'assistant peut modifier les
données pour ses essais (consigne du 5 octobre 2026), à condition de relever
l'état de départ, d'écrire l'attendu avant chaque geste et de tout remettre en
état par l'écran. Or la 2.11 n'efface rien : retirer un vrai matériel laisse
pour toujours une pose fermée dans son historique (règle 8). Les essais se
font donc sur un **matériel d'essai**, un goutte-à-goutte « Essai recette
2.11 » créé pour l'occasion et **supprimé à la fin** : un matériel qui n'a
jamais arrosé se supprime avec son registre des poses. Pour qu'il reste
supprimable, aucune irrigation n'est enregistrée ni planifiée sur lui : une
irrigation, même annulée, l'empêcherait. Le signal d'une irrigation planifiée
sur un matériel stocké (règle 13) et la saisie après coup enregistrée
(règle 12) restent prouvés par le parcours P11 aux deux largeurs et par les
tests de persistance ; ici, seul le refus de la saisie après coup, qui
n'enregistre rien, est éprouvé.

## Vérifications

| N° | Geste | Attendu, écrit avant | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| R0 | Relever l'état de départ | Compteur de l'inventaire, état de chaque matériel, irrigations à venir, date du dernier plan | 10 h 17 : « 34 matériels actifs · 18 en aspersion · 16 en goutte-à-goutte · 33 posés · 0 stocké » ; irrigations 0 en cours, 0 à venir, 25 archivées ; planning « calculé le 30/10/2026 06:15 (recalcul du matin) », 34 propositions, 0 validée, 0 refusée, 8 expirées ; gag3 « Jamais posé cette saison », tous les autres « date de pose non renseignée » | Relevé |
| R1 | Lire la carte d'un matériel posé avant la 2.11 | « Posé sur … · date de pose non renseignée », sans date inventée (règle 7, scénario 10) | gag1 : « Posé sur B1-0, B1-1, B1-2, B1-3 · date de pose non renseignée », aucune date inventée | OK |
| R2 | Lire la carte d'une rampe de bloc ancrée entre deux planches | « Posé entre … et … » | Rampe bloc 10 : « Posé entre B10-5 et B10-6 · date de pose non renseignée », même forme sur toutes les rampes ; la rampe bloc 1 « Posé entre B2-2 et B2-3 », place voulue par le porteur pour ses essais | OK |
| R3 | Lire le compteur de l'inventaire | Autant de « posés » que de matériels actifs avec une position, « stockés » à 0 sauf retrait fait depuis le 27 octobre | 33 posés, soit les 34 actifs moins gag3, 0 stocké | OK |
| R4 | Créer « Essai recette 2.11 », goutte-à-goutte, un réglage uniforme, et le poser sur une planche en datant la pose de la veille à 8 h 00 | Carte « Posé sur … depuis le 29 octobre à 8 h 00 » ; compteur des posés + 1 | 10 h 21 : « Essai recette 2.11 », goutte-à-goutte, réglage « essai » à 5 mm/h, sur B1-5 : « Posé sur B1-5 depuis le 29 octobre à 8 h 00 » ; 34 posés | OK |
| R5 | « Retirer (stocker) » sur sa carte, date du retrait dans le futur | Refus dans la fenêtre : « Une date de pose ou de retrait ne peut pas être dans le futur. », la fenêtre reste ouverte | 10 h 22 : retrait daté du 31 octobre refusé, « Une date de pose ou de retrait ne peut pas être dans le futur. », fenêtre restée ouverte | OK |
| R6 | Même fenêtre, retrait daté avant la pose (la veille à 7 h 00) | Refus : « Ce matériel a été posé le 29 octobre à 8 h 00 : il ne peut pas être retiré avant. » | 10 h 23 : « Ce matériel a été posé le 29 octobre à 8 h 00 : il ne peut pas être retiré avant. » | OK |
| R7 | Même fenêtre, retrait daté de la veille à 18 h 00 | Fenêtre fermée ; carte « Stocké depuis le 29 octobre à 18 h 00 », bouton « Reposer », pli « Historique des poses (1) » : « Du 29 octobre à 8 h 00 au 29 octobre à 18 h 00 · planche · réglage » ; compteur des stockés + 1 | 10 h 24 : fenêtre fermée ; « Stocké depuis le 29 octobre à 18 h 00 », « Reposer », « Historique des poses (1) » : « Du 29 octobre à 8 h 00 au 29 octobre à 18 h 00 · B1-5 · essai » ; 33 posés, 1 stocké | OK |
| R8 | « Irriguer maintenant » et « Planifier » | Le matériel d'essai absent de la liste « Matériel », présent sous « Matériel stocké » avec « Reposer » | 10 h 25 : liste « Matériel » à 33 entrées sans l'essai, sous les deux onglets ; « Matériel stocké » : « Essai recette 2.11 · stocké » avec « Reposer » | OK |
| R9 | « Déjà réalisée », début la veille à 20 h 00, sans enregistrer | Matériel d'essai absent de la liste, car stocké à cette heure ; début la veille à 10 h 00 : présent | Début le 29 octobre à 20 h 00 : essai absent (33 entrées) ; à 10 h 00 : présent (34 entrées) ; aucune liste « Matériel stocké » sous cet onglet, comme le contrat le prévoit ; rien enregistré. Deux fermetures de la page pendant la frappe de l'heure au clavier : voir « Incident » | OK, incident à part |
| R10 | « Reposer » depuis la liste du formulaire, date de repose ce matin à 8 h 00 | L'éditeur rouvre sur la même planche et le même réglage, champ « Date de repose » ; carte « Posé sur … depuis le 30 octobre à 8 h 00 » ; historique (1) inchangé | 10 h 29 : l'éditeur rouvre sur B1-5, réglage « essai », champ « Date de repose » ; « Posé sur B1-5 depuis le 30 octobre à 8 h 00 », historique toujours à une ligne | OK |
| R11 | « Déplacer » sur une autre planche, date du déplacement maintenant | Carte « Posé sur l'autre planche depuis le … » ; « Historique des poses (2) », la plus récente en tête | 10 h 28 : vers B1-6, « Date du déplacement » à l'heure courante ; « Posé sur B1-6 depuis le 30 octobre à 10 h 28 », « Historique des poses (2) », en tête « Du 30 octobre à 8 h 00 au 30 octobre à 10 h 28 · B1-5 · essai » | OK |
| R12 | Lecture à 390 px, dans un cadre de cette largeur | Cartes, fenêtre de retrait, barre de placement et liste « Matériel stocké » lisibles, aucun débordement horizontal | Vers 10 h 30, dans un cadre de 390 px, la fenêtre ne se redimensionnant pas : document de 375 px pour 375 px utiles, aucun débordement ; cartes, historique, fenêtre de retrait, barre de placement et « Matériel stocké » lisibles dans la largeur | OK |
| R13 | Remise en état : retirer le matériel d'essai puis le supprimer | Suppression acceptée ; compteurs et cartes revenus à l'état de R0 | Retrait à 10 h 31 (historique à trois lignes), suppression vers 10 h 36, « Le matériel a été supprimé définitivement. » ; après rechargement, compteurs, 34 cartes, irrigations (0, 0, 25) et planning (06:15, 34, 0, 0, 8) identiques à R0 | OK |
| R14 | Réglage « minimal » des rampes blocs 2 à 11, BF, BF2, BF3 (demande du porteur du 27 octobre 2026) | Relever le profil du réglage « minimal » de la rampe bloc 1 et modifier celui de chacune des treize rampes à l'identique, chacun relu après enregistrement ; seul le profil change, le choix du réglage appliqué reste le sien | Vers 10 h 37 : « minimal » de la rampe bloc 1, même courbe à gauche et à droite, 0 m → 13 mm/h, 1,2 m → 10, 2,4 m → 6, 3,6 m → 3 (portée 3,60 m) ; les treize rampes avaient déjà exactement ce profil : rien enregistré, réglage appliqué inchangé | Rien à faire |

Treize vérifications conformes sur treize, R0 relevé, R14 sans objet ; le
matériel d'essai est supprimé et la ferme est revenue à l'état de départ.
Pour la boîte de confirmation du navigateur de « Supprimer définitivement »,
que l'outil ne peut pas cliquer, la page a été rechargée puis la seule boîte
acceptée après avoir vérifié qu'elle nommait « Essai recette 2.11 ». Après le
second incident, les dates de R9, R10 et R12 ont été saisies d'un seul coup
plutôt qu'au clavier.

## Incident : la page se ferme pendant la frappe d'une date

Vers 10 h 26 puis 10 h 27, pendant R9, la frappe au clavier de l'heure de
début dans « Déjà réalisée » a remplacé la page par « This page couldn't
load ». Rien n'a été enregistré (25 irrigations archivées avant et après). Le
même jour, l'assistant l'a reproduit sur son poste en tapant la date chiffre
par chiffre : quand le champ passe par une date incomplète, sa valeur devient
vide, et l'aperçu de faisabilité calcule la fin du créneau à partir d'un début
illisible (`app/irrigation/irrigation-manager/use-irrigation-preview.ts`, la
date de fin de `hydraulicPreview`), ce qui lève « RangeError: Invalid time
value » et arrête tout l'écran. Le même calcul sert « Planifier » : vider sa
date de début a le même effet. La ligne date de la fin septembre 2026 : défaut
ancien, révélé par la recette, sans lien avec la 2.11. Point ouvert 44.

## Après la correction du point 44

Faite le 30 octobre 2026 de 13 h 08 à 13 h 14, sur le site, dans le Chrome du
porteur, par une séance lancée sur son ordinateur, sur son « vas-y ». Version
éprouvée : `fdfbc59`, fusion de la PR #190, déploiement terminé à 13 h 01. Les
attendus ont été écrits avant tout geste. Rien n'est enregistré : aucun bouton
d'enregistrement ni de planification n'est cliqué.

| N° | Geste | Attendu, écrit avant | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| C0 | Relever l'état de départ | Nombre d'irrigations en cours, à venir, archivées | 0 en cours, 0 à venir, 25 archivées | Relevé |
| C1 | « Déjà réalisée », gag1 réglé sur « standard » : vider entièrement « Début réel » | La page reste là, bouton d'enregistrement grisé, aucune erreur « RangeError » dans la console | Page et formulaire affichés, champ à « jj/mm/aaaa --:-- », bouton « Enregistrer l'irrigation réalisée » grisé, durée « — », aucune erreur dans la console ; le volume estimé affiche « 0 L » (point ouvert 45) | OK |
| C2 | Même champ, retaper la date chiffre par chiffre au clavier | La page ne se ferme à aucun moment | Jour seul, jour et mois, année partielle, heure sans minutes : page toujours là ; une faute de frappe a porté l'année à 202612, date complète mais absurde : page toujours là, bouton grisé ; corrigée en 30/10/2026 12:08, durée 1 h et 600 L revenus, bouton actif, non cliqué ; aucune erreur | OK |
| C3 | « Planifier » : vider « Date et heure de début », puis la retaper chiffre par chiffre | Même attendu, la page reste là | Page toujours là jusqu'à 30/10/2026 14:08, aucune erreur ; date vide, le bouton « Planifier l'irrigation » reste actif (point ouvert 46), non cliqué | OK |
| C4 | Recharger la page | Compteurs identiques à C0 | 0 en cours, 0 à venir, 25 archivées : rien enregistré ; aucune erreur | OK |

Quatre vérifications conformes sur quatre : la correction du point 44 tient
sur le site. La console est lue à partir de C1 : les messages du premier
chargement de la page, avant C0, ne sont pas couverts, ceux du rechargement de
C4 le sont. L'onglet ouvert pour le constat est refermé. Deux écarts mineurs,
sans rien d'enregistré à tort, deviennent les points ouverts 45 et 46.

## Après les corrections des points 45, 46 et 47

Faite le 30 octobre 2026 de 15 h 56 à 16 h 17, sur le site, dans le Chrome du
porteur, par une séance lancée sur son ordinateur, sur son « vas-y ». Version
éprouvée : `dd75954`, fusion de la PR #198, déploiement terminé à 15 h 46 ;
elle porte les corrections des PR #195 (point 45), #197 (point 46) et #196
(point 47). Les attendus ont été écrits avant tout geste. Aucune irrigation
n'est enregistrée ni planifiée ; aucun vrai matériel n'est touché.

| N° | Geste | Attendu, écrit avant | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| K0 | Relever l'état de départ | Irrigations en cours, à venir, archivées ; compteur de l'inventaire | 0 en cours, 0 à venir, 25 archivées ; 34 matériels actifs, 32 posés, 1 stocké | Relevé |
| K1 | Point 45 : « Déjà réalisée », gag10 ; vider « Début réel », puis mettre une fin avant le début, puis un début une heure avant la fin | « Inconnu — vérifiez le début et la fin », jamais « 0 L » ; apport par planche « inconnu » ; bouton grisé ; un volume en litres revient avec des dates correctes | Début vidé : « Inconnu — vérifiez le début et la fin », « inconnu » sur B9-1 et B9-2, bouton grisé, page en place ; fin avant le début : même texte ; début une heure avant la fin : 384 L, 8,0 mm par planche, bouton actif, non cliqué | OK |
| K2 | Point 46 : « Planifier », vider « Date et heure de début », puis remettre demain à la même heure | Bouton « Planifier l'irrigation » grisé sans date, actif avec une date | Grisé sans date, actif avec la date de demain, non cliqué | OK |
| K3a | Point 47 : matériel d'essai « Essai constat 47 », goutte-à-goutte, réglage « essai » à 5 mm/h, posé sur B1-1 à 15 h 00 ; retrait daté de 16 h 07, à 16 h 01 min 58 s | Refus « Une date de pose ou de retrait ne peut pas être dans le futur. », le matériel reste posé | Refus avec ce message ; toujours posé, 33 posés | OK |
| K3b | Retrait daté de 16 h 03, validé à 16 h 02 min 10 s | Accepté ; la date enregistrée n'est pas dans le futur | Accepté ; « Stocké depuis le 30 octobre à 16 h 02 » ; historique « Du 30 octobre à 15 h 00 au 30 octobre à 16 h 02 · B1-1 · essai » : l'heure du serveur | OK |
| K4 | Supprimer le matériel d'essai, recharger | Compteurs identiques à K0 | 0 en cours, 0 à venir, 25 archivées ; 34 actifs, 32 posés, 1 stocké ; « Essai constat 47 » absent | OK |

Cinq vérifications conformes sur cinq : les corrections des points 45, 46 et
47 tiennent sur le site. L'heure de l'ordinateur du porteur concordait avec
celle du serveur : la cause du point 47 tenue pour probable, une horloge en
avance, n'est pas confirmée ; la correction vaut quelle qu'en soit la cause.
La console n'a été lue qu'au rechargement final, sans erreur : K1 à K4 ne sont
pas couverts. La suppression du matériel d'essai passe par une fenêtre de
confirmation du navigateur, que la séance ne peut ni lire ni fermer : le
porteur l'a validée. Le formulaire « Ajouter un matériel » coche « Aspersion »
par défaut ; le matériel d'essai a été corrigé en goutte-à-goutte avant tout
réglage. Onglet refermé ; les images d'écran gardées d'office par l'outil du
navigateur, hors du dépôt, sont supprimées.

## Au jugement du porteur

- La lisibilité des cartes et de la fenêtre de retrait sur son téléphone, au
  pouce.
- Le retrait réel du goutte-à-goutte de son signalement du 27 octobre (point
  ouvert 43), à la date où il l'a vraiment enlevé, s'il le souhaite : c'est
  l'usage pour lequel la 2.11 existe, et il ferme le point 43. Fait par
  l'écran le 30 octobre 2026 ; le porteur ferme le point 43 le jour même.
- Les points ouverts 44, 45, 46 et 47, corrigés et constatés sur le site, sont
  fermés par le porteur le 30 octobre 2026.

Le porteur close la 2.11 le 30 octobre 2026 au soir (« Ok, vas-y, ferme-la »),
sans constat séparé de la lisibilité sur son téléphone.
