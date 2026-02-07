import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET - Récupérer les messages flash
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') // Si 'all=true', récupérer tous les messages (pour admin)

    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    
    let query = supabase
      .from('infos_flash')
      .select('*')
      .order('date_creation', { ascending: false })

    // Si all n'est pas true, filtrer seulement les actifs dans les dates
    if (all !== 'true') {
      query = query
        .eq('statut', 'Actif')
        .lte('date_debut', today)
        .gte('date_fin', today)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ messages: data || [] })
  } catch (error) {
    console.error('Erreur GET flash:', error)
    return NextResponse.json({ messages: [] })
  }
}

// POST - Créer un nouveau message flash
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.info || !body.date_debut || !body.date_fin) {
      return NextResponse.json(
        { error: 'Message, date début et date fin requis' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('infos_flash')
      .insert({
        info: body.info,
        date_debut: body.date_debut,
        date_fin: body.date_fin,
        statut: body.statut || 'Actif',
        createur: body.createur
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ flash: data })
  } catch (error) {
    console.error('Erreur POST flash:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Mettre à jour un message flash
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('infos_flash')
      .update({
        info: body.info,
        date_debut: body.date_debut,
        date_fin: body.date_fin,
        statut: body.statut
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ flash: data })
  } catch (error) {
    console.error('Erreur PUT flash:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer un message flash
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('infos_flash')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur DELETE flash:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
