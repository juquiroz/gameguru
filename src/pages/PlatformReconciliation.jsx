import { useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../hooks/useAuth'
import { platformRoleFromJwt, isPlatformSuperAdmin } from '../domains/platform'
import styles from './PlatformReconciliation.module.css'

const DEFAULT_SCOPE = {
  provider: 'api-sports',
  season: '2026',
  phase: 'preseason',
  date: '2026-08-24',
}

export default function PlatformReconciliation() {
  const { user } = useAuth()
  const [scope, setScope] = useState(DEFAULT_SCOPE)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
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

  const handleDryRun = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('reconcile', {
        body: {
          operation: 'dry_run',
          provider: scope.provider,
          season: scope.season,
          phase: scope.phase,
          date: scope.date,
        },
      })

      if (fnError) {
        if (fnError.context?.json?.error === 'Invalid or expired token') {
          throw new Error('Sesión expirada. Vuelve a iniciar sesión.')
        }
        if (fnError.context?.status === 403) {
          throw new Error('No tienes permisos para ejecutar Provider Reconciliation.')
        }
        throw new Error(fnError.message || 'Error al invocar reconcile')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      setResult(data)
    } catch (err) {
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Provider Reconciliation</h1>
        <div className={styles.subtitle}>
          Sincronización de partidos con proveedores externos (API-Sports)
        </div>
      </div>

      <div className={styles.warning}>
        <div className={styles.warningIcon}>⚠️</div>
        <div className={styles.warningText}>
          <strong>DRY RUN</strong> — No se modificarán partidos. Solo se evaluarán candidatos.
        </div>
      </div>

      <div className={styles.scopeSection}>
        <h3 className={styles.sectionTitle}>Scope de Ejecución</h3>
        <div className={styles.scopeGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Provider</label>
            <select
              className={styles.select}
              value={scope.provider}
              onChange={(e) => handleScopeChange('provider', e.target.value)}
              disabled={loading}
            >
              <option value="api-sports">API-Sports (NFL)</option>
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
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Phase</label>
            <select
              className={styles.select}
              value={scope.phase}
              onChange={(e) => handleScopeChange('phase', e.target.value)}
              disabled={loading}
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
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.button}
          onClick={handleDryRun}
          disabled={loading}
        >
          {loading ? 'Ejecutando...' : 'Ejecutar Dry Run'}
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
          <h3 className={styles.sectionTitle}>Resultados del Dry Run</h3>
          
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
              <div className={styles.statValue}>{result.statistics?.skipped_already_mapped || 0}</div>
              <div className={styles.statLabel}>Already Mapped</div>
            </div>
          </div>

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

          <div className={styles.noMutation}>
            <div className={styles.noMutationIcon}>✅</div>
            <div className={styles.noMutationText}>
              <strong>No changes applied.</strong> Este dry run no modificó datos.
            </div>
          </div>

          {result.duration_ms && (
            <div className={styles.duration}>
              Duración: {result.duration_ms}ms
            </div>
          )}
        </div>
      )}
    </div>
  )
}
