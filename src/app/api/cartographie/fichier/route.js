import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET /api/cartographie/fichier?periodeId=<uuid>
// Retourne le fichier de cartographie signée enregistré à la fermeture.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodeId = searchParams.get('periodeId')

    if (!periodeId) {
      return NextResponse.json({ error: 'periodeId requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('fichiers_cartographie')
      .select('*')
      .eq('code_periode', String(periodeId))
      .order('date_upload', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Erreur lecture fichiers_cartographie:', error)
      return NextResponse.json({ error: error.message || 'Erreur base de données' }, { status: 500 })
    }

    const file = (data && data[0]) ? data[0] : null
    return NextResponse.json({ file })
  } catch (e) {
    console.error('Erreur API /api/cartographie/fichier:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}
