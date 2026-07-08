import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

const BUCKET = 'cartographies'

function sanitizeFileName(name = 'cartographie.pdf') {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'cartographie.pdf'
}

async function ensureBucket(supabase) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  if (listError) return { error: listError }

  const exists = (buckets || []).some((b) => b.name === BUCKET)
  if (exists) return { error: null }

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 20971520,
    allowedMimeTypes: ['application/pdf'],
  })

  return { error: createError || null }
}

export async function POST(request) {
  try {
    const supabase = createAdminClient(request)
    const body = await request.json()
    const { periodeId, fileName, contentType } = body || {}

    if (!periodeId) {
      return NextResponse.json({ error: 'periodeId requis' }, { status: 400 })
    }

    if (contentType && contentType !== 'application/pdf') {
      return NextResponse.json({ error: 'Seuls les fichiers PDF sont acceptés' }, { status: 400 })
    }

    const { error: bucketError } = await ensureBucket(supabase)
    if (bucketError) {
      return NextResponse.json({ error: bucketError.message || 'Impossible de préparer le stockage du fichier' }, { status: 500 })
    }

    const safeName = sanitizeFileName(fileName)
    const path = `periodes/${periodeId}/${Date.now()}-${safeName}`
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)

    if (error) {
      return NextResponse.json({ error: error.message || 'Impossible de créer une URL d\'upload' }, { status: 500 })
    }

    return NextResponse.json({
      bucket: BUCKET,
      path,
      token: data?.token,
    })
  } catch (error) {
    console.error('Erreur API /api/cartographie/upload-url:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
