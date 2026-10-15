// Service d'envoi d'emails via Brevo (ex-Sendinblue)

export async function sendEmail({ to, subject, htmlContent, textContent }) {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@giras.africa'
  const senderName = process.env.BREVO_SENDER_NAME || 'GIRAS - CNAM'

  console.log(`[EMAIL] Tentative d'envoi à: ${to}`)
  console.log(`[EMAIL] Sujet: ${subject}`)
  console.log(`[EMAIL] Expéditeur: ${senderName} <${senderEmail}>`)

  if (!apiKey) {
    console.error('[EMAIL] BREVO_API_KEY non configurée')
    return { success: false, error: 'Configuration email manquante (BREVO_API_KEY)', code: 'NO_API_KEY' }
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent
      })
    })

    const result = await response.json()
    console.log('[EMAIL] Réponse Brevo:', JSON.stringify(result))

    if (!response.ok) {
      console.error('[EMAIL] Erreur Brevo:', result)
      return { 
        success: false, 
        error: result.message || 'Erreur lors de l\'envoi', 
        code: 'BREVO_ERROR',
        status: response.status 
      }
    }
    
    console.log(`[EMAIL] ✅ Email envoyé avec succès. MessageId: ${result.messageId}`)
    return { success: true, messageId: result.messageId }
  } catch (error) {
    console.error('[EMAIL] Erreur réseau ou exception:', error.message)
    
    if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      return { 
        success: false, 
        error: 'Impossible de contacter le serveur email. Le domaine api.brevo.com doit être autorisé.', 
        code: 'NETWORK_ERROR' 
      }
    }
    
    return { success: false, error: error.message, code: 'EXCEPTION' }
  }
}

// ============================================
// TEMPLATES D'EMAILS
// ============================================

const getAppUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://giras.africa'
const getCurrentYear = () => new Date().getFullYear()

// Template de base HTML
function getEmailWrapper(title, content, showButton = true, buttonText = 'Accéder à GIRAS', buttonUrl = null) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  const finalButtonUrl = buttonUrl || `${appUrl}/login`
  
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; background-color: #f4f4f4;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f4;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">GIRAS</h1>
                  <p style="margin: 10px 0 0; color: #e2e8f0; font-size: 14px;">${title}</p>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 30px;">
                  ${content}
                  ${showButton ? `
                  <!-- Button -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${finalButtonUrl}" style="display: inline-block; background-color: #1a365d; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">${buttonText}</a>
                      </td>
                    </tr>
                  </table>
                  ` : ''}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #999999; font-size: 11px;">© ${currentYear} GIRAS. Tous droits réservés.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

// ============================================
// 1. EMAIL DE BIENVENUE (création compte)
// ============================================
export function getWelcomeEmailTemplate(user) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  
  const content = `
    <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 20px;">Bonjour ${user.prenoms} ${user.nom},</h2>
    <p style="margin: 0 0 20px; color: #333333;">Votre compte sur la plateforme GIRAS de la CNAM a été créé avec succès. Vous pouvez maintenant accéder à l'application avec les identifiants ci-dessous :</p>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border-left: 4px solid #1a365d; border-radius: 4px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 10px;"><strong style="color: #1a365d;">Identifiant (email) :</strong> ${user.username}</p>
          <p style="margin: 0 0 10px;"><strong style="color: #1a365d;">Mot de passe :</strong> ${user.password}</p>
          <p style="margin: 0 0 10px;"><strong style="color: #1a365d;">Structure :</strong> ${user.structure}</p>
          <p style="margin: 0;"><strong style="color: #1a365d;">Profil :</strong> ${user.type_utilisateur}</p>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0 0 20px; color: #333333;"><strong>Recommandation de sécurité :</strong> Veuillez modifier votre mot de passe lors de votre première connexion.</p>
    
    <p style="margin: 0; color: #333333;">Lien d'accès : <a href="${appUrl}/login" style="color: #1a365d;">${appUrl}/login</a></p>
  `
  
  return {
    subject: `GIRAS - Création de votre compte utilisateur`,
    htmlContent: getEmailWrapper('Bienvenue sur GIRAS', content, true, 'Accéder à GIRAS'),
    textContent: `
GIRAS - Création de votre compte utilisateur

Bonjour ${user.prenoms} ${user.nom},

Votre compte sur la plateforme GIRAS de la CNAM a été créé avec succès.

Vos identifiants de connexion :
- Identifiant (email) : ${user.username}
- Mot de passe : ${user.password}
- Structure : ${user.structure}
- Profil : ${user.type_utilisateur}

Recommandation de sécurité : Veuillez modifier votre mot de passe lors de votre première connexion.

Lien d'accès : ${appUrl}/login

---
© ${currentYear} GIRAS. Tous droits réservés.
    `
  }
}

// ============================================
// 2. EMAIL DE RÉINITIALISATION MOT DE PASSE
// ============================================
export function getPasswordResetEmailTemplate(user, newPassword) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  
  const content = `
    <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 20px;">Bonjour ${user.prenoms} ${user.nom},</h2>
    <p style="margin: 0 0 20px; color: #333333;">Votre mot de passe pour accéder à la plateforme GIRAS a été réinitialisé par un administrateur.</p>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fff7ed; border-left: 4px solid #f7941d; border-radius: 4px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0;"><strong style="color: #9a3412;">Nouveau mot de passe :</strong> <span style="font-family: monospace; font-size: 16px; color: #1a365d; font-weight: bold;">${newPassword}</span></p>
        </td>
      </tr>
    </table>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; margin: 20px 0;">
      <tr>
        <td style="padding: 15px;">
          <p style="margin: 0; color: #92400e; font-size: 13px;"><strong>Recommandation de sécurité :</strong> Veuillez modifier ce mot de passe dès votre prochaine connexion.</p>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: #333333;">Lien d'accès : <a href="${appUrl}/login" style="color: #1a365d;">${appUrl}/login</a></p>
  `
  
  return {
    subject: 'GIRAS - Réinitialisation de votre mot de passe',
    htmlContent: getEmailWrapper('Réinitialisation de mot de passe', content, true, 'Se connecter'),
    textContent: `
GIRAS - Réinitialisation de votre mot de passe

Bonjour ${user.prenoms} ${user.nom},

Votre mot de passe pour accéder à la plateforme GIRAS a été réinitialisé par un administrateur.

Nouveau mot de passe : ${newPassword}

Recommandation de sécurité : Veuillez modifier ce mot de passe dès votre prochaine connexion.

Lien d'accès : ${appUrl}/login

---
© ${currentYear} GIRAS. Tous droits réservés.
    `
  }
}

// ============================================
// 3. EMAIL D'ATTRIBUTION D'ACTION
// ============================================
export function getActionAssignmentEmailTemplate(user, action, assignateur = null) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  
  const assignateurInfo = assignateur ? `
    <p style="margin: 0 0 8px;"><strong style="color: #9a3412;">Assigné par :</strong> ${assignateur.nom || ''} ${assignateur.prenoms || ''} (${assignateur.email || assignateur.username || '-'})</p>
  ` : ''
  
  const assignateurText = assignateur ? `Assigné par : ${assignateur.nom || ''} ${assignateur.prenoms || ''} (${assignateur.email || assignateur.username || '-'})` : ''
  
  const content = `
    <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 20px;">Bonjour ${user.prenoms},</h2>
    <p style="margin: 0 0 20px; color: #333333;">Une nouvelle action vous a été assignée dans GIRAS :</p>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fff7ed; border-left: 4px solid #f7941d; border-radius: 4px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="margin: 0 0 15px; color: #1a365d; font-size: 16px;">${action.libelle_action}</h3>
          <p style="margin: 0 0 8px;"><strong style="color: #9a3412;">Projet :</strong> ${action.code_groupe || '-'}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #9a3412;">Date de début :</strong> ${action.date_debut || '-'}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #9a3412;">Date de fin :</strong> ${action.date_fin || '-'}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #9a3412;">Structure :</strong> ${action.code_structure || '-'}</p>
          ${assignateurInfo}
        </td>
      </tr>
    </table>
    
    <p style="margin: 20px 0 0; color: #333333;">Vous êtes désormais responsable du suivi et de la réalisation de cette action.</p>
  `
  
  return {
    subject: `GIRAS - Nouvelle action assignée : ${action.libelle_action}`,
    htmlContent: getEmailWrapper('Nouvelle action assignée', content, true, 'Accéder à GIRAS'),
    textContent: `
GIRAS - Nouvelle action assignée

Bonjour ${user.prenoms},

Une nouvelle action vous a été assignée dans GIRAS :

Action : ${action.libelle_action}
Projet : ${action.code_groupe || '-'}
Date de début : ${action.date_debut || '-'}
Date de fin : ${action.date_fin || '-'}
Structure : ${action.code_structure || '-'}
${assignateurText}

Vous êtes désormais responsable du suivi et de la réalisation de cette action.

Lien d'accès : ${appUrl}/login

---
© ${currentYear} GIRAS. Tous droits réservés.
    `
  }
}

// ============================================
// 4. EMAIL D'ATTRIBUTION D'INDICATEUR
// ============================================
export function getIndicatorAssignmentEmailTemplate(user, indicateur, assignateur = null) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  
  const assignateurInfo = assignateur ? `
    <p style="margin: 0 0 8px;"><strong style="color: #166534;">Assigné par :</strong> ${assignateur.nom || ''} ${assignateur.prenoms || ''} (${assignateur.email || assignateur.username || '-'})</p>
  ` : ''
  
  const assignateurText = assignateur ? `Assigné par : ${assignateur.nom || ''} ${assignateur.prenoms || ''} (${assignateur.email || assignateur.username || '-'})` : ''
  
  const content = `
    <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 20px;">Bonjour ${user.prenoms},</h2>
    <p style="margin: 0 0 20px; color: #333333;">Un nouvel indicateur vous a été assigné dans GIRAS :</p>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="margin: 0 0 15px; color: #1a365d; font-size: 16px;">${indicateur.libelle_indicateur}</h3>
          <p style="margin: 0 0 8px;"><strong style="color: #166534;">Structure :</strong> ${indicateur.code_structure || '-'}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #166534;">Périodicité :</strong> ${indicateur.periodicite || '-'}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #166534;">Type :</strong> ${indicateur.type_indicateur || '-'}</p>
          ${indicateur.source ? `<p style="margin: 0 0 8px;"><strong style="color: #166534;">Source :</strong> ${indicateur.source}</p>` : ''}
          ${assignateurInfo}
        </td>
      </tr>
    </table>
    
    <p style="margin: 20px 0 0; color: #333333;">Vous êtes désormais responsable du suivi et du renseignement de cet indicateur.</p>
  `
  
  return {
    subject: `GIRAS - Nouvel indicateur assigné : ${indicateur.libelle_indicateur}`,
    htmlContent: getEmailWrapper('Nouvel indicateur assigné', content, true, 'Accéder à GIRAS'),
    textContent: `
GIRAS - Nouvel indicateur assigné

Bonjour ${user.prenoms},

Un nouvel indicateur vous a été assigné dans GIRAS :

Indicateur : ${indicateur.libelle_indicateur}
Structure : ${indicateur.code_structure || '-'}
Périodicité : ${indicateur.periodicite || '-'}
Type : ${indicateur.type_indicateur || '-'}
${indicateur.source ? `Source : ${indicateur.source}` : ''}
${assignateurText}

Vous êtes désormais responsable du suivi et du renseignement de cet indicateur.

Lien d'accès : ${appUrl}/login

---
© ${currentYear} GIRAS. Tous droits réservés.
    `
  }
}

// ============================================
// 5. EMAIL D'OCCURRENCE D'INDICATEUR
// ============================================
export function getIndicatorOccurrenceEmailTemplate(user, occurrence, assignateur = null) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  
  const assignateurInfo = assignateur ? `
    <p style="margin: 0 0 8px;"><strong style="color: #166534;">Assigné par :</strong> ${assignateur.nom || ''} ${assignateur.prenoms || ''} (${assignateur.email || assignateur.username || '-'})</p>
  ` : ''
  
  const assignateurText = assignateur ? `Assigné par : ${assignateur.nom || ''} ${assignateur.prenoms || ''} (${assignateur.email || assignateur.username || '-'})` : ''
  
  const content = `
    <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 20px;">Bonjour ${user.prenoms},</h2>
    <p style="margin: 0 0 20px; color: #333333;">Une nouvelle occurrence d'indicateur vous a été assignée dans GIRAS :</p>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="margin: 0 0 15px; color: #1a365d; font-size: 16px;">${occurrence.libelle_indicateur}</h3>
          <p style="margin: 0 0 8px;"><strong style="color: #166534;">Période :</strong> ${occurrence.periode || '-'}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #166534;">Date limite de saisie :</strong> ${occurrence.date_limite || '-'}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #166534;">Date de fin :</strong> ${occurrence.date_fin || '-'}</p>
          ${occurrence.cible ? `<p style="margin: 0 0 8px;"><strong style="color: #166534;">Cible :</strong> ${occurrence.cible}</p>` : ''}
          ${assignateurInfo}
        </td>
      </tr>
    </table>
    
    <p style="margin: 20px 0 0; color: #333333;">Veuillez renseigner cet indicateur avant la date limite de saisie.</p>
  `
  
  return {
    subject: `GIRAS - Indicateur à renseigner : ${occurrence.libelle_indicateur}`,
    htmlContent: getEmailWrapper('Indicateur à renseigner', content, true, 'Accéder à GIRAS'),
    textContent: `
GIRAS - Indicateur à renseigner

Bonjour ${user.prenoms},

Une nouvelle occurrence d'indicateur vous a été assignée dans GIRAS :

Indicateur : ${occurrence.libelle_indicateur}
Période : ${occurrence.periode || '-'}
Date limite de saisie : ${occurrence.date_limite || '-'}
Date de fin : ${occurrence.date_fin || '-'}
${occurrence.cible ? `Cible : ${occurrence.cible}` : ''}
${assignateurText}

Veuillez renseigner cet indicateur avant la date limite de saisie.

Lien d'accès : ${appUrl}/login

---
© ${currentYear} GIRAS. Tous droits réservés.
    `
  }
}

// ============================================
// 6. EMAIL DE CONFIRMATION GESTIONNAIRE (Action 100%)
// ============================================
export function getActionPendingConfirmationEmailTemplate(user, action) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  
  const content = `
    <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 20px;">Bonjour ${user.prenoms},</h2>
    <p style="margin: 0 0 20px; color: #333333;">Une action a atteint 100% de réalisation et est en attente de votre confirmation :</p>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="margin: 0 0 15px; color: #1a365d; font-size: 16px;">${action.libelle_action}</h3>
          <p style="margin: 0 0 8px;"><strong style="color: #92400e;">Projet :</strong> ${action.code_groupe || '-'}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #92400e;">Responsable :</strong> ${action.responsable || '-'}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #92400e;">Date de fin :</strong> ${action.date_fin || '-'}</p>
          <p style="margin: 0;"><strong style="color: #92400e;">Taux de réalisation :</strong> <span style="color: #22c55e; font-weight: bold;">100%</span></p>
        </td>
      </tr>
    </table>
    
    <p style="margin: 20px 0 0; color: #333333;">En tant que gestionnaire, veuillez vous connecter à GIRAS pour confirmer l'achèvement de cette action.</p>
  `
  
  return {
    subject: `GIRAS - Action en attente de confirmation : ${action.libelle_action}`,
    htmlContent: getEmailWrapper('Action en attente de confirmation', content, true, 'Confirmer l\'action'),
    textContent: `
GIRAS - Action en attente de confirmation

Bonjour ${user.prenoms},

Une action a atteint 100% de réalisation et est en attente de votre confirmation :

Action : ${action.libelle_action}
Projet : ${action.code_groupe || '-'}
Responsable : ${action.responsable || '-'}
Date de fin : ${action.date_fin || '-'}
Taux de réalisation : 100%

En tant que gestionnaire, veuillez vous connecter à GIRAS pour confirmer l'achèvement de cette action.

Lien d'accès : ${appUrl}/login

---
© ${currentYear} GIRAS. Tous droits réservés.
    `
  }
}

// ============================================
// 6b. EMAIL D'ATTRIBUTION DE TÂCHE
// ============================================
export function getTacheAssignmentEmailTemplate(user, tache, assignateur = null) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  
  const assignateurInfo = assignateur ? `
    <p style="margin: 0 0 8px;"><strong style="color: #9a3412;">Assigné par :</strong> ${assignateur.nom || ''} ${assignateur.prenoms || ''} (${assignateur.email || assignateur.username || '-'})</p>
  ` : ''
  
  const assignateurText = assignateur ? `Assigné par : ${assignateur.nom || ''} ${assignateur.prenoms || ''} (${assignateur.email || assignateur.username || '-'})` : ''
  
  const content = `
    <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 20px;">Bonjour ${user.prenoms},</h2>
    <p style="margin: 0 0 20px; color: #333333;">Une nouvelle tâche vous a été assignée dans GIRAS :</p>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="margin: 0 0 15px; color: #1a365d; font-size: 16px;">${tache.libelle_tache}</h3>
          <p style="margin: 0 0 8px;"><strong style="color: #92400e;">Action :</strong> ${tache.libelle_action || '-'}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #92400e;">Date de début :</strong> ${tache.date_debut || '-'}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #92400e;">Date de fin :</strong> ${tache.date_fin || '-'}</p>
          ${assignateurInfo}
        </td>
      </tr>
    </table>
    
    <p style="margin: 20px 0 0; color: #333333;">Vous êtes désormais responsable de la réalisation de cette tâche.</p>
  `
  
  return {
    subject: `GIRAS - Nouvelle tâche assignée : ${tache.libelle_tache}`,
    htmlContent: getEmailWrapper('Nouvelle tâche assignée', content, true, 'Accéder à GIRAS'),
    textContent: `
GIRAS - Nouvelle tâche assignée

Bonjour ${user.prenoms},

Une nouvelle tâche vous a été assignée dans GIRAS :

Tâche : ${tache.libelle_tache}
Action : ${tache.libelle_action || '-'}
Date de début : ${tache.date_debut || '-'}
Date de fin : ${tache.date_fin || '-'}
${assignateurText}

Vous êtes désormais responsable de la réalisation de cette tâche.

Lien d'accès : ${appUrl}/login

---
© ${currentYear} GIRAS. Tous droits réservés.
    `
  }
}

// ============================================
// 7. EMAIL DE RAPPEL (Actions et Indicateurs en attente)
// ============================================
export function getReminderEmailTemplate(user, pendingActions, pendingIndicators, totalActions = 0, totalIndicateurs = 0) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  
  // Helper pour générer un tableau d'actions avec jours de retard/restants
  const generateActionsTable = (actions, title, icon, bgColor, titleColor, isRetard = false) => {
    if (!actions || actions.length === 0) return ''
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return `
      <h4 style="margin: 15px 0 10px; color: ${titleColor}; font-size: 14px; display: flex; align-items: center;">${icon} ${title} (${actions.length})</h4>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 15px;">
        <tr style="background-color: ${bgColor};">
          <th style="padding: 8px; text-align: left; font-size: 11px; color: #374151; border-bottom: 1px solid #e2e8f0;">Projet</th>
          <th style="padding: 8px; text-align: left; font-size: 11px; color: #374151; border-bottom: 1px solid #e2e8f0;">Action</th>
          <th style="padding: 8px; text-align: center; font-size: 11px; color: #374151; border-bottom: 1px solid #e2e8f0;">Dates</th>
          <th style="padding: 8px; text-align: center; font-size: 11px; color: #374151; border-bottom: 1px solid #e2e8f0;">Avancement</th>
          <th style="padding: 8px; text-align: center; font-size: 11px; color: #374151; border-bottom: 1px solid #e2e8f0;">${isRetard ? 'Jours retard' : 'Jours restants'}</th>
        </tr>
        ${actions.map(a => {
          const dateFin = a.date_fin ? new Date(a.date_fin) : null
          let joursInfo = '-'
          let joursColor = '#6b7280'
          if (dateFin) {
            dateFin.setHours(0, 0, 0, 0)
            const diffDays = Math.ceil((dateFin - today) / (1000 * 60 * 60 * 24))
            if (diffDays < 0) {
              joursInfo = `${Math.abs(diffDays)} j`
              joursColor = '#dc2626'
            } else if (diffDays === 0) {
              joursInfo = "Aujourd'hui"
              joursColor = '#f59e0b'
            } else {
              joursInfo = `${diffDays} j`
              joursColor = diffDays <= 7 ? '#f59e0b' : '#22c55e'
            }
          }
          return `
          <tr>
            <td style="padding: 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0;">${a.code_groupe || '-'}</td>
            <td style="padding: 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0;">${a.libelle_action}</td>
            <td style="padding: 8px; font-size: 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">${a.date_debut || '-'}<br>→ ${a.date_fin || '-'}</td>
            <td style="padding: 8px; font-size: 11px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <span style="font-weight: bold; color: ${a.tx_avancement >= 75 ? '#22c55e' : a.tx_avancement >= 50 ? '#f59e0b' : '#ef4444'};">${a.tx_avancement || 0}%</span>
            </td>
            <td style="padding: 8px; font-size: 11px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: ${joursColor};">${joursInfo}</td>
          </tr>
          `
        }).join('')}
      </table>
    `
  }
  
  // Helper pour générer un tableau d'indicateurs avec jours de retard/restants
  const generateIndicateursTable = (indicateurs, title, icon, bgColor, titleColor, isRetard = false) => {
    if (!indicateurs || indicateurs.length === 0) return ''
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return `
      <h4 style="margin: 15px 0 10px; color: ${titleColor}; font-size: 14px;">${icon} ${title} (${indicateurs.length})</h4>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 15px;">
        <tr style="background-color: ${bgColor};">
          <th style="padding: 8px; text-align: left; font-size: 11px; color: #374151; border-bottom: 1px solid #e2e8f0;">Groupe</th>
          <th style="padding: 8px; text-align: left; font-size: 11px; color: #374151; border-bottom: 1px solid #e2e8f0;">Indicateur</th>
          <th style="padding: 8px; text-align: center; font-size: 11px; color: #374151; border-bottom: 1px solid #e2e8f0;">Période</th>
          <th style="padding: 8px; text-align: center; font-size: 11px; color: #374151; border-bottom: 1px solid #e2e8f0;">Date limite</th>
          <th style="padding: 8px; text-align: center; font-size: 11px; color: #374151; border-bottom: 1px solid #e2e8f0;">${isRetard ? 'Jours retard' : 'Jours restants'}</th>
        </tr>
        ${indicateurs.map(i => {
          const dateLimite = i.date_limite ? new Date(i.date_limite) : null
          let joursInfo = '-'
          let joursColor = '#6b7280'
          if (dateLimite) {
            dateLimite.setHours(0, 0, 0, 0)
            const diffDays = Math.ceil((dateLimite - today) / (1000 * 60 * 60 * 24))
            if (diffDays < 0) {
              joursInfo = `${Math.abs(diffDays)} j`
              joursColor = '#dc2626'
            } else if (diffDays === 0) {
              joursInfo = "Aujourd'hui"
              joursColor = '#f59e0b'
            } else {
              joursInfo = `${diffDays} j`
              joursColor = diffDays <= 7 ? '#f59e0b' : '#22c55e'
            }
          }
          return `
          <tr>
            <td style="padding: 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1a365d;">${i.code_groupe || '-'}</td>
            <td style="padding: 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0;">${i.libelle_indicateur}</td>
            <td style="padding: 8px; font-size: 11px; text-align: center; border-bottom: 1px solid #e2e8f0;">${i.periode || '-'}</td>
            <td style="padding: 8px; font-size: 11px; text-align: center; border-bottom: 1px solid #e2e8f0;">${i.date_limite || '-'}</td>
            <td style="padding: 8px; font-size: 11px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: ${joursColor};">${joursInfo}</td>
          </tr>
          `
        }).join('')}
      </table>
    `
  }
  
  // Générer le HTML pour les actions (3 catégories)
  let actionsHtml = ''
  if (totalActions > 0) {
    actionsHtml = `
      <h3 style="margin: 20px 0 15px; color: #1a365d; font-size: 16px;">📋 Actions (${totalActions})</h3>
      ${generateActionsTable(pendingActions.enRetard, 'Actions en retard', '🔴', '#fef2f2', '#dc2626', true)}
      ${generateActionsTable(pendingActions.enCours, 'Actions à réaliser maintenant', '🟠', '#fff7ed', '#ea580c', false)}
      ${generateActionsTable(pendingActions.aVenir, 'Actions à venir', '🟢', '#f0fdf4', '#16a34a', false)}
    `
  }
  
  // Générer le HTML pour les indicateurs (3 catégories)
  // NOTE: dans certains flux (ex: CRON), le totalIndicateurs transmis peut être à 0
  // alors que des indicateurs "pending" existent. Pour garantir le même format
  // entre envois manuels et automatiques, on retombe sur le total des listes pending.
  const pendingIndicateursCount =
    (pendingIndicators?.enRetard?.length || 0) +
    (pendingIndicators?.aRenseigner?.length || 0) +
    (pendingIndicators?.aVenir?.length || 0)
  const effectiveTotalIndicateurs =
    Number.isFinite(totalIndicateurs) && totalIndicateurs > 0
      ? totalIndicateurs
      : pendingIndicateursCount

  let indicatorsHtml = ''
  if (effectiveTotalIndicateurs > 0) {
    indicatorsHtml = `
      <h3 style="margin: 30px 0 15px; color: #1a365d; font-size: 16px;">📊 Indicateurs (${effectiveTotalIndicateurs})</h3>
      ${generateIndicateursTable(pendingIndicators.enRetard, 'Indicateurs en retard', '🔴', '#fef2f2', '#dc2626', true)}
      ${generateIndicateursTable(pendingIndicators.aRenseigner, 'Indicateurs à renseigner maintenant', '🟠', '#fff7ed', '#ea580c', false)}
      ${generateIndicateursTable(pendingIndicators.aVenir, 'Indicateurs à renseigner prochainement (période à venir dans les 10 jours) (période à venir dans les 10 jours)', '🟢', '#f0fdf4', '#16a34a', false)}
    `
  }
  
  const content = `
    <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 20px;">Bonjour ${user.prenoms},</h2>
    <p style="margin: 0 0 20px; color: #333333;">Voici le récapitulatif de vos activités en attente sur GIRAS :</p>
    
    ${actionsHtml}
    ${indicatorsHtml}
    
    <p style="margin: 30px 0 0; color: #333333;">Veuillez vous connecter à GIRAS pour traiter ces éléments.</p>
  `
  
  // Texte brut pour les actions
  const allActions = [
    ...(pendingActions?.enRetard || []).map(a => `[RETARD] ${a.libelle_action} (${a.code_groupe || '-'}) | ${a.date_debut} → ${a.date_fin} | ${a.tx_avancement}%`),
    ...(pendingActions?.enCours || []).map(a => `[EN COURS] ${a.libelle_action} (${a.code_groupe || '-'}) | ${a.date_debut} → ${a.date_fin} | ${a.tx_avancement}%`),
    ...(pendingActions?.aVenir || []).map(a => `[À VENIR] ${a.libelle_action} (${a.code_groupe || '-'}) | ${a.date_debut} → ${a.date_fin} | ${a.tx_avancement}%`)
  ]
  const actionsText = allActions.length > 0 ? allActions.join('\n') : 'Aucune action en attente.'
  
  // Texte brut pour les indicateurs
  const allIndicateurs = [
    ...(pendingIndicators?.enRetard || []).map(i => `[RETARD] [${i.code_groupe}] ${i.libelle_indicateur} | Période: ${i.periode} | Limite: ${i.date_limite}`),
    ...(pendingIndicators?.aRenseigner || []).map(i => `[À RENSEIGNER] [${i.code_groupe}] ${i.libelle_indicateur} | Période: ${i.periode} | Limite: ${i.date_limite}`),
    ...(pendingIndicators?.aVenir || []).map(i => `[À VENIR] [${i.code_groupe}] ${i.libelle_indicateur} | Période: ${i.periode} | Limite: ${i.date_limite}`)
  ]
  const indicatorsText = allIndicateurs.length > 0 ? allIndicateurs.join('\n') : 'Aucun indicateur en attente.'
  
  return {
    subject: `GIRAS - Rappel : ${totalActions + effectiveTotalIndicateurs} élément(s) en attente`,
    htmlContent: getEmailWrapper('Rappel de vos activités en attente', content, true, 'Accéder à GIRAS'),
    textContent: `
GIRAS - Rappel de vos activités en attente

Bonjour ${user.prenoms},

Voici le récapitulatif de vos activités en attente sur GIRAS :

=== ACTIONS (${totalActions}) ===
${actionsText}

=== INDICATEURS (${effectiveTotalIndicateurs}) ===
${indicatorsText}

Veuillez vous connecter à GIRAS pour traiter ces éléments.

Lien d'accès : ${appUrl}/login

---
© ${currentYear} GIRAS. Tous droits réservés.
    `
  }
}


const escapeHtml = (value) => `${value ?? ''}`
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

// Alias pour la compatibilité
export const getWeeklyReminderEmailTemplate = getReminderEmailTemplate

// ============================================
// 8. EMAIL RÉCAP HEBDOMADAIRE (Performances du lundi)
// ============================================
function getPendingValidationInlineSection(digest) {
  if (!digest || ((digest?.actions?.total || 0) + (digest?.indicators?.total || 0) === 0)) return ''

  const renderActionRows = (rows) => {
    if (!rows?.length) return '<p style="margin:0;color:#6b7280;">Aucune action dans cette catégorie.</p>'
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:#eff6ff;"><th align="left" style="padding:8px;border:1px solid #dbeafe;">Projet</th><th align="left" style="padding:8px;border:1px solid #dbeafe;">Action</th><th align="left" style="padding:8px;border:1px solid #dbeafe;">Responsable</th><th align="left" style="padding:8px;border:1px solid #dbeafe;">Date réalisation</th><th align="center" style="padding:8px;border:1px solid #dbeafe;">Jours</th></tr></thead>
      <tbody>${rows.map((row) => `<tr><td style="padding:8px;border:1px solid #e5e7eb;">${row.code_groupe || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.libelle_action || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.responsable || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.date_realisation || '-'}</td><td align="center" style="padding:8px;border:1px solid #e5e7eb;">${row.ageDays ?? 0}</td></tr>`).join('')}</tbody>
    </table>`
  }

  const renderIndicatorRows = (rows) => {
    if (!rows?.length) return '<p style="margin:0;color:#6b7280;">Aucun indicateur dans cette catégorie.</p>'
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:#ecfdf5;"><th align="left" style="padding:8px;border:1px solid #d1fae5;">Groupe</th><th align="left" style="padding:8px;border:1px solid #d1fae5;">Indicateur</th><th align="left" style="padding:8px;border:1px solid #d1fae5;">Période</th><th align="left" style="padding:8px;border:1px solid #d1fae5;">Responsable</th><th align="left" style="padding:8px;border:1px solid #d1fae5;">Date saisie</th><th align="center" style="padding:8px;border:1px solid #d1fae5;">Jours</th></tr></thead>
      <tbody>${rows.map((row) => `<tr><td style="padding:8px;border:1px solid #e5e7eb;">${row.groupes || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.libelle_indicateur || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.periode || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.responsable || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.date_saisie || '-'}</td><td align="center" style="padding:8px;border:1px solid #e5e7eb;">${row.ageDays ?? 0}</td></tr>`).join('')}</tbody>
    </table>`
  }

  return `
    <h3 style="margin:24px 0 12px;color:#1f3b67;font-size:18px;">Suivi des validations et confirmations en attente</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:18px 0;">
      <tr>
        <td style="padding:18px;">
          <p style="margin:0 0 8px;"><strong>Actions en attente :</strong> ${digest?.actions?.total || 0}</p>
          <p style="margin:0 0 8px;"><strong>Actions en retard :</strong> ${digest?.actions?.late?.length || 0}</p>
          <p style="margin:0 0 8px;"><strong>Actions non en retard :</strong> ${digest?.actions?.onTime?.length || 0}</p>
          <p style="margin:0 0 8px;"><strong>Indicateurs en attente :</strong> ${digest?.indicators?.total || 0}</p>
          <p style="margin:0 0 8px;"><strong>Indicateurs en retard :</strong> ${digest?.indicators?.late?.length || 0}</p>
          <p style="margin:0;"><strong>Indicateurs non en retard :</strong> ${digest?.indicators?.onTime?.length || 0}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 12px;color:#374151;"><strong>Règles de retard appliquées :</strong> actions &gt; ${digest?.actionThresholdDays ?? 0} jour(s) depuis la date de réalisation ; indicateurs &gt; ${digest?.indicatorThresholdDays ?? 0} jour(s) depuis la date de saisie.</p>
    <h4 style="margin:20px 0 12px;color:#991b1b;font-size:16px;">Actions en attente en retard de confirmation</h4>
    ${renderActionRows(digest?.actions?.late || [])}
    <h4 style="margin:20px 0 12px;color:#1d4ed8;font-size:16px;">Actions en attente non en retard</h4>
    ${renderActionRows(digest?.actions?.onTime || [])}
    <h4 style="margin:20px 0 12px;color:#991b1b;font-size:16px;">Indicateurs en attente en retard de validation</h4>
    ${renderIndicatorRows(digest?.indicators?.late || [])}
    <h4 style="margin:20px 0 12px;color:#047857;font-size:16px;">Indicateurs en attente non en retard</h4>
    ${renderIndicatorRows(digest?.indicators?.onTime || [])}
  `
}

export function getWeeklyRecapEmailTemplate(user, report) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()

  const audienceType = report?.audienceType || 'personal'
  const formatPercent = (value) => (value === null || value === undefined || Number.isNaN(Number(value)) ? 'N/A' : `${Number(value).toFixed(1)}%`)
  const scoreColor = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '#6b7280'
    if (Number(value) >= 80) return '#16a34a'
    if (Number(value) >= 60) return '#2563eb'
    if (Number(value) >= 40) return '#d97706'
    return '#dc2626'
  }

  const statFrame = (stats, kind = 'action', labelSuffix = '') => {
    const txLabel = labelSuffix || 'Tx atteinte'
    return `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0;width:100%;margin:10px 0 14px;border:1px solid #d9e1ec;border-radius:14px;overflow:hidden;">
        <tr style="background:#f8fafc;">
          <td style="padding:10px 8px;text-align:center;border-right:1px solid #d9e1ec;"><div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Total</div><div style="font-size:16px;font-weight:700;color:#1e3a5f;">${stats?.total ?? 0}</div></td>
          <td style="padding:10px 8px;text-align:center;border-right:1px solid #d9e1ec;"><div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${kind === 'indicator' ? 'Renseignés' : 'Terminées'}</div><div style="font-size:16px;font-weight:700;color:#16a34a;">${kind === 'indicator' ? (stats?.renseignes ?? 0) : (stats?.terminees ?? 0)}</div></td>
          <td style="padding:10px 8px;text-align:center;border-right:1px solid #d9e1ec;"><div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${kind === 'indicator' ? 'Rens. dans le délai' : 'Terminé dans le délai'}</div><div style="font-size:16px;font-weight:700;color:#16a34a;">${kind === 'indicator' ? (stats?.renseignesDansDelai ?? 0) : (stats?.termineesDansDelai ?? 0)}</div></td>
          <td style="padding:10px 8px;text-align:center;border-right:1px solid #d9e1ec;"><div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${kind === 'indicator' ? 'En retard' : 'En cours'}</div><div style="font-size:16px;font-weight:700;color:${kind === 'indicator' ? '#dc2626' : '#2563eb'};">${kind === 'indicator' ? (stats?.enRetard ?? 0) : (stats?.enCours ?? 0)}</div></td>
          <td style="padding:10px 8px;text-align:center;"><div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${kind === 'indicator' ? txLabel : 'En retard'}</div><div style="font-size:16px;font-weight:700;color:${kind === 'indicator' ? '#304fc9' : '#dc2626'};">${kind === 'indicator' ? formatPercent(stats?.atteinteCible) : (stats?.enRetard ?? 0)}</div></td>
        </tr>
        <tr>
          <td colspan="5" style="padding:10px 8px;text-align:center;background:${kind === 'indicator' ? '#eef2ff' : '#f0fdf4'};border-top:1px solid #d9e1ec;color:${kind === 'indicator' ? '#304fc9' : '#166534'};font-size:13px;">
            <strong>${kind === 'indicator' ? 'Performance indicateurs' : 'Performance action'} :</strong> ${formatPercent(kind === 'indicator' ? stats?.performanceIndicateurs : stats?.performanceAction)}
          </td>
        </tr>
      </table>
    `
  }

  const scoreSummaryBlock = (value, label = 'Performance globale') => `
    <div style="margin:10px 0 16px;padding:20px 16px;border-radius:16px;background:linear-gradient(135deg,#f7f9fc 0%,#e8edf5 100%);text-align:center;">
      <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">${label}</div>
      <div style="font-size:48px;line-height:1;font-weight:800;color:${scoreColor(value)};">${formatPercent(value)}</div>
    </div>
  `

  const structureScoreTable = (rows, title = 'Performance par structure') => {
    if (!rows?.length) return '<p style="margin:0;color:#6b7280;">Aucune structure avec un score de performance exploitable.</p>'
    const sortedRows = [...rows].sort((a, b) => {
      const aVal = Number.isFinite(Number(a?.scorePerformance)) ? Number(a.scorePerformance) : -Infinity
      const bVal = Number.isFinite(Number(b?.scorePerformance)) ? Number(b.scorePerformance) : -Infinity
      return bVal - aVal
    })
    return `
      <h4 style="margin:0 0 10px;color:#1f3b67;font-size:16px;">${title}</h4>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0;width:100%;border:1px solid #d9e1ec;border-radius:14px;overflow:hidden;">
        <tr style="background:#eef3fb;">
          <th style="padding:10px 14px;text-align:left;color:#26408b;font-size:13px;border-bottom:1px solid #d9e1ec;">Structure</th>
          <th style="padding:10px 14px;text-align:center;color:#26408b;font-size:13px;border-bottom:1px solid #d9e1ec;">Performance</th>
        </tr>
        ${sortedRows.map((row) => `
          <tr>
            <td style="padding:9px 14px;font-size:13px;color:#334155;border-bottom:1px solid #eef2f7;">${escapeHtml(row.libelle_structure)}</td>
            <td style="padding:9px 14px;font-size:13px;text-align:center;font-weight:700;color:${scoreColor(row.scorePerformance)};border-bottom:1px solid #eef2f7;">${formatPercent(row.scorePerformance)}</td>
          </tr>
        `).join('')}
      </table>
    `
  }

  const teamScoresTable = (rows) => {
    if (!rows?.length) return ''
    return `
      <h4 style="margin:18px 0 12px;color:#1f3b67;font-size:16px;">Score de performance de vous-même et de vos collaborateurs directs</h4>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0;width:100%;border:1px solid #d9e1ec;border-radius:14px;overflow:hidden;">
        <tr style="background:#f8fafc;">
          <th style="padding:12px 14px;text-align:left;color:#475569;font-size:12px;border-bottom:1px solid #d9e1ec;">Utilisateur</th>
          <th style="padding:12px 14px;text-align:left;color:#475569;font-size:12px;border-bottom:1px solid #d9e1ec;">Email</th>
          <th style="padding:12px 14px;text-align:center;color:#475569;font-size:12px;border-bottom:1px solid #d9e1ec;">Score performance</th>
        </tr>
        ${rows.map((row) => `
          <tr>
            <td style="padding:12px 14px;font-size:12px;color:#334155;border-bottom:1px solid #eef2f7;">${escapeHtml(row.nomComplet || '-')}</td>
            <td style="padding:12px 14px;font-size:12px;color:#334155;border-bottom:1px solid #eef2f7;">${escapeHtml(row.email || '-')}</td>
            <td style="padding:12px 14px;font-size:12px;text-align:center;font-weight:700;color:${scoreColor(row.scorePerformance)};border-bottom:1px solid #eef2f7;">${formatPercent(row.scorePerformance)}</td>
          </tr>
        `).join('')}
      </table>
    `
  }

  const structureFrames = (rows, kind = 'action') => {
    if (!rows?.length) return ''
    return rows.map((row) => `
      <div style="margin:12px 0 16px;padding:14px;border:1px solid #d9e1ec;border-radius:16px;background:#ffffff;">
        <h4 style="margin:0 0 6px;color:#1f3b67;font-size:15px;">${escapeHtml(row.libelle_structure)}</h4>
        ${statFrame(row.stats, kind, `Tx atteinte - ${escapeHtml(row.code_structure)}`)}
      </div>
    `).join('')
  }

  const activeStartedActionsTables = (blocks, withHeading = true) => {
    if (!blocks?.length) return '<p style="margin:0;color:#6b7280;">Aucune action non échue déjà démarrée.</p>'
    return blocks.map((block) => `
      ${withHeading ? `<h4 style="margin:18px 0 10px;color:#1f3b67;font-size:16px;">${escapeHtml(block.libelle_structure)}</h4>` : ''}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0;width:100%;border:1px solid #cfe4cf;border-radius:14px;overflow:hidden;margin-bottom:18px;">
        <tr style="background:#f5fcf5;">
          <th style="padding:8px 10px;text-align:left;color:#166534;font-size:12px;border-bottom:1px solid #cfe4cf;">Projet</th>
          <th style="padding:8px 10px;text-align:left;color:#166534;font-size:12px;border-bottom:1px solid #cfe4cf;">Action</th>
          <th style="padding:8px 10px;text-align:center;color:#166534;font-size:12px;border-bottom:1px solid #cfe4cf;">Dates</th>
          <th style="padding:8px 10px;text-align:center;color:#166534;font-size:12px;border-bottom:1px solid #cfe4cf;">Avancement</th>
          <th style="padding:8px 10px;text-align:center;color:#166534;font-size:12px;border-bottom:1px solid #cfe4cf;">Jours restants</th>
          <th style="padding:8px 10px;text-align:left;color:#166534;font-size:12px;border-bottom:1px solid #cfe4cf;">Responsable</th>
        </tr>
        ${block.rows.map((row) => `
          <tr>
            <td style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e8f5e8;">${escapeHtml(row.projet)}</td>
            <td style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e8f5e8;">${escapeHtml(row.action)}</td>
            <td style="padding:8px 10px;font-size:12px;text-align:center;color:#334155;border-bottom:1px solid #e8f5e8;">${escapeHtml(row.dates)}</td>
            <td style="padding:8px 10px;font-size:12px;text-align:center;font-weight:700;color:#334155;border-bottom:1px solid #e8f5e8;">${escapeHtml(row.avancement)}</td>
            <td style="padding:8px 10px;font-size:12px;text-align:center;font-weight:700;color:#166534;border-bottom:1px solid #e8f5e8;">${row.joursRestants === null || row.joursRestants === undefined ? '-' : row.joursRestants}</td>
            <td style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e8f5e8;">${escapeHtml(row.responsable)}<br><span style="color:#2563eb;">${escapeHtml(row.email)}</span></td>
          </tr>
        `).join('')}
      </table>
    `).join('')
  }

  const lateActionsTables = (blocks, withHeading = true) => {
    if (!blocks?.length) return '<p style="margin:0;color:#6b7280;">Aucune action en retard.</p>'
    return blocks.map((block) => `
      ${withHeading ? `<h4 style="margin:18px 0 10px;color:#1f3b67;font-size:16px;">${escapeHtml(block.libelle_structure)}</h4>` : ''}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0;width:100%;border:1px solid #f1c9c9;border-radius:14px;overflow:hidden;margin-bottom:18px;">
        <tr style="background:#fff6f6;">
          <th style="padding:8px 10px;text-align:left;color:#8a2b2b;font-size:12px;border-bottom:1px solid #f1c9c9;">Projet</th>
          <th style="padding:8px 10px;text-align:left;color:#8a2b2b;font-size:12px;border-bottom:1px solid #f1c9c9;">Action</th>
          <th style="padding:8px 10px;text-align:center;color:#8a2b2b;font-size:12px;border-bottom:1px solid #f1c9c9;">Dates</th>
          <th style="padding:8px 10px;text-align:center;color:#8a2b2b;font-size:12px;border-bottom:1px solid #f1c9c9;">Avancement</th>
          <th style="padding:8px 10px;text-align:center;color:#8a2b2b;font-size:12px;border-bottom:1px solid #f1c9c9;">Jours retard</th>
          <th style="padding:8px 10px;text-align:left;color:#8a2b2b;font-size:12px;border-bottom:1px solid #f1c9c9;">Responsable</th>
        </tr>
        ${block.rows.map((row) => `
          <tr>
            <td style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #fde8e8;">${escapeHtml(row.projet)}</td>
            <td style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #fde8e8;">${escapeHtml(row.action)}</td>
            <td style="padding:8px 10px;font-size:12px;text-align:center;color:#334155;border-bottom:1px solid #fde8e8;">${escapeHtml(row.dates)}</td>
            <td style="padding:8px 10px;font-size:12px;text-align:center;font-weight:700;color:#334155;border-bottom:1px solid #fde8e8;">${escapeHtml(row.avancement)}</td>
            <td style="padding:8px 10px;font-size:12px;text-align:center;font-weight:700;color:#dc2626;border-bottom:1px solid #fde8e8;">${row.joursRetard}</td>
            <td style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #fde8e8;">${escapeHtml(row.responsable)}<br><span style="color:#2563eb;">${escapeHtml(row.email)}</span></td>
          </tr>
        `).join('')}
      </table>
    `).join('')
  }

  const lateIndicatorsTables = (blocks, withHeading = true) => {
    if (!blocks?.length) return '<p style="margin:0;color:#6b7280;">Aucun indicateur en retard.</p>'
    return blocks.map((block) => `
      ${withHeading ? `<h4 style="margin:18px 0 10px;color:#1f3b67;font-size:16px;">${escapeHtml(block.libelle_structure)}</h4>` : ''}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0;width:100%;border:1px solid #f0d9bc;border-radius:14px;overflow:hidden;margin-bottom:18px;">
        <tr style="background:#fffaf3;">
          <th style="padding:8px 10px;text-align:left;color:#9a4b1d;font-size:12px;border-bottom:1px solid #f0d9bc;">Groupe</th>
          <th style="padding:8px 10px;text-align:left;color:#9a4b1d;font-size:12px;border-bottom:1px solid #f0d9bc;">Indicateur</th>
          <th style="padding:8px 10px;text-align:center;color:#9a4b1d;font-size:12px;border-bottom:1px solid #f0d9bc;">Période</th>
          <th style="padding:8px 10px;text-align:center;color:#9a4b1d;font-size:12px;border-bottom:1px solid #f0d9bc;">Date limite</th>
          <th style="padding:8px 10px;text-align:center;color:#9a4b1d;font-size:12px;border-bottom:1px solid #f0d9bc;">Jours retard</th>
          <th style="padding:8px 10px;text-align:left;color:#9a4b1d;font-size:12px;border-bottom:1px solid #f0d9bc;">Responsable</th>
        </tr>
        ${block.rows.map((row) => `
          <tr>
            <td style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #fff0dd;">${escapeHtml(row.groupe)}</td>
            <td style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #fff0dd;">${escapeHtml(row.indicateur)}</td>
            <td style="padding:8px 10px;font-size:12px;text-align:center;color:#334155;border-bottom:1px solid #fff0dd;">${escapeHtml(row.periode)}</td>
            <td style="padding:8px 10px;font-size:12px;text-align:center;color:#334155;border-bottom:1px solid #fff0dd;">${escapeHtml(row.dateLimite)}</td>
            <td style="padding:8px 10px;font-size:12px;text-align:center;font-weight:700;color:#dc2626;border-bottom:1px solid #fff0dd;">${row.joursRetard}</td>
            <td style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #fff0dd;">${escapeHtml(row.responsable)}<br><span style="color:#2563eb;">${escapeHtml(row.email)}</span></td>
          </tr>
        `).join('')}
      </table>
    `).join('')
  }

  if (['super_manager', 'structure_responsible', 'direct_manager'].includes(audienceType)) {
    const isSuperManager = audienceType === 'super_manager'
    const isStructureResponsible = audienceType === 'structure_responsible'
    const isDirectManager = audienceType === 'direct_manager'
    const title = isSuperManager
      ? 'Récap hebdomadaire consolidé'
      : isStructureResponsible
        ? 'Récap hebdomadaire de votre structure'
        : 'Récap hebdomadaire de votre équipe'
    const intro = isSuperManager
      ? 'Voici le récapitulatif hebdomadaire global.'
      : isStructureResponsible
        ? 'Voici le récapitulatif hebdomadaire limité exclusivement à votre structure.'
        : 'Voici le récapitulatif hebdomadaire limité à vous-même et à vos collaborateurs directs.'
    const performanceTitle = isSuperManager
      ? '1. Niveau de performance'
      : isStructureResponsible
        ? '1. Performance globale de votre structure'
        : '1. Performance globale de votre équipe'

    const content = `
      <h2 style="margin:0 0 16px;color:#1f3b67;font-size:20px;">Bonjour ${escapeHtml(user.prenoms)},</h2>
      <p style="margin:0 0 18px;color:#374151;">${intro}</p>

      <h3 style="margin:22px 0 12px;color:#1f3b67;font-size:18px;">${performanceTitle}</h3>
      ${scoreSummaryBlock(report?.globalScore, 'Performance globale')}
      ${isSuperManager ? structureScoreTable(report?.structureScores, 'Performance par structure') : ''}
      ${isDirectManager ? teamScoresTable(report?.teamScores) : ''}

      <h3 style="margin:24px 0 12px;color:#1f3b67;font-size:18px;">2. Performance au niveau de la réalisation des actions</h3>
      ${statFrame(report?.actionGlobal, 'action')}
      ${isSuperManager ? structureFrames(report?.actionByStructure, 'action') : ''}

      <h3 style="margin:24px 0 12px;color:#1f3b67;font-size:18px;">3. Performance au niveau de la production des indicateurs stratégiques</h3>
      ${statFrame(report?.indicatorGlobal, 'indicator', 'Tx atteinte')}
      ${isSuperManager ? structureFrames(report?.indicatorByStructure, 'indicator') : ''}

      <h3 style="margin:24px 0 12px;color:#1f3b67;font-size:18px;">4. Liste des actions en retard</h3>
      ${lateActionsTables(report?.lateActionsByStructure, isSuperManager)}

      <h3 style="margin:24px 0 12px;color:#1f3b67;font-size:18px;">5. Liste des indicateurs dont la production est en retard</h3>
      ${lateIndicatorsTables(report?.lateIndicatorsByStructure, isSuperManager)}

      ${report?.pendingValidationDigest ? getPendingValidationInlineSection(report.pendingValidationDigest) : ''}

      <p style="margin:20px 0 0;color:#374151;">Connectez-vous à GIRAS pour suivre le détail des actions, indicateurs et performances.</p>
    `

    return {
      subject: `GIRAS - ${title}`,
      htmlContent: getEmailWrapper(title, content, true, 'Accéder à GIRAS'),
      textContent: `GIRAS - ${title}

Bonjour ${user.prenoms},

${intro}

Performance globale : ${formatPercent(report?.globalScore)}
Actions - Total ${report?.actionGlobal?.total || 0}, Terminées ${report?.actionGlobal?.terminees || 0}, Terminé dans le délai ${report?.actionGlobal?.termineesDansDelai || 0}, En cours ${report?.actionGlobal?.enCours || 0}, En retard ${report?.actionGlobal?.enRetard || 0}, Performance action ${formatPercent(report?.actionGlobal?.performanceAction)}
Indicateurs - Total ${report?.indicatorGlobal?.total || 0}, Renseignés ${report?.indicatorGlobal?.renseignes || 0}, Rens. dans le délai ${report?.indicatorGlobal?.renseignesDansDelai || 0}, En retard ${report?.indicatorGlobal?.enRetard || 0}, Tx atteinte ${formatPercent(report?.indicatorGlobal?.atteinteCible)}, Performance indicateurs ${formatPercent(report?.indicatorGlobal?.performanceIndicateurs)}

Lien d'accès : ${appUrl}/login

---
© ${currentYear} GIRAS. Tous droits réservés.`
    }
  }

  const personal = report?.personalPerformance || {}
  const content = `
    <h2 style="margin:0 0 18px;color:#1f3b67;font-size:20px;">Bonjour ${escapeHtml(user.prenoms)},</h2>
    <p style="margin:0 0 22px;color:#374151;">Voici votre récapitulatif hebdomadaire personnel.</p>

    <h3 style="margin:26px 0 14px;color:#1f3b67;font-size:18px;">Performance globale</h3>
    ${scoreSummaryBlock(personal?.scorePerformance, 'Votre score de performance')}

    <h3 style="margin:28px 0 14px;color:#1f3b67;font-size:18px;">1. Performance au niveau de la réalisation des actions</h3>
    ${statFrame(personal?.actions, 'action')}

    <h3 style="margin:28px 0 14px;color:#1f3b67;font-size:18px;">2. Performance au niveau de la production des indicateurs stratégiques</h3>
    ${statFrame(personal?.indicateurs, 'indicator', 'Tx atteinte')}

    <h3 style="margin:28px 0 14px;color:#1f3b67;font-size:18px;">3. Liste des actions en retard</h3>
    ${lateActionsTables(report?.lateActionsByStructure, false)}

    <h3 style="margin:28px 0 14px;color:#1f3b67;font-size:18px;">4. Liste des indicateurs dont la production est en retard</h3>
    ${lateIndicatorsTables(report?.lateIndicatorsByStructure, false)}

    ${report?.pendingValidationDigest ? getPendingValidationInlineSection(report.pendingValidationDigest) : ''}

    <p style="margin:24px 0 0;color:#374151;">Connectez-vous à GIRAS pour suivre le détail de vos actions, indicateurs et performances.</p>
  `

  return {
    subject: 'GIRAS - Récap hebdomadaire personnel',
    htmlContent: getEmailWrapper('Récap hebdomadaire de vos performances', content, true, 'Accéder à GIRAS'),
    textContent: `GIRAS - Récap hebdomadaire personnel

Bonjour ${user.prenoms},

Score de performance : ${formatPercent(personal?.scorePerformance)}
Actions - Total ${personal?.actions?.total || 0}, Terminées ${personal?.actions?.terminees || 0}, Terminé dans le délai ${personal?.actions?.termineesDansDelai || 0}, En cours ${personal?.actions?.enCours || 0}, En retard ${personal?.actions?.enRetard || 0}, Performance action ${formatPercent(personal?.actions?.performanceAction)}
Indicateurs - Total ${personal?.indicateurs?.total || 0}, Renseignés ${personal?.indicateurs?.renseignes || 0}, Rens. dans le délai ${personal?.indicateurs?.renseignesDansDelai || 0}, En retard ${personal?.indicateurs?.enRetard || 0}, Tx atteinte ${formatPercent(personal?.indicateurs?.atteinteCible)}, Performance indicateurs ${formatPercent(personal?.indicateurs?.performanceIndicateurs)}

Lien d'accès : ${appUrl}/login

---
© ${currentYear} GIRAS. Tous droits réservés.`
  }
}



export function getActionRejectionEmailTemplate(user, payload = {}) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  const rejector = escapeHtml(payload.rejectorName || payload.rejector || '-')
  const actionLabel = escapeHtml(payload.libelle_action || '-')
  const comment = escapeHtml(payload.commentaire || '-')
  const projectLabel = escapeHtml(payload.code_groupe || payload.projet || '-')
  const structureLabel = escapeHtml(payload.code_structure || payload.structure || '-')
  const responseUrl = `${appUrl}/dashboard/activites`
  const subject = `GIRAS - Action rejetée : ${payload.libelle_action || 'Action'}`

  const content = `
    <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 20px;">Bonjour ${escapeHtml(user?.prenoms || user?.nom || '')},</h2>
    <p style="margin: 0 0 20px; color: #333333;">Votre action renseignée à <strong>100%</strong> a été rejetée par un gestionnaire dans GIRAS.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fff7ed; border-left: 4px solid #f7941d; border-radius: 4px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="margin: 0 0 15px; color: #1a365d; font-size: 16px;">${actionLabel}</h3>
          <p style="margin: 0 0 8px;"><strong style="color: #9a3412;">Projet :</strong> ${projectLabel}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #9a3412;">Structure :</strong> ${structureLabel}</p>
          <p style="margin: 0 0 8px;"><strong style="color: #9a3412;">Gestionnaire :</strong> ${rejector}</p>
          <p style="margin: 0;"><strong style="color: #9a3412;">Statut :</strong> Action rejetée - retour au responsable</p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; margin: 20px 0;">
      <tr>
        <td style="padding: 18px;">
          <p style="margin: 0 0 10px;"><strong style="color: #991b1b;">Commentaire du gestionnaire :</strong></p>
          <div style="color: #333333; white-space: pre-wrap;">${comment}</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; margin: 20px 0;">
      <tr>
        <td style="padding: 15px;">
          <p style="margin: 0; color: #92400e; font-size: 13px;"><strong>Action requise :</strong> Le taux d'avancement a été réinitialisé à 0%. Merci de fournir l'ensemble des livrables nécessaires à la validation de l'action et ressaisissez les 100% en répondant au commentaire du gestionnaire.</p>
        </td>
      </tr>
    </table>

    <p style="margin: 0; color: #333333;">Lien d'accès : <a href="${responseUrl}" style="color: #1a365d;">${responseUrl}</a></p>
  `

  const htmlContent = getEmailWrapper('Action rejetée', content, true, 'Accéder à GIRAS', responseUrl)
  const textContent = `GIRAS - Action rejetée

Bonjour ${user?.prenoms || user?.nom || ''},

Votre action "${payload.libelle_action || '-'}" renseignée à 100% a été rejetée par ${payload.rejectorName || payload.rejector || '-'}.

Projet : ${payload.code_groupe || payload.projet || '-'}
Structure : ${payload.code_structure || payload.structure || '-'}

Commentaire du gestionnaire :
${payload.commentaire || '-'}

Le taux d'avancement a été réinitialisé à 0%. Merci de fournir l'ensemble des livrables nécessaires à la validation de l'action et ressaisissez les 100% en répondant au commentaire du gestionnaire.

Lien d'accès : ${responseUrl}

---
© ${currentYear} GIRAS. Tous droits réservés.`
  return { subject, htmlContent, textContent }
}

export function getIndicatorRejectionEmailTemplate(user, payload = {}) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  const rejector = escapeHtml(payload.rejectorName || payload.rejector || '-')
  const indicatorLabel = escapeHtml(payload.libelle_indicateur || '-')
  const comment = escapeHtml(payload.commentaire || '-')
  const rejectedValue = escapeHtml(payload.valeur_rejetee == null ? '-' : String(payload.valeur_rejetee))
  const structure = escapeHtml(payload.structure || '-')
  const periode = escapeHtml(payload.periode || '-')
  const greetingName = escapeHtml(user?.prenoms || user?.nom || '')
  const content = `
    <h2 style="margin:0 0 20px;color:#1a365d;font-size:20px;">Bonjour ${greetingName},</h2>
    <p style="margin:0 0 20px;color:#333333;">La valeur renseignée pour l'indicateur ci-dessous a été rejetée par un gestionnaire.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fff7ed;border-left:4px solid #dc2626;border-radius:4px;margin:20px 0;">
      <tr>
        <td style="padding:20px;">
          <h3 style="margin:0 0 15px;color:#1a365d;font-size:16px;">${indicatorLabel}</h3>
          <p style="margin:0 0 8px;"><strong style="color:#9a3412;">Structure :</strong> ${structure}</p>
          <p style="margin:0 0 8px;"><strong style="color:#9a3412;">Période :</strong> ${periode}</p>
          <p style="margin:0 0 8px;"><strong style="color:#9a3412;">Gestionnaire :</strong> ${rejector}</p>
          <p style="margin:0 0 8px;"><strong style="color:#9a3412;">Valeur rejetée :</strong> ${rejectedValue}</p>
          <p style="margin:16px 0 8px;"><strong style="color:#9a3412;">Commentaire du gestionnaire :</strong></p>
          <div style="background:#ffffff;border:1px solid #fed7aa;padding:12px;border-radius:8px;white-space:pre-wrap;color:#374151;">${comment}</div>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0;color:#333333;">La valeur de l'occurrence a été vidée automatiquement. Merci de ressaisir une valeur et de répondre obligatoirement au commentaire du gestionnaire avant une nouvelle soumission.</p>
  `
  return {
    subject: `GIRAS - Valeur d'indicateur rejetée : ${payload.libelle_indicateur || 'Indicateur'}`,
    htmlContent: getEmailWrapper("Valeur d'indicateur rejetée", content, true, 'Accéder à GIRAS'),
    textContent: `
GIRAS - Valeur d'indicateur rejetée

Bonjour ${user?.prenoms || user?.nom || ''},

La valeur renseignée pour l'indicateur "${payload.libelle_indicateur || '-'}" a été rejetée par ${payload.rejectorName || payload.rejector || '-'}.
Structure : ${payload.structure || '-'}
Période : ${payload.periode || '-'}
Valeur rejetée : ${payload.valeur_rejetee == null ? '-' : payload.valeur_rejetee}

Commentaire du gestionnaire :
${payload.commentaire || '-'}

La valeur de l'occurrence a été vidée automatiquement. Merci de ressaisir une valeur et de répondre obligatoirement au commentaire du gestionnaire.

Lien d'accès : ${appUrl}/login

---
© ${currentYear} GIRAS. Tous droits réservés.
    `
  }
}


export function getPendingValidationDigestEmailTemplate({ user, digest, mode = 'manual' }) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  const isWeekly = mode === 'weekly'
  const title = isWeekly
    ? 'Récap hebdomadaire des validations et confirmations en attente'
    : 'Récapitulatif des validations et confirmations en attente'

  const renderActionRows = (rows) => {
    if (!rows?.length) return '<p style="margin:0;color:#6b7280;">Aucune action dans cette catégorie.</p>'
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:#eff6ff;"><th align="left" style="padding:8px;border:1px solid #dbeafe;">Projet</th><th align="left" style="padding:8px;border:1px solid #dbeafe;">Action</th><th align="left" style="padding:8px;border:1px solid #dbeafe;">Responsable</th><th align="left" style="padding:8px;border:1px solid #dbeafe;">Date réalisation</th><th align="center" style="padding:8px;border:1px solid #dbeafe;">Jours</th></tr></thead>
      <tbody>${rows.map((row) => `<tr><td style="padding:8px;border:1px solid #e5e7eb;">${row.code_groupe || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.libelle_action || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.responsable || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.date_realisation || '-'}</td><td align="center" style="padding:8px;border:1px solid #e5e7eb;">${row.ageDays ?? 0}</td></tr>`).join('')}</tbody>
    </table>`
  }

  const renderIndicatorRows = (rows) => {
    if (!rows?.length) return '<p style="margin:0;color:#6b7280;">Aucun indicateur dans cette catégorie.</p>'
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:#ecfdf5;"><th align="left" style="padding:8px;border:1px solid #d1fae5;">Groupe</th><th align="left" style="padding:8px;border:1px solid #d1fae5;">Indicateur</th><th align="left" style="padding:8px;border:1px solid #d1fae5;">Période</th><th align="left" style="padding:8px;border:1px solid #d1fae5;">Responsable</th><th align="left" style="padding:8px;border:1px solid #d1fae5;">Date saisie</th><th align="center" style="padding:8px;border:1px solid #d1fae5;">Jours</th></tr></thead>
      <tbody>${rows.map((row) => `<tr><td style="padding:8px;border:1px solid #e5e7eb;">${row.groupes || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.libelle_indicateur || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.periode || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.responsable || '-'}</td><td style="padding:8px;border:1px solid #e5e7eb;">${row.date_saisie || '-'}</td><td align="center" style="padding:8px;border:1px solid #e5e7eb;">${row.ageDays ?? 0}</td></tr>`).join('')}</tbody>
    </table>`
  }

  const content = `
    <h2 style="margin:0 0 18px;color:#1a365d;font-size:20px;">Bonjour ${user?.prenoms || user?.nom || ''},</h2>
    <p style="margin:0 0 18px;color:#333333;">Ce message présente les actions et indicateurs de votre périmètre qui sont en attente de confirmation ou de validation.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border:1px solid #d9e1ec;border-radius:12px;margin:20px 0;border-collapse:separate;overflow:hidden;">
      <tr>
        <td style="padding:0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
            <thead>
              <tr style="background:#eaf1fb;">
                <th align="left" style="padding:12px 14px;border-bottom:1px solid #d9e1ec;color:#1f3b67;font-size:13px;">Périmètre</th>
                <th align="center" style="padding:12px 14px;border-bottom:1px solid #d9e1ec;color:#1f3b67;font-size:13px;">En attente</th>
                <th align="center" style="padding:12px 14px;border-bottom:1px solid #d9e1ec;color:#1f3b67;font-size:13px;">En retard</th>
                <th align="center" style="padding:12px 14px;border-bottom:1px solid #d9e1ec;color:#1f3b67;font-size:13px;">Non en retard</th>
                <th align="center" style="padding:12px 14px;border-bottom:1px solid #d9e1ec;color:#1f3b67;font-size:13px;">Seuil</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background:#ffffff;">
                <td style="padding:14px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:700;">Actions</td>
                <td align="center" style="padding:14px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:700;">${digest?.actions?.total || 0}</td>
                <td align="center" style="padding:14px;border-bottom:1px solid #e5e7eb;color:#b91c1c;font-weight:700;">${digest?.actions?.late?.length || 0}</td>
                <td align="center" style="padding:14px;border-bottom:1px solid #e5e7eb;color:#1d4ed8;font-weight:700;">${digest?.actions?.onTime?.length || 0}</td>
                <td align="center" style="padding:14px;border-bottom:1px solid #e5e7eb;color:#475569;">${digest?.actionThresholdDays ?? 0} jour(s)</td>
              </tr>
              <tr style="background:#fcfdfd;">
                <td style="padding:14px;color:#111827;font-weight:700;">Indicateurs</td>
                <td align="center" style="padding:14px;color:#111827;font-weight:700;">${digest?.indicators?.total || 0}</td>
                <td align="center" style="padding:14px;color:#b91c1c;font-weight:700;">${digest?.indicators?.late?.length || 0}</td>
                <td align="center" style="padding:14px;color:#047857;font-weight:700;">${digest?.indicators?.onTime?.length || 0}</td>
                <td align="center" style="padding:14px;color:#475569;">${digest?.indicatorThresholdDays ?? 0} jour(s)</td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 12px;color:#374151;"><strong>Règles de retard appliquées :</strong> actions &gt; ${digest?.actionThresholdDays ?? 0} jour(s) depuis la date de réalisation ; indicateurs &gt; ${digest?.indicatorThresholdDays ?? 0} jour(s) depuis la date de saisie.</p>

    <h3 style="margin:24px 0 12px;color:#991b1b;font-size:17px;">1. Actions en attente en retard de confirmation</h3>
    ${renderActionRows(digest?.actions?.late || [])}

    <h3 style="margin:24px 0 12px;color:#1d4ed8;font-size:17px;">2. Actions en attente non en retard</h3>
    ${renderActionRows(digest?.actions?.onTime || [])}

    <h3 style="margin:24px 0 12px;color:#991b1b;font-size:17px;">3. Indicateurs en attente en retard de validation</h3>
    ${renderIndicatorRows(digest?.indicators?.late || [])}

    <h3 style="margin:24px 0 12px;color:#047857;font-size:17px;">4. Indicateurs en attente non en retard</h3>
    ${renderIndicatorRows(digest?.indicators?.onTime || [])}

    <p style="margin:22px 0 0;color:#333333;">Merci de vous connecter à GIRAS afin de traiter les validations et confirmations en attente de votre périmètre.</p>
  `

  return {
    subject: isWeekly
      ? 'GIRAS - Récap hebdomadaire des validations et confirmations en attente'
      : 'GIRAS - Validations et confirmations en attente',
    htmlContent: getEmailWrapper(title, content, true, 'Accéder à GIRAS', `${appUrl}/dashboard`),
    textContent: `GIRAS - ${title}

Bonjour ${user?.prenoms || user?.nom || ''},

Actions en attente: ${digest?.actions?.total || 0}
- En retard: ${digest?.actions?.late?.length || 0}
- Non en retard: ${digest?.actions?.onTime?.length || 0}

Indicateurs en attente: ${digest?.indicators?.total || 0}
- En retard: ${digest?.indicators?.late?.length || 0}
- Non en retard: ${digest?.indicators?.onTime?.length || 0}

Seuil actions: ${digest?.actionThresholdDays ?? 0} jour(s)
Seuil indicateurs: ${digest?.indicatorThresholdDays ?? 0} jour(s)

Lien d'accès : ${appUrl}/login

---
© ${currentYear} GIRAS. Tous droits réservés.`
  }
}
