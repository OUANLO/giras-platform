import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET - Récupérer les actions du plan de maîtrise des risques
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data: actions, error: actionsError } = await supabase
      .from('actions')
      .select(`
        *,
        action_occurrences (
          id,
          code_occurrence,
          code_action,
          date_debut,
          date_fin,
          statut,
          archive,
          date_archive,
          tx_avancement,
          gestionnaire_conf,
          date_conf,
          date_realisation,
          responsable,
          date_creation
        ),
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
      .in('code_groupe', ['Risque', 'RISQUES'])
      .order('code_action', { ascending: true })

    if (actionsError) throw actionsError

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

    const enrichedActions = (actions || []).map((action) => {
      const linkedRiskCodes = [action?.code_risque, ...(Array.isArray(action?.code_risques) ? action.code_risques : [])]
        .filter(Boolean)
        .map(String)
      const linkedRisques = linkedRiskCodes
        .map((codeRisque) => risques?.find((r) => String(r.code_risque) === String(codeRisque)) || { code_risque: codeRisque })

      const activeOccurrences = (action.action_occurrences || []).filter((occ) => occ && occ.archive !== true && occ.statut !== 'Inactif')
      const latestOccurrence = [...(activeOccurrences.length > 0 ? activeOccurrences : (action.action_occurrences || []))]
        .sort((a, b) => new Date(b.date_fin || b.date_debut || b.date_creation || 0) - new Date(a.date_fin || a.date_debut || a.date_creation || 0))[0] || null

      return {
        ...action,
        risques: linkedRisques,
        latest_occurrence: latestOccurrence,
        code_risque: linkedRisques[0]?.code_risque || action?.code_risque || '-',
        libelle_risque: linkedRisques[0]?.libelle_risque || '-',
        code_processus: linkedRisques[0]?.code_processus || '-',
        libelle_processus: linkedRisques[0]?.processus?.libelle_processus || '-',
        date_debut_initiale: latestOccurrence?.date_debut || null,
        date_fin_initiale: latestOccurrence?.date_fin || null,
        date_debut_replan: null,
        date_fin_replan: null,
        tx_avancement: latestOccurrence?.tx_avancement || 0,
        code_structure_resp: action.responsable_user?.structure || action.code_structure
      }
    })

    return NextResponse.json({ actions: enrichedActions, total: enrichedActions.length })
  } catch (error) {
    console.error('Erreur GET plan-maitrise:', error)
    return NextResponse.json({ actions: [], error: error.message }, { status: 500 })
  }
}
