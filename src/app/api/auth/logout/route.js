import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, clearAuthCookie, getAuthenticatedUserFromRequest, verifyAuthToken } from '@/lib/auth'
import { createRawAdminClient } from '@/lib/supabase-server'

function readUserFromHeaders(request) {
  const email = request.headers.get('x-user-email') || request.headers.get('x-forwarded-user') || ''
  const type_utilisateur = request.headers.get('x-user-type') || ''
  const id = request.headers.get('x-user-id') || null
  if (!email) return null
  return { username: email, type_utilisateur, id }
}

function readUserFromCookieHeader(request) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    if (!cookieHeader) return null
    const parts = cookieHeader.split(/;\s*/)
    const authPart = parts.find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    if (!authPart) return null
    const token = authPart.slice(AUTH_COOKIE_NAME.length + 1)
    const user = verifyAuthToken(token)
    if (!user?.username) return null
    return user
  } catch {
    return null
  }
}

async function readUserFromBody(request) {
  try {
    const body = await request.json()
    const email = body?.email || body?.username || ''
    if (!email) return null
    return {
      username: email,
      type_utilisateur: body?.type_utilisateur || body?.type || '',
      id: body?.id || null
    }
  } catch {
    return null
  }
}

async function resolveLogoutUser(request) {
  const bodyUser = await readUserFromBody(request)
  const candidate = (
    bodyUser ||
    getAuthenticatedUserFromRequest(request) ||
    readUserFromCookieHeader(request) ||
    readUserFromHeaders(request) ||
    null
  )

  if (!candidate?.username) return null

  if (candidate.id && candidate.type_utilisateur) return candidate

  try {
    const supabase = createRawAdminClient()
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, username, type_utilisateur')
      .eq('username', String(candidate.username).toLowerCase())
      .maybeSingle()

    if (dbUser?.username) {
      return {
        username: dbUser.username,
        type_utilisateur: dbUser.type_utilisateur || candidate.type_utilisateur || 'Inconnu',
        id: dbUser.id || candidate.id || null
      }
    }
  } catch (error) {
    console.error('Erreur résolution utilisateur logout:', error)
  }

  return {
    username: candidate.username,
    type_utilisateur: candidate.type_utilisateur || 'Inconnu',
    id: candidate.id || null
  }
}

function buildLogoutLogEntry(user) {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 19)
  return {
    utilisateur: user.username,
    action: 'LOGOUT',
    table_concernee: 'users',
    id_enregistrement: user.id || null,
    details: {
      utilisateur: user.username,
      user_email: user.username,
      type_utilisateur: user.type_utilisateur || 'Inconnu',
      date_action: date,
      heure_action: time,
      date_deconnexion: date,
      heure_deconnexion: time,
      table_concernee: 'users',
      id_enregistrement: user.id || null,
      type_action: 'LOGOUT'
    }
  }
}

async function handleLogout(request) {
  const response = NextResponse.json({ success: true })

  try {
    const user = await resolveLogoutUser(request)

    if (!user?.username) {
      console.warn('Déconnexion sans utilisateur identifié: aucun log inséré')
      return clearAuthCookie(response)
    }

    const supabase = createRawAdminClient()
    const payload = buildLogoutLogEntry(user)
    const { error } = await supabase.from('logs').insert(payload)

    if (error) {
      console.error('Erreur insertion log logout:', error)
    }
  } catch (error) {
    console.error('Erreur logout log:', error)
  }

  return clearAuthCookie(response)
}

export async function POST(request) {
  return handleLogout(request)
}

export async function GET(request) {
  return handleLogout(request)
}
