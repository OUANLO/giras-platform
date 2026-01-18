import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// Convertir nom du mois en numéro
const moisToNum = {
  'Janvier': 1, 'Février': 2, 'Mars': 3, 'Avril': 4, 'Mai': 5, 'Juin': 6,
  'Juillet': 7, 'Août': 8, 'Septembre': 9, 'Octobre': 10, 'Novembre': 11, 'Décembre': 12
}

// Calculer les dates de début et fin selon la période
function calculerDates(annee, semestre, trimestre, mois) {
  const a = parseInt(annee)
  let date_debut, date_fin
  
  if (mois) {
    const m = typeof mois === 'string' ? moisToNum[mois] || parseInt(mois) : mois
    const lastDay = new Date(a, m, 0).getDate()
    date_debut = `${a}-${String(m).padStart(2, '0')}-01`
    date_fin = `${a}-${String(m).padStart(2, '0')}-${lastDay}`
  } else if (trimestre) {
    const t = parseInt(trimestre)
    const moisDebut = (t - 1) * 3 + 1
    const moisFin = t * 3
    const lastDay = new Date(a, moisFin, 0).getDate()
    date_debut = `${a}-${String(moisDebut).padStart(2, '0')}-01`
    date_fin = `${a}-${String(moisFin).padStart(2, '0')}-${lastDay}`
  } else if (semestre) {
    const s = parseInt(semestre)
    if (s === 1) {
      date_debut = `${a}-01-01`
      date_fin = `${a}-06-30`
    } else {
      date_debut = `${a}-07-01`
      date_fin = `${a}-12-31`
    }
  } else {
    date_debut = `${a}-01-01`
    date_fin = `${a}-12-31`
  }
  
  return { date_debut, date_fin }
}

// Générer le libellé de la période
function genererLibellePeriode(annee, semestre, trimestre, mois) {
  const moisNoms = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  
  if (mois) {
    const m = typeof mois === 'string' ? moisToNum[mois] || parseInt(mois) : mois
    return `${moisNoms[m]}-${annee}`
  } else if (trimestre) {
    return `T${trimestre}-${annee}`
  } else if (semestre) {
    return `S${semestre}-${annee}`
  } else {
    return `${annee}`
  }
}

// POST - Créer les occurrences manquantes pour une période
export async function POST(request) {
  console.log('=== POST /api/periodes/occurrences-manquantes START ===')
  
  try {
    const body = await request.json()
    console.log('Body reçu:', JSON.stringify(body))
    
    const supabase = createAdminClient()

    if (!body.annee) {
      return NextResponse.json({ error: 'Année obligatoire' }, { status: 400 })
    }
    
    if (!body.date_limite_saisie) {
      return NextResponse.json({ error: 'Date limite de saisie obligatoire' }, { status: 400 })
    }

    // Convertir semestre/trimestre/mois en valeurs numériques
    let semestreVal = null
    let trimestreVal = null
    let moisVal = null
    
    if (body.semestre && body.semestre !== '' && body.semestre !== '--') {
      semestreVal = body.semestre === 'S1' ? 1 : 2
    } else if (body.trimestre && body.trimestre !== '' && body.trimestre !== '--') {
      const trimStr = body.trimestre.toString()
      if (trimStr.startsWith('T')) {
        trimestreVal = parseInt(trimStr.replace('T', ''))
      } else if (trimStr.includes('Trimestre')) {
        trimestreVal = parseInt(trimStr.replace('Trimestre ', ''))
      } else {
        trimestreVal = parseInt(trimStr)
      }
    } else if (body.mois && body.mois !== '' && body.mois !== '--') {
      if (typeof body.mois === 'string' && isNaN(parseInt(body.mois))) {
        moisVal = moisToNum[body.mois] || null
      } else {
        moisVal = parseInt(body.mois)
      }
    }

    // Calculer les dates de la période
    const { date_debut, date_fin } = calculerDates(body.annee, semestreVal, trimestreVal, moisVal)
    const libelle_periode = genererLibellePeriode(body.annee, semestreVal, trimestreVal, moisVal)
    console.log('Période:', { date_debut, date_fin, libelle_periode })

    // Récupérer tous les indicateurs actifs du groupe Risque
    const { data: allIndicateurs, error: indError } = await supabase
      .from('indicateurs')
      .select('code_indicateur, libelle_indicateur, seuil1, type_indicateur, groupes, code_groupe')
      .eq('statut', 'Actif')

    if (indError) {
      console.error('Erreur récup indicateurs:', indError)
      return NextResponse.json({ error: 'Erreur récupération indicateurs' }, { status: 500 })
    }

    // Filtrer les indicateurs du groupe Risque
    const indicateursRisque = (allIndicateurs || []).filter(ind => {
      if (Array.isArray(ind.groupes)) {
        return ind.groupes.includes('Risque')
      }
      if (typeof ind.groupes === 'string') {
        try {
          const parsed = JSON.parse(ind.groupes)
          if (Array.isArray(parsed)) {
            return parsed.includes('Risque')
          }
        } catch {
          return ind.groupes === 'Risque'
        }
      }
      return ind.code_groupe === 'Risque'
    })

    console.log(`${indicateursRisque.length} indicateurs Risque actifs trouvés`)

    // Créer les occurrences manquantes
    let nbOccurrencesCreees = 0
    
    for (const ind of indicateursRisque) {
      // Vérifier si l'occurrence existe déjà
      const { data: existingOccs } = await supabase
        .from('indicateur_occurrences')
        .select('id')
        .eq('code_indicateur', ind.code_indicateur)
        .eq('date_debut', date_debut)
        .eq('date_fin', date_fin)

      if (existingOccs && existingOccs.length > 0) {
        console.log(`Occurrence existe déjà pour ${ind.code_indicateur}`)
        continue
      }

      // Créer l'occurrence
      const occData = {
        code_indicateur: ind.code_indicateur,
        periode: libelle_periode,
        annee: parseInt(body.annee),
        date_debut: date_debut,
        date_fin: date_fin,
        date_limite_saisie: body.date_limite_saisie,
        cible: ind.seuil1 || null,
        statut: 'Pas retard',
        nb_jr_retard: 0
      }
      
      console.log('Insertion occurrence:', ind.code_indicateur)

      const { error: occError } = await supabase
        .from('indicateur_occurrences')
        .insert(occData)

      if (occError) {
        console.error(`Erreur occurrence ${ind.code_indicateur}:`, occError)
      } else {
        nbOccurrencesCreees++
        console.log(`Occurrence créée pour ${ind.code_indicateur}`)
      }
    }

    console.log('=== POST /api/periodes/occurrences-manquantes END ===')
    console.log('Occurrences créées:', nbOccurrencesCreees)

    return NextResponse.json({ 
      message: `${nbOccurrencesCreees} occurrence(s) créée(s) avec succès`,
      nbOccurrencesCreees
    })
    
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur: ' + (error?.message || String(error)) }, { status: 500 })
  }
}
