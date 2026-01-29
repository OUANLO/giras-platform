import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignore en cas d'erreur lors de l'écriture depuis un Server Component
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignore
          }
        },
      },
    }
  )
}

// Client admin avec service role key pour les opérations serveur
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  // Vérifier que les variables d'environnement sont définies
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Variables Supabase manquantes:', {
      url: supabaseUrl ? 'OK' : 'MANQUANTE',
      key: serviceRoleKey ? 'OK' : 'MANQUANTE'
    })
    // Créer un client factice qui retournera des erreurs explicites
    return {
      from: () => ({
        select: () => Promise.resolve({ data: null, error: { message: 'Configuration Supabase manquante. Vérifiez vos variables d\'environnement.' } }),
        insert: () => Promise.resolve({ data: null, error: { message: 'Configuration Supabase manquante.' } }),
        update: () => Promise.resolve({ data: null, error: { message: 'Configuration Supabase manquante.' } }),
        delete: () => Promise.resolve({ data: null, error: { message: 'Configuration Supabase manquante.' } }),
      })
    }
  }
  
  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
