import { useState, useEffect } from 'react'
import styles from './SyncStatus.module.css'

const SYNC_COOLDOWN_MS = 60 * 1000

const mockSync = async () => {
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000))
  if (Math.random() > 0.85) {
    throw new Error('Timeout al conectar con el proveedor')
  }
  return {
    status: 'completed',
    records_fetched: Math.floor(Math.random() * 16) + 1,
    records_updated: Math.floor(Math.random() * 4),
    records_unchanged: Math.floor(Math.random() * 12),
  }
}

const formatLastSync = (date) => {
  if (!date) return 'Nunca'
  const diff = Date.now() - date.getTime()
  if (diff < 60 * 1000) return 'Hace menos de 1 minuto'
  if (diff < 60 * 60 * 1000) return `Hace ${Math.floor(diff / 60000)} min`
  if (diff < 24 * 60 * 60 * 1000) return `Hace ${Math.floor(diff / 3600000)} h`
  return date.toLocaleDateString()
}

export default function SyncStatus({ league }) {
  const [autoUpdate, setAutoUpdate] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [error, setError] = useState(null)
  const [canSyncNow, setCanSyncNow] = useState(true)

  useEffect(() => {
    if (!canSyncNow) {
      const timer = setTimeout(() => setCanSyncNow(true), SYNC_COOLDOWN_MS)
      return () => clearTimeout(timer)
    }
  }, [canSyncNow])

  const handleToggle = () => {
    setAutoUpdate(prev => !prev)
  }

  const handleSyncNow = async () => {
    if (syncing || !canSyncNow) return
    setSyncing(true)
    setError(null)
    setLastResult(null)
    try {
      const result = await mockSync()
      setLastSync(new Date())
      setLastResult(result)
      setCanSyncNow(false)
    } catch (err) {
      setError(err.message || 'Error al sincronizar')
    } finally {
      setSyncing(false)
    }
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

          {lastResult && (
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Último sync:</span>
              <span className={styles.statusValue}>
                {lastResult.records_fetched} partidos · {lastResult.records_updated} actualizados · {lastResult.records_unchanged} sin cambios
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
