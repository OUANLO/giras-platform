import { getAuthenticatedUserFromRequest } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { duplicateLabelError, findDuplicateByNormalizedLabel } from '@/lib/label-normalization'

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try { return JSON.parse(value || '[]') } catch { return [] }
  }
  return []
}

const canManageProject = (actor, projet) => {
  if (!actor || !projet) return false
  if (actor.type_utilisateur === 'Super admin') return true
  const gestionnaires = parseJsonArray(projet.gestionnaires)
  return gestionnaires.includes(actor.username)
}


// GET - Récupérer les groupes d'actions (projets)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const gestionnaire = searchParams.get('gestionnaire')
    const statut = searchParams.get('statut')

    const supabase = createAdminClient(request)
    
    let query = supabase
      .from('groupe_actions')
      .select('*')
      .order('date_creation', { ascending: false })

    if (statut) {
      query = query.eq('statut', statut)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erreur GET groupe_actions:', error)
      return NextResponse.json({ groupes: [], message: error.message })
    }

    // Filtrer par gestionnaire si spécifié
    let result = data || []
    if (gestionnaire) {
      result = result.filter(g => {
        const gestionnaires = Array.isArray(g.gestionnaires) ? g.gestionnaires : 
          (typeof g.gestionnaires === 'string' ? JSON.parse(g.gestionnaires || '[]') : [])
        return gestionnaires.includes(gestionnaire)
      })
    }

    return NextResponse.json({ groupes: result })
  } catch (error) {
    console.error('Erreur GET groupes_actions:', error)
    return NextResponse.json({ groupes: [], error: error.message }, { status: 500 })
  }
}

// POST - Créer un groupe d'actions (projet)
export async function POST(request) {
  try {
    const actor = getAuthenticatedUserFromRequest(request)
    const body = await request.json()
    const supabase = createAdminClient(request)

    if (!actor || (actor.type_utilisateur !== 'Super admin' && actor.peut_creer_projets !== 'Oui')) {
      return NextResponse.json({ error: 'Création de projet non autorisée' }, { status: 403 })
    }

    // Validation du code (obligatoire)
    if (!body.code_groupe) {
      return NextResponse.json({ error: 'Code du projet obligatoire' }, { status: 400 })
    }
    
    // Validation format du code
    const code = body.code_groupe.trim()
    if (code.length > 20) {
      return NextResponse.json({ error: 'Le code ne doit pas dépasser 20 caractères' }, { status: 400 })
    }
    if (/\s/.test(code)) {
      return NextResponse.json({ error: 'Le code ne doit pas contenir d\'espaces' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      return NextResponse.json({ error: 'Le code ne doit contenir que des lettres, chiffres, tirets ou underscores' }, { status: 400 })
    }

    if (!body.libelle_groupe) {
      return NextResponse.json({ error: 'Libellé du projet requis' }, { status: 400 })
    }

    if (!body.gestionnaires || body.gestionnaires.length === 0) {
      return NextResponse.json({ error: 'Au moins un gestionnaire requis' }, { status: 400 })
    }

    // Vérifier que le code n'existe pas déjà
    const { data: existingCode } = await supabase
      .from('groupe_actions')
      .select('id')
      .eq('code_groupe', code)
      .maybeSingle()
    
    if (existingCode) {
      return NextResponse.json({ error: `Le code projet "${code}" existe déjà` }, { status: 400 })
    }

    // Vérifier l'unicité du libellé en ignorant espaces, ponctuation, caractères spéciaux et accents
    const { data: existingProjectLabels, error: labelCheckError } = await supabase
      .from('groupe_actions')
      .select('id, libelle_groupe')

    if (labelCheckError) {
      return NextResponse.json({ error: labelCheckError.message }, { status: 500 })
    }

    const duplicateProject = findDuplicateByNormalizedLabel(existingProjectLabels, 'libelle_groupe', body.libelle_groupe)
    if (duplicateProject) {
      return NextResponse.json({ error: duplicateLabelError('de projet', duplicateProject.libelle_groupe) }, { status: 400 })
    }


    // Les gestionnaires sont automatiquement membres
    const membres = body.membres || []
    const gestionnaires = body.gestionnaires || []
    const allMembres = [...new Set([...membres, ...gestionnaires])]

    // Préparer les données d'insertion (champs de base)
    const insertData = {
      code_groupe: code,
      libelle_groupe: body.libelle_groupe,
      commentaire: body.commentaire || null,
      gestionnaires: JSON.stringify(gestionnaires),
      membres: JSON.stringify(allMembres),
      type_projet: body.type_projet || 'Public',
      statut: body.statut || 'Actif'
    }
    
    // Ajouter createur si fourni
    if (body.createur) {
      insertData.createur = body.createur
    }

    console.log('Insertion projet avec données:', insertData)

    const { data, error } = await supabase
      .from('groupe_actions')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Erreur création projet:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ groupe: data, message: 'Projet créé' })
  } catch (error) {
    console.error('Erreur POST groupe_actions:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Modifier un groupe d'actions (projet)
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient(request)

    // Permettre la mise à jour par id OU par code_groupe
    if (!body.id && !body.code_groupe) {
      return NextResponse.json({ error: 'ID ou code_groupe requis' }, { status: 400 })
    }

    // Récupérer le projet existant
    let existingQuery = supabase.from('groupe_actions').select('*')
    if (body.id) {
      existingQuery = existingQuery.eq('id', body.id)
    } else {
      existingQuery = existingQuery.eq('code_groupe', body.code_groupe)
    }
    const { data: existingProjet } = await existingQuery.maybeSingle()

    // Si le projet n'existe pas et qu'on a un code_groupe, le créer
    if (!existingProjet && body.code_groupe) {
      const candidateLabel = body.libelle_groupe || body.code_groupe
      const { data: existingProjectLabels, error: labelCheckError } = await supabase
        .from('groupe_actions')
        .select('id, libelle_groupe')
      if (labelCheckError) {
        return NextResponse.json({ error: labelCheckError.message }, { status: 500 })
      }
      const duplicateProject = findDuplicateByNormalizedLabel(existingProjectLabels, 'libelle_groupe', candidateLabel)
      if (duplicateProject) {
        return NextResponse.json({ error: duplicateLabelError('de projet', duplicateProject.libelle_groupe) }, { status: 400 })
      }

      const insertData = {
        code_groupe: body.code_groupe,
        libelle_groupe: candidateLabel,
        gestionnaires: JSON.stringify(body.gestionnaires || []),
        membres: JSON.stringify(body.gestionnaires || []),
        type_projet: body.type_projet || 'Public',
        statut: body.statut || 'Actif',
        createur: body.modificateur
      }
      
      const { data: newData, error: insertError } = await supabase
        .from('groupe_actions')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        console.error('Erreur création projet:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ groupe: newData, message: 'Projet créé avec succès' })
    }

    if (!existingProjet) {
      return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })
    }

    const actor = getAuthenticatedUserFromRequest(request)
    if (!canManageProject(actor, existingProjet)) {
      return NextResponse.json({ error: 'Seuls les gestionnaires du projet ou le Super Admin peuvent modifier ce projet' }, { status: 403 })
    }

    if (body.libelle_groupe !== undefined) {
      const { data: existingProjectLabels, error: labelCheckError } = await supabase
        .from('groupe_actions')
        .select('id, libelle_groupe')
      if (labelCheckError) {
        return NextResponse.json({ error: labelCheckError.message }, { status: 500 })
      }
      const duplicateProject = findDuplicateByNormalizedLabel(existingProjectLabels, 'libelle_groupe', body.libelle_groupe, existingProjet.id)
      if (duplicateProject) {
        return NextResponse.json({ error: duplicateLabelError('de projet', duplicateProject.libelle_groupe) }, { status: 400 })
      }
    }

    // Pour le projet RISQUES, on ne peut modifier que les gestionnaires (par admin depuis Gestion des risques)
    if (existingProjet.code_groupe === 'RISQUES') {
      // Mise à jour des gestionnaires seulement
      const { data, error } = await supabase
        .from('groupe_actions')
        .update({
          gestionnaires: body.gestionnaires || [],
          modificateur: body.modificateur,
          date_modification: new Date().toISOString()
        })
        .eq('id', existingProjet.id)
        .select()
        .single()

      if (error) {
        console.error('Erreur update gestionnaires RISQUES:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ groupe: data, message: 'Gestionnaires mis à jour' })
    }

    // Les gestionnaires sont automatiquement membres
    const membres = body.membres || []
    const gestionnaires = body.gestionnaires || []
    const allMembres = [...new Set([...membres, ...gestionnaires])]

    const { data, error } = await supabase
      .from('groupe_actions')
      .update({
        libelle_groupe: body.libelle_groupe,
        commentaire: body.commentaire,
        gestionnaires: gestionnaires,
        membres: allMembres,
        type_projet: body.type_projet,
        statut: body.statut,
        modificateur: body.modificateur,
        date_modification: new Date().toISOString()
      })
      .eq('id', existingProjet.id)
      .select()
      .single()

    if (error) {
      console.error('Erreur update projet:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ groupe: data, message: 'Projet modifié' })
  } catch (error) {
    console.error('Erreur PUT groupe_actions:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer un groupe d'actions (projet)
export async function DELETE(request) {
  try {
    const body = await request.json()
    const id = body.id

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient(request)

    // Récupérer le projet
    const { data: projet } = await supabase
      .from('groupe_actions')
      .select('code_groupe')
      .eq('id', id)
      .single()

    if (!projet) {
      return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })
    }

    const actor = getAuthenticatedUserFromRequest(request)
    const { data: projetFull } = await supabase.from('groupe_actions').select('*').eq('id', id).single()
    if (!canManageProject(actor, projetFull)) {
      return NextResponse.json({ error: 'Seuls les gestionnaires du projet ou le Super Admin peuvent supprimer ce projet' }, { status: 403 })
    }

    // Vérifier si c'est le projet RISQUES
    if (projet.code_groupe === 'RISQUES') {
      return NextResponse.json({ error: 'Le projet des risques ne peut pas être supprimé' }, { status: 400 })
    }

    // Vérifier s'il y a des actions liées
    const { data: actions } = await supabase
      .from('actions')
      .select('id')
      .eq('code_groupe', projet.code_groupe)
      .limit(1)

    if (actions && actions.length > 0) {
      return NextResponse.json({ 
        error: 'Ce projet contient des actions. Veuillez d\'abord supprimer les actions.' 
      }, { status: 400 })
    }

    const { error } = await supabase
      .from('groupe_actions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erreur delete projet:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Projet supprimé' })
  } catch (error) {
    console.error('Erreur DELETE groupe_actions:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
