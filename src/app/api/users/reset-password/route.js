import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { hashPassword, generatePassword } from '@/lib/utils'
import { sendEmail, getPasswordResetEmailTemplate } from '@/lib/email'

// POST - Réinitialiser le mot de passe d'un utilisateur
export async function POST(request) {
  try {
    const body = await request.json()
    const { userId, adminUsername } = body

    if (!userId) {
      return NextResponse.json({ error: 'ID utilisateur requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Récupérer l'utilisateur à modifier
    const { data: targetUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Récupérer l'admin qui fait la demande
    const { data: adminUser } = await supabase
      .from('users')
      .select('type_utilisateur')
      .eq('username', adminUsername)
      .single()

    // Vérifier les permissions
    // Seuls Super Admin et Admin peuvent réinitialiser
    if (!adminUser || !['Super admin', 'Admin'].includes(adminUser.type_utilisateur)) {
      return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
    }

    // Un Admin ne peut pas réinitialiser le mot de passe d'un Super Admin
    if (adminUser.type_utilisateur === 'Admin' && targetUser.type_utilisateur === 'Super admin') {
      return NextResponse.json({ error: 'Vous ne pouvez pas réinitialiser le mot de passe du Super Admin' }, { status: 403 })
    }

    // Générer un nouveau mot de passe
    const newPassword = generatePassword(10)
    const hashedPassword = await hashPassword(newPassword)

    // Mettre à jour le mot de passe
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        password: hashedPassword,
        modificateur: adminUsername
      })
      .eq('id', userId)

    if (updateError) throw updateError

    // Envoyer l'email avec le nouveau mot de passe
    const emailTemplate = getPasswordResetEmailTemplate(targetUser, newPassword)
    
    const emailResult = await sendEmail({
      to: targetUser.username,
      subject: emailTemplate.subject,
      htmlContent: emailTemplate.htmlContent,
      textContent: emailTemplate.textContent
    })

    // Archiver l'email dans email_logs
    await supabase.from('email_logs').insert({
      destinataire: targetUser.username,
      destinataire_nom: `${targetUser.prenoms} ${targetUser.nom}`,
      sujet: emailTemplate.subject,
      type_email: 'reset_password',
      statut: emailResult.success ? 'envoyé' : 'échec',
      message_id: emailResult.messageId || null,
      erreur: emailResult.success ? null : emailResult.error,
      source: 'manuel',
      createur: adminUsername
    }).catch(err => console.error('[EMAIL_LOG] Erreur archivage:', err))

    // Logger l'action
    await supabase.from('logs').insert({
      utilisateur: adminUsername,
      action: 'RESET_PASSWORD',
      table_concernee: 'users',
      id_enregistrement: userId,
      details: { 
        target_username: targetUser.username,
        email_sent: emailResult.success,
        email_error: emailResult.error || null
      }
    })

    // Construire le message de retour selon le statut de l'email
    let message = `Mot de passe réinitialisé avec succès.`
    if (emailResult.success) {
      message += ` Un email a été envoyé à ${targetUser.username}.`
    } else {
      message += ` L'email n'a pas pu être envoyé (${emailResult.error}).`
    }

    // Retourner le mot de passe UNIQUEMENT si l'email n'a pas été envoyé
    return NextResponse.json({ 
      success: true, 
      message,
      emailSent: emailResult.success,
      emailError: emailResult.error || null,
      tempPassword: emailResult.success ? null : newPassword
    })

  } catch (error) {
    console.error('Erreur reset password:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
