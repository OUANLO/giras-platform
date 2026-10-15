# Point focal — mise à jour GIRAS

## Installation

1. Sauvegarder la base de données selon la procédure habituelle.
2. Exécuter `scripts/migration-v212-point-focal.sql` dans la base Supabase, avant le déploiement de cette version. Le script peut être réexécuté.
3. Déployer le code avec les variables d’environnement Supabase existantes.
4. Reconnecter les utilisateurs dont le type ou les habilitations ont été modifiés.

Aucune migration ni modification n’a été exécutée sur la base de production pendant la préparation de cette archive.

## Utilisation

Dans **Administration > Gestion**, créer ou modifier un utilisateur, choisir **Point focal**, puis sélectionner au moins une **Structure du point focal**. Cette sélection est indépendante de la structure de rattachement de l’utilisateur. Le formulaire et le serveur contrôlent ce champ obligatoire.

Les accès aux rubriques restent configurables comme pour un Admin. L’accès Administration et ses droits spécifiques ne peuvent être accordés que par un Super admin.

Le point focal consulte les actions, indicateurs, risques, occurrences, tâches, archives et résultats liés à ses structures. Les mêmes restrictions s’appliquent aux listes, filtres, tableaux de bord, performances, rapports et exports. Les contrôles serveur s’appliquent aussi aux appels directs des API. Les listes du point focal sont paginées côté serveur pour éviter une coupure à 1 000 lignes.

Il peut modifier l’avancement des occurrences d’actions et les valeurs des occurrences d’indicateurs de son périmètre. Quand l’avancement est calculé à partir des tâches, il peut renseigner leur avancement ; le calcul existant est conservé. Les périodes fermées et les occurrences validées/achevées restent soumises aux verrouillages existants.

Le type Point focal n’accorde aucun droit automatique pour ajouter ou retirer des membres ou gestionnaires : il faut être gestionnaire du projet ou du groupe concerné. Les membres des projets accessibles peuvent être consultés en lecture seule. Les droits de validation restent distincts des droits de saisie.

Les référentiels communs peuvent être consultés pour comprendre et renseigner les données. Les opérations globales sans périmètre de structure (fermeture générale des périodes, réglages communs et journaux globaux) ne sont pas accordées par ce profil. Un point focal ne peut pas créer un Admin global ni élargir son propre périmètre.

Les habilitations des autres types d’utilisateurs sont conservées.

## Vérifications

- `npm run build` : compilation de production.
- `node --test tests/point-focal.test.mjs` : tests locaux des périmètres A/B/C, consultations et mutations, membres/gestionnaires, compte désactivé, changement du périmètre, mot de passe personnel, protection des droits et pagination de plus de 1 000 lignes.
- Tests réalisés avec une base simulée ; la migration SQL et les parcours connectés restent à vérifier dans votre environnement Supabase. Aucun email réel n’a été envoyé.

## Recette après installation

Créer un point focal affecté à deux structures A et B, avec une structure de rattachement différente C. Vérifier que toutes les actions et tous les indicateurs de A et B sont visibles et que ceux de C sont absents, même dans un projet partagé. Tester la saisie du taux d’une action et de la valeur d’un indicateur, puis les verrouillages après validation. Vérifier l’absence de modification des membres/gestionnaires avant désignation comme gestionnaire, puis son activation après cette désignation. Contrôler également le périmètre dans les rapports et exports.

## Gestion des risques — ajustement du 12 octobre 2026

- Identification et Analyse : lecture seule pour tout Point focal, même désigné gestionnaire.
- Gestion : masquée sauf désignation comme gestionnaire du projet des risques. Les droits existants relatifs aux opérations globales restent applicables.
- Cartographie : les fichiers historiques chargés lors des fermetures sont téléchargeables, quelle que soit leur structure, depuis la période sélectionnée. Cet accès est une exception de lecture ; il n’autorise pas le téléversement ni la suppression.
- Plan de maîtrise et Suivi du plan : modification du taux d’avancement dans les structures du point focal. Si des tâches existent, leurs taux sont modifiables dans le formulaire ; la moyenne est recalculée par le serveur. Les autres champs restent en lecture seule pour un point focal non gestionnaire. Les actions achevées restent verrouillées.

Aucune nouvelle migration SQL n’est nécessaire pour cet ajustement.
