import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail, getActionAssignmentEmailTemplate } from '@/lib/email'

// GET - Récupérer les occurrences d'actions
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const code_action = searchParams.get('code_action')
    const code_groupe = searchParams.get('code_groupe')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('action_occurrences')
      .select('*')
      .order('date_debut', { ascending: false })

    if (code_action) query = query.eq('code_action', code_action)

    const { data, error } = await query

    if (error) {
      console.error('Erreur requête action_occurrences:', error)
      // Si la table n'existe pas, retourner tableau vide
      if (error.code === '42P01') {
        return NextResponse.json({ occurrences: [], message: 'Table action_occurrences non créée' })
      }
      return NextResponse.json({ occurrences: [], message: error.message })
    }

    return NextResponse.json({ occurrences: data || [] })
  } catch (error) {
    console.error('Erreur GET action_occurrences:', error)
    return NextResponse.json({ occurrences: [], message: error.message })
  }
}

// POST - Créer une nouvelle occurrence d'action
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    // Validation
    if (!body.code_action) {
      return NextResponse.json({ error: 'Code action obligatoire' }, { status: 400 })
    }
    if (!body.date_debut || !body.date_fin) {
      return NextResponse.json({ error: 'Dates obligatoires (début, fin)' }, { status: 400 })
    }
    if (!body.responsable) {
      return NextResponse.json({ error: 'Responsable obligatoire' }, { status: 400 })
    }

    // Vérifier unicité date_debut + date_fin pour cette action
    const { data: existing } = await supabase
      .from('action_occurrences')
      .select('id')
      .eq('code_action', body.code_action)
      .eq('date_debut', body.date_debut)
      .eq('date_fin', body.date_fin)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Une occurrence avec ces mêmes dates existe déjà pour cette action' }, { status: 400 })
    }

    // Générer code_occurrence
    const { data: lastOcc } = await supabase
      .from('action_occurrences')
      .select('code_occurrence')
      .order('code_occurrence', { ascending: false })
      .limit(1)
      .maybeSingle()

    let nextCode = 1
    if (lastOcc?.code_occurrence) {
      nextCode = parseInt(lastOcc.code_occurrence) + 1
    }

    // Création
    const { data, error } = await supabase
      .from('action_occurrences')
      .insert({
        code_occurrence: nextCode,
        code_action: body.code_action,
        date_debut: body.date_debut,
        date_fin: body.date_fin,
        responsable: body.responsable,
        tx_avancement: body.tx_avancement || 0,
        gestionnaire_conf: null,
        date_conf: null,
        createur: body.createur
      })
      .select()
      .single()

    if (error) {
      console.error('Erreur création occurrence:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Envoyer email au responsable
    if (body.responsable) {
      try {
        // Récupérer les infos du responsable
        const { data: responsableUser } = await supabase
          .from('users')
          .select('username, prenoms, nom')
          .eq('username', body.responsable)
          .single()

        // Récupérer les infos de l'action
        const { data: actionData } = await supabase
          .from('actions')
          .select('libelle_action, code_groupe, code_structure')
          .eq('code_action', body.code_action)
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

        if (responsableUser && actionData) {
          const emailTemplate = getActionAssignmentEmailTemplate(responsableUser, {
            libelle_action: actionData.libelle_action,
            code_groupe: actionData.code_groupe,
            code_structure: actionData.code_structure,
            date_debut: body.date_debut,
            date_fin: body.date_fin
          }, assignateur)

          await sendEmail({
            to: responsableUser.username,
            subject: emailTemplate.subject,
            htmlContent: emailTemplate.htmlContent,
            textContent: emailTemplate.textContent
          })

          console.log(`[EMAIL] Email d'attribution d'action envoyé à ${responsableUser.username}`)
        }
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email attribution action:', emailError)
        // Ne pas bloquer la création si l'email échoue
      }
    }

    return NextResponse.json({ occurrence: data, message: 'Occurrence créée' })
  } catch (error) {
    console.error('Erreur POST action_occurrences:', error)
    return NextResponse.json({ error: error.message || 'Erreur lors de la création' }, { status: 500 })
  }
}

// PUT - Mettre à jour une occurrence d'action
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID obligatoire' }, { status: 400 })
    }

    // Récupérer l'ancienne occurrence pour comparer
    // NB: on inclut date_realisation si elle existe dans le schéma.
    // Si la colonne n'existe pas, Supabase renverra une erreur "column ... does not exist".
    // Dans ce cas, on relira sans cette colonne.
    let oldOccurrence = null
    {
      const { data, error } = await supabase
        .from('action_occurrences')
        .select('responsable, code_action, tx_avancement, gestionnaire_conf, date_realisation')
        .eq('id', body.id)
        .maybeSingle()
      if (error && (error.message || '').toLowerCase().includes('date_realisation')) {
        const { data: d2 } = await supabase
          .from('action_occurrences')
          .select('responsable, code_action, tx_avancement, gestionnaire_conf')
          .eq('id', body.id)
          .maybeSingle()
        oldOccurrence = d2 || null
      } else {
        oldOccurrence = data || null
      }
    }

    const updateData = {
      date_debut: body.date_debut,
      date_fin: body.date_fin,
      responsable: body.responsable,
      modificateur: body.modificateur
    }

    // Ne mettre à jour tx_avancement que si fourni
    if (body.tx_avancement !== undefined) {
      updateData.tx_avancement = body.tx_avancement

      // ===== Gestion date_realisation (règle métier) =====
      // - Si tx < 100 => date_realisation doit être vide
      // - Si tx >= 100 => si date_realisation vide, elle prend la date du jour (ou valeur fournie)
      // Cette date est indépendante de la confirmation gestionnaire.
      const tx = parseFloat(body.tx_avancement) || 0
      if (tx < 100) {
        updateData.date_realisation = null
      } else {
        // garder une date existante si déjà définie
        const existingDate = oldOccurrence?.date_realisation
        updateData.date_realisation = existingDate || body.date_realisation || new Date().toISOString().split('T')[0]
      }
    }

    // Gérer la confirmation gestionnaire
    if (body.gestionnaire_conf !== undefined) {
      updateData.gestionnaire_conf = body.gestionnaire_conf
      if (body.gestionnaire_conf === 'Oui') {
        updateData.date_conf = body.date_conf || new Date().toISOString().split('T')[0]
      } else {
        updateData.date_conf = null
      }
    }

    // Update tolérant: si la colonne date_realisation n'existe pas, on retente sans.
    let data = null
    {
      const { data: d1, error } = await supabase
        .from('action_occurrences')
        .update(updateData)
        .eq('id', body.id)
        .select()
        .single()
      if (error && (error.message || '').toLowerCase().includes('date_realisation')) {
        const { date_realisation, ...fallback } = updateData
        const { data: d2, error: e2 } = await supabase
          .from('action_occurrences')
          .update(fallback)
          .eq('id', body.id)
          .select()
          .single()
        if (e2) {
          console.error('Erreur update occurrence:', e2)
          return NextResponse.json({ error: e2.message }, { status: 500 })
        }
        data = d2
      } else if (error) {
        console.error('Erreur update occurrence:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        data = d1
      }
    }

    // Si le responsable a changé, envoyer un email au nouveau responsable
    if (body.responsable && oldOccurrence && body.responsable !== oldOccurrence.responsable) {
      try {
        const { data: responsableUser } = await supabase
          .from('users')
          .select('username, prenoms, nom')
          .eq('username', body.responsable)
          .single()

        const { data: actionData } = await supabase
          .from('actions')
          .select('libelle_action, code_groupe, code_structure')
          .eq('code_action', oldOccurrence.code_action)
          .single()

        // Récupérer les infos de l'assignateur (modificateur)
        let assignateur = null
        if (body.modificateur) {
          const { data: modifUser } = await supabase
            .from('users')
            .select('username, prenoms, nom')
            .eq('username', body.modificateur)
            .single()
          assignateur = modifUser
        }

        if (responsableUser && actionData) {
          const emailTemplate = getActionAssignmentEmailTemplate(responsableUser, {
            libelle_action: actionData.libelle_action,
            code_groupe: actionData.code_groupe,
            code_structure: actionData.code_structure,
            date_debut: body.date_debut || data.date_debut,
            date_fin: body.date_fin || data.date_fin
          }, assignateur)

          await sendEmail({
            to: responsableUser.username,
            subject: emailTemplate.subject,
            htmlContent: emailTemplate.htmlContent,
            textContent: emailTemplate.textContent
          })

          console.log(`[EMAIL] Email d'attribution d'action envoyé au nouveau responsable ${responsableUser.username}`)
        }
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email changement responsable action:', emailError)
      }
    }

    // Si l'action atteint 100% et n'était pas à 100% avant, et pas encore confirmée
    // Envoyer un email à tous les gestionnaires
    const newTx = body.tx_avancement !== undefined ? body.tx_avancement : data.tx_avancement
    const oldTx = oldOccurrence?.tx_avancement || 0
    const wasNotConfirmed = oldOccurrence?.gestionnaire_conf !== 'Oui'
    
    if (newTx >= 100 && oldTx < 100 && wasNotConfirmed) {
      try {
        // Récupérer les infos de l'action
        const { data: actionData } = await supabase
          .from('actions')
          .select('libelle_action, code_groupe, code_structure')
          .eq('code_action', oldOccurrence.code_action)
          .single()

        if (actionData) {
          // Récupérer tous les gestionnaires (type_utilisateur = 'Gestionnaire')
          const { data: gestionnaires } = await supabase
            .from('users')
            .select('username, prenoms, nom')
            .eq('type_utilisateur', 'Gestionnaire')
            .eq('statut', 'Actif')

          if (gestionnaires && gestionnaires.length > 0) {
            // Importer le template
            const { getActionPendingConfirmationEmailTemplate } = await import('@/lib/email')
            
            for (const gestionnaire of gestionnaires) {
              const emailTemplate = getActionPendingConfirmationEmailTemplate(gestionnaire, {
                libelle_action: actionData.libelle_action,
                code_groupe: actionData.code_groupe,
                responsable: body.responsable || data.responsable,
                date_fin: body.date_fin || data.date_fin
              })

              await sendEmail({
                to: gestionnaire.username,
                subject: emailTemplate.subject,
                htmlContent: emailTemplate.htmlContent,
                textContent: emailTemplate.textContent
              })

              console.log(`[EMAIL] Email de confirmation envoyé au gestionnaire ${gestionnaire.username}`)
            }
          }
        }
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email aux gestionnaires:', emailError)
      }
    }

    return NextResponse.json({ occurrence: data, message: 'Occurrence mise à jour' })
  } catch (error) {
    console.error('Erreur PUT action_occurrences:', error)
    return NextResponse.json({ error: error.message || 'Erreur' }, { status: 500 })
  }
}

// DELETE - Supprimer une occurrence d'action
export async function DELETE(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID obligatoire' }, { status: 400 })
    }

    // Supprimer d'abord les tâches liées
    const { data: occurrence } = await supabase
      .from('action_occurrences')
      .select('code_occurrence')
      .eq('id', body.id)
      .single()

    if (occurrence) {
      await supabase
        .from('taches')
        .delete()
        .eq('code_occurrence', occurrence.code_occurrence)
    }

    // Supprimer l'occurrence
    const { error } = await supabase
      .from('action_occurrences')
      .delete()
      .eq('id', body.id)

    if (error) {
      console.error('Erreur delete occurrence:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Occurrence supprimée' })
  } catch (error) {
    console.error('Erreur DELETE action_occurrences:', error)
    return NextResponse.json({ error: error.message || 'Erreur' }, { status: 500 })
  }
}
