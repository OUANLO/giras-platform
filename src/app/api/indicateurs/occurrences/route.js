import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { upsertRisqueProbabiliteSnapshot } from '@/lib/risques-probabilites-sync'

function buildPeriodeLibelle(p) {
  if (!p) return null
  if (p.semestre) return `S${p.semestre}-${p.annee}`
  if (p.trimestre) return `T${p.trimestre}-${p.annee}`
  if (p.mois) {
    const mm = Number(p.mois)
    if (!Number.isNaN(mm)) return `${mm}-${p.annee}`
    return `${p.mois}-${p.annee}`
  }
  return `${p.annee}`
}

async function resolvePeriodeByLibelle(supabase, libelle) {
  if (!libelle) return null
  const { data, error } = await supabase
    .from('periodes_evaluation')
    .select('id, annee, semestre, trimestre, mois, date_debut, date_fin, statut')
    .order('date_debut', { ascending: false })
  if (error) throw error
  return (data || []).map(p => ({
    id: p.id,
    libelle: buildPeriodeLibelle(p),
    date_debut: p.date_debut,
    date_fin: p.date_fin,
    statut: p.statut,
  })).find(p => p.libelle === libelle) || null
}
import { sendEmail, getIndicatorOccurrenceEmailTemplate } from '@/lib/email'

// Fonction helper pour envoyer email au responsable d'un indicateur
async function sendIndicatorOccurrenceEmail(supabase, codeIndicateur, occurrenceData, assignateurUsername = null) {
  try {
    // Récupérer l'indicateur avec son responsable
    const { data: indicateur } = await supabase
      .from('indicateurs')
      .select('libelle_indicateur, responsable, code_structure')
      .eq('code_indicateur', codeIndicateur)
      .maybeSingle()

    if (!indicateur || !indicateur.responsable) return

    // Récupérer les infos du responsable
    const { data: user } = await supabase
      .from('users')
      .select('username, prenoms, nom')
      .eq('username', indicateur.responsable)
      .maybeSingle()

    if (!user) return

    // Récupérer les infos de l'assignateur
    let assignateur = null
    if (assignateurUsername) {
      const { data: assignateurUser } = await supabase
        .from('users')
        .select('username, prenoms, nom')
        .eq('username', assignateurUsername)
        .single()
      assignateur = assignateurUser
    }

    const emailTemplate = getIndicatorOccurrenceEmailTemplate(user, {
      libelle_indicateur: indicateur.libelle_indicateur,
      periode: occurrenceData.periode,
      date_limite: occurrenceData.date_limite_saisie,
      date_fin: occurrenceData.date_fin,
      cible: occurrenceData.cible
    }, assignateur)

    await sendEmail({
      to: user.username,
      subject: emailTemplate.subject,
      htmlContent: emailTemplate.htmlContent,
      textContent: emailTemplate.textContent
    })

    console.log(`[EMAIL] Email d'occurrence d'indicateur envoyé à ${user.username}`)
  } catch (error) {
    console.error('[EMAIL] Erreur envoi email occurrence indicateur:', error)
  }
}

// GET - Récupérer les occurrences d'indicateurs
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const code_indicateur = searchParams.get('code_indicateur')
    const code_risque = searchParams.get('code_risque')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('indicateur_occurrences')
      .select('*')
      .order('date_debut', { ascending: false })

    if (code_indicateur) query = query.eq('code_indicateur', code_indicateur)
    if (code_risque) query = query.eq('code_risque', code_risque)

    const { data, error } = await query

    if (error) {
      console.error('Erreur requête indicateur_occurrences:', error)
      return NextResponse.json({ occurrences: [], message: error.message })
    }

    return NextResponse.json({ occurrences: data || [] })
  } catch (error) {
    console.error('Erreur GET indicateur_occurrences:', error)
    return NextResponse.json({ occurrences: [], message: error.message })
  }
}

// POST - Créer ou mettre à jour une occurrence d'indicateur
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    // Interdire toute modification sur une période déjà fermée
    if (body?.periode) {
      const per = await resolvePeriodeByLibelle(supabase, body.periode)
      if (per?.statut === 'Fermé' || per?.statut === 'Fermée') {
        return NextResponse.json({ error: 'Période fermée : modification impossible' }, { status: 403 })
      }
    }

    // CAS SPÉCIAL: Risque qualitatif sans indicateur - on utilise code_risque
    if (body.code_risque && !body.code_indicateur && body.periode) {
      // Chercher l'occurrence existante par code_risque et periode
      const { data: existing } = await supabase
        .from('indicateur_occurrences')
        .select('*')
        .eq('code_risque', body.code_risque)
        .eq('periode', body.periode)
        .maybeSingle()

      if (existing) {
        // Mise à jour de l'occurrence existante
        const updateData = {
          probabilite: body.probabilite || null,
          modificateur: body.modificateur,
          date_modification: new Date().toISOString()
        }

        const { data, error } = await supabase
          .from('indicateur_occurrences')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .maybeSingle()

        if (error) throw error
        return NextResponse.json({ occurrence: data, message: 'Probabilité mise à jour (qualitatif)' })
      } else {
        // Créer une nouvelle occurrence pour risque qualitatif
        const { data, error } = await supabase
          .from('indicateur_occurrences')
          .insert({
            code_risque: body.code_risque,
            periode: body.periode,
            probabilite: body.probabilite || null,
            modificateur: body.modificateur,
            date_modification: new Date().toISOString(),
            statut: 'Pas retard',
            nb_jr_retard: 0
          })
          .select()
          .maybeSingle()

        if (error) throw error
        return NextResponse.json({ occurrence: data, message: 'Occurrence créée (qualitatif)' })
      }
    }

    // Validation minimale pour les autres cas
    if (!body.code_indicateur) {
      return NextResponse.json({ error: 'Code indicateur obligatoire' }, { status: 400 })
    }

    // CAS 1: Mise à jour via période (pour saisie manuelle de probabilité depuis Analyse)
    if (body.periode && !body.date_debut) {
      // Chercher l'occurrence existante par code_indicateur et periode
      const { data: existing } = await supabase
        .from('indicateur_occurrences')
        .select('*')
        .eq('code_indicateur', body.code_indicateur)
        .eq('periode', body.periode)
        .maybeSingle()

      if (existing) {
        // Mise à jour de l'occurrence existante - NE PAS toucher à date_saisie (réservé à la saisie d'indicateur)
        const updateData = {
          probabilite: body.probabilite || null,
          // date_saisie_probabilite pour la saisie manuelle de probabilité (si le champ existe)
          modificateur: body.modificateur,
          date_modification: new Date().toISOString()
        }

        const { data, error } = await supabase
          .from('indicateur_occurrences')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .maybeSingle()

        if (error) throw error
        return NextResponse.json({ occurrence: data, message: 'Probabilité mise à jour' })
      } else {
        // Créer une nouvelle occurrence minimale - NE PAS mettre date_saisie (réservé à la saisie d'indicateur)
        const { data, error } = await supabase
          .from('indicateur_occurrences')
          .insert({
            code_indicateur: body.code_indicateur,
            periode: body.periode,
            probabilite: body.probabilite || null,
            modificateur: body.modificateur,
            date_modification: new Date().toISOString(),
            // date_saisie reste null - sera renseigné uniquement lors de la saisie de l'indicateur
            statut: 'Pas retard',
            nb_jr_retard: 0
          })
          .select()
          .maybeSingle()

        if (error) throw error
        return NextResponse.json({ occurrence: data, message: 'Occurrence créée avec probabilité' })
      }
    }

    // CAS 2: Création complète (pour ouverture de période)
    if (!body.date_debut || !body.date_fin || !body.date_limite_saisie) {
      return NextResponse.json({ error: 'Dates obligatoires (début, fin, limite de saisie)' }, { status: 400 })
    }

    // Vérifier unicité période + code_indicateur
    const { data: existing } = await supabase
      .from('indicateur_occurrences')
      .select('id')
      .eq('code_indicateur', body.code_indicateur)
      .eq('date_debut', body.date_debut)
      .eq('date_fin', body.date_fin)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Une occurrence avec ces dates existe déjà' }, { status: 400 })
    }

    // Calculer nb_jr_retard et statut initiaux
    const dateLimite = new Date(body.date_limite_saisie)
    const today = new Date()
    let nb_jr_retard = Math.floor((today - dateLimite) / (1000 * 60 * 60 * 24))
    let statut = nb_jr_retard > 0 ? 'Retard' : 'Pas retard'

    // Création
    const { data, error } = await supabase
      .from('indicateur_occurrences')
      .insert({
        code_indicateur: body.code_indicateur,
        periode: body.periode || null,
        annee: body.annee || null,
        date_debut: body.date_debut,
        date_fin: body.date_fin,
        date_limite_saisie: body.date_limite_saisie,
        cible: body.cible != null ? parseFloat(body.cible) : null,
        nb_jr_retard: nb_jr_retard,
        statut: statut
      })
      .select()
      .maybeSingle()

    if (error) throw error

    // Envoyer email au responsable de l'indicateur
    await sendIndicatorOccurrenceEmail(supabase, body.code_indicateur, {
      periode: body.periode,
      date_limite_saisie: body.date_limite_saisie,
      date_fin: body.date_fin,
      cible: body.cible
    }, body.createur)

    // Synchroniser risques_probabilites (snapshot période ouverte)
    // IMPORTANT: indicateur_occurrences n'a pas toujours code_risque.
    // On retrouve les risques liés via code_indicateur.
    if (data?.code_indicateur && data?.periode) {
      const periodeObj = await resolvePeriodeByLibelle(supabase, data.periode)
      if (periodeObj && (periodeObj.statut !== 'Fermé' && periodeObj.statut !== 'Fermée')) {
        const { data: risquesLies } = await supabase
          .from('risques')
          .select('code_risque')
          .eq('code_indicateur', data.code_indicateur)

        for (const r of (risquesLies || [])) {
          if (!r?.code_risque) continue
          await upsertRisqueProbabiliteSnapshot({
            supabase,
            periode: periodeObj,
            codeRisque: r.code_risque,
            modificateur: body.modificateur,
            probabiliteOverride: null,
            archive: false,
          })
        }
      }
    }

    return NextResponse.json({ occurrence: data, message: 'Occurrence créée' })
  } catch (error) {
    console.error('Erreur POST indicateur_occurrences:', error)
    return NextResponse.json({ error: error.message || 'Erreur lors de la création' }, { status: 500 })
  }
}

// PUT - Mettre à jour une occurrence d'indicateur
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    // Interdire toute modification sur une période déjà fermée
    if (body?.periode) {
      const per = await resolvePeriodeByLibelle(supabase, body.periode)
      if (per?.statut === 'Fermé' || per?.statut === 'Fermée') {
        return NextResponse.json({ error: 'Période fermée : modification impossible' }, { status: 403 })
      }
    }

    if (!body.id) {
      return NextResponse.json({ error: 'ID obligatoire' }, { status: 400 })
    }

    // Récupérer l'occurrence existante pour vérifier si c'est une nouvelle saisie
    const { data: existing } = await supabase
      .from('indicateur_occurrences')
      .select('val_indicateur, date_saisie')
      .eq('id', body.id)
      .maybeSingle()

    // Déterminer date_saisie : si val_indicateur est maintenant renseigné et ne l'était pas avant
    let dateSaisie = body.date_saisie
    if (body.val_indicateur != null && (existing?.val_indicateur == null || existing?.date_saisie == null)) {
      dateSaisie = new Date().toISOString().split('T')[0]
    }

    const updateData = {
      periode: body.periode || null,
      annee: body.annee || null,
      date_debut: body.date_debut,
      date_fin: body.date_fin,
      date_limite_saisie: body.date_limite_saisie,
      cible: body.cible != null ? parseFloat(body.cible) : null,
      val_numerateur: body.val_numerateur,
      val_denominateur: body.val_denominateur,
      val_indicateur: body.val_indicateur,
      date_saisie: dateSaisie,
      nb_jr_retard: body.nb_jr_retard,
      statut: body.statut,
      commentaire: body.commentaire || null,
      modificateur: body.modificateur,
      date_modification: new Date().toISOString()
    }

    // Mise à jour
    const { data, error } = await supabase
      .from('indicateur_occurrences')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .maybeSingle()

    if (error) throw error

    // Synchroniser risques_probabilites (snapshot période ouverte)
    if (data?.code_indicateur && data?.periode) {
      const periodeObj = await resolvePeriodeByLibelle(supabase, data.periode)
      if (periodeObj && (periodeObj.statut !== 'Fermé' && periodeObj.statut !== 'Fermée')) {
        const { data: risquesLies } = await supabase
          .from('risques')
          .select('code_risque')
          .eq('code_indicateur', data.code_indicateur)

        for (const r of (risquesLies || [])) {
          if (!r?.code_risque) continue
          await upsertRisqueProbabiliteSnapshot({
            supabase,
            periode: periodeObj,
            codeRisque: r.code_risque,
            modificateur: body.modificateur,
            probabiliteOverride: null,
            archive: false,
          })
        }
      }
    }

    return NextResponse.json({ occurrence: data, message: 'Occurrence mise à jour' })
  } catch (error) {
    console.error('Erreur PUT indicateur_occurrences:', error)
    return NextResponse.json({ error: error.message || 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}

// DELETE - Supprimer une occurrence
export async function DELETE(request) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Interdire suppression si l'occurrence appartient à une période fermée
    const { data: occToDelete, error: occErr } = await supabase
      .from('indicateur_occurrences')
      .select('periode')
      .eq('id', body.id)
      .maybeSingle()

    if (occErr) throw occErr

    if (occToDelete?.periode) {
      const periodeData = await resolvePeriodeByLibelle(supabase, occToDelete.periode)
      if (periodeData?.statut === 'Fermé' || periodeData?.statut === 'Fermée') {
        return NextResponse.json({ error: 'Période fermée : suppression interdite.' }, { status: 403 })
      }
    }
    
    const { error } = await supabase
      .from('indicateur_occurrences')
      .delete()
      .eq('id', body.id)

    if (error) throw error

    return NextResponse.json({ message: 'Occurrence supprimée' })
  } catch (error) {
    console.error('Erreur DELETE indicateur_occurrences:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
