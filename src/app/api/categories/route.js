import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut')
    const supabase = createAdminClient()
    let query = supabase.from('categories').select('*').order('code_categorie')
    if (statut) query = query.eq('statut', statut)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ categories: data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()
    
    if (!body.libelle_categorie) {
      return NextResponse.json({ error: 'Libellé requis' }, { status: 400 })
    }

    const { data, error } = await supabase.from('categories').insert({
      libelle_categorie: body.libelle_categorie,
      statut: body.statut || 'Actif',
      createur: body.createur
    }).select().single()
    
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Cette catégorie existe déjà' }, { status: 400 })
      }
      throw error
    }
    return NextResponse.json({ categorie: data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('categories')
      .update({
        libelle_categorie: body.libelle_categorie,
        statut: body.statut,
        modificateur: body.modificateur
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ categorie: data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
