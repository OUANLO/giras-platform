from pathlib import Path

# Patch login page
login_path = Path('/mnt/data/giras_work/src/app/login/page.js')
text = login_path.read_text()
old = """        {/* Logos en haut */}
        <div className="mb-6 flex items-center justify-center sm:justify-between">
          <Image 
            src="/logo-giras.png" 
            alt="GIRAS" 
            width={240} 
            height={78}
            className="h-auto w-full max-w-[250px] object-contain sm:max-w-[185px]"
            priority
          />
          <div className="hidden sm:flex sm:items-center sm:gap-6">
            <div className="h-12 w-px bg-white/30"></div>
            <Image 
              src="/logo-cnam.png" 
              alt="CNAM" 
              width={112} 
              height={112}
              className="h-auto w-full max-w-[84px] object-contain"
              priority
            />
          </div>
        </div>
"""
new = """        {/* Logos en haut */}
        <div className="mb-6">
          <div className="flex justify-center md:hidden">
            <Image 
              src="/logo-giras.png" 
              alt="GIRAS" 
              width={280} 
              height={92}
              className="h-auto w-full max-w-[240px] object-contain"
              priority
            />
          </div>
          <div className="hidden md:flex md:items-center md:justify-center md:gap-8 lg:gap-10">
            <div className="flex h-24 items-center justify-center">
              <Image 
                src="/logo-giras.png" 
                alt="GIRAS" 
                width={320} 
                height={96}
                className="h-16 w-auto object-contain lg:h-[72px]"
                priority
              />
            </div>
            <div className="h-16 w-px bg-white/30 lg:h-[72px]"></div>
            <div className="flex h-24 items-center justify-center">
              <Image 
                src="/logo-cnam.png" 
                alt="CNAM" 
                width={160} 
                height={160}
                className="h-16 w-auto object-contain lg:h-[72px]"
                priority
              />
            </div>
          </div>
        </div>
"""
if old not in text:
    raise SystemExit('Old login logo block not found')
login_path.write_text(text.replace(old, new))

# Patch dashboard indicators page wording
page_path = Path('/mnt/data/giras_work/src/app/dashboard/indicateurs/page.js')
text = page_path.read_text()
text = text.replace("Confirmez la validation de la valeur ou rejetez-la avec un commentaire explicatif. Tant que l'indicateur n'est pas validé, le gestionnaire, le responsable, son supérieur hiérarchique direct, son responsable de structure et le super admin peuvent encore le modifier.",
                    "Confirmez la validation de la valeur ou rejetez-la avec un commentaire explicatif. Tant que l'indicateur n'est pas validé, le gestionnaire et le super admin peuvent modifier toutes les informations. Le responsable, son supérieur hiérarchique direct et le responsable de structure peuvent uniquement modifier la valeur et le commentaire.")
page_path.write_text(text)

# Patch API access context with indicator fallback
api_path = Path('/mnt/data/giras_work/src/app/api/indicateurs/occurrences/route.js')
text = api_path.read_text()
old_func = """async function getIndicatorUpdateAccessContext(supabase, occurrence, actorUsername) {
  const normalizedActor = normalizeUsername(actorUsername)
  if (!occurrence || !normalizedActor) {
    return { canWorkflow: false, canFullEdit: false, canLimitedEdit: false }
  }

  const { data: actor } = await supabase
    .from('users')
    .select('username, type_utilisateur')
    .eq('username', actorUsername)
    .maybeSingle()

  const canWorkflow = !!actor && ['Gestionnaire', 'Super admin'].includes(actor.type_utilisateur)
  const canFullEdit = canWorkflow

  let canLimitedEdit = false
  const indicatorResponsible = String(occurrence?.responsable || '').trim()
  if (normalizeUsername(indicatorResponsible) === normalizedActor) {
    canLimitedEdit = true
  }

  if (!canLimitedEdit && indicatorResponsible) {
    const { data: responsibleUser } = await supabase
      .from('users')
      .select('username, superieur')
      .eq('username', indicatorResponsible)
      .maybeSingle()
    if (normalizeUsername(responsibleUser?.superieur) === normalizedActor) {
      canLimitedEdit = true
    }
  }

  if (!canLimitedEdit && occurrence?.code_structure) {
    const { data: managedStructure } = await supabase
      .from('structures')
      .select('code_structure, responsable_structure')
      .eq('code_structure', occurrence.code_structure)
      .eq('responsable_structure', actorUsername)
      .maybeSingle()
    if (managedStructure) {
      canLimitedEdit = true
    }
  }

  return { canWorkflow, canFullEdit, canLimitedEdit }
}
"""
new_func = """async function getIndicatorUpdateAccessContext(supabase, occurrence, actorUsername) {
  const normalizedActor = normalizeUsername(actorUsername)
  if (!occurrence || !normalizedActor) {
    return { canWorkflow: false, canFullEdit: false, canLimitedEdit: false }
  }

  const { data: actor } = await supabase
    .from('users')
    .select('username, type_utilisateur')
    .eq('username', actorUsername)
    .maybeSingle()

  let linkedIndicator = null
  const occurrenceIndicatorCode = occurrence?.code_indicateur || occurrence?.code_indicateur_occ || null
  if (occurrenceIndicatorCode != null) {
    const { data: indicatorData } = await supabase
      .from('indicateurs')
      .select('code_indicateur, responsable, code_structure')
      .eq('code_indicateur', occurrenceIndicatorCode)
      .maybeSingle()
    linkedIndicator = indicatorData || null
  }

  const canWorkflow = !!actor && ['Gestionnaire', 'Super admin'].includes(actor.type_utilisateur)
  const canFullEdit = canWorkflow

  const indicatorResponsible = String(occurrence?.responsable || linkedIndicator?.responsable || '').trim()
  const indicatorStructure = String(occurrence?.code_structure || occurrence?.structure || linkedIndicator?.code_structure || '').trim()

  let canLimitedEdit = false
  if (normalizeUsername(indicatorResponsible) === normalizedActor) {
    canLimitedEdit = true
  }

  if (!canLimitedEdit && indicatorResponsible) {
    const { data: responsibleUser } = await supabase
      .from('users')
      .select('username, superieur')
      .eq('username', indicatorResponsible)
      .maybeSingle()
    if (normalizeUsername(responsibleUser?.superieur) === normalizedActor) {
      canLimitedEdit = true
    }
  }

  if (!canLimitedEdit && indicatorStructure) {
    const { data: managedStructure } = await supabase
      .from('structures')
      .select('code_structure, responsable_structure')
      .eq('code_structure', indicatorStructure)
      .eq('responsable_structure', actorUsername)
      .maybeSingle()
    if (managedStructure) {
      canLimitedEdit = true
    }
  }

  return { canWorkflow, canFullEdit, canLimitedEdit }
}
"""
if old_func not in text:
    raise SystemExit('Old access context function not found')
text = text.replace(old_func, new_func)
api_path.write_text(text)
