export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdministrationAccess } from '@/lib/auth'
import { canAccessAdminSection, canEditAdminSection } from '@/lib/roles'
import { getPendingValidationSettings, savePendingValidationSettings } from '@/lib/pending-validation-service'

export async function GET(request) {
  try {
    const guard = requireAdministrationAccess(request)
    if (guard instanceof NextResponse) return guard
    if (!canAccessAdminSection(guard, 'emailing')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    const settings = await getPendingValidationSettings(createAdminClient(request))
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const guard = requireAdministrationAccess(request)
    if (guard instanceof NextResponse) return guard
    if (!canEditAdminSection(guard, 'emailing')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    const body = await request.json()
    const supabase = createAdminClient(request)
    await savePendingValidationSettings(supabase, body || {})
    const settings = await getPendingValidationSettings(supabase)
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
