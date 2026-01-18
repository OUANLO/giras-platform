import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET /api/risques/archive?periodeId=<uuid>
// Compat: auparavant lisait archive_risques_periodes.
// Désormais, la "photographie" d'une période fermée est stockée dans risques_probabilites
// (colonnes étendues + archive='Oui').
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodeId = searchParams.get('periodeId')

    if (!periodeId) {
      return NextResponse.json({ error: 'periodeId requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Résoudre le libellé de période (champ "periode" dans risques_probabilites)
    const { data: periodeRow, error: pErr } = await supabase
      .from('periodes_evaluation')
      .select('id, annee, semestre, trimestre, mois, date_debut, date_fin, statut')
      .eq('id', String(periodeId))
      .maybeSingle()

    if (pErr) {
      console.error('Erreur lecture periodes_evaluation:', pErr)
      return NextResponse.json({ error: pErr.message || 'Erreur base de données' }, { status: 500 })
    }

    const periodeLibelle = (() => {
      if (!periodeRow) return String(periodeId)
      const annee = periodeRow.annee
      const s = periodeRow.semestre
      const t = periodeRow.trimestre
      const m = periodeRow.mois
      if (s) return `S${s}-${annee}`
      if (t) return `T${t}-${annee}`
      if (m) {
        // mois peut être un int 1..12 ou un libellé
        const mm = Number(m)
        if (!Number.isNaN(mm)) return `${mm}-${annee}`
        return `${m}-${annee}`
      }
      return `${annee}`
    })()

    const { data: rows, error } = await supabase
      .from('risques_probabilites')
      .select('*')
      .eq('periode', String(periodeLibelle))
      .eq('archive', 'Oui')
      .order('code_risque', { ascending: true })

    if (error) {
      console.error('Erreur lecture risques_probabilites (archive):', error)
      return NextResponse.json({ error: error.message || 'Erreur base de données' }, { status: 500 })
    }

    // Map pratique côté front (1 ligne par risque). Si plusieurs lignes existent (plusieurs occurrences),
    // on garde la ligne la plus "pénalisante" (criticite_nette max) pour l'affichage synthétique.
    const byRisque = {}
    for (const r of rows || []) {
      const k = r.code_risque
      if (!k) continue
      if (!byRisque[k]) {
        byRisque[k] = r
        continue
      }
      const cur = Number(byRisque[k].criticite_nette)
      const nxt = Number(r.criticite_nette)
      if (Number.isFinite(nxt) && (!Number.isFinite(cur) || nxt > cur)) {
        byRisque[k] = r
      }
    }

    return NextResponse.json({ rows: rows || [], byRisque })
  } catch (e) {
    console.error('Erreur API /api/risques/archive:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}
