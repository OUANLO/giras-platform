# 🏢 GIRAS - Plateforme de Gestion des Risques

## Gestion Intégrée des Risques et des Activités Stratégiques
### CNAM - Caisse Nationale d'Assurance Maladie de Côte d'Ivoire

**Version actuelle :** 25.1 (23 janvier 2026)  
**Nouveauté v25.1 :** 🐛 Correction synchronisation risques_probabilites - [Voir CHANGELOG.md](CHANGELOG.md)

---

## 📋 Table des matières

1. [Présentation](#présentation)
2. [Prérequis](#prérequis)
3. [Installation étape par étape](#installation-étape-par-étape)
4. [Configuration Supabase](#configuration-supabase)
5. [Configuration Brevo](#configuration-brevo)
6. [Déploiement sur Vercel](#déploiement-sur-vercel)
7. [Connexion par défaut](#connexion-par-défaut)
8. [Structure du projet](#structure-du-projet)

---

## 🎯 Présentation

GIRAS est une plateforme web complète pour la gestion des risques et le suivi des activités stratégiques. Elle comprend :

- ✅ **Gestion des Risques** : Identification, analyse, évaluation, cartographie
- ✅ **Suivi des Activités** : Projets, actions, tâches
- ✅ **Suivi des Indicateurs** : Groupes, indicateurs, occurrences
- ✅ **Tableau de Bord** : Synthèse et visualisations
- ✅ **Suivi des Performances** : Évaluation des collaborateurs
- ✅ **Administration** : Utilisateurs, structures, paramètres

---

## 🔧 Prérequis

Avant de commencer, vous aurez besoin de :

1. **Un compte GitHub** (gratuit) : https://github.com
2. **Un compte Supabase** (gratuit) : https://supabase.com
3. **Un compte Vercel** (gratuit) : https://vercel.com
4. **Un compte Brevo** (gratuit) : https://brevo.com

---

## 🚀 Installation étape par étape

### Étape 1 : Télécharger le projet

1. Téléchargez tous les fichiers du projet
2. Créez un nouveau dépôt sur GitHub :
   - Allez sur https://github.com/new
   - Nommez-le `giras-platform`
   - Cliquez sur "Create repository"
3. Uploadez tous les fichiers du projet dans ce dépôt

### Étape 2 : Configurer Supabase

Suivez les instructions dans la section [Configuration Supabase](#configuration-supabase)

### Étape 3 : Configurer Brevo

Suivez les instructions dans la section [Configuration Brevo](#configuration-brevo)

### Étape 4 : Déployer sur Vercel

Suivez les instructions dans la section [Déploiement sur Vercel](#déploiement-sur-vercel)

---

## 🗄️ Configuration Supabase

### 1. Créer un projet Supabase

1. Allez sur https://supabase.com et connectez-vous
2. Cliquez sur **"New Project"**
3. Remplissez :
   - **Name** : `giras-cnam`
   - **Database Password** : Créez un mot de passe fort (notez-le !)
   - **Region** : Choisissez la plus proche (ex: Frankfurt)
4. Cliquez sur **"Create new project"**
5. Attendez 2-3 minutes que le projet soit créé

### 2. Créer les tables de la base de données

1. Dans votre projet Supabase, allez dans **SQL Editor** (menu de gauche)
2. Cliquez sur **"New Query"**
3. Copiez TOUT le contenu du fichier `scripts/database-setup.sql`
4. Collez-le dans l'éditeur SQL
5. Cliquez sur **"Run"** (bouton vert)
6. Vérifiez qu'il n'y a pas d'erreurs (message vert "Success")

### 3. Récupérer les clés API

1. Allez dans **Settings** > **API**
2. Notez ces 3 valeurs :
   - **Project URL** : `https://xxxxx.supabase.co`
   - **anon public** : Clé commençant par `eyJ...`
   - **service_role** : Clé secrète (cliquez sur "Reveal")

⚠️ **IMPORTANT** : Ne partagez JAMAIS la clé `service_role` !

---

## 📧 Configuration Brevo

### 1. Créer un compte Brevo

1. Allez sur https://app.brevo.com
2. Créez un compte gratuit
3. Validez votre email

### 2. Créer une clé API

1. Connectez-vous à Brevo
2. Cliquez sur votre profil (en haut à droite)
3. Allez dans **SMTP & API**
4. Cliquez sur **"API Keys"**
5. Cliquez sur **"Generate a new API key"**
6. Nommez-la `GIRAS`
7. Copiez la clé générée (elle ne sera plus visible après !)

### 3. Configurer l'expéditeur

1. Allez dans **Senders & IPs** > **Senders**
2. Ajoutez une adresse email validée (ex: `noreply@votre-domaine.ci`)
3. Validez cette adresse via le lien reçu par email

---

## 🌐 Déploiement sur Vercel

### 1. Connecter votre GitHub

1. Allez sur https://vercel.com
2. Cliquez sur **"Sign Up"** et choisissez **"Continue with GitHub"**
3. Autorisez Vercel à accéder à votre compte GitHub

### 2. Importer le projet

1. Cliquez sur **"Add New..."** > **"Project"**
2. Sélectionnez le dépôt `giras-platform`
3. Cliquez sur **"Import"**

### 3. Configurer les variables d'environnement

Avant de déployer, ajoutez ces variables d'environnement :

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Votre URL Supabase (ex: `https://xxxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Votre clé `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Votre clé `service_role` (secrète) |
| `BREVO_API_KEY` | Votre clé API Brevo |
| `BREVO_SENDER_EMAIL` | Email expéditeur validé |
| `BREVO_SENDER_NAME` | `GIRAS - CNAM` |
| `NEXT_PUBLIC_APP_URL` | Laissez vide pour l'instant |

Pour ajouter chaque variable :
1. Cliquez sur **"Environment Variables"**
2. Entrez le nom dans "Key"
3. Entrez la valeur dans "Value"
4. Cliquez sur **"Add"**

### 4. Déployer

1. Cliquez sur **"Deploy"**
2. Attendez 2-3 minutes
3. Une fois terminé, vous verrez votre URL (ex: `giras-platform.vercel.app`)

### 5. Mettre à jour l'URL de l'application

1. Allez dans **Settings** > **Environment Variables**
2. Ajoutez/modifiez `NEXT_PUBLIC_APP_URL` avec votre URL Vercel
3. Redéployez en cliquant sur **"Deployments"** > **"..."** > **"Redeploy"**

---

## 🔑 Connexion par défaut

Une fois déployé, connectez-vous avec le compte Super Admin :

| Champ | Valeur |
|-------|--------|
| **Email** | `fousseni.ouattara@ipscnam.ci` |
| **Mot de passe** | `Admin` |

⚠️ **IMPORTANT** : Changez ce mot de passe immédiatement après la première connexion !

---

## 📁 Structure du projet

```
giras-app/
├── src/
│   ├── app/                    # Pages Next.js
│   │   ├── api/               # Routes API
│   │   ├── dashboard/         # Pages du tableau de bord
│   │   ├── login/             # Page de connexion
│   │   ├── globals.css        # Styles globaux
│   │   ├── layout.js          # Layout racine
│   │   └── page.js            # Page d'accueil
│   ├── components/            # Composants réutilisables
│   │   └── ui/               # Composants UI
│   └── lib/                   # Utilitaires
│       ├── email.js          # Service d'emails
│       ├── supabase-client.js # Client Supabase
│       ├── supabase-server.js # Serveur Supabase
│       └── utils.js          # Fonctions utilitaires
├── scripts/
│   └── database-setup.sql    # Script création BDD
├── public/                    # Fichiers statiques
├── .env.example              # Exemple variables d'env
├── package.json              # Dépendances
├── tailwind.config.js        # Config Tailwind
└── next.config.js            # Config Next.js
```

---

## 🆘 Résolution des problèmes

### Erreur de connexion à la base de données
- Vérifiez que les clés Supabase sont correctes
- Vérifiez que le script SQL a été exécuté sans erreur

### Les emails ne s'envoient pas
- Vérifiez que la clé API Brevo est correcte
- Vérifiez que l'email expéditeur est validé dans Brevo

### Page blanche après déploiement
- Vérifiez les logs dans Vercel (onglet "Functions")
- Vérifiez que toutes les variables d'environnement sont configurées

### Erreur 500
- Consultez les logs de Vercel
- Vérifiez la connexion Supabase

### Occurrences d'indicateurs non synchronisées dans risques_probabilites (✅ CORRIGÉ en v25.1)
- Ce problème a été résolu dans la version 25.1
- Consultez le [GUIDE_DEPLOIEMENT.md](GUIDE_DEPLOIEMENT.md) pour installer la correction
- Exécutez les scripts de vérification dans `/scripts/`

---

## 📞 Support

Pour toute question ou problème, contactez l'équipe technique de la CNAM.

---

**© 2024 CNAM Côte d'Ivoire - Tous droits réservés**
