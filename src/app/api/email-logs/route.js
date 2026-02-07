import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET - Récupérer les logs d'emails
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const destinataire = searchParams.get('destinataire')
    const type_email = searchParams.get('type')
    const statut = searchParams.get('statut')
    const date_debut = searchParams.get('date_debut')
    const date_fin = searchParams.get('date_fin')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('email_logs')
      .select('*', { count: 'exact' })
      .order('date_envoi', { ascending: false })

    // Filtres
    if (destinataire) {
      query = query.ilike('destinataire', `%${destinataire}%`)
    }
    if (type_email) {
      query = query.eq('type_email', type_email)
    }
    if (statut) {
      query = query.eq('statut', statut)
    }
    if (date_debut) {
      query = query.gte('date_envoi', date_debut)
    }
    if (date_fin) {
      query = query.lte('date_envoi', `${date_fin}T23:59:59`)
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Erreur récupération email_logs:', error)
      return NextResponse.json({ logs: [], error: error.message })
    }

    return NextResponse.json({ 
      logs: data || [],
      total: count || 0,
      limit,
      offset
    })

  } catch (error) {
    console.error('Erreur GET email_logs:', error)
    return NextResponse.json({ logs: [], error: error.message }, { status: 500 })
  }
}

// GET stats - Statistiques des emails
export async function POST(request) {
  try {
    const body = await request.json()
    const { action } = body

    const supabase = createAdminClient()

    if (action === 'stats') {
      // Statistiques générales
      const { data: totalEmails } = await supabase
        .from('email_logs')
        .select('id', { count: 'exact' })

      const { data: emailsEnvoyes } = await supabase
        .from('email_logs')
        .select('id', { count: 'exact' })
        .eq('statut', 'envoyé')

      const { data: emailsEchoues } = await supabase
        .from('email_logs')
        .select('id', { count: 'exact' })
        .eq('statut', 'échec')

      // Emails aujourd'hui
      const today = new Date().toISOString().split('T')[0]
      const { data: emailsAujourdhui } = await supabase
        .from('email_logs')
        .select('id', { count: 'exact' })
        .gte('date_envoi', today)

      // Par type
      const { data: parType } = await supabase
        .from('email_logs')
        .select('type_email')

      const typeStats = {}
      for (const log of parType || []) {
        typeStats[log.type_email] = (typeStats[log.type_email] || 0) + 1
      }

      // Par source
      const { data: parSource } = await supabase
        .from('email_logs')
        .select('source')

      const sourceStats = {}
      for (const log of parSource || []) {
        sourceStats[log.source] = (sourceStats[log.source] || 0) + 1
      }

      return NextResponse.json({
        stats: {
          total: totalEmails?.length || 0,
          envoyes: emailsEnvoyes?.length || 0,
          echoues: emailsEchoues?.length || 0,
          aujourdhui: emailsAujourdhui?.length || 0,
          par_type: typeStats,
          par_source: sourceStats
        }
      })
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })

  } catch (error) {
    console.error('Erreur POST email_logs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
