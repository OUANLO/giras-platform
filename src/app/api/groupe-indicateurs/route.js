import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET - Récupérer les groupes d'indicateurs
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const gestionnaire = searchParams.get('gestionnaire')
    const statut = searchParams.get('statut')
    const code_groupe = searchParams.get('code_groupe')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('groupe_indicateurs')
      .select('*')
      .order('code_groupe', { ascending: true })

    if (statut) query = query.eq('statut', statut)
    if (code_groupe) query = query.eq('code_groupe', code_groupe)

    let { data, error } = await query

    if (error) {
      console.error('Erreur requête groupe_indicateurs:', error)
      return NextResponse.json({ groupes: [], message: error.message })
    }

    // Filtrer par gestionnaire si spécifié (dans gestionnaires array)
    if (gestionnaire && data) {
      data = data.filter(g => 
        g.gestionnaires?.includes(gestionnaire) || g.gestionnaire === gestionnaire
      )
    }

    return NextResponse.json({ groupes: data || [] })
  } catch (error) {
    console.error('Erreur GET groupe_indicateurs:', error)
    return NextResponse.json({ groupes: [], message: error.message })
  }
}

// POST - Créer un groupe d'indicateurs
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.code_groupe || !body.libelle_groupe) {
      return NextResponse.json({ error: 'Code et libellé obligatoires' }, { status: 400 })
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

    if (!body.gestionnaires || body.gestionnaires.length === 0) {
      return NextResponse.json({ error: 'Au moins un gestionnaire requis' }, { status: 400 })
    }

    // Vérifier si le code existe déjà
    const { data: existing } = await supabase
      .from('groupe_indicateurs')
      .select('code_groupe')
      .eq('code_groupe', code)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: `Le code groupe "${code}" existe déjà` }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('groupe_indicateurs')
      .insert({
        code_groupe: code,
        libelle_groupe: body.libelle_groupe,
        commentaire: body.commentaire,
        gestionnaire: body.gestionnaires[0],
        gestionnaires: body.gestionnaires,
        statut: body.statut || 'Actif',
        createur: body.createur
      })
      .select()
      .single()

    if (error) {
      console.error('Erreur insertion groupe:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ groupe: data, message: 'Groupe créé avec succès' })
  } catch (error) {
    console.error('Erreur POST groupe_indicateurs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Modifier un groupe d'indicateurs
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    // Permettre la mise à jour par id OU par code_groupe
    if (!body.id && !body.code_groupe) {
      return NextResponse.json({ error: 'ID ou code_groupe requis' }, { status: 400 })
    }

    // D'abord vérifier si le groupe existe
    let existingQuery = supabase.from('groupe_indicateurs').select('*')
    if (body.id) {
      existingQuery = existingQuery.eq('id', body.id)
    } else {
      existingQuery = existingQuery.eq('code_groupe', body.code_groupe)
    }
    const { data: existing } = await existingQuery.maybeSingle()

    // Si le groupe n'existe pas et qu'on a un code_groupe, le créer
    if (!existing && body.code_groupe) {
      const insertData = {
        code_groupe: body.code_groupe,
        libelle_groupe: body.libelle_groupe || body.code_groupe,
        gestionnaire: body.gestionnaires?.[0] || null,
        gestionnaires: body.gestionnaires || [],
        statut: body.statut || 'Actif',
        createur: body.modificateur
      }
      
      const { data: newData, error: insertError } = await supabase
        .from('groupe_indicateurs')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        console.error('Erreur création groupe:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ groupe: newData, message: 'Groupe créé avec succès' })
    }

    if (!existing) {
      return NextResponse.json({ error: 'Groupe non trouvé' }, { status: 404 })
    }

    const updateData = {
      modificateur: body.modificateur,
      date_modification: new Date().toISOString()
    }

    // Mettre à jour seulement les champs fournis
    if (body.libelle_groupe !== undefined) updateData.libelle_groupe = body.libelle_groupe
    if (body.commentaire !== undefined) updateData.commentaire = body.commentaire
    if (body.statut !== undefined) updateData.statut = body.statut

    if (body.gestionnaires && body.gestionnaires.length > 0) {
      updateData.gestionnaire = body.gestionnaires[0]
      updateData.gestionnaires = body.gestionnaires
    } else if (body.gestionnaires && body.gestionnaires.length === 0) {
      // Permettre de vider les gestionnaires si explicitement demandé
      updateData.gestionnaire = null
      updateData.gestionnaires = []
    }

    const { data, error } = await supabase
      .from('groupe_indicateurs')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      console.error('Erreur update groupe:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ groupe: data, message: 'Groupe modifié avec succès' })
  } catch (error) {
    console.error('Erreur PUT groupe_indicateurs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer un groupe d'indicateurs
export async function DELETE(request) {
  try {
    const body = await request.json()
    const id = body.id

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: groupe } = await supabase
      .from('groupe_indicateurs')
      .select('code_groupe, is_default')
      .eq('id', id)
      .single()

    if (groupe?.is_default) {
      return NextResponse.json({ error: 'Impossible de supprimer le groupe par défaut' }, { status: 400 })
    }

    if (groupe?.code_groupe) {
      const { data: linkedIndicateurs } = await supabase
        .from('indicateurs')
        .select('code_indicateur')
        .or(`code_groupe.eq.${groupe.code_groupe},groupes.cs.{${groupe.code_groupe}}`)
        .limit(1)

      if (linkedIndicateurs && linkedIndicateurs.length > 0) {
        return NextResponse.json({ 
          error: 'Impossible de supprimer: des indicateurs sont liés à ce groupe' 
        }, { status: 400 })
      }
    }

    const { error } = await supabase
      .from('groupe_indicateurs')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erreur delete groupe:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Groupe supprimé' })
  } catch (error) {
    console.error('Erreur DELETE groupe_indicateurs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
