
# Plateforme GIRAS (CNAM)

Ce dossier contient une première version fonctionnelle de la plateforme web **GIRAS – Gestion Intégrée des Risques et Activités Stratégiques**.

Elle est conçue pour être :

- hébergée sur **GitHub**,
- déployée sur **Vercel**,
- connectée à une base de données **Supabase**,
- et reliée à **Brevo** pour l’envoi des e-mails (mot de passe, notifications, etc.).

> ⚠️ Cette version implémente déjà une authentification Supabase, un écran d’accueil complet, la gestion de base des risques (création + liste + export Excel) et une cartographie des risques simple.  
> Vous pourrez ensuite étendre les autres rubriques en copiant les mêmes modèles de composants.

---

## 1. Structure des fichiers

- `index.html` : point d’entrée de l’application React (SPA).
- `styles.css` : styles globaux (responsive + hover animations).
- `app.js` : logique métier de l’interface (React, Supabase, export Excel, cartographie…).
- `schema.sql` : script SQL minimal à exécuter dans Supabase.
- `logos/LOGO_GIRAS.png` : logo GIRAS.
- `logos/Logo_CNAM.png` : logo CNAM.
- `api/sendEmail.js` : fonction API Vercel pour envoyer des mails via Brevo.

---

## 2. Étapes côté SUPABASE

1. Créer un compte / projet Supabase :  
   https://supabase.com

2. Dans le projet :
   - Aller dans l’onglet **SQL editor**.
   - Copier / coller le contenu du fichier **`schema.sql`**.
   - Exécuter le script.

3. Aller dans **Auth → Providers → Email** :
   - Activer l’authentification par e-mail + mot de passe.
   - Créer un utilisateur (email + mot de passe) qui servira d’administrateur.

4. Dans **Table editor → User** :
   - Créer une ligne avec :
     - `Nom`, `Prenoms`,
     - `Username` = l’adresse e-mail de l’utilisateur créé dans Auth,
     - `Type_utilisateur` = par exemple `Super manager`,
     - `Statut` = `Actif`,
     - `Code_structure` = une structure existante dans la table `Structure`.

5. Récupérer vos clés Supabase :
   - Dans **Project Settings → API** :
     - `Project URL` (SUPABASE_URL),
     - `anon public key` (SUPABASE_ANON_KEY).

Vous en aurez besoin côté Vercel.

---

## 3. Étapes côté BREVO

1. Créer un compte sur https://www.brevo.com/
2. Dans les paramètres API :
   - Créer une clé **API v3**.
   - Copier cette clé (vous l’utiliserez comme `BREVO_API_KEY`).
3. Définir un e-mail d’expéditeur (par exemple `giras@votre-domaine.ci`).

---

## 4. Préparation du dépôt GITHUB

1. Télécharger le dossier ZIP que vous avez reçu.
2. Extraire le dossier, par exemple `giras-platform`.
3. Ouvrir GitHub dans votre navigateur.
4. Créer un nouveau dépôt (Repository) :
   - Nom : `giras-platform` (ou autre),
   - Public ou privé selon vos besoins.
5. Glisser-déposer **tous les fichiers** du dossier dans GitHub :
   - `index.html`, `styles.css`, `app.js`, `schema.sql`,
   - le dossier `logos/`,
   - le dossier `api/`.

Valider (Commit) pour enregistrer le dépôt.

---

## 5. Déploiement sur VERCEL (sans test en local)

1. Aller sur https://vercel.com et créer un compte.
2. Connecter votre compte Vercel à GitHub.
3. Cliquer sur **New Project**.
4. Choisir le dépôt GitHub `giras-platform`.
5. Dans les options avancées :
   - **Framework** : sélectionnez *Other* ou *Static* (l’application est une SPA statique avec API).
6. Ajouter les **variables d’environnement** :
   - `BREVO_API_KEY` : la clé API Brevo.
   - `BREVO_SENDER_EMAIL` : l’adresse d’expéditeur (ex : `giras@votre-domaine.ci`).

> Les clés Supabase sont directement utilisées dans `app.js`.  
> Pour plus de sécurité, vous pourrez plus tard les gérer aussi via les variables d’environnement Vercel.

7. Lancer le déploiement.  
   Vercel va :
   - construire le projet (statique),
   - activer la route API `/api/sendEmail`.

À la fin, Vercel vous donne une URL du type :  
`https://giras-platform-yourname.vercel.app`

C’est l’URL que vous pourrez utiliser / partager.

---

## 6. Paramétrage Supabase dans l’interface

Ouvrez le fichier `app.js` et, en haut du fichier, remplacez :

```js
const SUPABASE_URL = window.envSupabaseUrl || 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_KEY = window.envSupabaseAnonKey || 'YOUR_PUBLIC_ANON_KEY';
```

par vos vraies valeurs Supabase, par exemple :

```js
const SUPABASE_URL = 'https://abcd1234.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI...';
```

Puis, dans GitHub :
1. Modifier le fichier `app.js` en ligne.
2. Sauvegarder (Commit).
3. Vercel redéploiera automatiquement la nouvelle version.

---

## 7. Utilisation de la plateforme (pas à pas)

### 7.1 Connexion

1. Aller sur l’URL Vercel de votre projet (exemple : `https://giras-platform-yourname.vercel.app`).
2. L’écran de connexion apparaît :
   - Saisir l’adresse e-mail de l’utilisateur créé dans Supabase.
   - Saisir son mot de passe.
3. Si les informations sont correctes :
   - Supabase Auth vous authentifie,
   - la plateforme charge votre profil depuis la table `User`,
   - puis vous accédez à l’interface GIRAS.

### 7.2 Bandeau flash

- Le bandeau « Infos flash » défile en haut de la page.
- Vous pourrez l’alimenter plus tard en créant une table `Infos_flash` dans Supabase et en la liant à l’interface (déjà prévue dans la structure).

### 7.3 Navigation générale

- En haut : les onglets **Accueil, Gestion des risques, Suivi des activités, Suivi des indicateurs, Suivi des performances, Tableau de bord, Administration**.
- À gauche : un **menu latéral** (sidebar) qui affiche les sous-rubriques selon la rubrique sélectionnée.
- Au survol des boutons / cartes : une **animation de hover** (mise en avant visuelle).

### 7.4 Rubrique « Gestion des risques »

#### a. Identification des risques

1. Cliquer sur **Gestion des risques** en haut.
2. Dans la carte « Identification des risques » :
   - Cliquer sur **+ Nouveau risque**.
3. Une fenêtre (modal) s’ouvre :
   - Remplir `Code_risque` (6 caractères),
   - Saisir le `Libellé risque`,
   - Renseigner le `Code processus` déjà créé dans la table `Processus`,
   - Choisir les niveaux `Impact` et `Efficacité contrôle` (1 à 4).
4. Cliquer sur **Enregistrer** :
   - Le risque est enregistré dans la table `Risque` de Supabase.
   - La liste des risques est automatiquement rechargée.

5. Pour **exporter** les risques vers Excel :
   - Cliquer sur le bouton **Export Excel**,
   - Un fichier `risques.xlsx` est téléchargé.

> Tous les filtres sont déjà en place sur la même ligne en haut de la table (champ de recherche prêt à être connecté).

#### b. Cartographie des risques

1. Toujours dans « Gestion des risques », plus bas :
   - Vous voyez la carte « Cartographie des risques (démo) ».
2. La matrice 4×4 affiche :
   - En abscisse et ordonnée : Impact et Probabilité,
   - Les codes de risques présents dans chaque case,
   - Les couleurs (vert, jaune, orange, rouge) selon le niveau de criticité.
3. Un tableau en dessous reprend :
   - Pour chaque risque : Impact, Probabilité, Score de criticité.

> Cette cartographie se base sur la vue `V_Risque_Evaluation` fournie dans `schema.sql`.  
> Vous pouvez enrichir la vue dans Supabase pour y ajouter les libellés de processus, libellés de risques, etc.

### 7.5 Modification de votre mot de passe

1. Dans l’en-tête, cliquer sur votre **nom complet**.
2. La fenêtre « Modifier mon mot de passe » s’ouvre.
3. Cliquer sur **Envoyer le code** :
   - L’API `/api/sendEmail` envoie un mail via Brevo.
   - Le code de démonstration est `123456` (vous pourrez le remplacer par un code généré côté serveur).
4. Saisir le code `123456`.
5. Saisir le nouveau mot de passe (deux fois).
6. Cliquer sur **Enregistrer** :
   - Le mot de passe est mis à jour dans Supabase Auth.
   - L’utilisateur est invité à se reconnecter.

---

## 8. Extension aux autres rubriques

Toutes les autres rubriques (Activités, Indicateurs, Performances, Tableau de bord, Administration) sont déjà présentes dans l’interface avec :

- un **cadre (card)** réservé,
- une **ligne de filtres** prête à être connectée,
- des boutons avec hover animation,
- une structure adaptée aux tables que vous avez décrites dans votre cahier des charges.

Pour étendre :

1. Créer / compléter les tables nécessaires dans Supabase (par exemple Projet, Action, Indicateur…).
2. Ajouter les requêtes `supabase.from('NomTable')` correspondantes dans `app.js`.
3. Réutiliser les composants :
   - `Modal` pour les formulaires,
   - `exportTableToExcel` pour les exports,
   - `StatCard` pour les synthèses,
   - les tables HTML pour les listes.

---

## 9. Responsivité & ergonomie

- L’interface est **responsive** (mobile, tablette, desktop) :
  - Sur petit écran, le menu latéral disparaît pour laisser la place au contenu.
- Toutes les cartes, boutons, lignes de navigation ont une **animation au survol (hover)**.
- Les deux logos (GIRAS et CNAM) sont affichés en haut à gauche et réagissent au survol.

---

## 10. Support

En cas de blocage à une étape (Supabase, Vercel, GitHub ou Brevo), vous pouvez revenir vers moi avec :

- une capture d’écran,
- le message d’erreur précis,
- ou le lien de votre projet.

Je pourrai alors vous guider sur le point précis à corriger.
