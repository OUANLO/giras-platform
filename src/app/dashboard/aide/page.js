'use client'

import { useMemo, useState } from 'react'
import {
  HelpCircle,
  Search,
  BookOpen,
  LayoutDashboard,
  Shield,
  Activity,
  BarChart3,
  TrendingUp,
  Settings,
  Table2,
  FileText,
  SquareMousePointer,
  CheckCircle2,
  Lock,
  Eye,
  Filter,
  Download,
  ChevronRight,
} from 'lucide-react'

const sections = [
  {
    id: 'demarrage',
    title: 'Démarrage rapide',
    icon: BookOpen,
    summary: 'Comprendre l’objectif de la plateforme, la navigation générale et les règles d’accès.',
    blocks: [
      {
        title: 'À quoi sert GIRAS ?',
        content: [
          'GIRAS est une plateforme de gestion intégrée qui centralise les risques, les activités stratégiques, les indicateurs, les performances et l’administration des référentiels.',
          'Chaque utilisateur voit uniquement les données qu’il est autorisé à consulter selon son profil, sa structure, ses responsabilités et son rôle de gestionnaire.',
        ],
      },
      {
        title: 'Comment se repérer dans la plateforme',
        content: [
          'La barre de rubriques située en haut permet d’accéder aux grands modules : Accueil, Gestion des risques, Suivi des activités, Suivi des indicateurs, Suivi des performances, Tableau de bord, Administration et Aide.',
          'Dans chaque module, les sous-rubriques apparaissent sous forme d’onglets, de boutons ou de sections dédiées. Les tableaux, formulaires et actions disponibles dépendent de vos habilitations.',
        ],
      },
      {
        title: 'Règles générales d’habilitation',
        content: [
          'Les administrateurs, super administrateurs et super managers disposent d’une visibilité globale lorsqu’une règle de filtrage prévoit un accès complet.',
          'Les autres profils sont filtrés selon leur structure, les projets ou groupes qu’ils gèrent, les actions ou indicateurs dont ils sont responsables, ou leur périmètre métier.',
          'Lorsqu’un utilisateur n’a pas le droit de modifier une donnée, les formulaires restent consultables en lecture seule et les boutons de création ou de modification peuvent être masqués.',
        ],
      },
    ],
  },
  {
    id: 'accueil',
    title: 'Accueil',
    icon: LayoutDashboard,
    summary: 'Vue synthétique personnalisée des tâches en attente et accès rapide aux grands modules.',
    blocks: [
      {
        title: 'Ce que montre la page Accueil',
        content: [
          'Les messages de synthèse mettent en avant les risques à évaluer, les actions à réaliser et les indicateurs à saisir.',
          'Ces messages sont automatiquement filtrés selon votre périmètre d’accès : structure pour les risques, responsabilité ou lien hiérarchique pour les actions et les indicateurs, sauf pour les profils ayant un accès global.',
        ],
      },
      {
        title: 'Les boutons d’accès rapide',
        content: [
          'Les grands boutons colorés redirigent vers les modules principaux de la plateforme. Ils servent à ouvrir rapidement la rubrique correspondante sans passer par la barre de navigation.',
          'Un bouton n’est actif que si votre profil dispose du droit d’accès au module concerné.',
        ],
      },
    ],
  },
  {
    id: 'tableau-bord',
    title: 'Tableau de bord',
    icon: Table2,
    summary: 'Espace d’analyse avec chiffres clés et graphiques consolidés par domaine.',
    blocks: [
      {
        title: 'Sous-rubrique Indicateurs',
        content: [
          'Cette vue présente les chiffres clés et les graphiques liés aux indicateurs : volumes, statuts, tendances et répartitions.',
          'Pour un utilisateur standard, tous les calculs se font uniquement à partir des indicateurs de sa structure. Les administrateurs, super administrateurs et super managers voient tous les indicateurs sans aucune exclusion.',
        ],
      },
      {
        title: 'Sous-rubrique Actions',
        content: [
          'Cette vue restitue les chiffres clés et les graphiques sur les actions : nombre total, avancement, retard, répartition par statut ou projet selon les visualisations présentes.',
          'Pour un utilisateur standard, les calculs ne prennent en compte que les actions dont il est responsable. Les profils globaux voient toutes les actions.',
        ],
      },
      {
        title: 'Sous-rubrique Risques',
        content: [
          'Cette vue synthétise les risques à travers des indicateurs de criticité, de niveau, de cartographie et d’évolution.',
          'Le comportement de filtrage est aligné sur la synthèse de la gestion des risques : un utilisateur standard voit les chiffres calculés sur les risques de sa structure ; les profils globaux voient l’ensemble des risques.',
        ],
      },
      {
        title: 'Lecture des graphiques',
        content: [
          'Les graphiques permettent d’identifier rapidement les tendances, les concentrations et les points de vigilance. Ils doivent être lus en parallèle des chiffres clés affichés dans les cartes de synthèse.',
          'Lorsque vous changez de période, de filtre ou de sous-rubrique, les chiffres et visuels se recalculent automatiquement à partir des données autorisées pour votre profil.',
        ],
      },
    ],
  },
  {
    id: 'risques',
    title: 'Gestion des risques',
    icon: Shield,
    summary: 'Cycle complet du risque : identification, analyse, évaluation, cartographie, plan de maîtrise et synthèse.',
    blocks: [
      {
        title: 'Identification',
        content: [
          'Cette sous-rubrique permet d’enregistrer les risques, de les consulter et d’accéder à leurs informations détaillées.',
          'Seuls les gestionnaires risques, les administrateurs et les super administrateurs peuvent créer ou modifier un risque. Pour les autres utilisateurs, la fiche du risque s’ouvre en lecture seule : les champs du formulaire restent visibles mais non modifiables.',
          'Le bouton “Actions standards” affiche les actions standards rattachées au périmètre autorisé. Les utilisateurs standards ne voient que les actions standards liées à leur structure. Seuls les gestionnaires risques, les administrateurs et les super administrateurs peuvent créer ou modifier ces actions standards.',
        ],
      },
      {
        title: 'Analyse',
        content: [
          'Cette sous-rubrique sert à renseigner et suivre l’analyse détaillée des risques : causes, effets, niveau d’exposition, commentaires ou éléments d’appréciation selon le modèle de données actif.',
          'Les utilisateurs standards n’y voient que les risques de leur structure. Les profils globaux conservent une visibilité complète.',
        ],
      },
      {
        title: 'Évaluation',
        content: [
          'Cette vue permet d’apprécier le niveau du risque à une période donnée à partir des paramètres d’évaluation configurés dans la plateforme.',
          'Elle reprend le même périmètre de visibilité que les autres sous-rubriques de gestion des risques : structure de l’utilisateur pour les profils standards, tout le référentiel pour les profils globaux.',
        ],
      },
      {
        title: 'Cartographie',
        content: [
          'La cartographie visualise les risques selon leurs niveaux d’impact, de probabilité ou de criticité afin d’identifier rapidement les zones prioritaires.',
          'La cartographie est calculée uniquement sur les risques visibles par l’utilisateur connecté.',
        ],
      },
      {
        title: 'Plan de maîtrise',
        content: [
          'Le plan de maîtrise regroupe les réponses prévues pour traiter les risques : mesures, responsables, échéances, statut de réalisation et suivi d’exécution.',
          'Les données affichées sont filtrées à partir des risques visibles selon les habilitations de l’utilisateur.',
        ],
      },
      {
        title: 'Synthèse',
        content: [
          'La synthèse présente une vue consolidée de la situation des risques : chiffres clés, répartition, concentration et évolution.',
          'Pour un utilisateur standard, tous les calculs sont basés sur les risques de sa structure. Les profils globaux obtiennent la vision complète.',
        ],
      },
    ],
  },
  {
    id: 'activites',
    title: 'Suivi des activités',
    icon: Activity,
    summary: 'Pilotage des projets, des actions et de leur réalisation opérationnelle.',
    blocks: [
      {
        title: 'Projet',
        content: [
          'La liste des projets affiche les projets pour lesquels l’utilisateur est gestionnaire ainsi que ceux pour lesquels il est responsable d’au moins une action, selon les règles d’habilitation applicables.',
          'Seuls les administrateurs et les super administrateurs peuvent créer ou modifier un projet. Pour les autres utilisateurs, la consultation reste possible en lecture seule.',
        ],
      },
      {
        title: 'Actions',
        content: [
          'Cette sous-rubrique sert à créer, consulter, modifier et suivre les actions rattachées aux projets.',
          'Lorsqu’un utilisateur est gestionnaire d’un projet, il accède à l’ensemble des actions de ce projet sans exception. Les administrateurs et super administrateurs conservent un accès global.',
          'Seuls les gestionnaires de projet, les administrateurs et les super administrateurs peuvent créer ou modifier une action.',
          'Lors de la création d’une action, un gestionnaire de projet qui n’est ni administrateur ni super administrateur ne voit, dans la liste déroulante “Projet *”, que les projets dont il est gestionnaire.',
        ],
      },
      {
        title: 'Suivi actions',
        content: [
          'La vue de suivi permet de renseigner ou contrôler l’avancement, les réalisations, les dates, les commentaires et les écarts liés à l’exécution des actions.',
          'Les tableaux et formulaires de suivi sont alimentés à partir des actions visibles par l’utilisateur selon son rôle et son périmètre.',
        ],
      },
    ],
  },
  {
    id: 'indicateurs',
    title: 'Suivi des indicateurs',
    icon: BarChart3,
    summary: 'Organisation des groupes, définition des indicateurs et suivi des valeurs.',
    blocks: [
      {
        title: 'Groupe',
        content: [
          'Cette sous-rubrique regroupe les groupes d’indicateurs. Un utilisateur y voit les groupes qu’il gère ainsi que ceux pour lesquels il est responsable d’au moins un indicateur, selon son profil.',
          'Seuls les administrateurs et les super administrateurs peuvent créer ou modifier un groupe. Les autres utilisateurs restent en lecture seule.',
        ],
      },
      {
        title: 'Indicateurs',
        content: [
          'Cette vue sert à définir les indicateurs, leurs responsables, leurs groupes d’appartenance et leurs paramètres de suivi.',
          'Lorsqu’un utilisateur est gestionnaire d’un groupe, il accède à l’ensemble des indicateurs de ce groupe. Les administrateurs et super administrateurs disposent d’un accès global.',
          'Seuls les gestionnaires de groupe, les administrateurs et les super administrateurs peuvent créer ou modifier un indicateur.',
          'Lors de la création d’un indicateur, un gestionnaire de groupe qui n’est ni administrateur ni super administrateur ne voit, dans la liste déroulante “Groupe(s) *”, que les groupes dont il est gestionnaire.',
        ],
      },
      {
        title: 'Suivi',
        content: [
          'La sous-rubrique de suivi permet d’enregistrer les valeurs observées, de vérifier la complétude des saisies et d’analyser l’évolution des résultats.',
          'Les occurrences visibles sont filtrées à partir des indicateurs autorisés pour l’utilisateur connecté.',
        ],
      },
    ],
  },
  {
    id: 'performances',
    title: 'Suivi des performances',
    icon: TrendingUp,
    summary: 'Lecture transversale de la performance des utilisateurs ou des structures selon le périmètre autorisé.',
    blocks: [
      {
        title: 'Ce que montre la rubrique',
        content: [
          'La rubrique Suivi des performances consolide des résultats liés aux activités et aux indicateurs afin d’apprécier la performance opérationnelle.',
          'Un utilisateur standard ne peut voir que les performances des utilisateurs de sa structure. Les administrateurs, super administrateurs et super managers voient les performances de tous les utilisateurs.',
        ],
      },
    ],
  },
  {
    id: 'administration',
    title: 'Administration',
    icon: Settings,
    summary: 'Gestion des référentiels, utilisateurs, profils, paramètres et données d’organisation.',
    blocks: [
      {
        title: 'Finalité du module',
        content: [
          'Le module Administration permet de maintenir les données de base utilisées dans la plateforme : utilisateurs, structures, paramètres, référentiels et réglages techniques ou fonctionnels disponibles selon le niveau d’accès.',
          'Les écrans d’administration servent également à sécuriser la gouvernance des accès et à garantir la qualité des données exploitées dans les autres rubriques.',
        ],
      },
    ],
  },
  {
    id: 'composants',
    title: 'Formulaires, tableaux, boutons et fonctionnalités',
    icon: FileText,
    summary: 'Guide de lecture des composants communs utilisés dans toute la plateforme.',
    blocks: [
      {
        title: 'Formulaires',
        content: [
          'Les formulaires servent à créer, consulter ou modifier des enregistrements. Les champs marqués d’un astérisque sont obligatoires.',
          'Quand vous êtes en lecture seule, les champs s’affichent mais ne peuvent pas être modifiés. Cela permet de consulter le détail d’un enregistrement sans risquer une modification non autorisée.',
          'Les listes déroulantes affichent uniquement les éléments autorisés pour votre profil. Par exemple, les gestionnaires de projet ou de groupe ne voient que leur périmètre dans certaines créations.',
        ],
      },
      {
        title: 'Tableaux',
        content: [
          'Les tableaux présentent les listes de données : risques, projets, actions, groupes, indicateurs, utilisateurs ou éléments de suivi.',
          'Ils peuvent proposer un moteur de recherche, des filtres, un tri par colonne, une pagination et parfois des actions contextuelles comme consulter, modifier, supprimer ou exporter.',
          'Le contenu d’un tableau dépend toujours des habilitations de l’utilisateur connecté et des filtres actifs à l’écran.',
        ],
      },
      {
        title: 'Boutons et actions usuelles',
        content: [
          'Créer : ouvre un formulaire d’ajout d’un nouvel élément lorsque l’utilisateur en a le droit.',
          'Modifier : ouvre le formulaire de mise à jour d’un élément existant ; en lecture seule, cette action peut être masquée ou le formulaire rendu non modifiable.',
          'Consulter : affiche le détail d’un élément sans nécessairement permettre sa modification.',
          'Supprimer : retire un élément selon les règles prévues par le module et les autorisations disponibles.',
          'Exporter : génère une sortie de données lorsque cette fonctionnalité est proposée sur l’écran.',
          'Filtres et recherche : restreignent temporairement l’affichage pour faciliter l’analyse.',
        ],
      },
      {
        title: 'Bonnes pratiques utilisateur',
        content: [
          'Vérifiez toujours la rubrique et la sous-rubrique dans lesquelles vous vous trouvez avant de saisir ou modifier des données.',
          'Contrôlez les filtres actifs lorsque vous ne retrouvez pas un élément attendu dans un tableau ou un graphique.',
          'Utilisez la présente rubrique Aide comme référence fonctionnelle dès qu’un champ, un bouton ou une vue vous semble ambigu.',
        ],
      },
    ],
  },
]

const quickCards = [
  {
    icon: Eye,
    title: 'Lecture seule',
    text: 'Un écran en lecture seule permet de consulter les données sans les modifier. Les champs sont visibles mais verrouillés.',
  },
  {
    icon: Lock,
    title: 'Habilitations',
    text: 'L’accès dépend du rôle de l’utilisateur, de sa structure, de ses responsabilités et de son périmètre de gestion.',
  },
  {
    icon: Filter,
    title: 'Filtres métier',
    text: 'Les tableaux, chiffres clés et graphiques sont calculés à partir des données autorisées pour le profil connecté.',
  },
  {
    icon: SquareMousePointer,
    title: 'Actions écran',
    text: 'Les boutons Créer, Modifier, Supprimer, Exporter et les formulaires n’apparaissent que si le droit correspondant est disponible.',
  },
]

export default function AidePage() {
  const [query, setQuery] = useState('')

  const normalizedQuery = query.trim().toLowerCase()

  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return sections

    return sections
      .map((section) => {
        const inTitle = section.title.toLowerCase().includes(normalizedQuery)
        const inSummary = section.summary.toLowerCase().includes(normalizedQuery)
        const filteredBlocks = section.blocks.filter((block) => {
          const haystack = `${block.title} ${block.content.join(' ')}`.toLowerCase()
          return haystack.includes(normalizedQuery)
        })

        if (inTitle || inSummary) return section
        if (filteredBlocks.length > 0) return { ...section, blocks: filteredBlocks }
        return null
      })
      .filter(Boolean)
  }, [normalizedQuery])

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#1a365d] via-[#234876] to-[#2c5282] px-6 py-8 lg:px-8 lg:py-10 text-white">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-sm font-medium mb-4">
                  <HelpCircle size={16} />
                  Centre d’aide GIRAS
                </div>
                <h1 className="text-2xl lg:text-4xl font-extrabold tracking-tight">Guide complet d’utilisation de la plateforme</h1>
                <p className="mt-3 text-blue-100 text-sm lg:text-base leading-7 max-w-3xl">
                  Cette rubrique documente le fonctionnement de chaque module, sous-rubrique, formulaire, tableau, bouton et fonctionnalité afin de faciliter la prise en main de la plateforme par tous les utilisateurs.
                </p>
              </div>

              <div className="w-full lg:w-[360px]">
                <label className="block text-xs uppercase tracking-[0.2em] text-blue-100/80 mb-2">
                  Rechercher dans l’aide
                </label>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ex. lecture seule, projet, synthèse, indicateurs"
                    className="w-full rounded-2xl border border-white/20 bg-white px-10 py-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-white/50"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 lg:px-8 border-b border-slate-100 bg-slate-50/70">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {quickCards.map((card) => {
                const Icon = card.icon
                return (
                  <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-[#1a365d]/10 text-[#1a365d] flex items-center justify-center mb-3">
                      <Icon size={18} />
                    </div>
                    <h2 className="text-sm font-semibold text-slate-900">{card.title}</h2>
                    <p className="mt-2 text-sm text-slate-600 leading-6">{card.text}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-0">
            <aside className="lg:border-r border-slate-200 bg-white lg:sticky lg:top-6 self-start max-h-[calc(100vh-160px)] overflow-auto">
              <div className="p-5">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-4">Sommaire</h2>
                <nav className="space-y-2">
                  {visibleSections.map((section) => {
                    const Icon = section.icon
                    return (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        className="group flex items-start gap-3 rounded-2xl border border-transparent px-3 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-200 transition-all"
                      >
                        <div className="mt-0.5 w-9 h-9 rounded-xl bg-[#1a365d]/10 text-[#1a365d] flex items-center justify-center shrink-0">
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 group-hover:text-[#1a365d]">{section.title}</div>
                          <div className="text-xs text-slate-500 leading-5 mt-1">{section.summary}</div>
                        </div>
                      </a>
                    )
                  })}
                </nav>
              </div>
            </aside>

            <section className="bg-white p-6 lg:p-8">
              <div className="space-y-8">
                {visibleSections.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <CheckCircle2 size={28} className="mx-auto text-slate-400" />
                    <h2 className="mt-4 text-lg font-semibold text-slate-900">Aucun résultat</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Aucun élément de l’aide ne correspond à votre recherche. Essayez un mot-clé plus large.
                    </p>
                  </div>
                )}

                {visibleSections.map((section) => {
                  const Icon = section.icon
                  return (
                    <article key={section.id} id={section.id} className="scroll-mt-32 rounded-3xl border border-slate-200 bg-slate-50/50 p-5 lg:p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#1a365d] text-white flex items-center justify-center shadow-sm shrink-0">
                          <Icon size={22} />
                        </div>
                        <div>
                          <h2 className="text-xl lg:text-2xl font-bold text-slate-900">{section.title}</h2>
                          <p className="mt-2 text-sm lg:text-base text-slate-600 leading-7 max-w-4xl">{section.summary}</p>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-1 gap-4">
                        {section.blocks.map((block) => (
                          <div key={block.title} className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-[#1a365d]">
                              <ChevronRight size={18} />
                              <h3 className="text-base lg:text-lg font-semibold text-slate-900">{block.title}</h3>
                            </div>
                            <div className="mt-3 space-y-3">
                              {block.content.map((paragraph, index) => (
                                <p key={`${block.title}-${index}`} className="text-sm lg:text-[15px] text-slate-700 leading-7">
                                  {paragraph}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="mt-8 rounded-3xl border border-[#1a365d]/10 bg-gradient-to-r from-[#1a365d]/5 to-blue-50 p-6">
                <div className="flex items-start gap-3">
                  <Download className="text-[#1a365d] mt-1" size={20} />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Conseil d’utilisation</h2>
                    <p className="mt-2 text-sm text-slate-700 leading-7">
                      Utilisez cette rubrique comme référence fonctionnelle avant toute formation, recette ou prise en main métier. Elle explique le sens des écrans, les droits d’accès, les composants visibles et le comportement attendu de la plateforme.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
