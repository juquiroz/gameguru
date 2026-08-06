import { useState } from 'react'
import { useLanguage } from '../../../i18n/context'
import { useTrainingSession } from '../hooks/useTrainingSession'
import { getTrainingLevel } from '../models/levels'
import TrainingCampHeader from './TrainingCampHeader'
import TrainingCampStatus from './TrainingCampStatus'
import TrainingCampCountdown from './TrainingCampCountdown'
import TrainingCampParticipants from './TrainingCampParticipants'
import styles from '../training.module.css'

const PREMISE = [
  { icon: '🏈', key: 'howPick' },
  { icon: '📊', key: 'howResults' },
  { icon: '🏆', key: 'howBoard' },
  { icon: '👁️', key: 'howPublic' },
]

export default function TrainingCampLobby({ user, league, onConfigure }) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)

  const tc = useTrainingSession({ leagueId: league?.id, userId: user?.id, league })
  const {
    event, persisted, phase, remainingMs, participants, loading, isAdmin,
    now, openLobby, startNow, cancelEvent, steps, currentStep, lastCompletedStep, sessionNo,
  } = tc

  const level = getTrainingLevel(event?.level)
  const levelLabel = t(`training.level${level.id.charAt(0).toUpperCase()}${level.id.slice(1)}`)
  const preEvent = phase === 'created' || phase === 'waiting' || phase === 'countdown' || phase === 'ready'

  const copyInvite = () => {
    const link = `${window.location.origin}/gameguru/?join=${league.code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCancel = () => {
    if (!window.confirm(t('training.cancelConfirm'))) return
    cancelEvent()
  }

  if (loading) {
    return <div className={styles.loading}>{t('app.loading')}</div>
  }

  return (
    <div className={styles.page}>
      <TrainingCampHeader event={event} phase={phase} levelLabel={levelLabel} sessionNo={sessionNo} />

      <TrainingCampStatus
        state={event?.state}
        phase={phase}
        steps={steps}
        currentStep={currentStep}
        lastCompletedStep={lastCompletedStep}
      />

      <TrainingCampCountdown phase={phase} remainingMs={remainingMs} startAt={event?.start_at} sessionNo={sessionNo} />

      {preEvent && (
        <div className={styles.invite}>
          <div className={styles.inviteLabel}>{t('training.inviteCode')}</div>
          <div className={styles.inviteCode}>{league.code}</div>
          <button className={styles.inviteCopy} onClick={copyInvite}>
            {copied ? t('training.copied') : t('training.copyLink')}
          </button>
        </div>
      )}

      <TrainingCampParticipants participants={participants} isAdmin={isAdmin} userId={user?.id} />

      {preEvent && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('training.howTitle')}</div>
          <div className={styles.premiseGrid}>
            {PREMISE.map(p => (
              <div key={p.key} className={styles.premise}>
                <span className={styles.premiseIcon}>{p.icon}</span>
                <span className={styles.premiseLabel}>{t(`training.${p.key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && !event && (
        <div className={styles.actions}>
          <button className={styles.btnTc} onClick={onConfigure}>{t('training.configTitle')}</button>
        </div>
      )}

      {isAdmin && event && phase !== 'cancelled' && (
        <div className={styles.actions}>
          {phase === 'created' && (
            <button className={styles.btnTc} onClick={openLobby}>{t('training.openLobby')}</button>
          )}
          {(phase === 'waiting' || phase === 'countdown') && (
            <button className={styles.btnTc} onClick={startNow}>
              {t('training.startNow')}
            </button>
          )}
          {phase === 'countdown' && <span className={styles.readySub}>{t('training.startNowSub')}</span>}
          <button className={styles.btnTcDanger} onClick={handleCancel}>{t('training.cancelEvent')}</button>
        </div>
      )}

      {isAdmin && phase === 'ready' && (
        <div className={`${styles.note} ${styles.noteLocal}`}>
          <span>⚙️</span>
          <span>{t('training.engineNote')}</span>
        </div>
      )}

      {persisted === 'local' && (
        <div className={`${styles.note} ${styles.noteLocal}`}>
          <span>💾</span>
          <span>{t('training.localPersist')}</span>
        </div>
      )}
    </div>
  )
}
