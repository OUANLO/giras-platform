'use client'

import { useMemo, useState } from 'react'
import { BookOpen, Lock, Users, Activity, BarChart3, Shield, TrendingUp, FileText, Settings, HelpCircle, CheckCircle2, Search, X, ArrowUpRight, ChevronDown, ChevronRight, Info } from 'lucide-react'

const sections = [
  {
    "id": "demarrage",
    "title": "Bien démarrer",
    "summary": "Les repères essentiels pour travailler dans GIRAS.",
    "icon": "BookOpen",
    "articles": [
      {
        "id": "demarrage-1",
        "title": "Comprendre la plateforme",
        "body": [
          "GIRAS centralise la gestion des risques, les activités stratégiques et les indicateurs. Les tableaux de bord, performances et rapports exploitent ces données pour faciliter le suivi et la décision.",
          "Une fiche décrit un risque, une action ou un indicateur. Une occurrence correspond à son suivi sur une période donnée. Plusieurs occurrences peuvent donc être rattachées à une même action ou à un même indicateur."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "demarrage-2",
        "title": "Votre première utilisation",
        "body": [
          "Commencez par vérifier votre contexte de travail avant de saisir une donnée."
        ],
        "steps": [
          "Connectez-vous avec les identifiants de votre compte.",
          "Consultez l’Accueil pour repérer les éléments en attente dans votre périmètre.",
          "Ouvrez le module souhaité, puis sa sous-rubrique dans le menu latéral.",
          "Vérifiez la structure, le projet ou groupe et la période sélectionnés.",
          "Ouvrez une fiche pour consulter son détail ou effectuer une saisie autorisée.",
          "Après enregistrement, vérifiez le message de résultat et la valeur affichée dans le tableau."
        ],
        "note": null,
        "table": null
      },
      {
        "id": "demarrage-3",
        "title": "Se repérer dans les écrans",
        "body": [
          "Les rubriques principales donnent accès aux domaines métier. Les sous-rubriques organisent les étapes : par exemple Projet, Actions et Suivi actions.",
          "Les filtres réduisent temporairement les données affichées. Ils ne changent ni les enregistrements ni vos habilitations. Les champs marqués d’un astérisque sont obligatoires."
        ],
        "steps": [],
        "note": "Un module absent, un bouton masqué ou un champ grisé peut traduire une limitation de vos droits, une période fermée ou un enregistrement déjà validé.",
        "table": null
      },
      {
        "id": "demarrage-4",
        "title": "Utiliser son compte",
        "body": [
          "La rubrique Profil permet de consulter les informations personnelles et d’accéder au changement de mot de passe. Le changement exige le mot de passe actuel et un nouveau mot de passe d’au moins huit caractères.",
          "Si vous ne connaissez plus votre mot de passe, sollicitez un administrateur habilité à le réinitialiser. Après une modification de votre type ou de vos habilitations, déconnectez-vous puis reconnectez-vous."
        ],
        "steps": [],
        "note": "Ne communiquez jamais votre mot de passe. Pour signaler une difficulté, transmettez le code de l’élément et le message affiché, sans identifiants de connexion.",
        "table": null
      }
    ]
  },
  {
    "id": "droits",
    "title": "Profils et habilitations",
    "summary": "Distinguer la visibilité, la saisie et la gestion.",
    "icon": "Lock",
    "articles": [
      {
        "id": "droits-1",
        "title": "Trois niveaux de droits à distinguer",
        "body": [
          "L’accès à une rubrique, la visibilité de ses données et le droit de les modifier sont des autorisations distinctes. Voir un projet ou un indicateur ne signifie pas nécessairement pouvoir le gérer.",
          "Les responsabilités, le lien hiérarchique, la structure et la désignation comme gestionnaire interviennent dans les règles d’accès. Le statut d’une occurrence et la période peuvent également empêcher une modification."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "droits-2",
        "title": "Comprendre les principaux profils",
        "body": [
          "Le tableau ci-dessous décrit les principes généraux. Les accès aux rubriques et les règles propres à chaque opération restent applicables."
        ],
        "steps": [],
        "note": null,
        "table": {
          "headers": [
            "Profil",
            "Principe de fonctionnement"
          ],
          "rows": [
            [
              "Super admin",
              "Dispose des droits étendus de gestion ; les règles métier de verrouillage restent applicables."
            ],
            [
              "Admin",
              "Visibilité étendue dans les modules accessibles. L’accès à Administration et à ses sous-sections dépend des droits accordés."
            ],
            [
              "Super manager",
              "Visibilité étendue ; la gestion d’un projet peut ouvrir des droits spécifiques. Ce profil n’équivaut pas à un Super admin."
            ],
            [
              "Manager / User",
              "Périmètre défini par les responsabilités, les liens hiérarchiques, la structure et les fonctions de gestionnaire."
            ],
            [
              "Point focal",
              "Périmètre limité aux structures qui lui sont attribuées, avec des droits spécifiques de consultation et de saisie."
            ]
          ]
        }
      },
      {
        "id": "droits-3",
        "title": "Gestionnaire : une fonction sur un projet ou un groupe",
        "body": [
          "La qualité de gestionnaire dépend d’une désignation sur le projet d’activités ou le groupe d’indicateurs concerné. Elle est distincte du type de compte.",
          "La création de projets et de groupes dépend des droits « Créer projets » et « Créer groupes d’indicateurs », sauf pour le Super admin.",
          "Dans les formulaires concernés, un utilisateur autre que Super admin ne peut choisir que les projets ou groupes dont il est gestionnaire. Les membres et gestionnaires ne sont pas administrables par simple droit de consultation."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "droits-4",
        "title": "Lecture seule et données verrouillées",
        "body": [
          "En lecture seule, vous pouvez consulter les informations mais pas les enregistrer après modification.",
          "Une action achevée ou un indicateur validé reste verrouillé jusqu’à l’intervention d’un gestionnaire habilité ou d’un Super admin selon le circuit concerné. Les périodes fermées protègent les données qui en dépendent."
        ],
        "steps": [],
        "note": "Si une correction est nécessaire, indiquez au gestionnaire le code, la période, la valeur actuelle et la correction attendue.",
        "table": null
      }
    ]
  },
  {
    "id": "focal",
    "title": "Guide du Point focal",
    "summary": "Vos structures, vos droits et vos opérations courantes.",
    "icon": "Users",
    "articles": [
      {
        "id": "focal-1",
        "title": "Un périmètre comprenant une ou plusieurs structures",
        "body": [
          "Lors de la création ou de la modification du compte, le choix du type « Point focal » fait apparaître un champ obligatoire de sélection des structures. Au moins une structure doit être renseignée.",
          "Ces structures peuvent différer de la structure de rattachement du compte. Dans les rubriques accessibles, le point focal consulte les actions et indicateurs de l’ensemble de ses structures.",
          "Les filtres, résultats et exports respectent ce périmètre. Être gestionnaire d’un projet partagé n’étend pas le périmètre du point focal aux autres structures."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "focal-2",
        "title": "Ce que vous pouvez faire dans Gestion des risques",
        "body": [
          "Les règles suivantes s’appliquent spécifiquement au Point focal."
        ],
        "steps": [],
        "note": null,
        "table": {
          "headers": [
            "Sous-rubrique",
            "Droits du Point focal"
          ],
          "rows": [
            [
              "Identification",
              "Lecture seule, même si vous êtes gestionnaire des risques."
            ],
            [
              "Analyse",
              "Lecture seule, même si vous êtes gestionnaire des risques."
            ],
            [
              "Gestion",
              "Visible uniquement si vous êtes désigné gestionnaire du projet des risques. Les opérations globales restent soumises à leurs droits propres."
            ],
            [
              "Cartographie",
              "Consultation du périmètre autorisé et téléchargement des anciennes cartographies chargées lors des fermetures."
            ],
            [
              "Plan de maîtrise / Suivi du plan",
              "Modification de l’avancement des actions de vos structures. Les actions achevées restent verrouillées."
            ]
          ]
        }
      },
      {
        "id": "focal-3",
        "title": "Mettre à jour les activités et les indicateurs",
        "body": [
          "Dans Suivi des activités > Suivi actions, vous pouvez renseigner l’avancement des occurrences de vos structures, sous réserve des verrouillages existants.",
          "Dans Suivi des indicateurs > Suivi, vous pouvez renseigner les valeurs des occurrences de vos structures. La saisie ne vaut pas validation.",
          "Dans le Plan de maîtrise, les autres champs de la fiche restent en lecture seule si vous n’êtes pas gestionnaire. Lorsque des tâches déterminent le taux global, modifiez leurs taux dans le formulaire ; le serveur recalcule l’avancement."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "focal-4",
        "title": "Membres, gestionnaires et cartographies historiques",
        "body": [
          "Vous ne pouvez pas ajouter ou retirer des membres ou des gestionnaires du seul fait de votre type Point focal. Vous devez être gestionnaire du projet ou du groupe concerné.",
          "Le téléchargement des cartographies historiques est une exception de consultation : le document signé chargé lors de la fermeture peut couvrir un périmètre plus large que vos structures. Cette possibilité n’autorise ni le téléversement ni la suppression du fichier.",
          "Le type Point focal ne permet pas de créer un Admin global ni d’élargir soi-même ses structures d’intervention."
        ],
        "steps": [],
        "note": null,
        "table": null
      }
    ]
  },
  {
    "id": "activites",
    "title": "Suivi des activités",
    "summary": "Du projet à la réalisation d’une occurrence.",
    "icon": "Activity",
    "articles": [
      {
        "id": "activites-1",
        "title": "Projet, action, occurrence et tâche",
        "body": [
          "Un projet regroupe des actions. L’action porte son libellé, sa structure et son rattachement au projet. L’occurrence porte notamment les dates, le responsable et le taux d’avancement.",
          "Une tâche détaille le travail d’une occurrence. Lorsqu’une occurrence comporte des tâches, son taux d’avancement est calculé à partir de leurs taux."
        ],
        "steps": [],
        "note": null,
        "table": {
          "headers": [
            "Élément",
            "Exemple de lecture"
          ],
          "rows": [
            [
              "Projet",
              "Programme de formation"
            ],
            [
              "Action",
              "Former les équipes régionales"
            ],
            [
              "Occurrence",
              "Session de formation prévue sur une période précise"
            ],
            [
              "Tâche",
              "Préparer les supports, organiser la session ou produire le compte rendu"
            ]
          ]
        }
      },
      {
        "id": "activites-2",
        "title": "Créer une action et sa première occurrence",
        "body": [
          "Cette opération nécessite les droits de gestion sur le projet concerné."
        ],
        "steps": [
          "Ouvrez Suivi des activités > Actions, puis le bouton de création.",
          "Renseignez le libellé, le projet, la structure et les autres champs demandés.",
          "Complétez les dates et le responsable de la première occurrence. La date de fin doit être postérieure ou égale à la date de début.",
          "Enregistrez, puis contrôlez le résultat et la présence de l’action et de son occurrence."
        ],
        "note": "Un projet inactif ne permet pas de créer une nouvelle action. Les occurrences d’une même action ne doivent pas avoir des périodes qui se chevauchent.",
        "table": null
      },
      {
        "id": "activites-3",
        "title": "Retrouver une action avec son numéro",
        "body": [
          "La colonne « N° action » affiche le code de l’action précédé de « A- ». Par exemple, l’action 1234 apparaît sous le numéro A-1234.",
          "Ce numéro est identique dans Actions et Suivi actions : il identifie l’action, pas une occurrence particulière. Plusieurs lignes de suivi peuvent donc partager le même numéro.",
          "Le champ Recherche accepte le code complet, le numéro seul ou une partie du libellé. Combinez ensuite les filtres Projet, Structure, Responsable et dates pour retrouver l’occurrence souhaitée."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "activites-4",
        "title": "Renseigner l’avancement",
        "body": [
          "Travaillez dans Suivi actions sur la bonne occurrence."
        ],
        "steps": [
          "Retrouvez l’action par son numéro et vérifiez ses dates et son projet.",
          "Ouvrez la fiche à l’aide du bouton de consultation ou de modification.",
          "Renseignez un taux compris entre 0 et 100 %. Si des tâches existent, renseignez leurs taux : le taux global est calculé.",
          "Ajoutez un commentaire utile pour expliquer la progression ou répondre à un rejet.",
          "Enregistrez, puis vérifiez le taux et le statut affichés."
        ],
        "note": "Atteindre 100 % ne signifie pas que l’action est confirmée. La confirmation du gestionnaire constitue une étape distincte.",
        "table": null
      },
      {
        "id": "activites-5",
        "title": "Confirmation, rejet et correction",
        "body": [
          "Une occurrence à 100 % peut apparaître « Terminée - non confirmée ». Le gestionnaire compétent examine la réalisation avant de la confirmer.",
          "Après confirmation, le statut « Achevée » verrouille la saisie. Une correction nécessite d’abord le retrait de la confirmation par une personne habilitée.",
          "En cas de rejet, consultez le commentaire du gestionnaire. Une réponse est obligatoire lors de la nouvelle soumission à 100 % lorsque le circuit la demande. L’historique conserve les échanges."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "activites-6",
        "title": "Lire le tableau Suivi actions",
        "body": [
          "Les colonnes N° action, Libellé et Projet permettent d’identifier chaque ligne avant de lire ses dates, son avancement et son retard.",
          "Les en-têtes et les données courtes sont affichés sur une ligne. Les colonnes Libellé et Projet sont limitées à deux lignes avec points de suspension ; ouvrez la fiche ou survolez le texte pour consulter son contenu complet.",
          "Utilisez le défilement horizontal pour voir toutes les colonnes. Les filtres d’avancement et de retard facilitent le repérage des actions à traiter."
        ],
        "steps": [],
        "note": null,
        "table": null
      }
    ]
  },
  {
    "id": "indicateurs",
    "title": "Suivi des indicateurs",
    "summary": "Définir les mesures, saisir les valeurs et suivre leur validation.",
    "icon": "BarChart3",
    "articles": [
      {
        "id": "indicateurs-1",
        "title": "Groupe, indicateur et occurrence",
        "body": [
          "Un groupe organise les indicateurs et leurs gestionnaires. L’indicateur définit ce qui est mesuré : libellé, type, sens, périodicité, structure, responsable et, le cas échéant, seuils.",
          "Une occurrence correspond à une période de mesure. Elle porte les dates, la cible lorsqu’elle est nécessaire, la valeur observée et le suivi de validation."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "indicateurs-2",
        "title": "Préparer un indicateur",
        "body": [
          "Vérifiez vos droits sur les groupes concernés avant d’ouvrir le formulaire."
        ],
        "steps": [
          "Choisissez le ou les groupes accessibles, puis renseignez le libellé et la structure.",
          "Sélectionnez le type, le sens et la périodicité adaptés à la mesure.",
          "Désignez un responsable admissible : membre de la structure ou gestionnaire d’un groupe concerné selon les règles du formulaire.",
          "Indiquez si une cible est nécessaire et complétez les paramètres demandés.",
          "Enregistrez la définition, puis ouvrez une occurrence pour la période de mesure."
        ],
        "note": null,
        "table": null
      },
      {
        "id": "indicateurs-3",
        "title": "Saisir une valeur dans Suivi",
        "body": [
          "Vérifiez l’indicateur et la période avant toute saisie."
        ],
        "steps": [
          "Ouvrez Suivi des indicateurs > Suivi et filtrez les lignes utiles.",
          "Ouvrez l’occurrence et vérifiez les dates de début, de fin et la date limite de saisie.",
          "Renseignez la valeur ; pour un taux, renseignez le numérateur et le dénominateur prévus par le formulaire.",
          "Ajoutez un commentaire explicatif, notamment en réponse à un rejet.",
          "Enregistrez puis contrôlez la valeur calculée et le statut de validation."
        ],
        "note": "Un dénominateur nul ne permet pas de calculer un taux. Ne confondez pas une valeur nulle, qui peut être un résultat réel, avec une valeur non renseignée.",
        "table": null
      },
      {
        "id": "indicateurs-4",
        "title": "Cible et validation",
        "body": [
          "Lorsque l’indicateur nécessite une cible, celle-ci est requise à l’ouverture de l’occurrence. La date limite de saisie doit être postérieure ou égale à la fin de période.",
          "Si aucune cible n’est nécessaire, l’indicateur reste suivable sans cible. Ne remplacez pas une cible absente par une valeur arbitraire pour obtenir un taux d’atteinte.",
          "La valeur saisie peut être en attente de validation. Seuls les gestionnaires habilités ou le Super admin réalisent les décisions de validation, de rejet ou d’annulation. Un indicateur validé reste en lecture seule jusqu’à l’annulation de sa validation."
        ],
        "steps": [],
        "note": null,
        "table": null
      }
    ]
  },
  {
    "id": "risques",
    "title": "Gestion des risques",
    "summary": "Identifier, analyser, cartographier et traiter les risques.",
    "icon": "Shield",
    "articles": [
      {
        "id": "risques-1",
        "title": "Identification : décrire le risque",
        "body": [
          "La fiche associe le risque à une structure, un processus et aux catégories pertinentes. Le libellé, les causes et les conséquences doivent permettre de comprendre le risque sans ambiguïté.",
          "Selon sa nature, le risque s’appuie sur un indicateur ou sur une appréciation qualitative. Les paramètres d’impact et de maîtrise participent ensuite à son évaluation.",
          "Les boutons de création, de modification et de suppression dépendent des habilitations. Pour un Point focal, Identification est toujours en lecture seule."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "risques-2",
        "title": "Analyse : sélectionner la bonne période",
        "body": [
          "L’analyse s’effectue pour une période donnée. Vérifiez les filtres de période avant de lire ou renseigner une probabilité.",
          "Lorsque la valeur de l’indicateur est disponible, la probabilité est déterminée à partir des paramètres de l’indicateur. La saisie manuelle de probabilité est prévue lorsque cette valeur est absente, selon le type de risque et vos droits.",
          "Un commentaire est obligatoire lorsque vous renseignez une probabilité manuelle. Une période fermée est en lecture seule. Le Point focal est également en lecture seule sur une période ouverte."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "risques-3",
        "title": "Évaluation et cartographie",
        "body": [
          "L’Évaluation permet d’apprécier les niveaux de risque à la période sélectionnée. La Cartographie positionne les risques selon les paramètres d’impact, de probabilité et de criticité.",
          "Vérifiez la période et les options de lecture, notamment la distinction entre risque brut et risque résiduel lorsqu’elle est proposée. Une donnée absente ne doit pas être interprétée comme un risque faible.",
          "Les exports proposés sur l’écran permettent de partager la vue. Contrôlez les filtres et la période avant de les produire."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "risques-4",
        "title": "Télécharger une ancienne cartographie",
        "body": [
          "Le fichier signé est celui qui a été chargé lors de la fermeture de période ; il est distinct de l’export de la cartographie affichée à l’écran."
        ],
        "steps": [
          "Ouvrez Gestion des risques > Cartographie.",
          "Sélectionnez la période fermée recherchée.",
          "Cliquez sur « Télécharger cartographie signée ».",
          "Vérifiez le document téléchargé et sa période."
        ],
        "note": "Si aucun fichier signé n’est disponible, demandez au gestionnaire de vérifier le document associé à la fermeture. Le Point focal peut télécharger ces fichiers historiques.",
        "table": null
      },
      {
        "id": "risques-5",
        "title": "Plan de maîtrise et Suivi du plan",
        "body": [
          "Le Plan de maîtrise relie les risques aux actions destinées à les traiter. Le tableau des actions d’un risque permet d’en consulter les responsables, les échéances et l’avancement.",
          "Le Suivi du plan offre une lecture transversale des occurrences. Les filtres permettent notamment de cibler un risque, une structure, un responsable ou un niveau d’avancement."
        ],
        "steps": [
          "Ouvrez les actions du risque ou le tableau Suivi du plan.",
          "Repérez l’action et son occurrence, puis ouvrez sa fiche.",
          "Modifiez l’avancement si vous y êtes autorisé ; si des tâches existent, renseignez leurs taux.",
          "Enregistrez et contrôlez la mise à jour du résultat."
        ],
        "note": "Le Point focal peut renseigner les taux dans ses structures, sans modifier les autres champs s’il n’est pas gestionnaire. Les actions achevées conservent leur verrouillage.",
        "table": null
      },
      {
        "id": "risques-6",
        "title": "Synthèse et Gestion",
        "body": [
          "La Synthèse rassemble les résultats utiles au pilotage des risques dans le périmètre affiché. Elle doit être lue avec la période et les filtres actifs.",
          "Gestion regroupe notamment les périodes, les référentiels et la désignation des gestionnaires de risques. La fermeture d’une période est une opération globale : elle ne découle pas d’un simple droit de saisie.",
          "Pour un Point focal, Gestion est masquée sauf s’il est désigné gestionnaire du projet des risques. Son accès à cet écran ne lui donne pas automatiquement le droit d’effectuer toutes les opérations globales."
        ],
        "steps": [],
        "note": null,
        "table": null
      }
    ]
  },
  {
    "id": "pilotage",
    "title": "Tableaux de bord et performances",
    "summary": "Interpréter les résultats avec leur périmètre.",
    "icon": "TrendingUp",
    "articles": [
      {
        "id": "pilotage-1",
        "title": "Accueil et éléments en attente",
        "body": [
          "L’Accueil propose une synthèse personnalisée et des accès aux modules autorisés. Les éléments en attente dépendent de vos données visibles et des règles de suivi.",
          "Pour traiter une alerte, ouvrez le module correspondant et recherchez l’élément. Vérifiez sa période, son état de saisie et son statut de validation avant d’agir."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "pilotage-2",
        "title": "Lire les tableaux de bord",
        "body": [
          "Les vues Actions, Indicateurs et Risques présentent des chiffres clés et des graphiques. Les valeurs reflètent les filtres et le périmètre autorisé.",
          "Avant de comparer deux résultats, vérifiez qu’ils portent sur les mêmes dates, structures et populations d’éléments. Un total d’occurrences ne représente pas nécessairement un total d’actions distinctes.",
          "Un écran vide peut résulter de filtres trop restrictifs ou de données non renseignées. Il ne signifie pas nécessairement qu’aucune activité n’existe."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "pilotage-3",
        "title": "Suivi des performances",
        "body": [
          "La rubrique consolide des résultats de suivi pour les utilisateurs et structures accessibles. Utilisez les filtres de structure, d’utilisateur et de période pour préciser la lecture.",
          "Une performance doit être interprétée avec la complétude des saisies, les échéances et les états de validation. Des valeurs encore manquantes ou en attente peuvent modifier l’interprétation.",
          "Le Point focal consulte les résultats liés à ses structures. Les autres profils suivent leurs propres règles de visibilité."
        ],
        "steps": [],
        "note": null,
        "table": null
      }
    ]
  },
  {
    "id": "rapports",
    "title": "Rapports et exports",
    "summary": "Préparer une restitution claire et cohérente.",
    "icon": "FileText",
    "articles": [
      {
        "id": "rapports-1",
        "title": "Construire un rapport consolidé",
        "body": [
          "Le module Rapports permet de choisir les structures et les volets à restituer : risques, activités et indicateurs."
        ],
        "steps": [
          "Sélectionnez au moins une structure parmi celles qui vous sont accessibles.",
          "Activez les volets souhaités et précisez les périodes et filtres proposés.",
          "Générez le rapport puis examinez les tableaux, chiffres clés et graphiques.",
          "Vérifiez les intitulés, le périmètre et les éventuelles données manquantes.",
          "Exportez en PDF ou en Word à l’aide du bouton correspondant."
        ],
        "note": null,
        "table": null
      },
      {
        "id": "rapports-2",
        "title": "Exporter un tableau",
        "body": [
          "Utilisez le bouton Excel lorsque l’écran le propose. Dans Actions et Suivi actions, les exports reprennent notamment le numéro A-… ; le suivi indique également le projet.",
          "Les filtres actifs déterminent les lignes retenues par les exports de ces tableaux. Réinitialisez-les avant d’exporter un périmètre plus large, puis vérifiez le nombre de lignes.",
          "Un export ne donne pas accès à des données hors de vos habilitations. Après téléchargement, contrôlez le fichier avant de le diffuser."
        ],
        "steps": [],
        "note": null,
        "table": null
      }
    ]
  },
  {
    "id": "administration",
    "title": "Administration",
    "summary": "Maintenir les comptes et attribuer les droits adaptés.",
    "icon": "Settings",
    "articles": [
      {
        "id": "administration-1",
        "title": "Créer ou modifier un utilisateur",
        "body": [
          "L’accès à Administration et les possibilités d’édition dépendent du profil et des droits accordés. Un Admin ne peut modifier que les utilisateurs qu’il a lui-même créés ; seul un Super admin peut modifier un compte Super admin."
        ],
        "steps": [
          "Ouvrez Administration > Gestion puis le formulaire utilisateur.",
          "Renseignez l’adresse email, le nom, les prénoms, la structure et les informations professionnelles demandées.",
          "Choisissez le type de compte et les rubriques accessibles.",
          "Pour un Point focal, sélectionnez obligatoirement une ou plusieurs structures d’intervention.",
          "Vérifiez les droits de création de projets et de groupes, puis enregistrez.",
          "Contrôlez le message de résultat, notamment le statut de l’email de création du compte."
        ],
        "note": null,
        "table": null
      },
      {
        "id": "administration-2",
        "title": "Attribuer les accès avec précision",
        "body": [
          "Les droits « Créer projets » et « Créer groupes d’indicateurs » sont distincts de l’accès aux modules de suivi.",
          "L’accès Administration et les droits sur ses sous-sections sont accordés par le Super admin aux profils concernés. La lecture d’une sous-section n’équivaut pas à son droit d’édition.",
          "La structure de rattachement, le supérieur hiérarchique et les structures d’un Point focal répondent à des besoins différents : vérifiez chaque champ avant de valider."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "administration-3",
        "title": "Structures, infos flash et emailing",
        "body": [
          "Les structures servent au rattachement des utilisateurs et des données métier. Les infos flash permettent de publier les messages disponibles sur la plateforme.",
          "L’emailing permet aux personnes habilitées de préparer des relances et d’en consulter les résultats. Vérifiez les destinataires et les éléments concernés avant de déclencher un envoi.",
          "Les opérations globales restent réservées aux habilitations correspondantes. Le Point focal ne peut pas étendre son périmètre par une modification de son propre compte."
        ],
        "steps": [],
        "note": null,
        "table": null
      }
    ]
  },
  {
    "id": "depannage",
    "title": "Questions fréquentes",
    "summary": "Diagnostiquer rapidement les situations courantes.",
    "icon": "HelpCircle",
    "articles": [
      {
        "id": "depannage-1",
        "title": "Pourquoi une action ou un indicateur est-il absent ?",
        "body": [
          "Vérifiez d’abord les filtres : structure, projet ou groupe, responsable, dates et statut. Essayez ensuite le code de l’action ou une partie du libellé.",
          "Consultez les archives si l’élément a pu être archivé. Vérifiez enfin votre rôle sur le projet ou groupe et, pour un Point focal, les structures attribuées au compte."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "depannage-2",
        "title": "Pourquoi le bouton Enregistrer est-il absent ou désactivé ?",
        "body": [
          "Vous pouvez être en lecture seule, consulter une occurrence déjà validée ou achevée, ou travailler sur une période fermée. Certains champs appartiennent exclusivement au gestionnaire.",
          "Vérifiez le statut affiché et les explications de la fiche. Si une correction est nécessaire, contactez le gestionnaire concerné."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "depannage-3",
        "title": "Pourquoi ne puis-je pas choisir un projet ou un groupe ?",
        "body": [
          "À l’exception du Super admin, la liste de choix des formulaires concernés est limitée aux projets ou groupes dont vous êtes gestionnaire.",
          "Le droit de consulter des actions ou des indicateurs, y compris comme Point focal, ne suffit pas à ouvrir les droits de gestion."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "depannage-4",
        "title": "Pourquoi mon taux d’avancement ne se modifie-t-il pas directement ?",
        "body": [
          "Si des tâches sont rattachées à l’occurrence, le taux global est calculé depuis les taux des tâches. Modifiez les tâches autorisées puis vérifiez le résultat.",
          "Si l’action est achevée, le verrouillage doit être levé par une personne habilitée avant toute correction."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "depannage-5",
        "title": "Pourquoi 100 % ne signifie-t-il pas « Achevée » ?",
        "body": [
          "Le taux indique l’avancement déclaré. Le statut « Achevée » dépend aussi de la confirmation du gestionnaire. Une occurrence à 100 % peut donc rester « Terminée - non confirmée »."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "depannage-6",
        "title": "Que faire après un rejet ?",
        "body": [
          "Lisez le commentaire du gestionnaire, corrigez la saisie puis ajoutez une réponse explicative avant de soumettre à nouveau.",
          "Pour les actions resoumises à 100 % et les indicateurs avec un rejet en cours, un commentaire de réponse peut être obligatoire. Consultez l’historique pour comprendre la décision."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "depannage-7",
        "title": "Pourquoi une cartographie signée ne se télécharge-t-elle pas ?",
        "body": [
          "Vérifiez que vous avez sélectionné une période fermée. Si aucun fichier n’a été chargé pour cette période, aucun document signé ne peut être fourni.",
          "Réessayez depuis le bouton de téléchargement de la période. Si le problème persiste, transmettez la période et le message d’erreur au gestionnaire."
        ],
        "steps": [],
        "note": null,
        "table": null
      },
      {
        "id": "depannage-8",
        "title": "Que transmettre pour faire traiter une anomalie ?",
        "body": [
          "Indiquez votre type de compte, la rubrique et sous-rubrique, la structure et la période concernées, le code de l’action ou de l’indicateur, l’opération tentée et le message exact.",
          "Ajoutez une capture de l’écran si elle aide au diagnostic, en masquant les informations sensibles. Ne transmettez jamais de mot de passe."
        ],
        "steps": [],
        "note": null,
        "table": null
      }
    ]
  },
  {
    "id": "glossaire",
    "title": "Glossaire et bonnes pratiques",
    "summary": "Les termes clés et les contrôles à retenir.",
    "icon": "CheckCircle2",
    "articles": [
      {
        "id": "glossaire-1",
        "title": "Les termes essentiels",
        "body": [],
        "steps": [],
        "note": null,
        "table": {
          "headers": [
            "Terme",
            "Définition"
          ],
          "rows": [
            [
              "Occurrence",
              "Instance de suivi d’une action ou d’un indicateur pour des dates ou une période données."
            ],
            [
              "Cible",
              "Résultat attendu pour une occurrence d’indicateur, lorsque cet indicateur nécessite une cible."
            ],
            [
              "Valeur",
              "Résultat observé et saisi pour un indicateur."
            ],
            [
              "Gestionnaire",
              "Utilisateur désigné pour gérer un projet ou un groupe précis."
            ],
            [
              "Point focal",
              "Utilisateur intervenant sur une ou plusieurs structures explicitement attribuées."
            ],
            [
              "Criticité",
              "Appréciation du niveau de risque issue des paramètres d’évaluation."
            ],
            [
              "Archive",
              "Élément retiré des listes actives et consultable dans les vues d’archives prévues."
            ],
            [
              "Validation / confirmation",
              "Décision de contrôle distincte de la saisie d’une valeur ou d’un avancement."
            ]
          ]
        }
      },
      {
        "id": "glossaire-2",
        "title": "Avant de saisir, avant de partager",
        "body": [
          "Avant une saisie, contrôlez le code de l’élément, ses dates, sa structure et le responsable. Distinguez une donnée manquante d’un résultat égal à zéro.",
          "Avant d’enregistrer, relisez les valeurs et commentaires. Attendez le résultat de l’opération ; en cas d’erreur, vérifiez l’état enregistré avant de recommencer.",
          "Avant un export, contrôlez les filtres, la période, le nombre de lignes et les états de validation. Avant une suppression, vérifiez les dépendances et assurez-vous que l’opération correspond bien au besoin."
        ],
        "steps": [],
        "note": null,
        "table": null
      }
    ]
  }
]

const icons = { BookOpen, Lock, Users, Activity, BarChart3, Shield, TrendingUp, FileText, Settings, HelpCircle, CheckCircle2 }
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ')
const articleText = (section, article) => normalize([section.title, section.summary, article.title, ...article.body, ...article.steps, article.note || '', ...(article.table?.headers || []), ...(article.table?.rows || []).flat()].join(' '))
const totalArticles = sections.reduce((total, section) => total + section.articles.length, 0)
const shortcuts = [
  { id: 'activites', icon: Activity, title: 'Actualiser une action', text: 'Avancement, tâches et confirmation' },
  { id: 'indicateurs', icon: BarChart3, title: 'Saisir un indicateur', text: 'Valeurs, cibles et validation' },
  { id: 'focal', icon: Users, title: 'Comprendre mes droits', text: 'Le guide dédié au Point focal' },
  { id: 'depannage', icon: HelpCircle, title: 'Résoudre une difficulté', text: 'Réponses aux questions fréquentes' },
]

export default function AidePage() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState('demarrage')
  const [expandAll, setExpandAll] = useState(null)
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean)
  const searching = terms.length > 0
  const results = useMemo(() => sections.map(section => ({ ...section, articles: section.articles.filter(article => terms.every(term => articleText(section, article).includes(term))) })).filter(section => section.articles.length), [query])
  const visible = searching || active === 'all' ? results : results.filter(section => section.id === active)
  const count = visible.reduce((total, section) => total + section.articles.length, 0)
  const current = sections.find(section => section.id === active)
  const navigate = id => {
    setActive(id)
    setQuery('')
    setExpandAll(null)
    document.getElementById('help-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="relative overflow-hidden rounded-3xl bg-[#163452] text-white shadow-lg">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full border-[48px] border-white/5" />
          <div className="relative grid gap-8 px-6 py-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:px-10 lg:py-10">
            <div>
              <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-teal-200"><BookOpen size={17} /> GIRAS · Centre d’aide</div>
              <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Les bons repères,<br />à chaque étape.</h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-200">Des guides pratiques pour suivre vos activités, renseigner vos indicateurs et piloter les risques en comprenant vos droits.</p>
              <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-200"><span className="rounded-full border border-white/20 px-3 py-1.5">{sections.length} thèmes</span><span className="rounded-full border border-white/20 px-3 py-1.5">{totalArticles} fiches pratiques</span><span className="rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-1.5 text-teal-100">Guide Point focal inclus</span></div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5 sm:p-6">
              <label htmlFor="help-search" className="mb-3 block text-base font-semibold">Comment pouvons-nous vous aider ?</label>
              <div className="relative">
                <Search aria-hidden="true" size={19} className="absolute left-4 top-4 text-slate-400" />
                <input id="help-search" type="search" value={query} onChange={e => { setQuery(e.target.value); setActive('all'); setExpandAll(null) }} placeholder="Ex. point focal, A-1234, période fermée…" className="w-full rounded-xl border border-white bg-white py-3.5 pl-11 pr-10 text-sm text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-teal-300/40" />
                {query && <button type="button" aria-label="Effacer la recherche" onClick={() => setQuery('')} className="absolute right-2 top-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-600"><X size={17} /></button>}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-300">La recherche explore l’ensemble du guide, même si un thème est sélectionné.</p>
              <div className="mt-4 flex flex-wrap gap-2">{['Lecture seule', 'Cartographie', 'Validation'].map(term => <button type="button" key={term} onClick={() => { setQuery(term); setActive('all'); setExpandAll(null) }} className="rounded-full border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-teal-200">{term}</button>)}</div>
            </div>
          </div>
        </header>

        <div className="my-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map(card => { const Icon = card.icon; return <button type="button" key={card.id} onClick={() => navigate(card.id)} className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon size={20} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{card.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{card.text}</span></span><ArrowUpRight size={16} className="mt-1 shrink-0 text-slate-400 group-hover:text-teal-600" /></button> })}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside aria-label="Navigation du centre d’aide" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-130px)] lg:overflow-y-auto">
            <p className="px-3 pb-3 pt-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Explorer le guide</p>
            <nav className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {[{ id: 'all', title: 'Tout le guide', icon: 'BookOpen', articles: { length: totalArticles } }, ...sections].map(section => { const Icon = icons[section.icon]; const selected = active === section.id; return <button type="button" key={section.id} aria-current={selected ? 'page' : undefined} onClick={() => navigate(section.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${selected ? 'bg-[#163452] font-semibold text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={17} className="shrink-0" /><span className="flex-1">{section.title}</span><span className={`text-[10px] ${selected ? 'text-slate-300' : 'text-slate-400'}`}>{section.articles.length}</span></button> })}
            </nav>
            <div className="m-2 mt-5 rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Lock size={14} /> Vos habilitations restent applicables</p><p className="mt-2 text-xs leading-5 text-slate-500">Ce guide décrit les usages de la plateforme. Les opérations disponibles dépendent de votre profil et du statut des données.</p></div>
          </aside>

          <main id="help-content" className="min-w-0 scroll-mt-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-teal-700">{searching ? 'Recherche dans le guide' : 'Documentation fonctionnelle'}</p><h2 className="text-2xl font-bold tracking-tight text-slate-900">{searching ? 'Résultats de recherche' : current?.title || 'Tout le guide'}</h2><p aria-live="polite" className="mt-2 text-sm text-slate-500">{count} fiche{count > 1 ? 's' : ''} {searching ? `pour « ${query} »` : 'à consulter'} · Cliquez sur un titre pour lire son contenu.</p></div>
              {count > 0 && <button type="button" onClick={() => setExpandAll(previous => !(previous ?? searching))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-600">{(expandAll ?? searching) ? 'Tout replier' : 'Tout déplier'}</button>}
            </div>
            {count === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><Search size={30} className="mx-auto text-slate-300" /><h3 className="mt-4 text-lg font-semibold">Aucune fiche trouvée</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Essayez un terme plus court, comme « action », « période » ou « validation ». Vous pouvez aussi parcourir les thèmes du guide.</p><button type="button" onClick={() => navigate('all')} className="mt-5 rounded-xl bg-[#163452] px-4 py-2.5 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-teal-500">Afficher tout le guide</button></div>}
            <div className="space-y-7">
              {visible.map(section => { const Icon = icons[section.icon]; return <section key={section.id} aria-labelledby={`title-${section.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 ring-1 ring-slate-200"><Icon size={20} /></span><div><h3 id={`title-${section.id}`} className="text-lg font-bold text-slate-900">{section.title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{section.summary}</p></div></div>
                <div className="divide-y divide-slate-100">{section.articles.map((article, index) => <details key={`${article.id}-${query}-${expandAll}`} open={expandAll ?? (searching || index === 0)} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-5 text-sm font-semibold text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 sm:px-6 [&::-webkit-details-marker]:hidden"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{String(index + 1).padStart(2, '0')}</span><span className="flex-1">{article.title}</span><ChevronDown size={17} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" /></summary>
                  <div className="space-y-4 px-5 pb-6 sm:px-6 sm:pl-[60px]">
                    {article.body.map((text, i) => <p key={i} className="text-sm leading-7 text-slate-600">{text}</p>)}
                    {!!article.steps.length && <ol className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">{article.steps.map((step, i) => <li key={i} className="flex gap-3 text-sm leading-6 text-slate-700"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[10px] font-bold text-white">{i + 1}</span><span>{step}</span></li>)}</ol>}
                    {article.table && <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[420px] text-left text-sm"><thead className="bg-slate-100 text-xs text-slate-700"><tr>{article.table.headers.map(header => <th key={header} scope="col" className="px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{article.table.rows.map((row, i) => <tr key={i} className="align-top even:bg-slate-50/60"><th scope="row" className="w-1/3 px-4 py-3 text-xs font-semibold leading-6 text-slate-800">{row[0]}</th><td className="px-4 py-3 text-sm leading-6 text-slate-600">{row[1]}</td></tr>)}</tbody></table></div>}
                    {article.note && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4"><Info size={17} className="mt-0.5 shrink-0 text-amber-700" /><div><p className="text-xs font-bold text-amber-900">À retenir</p><p className="mt-1 text-sm leading-6 text-amber-900/90">{article.note}</p></div></div>}
                  </div>
                </details>)}</div>
              </section> })}
            </div>
            <footer className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/60 p-5 sm:p-6"><div className="flex items-start gap-3"><HelpCircle size={22} className="mt-0.5 shrink-0 text-teal-700" /><div><h3 className="text-sm font-bold text-slate-900">Besoin d’un accompagnement ?</h3><p className="mt-2 text-sm leading-6 text-slate-600">Contactez le gestionnaire du projet ou du groupe pour une question de saisie ou de validation, et l’administrateur pour une question de compte ou d’accès. Précisez la rubrique, le code de l’élément, sa période et le message rencontré.</p><button type="button" onClick={() => navigate('depannage')} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:underline">Consulter les questions fréquentes <ChevronRight size={15} /></button></div></div></footer>
          </main>
        </div>
      </div>
    </div>
  )
}
