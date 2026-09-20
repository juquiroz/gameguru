import { useEffect, useState } from 'react'
import { trainingCampSnapshotService } from '../services/snapshotService'
import { useLanguage } from '../../../i18n/context'
import TeamLogo from '../../../components/TeamLogo'
import styles from '../training-camp.module.css'

// BUILD-TC-V2: Página PÚBLICA de auditoría del Training Camp. Renderiza un
// snapshot congelado de picks por hash (URL corta compartible, sin login).
export default function AuditSnapshotPage({ hash }) {
  const { t } = useLanguage()
  const [snap, setSnap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const data = await trainingCampSnapshotService.getByHash(hash)
      if (!alive) return
      if (!data) setError('Snapshot no encontrado')
      else setSnap(data)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [hash])

  if (loading) return <div className={styles.spinner}>{t('app.loading')}</div>
  if (error) return <div className={styles.page}><div className={styles.empty}>🔒 {error}</div></div>

  const games = Array.isArray(snap.games_json) ? snap.games_json : []
  const players = Array.isArray(snap.picks_json) ? snap.picks_json : []

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>🔍 Auditoría · Semana {snap.week}</div>
        <div className={styles.eyebrow}>
          Congelado {new Date(snap.frozen_at).toLocaleString()} · Hash {snap.snapshot_hash?.slice(0, 8)}…
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Partidos de la semana</div>
        <div className={styles.grid}>
          {games.map((g, i) => (
            <div key={i} className={styles.gameCard}>
              <div className={styles.gameMatchup}>
                <span style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
                  <TeamLogo abbr={g.away} size={18} /> {g.away}
                </span>
                <span style={{ color: 'var(--text2)' }}>@</span>
                <span style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
                  <TeamLogo abbr={g.home} size={18} /> {g.home}
                </span>
              </div>
              <div className={styles.gameTop}>{g.time ? new Date(g.time).toLocaleString() : '—'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Picks públicos (quién eligió qué)</div>
        {players.length === 0 && <div className={styles.empty}>Sin picks confirmados al cierre.</div>}
        {players.map((p, i) => (
          <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '.5rem 0' }}>
            <div style={{ fontWeight: 700 }}>{p.player}</div>
            <div style={{ fontSize: '.85rem', color: 'var(--text2)' }}>
              {Object.entries(p.picks || {}).map(([gameId, abbr]) => {
                const g = games.find(x => x.id === gameId)
                return <span key={gameId} style={{ display: 'inline-block', marginRight: '.75rem' }}>
                  {g ? `${g.away} @ ${g.home}: ` : `${gameId}: `}<b>{abbr}</b>
                </span>
              })}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.note + ' ' + styles.noteInfo}>
        Este snapshot es inmutable y se generó al iniciar el primer juego. Sirve para auditar
        que los picks se hicieron antes del cierre.
      </div>
    </div>
  )
}
