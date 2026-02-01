import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET - Récupérer les actions standards
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const codeRisque = searchParams.get('code_risque')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('actions_risques')
      .select('*')
      .order('code_action', { ascending: true })

    if (codeRisque) {
      query = query.eq('code_risque', codeRisque)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ actions: data || [] })
  } catch (error) {
    console.error('Erreur GET actions_risques:', error)
    return NextResponse.json({ actions: [] })
  }
}

// POST - Créer une action standard
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.libelle_action || !body.code_risque) {
      return NextResponse.json(
        { error: 'Libellé et code risque requis' },
        { status: 400 }
      )
    }

    // Récupérer le dernier code_action pour ce risque
    const { data: existingActions, error: fetchError } = await supabase
      .from('actions_risques')
      .select('id')
      .eq('code_risque', body.code_risque)
    
    // Générer un nouveau numéro séquentiel
    const nextNum = (existingActions?.length || 0) + 1

    // Essayer d'abord avec un code texte (format RISQUE-A01)
    let codeAction = body.code_action || `${body.code_risque}-A${String(nextNum).padStart(2, '0')}`
    
    let insertData = {
      libelle_action: body.libelle_action,
      code_risque: body.code_risque,
      type_action: body.type_action || 'Haute',
      createur: body.createur,
      date_creation: new Date().toISOString()
    }

    // Essayer d'insérer avec code_action en texte
    let { data, error } = await supabase
      .from('actions_risques')
      .insert({ ...insertData, code_action: codeAction })
      .select()
      .single()

    // Si erreur de type (integer), essayer avec un nombre
    if (error && error.message?.includes('integer')) {
      console.log('code_action est de type INTEGER, utilisation d\'un numéro')
      // Récupérer le max code_action existant
      const { data: maxData } = await supabase
        .from('actions_risques')
        .select('code_action')
        .order('code_action', { ascending: false })
        .limit(1)
        .single()
      
      const maxCode = maxData?.code_action || 0
      const newCode = (typeof maxCode === 'number' ? maxCode : parseInt(maxCode) || 0) + 1

      const result = await supabase
        .from('actions_risques')
        .insert({ ...insertData, code_action: newCode })
        .select()
        .single()
      
      if (result.error) throw result.error
      data = result.data
      error = null
    }

    if (error) throw error

    return NextResponse.json({ action: data, message: 'Action créée avec succès' })
  } catch (error) {
    console.error('Erreur POST action_risque:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Modifier une action standard
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('actions_risques')
      .update({
        libelle_action: body.libelle_action,
        type_action: body.type_action,
        modificateur: body.modificateur,
        date_modification: new Date().toISOString()
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ action: data, message: 'Action modifiée avec succès' })
  } catch (error) {
    console.error('Erreur PUT action_risque:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer une action standard
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('actions_risques')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur DELETE action_risque:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
