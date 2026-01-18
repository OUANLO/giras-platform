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

// GET - Récupérer les probabilités manuelles des risques qualitatifs
export async function GET(request) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const code_risque = searchParams.get('code_risque')
    const periode = searchParams.get('periode')
    
    let query = supabase.from('risques_probabilites').select('*')
    
    if (code_risque) query = query.eq('code_risque', code_risque)
    if (periode) query = query.eq('periode', periode)
    
    const { data, error } = await query.order('date_modification', { ascending: false })
    
    if (error) throw error
    
    return NextResponse.json({ probabilites: data })
  } catch (error) {
    console.error('Erreur GET probabilites:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Créer ou mettre à jour la probabilité d'un risque qualitatif
export async function POST(request) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    
    const { code_risque, periode, probabilite, modificateur, analyse_snapshot } = body
    
    if (!code_risque || !periode) {
      return NextResponse.json({ error: 'code_risque et periode sont requis' }, { status: 400 })
    }
    
    // Résoudre la période demandée à partir des colonnes existantes (pas de "libelle" DB)
    const { data: periodes, error: periodesErr } = await supabase
      .from('periodes_evaluation')
      .select('id, annee, semestre, trimestre, mois, date_debut, date_fin, statut')

    if (periodesErr) throw periodesErr

    const periodeObj = (periodes || []).map(p => ({
      id: p.id,
      annee: p.annee,
      semestre: p.semestre,
      trimestre: p.trimestre,
      mois: p.mois,
      libelle: buildPeriodeLibelle(p),
      date_debut: p.date_debut,
      date_fin: p.date_fin,
      statut: p.statut,
    })).find(p => p.libelle === periode)

    if (!periodeObj) {
      return NextResponse.json({ error: `Période introuvable: ${periode}` }, { status: 400 })
    }

    if (periodeObj.statut === 'Fermé' || periodeObj.statut === 'Fermée') {
      return NextResponse.json({ error: 'La période est fermée. Modification interdite.' }, { status: 403 })
    }

    const { data, error } = await upsertRisqueProbabiliteSnapshot({
      supabase,
      periode: periodeObj,
      codeRisque: code_risque,
      modificateur,
      probabiliteOverride: probabilite,
      analyseSnapshot: analyse_snapshot || null,
      archive: false,
      // Endpoint dédié à la saisie manuelle (risques qualitatifs) :
      // on force la sentinelle afin d'éviter tout NULL sur code_indicateur.
      forceQualiSentinel: true,
    })

    if (error) throw error

    return NextResponse.json({ probabilite: data?.[0] ?? data, message: 'Probabilité enregistrée' })
  } catch (error) {
    console.error('Erreur POST probabilite:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer la probabilité d'un risque qualitatif
export async function DELETE(request) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }
    
    // Interdire la suppression si la ligne est archivée
    const { data: row, error: rErr } = await supabase
      .from('risques_probabilites')
      .select('id, archive')
      .eq('id', id)
      .maybeSingle()

    if (rErr) throw rErr
    if (`${row?.archive}` === 'Oui') {
      return NextResponse.json({ error: 'La période est archivée. Suppression interdite.' }, { status: 403 })
    }

    const { error } = await supabase
      .from('risques_probabilites')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    return NextResponse.json({ message: 'Probabilité supprimée' })
  } catch (error) {
    console.error('Erreur DELETE probabilite:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
