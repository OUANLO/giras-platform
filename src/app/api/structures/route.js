import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET - Récupérer toutes les structures
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('structures')
      .select('*')
      .order('code_structure', { ascending: true })

    if (statut) query = query.eq('statut', statut)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ structures: data })
  } catch (error) {
    console.error('Erreur GET structures:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Créer une nouvelle structure
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.code_structure || !body.libelle_structure) {
      return NextResponse.json(
        { error: 'Code et libellé requis' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('structures')
      .insert({
        code_structure: body.code_structure.toUpperCase(),
        libelle_structure: body.libelle_structure,
        statut: body.statut || 'Actif',
        createur: body.createur
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ce code ou libellé existe déjà' },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({ structure: data })
  } catch (error) {
    console.error('Erreur POST structure:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Mettre à jour une structure
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('structures')
      .update({
        libelle_structure: body.libelle_structure,
        statut: body.statut,
        modificateur: body.modificateur
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ structure: data })
  } catch (error) {
    console.error('Erreur PUT structure:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer une structure
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Vérifier qu'aucun utilisateur n'est lié
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('structure', id)
      .limit(1)

    if (users?.length > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer : des utilisateurs sont liés à cette structure' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('structures')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur DELETE structure:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
