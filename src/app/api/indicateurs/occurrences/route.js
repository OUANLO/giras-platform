import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { deleteRisqueProbabiliteForRisquePeriode } from '@/lib/risques-probabilites-sync'

// Détermine si un indicateur appartient au groupe "Risque".
// Le schéma supporte à la fois:
// - indicateurs.code_groupe (mono-groupe)
// - indicateurs.groupes (multi-groupes)
function isRisqueIndicateur(indic) {
  if (!indic) return false
  const code = String(indic.code_groupe || '').trim()
  if (code === 'Risque') return true
  const arr = Array.isArray(indic.groupes) ? indic.groupes : []
  return arr.map((x) => String(x).trim()).includes('Risque')
}

function makeHttpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

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
  // IMPORTANT: les schémas Supabase diffèrent selon les déploiements.
  // - Certaines bases n'ont pas de colonne `libelle`/`libelle_periode`
  // - Certaines bases ont (ou non) des colonnes de dates (date_debut/date_fin)
  // Pour éviter les erreurs PostgREST "column ... does not exist", on fait un select('*')
  // (toujours sûr) puis on reconstruit le libellé et on récupère les dates si présentes.
  const { data, error } = await supabase
    .from('periodes_evaluation')
    .select('*')
    .order('annee', { ascending: false })
    .order('semestre', { ascending: false })
    .order('trimestre', { ascending: false })
    .order('mois', { ascending: false })
  if (error) throw error
  return (data || []).map(p => {
    const dateDebut = p.date_debut ?? p.date_debut_periode ?? p.debut ?? null
    const dateFin = p.date_fin ?? p.date_fin_periode ?? p.fin ?? null
    return {
      id: p.id,
      annee: p.annee ?? null,
      semestre: p.semestre ?? null,
      trimestre: p.trimestre ?? null,
      mois: p.mois ?? null,
      libelle: buildPeriodeLibelle(p),
      date_debut: dateDebut,
      date_fin: dateFin,
      statut: p.statut,
    }
  }).find(p => p.libelle === libelle) || null
}

function buildFallbackPeriodeObj(input) {
  const p = input || {}
  return {
    id: p.id ?? null,
    annee: p.annee ?? null,
    semestre: p.semestre ?? null,
    trimestre: p.trimestre ?? null,
    mois: p.mois ?? null,
    libelle: p.periode ?? p.libelle ?? null,
    date_debut: p.date_debut ?? p.dateDebut ?? null,
    date_fin: p.date_fin ?? p.dateFin ?? null,
    // Si on ne peut pas résoudre le statut via periodes_evaluation, on considère la période ouverte
    // (sinon la saisie côté UI serait déjà bloquée).
    statut: p.statut ?? 'Ouvert',
  }
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
    const includeArchived = searchParams.get('include_archived') === '1'
    const archivedOnly = searchParams.get('archived_only') === '1'

    const supabase = createAdminClient()
    
    let query = supabase
      .from('indicateur_occurrences')
      .select('*')
      .order('date_debut', { ascending: false })

    // Par défaut, ne retourner que les occurrences NON archivées (besoin de l'écran 'Suivi').
    // - include_archived=1 : retourne tout
    // - archived_only=1 : retourne seulement les occurrences archivées
    if (!includeArchived) {
      if (archivedOnly) query = query.eq('archive', true)
      else query = query.eq('archive', false)
    }

    if (code_indicateur) query = query.eq('code_indicateur', code_indicateur)

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

    // Validation minimale
    if (!body.code_indicateur) {
      return NextResponse.json({ error: 'Code indicateur obligatoire' }, { status: 400 })
    }
    // Création complète (ouverture de période)
    if (!body.date_debut || !body.date_fin || !body.date_limite_saisie) {
      return NextResponse.json({ error: 'Dates obligatoires (début, fin, limite de saisie)' }, { status: 400 })
    }

    // --- RÈGLE (2026-01) ---
    // La table risques_probabilites ne doit contenir QUE les probabilités saisies manuellement.
    // Donc, avant d'enregistrer une occurrence d'un indicateur lié à un risque,
    // on doit obligatoirement supprimer toute saisie manuelle existante pour ce risque/période.
    try {
      const { data: risquesByCode, error: risquesErrCode } = await supabase
        .from('risques')
        .select('code_risque')
        .eq('code_indicateur', body.code_indicateur)
      if (risquesErrCode) throw risquesErrCode

      // Compat: certains schémas historiques avaient une colonne `id_indicateur`.
      // Sur d'autres bases, elle n'existe pas (PostgREST renvoie alors "column ... does not exist").
      // On tente, mais on ignore proprement si la colonne n'existe pas.
      let risquesById = []
      try {
        const { data, error } = await supabase
          .from('risques')
          .select('code_risque')
          .eq('id_indicateur', body.code_indicateur)
        if (error) throw error
        risquesById = data || []
      } catch (e) {
        const msg = String(e?.message || e)
        if (!msg.toLowerCase().includes('does not exist')) throw e
      }

      const risquesLies = [...(risquesByCode || []), ...(risquesById || [])]
        .filter((r) => r?.code_risque)
        .filter((r, i, arr) => arr.findIndex(x => x.code_risque === r.code_risque) === i)

      if (risquesLies.length) {
        const periodeResolved = await resolvePeriodeByLibelle(supabase, body.periode)
        const periodeObj = periodeResolved || buildFallbackPeriodeObj({
          periode: body.periode,
          date_debut: body.date_debut,
          date_fin: body.date_fin,
          annee: body.annee,
          statut: 'Ouvert',
        })

        for (const r of risquesLies) {
          const { error: delErr } = await deleteRisqueProbabiliteForRisquePeriode({
            supabase,
            codeRisque: r.code_risque,
            periode: periodeObj,
          })
          if (delErr) throw delErr
        }
      }
    } catch (e) {
      console.error('[POST indicateur_occurrences] Erreur suppression proba manuelle risques_probabilites:', e)
      throw e
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

    // --- RÈGLE MÉTIER (2026-01) ---
    // risques_probabilites ne doit conserver QUE les probabilités saisies manuellement.
    // Donc, AVANT d'enregistrer une occurrence d'indicateur liée à un risque,
    // on supprime obligatoirement toute saisie manuelle existante pour ce risque/période.
    try {
      if (body?.periode) {
        const periodeResolved = await resolvePeriodeByLibelle(supabase, body.periode)
        const periodeObj =
          periodeResolved ||
          buildFallbackPeriodeObj({
            periode: body.periode,
            date_debut: body.date_debut,
            date_fin: body.date_fin,
            annee: body.annee,
          })

        const { data: risquesByCode, error: risquesErrCode } = await supabase
          .from('risques')
          .select('code_risque')
          .eq('code_indicateur', body.code_indicateur)
        if (risquesErrCode) throw risquesErrCode

        let risquesById = []
        try {
          const { data, error } = await supabase
            .from('risques')
            .select('code_risque')
            .eq('id_indicateur', body.code_indicateur)
          if (error) throw error
          risquesById = data || []
        } catch (e) {
          const msg = String(e?.message || e)
          if (!msg.toLowerCase().includes('does not exist')) throw e
        }

        const risquesLies = [...(risquesByCode || []), ...(risquesById || [])]
          .filter((r, i, arr) => arr.findIndex(x => x.code_risque === r.code_risque) === i)

        for (const r of risquesLies || []) {
          if (!r?.code_risque) continue
          const { error: delErr } = await deleteRisqueProbabiliteForRisquePeriode({
            supabase,
            codeRisque: r.code_risque,
            periode: periodeObj,
          })
          if (delErr) throw delErr
        }
      }
    } catch (e) {
      console.error('[POST indicateur_occurrences] Erreur suppression risques_probabilites (manuel):', e)
      // On bloque: la règle dit "obligatoirement supprimé".
      throw makeHttpError(500, `Erreur suppression probabilité manuelle: ${e?.message || e}`)
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
        val_numerateur: body.val_numerateur != null ? parseFloat(body.val_numerateur) : null,
        val_denominateur: body.val_denominateur != null ? parseFloat(body.val_denominateur) : null,
        val_indicateur: body.val_indicateur != null ? parseFloat(body.val_indicateur) : null,
        date_saisie: body.date_saisie || null,
        commentaire: body.commentaire || null,
        modificateur: body.modificateur || body.createur || null,
        date_modification: new Date().toISOString(),
        nb_jr_retard: nb_jr_retard,
        statut: statut
      })
      .select()
      .maybeSingle()

    if (error) throw error

    // IMPORTANT (2026-01): on ne calcule PLUS et on ne stocke PLUS de probabilité automatique.
    // Les probabilités automatiques doivent être dérivées à l'affichage / dans les calculs,
    // mais la table risques_probabilites ne conserve que les saisies manuelles.
    // Envoyer email au responsable de l'indicateur
    await sendIndicatorOccurrenceEmail(supabase, body.code_indicateur, {
      periode: body.periode,
      date_limite_saisie: body.date_limite_saisie,
      date_fin: body.date_fin,
      cible: body.cible
    }, body.createur)

    return NextResponse.json({ occurrence: data, message: 'Occurrence créée' })
  } catch (error) {
    console.error('Erreur POST indicateur_occurrences:', error)
    const status = error?.status || 500
    return NextResponse.json({ error: error.message || 'Erreur lors de la création' }, { status })
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
      .select('*')
      .eq('id', body.id)
      .maybeSingle()

    // Déterminer date_saisie : si val_indicateur est maintenant renseigné et ne l'était pas avant
    let dateSaisie = body.date_saisie
    if (body.val_indicateur != null && (existing?.val_indicateur == null || existing?.date_saisie == null)) {
      dateSaisie = new Date().toISOString().split('T')[0]
    }

    // --- RÈGLE MÉTIER (2026-01) ---
    // Avant d'enregistrer une occurrence d'indicateur risque, supprimer toute probabilité manuelle
    // existante dans risques_probabilites pour le risque correspondant.
    try {
      const resolvedPeriode = body?.periode ?? existing?.periode ?? null
      const resolvedCodeInd = body?.code_indicateur ?? existing?.code_indicateur ?? null
      if (resolvedPeriode && resolvedCodeInd) {
        const periodeResolved = await resolvePeriodeByLibelle(supabase, resolvedPeriode)
        const periodeObj =
          periodeResolved ||
          buildFallbackPeriodeObj({
            periode: resolvedPeriode,
            date_debut: body.date_debut ?? existing?.date_debut,
            date_fin: body.date_fin ?? existing?.date_fin,
            annee: body.annee ?? existing?.annee,
          })

        const { data: risquesByCode, error: risquesErrCode } = await supabase
          .from('risques')
          .select('code_risque')
          .eq('code_indicateur', resolvedCodeInd)
        if (risquesErrCode) throw risquesErrCode

        // Compat: certains schémas historiques avaient une colonne `id_indicateur`.
        // Si la colonne n'existe pas, on ignore proprement (PostgREST: "column ... does not exist").
        let risquesById = []
        try {
          const { data, error } = await supabase
            .from('risques')
            .select('code_risque')
            .eq('id_indicateur', resolvedCodeInd)
          if (error) throw error
          risquesById = data || []
        } catch (e) {
          const msg = String(e?.message || e)
          if (!msg.toLowerCase().includes('does not exist')) throw e
        }

        const risquesLies = [...(risquesByCode || []), ...(risquesById || [])]
          .filter((r, i, arr) => arr.findIndex(x => x.code_risque === r.code_risque) === i)

        for (const r of risquesLies || []) {
          if (!r?.code_risque) continue
          const { error: delErr } = await deleteRisqueProbabiliteForRisquePeriode({
            supabase,
            codeRisque: r.code_risque,
            periode: periodeObj,
          })
          if (delErr) throw delErr
        }
      }
    } catch (e) {
      console.error('[PUT indicateur_occurrences] Erreur suppression risques_probabilites (manuel):', e)
      throw makeHttpError(500, `Erreur suppression probabilité manuelle: ${e?.message || e}`)
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

    return NextResponse.json({ occurrence: data, message: 'Occurrence mise à jour' })
  } catch (error) {
    console.error('Erreur PUT indicateur_occurrences:', error)
    const status = error?.status || 500
    return NextResponse.json({ error: error.message || 'Erreur lors de la mise à jour' }, { status })
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