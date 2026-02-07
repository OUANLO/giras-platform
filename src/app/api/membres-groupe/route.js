import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET - Récupérer les membres d'un groupe
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const codeGroupe = searchParams.get('code_groupe')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('membres_groupe')
      .select(`
        *,
        membre_user:users!membres_groupe_membre_fkey (
          username, nom, prenoms, structure, poste
        )
      `)
      .order('date_creation', { ascending: false })

    if (codeGroupe) {
      query = query.eq('code_groupe', codeGroupe)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ membres: data || [] })
  } catch (error) {
    console.error('Erreur GET membres_groupe:', error)
    return NextResponse.json({ membres: [], error: error.message }, { status: 500 })
  }
}

// POST - Ajouter un membre à un groupe
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.code_groupe || !body.membre) {
      return NextResponse.json(
        { error: 'Code groupe et membre requis' },
        { status: 400 }
      )
    }

    // Vérifier si le membre existe déjà dans le groupe
    const { data: existing } = await supabase
      .from('membres_groupe')
      .select('id')
      .eq('code_groupe', body.code_groupe)
      .eq('membre', body.membre)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Ce membre fait déjà partie du groupe' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('membres_groupe')
      .insert({
        code_groupe: body.code_groupe,
        membre: body.membre,
        createur: body.createur
      })
      .select(`
        *,
        membre_user:users!membres_groupe_membre_fkey (
          username, nom, prenoms, structure, poste
        )
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ membre: data })
  } catch (error) {
    console.error('Erreur POST membres_groupe:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Retirer un membre d'un groupe
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('membres_groupe')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur DELETE membres_groupe:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
