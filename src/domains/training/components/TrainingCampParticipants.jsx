import { useLanguage } from '../../../i18n/context'
import { isPresenceAvailable } from '../models/presence'
import styles from '../training.module.css'

// Roster de participantes. BUILD-TC-001 no integra Realtime, así que el estado
// de conexión se muestra como desconocido (modelo preparado para BUILD-TC-006).
export default function TrainingCampParticipants({ participants, isAdmin, userId }) {
  const { t } = useLanguage()
  const count = participants?.length || 0
  const presenceOn = isPresenceAvailable()

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        {t('training.participants')} · {count}
      </div>
      <div className={styles.roster}>
        {count === 0 && (
          <div className={styles.rosterEmpty}>{t('training.noParticipants')}</div>
        )}
        {participants.map(p => {
          const me = p.user_id === userId
          const role = p.role === 'admin' ? t('training.adminTag') : null
          return (
            <div key={p.user_id} className={`${styles.rosterRow} ${me ? styles.me : ''}`}>
              <span className={styles.avatar}>{(p.username || '?').slice(0, 1).toUpperCase()}</span>
              <div className={styles.rosterInfo}>
                <div className={styles.rosterName}>
                  {p.username}
                  {me && <span style={{ color: 'var(--text3)', fontSize: '.72rem' }}> · {t('training.youTag')}</span>}
                </div>
                <div className={styles.rosterMeta}>
                  {role ? `${role} · ` : ''}{t('training.unknownPresence')}
                </div>
              </div>
              <span
                className={`${styles.onlineDot} ${p.online === true ? styles.on : p.online === false ? styles.off : ''}`}
                title={p.online === true ? t('training.online') : p.online === false ? t('training.offline') : t('training.unknownPresence')}
              />
            </div>
          )
        })}
      </div>
      {!presenceOn && (
        <div className={styles.presenceNote}>
          <span>🟡</span>
          <span>{t('training.presenceNote')}</span>
        </div>
      )}
    </div>
  )
}
