import { isPointFocal, focalStructures, asArray, managesGroup } from './focal-scope'

const mutations = new Set(['insert', 'update', 'delete', 'upsert'])
const filters = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'containedBy', 'match', 'or', 'not', 'filter'])
const referenceTables = new Set(['categories', 'processus', 'periodes_evaluation', 'infos_flash'])
const directTables = { structures: 'code_structure', actions: 'code_structure', indicateurs: 'code_structure', risques: 'code_structure', users: 'structure' }
const denied = () => ({ data: null, error: { code: '42501', message: 'Accès refusé : élément hors du périmètre du point focal ou habilitation insuffisante.' }, status: 403 })

// This boundary wraps every request-bound service-role query. Existing roles keep
// the original client. Permissions are reloaded from the database, not the UI.
export function createFocalClient(client, raw, session, requestPath = '') {
  if (!isPointFocal(session)) return client
  let actorPromise
  const actor = () => actorPromise ||= (async () => {
    const { data, error } = await raw.from('users').select('*').eq('username', session.username).maybeSingle()
    if (error || !isPointFocal(data) || data.statut !== 'Actif') throw new Error('Compte point focal inactif ou habilitations modifiées : reconnectez-vous.')
    return data
  })()
  const cache = new Map()
  async function rows(table) {
    if (!cache.has(table)) cache.set(table, (async () => {
      let result = []
      for (let offset = 0; ; offset += 500) {
        let q = raw.from(table).select('*')
        if (directTables[table]) q = q.in(directTables[table], focalStructures(await actor()))
        const { data, error } = await q.order(table === 'structures' ? 'code_structure' : 'id').range(offset, offset + 499)
        if (error) throw new Error(error.message)
        result.push(...(data || []))
        if ((data || []).length < 500) return result
      }
    })())
    return cache.get(table)
  }
  async function scope(table) {
    const user = await actor()
    if (directTables[table]) return { column: directTables[table], values: focalStructures(user) }
    if (referenceTables.has(table)) return null
    if (table === 'fichiers_cartographie' && requestPath === '/api/cartographie/fichier') return null
    if (table === 'action_occurrences') return { column: 'code_action', values: (await rows('actions')).map(r => r.code_action) }
    if (table === 'indicateur_occurrences') return { column: 'code_indicateur', values: (await rows('indicateurs')).map(r => r.code_indicateur) }
    if (table === 'actions_risques' || table === 'risques_probabilites') return { column: 'code_risque', values: (await rows('risques')).map(r => r.code_risque) }
    if (table === 'taches') {
      const actionCodes = new Set((await rows('actions')).map(r => String(r.code_action)))
      return { column: 'code_occurrence', values: (await rows('action_occurrences')).filter(r => actionCodes.has(String(r.code_action))).map(r => r.code_occurrence) }
    }
    if (['groupe_actions', 'groupe_indicateurs', 'membres_groupe'].includes(table)) {
      const indicatorGroup = table !== 'groupe_actions'
      const groupsTable = indicatorGroup ? 'groupe_indicateurs' : 'groupe_actions'
      const items = await rows(indicatorGroup ? 'indicateurs' : 'actions')
      const codes = new Set(items.flatMap(r => [r.code_groupe, ...asArray(r.groupes)]).filter(Boolean).map(String))
      // Empty groups created/managed by the focal remain accessible for setup.
      for (const g of await rows(groupsTable)) if (managesGroup(user, g)) codes.add(String(g.code_groupe))
      return { column: 'code_groupe', values: [...codes] }
    }
    if (table === 'email_logs') return { column: 'destinataire', values: (await rows('users')).map(r => r.username) }
    // Global audit logs and whole-organisation cartography files are not scoped.
    return { column: 'id', values: [] }
  }
  function constrain(q, rule) { return rule ? q.in(rule.column, [...new Set(rule.values)]) : q }
  async function allowedPayload(table, payload, previous, method) {
    const user = await actor()
    const combined = { ...previous, ...payload }
    const structures = focalStructures(user)
    if (referenceTables.has(table) || table === 'fichiers_cartographie' || table === 'risques' || table === 'actions_risques') return false
    if (['/api/risques/probabilite', '/api/indicateurs/occurrences/probabilite'].includes(requestPath)) return false
    if (table === 'users') {
      if (requestPath === '/api/users/change-password' && method === 'update' && previous?.username === user.username && Object.keys(payload).every(k => ['password', 'modificateur', 'date_modification'].includes(k))) return true
      if (previous && (previous.username === user.username || previous.createur !== user.username)) return false
      if (!['User', 'Manager', 'Point focal'].includes(combined.type_utilisateur)) return false
      if (!structures.includes(String(combined.structure))) return false
      if (combined.acces_admin === 'Oui') return false
      if (isPointFocal(combined) && (!focalStructures(combined).length || focalStructures(combined).some(s => !structures.includes(s)))) return false
    }
    if (['groupe_actions', 'groupe_indicateurs'].includes(table)) {
      if (method === 'insert') return managesGroup(user, payload) && user[table === 'groupe_actions' ? 'peut_creer_projets' : 'peut_creer_groupes_indicateurs'] === 'Oui'
      return managesGroup(user, previous)
    }
    if (table === 'membres_groupe') {
      const g = (await rows('groupe_indicateurs')).find(g => String(g.code_groupe) === String(combined.code_groupe))
      if (!managesGroup(user, g)) return false
    }
    const rule = await scope(table)
    if (rule && !rule.values.map(String).includes(String(combined[rule.column]))) return false
    // Prevent a scoped item from being moved or linked to an out-of-scope parent.
    for (const [key, parent, column] of [['code_action', 'actions', 'code_action'], ['code_indicateur', 'indicateurs', 'code_indicateur'], ['code_risque', 'risques', 'code_risque']]) {
      if (payload?.[key] != null && table !== parent && !(await rows(parent)).some(r => String(r[column]) === String(payload[key]))) return false
    }
    if (payload?.code_structure && !structures.includes(String(payload.code_structure))) return false
    return true
  }
  async function execute(table, calls) {
    try {
      const user = await actor()
      if (table === 'fichiers_cartographie' && requestPath === '/api/cartographie/fichier' && user.acces_risque !== 'Oui') return denied()
      const mutation = calls.find(c => mutations.has(c.name))
      const rule = await scope(table)
      // Own account must be readable even when its home structure differs.
      const ownUserRead = !mutation && table === 'users' && calls.some(c => c.name === 'eq' && c.args[0] === 'username' && c.args[1] === user.username)
      const ownPasswordUpdate = table === 'users' && requestPath === '/api/users/change-password' && mutation?.name === 'update'
      if (mutation) {
        if (mutation.name === 'upsert' && table !== 'risques_probabilites') return denied()
        const payloads = Array.isArray(mutation.args[0]) ? mutation.args[0] : [mutation.args[0] || {}]
        if (mutation.name === 'insert' || mutation.name === 'upsert') {
          for (const payload of payloads) if (!await allowedPayload(table, payload, null, 'insert')) return denied()
        } else {
          let before = raw.from(table).select('*')
          for (const c of calls.filter(c => filters.has(c.name))) before = before[c.name](...c.args)
          const { data, error } = await before
          if (error) return { data: null, error }
          if (!data?.length) return denied()
          for (const row of data) {
            if (!ownPasswordUpdate && rule && !rule.values.map(String).includes(String(row[rule.column]))) return denied()
            if (!await allowedPayload(table, payloads[0], row, mutation.name)) return denied()
          }
        }
      }
      let q = client.from(table)
      let applied = false
      for (const c of calls) {
        q = q[c.name](...c.args)
        if (!applied && (c.name === 'select' || ['update', 'delete'].includes(c.name)) && !['insert', 'upsert'].includes(mutation?.name)) {
          if (!ownUserRead && !ownPasswordUpdate) q = constrain(q, rule)
          applied = true
        }
      }
      let result
      const paginatedRead = !mutation && !calls.some(c => ['limit', 'range', 'single', 'maybeSingle'].includes(c.name) || (c.name === 'select' && c.args[1]?.head))
      if (paginatedRead) {
        const data = []
        for (let offset = 0; ; offset += 500) {
          const page = await q.range(offset, offset + 499)
          if (page.error) return page
          data.push(...(page.data || []))
          if ((page.data || []).length < 500) { result = { ...page, data }; break }
        }
      } else result = await q
      if (mutation && !result.error) cache.clear()
      return result
    } catch (error) {
      return { ...denied(), error: { code: '42501', message: error.message } }
    }
  }
  function builder(table, calls = []) {
    let promise
    return new Proxy({}, { get(_target, name) {
      if (name === 'then') return (resolve, reject) => (promise ||= execute(table, calls)).then(resolve, reject)
      if (name === 'catch') return reject => (promise ||= execute(table, calls)).catch(reject)
      if (name === 'finally') return fn => (promise ||= execute(table, calls)).finally(fn)
      return (...args) => builder(table, [...calls, { name, args }])
    } })
  }
  return new Proxy(client, { get(target, name) {
    if (name === 'from') return table => builder(table)
    // No unrestricted RPC or global object storage for this scoped role.
    if (name === 'rpc') return async () => denied()
    if (name === 'storage') return { from(bucket) {
      return new Proxy({}, { get(_storage, method) {
        return async (...args) => {
          const user = await actor()
          if (requestPath !== '/api/cartographie/fichier' || user.acces_risque !== 'Oui' || !['list', 'createSignedUrl'].includes(method)) return denied()
          return raw.storage.from(bucket)[method](...args)
        }
      } })
    } }
    return Reflect.get(target, name)
  } })
}
