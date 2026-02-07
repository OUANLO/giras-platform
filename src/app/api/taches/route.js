import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail, getTacheAssignmentEmailTemplate } from '@/lib/email'

// Recalculer et synchroniser le Tx% d'une occurrence à partir de ses tâches.
// Règle : dès qu'une occurrence a des tâches, le Tx% est obligatoirement calculé depuis les tâches.
// On met donc à jour action_occurrences.tx_avancement avec la moyenne (arrondie à 2 décimales)
// et on gère date_realisation / gestionnaire_conf de manière cohérente.
const recomputeAndSyncOccurrenceTx = async (supabase, code_occurrence, modificateur = null) => {
  if (!code_occurrence) return
  try {
    const { data: occ, error: occErr } = await supabase
      .from('action_occurrences')
      .select('id, tx_avancement, gestionnaire_conf, date_conf, date_realisation')
      .eq('code_occurrence', parseInt(code_occurrence))
      .maybeSingle()

    if (occErr) {
      console.error('[TX_SYNC] Erreur lecture occurrence:', occErr)
      return
    }
    if (!occ?.id) return

    const { data: taches, error: tErr } = await supabase
      .from('taches')
      .select('tx_avancement')
      .eq('code_occurrence', parseInt(code_occurrence))

    if (tErr) {
      console.error('[TX_SYNC] Erreur lecture tâches:', tErr)
      return
    }

    const list = taches || []
    if (list.length === 0) {
      // Plus de tâches : on ne force pas un Tx% calculé (l'utilisateur pourra ressaisir).
      return
    }

    const avg = list.reduce((s, t) => s + (parseFloat(t.tx_avancement) || 0), 0) / list.length
    const tx = Math.round(avg * 100) / 100

    const nowIso = new Date().toISOString()
    const shouldDone = tx >= 100

    const update = {
      tx_avancement: tx,
      modificateur: modificateur || null,
      date_modification: nowIso
    }

    if (shouldDone) {
      // Renseigner date_realisation si non définie
      update.date_realisation = occ.date_realisation || nowIso
    } else {
      // Si le Tx redescend < 100 : réinitialiser confirmation et date_realisation
      update.gestionnaire_conf = null
      update.date_conf = null
      update.date_realisation = null
    }

    const { error: upErr } = await supabase
      .from('action_occurrences')
      .update(update)
      .eq('id', occ.id)

    if (upErr) {
      console.error('[TX_SYNC] Erreur update occurrence:', upErr)
    }
  } catch (e) {
    console.error('[TX_SYNC] Exception:', e)
  }
}

// GET - Récupérer les tâches
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const codeAction = searchParams.get('code_action')
    const codeOccurrence = searchParams.get('code_occurrence')
    const responsable = searchParams.get('responsable')

    const supabase = createAdminClient()
let query = supabase
      .from('taches')
      .select('*')
      .order('code_tache', { ascending: false })

    if (codeAction) {
      query = query.eq('code_action', parseInt(codeAction))
    }
    if (codeOccurrence) {
      query = query.eq('code_occurrence', parseInt(codeOccurrence))
    }
    if (responsable) {
      query = query.eq('responsable', responsable)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erreur GET taches:', error)
      return NextResponse.json({ taches: [], message: error.message })
    }

    return NextResponse.json({ taches: data || [] })
  } catch (error) {
    console.error('Erreur GET taches:', error)
    return NextResponse.json({ taches: [], error: error.message }, { status: 500 })
  }
}

// POST - Créer une tâche
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.libelle_tache) {
      return NextResponse.json({ error: 'Libellé requis' }, { status: 400 })
    }
    if (!body.code_occurrence) {
      return NextResponse.json({ error: 'Code occurrence requis' }, { status: 400 })
    }
    if (!body.date_debut || !body.date_fin) {
      return NextResponse.json({ error: 'Dates obligatoires' }, { status: 400 })
    }
    if (!body.responsable) {
      return NextResponse.json({ error: 'Responsable obligatoire' }, { status: 400 })
    }

    // Générer code_tache automatiquement
    const { data: lastTache } = await supabase
      .from('taches')
      .select('code_tache')
      .order('code_tache', { ascending: false })
      .limit(1)
      .maybeSingle()

    let nextCode = 1
    if (lastTache?.code_tache) {
      nextCode = parseInt(lastTache.code_tache) + 1
    }

    const { data, error } = await supabase
      .from('taches')
      .insert({
        code_tache: nextCode,
        libelle_tache: body.libelle_tache,
        code_action: body.code_action || null,
        code_occurrence: body.code_occurrence,
        date_debut: body.date_debut,
        date_fin: body.date_fin,
        tx_avancement: body.tx_avancement || 0,
        responsable: body.responsable,
        commentaire: body.commentaire || null,
        createur: body.createur
      })
      .select()
      .single()

    if (error) {
      console.error('Erreur création tache:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Synchroniser Tx% occurrence à partir des tâches (efface/écrase une saisie manuelle)
    await recomputeAndSyncOccurrenceTx(supabase, body.code_occurrence, body.createur)

    // Envoyer email au responsable
    if (body.responsable) {
      try {
        const { data: responsableUser } = await supabase
          .from('users')
          .select('username, prenoms, nom')
          .eq('username', body.responsable)
          .single()

        // Récupérer le libellé de l'action
        let libelleAction = '-'
        if (body.code_action) {
          const { data: actionData } = await supabase
            .from('actions')
            .select('libelle_action')
            .eq('code_action', body.code_action)
            .single()
          libelleAction = actionData?.libelle_action || '-'
        }

        // Récupérer les infos de l'assignateur
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
          const emailTemplate = getTacheAssignmentEmailTemplate(responsableUser, {
            libelle_tache: body.libelle_tache,
            libelle_action: libelleAction,
            date_debut: body.date_debut,
            date_fin: body.date_fin
          }, assignateur)

          await sendEmail({
            to: responsableUser.username,
            subject: emailTemplate.subject,
            htmlContent: emailTemplate.htmlContent,
            textContent: emailTemplate.textContent
          })

          console.log(`[EMAIL] Email d'attribution de tâche envoyé à ${responsableUser.username}`)
        }
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email attribution tâche:', emailError)
      }
    }

    return NextResponse.json({ tache: data, message: 'Tâche créée' })
  } catch (error) {
    console.error('Erreur POST taches:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Modifier une tâche
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // Récupérer l'ancienne tâche pour comparer le responsable
    const { data: oldTache } = await supabase
      .from('taches')
      .select('responsable, code_action, libelle_tache')
      .eq('id', body.id)
      .single()

    const updateData = {
      libelle_tache: body.libelle_tache,
      date_debut: body.date_debut,
      date_fin: body.date_fin,
      tx_avancement: body.tx_avancement,
      responsable: body.responsable,
      commentaire: body.commentaire,
      modificateur: body.modificateur,
      date_modification: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('taches')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('Erreur update tache:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Synchroniser Tx% occurrence à partir des tâches
    await recomputeAndSyncOccurrenceTx(supabase, data?.code_occurrence || body.code_occurrence, body.modificateur)

    // Si le responsable a changé, envoyer un email au nouveau responsable
    if (body.responsable && oldTache && body.responsable !== oldTache.responsable) {
      try {
        const { data: responsableUser } = await supabase
          .from('users')
          .select('username, prenoms, nom')
          .eq('username', body.responsable)
          .single()

        // Récupérer le libellé de l'action
        let libelleAction = '-'
        if (oldTache.code_action) {
          const { data: actionData } = await supabase
            .from('actions')
            .select('libelle_action')
            .eq('code_action', oldTache.code_action)
            .single()
          libelleAction = actionData?.libelle_action || '-'
        }

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

        if (responsableUser) {
          const emailTemplate = getTacheAssignmentEmailTemplate(responsableUser, {
            libelle_tache: body.libelle_tache || oldTache.libelle_tache,
            libelle_action: libelleAction,
            date_debut: body.date_debut,
            date_fin: body.date_fin
          }, assignateur)

          await sendEmail({
            to: responsableUser.username,
            subject: emailTemplate.subject,
            htmlContent: emailTemplate.htmlContent,
            textContent: emailTemplate.textContent
          })

          console.log(`[EMAIL] Email d'attribution de tâche envoyé au nouveau responsable ${responsableUser.username}`)
        }
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email changement responsable tâche:', emailError)
      }
    }

    return NextResponse.json({ tache: data, message: 'Tâche modifiée' })
  } catch (error) {
    console.error('Erreur PUT taches:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer une tâche
export async function DELETE(request) {
  try {
    const body = await request.json()
    const id = body.id

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Récupérer la tâche avant suppression pour obtenir code_occurrence
    const { data: old, error: oldErr } = await supabase
      .from('taches')
      .select('code_occurrence')
      .eq('id', id)
      .maybeSingle()

    if (oldErr) {
      console.error('Erreur lecture tâche avant suppression:', oldErr)
    }

    const { error } = await supabase
      .from('taches')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erreur delete tache:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Synchroniser Tx% occurrence à partir des tâches restantes
    if (old?.code_occurrence) {
      await recomputeAndSyncOccurrenceTx(supabase, old.code_occurrence, body.modificateur)
    }

    return NextResponse.json({ success: true, message: 'Tâche supprimée' })
  } catch (error) {
    console.error('Erreur DELETE taches:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
