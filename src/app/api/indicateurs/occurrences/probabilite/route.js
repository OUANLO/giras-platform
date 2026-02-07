import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { upsertRisqueProbabiliteSnapshot, deleteRisqueProbabiliteForRisquePeriode } from '@/lib/risques-probabilites-sync'

async function fetchPeriodeDates({ supabase, periodeValue }) {
  const p = String(periodeValue ?? '').trim()
  if (!p) return { dateDebut: null, dateFin: null, found: false }

  // Détecter les colonnes existantes de periodes_evaluation (schéma variable selon environnements)
  const { data: sample, error: sampleErr } = await supabase
    .from('periodes_evaluation')
    .select('*')
    .limit(1)

  if (sampleErr) {
    // Si on ne peut pas lire la table, on ne bloque pas ici ; l'UPSERT se fera sans dates.
    return { dateDebut: null, dateFin: null, found: false }
  }

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

  // Si on ne trouve pas les colonnes de dates, inutile d'aller plus loin
  if (!colDebut || !colFin) return { dateDebut: null, dateFin: null, found: false }

  // UUID => match id
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

  // Match exact sur libellé/période si la colonne existe
  if (colLabel) {
    const { data } = await supabase
      .from('periodes_evaluation')
      .select('*')
      .eq(colLabel, p)
      .limit(1)
    const row = data?.[0]
    if (row) return { dateDebut: row[colDebut], dateFin: row[colFin], found: true }
  }

  // Année seule (ex: 2024) => prendre la période ouverte de cette année si possible
  if (/^\d{4}$/.test(p) && colYear) {
    let q = supabase.from('periodes_evaluation').select('*').eq(colYear, Number(p))
    if (colStatut) q = q.ilike(colStatut, 'Ouvert%')
    const { data } = await q.order(colDebut, { ascending: false }).limit(1)
    const row = data?.[0]
    if (row) return { dateDebut: row[colDebut], dateFin: row[colFin], found: true }
  }

  // Fallback : prendre la période ouverte la plus récente
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

    // Commentaires obligatoire UNIQUEMENT si probabilite renseignée
    const probaIsSet = !(probabilite === null || probabilite === undefined || `${probabilite}`.trim() === '')
    const commentaires = (analyse_snapshot?.commentaires ?? '').toString()
    if (probaIsSet && commentaires.trim() === '') {
      return NextResponse.json({ error: 'Commentaires requis lorsque la probabilité est renseignée' }, { status: 400 })
    }

    // Normaliser la probabilité en entier 1..4 si possible
    const p = probabilite === '' || probabilite === null || probabilite === undefined
      ? null
      : parseInt(probabilite, 10)

    if (p !== null && (Number.isNaN(p) || p < 1 || p > 4)) {
      return NextResponse.json({ error: 'probabilite doit être un entier entre 1 et 4' }, { status: 400 })
    }

    // IMPORTANT: la période doit être enregistrée EXACTEMENT comme la colonne "Période" du tableau Analyse
    const periodeDb = String(periode).trim()
    if (!periodeDb) {
      return NextResponse.json({ error: 'periode est requis' }, { status: 400 })
    }


    // Règle: la table risques_probabilites ne doit JAMAIS contenir de ligne avec probabilite vide.
    // Si la probabilité est effacée => suppression obligatoire de la ligne existante (si présente) puis retour.
    if (p === null) {
      const { error: delErr } = await deleteRisqueProbabiliteForRisquePeriode({
        supabase,
        codeRisque: code_risque,
        periode: periodeDb,
      })
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, deleted: true })
    }

    // Renseigner date_debut_periode / date_fin_periode à partir de periodes_evaluation
    const { dateDebut, dateFin } = await fetchPeriodeDates({ supabase, periodeValue: periodeDb })

    // IMPORTANT: écrire une "photo" complète dans risques_probabilites (pas seulement la proba)
    const { data, error } = await upsertRisqueProbabiliteSnapshot({
      supabase,
      periode: periodeDb,
      codeRisque: code_risque,
      modificateur,
      probabiliteOverride: p,
      analyseSnapshot: analyse_snapshot || null,
      archive: false,
      indObtenu: 'Non',
      dateDebutPeriode: dateDebut,
      dateFinPeriode: dateFin,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data?.[0] ?? data })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Erreur serveur' }, { status: 500 })
  }
}
