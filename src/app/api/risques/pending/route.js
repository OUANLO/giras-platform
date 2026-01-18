import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(request) {
  try {
    const supabase = createAdminClient()
    
    // Compter les risques actifs sans valeur d'indicateur pour la période courante
    const { count, error } = await supabase
      .from('risques')
      .select('*', { count: 'exact', head: true })
      .eq('statut', 'Actif')
      .eq('qualitatif', 'Non')

    if (error) throw error

    // Pour l'instant on retourne un compte simulé
    // En production, il faudrait vérifier les indicateur_occurrences
    return NextResponse.json({ count: count || 0 })
  } catch (error) {
    console.error('Erreur pending risques:', error)
    return NextResponse.json({ count: 0 })
  }
}
