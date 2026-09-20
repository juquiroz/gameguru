import { useState, useEffect, useCallback } from 'react'
import { platformApi } from '../supabase'
import {
  orderCooldownWindows,
  formatCooldown,
  computeBudgetSummary,
  summarizeSyncRuns,
  CRON_REFERENCE,
} from '../domains/platform'
import { navigate, platformRoute } from '../router/routes'
import styles from './PlatformApi.module.css'

// BUILD-SUP-005 — Reglas de uso del API (read-only).
// Muestra la configuración actual de sincronización: cooldowns por ventana
// (en vivo desde sync_cooldown_config), budget diario por proveedor (en vivo
// desde api_budget), la programación del cron (constante documentada, cron.job
// no está expuesto a REST) y los últimos sync_runs. Toda la lógica de
// agregación vive en el dominio (models/apiConfig.js).
const RUN_STATUS_LABEL = {
  running: '⏳ En curso',
  completed: '✅ Completado',
  failed: '❌ Falló',
  skipped: '⏭️ Saltado',
}

export default function PlatformApi() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    const { data, error } = await platformApi.apiConfig()
    if (error) setError(error)
    else setRows(data)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (error) {
    return (
      <div className="page">
        <div className="page-title">Reglas del API</div>
        <div className="msg error">Error al cargar la configuración del API: {error.message}</div>
        <button className="btn-ghost" onClick={() => navigate(platformRoute())}>← Consola</button>
      </div>
    )
  }

  if (!rows) {
    return (
      <div className="page">
        <div className="page-title">Reglas del API</div>
        <div className="empty-state"><div className="big">⏳</div>Cargando configuración del API...</div>
      </div>
    )
  }

  const cooldowns = orderCooldownWindows(rows.cooldowns)
  const budgets = computeBudgetSummary(rows.budget)
  const runs = summarizeSyncRuns(rows.runs, 10)

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <div className="page-title">Reglas del API</div>
          <div className="page-sub">Configuración de resultados automáticos (solo lectura)</div>
        </div>
        <div className={styles.headerActions}>
          <button className="btn-secondary" onClick={load} disabled={refreshing}>
            {refreshing ? 'Cargando...' : '⟳ Actualizar'}
          </button>
          <button className="btn-ghost" onClick={() => navigate(platformRoute())}>← Consola</button>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>⏱️ Cooldowns por ventana ({cooldowns.length})</div>
          {cooldowns.length === 0 ? (
            <div className={styles.cardEmpty}>Sin ventanas configuradas.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Ventana</th><th>Cooldown</th><th>Descripción</th></tr>
                </thead>
                <tbody>
                  {cooldowns.map((c) => (
                    <tr key={c.sync_window}>
                      <td className={styles.mono}>{c.sync_window}</td>
                      <td className={styles.cooldown}>{formatCooldown(c.cooldown_minutes)}</td>
                      <td>{c.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>📊 Budget diario por proveedor</div>
          {budgets.length === 0 ? (
            <div className={styles.cardEmpty}>Sin registros de budget (se crean con el primer sync del día).</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Provider</th><th>Día</th><th>Auto (usado/lím)</th><th>Manual (usado/lím)</th><th>Total usado</th><th>Restantes</th></tr>
                </thead>
                <tbody>
                  {budgets.map((b) => (
                    <tr key={b.provider}>
                      <td className={styles.mono}>{b.provider}</td>
                      <td>{b.date || 'hoy (sin fila)'}</td>
                      <td>{b.automatic.used}/{b.automatic.limit}</td>
                      <td>{b.manual.used}/{b.manual.limit}</td>
                      <td>{b.total.used}</td>
                      <td className={styles.remaining}>{b.total.remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>🕒 Programación del cron</div>
          <div className={styles.kv}><span>Job</span><b className={styles.mono}>{CRON_REFERENCE.jobname}</b></div>
          <div className={styles.kv}><span>Schedule</span><b className={styles.mono}>{CRON_REFERENCE.schedule}</b></div>
          <div className={styles.kv}><span>Descripción</span><b>{CRON_REFERENCE.description}</b></div>
          <div className={styles.hint}>Referencia documentada: cron.job no se expone por REST, los valores en vivo salen de cooldowns y budget.</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>🔄 Últimos sync runs ({runs.total})</div>
          {runs.total === 0 ? (
            <div className={styles.cardEmpty}>Sin ejecuciones registradas.</div>
          ) : (
            <>
              <div className={styles.chips}>
                {Object.entries(runs.byStatus).map(([status, count]) => (
                  <span key={status} className={styles.chip}>{RUN_STATUS_LABEL[status] || status}: {count}</span>
                ))}
              </div>
              <div className={styles.runs}>
                {runs.recent.map((r) => (
                  <div key={r.id} className={styles.run}>
                    <span className={styles.runWhen}>
                      {r.started_at ? new Date(r.started_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </span>
                    <span className={styles.runMeta}>{r.provider} · {r.trigger_type} · {r.status}</span>
                    <span className={styles.runCounts}>
                      {r.records_created > 0 ? `creados ${r.records_created}` : ''}
                      {r.records_updated > 0 ? ` · upd ${r.records_updated}` : ''}
                      {r.error_count > 0 ? ` · err ${r.error_count}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}