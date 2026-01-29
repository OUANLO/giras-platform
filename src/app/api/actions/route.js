import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail, getActionAssignmentEmailTemplate } from '@/lib/email'

// GET - Récupérer les actions
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const codeGroupe = searchParams.get('code_groupe')
    const structure = searchParams.get('structure')
    const statut = searchParams.get('statut')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('actions')
      .select('*')
      .order('code_action', { ascending: false })

    if (codeGroupe) query = query.eq('code_groupe', codeGroupe)
    if (structure) query = query.eq('code_structure', structure)
    if (statut) query = query.eq('statut_act', statut)

    const { data, error } = await query

    if (error) {
      console.error('Erreur GET actions:', error)
      return NextResponse.json({ actions: [], message: error.message })
    }

    // Mapper statut_act vers statut pour la compatibilité frontend
    const actions = (data || []).map(a => ({
      ...a,
      statut: a.statut_act
    }))

    return NextResponse.json({ actions })
  } catch (error) {
    console.error('Erreur GET actions:', error)
    return NextResponse.json({ actions: [], error: error.message }, { status: 500 })
  }
}

// POST - Créer une action avec occurrence obligatoire
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    console.log('POST /api/actions - Body reçu:', JSON.stringify(body, null, 2))

    if (!body.libelle_action) {
      return NextResponse.json({ error: 'Libellé requis' }, { status: 400 })
    }
    if (!body.code_groupe) {
      return NextResponse.json({ error: 'Projet requis' }, { status: 400 })
    }
    if (!body.code_structure) {
      return NextResponse.json({ error: 'Structure requise' }, { status: 400 })
    }

    // Vérifier si first_occurrence est fourni
    if (body.first_occurrence) {
      if (!body.first_occurrence.date_debut || !body.first_occurrence.date_fin) {
        return NextResponse.json({ error: 'Dates de la première occurrence requises' }, { status: 400 })
      }
      if (!body.first_occurrence.responsable) {
        return NextResponse.json({ error: 'Responsable de la première occurrence requis' }, { status: 400 })
      }
    }

    // Créer l'action - compatible avec structure existante
    // La table actions utilise statut_act (pas statut)
    const insertData = {
      libelle_action: body.libelle_action,
      code_groupe: body.code_groupe,
      code_structure: body.code_structure,
      commentaire: body.commentaire || null,
      statut_act: body.statut || 'Actif',
      createur: body.createur,
      code_risque: body.code_risque || null
    }

    // Si first_occurrence existe, utiliser ses dates pour l'action aussi (compatibilité)
    if (body.first_occurrence) {
      insertData.date_debut = body.first_occurrence.date_debut
      insertData.date_fin = body.first_occurrence.date_fin
      insertData.responsable = body.first_occurrence.responsable
    }

    console.log('Insert data pour actions:', insertData)

    const { data: action, error: actionError } = await supabase
      .from('actions')
      .insert(insertData)
      .select()
      .single()

    if (actionError) {
      console.error('Erreur création action:', actionError)
      return NextResponse.json({ error: actionError.message }, { status: 500 })
    }

    console.log('Action créée:', action)

    // Créer l'occurrence si fournie
    if (body.first_occurrence && action) {
      // Générer code_occurrence
      const { data: lastOcc } = await supabase
        .from('action_occurrences')
        .select('code_occurrence')
        .order('code_occurrence', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextCode = (lastOcc?.code_occurrence || 0) + 1

      console.log('Création occurrence avec code:', nextCode, 'pour action:', action.code_action)

      const occInsertData = {
        code_occurrence: nextCode,
        code_action: action.code_action,
        date_debut: body.first_occurrence.date_debut,
        date_fin: body.first_occurrence.date_fin,
        responsable: body.first_occurrence.responsable,
        tx_avancement: 0,
        createur: body.createur,
        statut: 'Actif'
      }

      console.log('Données occurrence à insérer:', occInsertData)

      const { data: occData, error: occError } = await supabase
        .from('action_occurrences')
        .insert(occInsertData)
        .select()

      if (occError) {
        console.error('Erreur création occurrence:', occError)
        // Retourner l'erreur mais l'action est créée
        return NextResponse.json({ 
          action, 
          message: 'Action créée mais erreur occurrence: ' + occError.message,
          occurrenceError: occError.message 
        })
      } else {
        console.log('Occurrence créée avec succès:', occData)
      }

      // Envoyer email au responsable
      if (body.first_occurrence.responsable) {
        try {
          // Récupérer les infos du responsable
          const { data: responsableUser } = await supabase
            .from('users')
            .select('username, prenoms, nom')
            .eq('username', body.first_occurrence.responsable)
            .single()

          // Récupérer les infos de l'assignateur (créateur)
          let assignateur = null
          if (body.createur) {
            const { data: createurUser } = await supabase
              .from('users')
              .select('username, prenoms, nom')
              .eq('username', body.createur)
              .single()
            assignateur = createurUser
          }

          if (responsableUser) {
            const emailTemplate = getActionAssignmentEmailTemplate(responsableUser, {
              libelle_action: body.libelle_action,
              code_groupe: body.code_groupe,
              code_structure: body.code_structure,
              date_debut: body.first_occurrence.date_debut,
              date_fin: body.first_occurrence.date_fin
            }, assignateur)

            const emailResult = await sendEmail({
              to: responsableUser.username,
              subject: emailTemplate.subject,
              htmlContent: emailTemplate.htmlContent,
              textContent: emailTemplate.textContent
            })

            if (emailResult.success) {
              console.log(`[EMAIL] Email d'attribution d'action envoyé à ${responsableUser.username}`)
            } else {
              console.error(`[EMAIL] Échec envoi email à ${responsableUser.username}:`, emailResult.error)
            }
          }
        } catch (emailError) {
          console.error('[EMAIL] Erreur envoi email attribution action:', emailError)
          // Ne pas bloquer la création si l'email échoue
        }
      }
    }

    return NextResponse.json({ action, message: 'Action et occurrence créées' })
  } catch (error) {
    console.error('Erreur POST actions:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Modifier une action
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const updateData = {
      libelle_action: body.libelle_action,
      code_groupe: body.code_groupe,
      code_structure: body.code_structure,
      commentaire: body.commentaire,
      statut_act: body.statut,
      modificateur: body.modificateur,
      date_modification: new Date().toISOString()
    }

    // Ajouter code_risque si fourni
    if (body.code_risque !== undefined) updateData.code_risque = body.code_risque

    // Garder compatibilité avec les anciens champs
    if (body.date_debut) updateData.date_debut = body.date_debut
    if (body.date_fin) updateData.date_fin = body.date_fin
    if (body.responsable !== undefined) updateData.responsable = body.responsable

    const { data, error } = await supabase
      .from('actions')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('Erreur update action:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ action: data, message: 'Action modifiée' })
  } catch (error) {
    console.error('Erreur PUT actions:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer une action
export async function DELETE(request) {
  try {
    const body = await request.json()
    const id = body.id

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Récupérer l'action pour avoir code_action
    const { data: action } = await supabase
      .from('actions')
      .select('code_action')
      .eq('id', id)
      .single()

    if (action?.code_action) {
      // Vérifier s'il y a des tâches liées via les occurrences
      const { data: taches } = await supabase
        .from('taches')
        .select('id')
        .eq('code_action', action.code_action)
        .limit(1)

      if (taches && taches.length > 0) {
        return NextResponse.json({ 
          error: 'Cette action contient des tâches. Supprimez d\'abord les tâches.' 
        }, { status: 400 })
      }

      // Supprimer les occurrences
      await supabase
        .from('action_occurrences')
        .delete()
        .eq('code_action', action.code_action)
    }

    // Supprimer l'action
    const { error } = await supabase
      .from('actions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erreur delete action:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Action supprimée' })
  } catch (error) {
    console.error('Erreur DELETE actions:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
