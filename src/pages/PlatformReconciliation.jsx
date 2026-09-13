import { useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../hooks/useAuth'
import { platformRoleFromJwt, isPlatformSuperAdmin } from '../domains/platform'
import styles from './PlatformReconciliation.module.css'

const DEFAULT_SCOPE = {
  provider: 'espn',
  season: '2026',
  phase: 'regular',
  date: '',
}

const EMPTY_STATS = {
  total_candidates: 0,
  high_confidence_matches: 0,
  medium_confidence_matches: 0,
  low_confidence_matches: 0,
  ambiguous: 0,
  unmatched: 0,
  conflicts: 0,
  manual_overrides: 0,
  skipped_already_mapped: 0,
  mapped: 0,
  skipped: 0,
  propagation_updates: 0,
}

export default function PlatformReconciliation() {
  const { user } = useAuth()
  const [scope, setScope] = useState(DEFAULT_SCOPE)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState(null)
  const [resultKind, setResultKind] = useState(null)
  const [error, setError] = useState(null)

  const platformRole = platformRoleFromJwt(user)
  const isSuperAdmin = isPlatformSuperAdmin(platformRole)

  if (!isSuperAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.denied}>
          <div className={styles.deniedIcon}>🔒</div>
          <h2>Acceso Restringido</h2>
          <p>Solo platform_superadmin puede ejecutar Provider Reconciliation.</p>
        </div>
      </div>
    )
  }

  const invokeReconcile = async (operation, date) => {
    const { data, error: fnError } = await supabase.functions.invoke('reconcile', {
      body: {
        operation,
        provider: scope.provider,
        season: scope.season,
        phase: scope.phase,
        date,
      },
    })

    if (fnError) {
      const status = fnError.context?.status
      const body = fnError.context?.json
      if (status === 401 || body?.code?.startsWith('PGRST301') || body?.msg?.includes('JWT')) {
        throw new Error('Sesión expirada. Vuelve a iniciar sesión y reintenta.')
      }
      if (body?.error === 'Invalid or expired token') {
        throw new Error('Sesión expirada. Vuelve a iniciar sesión.')
      }
      if (status === 403) {
        throw new Error('No tienes permisos para ejecutar Provider Reconciliation.')
      }
      const detail = body?.error || body?.message
      if (detail) throw new Error(detail)
      throw new Error(`Error al invocar reconcile [${status ?? '?'}]: ${JSON.stringify(body ?? fnError)?.slice(0, 500)}`)
    }

    if (data?.error) {
      throw new Error(data.error)
    }

    return data
  }

  const loadGameDates = async () => {
    const { data, error: queryError } = await supabase
      .from('master_games')
      .select('game_time')
      .eq('sport', 'NFL')
      .eq('season', scope.season)
      .eq('phase', scope.phase)
      .not('game_time', 'is', null)

    if (queryError) {
      throw new Error(`No se pudieron leer las fechas del calendario: ${queryError.message}`)
    }

    const dates = [...new Set((data || []).map(g => String(g.game_time).slice(0, 10)))]
    return dates.filter(Boolean).sort()
  }

  const handleDryRun = async () => {
    if (!scope.date) {
      setError('Selecciona una fecha para el dry run.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    setResultKind(null)

    try {
      const data = await invokeReconcile('dry_run', scope.date)
      setResult(data)
      setResultKind('dry_run')
    } catch (err) {
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    const confirmed = window.confirm(
      'Esto MAPEARÁ los partidos del calendario maestro a ESPN y actualizará ' +
      'league_games para TODA la temporada. Esta acción no se puede deshacer desde la UI.\n\n' +
      '¿Continuar?'
    )
    if (!confirmed) return

    setApplying(true)
    setError(null)
    setResult(null)
    setResultKind(null)

    try {
      const dates = await loadGameDates()
      if (dates.length === 0) {
        throw new Error('No hay fechas en el calendario maestro para este scope.')
      }

      const totals = { ...EMPTY_STATS }
      const failures = []
      const byDate = []

      for (const date of dates) {
        try {
          const data = await invokeReconcile('apply', date)
          const stats = data?.statistics || {}
          for (const key of Object.keys(totals)) {
            totals[key] += stats[key] || 0
          }
          byDate.push({ date, ok: true, ...stats })
        } catch (err) {
          failures.push({ date, message: err.message })
          byDate.push({ date, ok: false, message: err.message })
        }
      }

      setResult({
        statistics: totals,
        byDate,
        failures,
      })
      setResultKind('apply')
    } catch (err) {
      setError(err.message || 'Error inesperado')
    } finally {
      setApplying(false)
    }
  }

  const handleScopeChange = (field, value) => {
    setScope(prev => ({ ...prev, [field]: value }))
  }

  const getMatchStatusBadge = (status, confidence) => {
    if (status === 'mapped' && confidence === 'high') {
      return <span className={`${styles.badge} ${styles.badgeSuccess}`}>READY TO APPLY</span>
    }
    if (status === 'ambiguous') {
      return <span className={`${styles.badge} ${styles.badgeWarning}`}>MANUAL REVIEW</span>
    }
    if (status === 'unmatched') {
      return <span className={`${styles.badge} ${styles.badgeError}`}>UNMATCHED</span>
    }
    if (status === 'mapped') {
      return <span className={`${styles.badge} ${styles.badgeInfo}`}>MAPPED ({confidence})</span>
    }
    return <span className={`${styles.badge} ${styles.badgeDefault}`}>{status}</span>
  }

  const busy = loading || applying

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Provider Reconciliation</h1>
        <div className={styles.subtitle}>
          Sincronización de partidos con proveedores externos (ESPN)
        </div>
      </div>

      {resultKind !== 'apply' && (
        <div className={styles.warning}>
          <div className={styles.warningIcon}>⚠️</div>
          <div className={styles.warningText}>
            <strong>DRY RUN</strong> — No se modificarán partidos. Solo se evaluarán candidatos.
          </div>
        </div>
      )}

      <div className={styles.scopeSection}>
        <h3 className={styles.sectionTitle}>Scope de Ejecución</h3>
        <div className={styles.scopeGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Provider</label>
            <select
              className={styles.select}
              value={scope.provider}
              onChange={(e) => handleScopeChange('provider', e.target.value)}
              disabled={busy}
            >
              <option value="espn">ESPN (NFL)</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Season</label>
            <input
              type="text"
              className={styles.input}
              value={scope.season}
              onChange={(e) => handleScopeChange('season', e.target.value)}
              placeholder="2026"
              disabled={busy}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Phase</label>
            <select
              className={styles.select}
              value={scope.phase}
              onChange={(e) => handleScopeChange('phase', e.target.value)}
              disabled={busy}
            >
              <option value="preseason">Preseason</option>
              <option value="regular">Regular</option>
              <option value="postseason">Postseason</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Date</label>
            <input
              type="date"
              className={styles.input}
              value={scope.date}
              onChange={(e) => handleScopeChange('date', e.target.value)}
              disabled={busy}
            />
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.button}
          onClick={handleDryRun}
          disabled={busy}
        >
          {loading ? 'Ejecutando...' : 'Ejecutar Dry Run'}
        </button>

        <button
          className={`${styles.button} ${styles.buttonApply}`}
          onClick={handleApply}
          disabled={busy}
        >
          {applying ? 'Aplicando mapeo...' : 'Aplicar mapeo de temporada'}
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          <div className={styles.errorIcon}>❌</div>
          <div className={styles.errorText}>{error}</div>
        </div>
      )}

      {result && (
        <div className={styles.results}>
          <h3 className={styles.sectionTitle}>
            {resultKind === 'apply' ? 'Resultados del Aplicar' : 'Resultados del Dry Run'}
          </h3>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{result.statistics?.total_candidates || 0}</div>
              <div className={styles.statLabel}>Total Evaluados</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statValue}>{result.statistics?.high_confidence_matches || 0}</div>
              <div className={styles.statLabel}>High Confidence</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statValue}>{result.statistics?.medium_confidence_matches || 0}</div>
              <div className={styles.statLabel}>Medium Confidence</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statValue}>{result.statistics?.low_confidence_matches || 0}</div>
              <div className={styles.statLabel}>Low Confidence</div>
            </div>

            {resultKind === 'apply' && (
              <div className={styles.statCard}>
                <div className={styles.statValue}>{result.statistics?.mapped || 0}</div>
                <div className={styles.statLabel}>Mapeados</div>
              </div>
            )}

            <div className={styles.statCard}>
              <div className={styles.statValue}>{result.statistics?.ambiguous || 0}</div>
              <div className={styles.statLabel}>Ambiguous</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statValue}>{result.statistics?.unmatched || 0}</div>
              <div className={styles.statLabel}>Unmatched</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statValue}>{result.statistics?.conflicts || 0}</div>
              <div className={styles.statLabel}>Conflicts</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statValue}>{result.statistics?.manual_overrides || 0}</div>
              <div className={styles.statLabel}>Manual Overrides</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statValue}>
                {resultKind === 'apply'
                  ? (result.statistics?.skipped || 0)
                  : (result.statistics?.skipped_already_mapped || 0)}
              </div>
              <div className={styles.statLabel}>Skipped</div>
            </div>

            {resultKind === 'apply' && (
              <div className={styles.statCard}>
                <div className={styles.statValue}>{result.statistics?.propagation_updates || 0}</div>
                <div className={styles.statLabel}>league_games actualizados</div>
              </div>
            )}
          </div>

          {resultKind === 'apply' && result.byDate && result.byDate.length > 0 && (
            <div className={styles.detailsSection}>
              <h4 className={styles.detailsTitle}>Resumen por fecha</h4>
              <div className={styles.detailsTable}>
                <div className={styles.tableHeader}>
                  <span>Fecha</span>
                  <span>Resultado</span>
                  <span>Mapeados</span>
                  <span>Conflicts</span>
                  <span>league_games</span>
                </div>
                {result.byDate.map((row, idx) => (
                  <div key={idx} className={styles.tableRow}>
                    <span>{row.date}</span>
                    <span>{row.ok ? <span className={styles.badgeSuccess + ' ' + styles.badge}>OK</span> : <span className={styles.badgeError + ' ' + styles.badge}>ERROR</span>}</span>
                    <span>{row.mapped || 0}</span>
                    <span>{row.conflicts || 0}</span>
                    <span>{row.propagation_updates || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultKind === 'apply' && result.failures && result.failures.length > 0 && (
            <div className={styles.error}>
              <div className={styles.errorIcon}>❌</div>
              <div className={styles.errorText}>
                {result.failures.length} fecha(s) con error:{' '}
                {result.failures.map(f => `${f.date} (${f.message})`).join('; ')}
              </div>
            </div>
          )}

          {result.details && result.details.length > 0 && (
            <div className={styles.detailsSection}>
              <h4 className={styles.detailsTitle}>Detalles de Matching</h4>
              <div className={styles.detailsTable}>
                <div className={styles.tableHeader}>
                  <span>Home</span>
                  <span>Away</span>
                  <span>Week</span>
                  <span>Phase</span>
                  <span>Game Time</span>
                  <span>External ID</span>
                  <span>Status</span>
                  <span>Reason</span>
                </div>
                {result.details.map((detail, idx) => (
                  <div key={idx} className={styles.tableRow}>
                    <span>{detail.home_team}</span>
                    <span>{detail.away_team}</span>
                    <span>{detail.week}</span>
                    <span>{detail.phase}</span>
                    <span className={styles.gameTime}>
                      {detail.game_time ? new Date(detail.game_time).toLocaleString() : '-'}
                    </span>
                    <span className={styles.externalId}>
                      {detail.master_game_id || detail.provider_game_id || '-'}
                    </span>
                    <span>{getMatchStatusBadge(detail.match_status, detail.match_confidence)}</span>
                    <span className={styles.reason}>{detail.match_reason || detail.resolution_reason || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultKind === 'dry_run' && (
            <div className={styles.noMutation}>
              <div className={styles.noMutationIcon}>✅</div>
              <div className={styles.noMutationText}>
                <strong>No changes applied.</strong> Este dry run no modificó datos.
              </div>
            </div>
          )}

          {resultKind === 'apply' && (
            <div className={styles.noMutation}>
              <div className={styles.noMutationIcon}>✅</div>
              <div className={styles.noMutationText}>
                <strong>Apply completado.</strong> Los partidos mapeados quedaron con provider
                ESPN y sus resultados se propagarán automáticamente.
              </div>
            </div>
          )}

          {result.duration_ms && resultKind === 'dry_run' && (
            <div className={styles.duration}>
              Duración: {result.duration_ms}ms
            </div>
          )}
        </div>
      )}
    </div>
  )
}