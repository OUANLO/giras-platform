import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail, getIndicatorAssignmentEmailTemplate } from '@/lib/email'

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

async function getOpenPeriode(supabase) {
  const { data, error } = await supabase
    .from('periodes_evaluation')
    .select('id, annee, semestre, trimestre, mois, date_debut, date_fin, statut')
  if (error) throw error
  const open = (data || []).find(p => `${p.statut}`.toLowerCase() === 'ouverte' || `${p.statut}`.toLowerCase() === 'ouvert')
  if (!open) return null
  return {
    id: open.id,
    libelle: buildPeriodeLibelle(open),
    date_debut: open.date_debut,
    date_fin: open.date_fin,
    statut: open.statut,
  }
}

// GET - Récupérer les indicateurs
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const code_groupe = searchParams.get('code_groupe') || searchParams.get('groupe')
    const code_structure = searchParams.get('code_structure')
    const statut = searchParams.get('statut')
    const responsable = searchParams.get('responsable')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('indicateurs')
      .select(`
        *,
        groupe:groupe_indicateurs!indicateurs_code_groupe_fkey(code_groupe, libelle_groupe)
      `)
      .order('code_indicateur', { ascending: true })

    if (code_structure) query = query.eq('code_structure', code_structure)
    if (statut) query = query.eq('statut', statut)
    if (responsable) query = query.eq('responsable', responsable)

    let { data, error } = await query

    if (error) {
      console.error('Erreur avec jointure:', error)
      let simpleQuery = supabase
        .from('indicateurs')
        .select('*')
        .order('code_indicateur', { ascending: true })

      if (code_structure) simpleQuery = simpleQuery.eq('code_structure', code_structure)
      if (statut) simpleQuery = simpleQuery.eq('statut', statut)
      if (responsable) simpleQuery = simpleQuery.eq('responsable', responsable)

      const result = await simpleQuery
      if (result.error) {
        console.error('Erreur requête simple:', result.error)
        return NextResponse.json({ indicateurs: [], message: result.error.message })
      }
      data = result.data
    }

    // Filtrer par groupe si spécifié
    if (code_groupe && data) {
      data = data.filter(ind => {
        // Vérifier dans le tableau groupes
        if (Array.isArray(ind.groupes)) {
          return ind.groupes.includes(code_groupe)
        }
        // Si groupes est une chaîne JSON
        if (typeof ind.groupes === 'string') {
          try {
            const parsed = JSON.parse(ind.groupes)
            return Array.isArray(parsed) && parsed.includes(code_groupe)
          } catch {
            return ind.groupes === code_groupe
          }
        }
        // Fallback sur code_groupe
        return ind.code_groupe === code_groupe
      })
    }

    return NextResponse.json({ indicateurs: data || [] })
  } catch (error) {
    console.error('Erreur GET indicateurs:', error)
    return NextResponse.json({ indicateurs: [], message: error.message })
  }
}

// POST - Créer un indicateur
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.libelle_indicateur) {
      return NextResponse.json({ error: 'Libellé obligatoire' }, { status: 400 })
    }
    if (!body.groupes || body.groupes.length === 0) {
      return NextResponse.json({ error: 'Au moins un groupe obligatoire' }, { status: 400 })
    }
    
    // Vérification: Risque ne peut pas être combiné avec d'autres groupes
    const hasRisque = body.groupes.includes('Risque')
    if (hasRisque && body.groupes.length > 1) {
      return NextResponse.json({ error: 'Le groupe Risque ne peut pas être combiné avec d\'autres groupes' }, { status: 400 })
    }

    // Si groupe Risque, périodicité forcée à Personnalise
    let periodicite = body.periodicite
    if (hasRisque) {
      periodicite = 'Personnalise'
    } else if (!periodicite) {
      return NextResponse.json({ error: 'Périodicité obligatoire' }, { status: 400 })
    }

    // Vérifier que le responsable appartient à la structure
    if (body.responsable && body.code_structure) {
      const { data: userCheck } = await supabase
        .from('users')
        .select('username, structure')
        .eq('username', body.responsable)
        .single()
      
      if (userCheck && userCheck.structure !== body.code_structure) {
        return NextResponse.json({ 
          error: 'Le responsable doit appartenir à la structure sélectionnée' 
        }, { status: 400 })
      }
    }

    const { data, error } = await supabase
      .from('indicateurs')
      .insert({
        libelle_indicateur: body.libelle_indicateur,
        code_groupe: body.groupes[0],
        groupes: body.groupes,
        code_structure: body.code_structure,
        type_indicateur: body.type_indicateur,
        periodicite: periodicite,
        numerateur: body.numerateur,
        denominateur: body.denominateur,
        source: body.source,
        sens: body.sens,
        seuil1: body.seuil1 ? parseFloat(body.seuil1) : null,
        seuil2: body.seuil2 ? parseFloat(body.seuil2) : null,
        seuil3: body.seuil3 ? parseFloat(body.seuil3) : null,
        responsable: body.responsable,
        commentaire: body.commentaire,
        statut: body.statut || 'Actif',
        createur: body.createur,
        date_creation: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Erreur insertion indicateur:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Envoyer email au responsable
    if (body.responsable) {
      try {
        const { data: responsableUser } = await supabase
          .from('users')
          .select('username, prenoms, nom')
          .eq('username', body.responsable)
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
          const emailTemplate = getIndicatorAssignmentEmailTemplate(responsableUser, {
            libelle_indicateur: body.libelle_indicateur,
            code_structure: body.code_structure,
            periodicite: periodicite,
            type_indicateur: body.type_indicateur,
            source: body.source
          }, assignateur)

          await sendEmail({
            to: responsableUser.username,
            subject: emailTemplate.subject,
            htmlContent: emailTemplate.htmlContent,
            textContent: emailTemplate.textContent
          })

          console.log(`[EMAIL] Email d'attribution d'indicateur envoyé à ${responsableUser.username}`)
        }
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email attribution indicateur:', emailError)
        // Ne pas bloquer la création si l'email échoue
      }
    }

    return NextResponse.json({ indicateur: data, message: 'Indicateur créé avec succès' })
  } catch (error) {
    console.error('Erreur POST indicateur:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Mettre à jour un indicateur
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // Récupérer l'ancien indicateur pour comparer le responsable
    const { data: oldIndicateur } = await supabase
      .from('indicateurs')
      .select('responsable, libelle_indicateur')
      .eq('id', body.id)
      .maybeSingle()

    // Vérification: Risque ne peut pas être combiné avec d'autres groupes
    if (body.groupes) {
      const hasRisque = body.groupes.includes('Risque')
      if (hasRisque && body.groupes.length > 1) {
        return NextResponse.json({ error: 'Le groupe Risque ne peut pas être combiné avec d\'autres groupes' }, { status: 400 })
      }
    }

    // Vérifier que le responsable appartient à la structure
    if (body.responsable && body.code_structure) {
      const { data: userCheck } = await supabase
        .from('users')
        .select('username, structure')
        .eq('username', body.responsable)
        .maybeSingle()
      
      if (userCheck && userCheck.structure !== body.code_structure) {
        return NextResponse.json({ 
          error: 'Le responsable doit appartenir à la structure sélectionnée' 
        }, { status: 400 })
      }
    }

    const updateData = {
      libelle_indicateur: body.libelle_indicateur,
      code_structure: body.code_structure,
      type_indicateur: body.type_indicateur,
      numerateur: body.numerateur,
      denominateur: body.denominateur,
      source: body.source,
      sens: body.sens,
      seuil1: body.seuil1 ? parseFloat(body.seuil1) : null,
      seuil2: body.seuil2 ? parseFloat(body.seuil2) : null,
      seuil3: body.seuil3 ? parseFloat(body.seuil3) : null,
      responsable: body.responsable,
      statut: body.statut,
      commentaire: body.commentaire,
      modificateur: body.modificateur,
      date_modification: new Date().toISOString()
    }

    // Mettre à jour les groupes si fournis
    if (body.groupes && body.groupes.length > 0) {
      updateData.code_groupe = body.groupes[0]
      updateData.groupes = body.groupes
    }

    const { data, error } = await supabase
      .from('indicateurs')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Erreur update indicateur:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Indicateur non trouvé' }, { status: 404 })
    }

    // Si le responsable a changé, envoyer un email au nouveau responsable
    if (body.responsable && oldIndicateur && body.responsable !== oldIndicateur.responsable) {
      try {
        const { data: responsableUser } = await supabase
          .from('users')
          .select('username, prenoms, nom')
          .eq('username', body.responsable)
          .maybeSingle()

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
          const emailTemplate = getIndicatorAssignmentEmailTemplate(responsableUser, {
            libelle_indicateur: body.libelle_indicateur || oldIndicateur.libelle_indicateur,
            code_structure: body.code_structure,
            periodicite: body.periodicite,
            type_indicateur: body.type_indicateur,
            source: body.source
          }, assignateur)

          await sendEmail({
            to: responsableUser.username,
            subject: emailTemplate.subject,
            htmlContent: emailTemplate.htmlContent,
            textContent: emailTemplate.textContent
          })

          console.log(`[EMAIL] Email d'attribution d'indicateur envoyé au nouveau responsable ${responsableUser.username}`)
        }
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email changement responsable indicateur:', emailError)
      }
    }

    // (2026-01) On ne synchronise plus risques_probabilites automatiquement :
    // cette table conserve uniquement les probabilités saisies manuellement.

    return NextResponse.json({ indicateur: data, message: 'Indicateur modifié' })
  } catch (error) {
    console.error('Erreur PUT indicateur:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer un indicateur
export async function DELETE(request) {
  try {
    const body = await request.json()
    
    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Vérifier s'il y a des occurrences liées
    const { data: indicateur } = await supabase
      .from('indicateurs')
      .select('code_indicateur')
      .eq('id', body.id)
      .single()

    if (indicateur) {
      const { data: occurrences } = await supabase
        .from('indicateur_occurrences')
        .select('id')
        .eq('code_indicateur', indicateur.code_indicateur)
        .limit(1)

      if (occurrences && occurrences.length > 0) {
        return NextResponse.json({ 
          error: 'Impossible de supprimer: des occurrences existent pour cet indicateur' 
        }, { status: 400 })
      }
    }

    const { error } = await supabase
      .from('indicateurs')
      .delete()
      .eq('id', body.id)

    if (error) {
      console.error('Erreur delete indicateur:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Indicateur supprimé' })
  } catch (error) {
    console.error('Erreur DELETE indicateur:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
