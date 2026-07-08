import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { isAdminType, canAccessAdministration, canSendReminders } from '@/lib/roles'

export const AUTH_COOKIE_NAME = 'giras_auth'
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

const getSecret = () => process.env.AUTH_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'giras-local-dev-secret'

const encodeBase64Url = (value) => Buffer.from(value).toString('base64url')
const decodeBase64Url = (value) => Buffer.from(value, 'base64url').toString('utf8')

function signValue(value) {
  return createHmac('sha256', getSecret()).update(value).digest('base64url')
}

function getCookieOptions(maxAge = AUTH_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge
  }
}

export function createAuthToken(user) {
  const payload = {
    username: user?.username || '',
    type_utilisateur: user?.type_utilisateur || '',
    nom: user?.nom || '',
    prenoms: user?.prenoms || '',
    acces_admin: user?.acces_admin || 'Non',
    peut_creer_projets: user?.peut_creer_projets || 'Non',
    peut_creer_groupes_indicateurs: user?.peut_creer_groupes_indicateurs || 'Non',
    admin_structures_droit: user?.admin_structures_droit || 'none',
    admin_flash_droit: user?.admin_flash_droit || 'none',
    admin_emailing_acces: user?.admin_emailing_acces || 'Non'
  }
  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  const signature = signValue(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export function verifyAuthToken(token) {
  if (!token || !token.includes('.')) return null
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  const expected = signValue(encodedPayload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  try {
    return JSON.parse(decodeBase64Url(encodedPayload))
  } catch {
    return null
  }
}

export function setAuthCookie(response, user) {
  response.cookies.set(AUTH_COOKIE_NAME, createAuthToken(user), getCookieOptions())
  return response
}

export function clearAuthCookie(response = NextResponse.json({ success: true })) {
  response.cookies.set(AUTH_COOKIE_NAME, '', getCookieOptions(0))
  return response
}

export function getAuthenticatedUserFromRequest(request) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  return verifyAuthToken(token)
}

export function requireAdminAccess(request) {
  const user = getAuthenticatedUserFromRequest(request)
  if (!isAdminType(user)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  return user
}


export function requireAdministrationAccess(request) {
  const user = getAuthenticatedUserFromRequest(request)
  if (!canAccessAdministration(user)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  return user
}

export function requireReminderAccess(request) {
  const user = getAuthenticatedUserFromRequest(request)
  if (!canSendReminders(user)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  return user
}
