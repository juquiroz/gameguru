import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { platformRoleFromJwt, isPlatformAdmin } from '../domains/platform'
import styles from './SyncStatus.module.css'

const SYNC_COOLDOWN_MS = 60 * 1000

const formatLastSync = (date) => {
  if (!date) return 'Nunca'
  const diff = Date.now() - date.getTime()
  if (diff < 60 * 1000) return 'Hace menos de 1 minuto'
  if (diff < 60 * 60 * 1000) return `Hace ${Math.floor(diff / 60000)} min`
  if (diff < 24 * 60 * 60 * 1000) return `Hace ${Math.floor(diff / 3600000)} h`
  return date.toLocaleDateString()
}

export default function SyncStatus({ league, onSyncComplete, user }) {
  const [autoUpdate, setAutoUpdate] = useState(league?.auto_update_results || false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [error, setError] = useState(null)
  const [canSyncNow, setCanSyncNow] = useState(true)
  const [budget, setBudget] = useState(null)

  const isPlatformAdminUser = user && isPlatformAdmin(platformRoleFromJwt(user))

  useEffect(() => {
    loadLastSync()
    if (isPlatformAdminUser) {
      loadBudget()
    }
  }, [league?.id, isPlatformAdminUser])

  useEffect(() => {
    if (!canSyncNow) {
      const timer = setTimeout(() => setCanSyncNow(true), SYNC_COOLDOWN_MS)
      return () => clearTimeout(timer)
    }
  }, [canSyncNow])

  const loadLastSync = async () => {
    if (!league?.id) return
    const { data } = await supabase
      .from('sync_runs')
      .select('*')
      .in('status', ['completed', 'skipped'])
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data?.finished_at) {
      setLastSync(new Date(data.finished_at))
      if (data.status === 'completed') {
        setLastResult({
          records_fetched: data.records_fetched || 0,
          records_updated: data.records_updated || 0,
          records_unchanged: data.records_unchanged || 0,
        })
      } else if (data.status === 'skipped') {
        setLastResult({
          skipped: true,
          reason: data.skip_reason || 'unknown',
        })
      }
    }
  }

  const loadBudget = async () => {
    try {
      const { data, error } = await supabase.rpc('check_budget', {
        p_provider: 'api-sports',
        p_source: 'all',
      })

      if (!error && data) {
        setBudget(data)
      }
    } catch (err) {
      // Si la función RPC no existe aún, ignorar silenciosamente
      console.debug('[SyncStatus] Budget not available yet')
    }
  }

  const handleToggle = async () => {
    const newValue = !autoUpdate
    setAutoUpdate(newValue)
    
    const { error } = await supabase
      .from('leagues')
      .update({ auto_update_results: newValue })
      .eq('id', league.id)
    
    if (error) {
      setAutoUpdate(!newValue)
      setError('No se pudo actualizar la configuración')
    }
  }

  const handleSyncNow = async () => {
    if (syncing || !canSyncNow) return
    setSyncing(true)
    setError(null)
    setLastResult(null)
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('results-sync', {
        body: { league_id: league.id, manual: true },
      })

      if (fnError) throw new Error(fnError.message || 'Error al invocar sync')
      if (data?.error) throw new Error(data.error)

      const result = data?.results?.[0]
      if (!result) throw new Error('No se recibió resultado del sync')

      if (result.status === 'failed') {
        throw new Error(result.error || 'Sync falló')
      }

      setLastSync(new Date())
      
      if (result.status === 'skipped') {
        setLastResult({
          skipped: true,
          reason: result.reason || 'unknown',
        })
      } else {
        setLastResult({
          records_fetched: result.fetched || 0,
          records_updated: result.updated || 0,
          records_unchanged: result.unchanged || 0,
        })
      }
      
      setCanSyncNow(false)

      if (isPlatformAdminUser) {
        loadBudget()
      }

      if (onSyncComplete) onSyncComplete()
    } catch (err) {
      setError(err.message || 'Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const formatSkipReason = (reason) => {
    const reasons = {
      'no_games': 'No hay partidos para sincronizar',
      'cooldown_active': 'Cooldown activo — próxima sync más tarde',
      'outside_sync_window': 'Fuera de ventana de sync',
      'budget_exhausted': 'Budget diario agotado',
      'already_synced': 'Ya sincronizado recientemente',
      'reconciliation_complete': 'Reconciliación completada',
    }
    return reasons[reason] || reason
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Resultados</div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={autoUpdate}
            onChange={handleToggle}
            className={styles.toggleInput}
          />
          <span className={styles.toggleLabel}>
            Actualizar automáticamente
          </span>
        </label>
      </div>

      {autoUpdate && (
        <div className={styles.status}>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>Estado:</span>
            <span className={`${styles.statusValue} ${styles.statusActive}`}>
              <span className={styles.dot} />
              Actualización automática activa
            </span>
          </div>

          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>Última actualización:</span>
            <span className={styles.statusValue}>
              {formatLastSync(lastSync)}
            </span>
          </div>

          {lastResult && !lastResult.skipped && (
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Último sync:</span>
              <span className={styles.statusValue}>
                {lastResult.records_fetched} partidos · {lastResult.records_updated} actualizados · {lastResult.records_unchanged} sin cambios
              </span>
            </div>
          )}

          {lastResult?.skipped && (
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Último sync:</span>
              <span className={styles.statusValue}>
                Omitido — {formatSkipReason(lastResult.reason)}
              </span>
            </div>
          )}

          {error && (
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Error:</span>
              <span className={`${styles.statusValue} ${styles.statusError}`}>
                {error}
              </span>
            </div>
          )}

          {isPlatformAdminUser && budget && (
            <div className={styles.budgetSection}>
              <div className={styles.budgetTitle}>API Budget (hoy)</div>
              <div className={styles.budgetRow}>
                <span className={styles.budgetLabel}>Automático:</span>
                <span className={styles.budgetValue}>
                  {budget.automatic_used} / {budget.automatic_limit}
                </span>
              </div>
              <div className={styles.budgetRow}>
                <span className={styles.budgetLabel}>Manual:</span>
                <span className={styles.budgetValue}>
                  {budget.manual_used} / {budget.manual_limit}
                </span>
              </div>
              <div className={styles.budgetRow}>
                <span className={styles.budgetLabel}>Total:</span>
                <span className={styles.budgetValue}>
                  {budget.total_used} / {budget.total_limit}
                  <span className={styles.budgetPercent}>
                    {' '}({Math.round((budget.total_used / budget.total_limit) * 100)}%)
                  </span>
                </span>
              </div>
            </div>
          )}

          <button
            className={styles.syncButton}
            onClick={handleSyncNow}
            disabled={syncing || !canSyncNow}
          >
            {syncing ? 'Sincronizando...' : 'Actualizar ahora'}
          </button>
        </div>
      )}
    </div>
  )
}
