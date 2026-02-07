// periods.js
// Résolution robuste des périodes envoyées par l'UI.
// IMPORTANT: selon les déploiements, `periodes_evaluation` peut contenir
// - soit des colonnes structurées (annee, semestre, trimestre, mois)
// - soit uniquement un `libelle` (ex: "S1-2025" ou "Semestre 1 2025" ou "2024").
// Cette librairie doit donc être tolérante.

function buildPeriodeLibelle(p) {
  if (!p) return null
  // Si un libellé est présent en base, on le garde (c'est la référence UI)
  if (p.libelle) return String(p.libelle)
  // Libellé "humain" (principal) utilisé dans l'UI
  if (p.semestre) return `Semestre ${p.semestre} ${p.annee}`
  if (p.trimestre) return `Trimestre ${p.trimestre} ${p.annee}`
  if (p.mois) {
    const mm = Number(p.mois)
    if (!Number.isNaN(mm)) return `${mm}-${p.annee}`
    return `${p.mois}-${p.annee}`
  }
  return `${p.annee}`
}

function buildPeriodeKeyFromLibelle(libelle) {
  const s = (libelle ?? '').toString().trim()
  if (!s) return null

  // Déjà au format court attendu
  if (/^(S\d)-(\d{4})$/i.test(s)) return s.toUpperCase()
  if (/^(T\d)-(\d{4})$/i.test(s)) return s.toUpperCase()
  if (/^\d{4}$/.test(s)) return s

  // Convertir "Semestre 1 2025" -> "S1-2025"
  let m = s.match(/semestre\s*(\d)\s*(\d{4})/i)
  if (m) return `S${m[1]}-${m[2]}`

  // Convertir "Trimestre 2 2025" -> "T2-2025"
  m = s.match(/trimestre\s*(\d)\s*(\d{4})/i)
  if (m) return `T${m[1]}-${m[2]}`

  // Si le libellé contient une année seule, on la garde (dernier recours)
  m = s.match(/\b(19|20)\d{2}\b/)
  if (m && s.length === 4) return m[0]

  return s
}

function buildPeriodeKey(p) {
  if (!p) return null
  // Si libellé existant, on le normalise vers un format court si possible
  if (p.libelle) return buildPeriodeKeyFromLibelle(p.libelle)
  // Sinon on fabrique un format court basé sur les colonnes structurées
  if (p.semestre && p.annee) return `S${p.semestre}-${p.annee}`
  if (p.trimestre && p.annee) return `T${p.trimestre}-${p.annee}`
  if (p.mois && p.annee) return `${p.mois}-${p.annee}`
  if (p.annee) return `${p.annee}`
  return null
}

function buildPeriodeAliases(p) {
  if (!p) return []
  const aliases = new Set()
  const annee = p.annee != null ? `${p.annee}` : null

  // Libellé en base (si existant)
  if (p.libelle) aliases.add(String(p.libelle))

  // Humain
  if (p.semestre) aliases.add(`Semestre ${p.semestre} ${annee}`)
  if (p.trimestre) aliases.add(`Trimestre ${p.trimestre} ${annee}`)
  if (p.mois) {
    aliases.add(`${p.mois}-${annee}`)
    aliases.add(`${p.mois} ${annee}`)
  }
  if (annee) aliases.add(annee)

  // Courts
  if (p.semestre) {
    aliases.add(`S${p.semestre}-${annee}`)
    aliases.add(`S${p.semestre} ${annee}`)
  }
  if (p.trimestre) {
    aliases.add(`T${p.trimestre}-${annee}`)
    aliases.add(`T${p.trimestre} ${annee}`)
  }

  if (p.id) aliases.add(`${p.id}`)

  // Alias "key" (format court) si calculable
  const key = buildPeriodeKey(p)
  if (key) aliases.add(key)

  return Array.from(aliases).filter(Boolean)
}

function isOpenStatut(statut) {
  if (!statut) return false
  return /^ouvert/i.test(String(statut).trim()) // Ouvert / Ouverte
}

export async function resolvePeriode(supabase, periodeInput) {
  const p = (periodeInput ?? '').toString().trim()

  const { data: periodes, error: periodesErr } = await supabase
    .from('periodes_evaluation')
    // libelle est indispensable pour les déploiements qui ne stockent pas annee/semestre
    .select('id, libelle, annee, semestre, trimestre, mois, date_debut, date_fin, statut')

  if (periodesErr) throw periodesErr

  const candidates = (periodes || []).map(pr => ({
    ...pr,
    libelle: buildPeriodeLibelle(pr),
    periode_key: buildPeriodeKey(pr),
    aliases: buildPeriodeAliases(pr),
  }))

  const openAny = () => candidates
    .filter(x => isOpenStatut(x.statut))
    .sort((a, b) => new Date(b.date_debut || 0) - new Date(a.date_debut || 0))[0] || null

  if (!p) return openAny()

  // 1) match alias / libellé
  let found = candidates.find(x => x.aliases.includes(p) || x.libelle === p)
  if (found) return found

  // 2) année seule
  if (/^\d{4}$/.test(p)) {
    const year = parseInt(p, 10)
    const sameYear = candidates.filter(x => Number(x.annee) === year || String(x.libelle || '') === String(year))
    const opened = sameYear.find(x => isOpenStatut(x.statut))
    if (opened) return opened
    if (sameYear.length === 1) return sameYear[0]
    const anyOpen = openAny()
    if (anyOpen) return anyOpen
  }

  // 3) extraire l'année d'un libellé
  const ym = p.match(/\b(19|20)\d{2}\b/)
  if (ym) {
    const year = parseInt(ym[0], 10)
    const openYear = candidates
      .filter(x => isOpenStatut(x.statut) && String(x.libelle || '').includes(String(year)))
      .sort((a, b) => new Date(b.date_debut || 0) - new Date(a.date_debut || 0))[0]
    if (openYear) return openYear
  }

  return openAny()
}
