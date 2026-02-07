import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET - Récupérer les actions du plan de maîtrise des risques
export async function GET(request) {
  try {
    const supabase = createAdminClient()
    
    // Récupérer les actions du groupe "Risque" avec leurs occurrences
    const { data: actions, error: actionsError } = await supabase
      .from('actions')
      .select(`
        *,
        action_occurrences (
          id,
          code_action,
          date_debut,
          date_fin,
          periode,
          statut,
          archive,
          date_archive,
          tx_avancement,
          niv_avancement,
          retard,
          retard2,
          gestionnaire_conf,
          date_conf
        ,
          date_realisation),
        structure:structures!actions_code_structure_fkey (
          code_structure,
          libelle_structure
        ),
        responsable_user:users!actions_responsable_fkey (
          username,
          nom,
          prenoms,
          structure
        )
      `)
      .eq('code_groupe', 'Risque')
      .order('code_action', { ascending: true })

    if (actionsError) throw actionsError

    // Récupérer les risques pour les lier aux actions
    const { data: risques, error: risquesError } = await supabase
      .from('risques')
      .select(`
        code_risque,
        libelle_risque,
        code_processus,
        processus:processus!risques_code_processus_fkey (
          libelle_processus
        )
      `)

    if (risquesError) throw risquesError

    // Enrichir les actions avec les infos des risques
    const enrichedActions = actions?.map(action => {
      // code_risques est un array de codes
      const linkedRisques = (action.code_risques || []).map(codeRisque => {
        const risque = risques?.find(r => r.code_risque === codeRisque)
        return risque || { code_risque: codeRisque }
      })
      
      // Prendre la dernière occurrence active ou la plus récente
      const latestOccurrence = action.action_occurrences?.length > 0 
        ? action.action_occurrences.sort((a, b) => new Date(b.date_fin || 0) - new Date(a.date_fin || 0))[0]
        : null

      return {
        ...action,
        risques: linkedRisques,
        latest_occurrence: latestOccurrence,
        // Infos pour le tableau
        code_risque: linkedRisques[0]?.code_risque || '-',
        libelle_risque: linkedRisques[0]?.libelle_risque || '-',
        code_processus: linkedRisques[0]?.code_processus || '-',
        libelle_processus: linkedRisques[0]?.processus?.libelle_processus || '-',
        // Dates initiales
        date_debut_initiale: action.date_debut,
        date_fin_initiale: action.date_fin,
        // Dates replanifiées (si différentes)
        date_debut_replan: latestOccurrence?.date_debut !== action.date_debut ? latestOccurrence?.date_debut : null,
        date_fin_replan: latestOccurrence?.date_fin !== action.date_fin ? latestOccurrence?.date_fin : null,
        // Avancement
        tx_avancement: latestOccurrence?.tx_avancement || 0,
        niv_avancement: latestOccurrence?.niv_avancement || 'Non entamée',
        retard: latestOccurrence?.retard || 0,
        retard2: latestOccurrence?.retard2 || 'Pas retard',
        // Structure du responsable
        code_structure_resp: action.responsable_user?.structure || action.code_structure
      }
    }) || []

    return NextResponse.json({ 
      actions: enrichedActions,
      total: enrichedActions.length
    })
  } catch (error) {
    console.error('Erreur GET plan-maitrise:', error)
    return NextResponse.json({ actions: [], error: error.message }, { status: 500 })
  }
}
