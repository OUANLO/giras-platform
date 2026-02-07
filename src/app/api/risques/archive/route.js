import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { calculateCriticite, calculateImpactNet, getNiveauCriticite } from '@/lib/risk-metrics'

// Route API dependante de la querystring => forcer execution dynamique en build Vercel.
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

    const { data: rowsRaw, error } = await supabase
      .from('risques_probabilites')
      .select('*')
      .eq('periode', String(periodeLibelle))
      .eq('archive', 'Oui')
      .order('code_risque', { ascending: true })

    if (error) {
      console.error('Erreur lecture risques_probabilites (archive):', error)
      return NextResponse.json({ error: error.message || 'Erreur base de données' }, { status: 500 })
    }

    const rows = rowsRaw || []

    // Enrichir à la volée (les champs dérivés ne sont plus stockés dans risques_probabilites)
    const codes = Array.from(new Set(rows.map(r => r.code_risque).filter(Boolean)))
    const { data: risques } = codes.length
      ? await supabase
          .from('risques')
          .select('code_risque, libelle_risque, code_processus, code_structure, impact, efficacite_contr, qualitatif')
          .in('code_risque', codes)
      : { data: [] }

    const risqueMap = new Map((risques || []).map(r => [r.code_risque, r]))

    const enriched = rows.map(r => {
      const rr = risqueMap.get(r.code_risque) || null
      const impactBrut = rr && rr.impact !== null && rr.impact !== undefined && `${rr.impact}` !== '' ? Number(rr.impact) : null
      const effic = rr && rr.efficacite_contr !== null && rr.efficacite_contr !== undefined && `${rr.efficacite_contr}` !== '' ? Number(rr.efficacite_contr) : null
      const proba = r.probabilite !== null && r.probabilite !== undefined && `${r.probabilite}` !== '' ? Number(r.probabilite) : null

      const impactNet = calculateImpactNet(impactBrut, effic)
      const scoreBrut = calculateCriticite(impactBrut, proba)
      const scoreNet = calculateCriticite(impactNet, proba)
      const brut = getNiveauCriticite(scoreBrut)
      const net = getNiveauCriticite(scoreNet)

      return {
        ...r,
        // Champs récupérables depuis les autres tables
        libelle_risque: rr?.libelle_risque ?? null,
        code_structure: rr?.code_structure ?? null,
        code_processus: rr?.code_processus ?? r.code_processus ?? null,
        qualitatif: rr?.qualitatif ?? null,
        // Champs dérivés (calculés à l'affichage)
        impact_brut: impactBrut,
        efficacite_controle: effic,
        impact_net: impactNet,
        score_brut: scoreBrut,
        score_net: scoreNet,
        criticite_brute: brut?.level ?? null,
        niveau_criticite_brute: brut?.label ?? null,
        criticite_nette: net?.level ?? null,
        niveau_criticite_nette: net?.label ?? null,
      }
    })

    // Map pratique côté front (1 ligne par risque) : on garde la ligne la plus "pénalisante"
    // selon la criticité nette calculée.
    const byRisque = {}
    for (const r of enriched) {
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

    return NextResponse.json({ rows: enriched, byRisque })
  } catch (e) {
    console.error('Erreur API /api/risques/archive:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}
