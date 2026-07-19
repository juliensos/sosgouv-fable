# SOSGOUV, instructions de reprise dans Claude Cowork

Ce fichier permet à Claude Cowork de reprendre le projet SOSGOUV exactement là où la discussion Claude.ai "SOSGOUV fable" s'est arrêtée. À placer à la racine du dossier du projet.

## Migration vers Cowork, étapes

1. Dans Cowork, connecter le dossier local du projet (celui extrait du zip "copie exacte du dépôt GitHub", v36, 29 fichiers). Si le dossier local n'existe pas, cloner le dépôt public : `git clone https://github.com/juliensos/sosgouv`.
2. Placer ce fichier CLAUDE.md à la racine du dossier.
3. Vérifier que l'état local correspond bien à la version en ligne (les `?vNN` d'index.html donnent la version, CNAME pointe sur govlab.fr).
4. Lancer les deux suites de tests avant toute modification pour confirmer le point de départ : `node test/smoke-test.js` (94 tests) et `node test/verif-v39.js` (38 tests), tout doit être vert (jsdom + mock Supabase, `npm install jsdom` au préalable).

## Le projet en bref

SOSGOUV est une application web statique (HTML/CSS/JS, sans framework ni build) qui permet de composer et publier des gouvernements fictifs, avec votes et interactions sociales.

- Dépôt : https://github.com/juliensos/sosgouv (public)
- Site : https://juliensos.github.io/sosgouv/ et domaine govlab.fr (fichier CNAME)
- Hébergement : GitHub Pages, branche main, dossier racine, déploiement automatique à chaque push (délai 1 à 2 min, recharger sans cache avec Ctrl+Shift+R)
- Base de données : Supabase, projet `lbcmwivxvzeortvftxsi`
- Version actuelle : v42, 134 tests verts (94 smoke + 38 vérification ciblée), plus un banc de rendu Chromium ayant validé les deux mises en page de modaux sur desktop et mobile. Largeur des panneaux bm : viewport moins deux fois la marge gauche du logo (mesurée), comme dans la maquette.

## Fonctionnalités (à préserver intégralement)

- Authentification custom via la table `users`, avec mode admin (footer admin jaune, édition admin)
- 5 sections : à propos, gouvernements publiés, composer, ajouter une personnalité, liste des personnalités
- Composer : 6 postes régaliens fixes, ministères non régaliens et délégués ajoutables, autocomplete des personnalités, sous-secteurs modifiables, brouillon/publication
- Social : votes de 1 à 5 (re-vote sans doublon), likes, épingles, commentaires, partage, fiche détaillée

## Base de données

- `sql/schema.sql` : 16 tables, 2 vues stats, politiques RLS, secteurs pré-remplis. Idempotent, ne casse rien d'existant. Validé par le parseur PostgreSQL (31 instructions).
- `sql/` contient aussi tous les patchs incrémentaux. Toute évolution du schéma passe par un nouveau patch idempotent, jamais par modification d'un patch existant.
- Passage d'un compte en admin : requête SQL indiquée dans le README.

## Graphisme, règles strictes

C'est la contrainte la plus importante : conserver le graphisme des dernières versions.

- Le CSS principal est le CSS Webflow chargé depuis le CDN (hash `af7c0b75c` dans index.html). Ne pas le remplacer. Si la maquette Webflow est republiée, seule l'URL dans index.html doit être mise à jour.
- Le header et le footer utilisent le markup Webflow authentique. Ne pas restructurer ce markup.
- Tout le contenu dynamique est stylé par `css/sosgouv.css`, écrit dans l'esthétique du site. Les évolutions graphiques se font là.

## Pièges connus, ne pas régresser

1. Le conteneur `._3-cont-body` (qui héberge tous les onglets) a un `overflow: hidden` dans la maquette Webflow. Ce rognage coupe visuellement même les éléments en `position: fixed` quand un ancêtre crée un bloc conteneur. Conséquence : au chargement, `js/ui.js` déplace chaque modal (`pm-parent`, `bm-parent`, `#fondModal`) pour en faire des enfants directs de `<body>`. Ne jamais re-nicher les modaux dans `._3-cont-body`.
2. Le CSS Webflow est resynchronisé automatiquement chaque nuit (action GitHub `webflow-css-sync` : elle lit https://sosgouv.webflow.io et remplace le hash dans index.html). Ses règles changent donc sans préavis, et ses combo-classes (`.pm-parent.connect`, `.bm-parent.gu`…) sont plus spécifiques que nos sélecteurs simples. Depuis la v38, TOUTE la mécanique des modaux vit dans `css/sosgouv.css` avec des `!important` systématiques et ne dépend d'aucune règle de la maquette. La v39 fixe les deux mises en page voulues : pm (petits modaux) = boîte centrée sur voile noir 45 %, croix blanche sur carré noir sans contour, collée au coin haut-droit de la boîte ; bm (grands modaux) = panneau pleine hauteur calé sous le header, fond blanc sans voile, large comme le contenu principal, croix maquette en haut à GAUCHE, il recouvre les onglets et descend jusqu'au pied de page. Les dimensions du header et du contenu ne sont pas supposées : `ui.js` les mesure et les pose dans les variables CSS `--sos-header-h` et `--sos-content-w` (à l'ouverture et au resize). Ne jamais réintroduire de dépendance à la maquette pour cette mécanique ; la maquette ne pilote que l'intérieur des boîtes (paddings, typo, contenus). `test/verif-v39.js` verrouille tout cela.
3. Le smoke-test historique visait une version disparue de la page (IDs `addNom`…, sélecteur de secteur inline) : il a été réaligné en v38 sur la page actuelle (ajouts de ministères/délégués via les modaux, 8 postes initiaux). Les « 213 tests verts » des anciennes notes ne sont plus la référence ; la référence est 94 + 29.

## Méthode de travail attendue

1. Toute modification est suivie de la suite de tests complète (213 tests, jsdom + mock Supabase simulant la base). Zéro régression tolérée, ajouter un test verrouillant chaque correctif de bug.
2. Tout SQL nouveau est validé syntaxiquement avant livraison.
3. Ne jamais modifier la structure HTML gérée dans Webflow, les ajustements se font en JS au chargement ou dans sosgouv.css.
4. Livraison : indiquer précisément quels fichiers remplacer sur GitHub, rappeler le rechargement sans cache.
5. Le dossier `tools/` (agent d'enrichissement, consignes, workflow) fait partie du projet, le conserver.

## Historique utile

Le projet a traversé plusieurs itérations dans Claude.ai : gov list 1 et 2, gov classique, authentication system, v3, v4, reconstruction complète V-5 (13 novembre 2025), puis corrections successives jusqu'à la v36 (modaux déplacés vers body), la v37 (conflits de padding/display avec la maquette) la v38 (mécanique des modaux rendue totalement autonome du CSS Webflow ; smoke-test réaligné sur la page actuelle) et la v39 (mises en page définitives : pm centré sur voile avec croix blanche à droite, bm en panneau pleine hauteur sous le header, fond blanc, croix à gauche). Le fil complet est visible ici : https://claude.ai/share/3ca4b85c-93b0-4255-bbb3-0f989f797be2
