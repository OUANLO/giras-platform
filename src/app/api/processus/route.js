import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('processus')
      .select('*')
      .order('code_processus', { ascending: true })

    if (statut) query = query.eq('statut', statut)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ processus: data })
  } catch (error) {
    console.error('Erreur GET processus:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.code_processus || !body.libelle_processus) {
      return NextResponse.json({ error: 'Code et libellé requis' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('processus')
      .insert({
        code_processus: body.code_processus.toUpperCase(),
        libelle_processus: body.libelle_processus,
        statut: body.statut || 'Actif',
        createur: body.createur
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ce code ou libellé existe déjà' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ processus: data })
  } catch (error) {
    console.error('Erreur POST processus:', error)
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
      .from('processus')
      .update({
        libelle_processus: body.libelle_processus,
        statut: body.statut,
        modificateur: body.modificateur
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ processus: data })
  } catch (error) {
    console.error('Erreur PUT processus:', error)
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

    // Vérifier si des risques utilisent ce processus
    const { data: risques } = await supabase
      .from('risques')
      .select('id')
      .eq('code_processus', id)
      .limit(1)

    if (risques?.length > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer : des risques sont liés à ce processus' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('processus')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur DELETE processus:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
