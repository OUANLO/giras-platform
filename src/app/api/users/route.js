import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { hashPassword, generatePassword } from '@/lib/utils'
import { sendEmail, getWelcomeEmailTemplate } from '@/lib/email'

// GET - Récupérer tous les utilisateurs
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const structure = searchParams.get('structure')
    const type = searchParams.get('type')
    const statut = searchParams.get('statut')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('users')
      .select('id, username, nom, prenoms, structure, poste, type_utilisateur, statut, acces_risque, acces_activite, acces_indicateur, acces_tb, acces_perform, acces_admin, date_creation')
      .order('nom', { ascending: true })

    if (structure) query = query.eq('structure', structure)
    if (type) query = query.eq('type_utilisateur', type)
    if (statut) query = query.eq('statut', statut)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ users: data })
  } catch (error) {
    console.error('Erreur GET users:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Créer un nouvel utilisateur
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    // Validation
    if (!body.username || !body.nom || !body.prenoms || !body.structure) {
      return NextResponse.json(
        { error: 'Email, nom, prénoms et structure requis' },
        { status: 400 }
      )
    }

    // Valider format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.username)) {
      return NextResponse.json(
        { error: 'Format email invalide' },
        { status: 400 }
      )
    }

    // Générer mot de passe si non fourni
    const plainPassword = body.password || generatePassword()
    const hashedPassword = await hashPassword(plainPassword)

    // Forcer acces_admin à Non pour Manager et User
    let accesAdmin = body.acces_admin || 'Non'
    if (body.type_utilisateur === 'Manager' || body.type_utilisateur === 'User') {
      accesAdmin = 'Non'
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        username: body.username.toLowerCase(),
        password: hashedPassword,
        nom: body.nom.toUpperCase(),
        prenoms: body.prenoms,
        structure: body.structure,
        superieur_existe: body.superieur_existe || 'Non',
        superieur: body.superieur,
        poste: body.poste,
        acces_risque: body.acces_risque || 'Non',
        acces_activite: body.acces_activite || 'Non',
        acces_indicateur: body.acces_indicateur || 'Non',
        acces_tb: body.acces_tb || 'Non',
        acces_perform: body.acces_perform || 'Non',
        acces_admin: accesAdmin,
        type_utilisateur: body.type_utilisateur || 'User',
        statut: body.statut || 'Actif',
        createur: body.createur
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Cet email existe déjà' },
          { status: 400 }
        )
      }
      throw error
    }

    // Envoyer email de bienvenue
    const emailTemplate = getWelcomeEmailTemplate({
      ...data,
      password: plainPassword // Mot de passe en clair pour l'email
    })
    
    const emailResult = await sendEmail({
      to: data.username,
      subject: emailTemplate.subject,
      htmlContent: emailTemplate.htmlContent,
      textContent: emailTemplate.textContent
    })

    // Archiver l'email dans email_logs
    await supabase.from('email_logs').insert({
      destinataire: data.username,
      destinataire_nom: `${data.prenoms} ${data.nom}`,
      sujet: emailTemplate.subject,
      type_email: 'creation_compte',
      statut: emailResult.success ? 'envoyé' : 'échec',
      message_id: emailResult.messageId || null,
      erreur: emailResult.success ? null : emailResult.error,
      source: 'automatique',
      createur: body.createur
    }).catch(err => console.error('[EMAIL_LOG] Erreur archivage:', err))

    // Logger l'action
    await supabase.from('logs').insert({
      utilisateur: body.createur,
      action: 'CREATE_USER',
      table_concernee: 'users',
      id_enregistrement: data.id,
      details: { 
        username: data.username, 
        type: data.type_utilisateur,
        email_sent: emailResult.success,
        email_error: emailResult.error || null
      }
    })

    // Ne pas retourner le mot de passe hashé
    const { password: _, ...userWithoutPassword } = data

    // Construire le message de retour selon le statut de l'email
    let message = 'Utilisateur créé avec succès.'
    if (emailResult.success) {
      message += ' Un email avec les identifiants a été envoyé.'
    } else {
      message += ` L'email n'a pas pu être envoyé (${emailResult.error}).`
    }

    // Retourner le mot de passe UNIQUEMENT si l'email n'a pas été envoyé
    return NextResponse.json({ 
      user: userWithoutPassword,
      message,
      emailSent: emailResult.success,
      emailError: emailResult.error || null,
      tempPassword: emailResult.success ? null : plainPassword
    })
  } catch (error) {
    console.error('Erreur POST user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Mettre à jour un utilisateur
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // Vérifier que ce n'est pas le super admin (sauf par lui-même)
    const { data: existingUser } = await supabase
      .from('users')
      .select('type_utilisateur, username')
      .eq('id', body.id)
      .single()

    if (existingUser?.type_utilisateur === 'Super admin' && body.modificateur !== existingUser.username) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas modifier le Super Admin' },
        { status: 403 }
      )
    }

    const updateData = {
      nom: body.nom?.toUpperCase(),
      prenoms: body.prenoms,
      structure: body.structure,
      superieur_existe: body.superieur_existe,
      superieur: body.superieur,
      poste: body.poste,
      acces_risque: body.acces_risque,
      acces_activite: body.acces_activite,
      acces_indicateur: body.acces_indicateur,
      acces_tb: body.acces_tb,
      acces_perform: body.acces_perform,
      acces_admin: body.acces_admin,
      type_utilisateur: body.type_utilisateur,
      statut: body.statut,
      modificateur: body.modificateur
    }

    // Retirer les champs undefined
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    )

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', body.id)
      .select('id, username, nom, prenoms, structure, poste, type_utilisateur, statut')
      .single()

    if (error) throw error

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('Erreur PUT user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
