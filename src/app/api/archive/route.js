import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// POST - Archiver un élément
export async function POST(request) {
  try {
    const body = await request.json()
    const { type, id, archive_par } = body
    
    if (!type || !id) {
      return NextResponse.json({ error: 'Type et ID requis' }, { status: 400 })
    }
    
    const supabase = createAdminClient()
    
    // Déterminer la table selon le type
    const tableMap = {
      'groupe_actions': 'groupe_actions',
      'projet': 'groupe_actions',
      'action': 'actions',
      'action_occurrence': 'action_occurrences',
      'suivi_action': 'action_occurrences',
      'groupe_indicateurs': 'groupe_indicateurs',
      'indicateur': 'indicateurs',
      'indicateur_occurrence': 'indicateur_occurrences',
      'suivi_indicateur': 'indicateur_occurrences'
    }
    
    const table = tableMap[type]
    if (!table) {
      return NextResponse.json({ error: 'Type non reconnu' }, { status: 400 })
    }
    
    // Archiver l'élément
    const { error } = await supabase
      .from(table)
      .update({
        archive: true,
        date_archive: new Date().toISOString(),
        archive_par: archive_par
      })
      .eq('id', id)
    
    if (error) {
      console.error('Erreur archivage:', error)
      return NextResponse.json({ error: 'Erreur lors de l\'archivage: ' + error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, message: 'Élément archivé avec succès' })
    
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET - Récupérer les éléments archivés
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    
    if (!type) {
      return NextResponse.json({ error: 'Type requis' }, { status: 400 })
    }
    
    const supabase = createAdminClient()
    
    // Déterminer la table selon le type
    const tableMap = {
      'groupe_actions': 'groupe_actions',
      'projet': 'groupe_actions',
      'action': 'actions',
      'action_occurrence': 'action_occurrences',
      'suivi_action': 'action_occurrences',
      'groupe_indicateurs': 'groupe_indicateurs',
      'indicateur': 'indicateurs',
      'indicateur_occurrence': 'indicateur_occurrences',
      'suivi_indicateur': 'indicateur_occurrences'
    }
    
    const table = tableMap[type]
    if (!table) {
      return NextResponse.json({ error: 'Type non reconnu' }, { status: 400 })
    }
    
    // Récupérer les éléments archivés
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('archive', true)
      .order('date_archive', { ascending: false })
    
    if (error) {
      console.error('Erreur récupération archives:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data || [])
    
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Désarchiver un élément
export async function PUT(request) {
  try {
    const body = await request.json()
    const { type, id, modificateur } = body
    
    if (!type || !id) {
      return NextResponse.json({ error: 'Type et ID requis' }, { status: 400 })
    }
    
    const supabase = createAdminClient()
    
    // Déterminer la table selon le type
    const tableMap = {
      'groupe_actions': 'groupe_actions',
      'projet': 'groupe_actions',
      'action': 'actions',
      'action_occurrence': 'action_occurrences',
      'suivi_action': 'action_occurrences',
      'groupe_indicateurs': 'groupe_indicateurs',
      'indicateur': 'indicateurs',
      'indicateur_occurrence': 'indicateur_occurrences',
      'suivi_indicateur': 'indicateur_occurrences'
    }
    
    const table = tableMap[type]
    if (!table) {
      return NextResponse.json({ error: 'Type non reconnu' }, { status: 400 })
    }
    
    // Désarchiver l'élément
    const { error } = await supabase
      .from(table)
      .update({
        archive: false,
        date_archive: null,
        archive_par: null,
        modificateur: modificateur,
        date_modification: new Date().toISOString()
      })
      .eq('id', id)
    
    if (error) {
      console.error('Erreur désarchivage:', error)
      return NextResponse.json({ error: 'Erreur lors du désarchivage: ' + error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, message: 'Élément désarchivé avec succès' })
    
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
