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
                  <p style="margin: 0 0 10px; color: #666666; font-size: 12px;">CNAM - Caisse Nationale d'Assurance Maladie de Côte d'Ivoire</p>
                  <p style="margin: 0 0 10px; color: #666666; font-size: 12px;">Plateau, Abidjan - Côte d'Ivoire</p>
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
CNAM - Caisse Nationale d'Assurance Maladie de Côte d'Ivoire
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
CNAM - Caisse Nationale d'Assurance Maladie de Côte d'Ivoire
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
CNAM - Caisse Nationale d'Assurance Maladie de Côte d'Ivoire
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
CNAM - Caisse Nationale d'Assurance Maladie de Côte d'Ivoire
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
CNAM - Caisse Nationale d'Assurance Maladie de Côte d'Ivoire
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
CNAM - Caisse Nationale d'Assurance Maladie de Côte d'Ivoire
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
CNAM - Caisse Nationale d'Assurance Maladie de Côte d'Ivoire
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
      ${generateActionsTable(pendingActions.aDebuter, 'Actions à débuter dans les 30 prochains jours', '🟢', '#f0fdf4', '#16a34a', false)}
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
    ...(pendingActions?.aDebuter || []).map(a => `[À DÉBUTER] ${a.libelle_action} (${a.code_groupe || '-'}) | ${a.date_debut} → ${a.date_fin} | ${a.tx_avancement}%`)
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
CNAM - Caisse Nationale d'Assurance Maladie de Côte d'Ivoire
© ${currentYear} GIRAS. Tous droits réservés.
    `
  }
}

// Alias pour la compatibilité
export const getWeeklyReminderEmailTemplate = getReminderEmailTemplate

// ============================================
// 8. EMAIL RÉCAP HEBDOMADAIRE (Performances du lundi)
// ============================================
export function getWeeklyRecapEmailTemplate(user, performance) {
  const appUrl = getAppUrl()
  const currentYear = getCurrentYear()
  
  const getScoreColor = (score) => {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#3b82f6'
    if (score >= 40) return '#f59e0b'
    return '#ef4444'
  }
  
  const getScoreAppreciation = (score) => {
    if (score >= 90) return 'Excellent ! 🌟'
    if (score >= 80) return 'Très bien ! 👏'
    if (score >= 60) return 'Bien, continuez ainsi ! 💪'
    if (score >= 40) return 'Des efforts sont nécessaires 📈'
    return 'Attention, performance à améliorer ⚠️'
  }
  
  const scoreColor = getScoreColor(performance.scoreGlobal)
  const scoreAppreciation = getScoreAppreciation(performance.scoreGlobal)
  
  const content = `
    <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 20px;">Bonjour ${user.prenoms},</h2>
    <p style="margin: 0 0 20px; color: #333333;">Voici le récapitulatif de vos performances sur GIRAS :</p>
    
    <div style="text-align: center; margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px;">
      <p style="margin: 0 0 10px; color: #666; font-size: 14px;">Score global de performance</p>
      <div style="font-size: 56px; font-weight: bold; color: ${scoreColor}; line-height: 1.2;">${performance.scoreGlobal}%</div>
      <p style="margin: 10px 0 0; font-size: 16px; color: #374151;">${scoreAppreciation}</p>
    </div>
    
    <h3 style="margin: 25px 0 15px; color: #1a365d; font-size: 16px;">📋 Vos Actions</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <tr style="background-color: #f8fafc;">
        <td style="padding: 15px; text-align: center; border-right: 1px solid #e2e8f0; width: 25%;">
          <p style="margin: 0 0 5px; color: #666; font-size: 11px;">Total</p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: #1a365d;">${performance.actions.total}</p>
        </td>
        <td style="padding: 15px; text-align: center; border-right: 1px solid #e2e8f0; width: 25%;">
          <p style="margin: 0 0 5px; color: #666; font-size: 11px;">Terminées</p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: #22c55e;">${performance.actions.terminees}</p>
        </td>
        <td style="padding: 15px; text-align: center; border-right: 1px solid #e2e8f0; width: 25%;">
          <p style="margin: 0 0 5px; color: #666; font-size: 11px;">En cours</p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: #3b82f6;">${performance.actions.enCours}</p>
        </td>
        <td style="padding: 15px; text-align: center; width: 25%;">
          <p style="margin: 0 0 5px; color: #666; font-size: 11px;">En retard</p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: #ef4444;">${performance.actions.enRetard}</p>
        </td>
      </tr>
      <tr>
        <td colspan="4" style="padding: 10px; background-color: #f0fdf4; border-top: 1px solid #e2e8f0; text-align: center;">
          <span style="color: #166534; font-size: 13px;"><strong>Taux de réalisation :</strong> ${performance.actions.tauxRealisation}%</span>
        </td>
      </tr>
    </table>
    
    <h3 style="margin: 25px 0 15px; color: #1a365d; font-size: 16px;">📊 Vos Indicateurs</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <tr style="background-color: #f8fafc;">
        <td style="padding: 15px; text-align: center; border-right: 1px solid #e2e8f0; width: 25%;">
          <p style="margin: 0 0 5px; color: #666; font-size: 11px;">Total</p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: #1a365d;">${performance.indicateurs.total}</p>
        </td>
        <td style="padding: 15px; text-align: center; border-right: 1px solid #e2e8f0; width: 25%;">
          <p style="margin: 0 0 5px; color: #666; font-size: 11px;">Renseignés</p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: #22c55e;">${performance.indicateurs.renseignes}</p>
        </td>
        <td style="padding: 15px; text-align: center; border-right: 1px solid #e2e8f0; width: 25%;">
          <p style="margin: 0 0 5px; color: #666; font-size: 11px;">À jour</p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: #3b82f6;">${performance.indicateurs.aJour}</p>
        </td>
        <td style="padding: 15px; text-align: center; width: 25%;">
          <p style="margin: 0 0 5px; color: #666; font-size: 11px;">En retard</p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: #ef4444;">${performance.indicateurs.enRetard}</p>
        </td>
      </tr>
      <tr>
        <td colspan="4" style="padding: 10px; background-color: #eff6ff; border-top: 1px solid #e2e8f0; text-align: center;">
          <span style="color: #1e40af; font-size: 13px;"><strong>Taux de renseignement :</strong> ${performance.indicateurs.tauxRenseignement}%</span>
        </td>
      </tr>
    </table>
    
    <p style="margin: 30px 0 0; color: #333333;">Connectez-vous à GIRAS pour améliorer vos performances et suivre vos activités.</p>
  `
  
  return {
    subject: `GIRAS - Récap hebdomadaire : Score ${performance.scoreGlobal}%`,
    htmlContent: getEmailWrapper('Récap hebdomadaire de vos performances', content, true, 'Accéder à GIRAS'),
    textContent: `
GIRAS - Récap hebdomadaire de vos performances

Bonjour ${user.prenoms},

Voici le récapitulatif de vos performances sur GIRAS :

=== SCORE GLOBAL : ${performance.scoreGlobal}% ===
${scoreAppreciation}

=== ACTIONS ===
- Total : ${performance.actions.total}
- Terminées : ${performance.actions.terminees}
- En cours : ${performance.actions.enCours}
- En retard : ${performance.actions.enRetard}
- Taux de réalisation : ${performance.actions.tauxRealisation}%

=== INDICATEURS ===
- Total : ${performance.indicateurs.total}
- Renseignés : ${performance.indicateurs.renseignes}
- À jour : ${performance.indicateurs.aJour}
- En retard : ${performance.indicateurs.enRetard}
- Taux de renseignement : ${performance.indicateurs.tauxRenseignement}%

Connectez-vous à GIRAS pour améliorer vos performances.

Lien d'accès : ${appUrl}/login

---
CNAM - Caisse Nationale d'Assurance Maladie de Côte d'Ivoire
© ${currentYear} GIRAS. Tous droits réservés.
    `
  }
}
