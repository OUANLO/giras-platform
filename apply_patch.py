from pathlib import Path

# reminder-data.js
p = Path('/tmp/giras_fix/src/lib/reminder-data.js')
text = p.read_text()
text = text.replace("""function isEmptyValInd(val) {
  return val === null || val === undefined || val === ''
}
""", """function isEmptyValInd(val) {
  return val === null || val === undefined || val === ''
}

function toNumber(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const normalized = String(value).replace('%', '').replace(',', '.').trim()
  if (!normalized) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function getRowSortValue(row) {
  const candidates = [row?.date_modification, row?.updated_at, row?.created_at, row?.date_realisation, row?.date_conf, row?.date_fin, row?.date_debut]
  for (const value of candidates) {
    if (!value) continue
    const ts = new Date(value).getTime()
    if (Number.isFinite(ts)) return ts
  }
  const idNum = Number(row?.id)
  return Number.isFinite(idNum) ? idNum : 0
}

function buildEffectiveActionRows(actions, actionOccurrences) {
  const activeActions = (actions || []).filter((action) => action && action.archive !== true && action.statut !== 'Inactif' && action.statut_act !== 'Inactif')
  const realOccurrences = (actionOccurrences || []).filter((occ) => occ && occ.archive !== true)
  const latestOccurrenceByAction = new Map()

  for (const occ of realOccurrences) {
    const code = String(occ?.code_action || '').trim()
    if (!code) continue
    const previous = latestOccurrenceByAction.get(code)
    if (!previous || getRowSortValue(occ) >= getRowSortValue(previous)) {
      latestOccurrenceByAction.set(code, occ)
    }
  }

  return activeActions.map((action) => {
    const code = String(action?.code_action || '').trim()
    const occ = code ? latestOccurrenceByAction.get(code) : null
    return {
      ...action,
      ...(occ || {}),
      code_action: occ?.code_action || action.code_action,
      responsable: occ?.responsable || action?.responsable || null,
      code_groupe: occ?.code_groupe || action.code_groupe || null,
      libelle_action: occ?.libelle_action || action?.libelle_action || null,
      date_debut: occ?.date_debut || action.date_debut || null,
      date_fin: occ?.date_fin || action.date_fin || null,
      tx_avancement: toNumber(occ?.tx_avancement) ?? toNumber(action?.tx_avancement) ?? 0,
      statut: action.statut || action.statut_act || 'Actif'
    }
  })
}
""")
text = text.replace("""  const userActionOccurrences = (actionOccurrences || []).filter(occ => isSameResponsable(occ.responsable))
""", """  const effectiveActionRows = buildEffectiveActionRows(actions, actionOccurrences)
  const userActionOccurrences = effectiveActionRows.filter((occ) => isSameResponsable(occ.responsable))
""")
text = text.replace("""  for (const occ of userActionOccurrences) {
    if ((occ.tx_avancement || 0) >= 100) continue
    const action = (actions || []).find(a => a.code_action === occ.code_action)
""", """  for (const occ of userActionOccurrences) {
    const txAvancement = toNumber(occ?.tx_avancement) ?? 0
    if (txAvancement >= 100) continue
    const action = (actions || []).find(a => a.code_action === occ.code_action)
""")
text = text.replace("""      tx_avancement: occ.tx_avancement || 0,
      niveau_avancement: getNiveauAvancement(occ.tx_avancement || 0),
""", """      tx_avancement: txAvancement,
      niveau_avancement: getNiveauAvancement(txAvancement),
""")
p.write_text(text)

# weekly route
p = Path('/tmp/giras_fix/src/app/api/cron/weekly-recap/route.js')
text = p.read_text()
text = text.replace("""  const actionOccurrencesInScope = eligibleActionOccurrences.filter((occ) => {
    if (audienceType === 'super_manager') return true
    if (audienceType === 'structure_responsible') return scopeStructureCodes.has(getActionStructureCode(occ, occ))
    return identifierMatchesSet(occ.responsable, scopeUserIdentifiers)
  })
""", """  const actionOccurrencesInScope = eligibleActionOccurrences.filter((occ) => {
    const dateDebut = toDateOnly(occ?.date_debut)
    if (dateDebut && dateDebut > today) return false
    if (audienceType === 'super_manager') return true
    if (audienceType === 'structure_responsible') return scopeStructureCodes.has(getActionStructureCode(occ, occ))
    return identifierMatchesSet(occ.responsable, scopeUserIdentifiers)
  })
""")
# delete test block in admin page
p2 = Path('/tmp/giras_fix/src/app/dashboard/admin/page.js')
text2 = p2.read_text()
start = text2.find("\n              <div className=\"mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900\">")
if start != -1:
    end = text2.find("\n\n              {/* Résultat de l'envoi */}", start)
    if end != -1:
        text2 = text2[:start] + "\n" + text2[end:]
p2.write_text(text2)
# about page rewrite
p3 = Path('/tmp/giras_fix/src/app/dashboard/a-propos/page.js')
p3.write_text("""export default function AProposPage() {
  return (
    <div className=\"p-4 md:p-6 lg:p-8\"> 
      <div className=\"max-w-4xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden\"> 
        <div className=\"px-6 py-5 md:px-8 md:py-6 bg-gradient-to-r from-[#1a365d] via-[#234876] to-[#1a365d] text-white\"> 
          <h1 className=\"text-xl md:text-2xl font-bold\">A propos</h1>
          <p className=\"mt-2 text-sm md:text-base text-blue-50\"> 
            GIRAS est une plateforme conçue pour structurer le pilotage des risques, des actions et des indicateurs stratégiques. 
          </p>
        </div>

        <div className=\"px-6 py-6 md:px-8 md:py-8 space-y-6 text-gray-700 leading-7\"> 
          <section>
            <div className=\"rounded-xl border border-blue-100 bg-blue-50/60 p-4\"> 
              <p className=\"text-base md:text-lg font-semibold text-[#1a365d] mb-3\">Objectifs de la plateforme</p>
              <ul className=\"space-y-3 text-sm md:text-base\"> 
                <li>• Centraliser et optimiser la gestion des risques, de leur identification jusqu'au suivi rigoureux du plan de maîtrise.</li>
                <li>• Renforcer le suivi de la mise en œuvre des actions et diligences.</li>
                <li>• Centraliser le suivi des indicateurs stratégiques pour une vision consolidée de la performance.</li>
                <li>• Améliorer la traçabilité et l'auditabilité des actions.</li>
                <li>• Renforcer le suivi opérationnel et éclairer la prise de décision au plus haut niveau.</li>
              </ul>
            </div>
          </section>

          <section className=\"space-y-4\"> 
            <p>
              Cette plateforme a été conçue par <span className=\"font-semibold\">M. OUATTARA Ouanlo Fousseni</span>, 
              joignable à l'adresse <a className=\"text-blue-700 hover:underline\" href=\"mailto:fousseniouattara035@gmail.com\">fousseniouattara035@gmail.com</a>.
            </p>
            <p>
              Elle a été développée sous les orientations stratégiques et éclairées du <span className=\"font-semibold\">DGA de la CNAM, M. DIOMANDE Ahmed Tidiane</span>,
              et avec les conseils de <span className=\"font-semibold\">M. GNANDI Dalebe</span>, expert en actuariat.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
""")
print('patched')
