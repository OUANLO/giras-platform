import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdministrationAccess, getAuthenticatedUserFromRequest } from '@/lib/auth'
import { hashPassword, generatePassword } from '@/lib/utils'
import { sendEmail, getWelcomeEmailTemplate } from '@/lib/email'


async function validateHierarchyConstraints(supabase, body, existingUser = null) {
  const targetUsername = String(existingUser?.username || body.username || '').trim().toLowerCase()
  const targetStructure = body.structure || existingUser?.structure || null
  const requestedType = body.type_utilisateur || existingUser?.type_utilisateur || 'User'
  const selectedSuperior = body.superieur ? String(body.superieur).trim().toLowerCase() : null

  if (selectedSuperior) {
    const { data: superior, error: superiorError } = await supabase
      .from('users')
      .select('username, structure, type_utilisateur, statut')
      .eq('username', selectedSuperior)
      .maybeSingle()
    if (superiorError) throw superiorError
    if (!superior || superior.statut !== 'Actif' || superior.structure !== targetStructure || !['Manager', 'Super manager', 'Admin', 'Super admin'].includes(superior.type_utilisateur)) {
      throw new Error('Le supérieur hiérarchique direct doit être un Manager, Super manager, Admin ou Super admin de la même structure.')
    }
  }

  if (requestedType === 'User' && targetUsername) {
    const { data: structuresUsingUser, error: structuresError } = await supabase
      .from('structures')
      .select('code_structure')
      .eq('responsable_structure', targetUsername)
    if (structuresError) throw structuresError

    const { data: subordinates, error: subordinatesError } = await supabase
      .from('users')
      .select('id')
      .eq('superieur', targetUsername)
      .limit(1)
    if (subordinatesError) throw subordinatesError

    if ((structuresUsingUser || []).length > 0 || (subordinates || []).length > 0) {
      throw new Error("Cet utilisateur ne peut pas être passé au type User tant qu'il reste responsable de structure ou supérieur hiérarchique direct.")
    }
  }
}


function normalizeUserPayload(body, guard, existingUser = null) {
  const isActorSuperAdmin = guard?.type_utilisateur === 'Super admin'
  const requestedType = body.type_utilisateur || existingUser?.type_utilisateur || 'User'
  const allowedType = isActorSuperAdmin
    ? requestedType
    : (['Admin', 'Manager', 'User'].includes(requestedType) ? requestedType : (existingUser?.type_utilisateur && ['Admin', 'Manager', 'User'].includes(existingUser.type_utilisateur) ? existingUser.type_utilisateur : 'User'))

  const accesAdmin = isActorSuperAdmin
    ? (allowedType === 'Super admin' ? 'Oui' : (allowedType === 'Admin' ? (body.acces_admin === 'Oui' ? 'Oui' : 'Non') : 'Non'))
    : 'Non'

  return {
    type_utilisateur: allowedType,
    acces_admin: accesAdmin,
    admin_structures_droit: isActorSuperAdmin
      ? (allowedType === 'Super admin' ? 'edit' : (accesAdmin === 'Oui' ? (body.admin_structures_droit || 'read') : 'none'))
      : 'none',
    admin_flash_droit: isActorSuperAdmin
      ? (allowedType === 'Super admin' ? 'edit' : (accesAdmin === 'Oui' ? (body.admin_flash_droit || 'read') : 'none'))
      : 'none',
    admin_emailing_acces: isActorSuperAdmin
      ? (allowedType === 'Super admin' ? 'Oui' : (accesAdmin === 'Oui' ? (body.admin_emailing_acces || 'Non') : 'Non'))
      : 'Non',
    peut_creer_projets: allowedType === 'Super admin' ? 'Oui' : (body.peut_creer_projets || 'Non'),
    peut_creer_groupes_indicateurs: allowedType === 'Super admin' ? 'Oui' : (body.peut_creer_groupes_indicateurs || 'Non')
  }
}

// GET - Récupérer tous les utilisateurs
export async function GET(request) {
  try {
    const requestUser = getAuthenticatedUserFromRequest?.(request)
    const { searchParams } = new URL(request.url)
    const structure = searchParams.get('structure')
    const type = searchParams.get('type')
    const statut = searchParams.get('statut')

    const supabase = createAdminClient(request)
    
    let query = supabase
      .from('users')
      .select('id, username, nom, prenoms, structure, superieur_existe, superieur, poste, type_utilisateur, statut, acces_risque, acces_activite, acces_indicateur, acces_tb, acces_perform, acces_admin, peut_creer_projets, peut_creer_groupes_indicateurs, admin_structures_droit, admin_flash_droit, admin_emailing_acces, createur, date_creation')
      .order('nom', { ascending: true })

    if (structure) query = query.eq('structure', structure)
    if (type) query = query.eq('type_utilisateur', type)
    if (statut) query = query.eq('statut', statut)

    const { data, error } = await query

    if (error) throw error

    const adminScope = searchParams.get('admin_scope') === '1'
    const filteredData = adminScope && requestUser?.type_utilisateur === 'Admin'
      ? (data || []).filter((item) => item?.createur === requestUser?.username)
      : (data || [])

    return NextResponse.json({ users: filteredData })
  } catch (error) {
    console.error('Erreur GET users:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Créer un nouvel utilisateur
export async function POST(request) {
  try {
    const guard = requireAdministrationAccess(request)
    if (guard instanceof NextResponse) return guard

    const body = await request.json()
    const supabase = createAdminClient(request)

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
    await validateHierarchyConstraints(supabase, body)
    const normalized = normalizeUserPayload(body, guard)

    const { data, error } = await supabase
      .from('users')
      .insert({
        username: body.username.toLowerCase(),
        password: hashedPassword,
        nom: body.nom.toUpperCase(),
        prenoms: body.prenoms,
        structure: body.structure,
        superieur_existe: body.superieur_existe || 'Non',
        superieur: body.superieur ? String(body.superieur).trim() : null,
        poste: body.poste,
        acces_risque: body.acces_risque || 'Non',
        acces_activite: body.acces_activite || 'Non',
        acces_indicateur: body.acces_indicateur || 'Non',
        acces_tb: body.acces_tb || 'Non',
        acces_perform: body.acces_perform || 'Non',
        acces_admin: normalized.acces_admin,
        type_utilisateur: normalized.type_utilisateur,
        statut: body.statut || 'Actif',
        peut_creer_projets: normalized.peut_creer_projets,
        peut_creer_groupes_indicateurs: normalized.peut_creer_groupes_indicateurs,
        admin_structures_droit: normalized.admin_structures_droit,
        admin_flash_droit: normalized.admin_flash_droit,
        admin_emailing_acces: normalized.admin_emailing_acces,
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

    // Archiver l'email dans email_logs (sans bloquer la création si l'archivage échoue)
    const { error: emailLogError } = await supabase.from('email_logs').insert({
      destinataire: data.username,
      destinataire_nom: `${data.prenoms} ${data.nom}`,
      sujet: emailTemplate.subject,
      type_email: 'creation_compte',
      statut: emailResult.success ? 'envoyé' : 'échec',
      message_id: emailResult.messageId || null,
      erreur: emailResult.success ? null : emailResult.error,
      source: 'automatique',
      createur: body.createur
    })

    if (emailLogError) {
      console.error('[EMAIL_LOG] Erreur archivage:', emailLogError)
    }

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
    const guard = requireAdministrationAccess(request)
    if (guard instanceof NextResponse) return guard

    const body = await request.json()
    const supabase = createAdminClient(request)

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('type_utilisateur, username, createur, structure')
      .eq('id', body.id)
      .single()

    if (existingUser?.type_utilisateur === 'Super admin' && guard?.type_utilisateur !== 'Super admin') {
      return NextResponse.json(
        { error: "Seul un super admin peut modifier les informations d'un super admin." },
        { status: 403 }
      )
    }

    if (guard?.type_utilisateur === 'Admin') {
      if (existingUser?.createur !== guard?.username) {
        return NextResponse.json(
          { error: 'Un admin ne peut modifier que les utilisateurs qu\'il a lui-même créés.' },
          { status: 403 }
        )
      }
    }

    await validateHierarchyConstraints(supabase, body, existingUser)
    const normalized = normalizeUserPayload(body, guard, existingUser)

    const updateData = {
      nom: body.nom?.toUpperCase(),
      prenoms: body.prenoms,
      structure: body.structure,
      superieur_existe: body.superieur ? 'Oui' : 'Non',
      superieur: body.superieur ? String(body.superieur).trim() : null,
      poste: body.poste,
      acces_risque: body.acces_risque,
      acces_activite: body.acces_activite,
      acces_indicateur: body.acces_indicateur,
      acces_tb: body.acces_tb,
      acces_perform: body.acces_perform,
      acces_admin: normalized.acces_admin,
      type_utilisateur: normalized.type_utilisateur,
      statut: body.statut,
      peut_creer_projets: normalized.peut_creer_projets,
      peut_creer_groupes_indicateurs: normalized.peut_creer_groupes_indicateurs,
      admin_structures_droit: normalized.admin_structures_droit,
      admin_flash_droit: normalized.admin_flash_droit,
      admin_emailing_acces: normalized.admin_emailing_acces,
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
      .select('id, username, nom, prenoms, structure, superieur_existe, superieur, poste, type_utilisateur, statut, acces_admin, peut_creer_projets, peut_creer_groupes_indicateurs, admin_structures_droit, admin_flash_droit, admin_emailing_acces')
      .single()

    if (error) throw error

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('Erreur PUT user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
