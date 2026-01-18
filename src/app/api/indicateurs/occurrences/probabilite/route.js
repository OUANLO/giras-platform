import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { upsertRisqueProbabiliteSnapshot } from '@/lib/risques-probabilites-sync'

function buildPeriodeLibelle(p) {
  if (!p) return null
  if (p.semestre) return `S${p.semestre}-${p.annee}`
  if (p.trimestre) return `T${p.trimestre}-${p.annee}`
  if (p.mois) {
    const mm = Number(p.mois)
    if (!Number.isNaN(mm)) return `${mm}-${p.annee}`
    return `${p.mois}-${p.annee}`
  }
  return `${p.annee}`
}

// PUT - Stocker la probabilité manuelle d'un risque pour une période.
// Source de vérité: table risques_probabilites (pas indicateur_occurrences).
// On effectue un UPSERT atomique (insert ou update) sur (code_risque, periode).

export async function PUT(request) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const { code_risque, periode, probabilite, modificateur, analyse_snapshot } = body || {}

    if (!code_risque) {
      return NextResponse.json({ error: 'code_risque est requis' }, { status: 400 })
    }
    if (!periode) {
      return NextResponse.json({ error: 'periode est requis' }, { status: 400 })
    }

    // Normaliser la probabilité en entier 1..4 si possible
    const p = probabilite === '' || probabilite === null || probabilite === undefined
      ? null
      : parseInt(probabilite, 10)

    if (p !== null && (Number.isNaN(p) || p < 1 || p > 4)) {
      return NextResponse.json({ error: 'probabilite doit être un entier entre 1 et 4' }, { status: 400 })
    }

    // Résoudre la période demandée. (Ne pas dépendre d'une colonne "libelle" en DB.)
    const { data: periodes, error: periodesErr } = await supabase
      .from('periodes_evaluation')
      .select('id, annee, semestre, trimestre, mois, date_debut, date_fin, statut')

    if (periodesErr) {
      return NextResponse.json({ error: periodesErr.message }, { status: 500 })
    }

    const periodeObj = (periodes || []).map(pr => ({
      id: pr.id,
      annee: pr.annee,
      semestre: pr.semestre,
      trimestre: pr.trimestre,
      mois: pr.mois,
      libelle: buildPeriodeLibelle(pr),
      date_debut: pr.date_debut,
      date_fin: pr.date_fin,
      statut: pr.statut,
    })).find(pr => pr.libelle === periode)

    if (!periodeObj) {
      return NextResponse.json({ error: `Période introuvable: ${periode}` }, { status: 400 })
    }
    if (periodeObj.statut === 'Fermé' || periodeObj.statut === 'Fermée') {
      return NextResponse.json({ error: 'La période est fermée. Modification interdite.' }, { status: 403 })
    }

    // IMPORTANT: écrire une "photo" complète dans risques_probabilites (pas seulement la proba)
    const { data, error } = await upsertRisqueProbabiliteSnapshot({
      supabase,
      periode: periodeObj,
      codeRisque: code_risque,
      modificateur,
      probabiliteOverride: p,
      analyseSnapshot: analyse_snapshot || null,
      archive: false,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data?.[0] ?? data })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Erreur serveur' }, { status: 500 })
  }
}
