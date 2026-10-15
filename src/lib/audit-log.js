import { verifyAuthToken, getAuthenticatedUserFromRequest } from '@/lib/auth'

const EXCLUDED_TABLES = new Set(['logs'])
const SENSITIVE_KEYS = ['password', 'password_hash', 'currentPassword', 'newPassword', 'confirmPassword', 'confirmationPassword']

function isSensitiveKey(key = '') {
  const normalized = String(key || '').toLowerCase()
  return SENSITIVE_KEYS.some((token) => normalized.includes(token.toLowerCase()))
}

function sanitizeValue(value, forceNull = false) {
  if (forceNull) return null
  if (value === undefined || value === null) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function sanitizeRow(row = {}, keysToKeep = null) {
  const out = {}
  const entries = Object.entries(row || {})
    .filter(([key]) => !Array.isArray(keysToKeep) || keysToKeep.includes(key))
  for (const [key, value] of entries) {
    out[key] = isSensitiveKey(key) ? null : sanitizeValue(value)
  }
  return out
}

function extractActor(requestOrActor) {
  if (!requestOrActor) {
    return { email: 'system', type_utilisateur: 'Système' }
  }

  const directUser = requestOrActor?.username || requestOrActor?.email || requestOrActor?.utilisateur
  if (directUser) {
    return {
      email: directUser,
      type_utilisateur: requestOrActor?.type_utilisateur || requestOrActor?.type || 'Inconnu'
    }
  }

  try {
    const requestUser = getAuthenticatedUserFromRequest(requestOrActor)
    if (requestUser?.username) {
      return {
        email: requestUser.username,
        type_utilisateur: requestUser.type_utilisateur || 'Inconnu'
      }
    }
  } catch {}

  try {
    const token = requestOrActor?.cookies?.get?.('giras_auth')?.value
    const user = verifyAuthToken(token)
    if (user?.username) {
      return {
        email: user.username,
        type_utilisateur: user.type_utilisateur || 'Inconnu'
      }
    }
  } catch {}

  const headerEmail = requestOrActor?.headers?.get?.('x-user-email') || requestOrActor?.headers?.get?.('x-forwarded-user')
  const headerType = requestOrActor?.headers?.get?.('x-user-type')
  if (headerEmail) {
    return {
      email: headerEmail,
      type_utilisateur: headerType || 'Inconnu'
    }
  }

  return { email: 'system', type_utilisateur: 'Système' }
}

function extractRecordId(row = {}, fallback = null) {
  const preferredKeys = ['id', 'code_action', 'code_occurrence', 'code_indicateur', 'code_groupe', 'code_risque', 'code_processus', 'code_categorie', 'code_structure', 'username', 'email']
  for (const key of preferredKeys) {
    if (row && row[key] != null) return row[key]
  }
  return fallback
}

function applyFilters(query, filters) {
  let q = query
  for (const filter of filters || []) {
    const { method, args } = filter
    if (typeof q[method] === 'function') {
      q = q[method](...(args || []))
    }
  }
  return q
}

function buildDetailsBase(actor, table, action) {
  const now = new Date()
  return {
    utilisateur: actor.email,
    user_email: actor.email,
    type_utilisateur: actor.type_utilisateur,
    date_action: now.toISOString().slice(0, 10),
    heure_action: now.toISOString().slice(11, 19),
    table_concernee: table,
    type_action: action
  }
}

function computeChangedFields(before = {}, after = {}) {
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]))
  return keys.filter((key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null))
}

async function insertAuditLogs(client, entries) {
  if (!entries?.length) return
  try {
    await client.from('logs').insert(entries)
  } catch (error) {
    console.error('[AUDIT] insert logs failed:', error)
  }
}

async function snapshotRows(client, table, filters) {
  let query = client.from(table).select('*')
  query = applyFilters(query, filters)
  const { data, error } = await query
  if (error) {
    console.error(`[AUDIT] snapshot failed on ${table}:`, error)
    return []
  }
  return Array.isArray(data) ? data : data ? [data] : []
}

function normalizeMutationResultData(result, context) {
  if (Array.isArray(result?.data)) return result.data
  if (result?.data) return [result.data]
  if (Array.isArray(context.payload)) return context.payload
  if (context.payload) return [context.payload]
  return []
}

function buildCreateEntry(base, actor, table, row, fallbackId = null) {
  const recordId = extractRecordId(row, fallbackId)
  return {
    utilisateur: actor.email,
    action: 'CREATE',
    table_concernee: table,
    id_enregistrement: recordId,
    details: {
      ...base,
      id_enregistrement: recordId,
      nouvelles_valeurs: sanitizeRow(row)
    }
  }
}

function buildUpdateEntry(base, actor, table, before, after) {
  const changedFields = computeChangedFields(before, after)
  const maskSensitive = changedFields.some((key) => isSensitiveKey(key))
  const recordId = extractRecordId(after, extractRecordId(before))
  return {
    utilisateur: actor.email,
    action: 'UPDATE',
    table_concernee: table,
    id_enregistrement: recordId,
    details: {
      ...base,
      id_enregistrement: recordId,
      champs_modifies: changedFields,
      anciennes_valeurs: maskSensitive ? null : sanitizeRow(before, changedFields),
      nouvelles_valeurs: maskSensitive ? null : sanitizeRow(after, changedFields)
    }
  }
}

function buildDeleteEntry(base, actor, table, before) {
  const recordId = extractRecordId(before)
  return {
    utilisateur: actor.email,
    action: 'DELETE',
    table_concernee: table,
    id_enregistrement: recordId,
    details: {
      ...base,
      id_enregistrement: recordId,
      anciennes_valeurs: sanitizeRow(before)
    }
  }
}

function createBuilderProxy(builder, context) {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'containedBy', 'match'].includes(prop)) {
        return (...args) => {
          context.filters.push({ method: prop, args })
          const next = target[prop](...args)
          return createBuilderProxy(next, context)
        }
      }

      if (['insert', 'update', 'delete', 'upsert'].includes(prop)) {
        return (...args) => {
          context.mutation = prop
          context.payload = args[0]
          const next = target[prop](...args)
          return createBuilderProxy(next, context)
        }
      }

      if (prop === 'select') {
        return (...args) => {
          context.hasSelect = true
          const next = target.select(...args)
          return createBuilderProxy(next, context)
        }
      }

      if (prop === 'single' || prop === 'maybeSingle') {
        return (...args) => {
          context.expectsSingle = true
          const next = target[prop](...args)
          return createBuilderProxy(next, context)
        }
      }

      if (prop === 'then') {
        return (resolve, reject) => executeWithAudit(target, context).then(resolve, reject)
      }
      if (prop === 'catch') {
        return (reject) => executeWithAudit(target, context).catch(reject)
      }
      if (prop === 'finally') {
        return (handler) => executeWithAudit(target, context).finally(handler)
      }

      const value = Reflect.get(target, prop, receiver)
      if (typeof value === 'function') {
        return (...args) => {
          const next = value.apply(target, args)
          return next === target ? receiver : createBuilderProxy(next, context)
        }
      }
      return value
    }
  })
}

async function executeWithAudit(builder, context) {
  const { client, actor, table, mutation } = context
  if (!mutation || EXCLUDED_TABLES.has(table)) {
    return await builder
  }

  let beforeRows = []
  if (mutation === 'update' || mutation === 'delete' || mutation === 'upsert') {
    beforeRows = await snapshotRows(client, table, context.filters)
  }

  let executable = builder
  if (!context.hasSelect && typeof builder?.select === 'function') {
    executable = builder.select('*')
    context.hasSelect = true
  }

  const result = await executable
  if (result?.error) return result

  const base = buildDetailsBase(actor, table, mutation.toUpperCase())
  const entries = []

  if (mutation === 'insert') {
    const rows = normalizeMutationResultData(result, context)
    for (const row of rows) {
      entries.push(buildCreateEntry(base, actor, table, row))
    }
  }

  if (mutation === 'update') {
    const afterRows = normalizeMutationResultData(result, context)
    const maxLen = Math.max(beforeRows.length, afterRows.length)
    for (let i = 0; i < maxLen; i += 1) {
      const before = beforeRows[i] || {}
      const after = afterRows[i] || { ...before, ...(context.payload || {}) }
      entries.push(buildUpdateEntry(base, actor, table, before, after))
    }
  }

  if (mutation === 'delete') {
    for (const before of beforeRows) {
      entries.push(buildDeleteEntry(base, actor, table, before))
    }
  }

  if (mutation === 'upsert') {
    const afterRows = normalizeMutationResultData(result, context)
    for (const after of afterRows) {
      const matchingBefore = beforeRows.find((row) => extractRecordId(row) === extractRecordId(after))
      if (matchingBefore) {
        entries.push(buildUpdateEntry(base, actor, table, matchingBefore, after))
      } else {
        entries.push(buildCreateEntry(base, actor, table, after))
      }
    }
  }

  await insertAuditLogs(client, entries.filter((entry) => entry?.id_enregistrement != null || entry?.details))
  return result
}

export function createAuditedClient(client, requestOrActor) {
  const actor = extractActor(requestOrActor)

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table) => {
          const builder = target.from(table)
          const context = {
            client: target,
            actor,
            table,
            filters: [],
            mutation: null,
            payload: null,
            hasSelect: false,
            expectsSingle: false
          }
          return createBuilderProxy(builder, context)
        }
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
}
