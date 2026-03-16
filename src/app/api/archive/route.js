import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

const tableMap = {
  groupe_actions: 'groupe_actions',
  projet: 'groupe_actions',
  action: 'actions',
  action_occurrence: 'action_occurrences',
  suivi_action: 'action_occurrences',
  groupe_indicateurs: 'groupe_indicateurs',
  indicateur: 'indicateurs',
  indicateur_occurrence: 'indicateur_occurrences',
  suivi_indicateur: 'indicateur_occurrences'
}

const buildArchivePayload = (archivePar, extra = {}) => ({
  archive: true,
  date_archive: new Date().toISOString(),
  archive_par: archivePar || null,
  ...extra
})

const buildUnarchivePayload = (modificateur) => ({
  archive: false,
  date_archive: null,
  archive_par: null,
  modificateur: modificateur || null,
  date_modification: new Date().toISOString()
})

const isRiskIndicatorRecord = (indicateur) => {
  const groupes = Array.isArray(indicateur?.groupes) ? indicateur.groupes : []
  return indicateur?.code_groupe === 'Risque' || indicateur?.code_groupe === 'RISQUE' || groupes.includes('Risque') || groupes.includes('RISQUE')
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { type, id, archive_par } = body

    if (!type || !id) {
      return NextResponse.json({ error: 'Type et ID requis' }, { status: 400 })
    }

    const table = tableMap[type]
    if (!table) {
      return NextResponse.json({ error: 'Type non reconnu' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const archivePayload = buildArchivePayload(archive_par)

    if (type === 'projet' || type === 'groupe_actions') {
      const { data: projet, error: projetError } = await supabase
        .from('groupe_actions')
        .select('id, code_groupe, libelle_groupe')
        .eq('id', id)
        .single()

      if (projetError || !projet) {
        return NextResponse.json({ error: projetError?.message || 'Projet introuvable' }, { status: 404 })
      }

      const { data: projetActions, error: actionsError } = await supabase
        .from('actions')
        .select('id, code_action')
        .eq('code_groupe', projet.code_groupe)

      if (actionsError) {
        return NextResponse.json({ error: actionsError.message }, { status: 500 })
      }

      const actionIds = (projetActions || []).map((a) => a.id).filter(Boolean)
      const actionCodes = (projetActions || []).map((a) => a.code_action).filter(Boolean)

      if (actionCodes.length > 0) {
        const { error: occError } = await supabase
          .from('action_occurrences')
          .update(buildArchivePayload(archive_par, { statut: 'Inactif' }))
          .in('code_action', actionCodes)
          .or('archive.is.null,archive.eq.false')

        if (occError) {
          return NextResponse.json({ error: occError.message }, { status: 500 })
        }
      }

      if (actionIds.length > 0) {
        const { error: cascadeActionError } = await supabase
          .from('actions')
          .update(buildArchivePayload(archive_par, { statut_act: 'Inactif' }))
          .in('id', actionIds)
          .or('archive.is.null,archive.eq.false')

        if (cascadeActionError) {
          return NextResponse.json({ error: cascadeActionError.message }, { status: 500 })
        }
      }

      const { error: projetArchiveError } = await supabase
        .from('groupe_actions')
        .update(buildArchivePayload(archive_par, { statut: 'Inactif' }))
        .eq('id', id)

      if (projetArchiveError) {
        return NextResponse.json({ error: 'Erreur lors de l\'archivage: ' + projetArchiveError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Projet, actions et occurrences archivés avec succès',
        cascaded: {
          actions: actionIds.length,
          occurrences: actionCodes.length
        }
      })
    }

    if (type === 'action') {
      const { data: action, error: actionError } = await supabase
        .from('actions')
        .select('id, code_action, libelle_action')
        .eq('id', id)
        .single()

      if (actionError || !action) {
        return NextResponse.json({ error: actionError?.message || 'Action introuvable' }, { status: 404 })
      }

      const { error: occError } = await supabase
        .from('action_occurrences')
        .update(buildArchivePayload(archive_par, { statut: 'Inactif' }))
        .eq('code_action', action.code_action)
        .or('archive.is.null,archive.eq.false')

      if (occError) {
        return NextResponse.json({ error: occError.message }, { status: 500 })
      }

      const { error } = await supabase
        .from('actions')
        .update(buildArchivePayload(archive_par, { statut_act: 'Inactif' }))
        .eq('id', id)

      if (error) {
        return NextResponse.json({ error: 'Erreur lors de l\'archivage: ' + error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Action et occurrences archivées avec succès' })
    }

    if (type === 'groupe_indicateurs') {
      const { data: groupe, error: groupeError } = await supabase
        .from('groupe_indicateurs')
        .select('id, code_groupe, libelle_groupe')
        .eq('id', id)
        .single()

      if (groupeError || !groupe) {
        return NextResponse.json({ error: groupeError?.message || 'Groupe introuvable' }, { status: 404 })
      }

      const { data: allIndicateurs, error: indicateursError } = await supabase
        .from('indicateurs')
        .select('id, code_indicateur, code_groupe, groupes')

      if (indicateursError) {
        return NextResponse.json({ error: indicateursError.message }, { status: 500 })
      }

      const normalizeGroupes = (value) => {
        if (Array.isArray(value)) return value.filter(Boolean)
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value)
            if (Array.isArray(parsed)) return parsed.filter(Boolean)
          } catch (_) {}
          return value.split(',').map((item) => item.trim()).filter(Boolean)
        }
        return []
      }

      const linkedIndicateurs = (allIndicateurs || []).filter((ind) => {
        const groupes = normalizeGroupes(ind.groupes)
        return ind.code_groupe === groupe.code_groupe || groupes.includes(groupe.code_groupe)
      })

      const indicateurIds = linkedIndicateurs.map((ind) => ind.id).filter(Boolean)
      const indicateurCodes = linkedIndicateurs.map((ind) => ind.code_indicateur).filter(Boolean)

      if (indicateurCodes.length > 0) {
        const { error: occError } = await supabase
          .from('indicateur_occurrences')
          .update(buildArchivePayload(archive_par))
          .in('code_indicateur', indicateurCodes)
          .or('archive.is.null,archive.eq.false')

        if (occError) {
          return NextResponse.json({ error: 'Erreur lors de l\'archivage des occurrences: ' + occError.message }, { status: 500 })
        }
      }

      if (indicateurIds.length > 0) {
        const { error: indError } = await supabase
          .from('indicateurs')
          .update(buildArchivePayload(archive_par, { statut: 'Inactif' }))
          .in('id', indicateurIds)
          .or('archive.is.null,archive.eq.false')

        if (indError) {
          return NextResponse.json({ error: 'Erreur lors de l\'archivage des indicateurs: ' + indError.message }, { status: 500 })
        }
      }

      const { error: groupeArchiveError } = await supabase
        .from('groupe_indicateurs')
        .update(buildArchivePayload(archive_par, { statut: 'Inactif' }))
        .eq('id', id)

      if (groupeArchiveError) {
        return NextResponse.json({ error: 'Erreur lors de l\'archivage du groupe: ' + groupeArchiveError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Groupe, indicateurs et occurrences archivés avec succès',
        cascaded: {
          indicateurs: indicateurIds.length,
          occurrences: indicateurCodes.length,
        }
      })
    }

    if (type === 'indicateur') {
      const { data: indicateur, error: indicateurReadError } = await supabase
        .from('indicateurs')
        .select('id, code_indicateur, libelle_indicateur, code_groupe, groupes')
        .eq('id', id)
        .single()

      if (indicateurReadError || !indicateur) {
        return NextResponse.json({ error: indicateurReadError?.message || 'Indicateur introuvable' }, { status: 404 })
      }

      const { error: occError } = await supabase
        .from('indicateur_occurrences')
        .update(buildArchivePayload(archive_par))
        .eq('code_indicateur', indicateur.code_indicateur)
        .or('archive.is.null,archive.eq.false')

      if (occError) {
        return NextResponse.json({ error: 'Erreur lors de l\'archivage des occurrences: ' + occError.message }, { status: 500 })
      }

      const { error: indError } = await supabase
        .from('indicateurs')
        .update(buildArchivePayload(archive_par, { statut: 'Inactif' }))
        .eq('id', id)

      if (indError) {
        return NextResponse.json({ error: 'Erreur lors de l\'archivage de l\'indicateur: ' + indError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Indicateur et occurrences archivés avec succès' })
    }

    if (type === 'suivi_indicateur' || type === 'indicateur_occurrence') {
      const { data: occurrence, error: occReadError } = await supabase
        .from('indicateur_occurrences')
        .select('id, code_indicateur')
        .eq('id', id)
        .single()

      if (occReadError || !occurrence) {
        return NextResponse.json({ error: occReadError?.message || 'Occurrence introuvable' }, { status: 404 })
      }

      const { data: linkedIndicateur } = await supabase
        .from('indicateurs')
        .select('id, code_groupe, groupes')
        .eq('code_indicateur', occurrence.code_indicateur)
        .maybeSingle()

      if (isRiskIndicatorRecord(linkedIndicateur)) {
        return NextResponse.json({ error: "Les occurrences d'indicateurs de risque ne peuvent être archivées qu'à la fermeture d'une période d'évaluation des risques" }, { status: 400 })
      }
    }

    const extraArchiveFields = (type === 'suivi_action' || type === 'action_occurrence')
      ? { statut: 'Inactif' }
      : {}
    const { error } = await supabase
      .from(table)
      .update(buildArchivePayload(archive_par, extraArchiveFields))
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Erreur lors de l\'archivage: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Élément archivé avec succès' })
  } catch (error) {
    console.error('Erreur archivage:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (!type) {
      return NextResponse.json({ error: 'Type requis' }, { status: 400 })
    }

    const table = tableMap[type]
    if (!table) {
      return NextResponse.json({ error: 'Type non reconnu' }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (type === 'suivi_action' || type === 'action_occurrence') {
      const { data, error } = await supabase
        .from('action_occurrences')
        .select('*')
        .eq('archive', true)
        .order('date_archive', { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const actionCodes = [...new Set((data || []).map((o) => o.code_action).filter(Boolean))]
      let actionsByCode = {}
      if (actionCodes.length > 0) {
        const { data: linkedActions, error: actionsError } = await supabase
          .from('actions')
          .select('code_action, libelle_action, code_groupe, code_structure, statut_act')
          .in('code_action', actionCodes)
        if (actionsError) {
          return NextResponse.json({ error: actionsError.message }, { status: 500 })
        }
        actionsByCode = Object.fromEntries((linkedActions || []).map((a) => [a.code_action, a]))
      }

      return NextResponse.json((data || []).map((o) => ({
        ...o,
        statut: o.statut || 'Inactif',
        action: actionsByCode[o.code_action] || null,
        libelle_action: actionsByCode[o.code_action]?.libelle_action || null,
        code_groupe: actionsByCode[o.code_action]?.code_groupe || null,
        code_structure: actionsByCode[o.code_action]?.code_structure || null,
        statut_act: actionsByCode[o.code_action]?.statut_act || null
      })))
    }

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('archive', true)
      .order('date_archive', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (type === 'suivi_indicateur' || type === 'indicateur_occurrence') {
      const indicatorCodes = [...new Set((data || []).map((o) => o.code_indicateur).filter(Boolean))]
      let indicatorsByCode = {}
      if (indicatorCodes.length > 0) {
        const { data: linkedIndicateurs, error: indicatorsError } = await supabase
          .from('indicateurs')
          .select('code_indicateur, libelle_indicateur, code_groupe, groupes, code_structure, responsable, periodicite, type_indicateur, sens, statut')
          .in('code_indicateur', indicatorCodes)

        if (indicatorsError) {
          return NextResponse.json({ error: indicatorsError.message }, { status: 500 })
        }

        indicatorsByCode = Object.fromEntries((linkedIndicateurs || []).map((ind) => [ind.code_indicateur, ind]))
      }

      return NextResponse.json((data || []).map((o) => {
        const indicateur = indicatorsByCode[o.code_indicateur] || null
        return {
          ...o,
          indicateur,
          libelle_indicateur: indicateur?.libelle_indicateur || o.libelle_indicateur || null,
          code_groupe: indicateur?.code_groupe || null,
          groupes: indicateur?.groupes || null,
          code_structure: indicateur?.code_structure || null,
          responsable: indicateur?.responsable || null,
          periodicite: indicateur?.periodicite || null,
          type_indicateur: indicateur?.type_indicateur || null,
          sens: indicateur?.sens || null,
          indicateur_statut: indicateur?.statut || null,
        }
      }))
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erreur récupération archives:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const body = await request.json()
    const { type, id, modificateur } = body

    if (!type || !id) {
      return NextResponse.json({ error: 'Type et ID requis' }, { status: 400 })
    }

    const table = tableMap[type]
    if (!table) {
      return NextResponse.json({ error: 'Type non reconnu' }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (type === 'projet' || type === 'groupe_actions') {
      const { data: projet, error: projetError } = await supabase
        .from('groupe_actions')
        .select('id, code_groupe')
        .eq('id', id)
        .single()

      if (projetError || !projet) {
        return NextResponse.json({ error: projetError?.message || 'Projet introuvable' }, { status: 404 })
      }

      const { data: projetActions, error: actionsError } = await supabase
        .from('actions')
        .select('id, code_action')
        .eq('code_groupe', projet.code_groupe)

      if (actionsError) {
        return NextResponse.json({ error: actionsError.message }, { status: 500 })
      }

      const actionIds = (projetActions || []).map((a) => a.id).filter(Boolean)
      const actionCodes = (projetActions || []).map((a) => a.code_action).filter(Boolean)

      if (actionCodes.length > 0) {
        const { error: occError } = await supabase
          .from('action_occurrences')
          .update({ ...buildUnarchivePayload(modificateur), statut: 'Actif' })
          .in('code_action', actionCodes)
          .eq('archive', true)

        if (occError) {
          return NextResponse.json({ error: 'Erreur lors du désarchivage des occurrences: ' + occError.message }, { status: 500 })
        }
      }

      if (actionIds.length > 0) {
        const { error: actionError } = await supabase
          .from('actions')
          .update({ ...buildUnarchivePayload(modificateur), statut_act: 'Actif' })
          .in('id', actionIds)
          .eq('archive', true)

        if (actionError) {
          return NextResponse.json({ error: 'Erreur lors du désarchivage des actions: ' + actionError.message }, { status: 500 })
        }
      }

      const { error: projetError2 } = await supabase
        .from('groupe_actions')
        .update({ ...buildUnarchivePayload(modificateur), statut: 'Actif' })
        .eq('id', id)

      if (projetError2) {
        return NextResponse.json({ error: 'Erreur lors du désarchivage du projet: ' + projetError2.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Projet, actions et occurrences désarchivés avec succès' })
    }

    if (type === 'action') {
      const { data: action, error: actionReadError } = await supabase
        .from('actions')
        .select('id, code_action')
        .eq('id', id)
        .single()

      if (actionReadError || !action) {
        return NextResponse.json({ error: actionReadError?.message || 'Action introuvable' }, { status: 404 })
      }

      const { error: occError } = await supabase
        .from('action_occurrences')
        .update({ ...buildUnarchivePayload(modificateur), statut: 'Actif' })
        .eq('code_action', action.code_action)
        .eq('archive', true)

      if (occError) {
        return NextResponse.json({ error: 'Erreur lors du désarchivage des occurrences: ' + occError.message }, { status: 500 })
      }

      const { error: actionError } = await supabase
        .from('actions')
        .update({ ...buildUnarchivePayload(modificateur), statut_act: 'Actif' })
        .eq('id', id)

      if (actionError) {
        return NextResponse.json({ error: "Erreur lors du désarchivage de l'action: " + actionError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Action et occurrences désarchivées avec succès' })
    }

    const extraFields = (type === 'suivi_action' || type === 'action_occurrence')
      ? { statut: 'Actif' }
      : (type === 'groupe_indicateurs' ? { statut: 'Actif' } : (type === 'indicateur' ? { statut: 'Actif' } : {}))
    const { error } = await supabase
      .from(table)
      .update({ ...buildUnarchivePayload(modificateur), ...extraFields })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Erreur lors du désarchivage: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Élément désarchivé avec succès' })
  } catch (error) {
    console.error('Erreur désarchivage:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json()
    const { type, id } = body

    if (!type || !id) {
      return NextResponse.json({ error: 'Type et ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (type === 'projet' || type === 'groupe_actions') {
      const { data: projet, error: projetError } = await supabase
        .from('groupe_actions')
        .select('id, code_groupe')
        .eq('id', id)
        .single()

      if (projetError || !projet) {
        return NextResponse.json({ error: projetError?.message || 'Projet introuvable' }, { status: 404 })
      }

      const { data: projetActions, error: actionsError } = await supabase
        .from('actions')
        .select('id, code_action')
        .eq('code_groupe', projet.code_groupe)

      if (actionsError) {
        return NextResponse.json({ error: actionsError.message }, { status: 500 })
      }

      const actionIds = (projetActions || []).map((a) => a.id).filter(Boolean)
      const actionCodes = (projetActions || []).map((a) => a.code_action).filter(Boolean)

      if (actionCodes.length > 0) {
        const { data: occs, error: occsError } = await supabase
          .from('action_occurrences')
          .select('code_occurrence')
          .in('code_action', actionCodes)
        if (occsError) return NextResponse.json({ error: occsError.message }, { status: 500 })
        const occCodes = (occs || []).map((o) => o.code_occurrence).filter((v) => v !== null && v !== undefined)
        if (occCodes.length > 0) {
          const { error: tachesError } = await supabase.from('taches').delete().in('code_occurrence', occCodes)
          if (tachesError) return NextResponse.json({ error: tachesError.message }, { status: 500 })
        }
        const { error: occDeleteError } = await supabase.from('action_occurrences').delete().in('code_action', actionCodes)
        if (occDeleteError) return NextResponse.json({ error: occDeleteError.message }, { status: 500 })
      }

      if (actionIds.length > 0) {
        const { error: actionDeleteError } = await supabase.from('actions').delete().in('id', actionIds)
        if (actionDeleteError) return NextResponse.json({ error: actionDeleteError.message }, { status: 500 })
      }

      const { error: projetDeleteError } = await supabase.from('groupe_actions').delete().eq('id', id)
      if (projetDeleteError) return NextResponse.json({ error: projetDeleteError.message }, { status: 500 })

      return NextResponse.json({ success: true, message: 'Projet archivé supprimé définitivement avec ses actions et occurrences' })
    }

    if (type === 'action') {
      const { data: action, error: actionError } = await supabase
        .from('actions')
        .select('id, code_action')
        .eq('id', id)
        .single()

      if (actionError || !action) {
        return NextResponse.json({ error: actionError?.message || 'Action introuvable' }, { status: 404 })
      }

      const { data: occs, error: occsError } = await supabase
        .from('action_occurrences')
        .select('code_occurrence')
        .eq('code_action', action.code_action)
      if (occsError) return NextResponse.json({ error: occsError.message }, { status: 500 })

      const occCodes = (occs || []).map((o) => o.code_occurrence).filter((v) => v !== null && v !== undefined)
      if (occCodes.length > 0) {
        const { error: tachesError } = await supabase.from('taches').delete().in('code_occurrence', occCodes)
        if (tachesError) return NextResponse.json({ error: tachesError.message }, { status: 500 })
      }

      const { error: occDeleteError } = await supabase.from('action_occurrences').delete().eq('code_action', action.code_action)
      if (occDeleteError) return NextResponse.json({ error: occDeleteError.message }, { status: 500 })

      const { error: actionDeleteError } = await supabase.from('actions').delete().eq('id', id)
      if (actionDeleteError) return NextResponse.json({ error: actionDeleteError.message }, { status: 500 })

      return NextResponse.json({ success: true, message: 'Action archivée supprimée définitivement avec ses occurrences' })
    }

    if (type === 'suivi_action' || type === 'action_occurrence') {
      const { data: occ, error: occError } = await supabase
        .from('action_occurrences')
        .select('code_occurrence')
        .eq('id', id)
        .single()

      if (occError || !occ) {
        return NextResponse.json({ error: occError?.message || 'Occurrence introuvable' }, { status: 404 })
      }

      if (occ.code_occurrence !== null && occ.code_occurrence !== undefined) {
        const { error: tachesError } = await supabase.from('taches').delete().eq('code_occurrence', occ.code_occurrence)
        if (tachesError) return NextResponse.json({ error: tachesError.message }, { status: 500 })
      }

      const { error: deleteError } = await supabase.from('action_occurrences').delete().eq('id', id)
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

      return NextResponse.json({ success: true, message: 'Occurrence archivée supprimée définitivement' })
    }

    if (type === 'groupe_indicateurs') {
      const { data: groupe, error: groupeError } = await supabase
        .from('groupe_indicateurs')
        .select('id, code_groupe, libelle_groupe')
        .eq('id', id)
        .single()

      if (groupeError || !groupe) {
        return NextResponse.json({ error: groupeError?.message || 'Groupe introuvable' }, { status: 404 })
      }

      const { data: allIndicateurs, error: indicateursError } = await supabase
        .from('indicateurs')
        .select('id, code_indicateur, code_groupe, groupes')

      if (indicateursError) {
        return NextResponse.json({ error: indicateursError.message }, { status: 500 })
      }

      const normalizeGroupes = (value) => {
        if (Array.isArray(value)) return value.filter(Boolean)
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value)
            if (Array.isArray(parsed)) return parsed.filter(Boolean)
          } catch (_) {}
          return value.split(',').map((item) => item.trim()).filter(Boolean)
        }
        return []
      }

      const linkedIndicateurs = (allIndicateurs || []).filter((ind) => {
        const groupes = normalizeGroupes(ind.groupes)
        return ind.code_groupe === groupe.code_groupe || groupes.includes(groupe.code_groupe)
      })

      const indicateurIds = linkedIndicateurs.map((ind) => ind.id).filter(Boolean)
      const indicateurCodes = linkedIndicateurs.map((ind) => ind.code_indicateur).filter(Boolean)

      if (indicateurCodes.length > 0) {
        const { error: occDeleteError } = await supabase
          .from('indicateur_occurrences')
          .delete()
          .in('code_indicateur', indicateurCodes)
        if (occDeleteError) return NextResponse.json({ error: occDeleteError.message }, { status: 500 })

        const { error: risquesProbError } = await supabase
          .from('risques_probabilites')
          .delete()
          .in('code_indicateur', indicateurCodes)
        if (risquesProbError && !/column .* does not exist/i.test(risquesProbError.message || '')) {
          return NextResponse.json({ error: risquesProbError.message }, { status: 500 })
        }
      }

      if (indicateurIds.length > 0) {
        const { error: indDeleteError } = await supabase
          .from('indicateurs')
          .delete()
          .in('id', indicateurIds)
        if (indDeleteError) return NextResponse.json({ error: indDeleteError.message }, { status: 500 })
      }

      const { error: groupeDeleteError } = await supabase.from('groupe_indicateurs').delete().eq('id', id)
      if (groupeDeleteError) return NextResponse.json({ error: groupeDeleteError.message }, { status: 500 })

      return NextResponse.json({ success: true, message: 'Groupe archivé supprimé définitivement avec ses indicateurs et occurrences' })
    }

    if (type === 'indicateur') {
      const { data: indicateur, error: indicateurError } = await supabase
        .from('indicateurs')
        .select('id, code_indicateur, libelle_indicateur')
        .eq('id', id)
        .single()

      if (indicateurError || !indicateur) {
        return NextResponse.json({ error: indicateurError?.message || 'Indicateur introuvable' }, { status: 404 })
      }

      const { error: occDeleteError } = await supabase
        .from('indicateur_occurrences')
        .delete()
        .eq('code_indicateur', indicateur.code_indicateur)
      if (occDeleteError) return NextResponse.json({ error: occDeleteError.message }, { status: 500 })

      const { error: risquesProbError } = await supabase
        .from('risques_probabilites')
        .delete()
        .eq('code_indicateur', indicateur.code_indicateur)
      if (risquesProbError && !/column .* does not exist/i.test(risquesProbError.message || '')) {
        return NextResponse.json({ error: risquesProbError.message }, { status: 500 })
      }

      const { error: indDeleteError } = await supabase.from('indicateurs').delete().eq('id', id)
      if (indDeleteError) return NextResponse.json({ error: indDeleteError.message }, { status: 500 })

      return NextResponse.json({ success: true, message: 'Indicateur archivé supprimé définitivement avec ses occurrences' })
    }

    const table = tableMap[type]
    if (!table) {
      return NextResponse.json({ error: 'Type non reconnu' }, { status: 400 })
    }

    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, message: 'Élément archivé supprimé définitivement' })
  } catch (error) {
    console.error('Erreur suppression archive:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
