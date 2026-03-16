import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// Cette route doit rester dynamique (utilise la querystring).
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/cartographie/fichier?code_periode=<CODE>
// Retourne le fichier de cartographie signée enregistré à la fermeture.
// IMPORTANT (schéma CNAM): l'identifiant de la période est stocké dans
// `fichiers_cartographie.code_periode`.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    // On accepte plusieurs noms pour rester compatible avec les anciennes versions.
    const codePeriode =
      searchParams.get('code_periode') ||
      searchParams.get('codePeriode') ||
      searchParams.get('periode') ||
      ''

    if (!codePeriode) {
      return NextResponse.json({ error: 'code_periode requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const code = String(codePeriode).trim()

    // 1) Recherche stricte (match exact)
    let { data, error } = await supabase
      .from('fichiers_cartographie')
      .select('*')
      .eq('code_periode', code)
      // Prendre le dernier upload s'il y en a plusieurs
      .order('date_upload', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)

    // 2) Si rien trouvé, tentative tolérante (espaces/variantes de casse)
    if (!error && (!data || data.length === 0)) {
      ;({ data, error } = await supabase
        .from('fichiers_cartographie')
        .select('*')
        .ilike('code_periode', code)
        .order('date_upload', { ascending: false })
        .order('id', { ascending: false })
        .limit(1))
    }

    if (error) {
      console.error('Erreur lecture fichiers_cartographie:', error)
      return NextResponse.json({ error: error.message || 'Erreur base de données' }, { status: 500 })
    }

    const raw = (data && data[0]) ? data[0] : null
    if (!raw) return NextResponse.json({ file: null })

    // Normalisation : selon les environnements, la colonne peut s'appeler
    // `url_fichier` (recommandé), ou encore `fichier` / `contenu` / `data`.
    const normalized = { ...raw }
    if (!normalized.url_fichier) {
      normalized.url_fichier =
        normalized.fichier ||
        normalized.contenu ||
        normalized.data ||
        normalized.chemin_fichier ||
        normalized.path ||
        normalized.storage_path ||
        null
    }

    return NextResponse.json({ file: normalized })
  } catch (e) {
    console.error('Erreur API /api/cartographie/fichier:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}
