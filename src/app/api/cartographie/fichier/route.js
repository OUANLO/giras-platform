import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

const CARTOGRAPHIE_SIGNED_URL_TTL = 60 * 10
const DEFAULT_BUCKET = 'cartographies'

function parseStorageMarker(value) {
  if (typeof value !== 'string') return null
  const m = value.match(/^storage:\/\/([^/]+)\/(.+)$/i)
  if (!m) return null
  return { bucket: m[1], path: m[2] }
}

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

    const supabase = createAdminClient(request)

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

    const marker = parseStorageMarker(normalized.url_fichier)
    let storageBucket = normalized.storage_bucket || normalized.bucket || marker?.bucket || null
    let storagePath = normalized.storage_path || normalized.path || normalized.chemin_fichier || marker?.path || null

    // Fallback important: sur certains environnements, la table ne contient pas
    // encore storage_bucket/storage_path. Dans ce cas, retrouver le dernier fichier
    // stocké pour la période directement dans Supabase Storage.
    if (!storagePath) {
      const fallbackBucket = storageBucket || DEFAULT_BUCKET
      const prefix = `periodes/${code}/`
      const { data: listed, error: listError } = await supabase.storage
        .from(fallbackBucket)
        .list(prefix, { limit: 100, sortBy: { column: 'name', order: 'desc' } })

      if (listError) {
        console.error('Erreur listing storage cartographie:', listError)
      } else if (listed && listed.length > 0) {
        const latest = [...listed].sort((a, b) => {
          const ad = new Date(a.updated_at || a.created_at || 0).getTime()
          const bd = new Date(b.updated_at || b.created_at || 0).getTime()
          if (ad !== bd) return bd - ad
          return String(b.name || '').localeCompare(String(a.name || ''))
        })[0]
        storageBucket = fallbackBucket
        storagePath = `${prefix}${latest.name}`
        normalized.storage_bucket = storageBucket
        normalized.storage_path = storagePath
        if (!normalized.nom_fichier) normalized.nom_fichier = latest.name
      }
    }

    if (storageBucket && storagePath) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from(storageBucket)
        .createSignedUrl(storagePath, CARTOGRAPHIE_SIGNED_URL_TTL)

      if (signedError) {
        console.error('Erreur création signed URL cartographie:', signedError)
      } else if (signedData?.signedUrl) {
        normalized.url_fichier = signedData.signedUrl
      }
    }

    return NextResponse.json({ file: normalized })
  } catch (e) {
    console.error('Erreur API /api/cartographie/fichier:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}
