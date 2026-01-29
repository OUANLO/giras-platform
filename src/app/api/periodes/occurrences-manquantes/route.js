import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

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

// POST - Créer uniquement les occurrences manquantes des indicateurs du groupe "Risque" pour la PÉRIODE OUVERTE.
export async function POST(request) {
  try {
    const supabase = createAdminClient()

    // On lit quand même le body (pour compatibilité), mais la source de vérité est la période OUVERTE en base.
    await request.json().catch(() => ({}))

    // 1) Période ouverte (source de vérité)
    const { data: periodeOuverte, error: perErr } = await supabase
      .from('periodes_evaluation')
      .select('id, annee, semestre, trimestre, mois, date_debut, date_fin, date_limite_saisie, statut')
      .in('statut', ['Ouverte', 'Ouvert'])
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (perErr) {
      return NextResponse.json({ error: perErr.message }, { status: 500 })
    }
    if (!periodeOuverte) {
      return NextResponse.json({ error: "Aucune période ouverte" }, { status: 400 })
    }

    const libellePeriode = buildPeriodeLibelle(periodeOuverte)
    if (!libellePeriode) {
      return NextResponse.json({ error: "Libellé de période introuvable" }, { status: 500 })
    }

    // 2) Indicateurs actifs du groupe "Risque"
    const { data: allIndicateurs, error: indErr } = await supabase
      .from('indicateurs')
      .select('code_indicateur, seuil1, groupes, code_groupe, statut')
      .eq('statut', 'Actif')

    if (indErr) {
      return NextResponse.json({ error: indErr.message }, { status: 500 })
    }

    const indicateursRisque = (allIndicateurs || []).filter(ind => {
      if (Array.isArray(ind.groupes)) return ind.groupes.includes('Risque')
      if (typeof ind.groupes === 'string') {
        try {
          const parsed = JSON.parse(ind.groupes)
          if (Array.isArray(parsed)) return parsed.includes('Risque')
        } catch {
          return ind.groupes === 'Risque'
        }
      }
      return ind.code_groupe === 'Risque'
    })

    const codes = [...new Set(indicateursRisque.map(i => i.code_indicateur).filter(Boolean))]
    if (codes.length === 0) {
      return NextResponse.json({ message: 'Aucun indicateur Risque actif', nbOccurrencesCreees: 0 })
    }

    // 3) Occurrences déjà existantes POUR LA PERIODE OUVERTE
    const { data: existantes, error: exErr } = await supabase
      .from('indicateur_occurrences')
      .select('code_indicateur')
      .eq('periode', libellePeriode)
      .in('code_indicateur', codes)

    if (exErr) {
      return NextResponse.json({ error: exErr.message }, { status: 500 })
    }

    const existSet = new Set((existantes || []).map(o => o.code_indicateur))

    // 4) Construire la liste à insérer (uniquement manquantes)
    const aInserer = codes
      .filter(code => !existSet.has(code))
      .map(code => {
        const ind = indicateursRisque.find(i => i.code_indicateur === code)
        return {
          code_indicateur: code,
          periode: libellePeriode,
          annee: periodeOuverte.annee ? Number(periodeOuverte.annee) : null,
          date_debut: periodeOuverte.date_debut,
          date_fin: periodeOuverte.date_fin,
          date_limite_saisie: periodeOuverte.date_limite_saisie || null,
          cible: ind?.seuil1 ?? null,
          statut: 'Pas retard',
          nb_jr_retard: 0,
          archive: false,
        }
      })

    if (aInserer.length === 0) {
      return NextResponse.json({ message: 'Aucune occurrence manquante', nbOccurrencesCreees: 0 })
    }

    // 5) Insertion en batch (robuste: si contrainte unique existe, les doublons seront rejetés)
    const { error: insErr } = await supabase
      .from('indicateur_occurrences')
      .insert(aInserer)

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({
      message: `${aInserer.length} occurrence(s) créée(s) avec succès`,
      nbOccurrencesCreees: aInserer.length,
      periode: libellePeriode,
    })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Erreur serveur' }, { status: 500 })
  }
}
