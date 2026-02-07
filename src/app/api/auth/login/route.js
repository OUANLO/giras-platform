import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyPassword } from '@/lib/utils'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Rechercher l'utilisateur
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

    // Vérifier si l'utilisateur est actif
    if (user.statut !== 'Actif') {
      return NextResponse.json(
        { error: 'Votre compte est désactivé. Contactez l\'administrateur.' },
        { status: 403 }
      )
    }

    // Vérifier le mot de passe
    const isValidPassword = await verifyPassword(password, user.password)
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Identifiants incorrects' },
        { status: 401 }
      )
    }

    // Ne pas retourner le mot de passe
    const { password: _, ...userWithoutPassword } = user

    // Logger la connexion
    await supabase.from('logs').insert({
      utilisateur: user.username,
      action: 'LOGIN',
      table_concernee: 'users',
      id_enregistrement: user.id,
      details: { type_utilisateur: user.type_utilisateur }
    })

    return NextResponse.json({
      success: true,
      user: userWithoutPassword
    })

  } catch (error) {
    console.error('Erreur login:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
