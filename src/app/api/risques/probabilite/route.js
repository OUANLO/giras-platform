import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { upsertRisqueProbabiliteSnapshot, deleteRisqueProbabiliteForRisquePeriode } from '@/lib/risques-probabilites-sync'

// Récupérer les dates de période depuis periodes_evaluation, sans dépendre d'un schéma fixe.
async function fetchPeriodeDates({ supabase, periodeValue }) {
  const p = String(periodeValue ?? '').trim()
  if (!p) return { dateDebut: null, dateFin: null, found: false }

  const { data: sample, error: sampleErr } = await supabase
    .from('periodes_evaluation')
    .select('*')
    .limit(1)

  if (sampleErr) return { dateDebut: null, dateFin: null, found: false }

  const keys = new Set(Object.keys((sample && sample[0]) || {}))
  const has = (k) => keys.has(k)

  const colId = has('id') ? 'id' : null
  const colLabel = has('periode') ? 'periode'
    : (has('libelle') ? 'libelle'
      : (has('libelle_periode') ? 'libelle_periode' : null))
  const colYear = has('annee') ? 'annee' : (has('year') ? 'year' : null)
  const colStatut = has('statut') ? 'statut' : null
  const colDebut = has('date_debut') ? 'date_debut'
    : (has('date_debut_periode') ? 'date_debut_periode' : null)
  const colFin = has('date_fin') ? 'date_fin'
    : (has('date_fin_periode') ? 'date_fin_periode' : null)

  if (!colDebut || !colFin) return { dateDebut: null, dateFin: null, found: false }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p)
  if (isUuid && colId) {
    const { data } = await supabase
      .from('periodes_evaluation')
      .select('*')
      .eq(colId, p)
      .limit(1)
    const row = data?.[0]
    return { dateDebut: row?.[colDebut] ?? null, dateFin: row?.[colFin] ?? null, found: !!row }
  }

  if (colLabel) {
    const { data } = await supabase
      .from('periodes_evaluation')
      .select('*')
      .eq(colLabel, p)
      .limit(1)
    const row = data?.[0]
    if (row) return { dateDebut: row[colDebut], dateFin: row[colFin], found: true }
  }

  if (/^\d{4}$/.test(p) && colYear) {
    let q = supabase.from('periodes_evaluation').select('*').eq(colYear, Number(p))
    if (colStatut) q = q.ilike(colStatut, 'Ouvert%')
    const { data } = await q.order(colDebut, { ascending: false }).limit(1)
    const row = data?.[0]
    if (row) return { dateDebut: row[colDebut], dateFin: row[colFin], found: true }
  }

  if (colStatut) {
    const { data } = await supabase
      .from('periodes_evaluation')
      .select('*')
      .ilike(colStatut, 'Ouvert%')
      .order(colDebut, { ascending: false })
      .limit(1)
    const row = data?.[0]
    if (row) return { dateDebut: row[colDebut], dateFin: row[colFin], found: true }
  }

  return { dateDebut: null, dateFin: null, found: false }
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

    // La table risques_probabilites ne doit JAMAIS contenir de ligne avec probabilite vide.
    // Si la probabilité n'est pas renseignée, on ne crée pas d'enregistrement.
    // Si une ligne existe déjà et que l'utilisateur efface la probabilité, on supprime la ligne.
    const probaIsSet = !(probabilite === null || probabilite === undefined || `${probabilite}`.trim() === '')

    // Commentaires obligatoire UNIQUEMENT si probabilite renseignée
    const commentaires = (analyse_snapshot?.commentaires ?? '').toString()
    if (probaIsSet && commentaires.trim() === '') {
      return NextResponse.json({ error: 'Commentaires requis lorsque la probabilité est renseignée' }, { status: 400 })
    }

    // IMPORTANT: la période doit être enregistrée EXACTEMENT comme la colonne "Période" du tableau Analyse
    const periodeDb = String(periode).trim()
    if (!periodeDb) {
      return NextResponse.json({ error: 'periode est requis' }, { status: 400 })
    }


    // Si probabilité non renseignée => suppression obligatoire de la ligne existante (si présente) puis retour.
    if (!probaIsSet) {
      const { error: delErr } = await deleteRisqueProbabiliteForRisquePeriode({
        supabase,
        codeRisque: code_risque,
        periode: periodeDb,
      })
      if (delErr) throw delErr
      return NextResponse.json({ success: true, deleted: true, message: 'Probabilité effacée (enregistrement supprimé)' })
    }

    const { dateDebut, dateFin } = await fetchPeriodeDates({ supabase, periodeValue: periodeDb })

    const { data, error } = await upsertRisqueProbabiliteSnapshot({
      supabase,
      periode: periodeDb,
      codeRisque: code_risque,
      modificateur,
      probabiliteOverride: probabilite,
      analyseSnapshot: analyse_snapshot || null,
      archive: false,
      indObtenu: 'Non',
      dateDebutPeriode: dateDebut,
      dateFinPeriode: dateFin,
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
