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

async function getIndicateurDefinition(supabase, codeIndicateur) {
  if (!codeIndicateur) return null
  const { data, error } = await supabase
    .from('indicateurs')
    .select('code_indicateur, code_groupe, groupes, necessite_cible, responsable, code_structure')
    .eq('code_indicateur', codeIndicateur)
    .maybeSingle()
  if (error) throw error
  return data || null
}

async function isClosedRiskPeriod(supabase, periodeLibelle, codeIndicateur) {
  if (!periodeLibelle || !codeIndicateur) return false
  const per = await resolvePeriodeByLibelle(supabase, periodeLibelle)
  if (!(per?.statut === 'Fermé' || per?.statut === 'Fermée')) return false
  const indic = await getIndicateurDefinition(supabase, codeIndicateur)
  return isRisqueIndicateur(indic)
}

function indicateurRequiresTarget(indic) {
  return indic?.necessite_cible !== 'Non'
}

function normalizeManagerList(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {}
    return value.split(/[;,]/)
  }
  return []
}

async function validateOccurrenceResponsible(supabase, indicatorDef, responsable) {
  const selected = String(responsable || '').trim()
  if (!selected) throw makeHttpError(400, 'Responsable obligatoire')

  const { data: selectedUser, error: userError } = await supabase
    .from('users')
    .select('username, structure')
    .eq('username', selected)
    .maybeSingle()
  if (userError) throw userError
  if (!selectedUser) throw makeHttpError(400, 'Responsable introuvable')

  if (selectedUser.structure === indicatorDef?.code_structure) return selected

  const groupCodes = []
  if (Array.isArray(indicatorDef?.groupes)) groupCodes.push(...indicatorDef.groupes)
  else if (typeof indicatorDef?.groupes === 'string') {
    try {
      const parsed = JSON.parse(indicatorDef.groupes)
      if (Array.isArray(parsed)) groupCodes.push(...parsed)
      else if (indicatorDef.groupes.trim()) groupCodes.push(indicatorDef.groupes.trim())
    } catch {
      if (indicatorDef.groupes.trim()) groupCodes.push(indicatorDef.groupes.trim())
    }
  }
  if (indicatorDef?.code_groupe) groupCodes.push(indicatorDef.code_groupe)
  const uniqueCodes = [...new Set(groupCodes.filter(Boolean).map(v => String(v).trim()))]

  if (uniqueCodes.length) {
    const { data: groups, error: groupsError } = await supabase
      .from('groupe_indicateurs')
      .select('code_groupe, gestionnaire, gestionnaires')
      .in('code_groupe', uniqueCodes)
    if (groupsError) throw groupsError
    const managerSet = new Set()
    ;(groups || []).forEach(group => {
      if (group?.gestionnaire) managerSet.add(String(group.gestionnaire).trim().toLowerCase())
      normalizeManagerList(group?.gestionnaires).forEach(v => {
        const value = String(v || '').trim().toLowerCase()
        if (value) managerSet.add(value)
      })
    })
    if (managerSet.has(selected.toLowerCase())) return selected
  }

  throw makeHttpError(400, "Le responsable doit être membre de la structure de l'indicateur ou gestionnaire du groupe d'indicateurs")
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
import { sendEmail, getIndicatorOccurrenceEmailTemplate, getIndicatorRejectionEmailTemplate } from '@/lib/email'


const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const stringifyJsonArray = (value) => JSON.stringify(Array.isArray(value) ? value : [])


const normalizeUsername = (value) => String(value || '').trim().toLowerCase()

async function getIndicatorUpdateAccessContext(supabase, occurrence, actorUsername) {
  const normalizedActor = normalizeUsername(actorUsername)
  if (!occurrence || !normalizedActor) {
    return { canWorkflow: false, canFullEdit: false, canLimitedEdit: false }
  }

  const { data: actor } = await supabase
    .from('users')
    .select('username, type_utilisateur')
    .eq('username', actorUsername)
    .maybeSingle()

  let linkedIndicator = null
  const occurrenceIndicatorCode = occurrence?.code_indicateur || occurrence?.code_indicateur_occ || null
  if (occurrenceIndicatorCode != null) {
    const { data: indicatorData } = await supabase
      .from('indicateurs')
      .select('code_indicateur, responsable, code_structure, code_groupe, groupes')
      .eq('code_indicateur', occurrenceIndicatorCode)
      .maybeSingle()
    linkedIndicator = indicatorData || null
  }

  let isManagedIndicatorGroup = false
  if (linkedIndicator) {
    const groupCodes = []
    if (Array.isArray(linkedIndicator.groupes)) groupCodes.push(...linkedIndicator.groupes)
    else if (typeof linkedIndicator.groupes === 'string') {
      try {
        const parsed = JSON.parse(linkedIndicator.groupes)
        if (Array.isArray(parsed)) groupCodes.push(...parsed)
        else if (linkedIndicator.groupes.trim()) groupCodes.push(linkedIndicator.groupes.trim())
      } catch {
        if (linkedIndicator.groupes.trim()) groupCodes.push(linkedIndicator.groupes.trim())
      }
    }
    if (linkedIndicator.code_groupe) groupCodes.push(linkedIndicator.code_groupe)

    const uniqueGroupCodes = [...new Set(groupCodes.filter(Boolean).map(v => String(v).trim()))]
    if (uniqueGroupCodes.length) {
      const { data: managedGroups } = await supabase
        .from('groupe_indicateurs')
        .select('code_groupe, gestionnaire, gestionnaires')
        .in('code_groupe', uniqueGroupCodes)
      isManagedIndicatorGroup = (managedGroups || []).some((group) => {
        const managers = [group?.gestionnaire]
        if (Array.isArray(group?.gestionnaires)) managers.push(...group.gestionnaires)
        else if (typeof group?.gestionnaires === 'string') {
          try {
            const parsed = JSON.parse(group.gestionnaires)
            if (Array.isArray(parsed)) managers.push(...parsed)
            else managers.push(...group.gestionnaires.split(/[;,]/))
          } catch {
            managers.push(...group.gestionnaires.split(/[;,]/))
          }
        }
        return managers.filter(Boolean).map(normalizeUsername).includes(normalizedActor)
      })
    }
  }

  const canWorkflow = !!actor && (actor.type_utilisateur === 'Super admin' || isManagedIndicatorGroup)
  const canFullEdit = canWorkflow

  const indicatorResponsible = String(occurrence?.responsable || linkedIndicator?.responsable || '').trim()
  const indicatorStructure = String(occurrence?.code_structure || occurrence?.structure || linkedIndicator?.code_structure || '').trim()

  let canLimitedEdit = false
  if (normalizeUsername(indicatorResponsible) === normalizedActor) {
    canLimitedEdit = true
  }

  if (!canLimitedEdit && indicatorResponsible) {
    const { data: responsibleUser } = await supabase
      .from('users')
      .select('username, superieur')
      .eq('username', indicatorResponsible)
      .maybeSingle()
    if (normalizeUsername(responsibleUser?.superieur) === normalizedActor) {
      canLimitedEdit = true
    }
  }

  if (!canLimitedEdit && indicatorStructure) {
    const { data: managedStructure } = await supabase
      .from('structures')
      .select('code_structure, responsable_structure')
      .eq('code_structure', indicatorStructure)
      .eq('responsable_structure', actorUsername)
      .maybeSingle()
    if (managedStructure) {
      canLimitedEdit = true
    }
  }

  return { canWorkflow, canFullEdit, canLimitedEdit }
}

const buildWorkflowEntry = ({ actor, decision, comment, previous_value = null, new_value = null, metadata = {} }) => ({
  id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  created_at: new Date().toISOString(),
  actor: actor || null,
  decision,
  comment: comment || '',
  previous_value,
  new_value,
  metadata
})

const upsertLatestWorkflowCommentEntry = (workflowHistory, { actor, decision, comment, previous_value = null, new_value = null, metadata = {} }) => {
  const nextHistory = Array.isArray(workflowHistory) ? [...workflowHistory] : []
  const editableDecisions = ['commentaire', 'reponse_responsable']
  for (let i = nextHistory.length - 1; i >= 0; i -= 1) {
    if (editableDecisions.includes(nextHistory[i]?.decision)) {
      nextHistory[i] = {
        ...nextHistory[i],
        actor: actor || nextHistory[i]?.actor || null,
        decision,
        comment: comment || '',
        previous_value,
        new_value,
        metadata,
        updated_at: new Date().toISOString(),
      }
      return nextHistory
    }
  }
  nextHistory.push(buildWorkflowEntry({ actor, decision, comment, previous_value, new_value, metadata }))
  return nextHistory
}

async function sendIndicatorRejectedEmail(supabase, occurrence, comment, rejectorUsername, rejectedValue) {
  const { data: indicatorData } = await supabase
    .from('indicateurs')
    .select('libelle_indicateur, code_structure, responsable')
    .eq('code_indicateur', occurrence?.code_indicateur)
    .maybeSingle()
  const responsibleUsername = occurrence?.responsable || indicatorData?.responsable || null
  const { data: responsibleUser } = await supabase.from('users').select('username, nom, prenoms').eq('username', responsibleUsername).maybeSingle()
  const { data: rejectorUser } = await supabase.from('users').select('username, nom, prenoms').eq('username', rejectorUsername).maybeSingle()
  if (!responsibleUser?.username) return
  const rejectorName = [rejectorUser?.prenoms, rejectorUser?.nom].filter(Boolean).join(' ').trim() || rejectorUsername || '-'
  const tpl = getIndicatorRejectionEmailTemplate(responsibleUser, {
    libelle_indicateur: indicatorData?.libelle_indicateur || occurrence?.libelle_indicateur || 'Indicateur',
    commentaire: comment,
    rejector: rejectorUsername,
    rejectorName,
    valeur_rejetee: rejectedValue,
    structure: occurrence?.code_structure || indicatorData?.code_structure || '-',
    periode: occurrence?.periode || '-',
  })
  await sendEmail({ to: responsibleUser.username, subject: tpl.subject, htmlContent: tpl.htmlContent, textContent: tpl.textContent })
}

// Fonction helper pour envoyer email au responsable d'un indicateur
async function sendIndicatorOccurrenceEmail(supabase, codeIndicateur, occurrenceData, assignateurUsername = null) {
  try {
    // Récupérer l'indicateur avec son responsable
    const { data: indicateur } = await supabase
      .from('indicateurs')
      .select('libelle_indicateur, responsable, code_structure')
      .eq('code_indicateur', codeIndicateur)
      .maybeSingle()

    const responsableUsername = occurrenceData?.responsable || indicateur?.responsable
    if (!indicateur || !responsableUsername) return

    // Récupérer les infos du responsable
    const { data: user } = await supabase
      .from('users')
      .select('username, prenoms, nom')
      .eq('username', responsableUsername)
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

    const supabase = createAdminClient(request)
    
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
    const supabase = createAdminClient(request)

    // Interdire la modification uniquement pour les indicateurs du groupe Risque sur une période fermée
    if (body?.periode && body?.code_indicateur) {
      const isLocked = await isClosedRiskPeriod(supabase, body.periode, body.code_indicateur)
      if (isLocked) {
        return NextResponse.json({ error: 'Période fermée : modification impossible' }, { status: 403 })
      }
    }

    // Validation minimale
    if (!body.code_indicateur) {
      return NextResponse.json({ error: 'Code indicateur obligatoire' }, { status: 400 })
    }

    const { data: indicatorDef, error: indicatorError } = await supabase
      .from('indicateurs')
      .select('code_indicateur, statut, responsable, code_structure, code_groupe, groupes')
      .eq('code_indicateur', body.code_indicateur)
      .maybeSingle()

    if (indicatorError) {
      return NextResponse.json({ error: indicatorError.message }, { status: 500 })
    }
    if (!indicatorDef) {
      return NextResponse.json({ error: 'Indicateur introuvable' }, { status: 404 })
    }
    if (String(indicatorDef.statut || 'Actif').trim() !== 'Actif') {
      return NextResponse.json({ error: "Impossible de créer une occurrence pour un indicateur inactif" }, { status: 400 })
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

    const indicateur = await getIndicateurDefinition(supabase, body.code_indicateur)
    const requiresTarget = indicateurRequiresTarget(indicateur)
    if (requiresTarget && (body.cible === null || body.cible === undefined || String(body.cible).trim() === '')) {
      return NextResponse.json({ error: 'Cible obligatoire pour cet indicateur' }, { status: 400 })
    }
    // Le responsable d'une occurrence est désormais celui de l'indicateur.
    // Compatibilité schéma: certaines bases n'ont pas de colonne `responsable` dans indicateur_occurrences.
    // On le conserve uniquement pour les contrôles et notifications, sans l'insérer dans cette table.
    const occurrenceResponsible = await validateOccurrenceResponsible(supabase, indicatorDef, indicatorDef.responsable)

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
        cible: requiresTarget && body.cible != null && String(body.cible).trim() !== '' ? parseFloat(body.cible) : null,
        val_numerateur: body.val_numerateur != null ? parseFloat(body.val_numerateur) : null,
        val_denominateur: body.val_denominateur != null ? parseFloat(body.val_denominateur) : null,
        val_indicateur: body.val_indicateur != null ? parseFloat(body.val_indicateur) : null,
        date_saisie: body.date_saisie || null,
        commentaire: body.commentaire || null,
        modificateur: body.modificateur || body.createur || null,
        date_modification: new Date().toISOString(),
        nb_jr_retard: nb_jr_retard,
        statut: statut,
        validation_status: body.val_indicateur != null ? 'Attente de validation' : 'Non renseigné',
        validation_history: stringifyJsonArray([])
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
      cible: body.cible,
      responsable: occurrenceResponsible
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
    const supabase = createAdminClient(request)

    // Interdire la modification uniquement pour les indicateurs du groupe Risque sur une période fermée
    if (body?.periode && body?.code_indicateur) {
      const isLocked = await isClosedRiskPeriod(supabase, body.periode, body.code_indicateur)
      if (isLocked) {
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

    const resolvedPeriodeForLock = body?.periode ?? existing?.periode ?? null
    const resolvedCodeForLock = body?.code_indicateur ?? existing?.code_indicateur ?? null
    if (resolvedPeriodeForLock && resolvedCodeForLock) {
      const isLocked = await isClosedRiskPeriod(supabase, resolvedPeriodeForLock, resolvedCodeForLock)
      if (isLocked) {
        return NextResponse.json({ error: 'Période fermée : modification impossible' }, { status: 403 })
      }
    }


    let workflowHistory = parseJsonArray(existing?.validation_history)
    const previousValue = existing?.val_indicateur
    const nextValue = body.val_indicateur != null ? body.val_indicateur : existing?.val_indicateur
    const isRejectAction = body.validation_decision === 'reject'
    const isApproveAction = body.validation_decision === 'approve'
    const isCancelApprovalAction = body.validation_decision === 'cancel_approval'
    const normalizedValidationStatus = String(existing?.validation_status || '').trim().toLowerCase()
    const hasOutstandingRejection = normalizedValidationStatus === 'rejetée' || normalizedValidationStatus === 'rejetee' || !!String(existing?.last_rejection_comment || '').trim()
    const hasSubmittedValue = !(body.val_indicateur === null || body.val_indicateur === undefined || String(body.val_indicateur).trim() === '')
    const hasExistingIndicatorComment = !!String(existing?.commentaire || '').trim()
    const isReplyRequired = !isApproveAction && !isRejectAction && hasOutstandingRejection && hasSubmittedValue
    if (isRejectAction && !String(body.validation_comment || '').trim()) {
      return NextResponse.json({ error: 'Le commentaire de rejet est obligatoire' }, { status: 400 })
    }
    const accessContext = await getIndicatorUpdateAccessContext(supabase, existing, body.modificateur)
    const { canWorkflow, canFullEdit, canLimitedEdit } = accessContext

    if (!canFullEdit && !canLimitedEdit) {
      return NextResponse.json({ error: "Vous n'êtes pas autorisé à modifier cet indicateur" }, { status: 403 })
    }

    if (isApproveAction || isRejectAction || isCancelApprovalAction) {
      if (!canWorkflow) {
        return NextResponse.json({ error: 'Seuls les gestionnaires du groupe concerné ou un super administrateur peuvent valider, rejeter ou annuler une validation' }, { status: 403 })
      }
    }
    if (['validé', 'valide'].includes(normalizedValidationStatus) && !isCancelApprovalAction) {
      return NextResponse.json({ error: "Cet indicateur est validé et ne peut plus être modifié tant que la validation n'a pas été annulée" }, { status: 403 })
    }
    if (isReplyRequired && !String(body.commentaire || '').trim()) {
      return NextResponse.json({ error: 'Vous devez répondre au commentaire du gestionnaire avant la nouvelle soumission' }, { status: 400 })
    }

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

    const indicateur = await getIndicateurDefinition(supabase, resolvedCodeForLock || body.code_indicateur)
    const requiresTarget = indicateurRequiresTarget(indicateur)
    if (canFullEdit && requiresTarget && !isApproveAction && !isRejectAction && !isCancelApprovalAction && (body.cible === null || body.cible === undefined || String(body.cible).trim() === '')) {
      return NextResponse.json({ error: 'Cible obligatoire pour cet indicateur' }, { status: 400 })
    }
    // Ne pas écrire `responsable` dans indicateur_occurrences : le responsable est porté par l'indicateur.

    const updateData = {
      periode: body.periode || null,
      annee: body.annee || null,
      date_debut: body.date_debut,
      date_fin: body.date_fin,
      date_limite_saisie: body.date_limite_saisie,
      cible: requiresTarget && body.cible != null && String(body.cible).trim() !== '' ? parseFloat(body.cible) : null,
      val_numerateur: body.val_numerateur,
      val_denominateur: body.val_denominateur,
      val_indicateur: body.val_indicateur,
      date_saisie: dateSaisie,
      nb_jr_retard: body.nb_jr_retard,
      statut: body.statut,
      commentaire: body.commentaire || null,
      validation_status: body.validation_status || existing?.validation_status || 'Non renseigné',
      modificateur: body.modificateur,
      date_modification: new Date().toISOString()
    }


    if (!canFullEdit && canLimitedEdit) {
      updateData.periode = existing?.periode || null
      updateData.annee = existing?.annee || null
      updateData.date_debut = existing?.date_debut || null
      updateData.date_fin = existing?.date_fin || null
      updateData.date_limite_saisie = existing?.date_limite_saisie || null
      updateData.cible = existing?.cible != null ? parseFloat(existing.cible) : null
      updateData.nb_jr_retard = existing?.nb_jr_retard ?? null
      updateData.statut = existing?.statut ?? null
    }

    if (hasSubmittedValue && !isApproveAction && !isRejectAction && !isCancelApprovalAction) {
      updateData.validation_status = 'Attente de validation'
      updateData.last_rejection_comment = null
      updateData.last_rejected_by = null
    }

    if (isApproveAction) {
      updateData.validation_status = 'Validé'
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: 'validation',
        comment: body.validation_comment || body.commentaire || '',
        previous_value: previousValue,
        new_value: nextValue,
      }))
    }

    if (isCancelApprovalAction) {
      updateData.validation_status = 'Attente de validation'
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: 'annulation_validation',
        comment: body.validation_comment || 'Validation annulée par le gestionnaire',
        previous_value: previousValue,
        new_value: nextValue,
      }))
    }

    if (isRejectAction) {
      updateData.validation_status = 'Rejetée'
      updateData.rejected_value = previousValue
      updateData.last_rejection_comment = body.validation_comment
      updateData.last_rejected_by = body.modificateur || null
      updateData.val_numerateur = null
      updateData.val_denominateur = null
      updateData.val_indicateur = null
      updateData.date_saisie = null
      updateData.commentaire = null
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: 'rejet',
        comment: body.validation_comment,
        previous_value: previousValue,
        new_value: null,
        metadata: { rejected_value: previousValue },
      }))
    } else if (isReplyRequired) {
      updateData.validation_status = 'Attente de validation'
      if (hasExistingIndicatorComment) {
        workflowHistory = upsertLatestWorkflowCommentEntry(workflowHistory, {
          actor: body.modificateur,
          decision: 'reponse_responsable',
          comment: body.commentaire,
          previous_value: previousValue,
          new_value: nextValue,
        })
      } else {
        workflowHistory.push(buildWorkflowEntry({
          actor: body.modificateur,
          decision: 'reponse_responsable',
          comment: body.commentaire,
          previous_value: previousValue,
          new_value: nextValue,
        }))
      }
    } else if (body.commentaire !== undefined && String(body.commentaire || '').trim()) {
      if (hasExistingIndicatorComment) {
        workflowHistory = upsertLatestWorkflowCommentEntry(workflowHistory, {
          actor: body.modificateur,
          decision: 'commentaire',
          comment: body.commentaire,
          previous_value: previousValue,
          new_value: nextValue,
        })
      } else {
        workflowHistory.push(buildWorkflowEntry({
          actor: body.modificateur,
          decision: 'commentaire',
          comment: body.commentaire,
          previous_value: previousValue,
          new_value: nextValue,
        }))
      }
    }
    updateData.validation_history = stringifyJsonArray(workflowHistory)

    // Mise à jour
    const { data, error } = await supabase
      .from('indicateur_occurrences')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .maybeSingle()

    if (error) throw error


    if (isRejectAction) {
      try {
        await sendIndicatorRejectedEmail(supabase, data || existing, body.validation_comment, body.modificateur, previousValue)
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email rejet indicateur:', emailError)
      }
    }

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

    const supabase = createAdminClient(request)

    // Interdire suppression si l'occurrence appartient à une période fermée
    const { data: occToDelete, error: occErr } = await supabase
      .from('indicateur_occurrences')
      .select('periode, code_indicateur')
      .eq('id', body.id)
      .maybeSingle()

    if (occErr) throw occErr

    if (occToDelete?.periode && occToDelete?.code_indicateur) {
      const isLocked = await isClosedRiskPeriod(supabase, occToDelete.periode, occToDelete.code_indicateur)
      if (isLocked) {
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