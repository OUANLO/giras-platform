from pathlib import Path
import re

# Patch pending-validation-service.js
p = Path('/tmp/girasfix/src/lib/pending-validation-service.js')
s = p.read_text()

if 'function parseJsonArray(value)' not in s:
    insert = """
function parseJsonArray(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getLatestPendingIndicatorReferenceDate(occ) {
  const history = parseJsonArray(occ?.validation_history)
  const candidate = [...history]
    .reverse()
    .find((entry) => {
      const decision = normalize(entry?.decision)
      return decision.includes('commentaire') || decision.includes('reponse') || decision.includes('soumission') || decision.includes('saisie')
    })
  return occ?.date_saisie || candidate?.created_at || candidate?.date || occ?.updated_at || occ?.date_modification || occ?.created_at || null
}

function isPendingIndicatorValidationStatus(value) {
  const status = normalize(value)
  if (!status) return false
  return status.includes('attente') && status.includes('validation')
}
"""
    s = s.replace("function safeEq(value, identifiers) {\n  const v = normalize(value)\n  return !!v && identifiers.has(v)\n}\n", "function safeEq(value, identifiers) {\n  const v = normalize(value)\n  return !!v && identifiers.has(v)\n}\n\n" + insert)

# replace buildPendingIndicatorRows body logic fragments
s = s.replace("""      const validationStatus = normalize(occ?.validation_status)
      const pendingStatuses = new Set(['attente de validation', 'attente validation', 'en attente de validation'])
      const isPending = isFilled(occ?.val_indicateur) && pendingStatuses.has(validationStatus)
      if (!isPending) return null
      const referenceDate = occ?.date_saisie || occ?.date_modification || occ?.updated_at || occ?.created_at
""", """      const occurrenceGroupCodes = new Set(unique([occ?.code_groupe, ...(Array.isArray(occ?.groupes) ? occ.groupes : parseList(occ?.groupes))]))
      const mergedGroupCodes = new Set([...groupCodes, ...occurrenceGroupCodes].map((code) => String(code || '').trim()).filter(Boolean))
      const isManaged = [...mergedGroupCodes].some((code) => managedGroupCodes.has(String(code || '').trim()))
      if (!isManaged) return null
      const isPending = (isFilled(occ?.val_indicateur) || isFilled(occ?.val_numerateur) || isFilled(occ?.val_denominateur)) && isPendingIndicatorValidationStatus(occ?.validation_status)
      if (!isPending) return null
      const referenceDate = getLatestPendingIndicatorReferenceDate(occ)
""")

# Avoid duplicate isManaged line if present twice
s = s.replace("""      const groupCodes = new Set(unique([indicator?.code_groupe, ...parseList(indicator?.groupes)]))
      const isManaged = [...groupCodes].some((code) => managedGroupCodes.has(String(code || '').trim()))
""", """      const groupCodes = new Set(unique([indicator?.code_groupe, ...parseList(indicator?.groupes)]))
""")

p.write_text(s)

# Patch cron route
p = Path('/tmp/girasfix/src/app/api/cron/pending-validations-daily/route.js')
s = p.read_text()
s = s.replace("const CRON_SECRET = process.env.CRON_SECRET || 'giras-cron-secret-2024'", "const CRON_SECRET = process.env.CRON_PENDING_VALIDATIONS_SECRET || process.env.CRON_SECRET || 'giras-rappel-quotidien-2024'\nexport const revalidate = 0")

s = re.sub(r"export async function GET\(request\) \{.*?const supabase = createAdminClient\(\)\n", """export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const providedSecret = authHeader?.replace('Bearer ', '') || searchParams.get('secret')
    const isTestMode = ['true', '1', 'yes'].includes(String(searchParams.get('test') || '').toLowerCase())
    const isForceMode = ['true', '1', 'yes'].includes(String(searchParams.get('force') || '').toLowerCase())
    if (providedSecret !== CRON_SECRET) return NextResponse.json({ error: 'Non autorisé' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })

    const now = new Date()
    const hours = now.getUTCHours()
    const minutes = now.getUTCMinutes()
    const isScheduledWindow = hours === 8 && minutes >= 30 && minutes < 40

    const supabase = createAdminClient()

    if (!isTestMode && !isForceMode && !isScheduledWindow) {
      return NextResponse.json({
        success: false,
        blocked: true,
        reason: 'outside_schedule',
        message: \"Les mails 'Validations et confirmations en attente' ne sont envoyés automatiquement qu'à 08h30.\",
        now_utc: now.toISOString()
      }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
    }

    if (!isTestMode && !isForceMode) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString()
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)).toISOString()
      const { data: existingLogs, error: logError } = await supabase
        .from('email_logs')
        .select('id, created_at')
        .eq('source', 'cron_pending_validations_daily')
        .gte('created_at', start)
        .lt('created_at', end)
        .limit(1)
      if (logError) throw logError
      if ((existingLogs || []).length > 0) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'already_sent_today',
          message: 'Les mails de validations en attente ont déjà été envoyés aujourd\'hui.',
          sent_at: existingLogs[0]?.created_at || null
        }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
      }
    }
""", s, count=1, flags=re.S)

s = s.replace("""      mode: 'daily'
    })
    return NextResponse.json({
""", """      mode: isTestMode ? 'test' : 'daily'
    })
    return NextResponse.json({
""")

s = s.replace("""      results
    })
""", """      results,
      testMode: isTestMode,
      generatedAt: new Date().toISOString()
    }, { headers: { 'Cache-Control': 'no-store' } })
""")

s = s.replace("return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })", "return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })")
p.write_text(s)

# Patch emailing GET no-store maybe POST unchanged
p = Path('/tmp/girasfix/src/app/api/emailing/pending-validations/route.js')
s = p.read_text()
s = s.replace("export const dynamic = 'force-dynamic'", "export const dynamic = 'force-dynamic'\nexport const revalidate = 0")
s = s.replace("return NextResponse.json({ synthesis, settings })", "return NextResponse.json({ synthesis, settings, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })")
s = s.replace("return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })", "return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })", 1)
p.write_text(s)

# Patch admin page UI section and test button
p = Path('/tmp/girasfix/src/app/dashboard/admin/page.js')
s = p.read_text()

if 'const runPendingValidationCronTest' not in s:
    marker = "  const sendPendingValidationEmailsToSelected = async () => {\n"
    insert = """
  const runPendingValidationCronTest = async () => {
    setConfirmAction({
      message: "Lancer un test du CRON 'Validations et confirmations en attente' maintenant ?",
      onConfirm: async () => {
        setSendingPendingValidationEmail(true)
        setPendingValidationEmailResult(null)
        try {
          const res = await fetch('/api/cron/pending-validations-daily?test=true&secret=giras-rappel-quotidien-2024')
          const data = await res.json()
          if (!res.ok || data?.error) throw new Error(data.error || \"Erreur lors du test du CRON\")
          setPendingValidationEmailResult({
            success: true,
            message: data.skipped ? (data.message || 'Test ignoré') : `Test CRON exécuté : ${data.summary?.emails_sent || 0} email(s) envoyé(s)`,
            summary: data.summary,
            results: data.results
          })
          showAlert('success', data.skipped ? (data.message || 'Test ignoré') : `Test CRON exécuté : ${data.summary?.emails_sent || 0} email(s) envoyé(s)`)
          const refreshRes = await fetch('/api/emailing/pending-validations', { cache: 'no-store' })
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json()
            setPendingValidationSynthesis(refreshData.synthesis || [])
            if (refreshData.settings) setPendingValidationSettings(refreshData.settings)
          }
          await fetchEmailLogs()
          await fetchEmailStats()
        } catch (error) {
          console.error(error)
          setPendingValidationEmailResult({ success: false, message: error.message || \"Erreur lors du test du CRON\" })
          showAlert('error', error.message || \"Erreur lors du test du CRON\")
        } finally {
          setSendingPendingValidationEmail(false)
        }
      }
    })
  }

"""
    s = s.replace(marker, insert + marker)

# improve fetch no-store in refresh blocks
s = s.replace("const refreshRes = await fetch('/api/emailing/pending-validations')", "const refreshRes = await fetch('/api/emailing/pending-validations', { cache: 'no-store' })")

old = """            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Validations et confirmations en attente</h2>
                  <p className="text-sm text-gray-500">Emails quotidiens et hebdomadaires destinés aux gestionnaires de projet et aux gestionnaires de groupes d'indicateurs</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-lg border border-amber-100 bg-amber-50">
                  <h3 className="font-semibold text-gray-900 mb-3">Paramètres des délais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Délai confirmation actions (jours)</label>
                      <input type="number" min="0" value={pendingValidationSettings.actionValidationDelayDays ?? 0} onChange={(e) => setPendingValidationSettings({ ...pendingValidationSettings, actionValidationDelayDays: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Délai validation indicateurs (jours)</label>
                      <input type="number" min="0" value={pendingValidationSettings.indicatorValidationDelayDays ?? 0} onChange={(e) => setPendingValidationSettings({ ...pendingValidationSettings, indicatorValidationDelayDays: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button onClick={saveValidationReminderSettings} disabled={savingPendingValidationSettings}>{savingPendingValidationSettings ? 'Enregistrement...' : 'Enregistrer les paramètres'}</Button>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-blue-100 bg-blue-50">
                  <h3 className="font-semibold text-gray-900 mb-3">Envoi manuel</h3>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Gestionnaires ciblés</label>
                      <SearchableSelect
                        value={selectedManagersForPendingEmail}
                        onChange={setSelectedManagersForPendingEmail}
                        options={pendingValidationTargetOptions}
                        placeholder="Sélectionner un ou plusieurs gestionnaires..."
                        searchPlaceholder="Rechercher un gestionnaire..."
                        multiple
                      />
                    </div>
                    <Button icon={Send} onClick={sendPendingValidationEmailsToSelected} disabled={!selectedManagersForPendingEmail.length || sendingPendingValidationEmail}>Envoyer</Button>
                  </div>
                  <div className="mt-3">
                    <Button icon={Send} variant="secondary" onClick={sendPendingValidationEmailsToAll} disabled={sendingPendingValidationEmail || pendingValidationSynthesis.length === 0}>
                      {sendingPendingValidationEmail ? 'Envoi en cours...' : `Envoyer à tous (${pendingValidationSynthesis.length})`}
                    </Button>
                  </div>
                </div>
              </div>
"""
new = """            <div className=\"bg-white rounded-2xl p-6 shadow-sm border border-gray-100\">\n              <div className=\"flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-5\">\n                <div className=\"flex items-start gap-3\">\n                  <div className=\"w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-sm\">\n                    <AlertTriangle size={20} className=\"text-white\" />\n                  </div>\n                  <div>\n                    <h2 className=\"text-lg font-bold text-gray-900\">Validations et confirmations en attente</h2>\n                    <p className=\"text-sm text-gray-500\">Pilotage des mails quotidiens envoyés aux gestionnaires de projet et aux gestionnaires de groupes d'indicateurs.</p>\n                  </div>\n                </div>\n                <div className=\"rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800\">\n                  <div className=\"font-semibold\">CRON quotidien</div>\n                  <div className=\"mt-1 text-xs break-all\">https://www.giras.africa/api/cron/pending-validations-daily?secret=giras-rappel-quotidien-2024</div>\n                  <div className=\"mt-1 text-xs\">Exécution automatique : tous les jours à 08h30 • test manuel possible via le bouton ci-dessous.</div>\n                </div>\n              </div>\n\n              <div className=\"grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5\">\n                <div className=\"xl:col-span-1 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5\">\n                  <div className=\"flex items-center justify-between mb-4\">\n                    <h3 className=\"font-semibold text-gray-900\">Paramètres des délais</h3>\n                    <span className=\"text-xs px-2 py-1 rounded-full bg-white text-amber-700 border border-amber-200\">Administration</span>\n                  </div>\n                  <div className=\"space-y-4\">\n                    <div>\n                      <label className=\"block text-xs font-medium text-gray-600 mb-1.5\">Délai confirmation actions (jours)</label>\n                      <input type=\"number\" min=\"0\" value={pendingValidationSettings.actionValidationDelayDays ?? 0} onChange={(e) => setPendingValidationSettings({ ...pendingValidationSettings, actionValidationDelayDays: e.target.value })} className=\"w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-amber-400 focus:outline-none\" />\n                    </div>\n                    <div>\n                      <label className=\"block text-xs font-medium text-gray-600 mb-1.5\">Délai validation indicateurs (jours)</label>\n                      <input type=\"number\" min=\"0\" value={pendingValidationSettings.indicatorValidationDelayDays ?? 0} onChange={(e) => setPendingValidationSettings({ ...pendingValidationSettings, indicatorValidationDelayDays: e.target.value })} className=\"w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-amber-400 focus:outline-none\" />\n                    </div>\n                    <Button onClick={saveValidationReminderSettings} disabled={savingPendingValidationSettings}>\n                      {savingPendingValidationSettings ? 'Enregistrement...' : 'Enregistrer les paramètres'}\n                    </Button>\n                  </div>\n                </div>\n\n                <div className=\"xl:col-span-2 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5\">\n                  <div className=\"flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-4\">\n                    <div>\n                      <h3 className=\"font-semibold text-gray-900\">Envoi manuel et tests</h3>\n                      <p className=\"text-xs text-gray-600 mt-1\">Lancez un envoi ciblé, un envoi global ou un test du CRON sans attendre 08h30.</p>\n                    </div>\n                    <div className=\"flex flex-wrap gap-2\">\n                      <Button icon={Send} variant=\"secondary\" onClick={runPendingValidationCronTest} disabled={sendingPendingValidationEmail}>\n                        Tester le CRON\n                      </Button>\n                      <Button icon={Send} variant=\"secondary\" onClick={sendPendingValidationEmailsToAll} disabled={sendingPendingValidationEmail || pendingValidationSynthesis.length === 0}>\n                        {sendingPendingValidationEmail ? 'Envoi en cours...' : `Envoyer à tous (${pendingValidationSynthesis.length})`}\n                      </Button>\n                    </div>\n                  </div>\n\n                  <div className=\"grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end\">\n                    <div>\n                      <label className=\"block text-xs font-medium text-gray-600 mb-1.5\">Gestionnaires ciblés</label>\n                      <SearchableSelect\n                        value={selectedManagersForPendingEmail}\n                        onChange={setSelectedManagersForPendingEmail}\n                        options={pendingValidationTargetOptions}\n                        placeholder=\"Sélectionner un ou plusieurs gestionnaires...\"\n                        searchPlaceholder=\"Rechercher un gestionnaire...\"\n                        multiple\n                      />\n                    </div>\n                    <Button icon={Send} onClick={sendPendingValidationEmailsToSelected} disabled={!selectedManagersForPendingEmail.length || sendingPendingValidationEmail}>Envoyer la sélection</Button>\n                  </div>\n                </div>\n              </div>\n"""
s = s.replace(old, new)
p.write_text(s)

