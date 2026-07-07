# SOSGOUV — Reconstruction complète (V-5)

Reconstruction du projet à partir de l'analyse de toutes les conversations SOS-GOUV
(d'octobre à novembre 2025 : gov list 1 et 2, gov classique, v3, v4 et la session finale
du 13 novembre), plus le repo GitHub `juliensos/sosgouv`.

## Structure

```
sosgouv-rebuild/
├── index.html            Monopage : header/footer Webflow authentiques + 5 sections + modaux
├── config.js             Credentials Supabase (projet lbcmwivxvzeortvftxsi)
├── css/sosgouv.css       CSS applicatif (composants dynamiques)
├── js/auth.js            Auth custom (table users, session localStorage, admin)
├── js/ui.js              Navigation par sections, modaux, menu, footer admin
├── js/personnalites.js   Liste groupée, filtres, likes, épingles, fiche, ajout, admin
├── js/gouvernement.js    Composer, brouillon/publier, liste, détail, vote, commentaires
├── sql/schema.sql        16 tables + 2 vues + RLS + secteurs/sous-secteurs de référence
└── test/smoke-test.js    44 tests fonctionnels (jsdom + mock Supabase), tous verts
```

## Sections (comme la dernière version)

0. À propos (accueil) — 1. Gouvernements publiés — 2. Composer un gouvernement —
3. Ajouter une personnalité — 4. Liste des personnalités.

## Mise en route

1. **Base de données** : dans Supabase (projet `lbcmwivxvzeortvftxsi`), SQL Editor,
   exécuter `sql/schema.sql`. Le script est idempotent (IF NOT EXISTS) : si des tables
   existent déjà avec ces noms, elles ne seront pas écrasées. Si ta base contient déjà
   les tables de novembre, tu peux sauter cette étape ou l'exécuter pour combler les
   tables manquantes (messagerie, commentaires_likes...).
2. **Déploiement** : pousser le dossier sur GitHub (repo `sosgouv`), GitHub Pages ou
   Netlify servira `index.html` à la racine.
3. **Admin** : `UPDATE users SET is_admin = true WHERE username = 'TON_PSEUDO';`

## Graphisme

- Le header et le footer reprennent le markup Webflow authentique de ton repo
  (classes `n-header`, `bloc-logo`, `logo-baseline`, `dropdown-menu`, `admin-bloc`...).
- La feuille Webflow est chargée depuis le CDN comme dans la dernière version :
  `sosgouv.webflow.shared.af7c0b75c.css` (dernier hash retrouvé, publication du 16 oct 2025).
  **À vérifier** : si tu as republié la maquette depuis, remplace le lien dans `index.html`
  par l'URL du CSS de la publication courante (visible dans le code source de
  sosgouv.webflow.io).
- `css/sosgouv.css` couvre tout ce qui est généré dynamiquement (cartes gouvernements,
  blocs de postes, badges de statut, étoiles de vote, modaux, footer admin jaune, toasts),
  dans l'esthétique Lato documentée. Le site est donc pleinement utilisable même si le
  lien CDN change.

## Ce qui a été testé (44 tests, 0 échec)

Inscription, doublon de pseudo refusé, connexion/déconnexion, mauvais mot de passe,
menu selon connexion, navigation entre sections, ajout de personnalités, groupement
alphabétique, filtres par statut, like/unlike, épinglage, fiche détaillée, initialisation
des 6 postes régaliens, ajout/suppression de ministères et délégués, héritage des
sous-secteurs par défaut, blocage de publication sans titre, publication (gouvernement +
postes + sous-secteurs en base), brouillon, liste des publiés uniquement, vote 1-5 avec
mise à jour sans doublon, note moyenne, épinglage de gouvernement, détail, commentaires,
blocages si non connecté, footer et édition admin, échappement HTML (anti-injection).

## Limites connues (héritées des versions précédentes)

- Les mots de passe sont stockés en clair dans la table `users` (comme avant).
  Pour une mise en production réelle : migrer vers Supabase Auth ou hasher (bcrypt).
- Les politiques RLS sont permissives (le contrôle se fait côté front), cohérent avec
  l'usage de la clé anon et de l'auth custom des versions précédentes.
- Espace personnel détaillé et messagerie : les tables existent, l'interface reste à
  développer (c'était aussi l'état "à implémenter" de la dernière version).
