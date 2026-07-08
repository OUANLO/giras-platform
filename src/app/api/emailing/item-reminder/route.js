import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getAuthenticatedUserFromRequest } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

const parseList = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
    } catch {}
    return value.split(/[;,]/).map((item) => String(item || '').trim()).filter(Boolean)
  }
  return []
}

const isFilled = (value) => !(value === null || value === undefined || `${value}`.trim() === '')
const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://giras.africa'

const getWrapper = (title, body) => `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title}</title></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#333"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:20px 0"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:8px;overflow:hidden"><tr><td style="background:linear-gradient(135deg,#1a365d 0%,#2c5282 100%);padding:28px;text-align:center;color:#fff"><h1 style="margin:0;font-size:26px">GIRAS</h1><p style="margin:8px 0 0;font-size:14px;color:#dbeafe">${title}</p></td></tr><tr><td style="padding:28px">${body}<div style="text-align:center;margin-top:24px"><a href="${appUrl}/login" style="display:inline-block;background:#1a365d;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold">Accéder à GIRAS</a></div></td></tr><tr><td style="padding:18px;text-align:center;background:#f8fafc;border-top:1px solid #e5e7eb;color:#999;font-size:11px">© ${(new Date()).getFullYear()} GIRAS. Tous droits réservés.</td></tr></table></td></tr></table></body></html>`

function getActionReminderTemplate({ targetUser, occurrence, action, sender }) {
  const title = `Relance - Action à poursuivre`
  const tx = Number(occurrence?.tx_avancement || 0)
  const body = `
    <h2 style="margin:0 0 16px;color:#1a365d;font-size:20px">Bonjour ${escapeHtml(targetUser?.prenoms || '')},</h2>
    <p style="margin:0 0 16px">Une relance vous est adressée concernant l'action ci-dessous, qui n'est pas encore terminée.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-left:4px solid #1a365d;border-radius:4px;margin:16px 0"><tr><td style="padding:18px">
      <p style="margin:0 0 8px"><strong>Action :</strong> ${escapeHtml(action?.libelle_action || occurrence?.libelle_action || '-')}</p>
      <p style="margin:0 0 8px"><strong>Code :</strong> ${escapeHtml(action?.code_action || occurrence?.code_action || '-')}</p>
      <p style="margin:0 0 8px"><strong>Projet :</strong> ${escapeHtml(action?.code_groupe || '-')}</p>
      <p style="margin:0 0 8px"><strong>Taux d'avancement :</strong> ${Number.isFinite(tx) ? tx.toFixed(1) : '0.0'}%</p>
      <p style="margin:0 0 8px"><strong>Date de début :</strong> ${escapeHtml(occurrence?.date_debut || '-')}</p>
      <p style="margin:0 0 8px"><strong>Date de fin :</strong> ${escapeHtml(occurrence?.date_fin || '-')}</p>
      <p style="margin:0"><strong>Relance effectuée par :</strong> ${escapeHtml(sender)}</p>
    </td></tr></table>
    <p style="margin:0">Merci de mettre à jour l'avancement de cette action dans la plateforme GIRAS.</p>
  `
  return {
    subject: `GIRAS - Relance action : ${action?.libelle_action || occurrence?.code_action || ''}`,
    htmlContent: getWrapper(title, body),
    textContent: `Bonjour ${targetUser?.prenoms || ''},

Relance concernant l'action : ${action?.libelle_action || occurrence?.code_action || '-'}
Code : ${action?.code_action || occurrence?.code_action || '-'}
Projet : ${action?.code_groupe || '-'}
Taux d'avancement : ${Number.isFinite(tx) ? tx.toFixed(1) : '0.0'}%
Date début : ${occurrence?.date_debut || '-'}
Date fin : ${occurrence?.date_fin || '-'}
Relance effectuée par : ${sender}

Merci de mettre à jour l'avancement dans GIRAS.

© ${(new Date()).getFullYear()} GIRAS. Tous droits réservés.`
  }
}

function getIndicatorReminderTemplate({ targetUser, occurrence, indicator, sender }) {
  const title = `Relance - Indicateur à renseigner`
  const body = `
    <h2 style="margin:0 0 16px;color:#1a365d;font-size:20px">Bonjour ${escapeHtml(targetUser?.prenoms || '')},</h2>
    <p style="margin:0 0 16px">Une relance vous est adressée concernant l'indicateur ci-dessous, qui n'est pas encore renseigné.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-left:4px solid #166534;border-radius:4px;margin:16px 0"><tr><td style="padding:18px">
      <p style="margin:0 0 8px"><strong>Indicateur :</strong> ${escapeHtml(indicator?.libelle_indicateur || '-')}</p>
      <p style="margin:0 0 8px"><strong>Code :</strong> ${escapeHtml(indicator?.code_indicateur || occurrence?.code_indicateur || '-')}</p>
      <p style="margin:0 0 8px"><strong>Structure :</strong> ${escapeHtml(indicator?.code_structure || occurrence?.code_structure || '-')}</p>
      <p style="margin:0 0 8px"><strong>Période :</strong> ${escapeHtml(occurrence?.periode || '-')}</p>
      <p style="margin:0 0 8px"><strong>Date limite :</strong> ${escapeHtml(occurrence?.date_limite_saisie || '-')}</p>
      <p style="margin:0"><strong>Relance effectuée par :</strong> ${escapeHtml(sender)}</p>
    </td></tr></table>
    <p style="margin:0">Merci de renseigner cet indicateur dans la plateforme GIRAS.</p>
  `
  return {
    subject: `GIRAS - Relance indicateur : ${indicator?.libelle_indicateur || occurrence?.code_indicateur || ''}`,
    htmlContent: getWrapper(title, body),
    textContent: `Bonjour ${targetUser?.prenoms || ''},

Relance concernant l'indicateur : ${indicator?.libelle_indicateur || occurrence?.code_indicateur || '-'}
Code : ${indicator?.code_indicateur || occurrence?.code_indicateur || '-'}
Structure : ${indicator?.code_structure || occurrence?.code_structure || '-'}
Période : ${occurrence?.periode || '-'}
Date limite : ${occurrence?.date_limite_saisie || '-'}
Relance effectuée par : ${sender}

Merci de renseigner cet indicateur dans GIRAS.

© ${(new Date()).getFullYear()} GIRAS. Tous droits réservés.`
  }
}

export async function POST(request) {
  try {
    const requester = getAuthenticatedUserFromRequest(request)
    if (!requester?.username) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await request.json()
    const { type, occurrenceId } = body || {}
    if (!type || !occurrenceId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    const supabase = createAdminClient(request)

    if (type === 'action') {
      const { data: occurrence, error: occError } = await supabase.from('action_occurrences').select('*').eq('id', occurrenceId).single()
      if (occError || !occurrence) return NextResponse.json({ error: 'Occurrence action introuvable' }, { status: 404 })
      if (Number(occurrence?.tx_avancement || 0) >= 100) return NextResponse.json({ error: 'Cette action est déjà terminée' }, { status: 400 })

      const { data: action } = await supabase.from('actions').select('*').eq('code_action', occurrence.code_action).maybeSingle()
      const { data: targetUser } = await supabase.from('users').select('*').eq('username', occurrence.responsable).maybeSingle()
      if (!targetUser?.username) return NextResponse.json({ error: 'Responsable introuvable' }, { status: 404 })

      let canSend = ['Admin', 'Super admin', 'Super manager'].includes(requester?.type_utilisateur)
      const { data: projet } = await supabase.from('groupes_actions').select('*').eq('code_groupe', action?.code_groupe || '').maybeSingle()
      const gestionnaires = parseList(projet?.gestionnaires || projet?.gestionnaire)
      if (!canSend) {
        canSend = gestionnaires.includes(requester.username)
      }
      if (!canSend) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

      const senderLabel = `${requester?.prenoms || ''} ${requester?.nom || ''}`.trim() || requester?.username || 'GIRAS'
      const tpl = getActionReminderTemplate({ targetUser, occurrence, action, sender: senderLabel })
      const emailResult = await sendEmail({ to: targetUser.username, subject: tpl.subject, htmlContent: tpl.htmlContent, textContent: tpl.textContent })
      if (!emailResult.success) return NextResponse.json({ error: emailResult.error || 'Échec envoi email' }, { status: 500 })
      return NextResponse.json({ success: true, message: 'Email de relance envoyé avec succès.' })
    }

    if (type === 'indicator') {
      const { data: occurrence, error: occError } = await supabase.from('indicateur_occurrences').select('*').eq('id', occurrenceId).single()
      if (occError || !occurrence) return NextResponse.json({ error: 'Occurrence indicateur introuvable' }, { status: 404 })
      if (isFilled(occurrence?.val_indicateur)) return NextResponse.json({ error: 'Cet indicateur est déjà renseigné' }, { status: 400 })

      const { data: indicator } = await supabase.from('indicateurs').select('*').eq('code_indicateur', occurrence.code_indicateur).maybeSingle()
      const { data: targetUser } = await supabase.from('users').select('*').eq('username', indicator?.responsable).maybeSingle()
      if (!indicator) return NextResponse.json({ error: 'Indicateur introuvable' }, { status: 404 })
      if (!targetUser?.username) return NextResponse.json({ error: 'Responsable introuvable' }, { status: 404 })

      let canSend = ['Admin', 'Super admin', 'Super manager'].includes(requester?.type_utilisateur)
      if (!canSend) {
        const groupCodes = parseList(indicator?.groupes)
        if (indicator?.code_groupe) groupCodes.push(indicator.code_groupe)
        const uniqueCodes = [...new Set(groupCodes.filter(Boolean))]
        if (uniqueCodes.length) {
          const { data: groups } = await supabase.from('groupe_indicateurs').select('*').in('code_groupe', uniqueCodes)
          canSend = (groups || []).some((group) => parseList(group?.gestionnaires || group?.gestionnaire).includes(requester.username))
        }
      }
      if (!canSend) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

      const senderLabel = `${requester?.prenoms || ''} ${requester?.nom || ''}`.trim() || requester?.username || 'GIRAS'
      const tpl = getIndicatorReminderTemplate({ targetUser, occurrence, indicator, sender: senderLabel })
      const emailResult = await sendEmail({ to: targetUser.username, subject: tpl.subject, htmlContent: tpl.htmlContent, textContent: tpl.textContent })
      if (!emailResult.success) return NextResponse.json({ error: emailResult.error || 'Échec envoi email' }, { status: 500 })
      return NextResponse.json({ success: true, message: 'Email de relance envoyé avec succès.' })
    }

    return NextResponse.json({ error: 'Type de relance non pris en charge' }, { status: 400 })
  } catch (error) {
    console.error('Erreur relance item:', error)
    return NextResponse.json({ error: error.message || 'Erreur lors de la relance' }, { status: 500 })
  }
}
