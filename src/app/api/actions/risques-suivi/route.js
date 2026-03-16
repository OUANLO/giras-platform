export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

const normalizeActionCode = (v) => String(v ?? '').trim()
const isFalseLike = (v) => {
  if (v === false || v === null || v === undefined || v === 0) return true
  const s = String(v).trim().toLowerCase()
  return s === '' || s === 'false' || s === '0' || s === 'non'
}
const isTrueLike = (v) => !isFalseLike(v)

export async function GET() {
  try {
    const supabase = createAdminClient()
    const [{ data: actions, error: actionsError }, { data: occurrences, error: occError }] = await Promise.all([
      supabase
        .from('actions')
        .select('id, code_action, libelle_action, code_groupe, code_structure, responsable, statut_act, code_risque, archive'),
      supabase
        .from('action_occurrences')
        .select('id, code_action, code_occurrence, date_debut, date_fin, statut, tx_avancement, gestionnaire_conf, responsable, archive, date_creation, date_realisation, date_conf')
    ])

    if (actionsError) {
      console.error('GET /api/actions/risques-suivi actions error:', actionsError)
      return NextResponse.json({ rows: [], error: actionsError.message }, { status: 500 })
    }
    if (occError) {
      console.error('GET /api/actions/risques-suivi occurrences error:', occError)
      return NextResponse.json({ rows: [], error: occError.message }, { status: 500 })
    }

    const actionsByCode = new Map()
    ;(actions || []).forEach((action) => {
      const key = normalizeActionCode(action?.code_action)
      if (!key) return
      const group = String(action?.code_groupe ?? '').trim().toUpperCase()
      if (group !== 'RISQUES') return
      if (isTrueLike(action?.archive)) return
      const actionStatus = String(action?.statut_act ?? action?.statut ?? '').trim().toLowerCase()
      if (actionStatus && actionStatus !== 'actif') return
      actionsByCode.set(key, action)
    })

    const rows = []
    ;(occurrences || []).forEach((occ) => {
      const key = normalizeActionCode(occ?.code_action)
      const action = actionsByCode.get(key)
      if (!action) return
      if (String(occ?.statut ?? '').trim() !== 'Actif') return
      if (isTrueLike(occ?.archive)) return
      rows.push({
        code_action: action.code_action,
        action_id: action.id,
        libelle_action: action.libelle_action,
        code_groupe: action.code_groupe,
        code_structure: action.code_structure,
        code_risque: action.code_risque,
        action_statut: action.statut_act,
        occurrence_id: occ.id,
        code_occurrence: occ.code_occurrence,
        date_debut: occ.date_debut,
        date_fin: occ.date_fin,
        statut: occ.statut,
        tx_avancement: occ.tx_avancement,
        gestionnaire_conf: occ.gestionnaire_conf,
        responsable: occ.responsable,
        archive: occ.archive,
        date_creation: occ.date_creation,
        date_realisation: occ.date_realisation,
        date_conf: occ.date_conf,
      })
    })

    rows.sort((a, b) => new Date(b.date_fin || b.date_debut || b.date_creation || 0) - new Date(a.date_fin || a.date_debut || a.date_creation || 0))
    return NextResponse.json({ rows })
  } catch (error) {
    console.error('GET /api/actions/risques-suivi fatal:', error)
    return NextResponse.json({ rows: [], error: error.message }, { status: 500 })
  }
}
