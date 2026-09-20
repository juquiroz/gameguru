import { useLanguage } from '../../../i18n/context'
import TrainingCampSetupForm from './TrainingCampSetupForm'
import styles from '../training.module.css'

// Modal standalone de configuración del evento (BUILD-TC-001). Lo usa el Lobby
// para configurar un evento de una liga practice existente. La creación oficial
// entra por el wizard de experiencias (BUILD-TC-002).
export default function TrainingCampSetupModal({ mode, initialName, onCreate, onClose, onDone }) {
  const { t } = useLanguage()
  const isNew = mode === 'new'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', overflowY: 'auto',
    }}>
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border2)',
        borderRadius: 'var(--r-xl)',
        padding: '1.75rem 1.5rem',
        width: '100%', maxWidth: '460px',
      }}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{t(isNew ? 'training.createTitle' : 'training.configTitle')}</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <p className={styles.modalSub}>{t(isNew ? 'training.createSub' : 'training.configSub')}</p>

        <TrainingCampSetupForm
          initialName={isNew ? '' : initialName || ''}
          submitLabel={t(isNew ? 'training.create' : 'training.saveConfig')}
          busyLabel={t(isNew ? 'training.creating' : 'training.saving')}
          onSubmit={onCreate}
          onSuccess={onDone}
        />
      </div>
    </div>
  )
}
