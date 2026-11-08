# Contrat de découpage des fichiers concentrateurs

**Sous-tranche Q6 close le 21 septembre 2026, en neuf PR.** Les règles de ce
contrat restent en vigueur : elles s'appliquent à tout découpage à venir, et la
limite de 600 lignes est désormais une erreur de lint, tenue par un test qui
lit le dépôt réel.

Rédigé le 21 septembre 2026, avant le code de la sous-tranche Q6. Il répond au
dernier écart du socle qualité : six fichiers de code et une feuille de style
concentrent l'essentiel du module. Le plus long fait 1 459 lignes, la feuille de
style 5 137.

Q6 est la dernière sous-tranche du socle. Elle est volontairement placée après
Q5 : le moteur de planning va ajouter plusieurs milliers de lignes dans ces
mêmes fichiers, et il vaut mieux qu'il les trouve rangés.

## Pourquoi c'est un défaut, en termes concrets

Un fichier de 1 400 lignes n'est pas long par accident : il fait plusieurs
choses. `irrigation-event-manager.tsx` tient à lui seul le formulaire de
création, le minuteur, les alertes de conflit, les limites journalières, les
notifications, la boîte de confirmation de fin et une dizaine de formats
d'affichage.

Trois conséquences, toutes payées plus tard.

1. **Une modification en touche une autre.** Changer le minuteur oblige à
   relire le formulaire, parce que les deux partagent le même état. C'est ainsi
   qu'un défaut apparaît là où personne n'a travaillé.
2. **La relecture devient impossible.** Une PR qui modifie trente lignes au
   milieu de mille quatre cents ne se relit pas : on voit la modification, pas
   ce qu'elle déplace.
3. **Les frontières s'effacent.** Une règle métier écrite au milieu d'un
   composant est invisible depuis `lib/domain`, donc jamais couverte par les
   tests du domaine. Q3 a posé les frontières entre zones ; Q6 les fait tenir à
   l'intérieur de chaque zone.

## Ce que le découpage ne change jamais

Un découpage qui corrige un défaut au passage n'est plus un découpage : c'est
une modification déguisée, et les tests ne savent plus ce qu'ils prouvent.

- **Aucun changement de comportement.** Pas une valeur affichée, pas un ordre
  de tri, pas un message, pas un style calculé.
- **Aucune correction opportuniste.** Un défaut aperçu pendant le découpage est
  consigné et corrigé dans sa propre PR, avant ou après, jamais dedans.
- **Aucune règle métier déplacée vers l'interface.** Le sens de la circulation
  est l'inverse : si un calcul se trouve dans un composant, il descend vers
  `lib/domain`, il ne s'y installe pas.
- **Aucun renommage de confort.** Un symbole exporté garde son nom. Le fichier
  qui le contient peut changer ; son nom, non.

## Les règles du découpage

### La limite

600 lignes par fichier, lignes vides et commentaires exclus, telle qu'ESLint les
compte (`max-lines`, posée en avertissement par Q3). Q6 la passe en erreur.

Ce n'est pas un objectif esthétique : c'est le seuil au-delà duquel un fichier
ne se relit plus d'un seul tenant. Rester juste en dessous n'est pas non plus le
but. Un fichier qui fait une seule chose fait rarement 590 lignes.

### Un fichier, une responsabilité

Le critère n'est pas la longueur mais la phrase qui décrit le fichier. Si elle
contient « et », le fichier fait deux choses.

Deux exceptions déclarées, parce qu'elles sont justifiées et non subies :

- `db/schema.ts` (1 114 lignes) : description du schéma, une déclaration par
  table, rien d'autre. Déjà exclue de la règle depuis Q3.
- Les fichiers `*.d.ts` engendrés par Wrangler : ils ne sont pas écrits à la
  main.

### Pas de fichier tonneau

Aucun module dont le seul rôle serait de réexporter ses voisins. Un tonneau
masque les dépendances réelles, trompe `knip` sur ce qui est mort, et fabrique
des cycles d'import que le typage ne signale pas toujours. Chaque importateur
nomme le module réel.

Conséquence assumée : un découpage réécrit des chemins d'import en nombre. Q3 en
a réécrit 222 sans incident ; le typage les vérifie tous.

## Méthode, par famille de fichier

### Dépôts (`db/`)

`db/` reste le seul endroit où du SQL est écrit. Le découpage suit le cycle de
vie de l'objet, pas la forme des requêtes : lecture, création, exécution, fin.
Les fonctions privées partagées (construction du `SELECT`, lecture d'une ligne,
recherche de l'espace de travail) vont dans un module interne au dossier, non
utilisé hors de lui.

Les **types d'enregistrement** quittent `db/` pour `lib/domain`. Q3 avait laissé
là une exception : six modules du domaine importent aujourd'hui, en type
seulement, des enregistrements définis dans `db/`. C'était le bon sens de
dépendance inversé : la forme d'une irrigation est une notion du métier, pas une
notion de la base. Elle appartient au domaine, et `db/` la lit (décision D-020).

### Composants React (`app/`)

Trois sortes de code cohabitent dans un composant long, et chacune va dans son
fichier.

1. **L'état et ses effets** : un *hook* nommé, dans son fichier. Un hook par
   sujet : le formulaire, l'horloge, les notifications. Le composant principal
   garde la propriété de l'état ; il n'en garde pas la mécanique.
2. **L'affichage** : un composant par élément visible, sans état propre,
   recevant tout par ses propriétés. C'est ce qui rend une modification
   relisible : on voit la carte, pas la page.
3. **Les formats** : un module de présentation. Les formats d'affichage (durée,
   volume, débit, date) sont partagés entre plusieurs écrans et n'ont rien à
   faire dans un composant.

Ce qui reste dans le fichier principal est l'assemblage : l'état, les actions,
et la disposition. C'est ce qu'on veut y lire.

### Domaine (`lib/domain/`)

Le découpage suit la grandeur calculée, pas la taille du fichier. Un module par
agrégat : le cumul d'irrigation réelle, le cumul météo, l'objectif hydrique. Les
types partagés vont dans un module de types, qui ne calcule rien.

### Feuille de style (`app/irrigation/irrigation.css`)

Une feuille de style ne se découpe pas comme du code : l'ordre des règles décide
du résultat. Deux règles de même poids, la dernière gagne. Déplacer un bloc,
c'est risquer de changer l'apparence sans changer une seule déclaration.

La méthode est donc mécanique et vérifiable.

- Les blocs partent dans `app/irrigation/styles/`, un fichier par composant,
  **sans modification d'une seule déclaration**.
- `irrigation.css` ne contient plus que des `@import`, **dans l'ordre exact où
  les blocs se trouvaient**. Le regroupeur les remplace par leur contenu : la
  feuille produite est identique, caractère pour caractère.
- Un test vérifie que la liste des `@import` couvre exactement les fichiers
  présents dans `styles/`, pour qu'un fichier nouveau ne puisse pas être oublié
  ni un fichier retiré rester importé.
- Un test vérifie qu'aucun fichier de style ne dépasse 600 lignes, ESLint ne
  lisant pas le CSS.

La preuve reste la comparaison des styles calculés, décrite plus bas.

## Preuve de fin

Quatre vérifications, dans cet ordre, à chaque PR de la sous-tranche.

0. **La comparaison ligne à ligne.** Avant toute autre chose : le corps du
   fichier d'origine et la réunion des fichiers produits doivent contenir
   exactement les mêmes lignes, aux en-têtes d'import et au mot-clé `export`
   près. C'est mécanique, ça se vérifie par un décompte, et ça prouve qu'aucune
   ligne n'a été perdue, dupliquée ni réécrite au passage. Un écart se justifie
   ou s'annule.

   Une exception, et une seule : l'extraction d'un *hook* ajoute
   nécessairement des lignes — une signature, un objet de retour, l'appel et sa
   déstructuration. La règle devient alors : **aucune ligne de l'original ne
   disparaît**, et tout ajout est du raccordement, nommé comme tel dans la PR.
   Le corps déplacé, lui, reste intact. C'est aussi pourquoi la déstructuration
   reprend les noms d'origine : le reste du composant n'est pas touché d'une
   ligne.
1. **`pnpm check`** : lint, typage, la totalité des tests, `knip`. Aucun
   avertissement nouveau, aucun export mort laissé derrière. `knip` sert aussi
   de garde-fou au découpage : une fonction devenue publique sans franchir
   aucune frontière de fichier y est signalée, signe que la coupure passe au
   mauvais endroit. Il ne voit pas les types exportés : ceux-là se vérifient à
   la main.
2. **Les quatre parcours navigateur** (Q5), aux deux largeurs. C'est la
   vérification qui compte pour un découpage : elle traverse l'écran réel, et
   elle ne connaît rien de la manière dont les fichiers sont rangés.
3. **Pour la feuille de style seulement** : comparaison de la feuille produite
   par la compilation, avant et après le découpage. Le regroupeur remplace les
   `@import` par leur contenu ; si les deux fichiers produits sont identiques,
   le navigateur reçoit exactement les mêmes octets et aucune comparaison de
   rendu n'est nécessaire. C'est ce qui a été obtenu le 21 septembre 2026,
   empreinte du fichier comprise.

   Si un jour ces deux fichiers diffèrent, la vérification de repli est la
   comparaison des styles calculés de `/irrigation` à 1 280 px et à 390 px sur
   tous les éléments de la page, méthode qui a servi au retrait de Tailwind en
   Q4 (décision D-012) ; zéro différence est alors le seul résultat acceptable.

   Deux tests gardent le découpage dans la durée, ESLint ne lisant pas le CSS :
   le point d'entrée ne contient que des `@import` et leur liste couvre
   exactement les fichiers présents, et aucun fichier de styles ne dépasse
   600 lignes.

Et, pour clore Q6 : `max-lines` passée en erreur, aucun fichier au-dessus de la
limite, aucune règle métier arrivée dans un composant.

## Ordre des PR

Chaque PR est complète et vérifiée : le dépôt reste publiable à tout moment.

| PR | Contenu | Pourquoi à cette place |
| --- | --- | --- |
| 1 | Ce contrat et les registres | Le contrat avant le code |
| 2 | Types d'enregistrement déplacés vers `lib/domain` | Allège les dépôts avant de les découper et ferme l'exception de Q3 |
| 3 | `db/irrigation-event-repository.ts` | Le plus dense ; il porte le cycle de vie complet d'une irrigation |
| 4 | `db/equipment-repository.ts` et `lib/domain/irrigation-history.ts` | Même famille de travail, sans interface |
| 5 | `app/irrigation/irrigation-event-actions.ts` | Les actions avant le composant qui les appelle |
| 6 | `app/irrigation/irrigation-event-manager.tsx` | Le plus long fichier du projet ; sa propre PR |
| 7 | `app/irrigation/hierarchy-browser.tsx` | Plan, placements et panneaux |
| 8 | `app/irrigation/irrigation.css` | Méthode différente, preuve différente, PR séparée |
| 9 | `max-lines` en erreur, clôture de Q6 | La règle ne se durcit qu'une fois le dernier fichier passé |

Neuf PR au lieu des huit prévues le 21 septembre 2026 : les actions
d'irrigation et le composant qui les appelle devaient tenir dans une seule, ce
qui aurait donné une PR de près de deux mille lignes déplacées. Une PR qui ne
se relit pas va contre l'objet même de la sous-tranche.

## Pratiques interdites

- Désactiver `max-lines` par un commentaire dans un fichier plutôt que de le
  découper. Une exception se déclare dans `eslint.config.mjs`, avec sa raison,
  et se discute.
- Découper en fichiers numérotés (`part-1`, `part-2`). Un nom de fichier dit ce
  qu'il contient, sinon le découpage n'a rien rangé.
- Réordonner des règles CSS « pendant qu'on y est ».
- Mélanger dans une même PR un découpage et une correction.
