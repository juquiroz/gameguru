// BUILD-SUP-005 — Reglas de uso del API (pestaña 'api' de la consola, read-only).
// Lógica pura de la vista de configuración del API. Nada de React ni Supabase
// acá: los agregados y derivaciones son funciones puras testeables desde el
// harness. Fuentes de datos reales (sin inventar):
//   sync_cooldown_config: sync_window, cooldown_minutes, description,
//                         updated_at (RLS lectura autenticado).
//   api_budget:           provider, date, automatic_limit/used, manual_limit/
//                         used, reset_at (RLS lectura platform admins).
//   sync_runs:            historial de ejecuciones del results-sync
//                         (RLS lectura platform admins).
// La programación del cron ('*/3 * * * *') vive en cron.job (schema interno,
// no expuesto a REST) y se documenta como CONSTANTE de referencia en este
// dominio — nunca como dato consultado.

// Orden lógico de exhibición de las ventanas (ciclo de un partido).
export const WINDOW_ORDER = [
  'future',
  'approaching',
  'pregame',
  'imminent',
  'just_finished',
  'past_active',
  'past_extended',
  'past_reconciled',
]

// Programación del cron de resultados (referencia documentada de cron.job).
export const CRON_REFERENCE = {
  jobname: 'auto-sync-nfl-results',
  schedule: '*/3 * * * *',
  description: 'Cada 3 minutos (refresco en vivo de MLB/NFL, 2026).',
}

// Límites diarios por proveedor (referencia documentada de reserve_api_request,
// aplicados en prod vía 020.0). Los valores EN VIVO salen de api_budget.
export const PROVIDER_LIMITS = {
  espn: { automatic_limit: 600, manual_limit: 20 },
  'api-sports': { automatic_limit: 80, manual_limit: 20 },
}

export function orderCooldownWindows(rows = []) {
  const byKey = {}
  for (const r of rows) {
    if (r && r.sync_window) byKey[r.sync_window] = r
  }
  const rank = { ...Object.fromEntries(WINDOW_ORDER.map((w, i) => [w, i])) }
  return WINDOW_ORDER
    .map((w) => byKey[w])
    .filter(Boolean)
    .concat(
      Object.keys(byKey)
        .filter((k) => !(k in rank))
        .map((k) => byKey[k]),
    )
}

// 999999 → "nunca". 240 min → "4 h". 90 min → "1 h 30 min". 3 min → "3 min".
export function formatCooldown(minutes) {
  const n = Number(minutes)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 999999) return 'nunca'
  const h = Math.floor(n / 60)
  const m = n % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

// Límites configurados por defecto para un proveedor (fallback si no hay fila
// del día en api_budget). Encima del fallback está el total mostrado.
export function defaultBudgetLimits(provider) {
  const def = PROVIDER_LIMITS[provider]
  return def || { automatic_limit: 80, manual_limit: 20 }
}

// Budget EN VIVO agrupado por proveedor: usa la fila más reciente de
// api_budget (la del día, si existe) y completa el total con los límites por
// defecto cuando falta (check_budget hace lo mismo). Devuelve, por proveedor:
//   provider, date, automatic { limit, used, remaining }, manual { ... },
//   total { used, limit, remaining }, reset_at
export function computeBudgetSummary(rows = []) {
  const byProvider = {}
  for (const r of rows) {
    if (!r || !r.provider) continue
    const prev = byProvider[r.provider]
    if (!prev || String(r.date) > String(prev.date)) byProvider[r.provider] = r
  }
  const providers = [...new Set(rows.map((r) => r && r.provider).filter(Boolean))].sort()
  return providers.map((provider) => {
    const row = byProvider[provider]
    const limits = defaultBudgetLimits(provider)
    const autoLimit = row && Number.isFinite(row.automatic_limit) ? row.automatic_limit : limits.automatic_limit
    const manualLimit = row && Number.isFinite(row.manual_limit) ? row.manual_limit : limits.manual_limit
    const autoUsed = row && Number.isFinite(row.automatic_used) ? row.automatic_used : 0
    const manualUsed = row && Number.isFinite(row.manual_used) ? row.manual_used : 0
    return {
      provider,
      date: row ? row.date : null,
      reset_at: row ? row.reset_at : null,
      automatic: { limit: autoLimit, used: autoUsed, remaining: Math.max(0, autoLimit - autoUsed) },
      manual: { limit: manualLimit, used: manualUsed, remaining: Math.max(0, manualLimit - manualUsed) },
      total: {
        limit: autoLimit + manualLimit,
        used: autoUsed + manualUsed,
        remaining: Math.max(0, autoLimit - autoUsed + manualLimit - manualUsed),
      },
    }
  })
}

// Resumen de los últimos sync_runs: total por estado + la fila más reciente.
export function summarizeSyncRuns(runs = [], max = 10) {
  const list = (runs || [])
    .filter((r) => r)
    .sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')))
  const byStatus = {}
  for (const r of list) {
    const s = r.status || 'unknown'
    byStatus[s] = (byStatus[s] || 0) + 1
  }
  return {
    total: list.length,
    byStatus,
    recent: list.slice(0, max),
  }
}