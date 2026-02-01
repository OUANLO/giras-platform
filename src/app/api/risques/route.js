import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

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

// GET - Récupérer tous les risques
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const structure = searchParams.get('structure')
    const processusFilter = searchParams.get('processus')
    const statut = searchParams.get('statut')
    const categorie = searchParams.get('categorie')

    const supabase = createAdminClient()
    
    // Récupérer les risques
    let query = supabase
      .from('risques')
      .select('*')
      .order('code_risque', { ascending: true })

    if (structure) query = query.eq('code_structure', structure)
    if (processusFilter) query = query.eq('code_processus', processusFilter)
    if (statut) query = query.eq('statut', statut)
    if (categorie) query = query.contains('categories', [parseInt(categorie)])

    const { data: risquesData, error: risquesError } = await query

    if (risquesError) {
      console.error('Erreur requête risques:', risquesError)
      if (risquesError.code === '42P01' || risquesError.message?.includes('does not exist')) {
        return NextResponse.json({ risques: [], message: 'Table risques non trouvée' })
      }
      throw risquesError
    }

    // Récupérer processus et indicateurs pour enrichir les données
    const [processusRes, indicateursRes, structuresRes] = await Promise.all([
      supabase.from('processus').select('code_processus, libelle_processus'),
      supabase.from('indicateurs').select('*'),
      supabase.from('structures').select('code_structure, libelle_structure')
    ])

    const processusMap = {}
    const indicateursMap = {}
    const structuresMap = {}

    if (processusRes.data) {
      processusRes.data.forEach(p => { processusMap[p.code_processus] = p })
    }
    if (indicateursRes.data) {
      // Mapper par code_indicateur (peut être int ou string)
      indicateursRes.data.forEach(i => { 
        indicateursMap[i.code_indicateur] = i 
        indicateursMap[String(i.code_indicateur)] = i // Aussi en string
        // Aussi mapper par id si différent de code_indicateur
        if (i.id && i.id !== i.code_indicateur) {
          indicateursMap[i.id] = i
          indicateursMap[String(i.id)] = i
        }
      })
    }
    if (structuresRes.data) {
      structuresRes.data.forEach(s => { structuresMap[s.code_structure] = s })
    }

    // Enrichir les risques avec les données liées
    const risques = (risquesData || []).map(r => {
      // Essayer plusieurs clés pour l'indicateur
      let indicateur = null
      if (r.code_indicateur) {
        indicateur = indicateursMap[r.code_indicateur] || indicateursMap[String(r.code_indicateur)] || null
      }
      // Si toujours null, essayer avec id_indicateur
      if (!indicateur && r.id_indicateur) {
        indicateur = indicateursMap[r.id_indicateur] || indicateursMap[String(r.id_indicateur)] || null
      }
      
      return {
        ...r,
        processus: processusMap[r.code_processus] || null,
        indicateur,
        structure: structuresMap[r.code_structure] || null
      }
    })

    return NextResponse.json({ risques })
  } catch (error) {
    console.error('Erreur GET risques:', error)
    return NextResponse.json({ risques: [], error: error.message })
  }
}

// POST - Créer un nouveau risque
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    // Validation complète de tous les champs obligatoires
    const requiredFields = ['code_risque', 'libelle_risque', 'code_processus', 'code_structure', 'cause', 'consequence', 'impact', 'efficacite_contr', 'date_vigueur']
    const missingFields = requiredFields.filter(f => !body[f] || body[f] === '')
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Champs obligatoires manquants: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Vérifier si le code risque existe déjà (utiliser maybeSingle au lieu de single)
    const { data: existing, error: checkError } = await supabase
      .from('risques')
      .select('code_risque')
      .eq('code_risque', body.code_risque)
      .maybeSingle()

    if (checkError) {
      console.error('Erreur vérification code risque:', checkError)
      // Continuer si c'est juste une erreur de table inexistante
    }

    if (existing) {
      return NextResponse.json(
        { error: `Le code risque ${body.code_risque} existe déjà` },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('risques')
      .insert({
        code_risque: body.code_risque,
        libelle_risque: body.libelle_risque,
        code_processus: body.code_processus,
        code_structure: body.code_structure,
        cause: body.cause,
        consequence: body.consequence,
        impact: body.impact,
        efficacite_contr: body.efficacite_contr,
        qualitatif: body.qualitatif || 'Non',
        code_indicateur: body.code_indicateur || null,
        categories: body.categories || [],
        date_vigueur: body.date_vigueur,
        statut: body.statut || 'Actif',
        createur: body.createur
      })
      .select()
      .single()

    if (error) {
      console.error('Erreur insertion risque:', error)
      return NextResponse.json({ error: error.message || 'Erreur lors de la création du risque' }, { status: 500 })
    }

    // Logger l'action (ignorer les erreurs)
    try {
      await supabase.from('logs').insert({
        utilisateur: body.createur,
        action: 'CREATE',
        table_concernee: 'risques',
        id_enregistrement: data.id,
        details: { code_risque: data.code_risque }
      })
    } catch (logError) {
      console.log('Log non enregistré:', logError)
    }

    return NextResponse.json({ risque: data })
  } catch (error) {
    console.error('Erreur POST risque:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Mettre à jour un risque
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('risques')
      .update({
        libelle_risque: body.libelle_risque,
        code_processus: body.code_processus,
        code_structure: body.code_structure,
        cause: body.cause,
        consequence: body.consequence,
        impact: body.impact,
        efficacite_contr: body.efficacite_contr,
        qualitatif: body.qualitatif,
        code_indicateur: body.code_indicateur,
        categories: body.categories,
        date_vigueur: body.date_vigueur,
        statut: body.statut,
        modificateur: body.modificateur
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) throw error

    // (2026-01) risques_probabilites est réservé aux probabilités saisies manuellement.
    // Aucune synchronisation automatique n'est effectuée ici.

    return NextResponse.json({ risque: data })
  } catch (error) {
    console.error('Erreur PUT risque:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer un risque
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Vérifier d'abord si le risque existe
    const { data: risque, error: fetchError } = await supabase
      .from('risques')
      .select('code_risque')
      .eq('id', id)
      .single()

    if (fetchError || !risque) {
      return NextResponse.json({ error: 'Risque non trouvé' }, { status: 404 })
    }

    // Supprimer d'abord les actions liées (si la table existe)
    try {
      await supabase
        .from('actions_risques')
        .delete()
        .eq('code_risque', risque.code_risque)
    } catch (delError) {
      console.log('Actions risques non supprimées:', delError)
    }

    // Maintenant supprimer le risque
    const { error } = await supabase
      .from('risques')
      .delete()
      .eq('id', id)

    if (error) {
      // Vérifier si c'est une erreur de contrainte de clé étrangère
      if (error.code === '23503' || error.message?.includes('foreign key')) {
        return NextResponse.json({ 
          error: 'Impossible de supprimer: ce risque est référencé par d\'autres enregistrements' 
        }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ success: true, message: `Risque ${risque.code_risque} supprimé` })
  } catch (error) {
    console.error('Erreur DELETE risque:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
