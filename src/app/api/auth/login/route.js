import { NextResponse } from 'next/server'
import { createAdminClient, createRawAdminClient } from '@/lib/supabase-server'
import { verifyPassword } from '@/lib/utils'
import { setAuthCookie } from '@/lib/auth'

function buildAuthLogEntry(user, action) {
  const now = new Date()
  return {
    utilisateur: user.username,
    action,
    table_concernee: 'users',
    id_enregistrement: user.id || user.username,
    details: {
      utilisateur: user.username,
      user_email: user.username,
      type_utilisateur: user.type_utilisateur || 'Inconnu',
      date_action: now.toISOString().slice(0, 10),
      heure_action: now.toISOString().slice(11, 19),
      tables_concernees: ['users'],
      enregistrements_concernes: [user.id || user.username]
    }
  }
}

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient(request)

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', email.toLowerCase())
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Identifiants incorrects' },
        { status: 401 }
      )
    }

    if (user.statut !== 'Actif') {
      return NextResponse.json(
        { error: 'Votre compte est désactivé. Contactez l\'administrateur.' },
        { status: 403 }
      )
    }

    const isValidPassword = await verifyPassword(password, user.password)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Identifiants incorrects' },
        { status: 401 }
      )
    }

    const { password: _, ...userWithoutPassword } = user

    const rawSupabase = createRawAdminClient()
    const { error: logError } = await rawSupabase.from('logs').insert(buildAuthLogEntry(user, 'LOGIN'))
    if (logError) {
      console.error('Erreur log connexion:', logError)
    }

    const response = NextResponse.json({
      success: true,
      user: userWithoutPassword
    })

    setAuthCookie(response, userWithoutPassword)
    return response

  } catch (error) {
    console.error('Erreur login:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
