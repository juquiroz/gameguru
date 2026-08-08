import { useState } from 'react'
import { useLanguage } from '../../../i18n/context'
import { useTrainingSession } from '../hooks/useTrainingSession'
import { getTrainingLevel } from '../models/levels'
import { EVENT_TYPES } from '../../event'
import TrainingCampHeader from './TrainingCampHeader'
import TrainingCampStatus from './TrainingCampStatus'
import TrainingCampCountdown from './TrainingCampCountdown'
import TrainingCampProgress from './TrainingCampProgress'
import TrainingCampParticipants from './TrainingCampParticipants'
import { GameWeekProvider, GameWeekView } from '../../game-week'
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
    event, persisted, eventType, phase, remainingMs, participants, loading, isAdmin,
    now, openLobby, startNow, cancelEvent, steps, currentStep, lastCompletedStep, sessionNo, fixtureProgress,
  } = tc

  const isFixture = eventType === EVENT_TYPES.FIXTURE_GENERATION
  const isGameWeek = eventType === EVENT_TYPES.GAME_WEEK

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

  // BUILD-TC-005 — El evento Game Week es la tercera fase del ciclo; la
  // pantalla es la jornada de picks (GameWeekView), que consume el
  // GameWeekContext. El context avanza la sesión vía onTransition (applyPatch
  // del hook), único escritor de la sesión.
  if (isGameWeek) {
    return (
      <GameWeekProvider event={event} league={league} user={user} onTransition={tc.applyPatch}>
        <GameWeekView />
      </GameWeekProvider>
    )
  }

  // Estado vacío explícito (BUILD-TC-004.2): sin sesión no se renderiza el
  // ciclo del evento (Status/Countdown/Progress), no se lanzan excepciones y
  // el admin puede crear el primer evento. El código de invitación sigue útil.
  if (!event) {
    return (
      <div className={styles.page}>
        <TrainingCampHeader event={null} phase="created" levelLabel={levelLabel} sessionNo={null} eventType={eventType} />

        <div className={`${styles.section} ${styles.sectionEmpty}`}>
          <div className={styles.sectionTitle}>{t('training.emptyTitle')}</div>
          <div className={styles.emptyState}>
            <p>{t('training.emptyDesc')}</p>
            {isAdmin ? (
              <button className={styles.btnTc} onClick={onConfigure}>{t('training.emptyCta')}</button>
            ) : (
              <p className={styles.emptyHint}>{t('training.emptyWaitAdmin')}</p>
            )}
          </div>
        </div>

        {league?.code && (
          <div className={styles.invite}>
            <div className={styles.inviteLabel}>{t('training.inviteCode')}</div>
            <div className={styles.inviteCode}>{league.code}</div>
            <button className={styles.inviteCopy} onClick={copyInvite}>
              {copied ? t('training.copied') : t('training.copyLink')}
            </button>
          </div>
        )}

        <TrainingCampParticipants participants={participants} isAdmin={isAdmin} userId={user?.id} />

        {persisted === 'local' && (
          <div className={`${styles.note} ${styles.noteLocal}`}>
            <span>💾</span>
            <span>{t('training.localPersist')}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <TrainingCampHeader event={event} phase={phase} levelLabel={levelLabel} sessionNo={sessionNo} eventType={eventType} />

      <TrainingCampStatus
        state={event?.state}
        phase={phase}
        steps={steps}
        currentStep={currentStep}
        lastCompletedStep={lastCompletedStep}
        eventType={eventType}
      />

      {isFixture ? (
        <TrainingCampProgress phase={phase} fixtureProgress={fixtureProgress} currentStep={currentStep} />
      ) : (
        <TrainingCampCountdown phase={phase} remainingMs={remainingMs} startAt={event?.start_at} sessionNo={sessionNo} />
      )}

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
          {!isFixture && phase === 'created' && (
            <button className={styles.btnTc} onClick={openLobby}>{t('training.openLobby')}</button>
          )}
          {!isFixture && (phase === 'waiting' || phase === 'countdown') && (
            <button className={styles.btnTc} onClick={startNow}>
              {t('training.startNow')}
            </button>
          )}
          {!isFixture && phase === 'countdown' && <span className={styles.readySub}>{t('training.startNowSub')}</span>}
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
