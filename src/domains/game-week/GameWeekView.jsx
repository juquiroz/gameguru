// ════════════════════════════════════════════════════════════════════
// GameWeekView — pantalla de la Game Week (BUILD-TC-005)
//
// Consume el GameWeekContext (único puente al dominio). No decide nada:
// solo traduce estado derivado a UI (listado de partidos, selección de
// picks, contador x/y, ventana abierta/cerrada con countdown, confirmación).
// ════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { useLanguage } from '../../i18n/context'
import { useGameWeek } from './GameWeekContext'
import { PICK_STATUS } from './PicksService'
import GameCard from '../../components/GameCard'
import LeagueIdentity from '../../components/LeagueIdentity'
import SimulationProgress from './SimulationProgress'
import GameWeekResults from './GameWeekResults'
import GameWeekLeaderboard from './GameWeekLeaderboard'
import styles from './game-week.module.css'

const fmtCountdown = (ms) => {
  if (ms == null) return ''
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const stateBadge = (ctx, t) => {
  if (ctx.isWaiting) return t('gameWeek.stateWaiting')
  if (ctx.isOpen) return t('gameWeek.statePicksOpen')
  if (ctx.isLocked) return t('gameWeek.statePicksLocked')
  // BUILD-TC-006.3: transición visible Picks Locked → Simulation Starting →
  // Simulation Running (progreso del run interno, sin pantalla vacía).
  if (ctx.isSimulating) {
    return ctx.simRun?.state === 'waiting'
      ? t('gameWeek.stateSimStarting')
      : t('gameWeek.stateSimRunning')
  }
  if (ctx.isCompleted) return t('gameWeek.stateCompleted')
  if (ctx.isCancelled) return t('gameWeek.stateCancelled')
  return t('gameWeek.statusLabel')
}

export default function GameWeekView() {
  const { t } = useLanguage()
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState(null)
  const gw = useGameWeek()

  const {
    week, weekPersisted, games, requiredGames, picks, pickCount, totalGames,
    complete, pickStatus, isWaiting, isOpen, isLocked, isCompleted, isCancelled, isSimulating,
    deadlineMs, loading, busy, isAdmin, selectPick, confirmPicks, lockWeek,
  } = gw

  const handlePick = (gameId, abbr) => {
    selectPick(gameId, abbr)
  }

  const handleConfirm = async () => {
    setConfirming(true)
    setNotice(null)
    const res = await confirmPicks()
    setConfirming(false)
    if (res?.error) setNotice({ type: 'error', text: res.error.message })
    else if (res?.allSubmitted) setNotice({ type: 'ok', text: t('gameWeek.allSubmittedNote') })
  }

  const handleLock = async () => {
    setNotice(null)
    const res = await lockWeek('admin')
    if (res?.error) setNotice({ type: 'error', text: res.error.message })
  }

  if (loading) return <div className={styles.loading}>{t('app.loading')}</div>

  const locked = isLocked || isCompleted
  const badge = stateBadge(gw, t)
  const badgeClass = isOpen ? styles.badgeOpen : isSimulating ? styles.badgeSim : locked ? styles.badgeLocked : styles.badgeIdle

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {/* PLAN-01.1: identidad de la liga siempre visible en la jornada */}
        <LeagueIdentity league={gw.league} sessionNo={gw.event?.session_no} week={week?.week ?? 1} />
        <div className={styles.headerTop}>
          <span className={styles.tag}>{t('gameWeek.sessionTag', { no: week?.week ?? 1 })}</span>
          <span className={`${styles.badge} ${badgeClass}`}>
            {badge}
          </span>
        </div>
        <div className={styles.title}>{t('gameWeek.weekLabel', { week: week?.week ?? 1 })}</div>
        <div className={styles.eyebrow}>{t('gameWeek.eyebrow')}</div>
      </header>

      {isWaiting && (
        <div className={styles.centerState}>
          <div className={styles.waitingTitle}>{t('gameWeek.waitingTitle')}</div>
          <div className={styles.waitingDesc}>{t('gameWeek.waitingDesc')}</div>
        </div>
      )}

      {isCancelled && (
        <div className={styles.centerState}>
          <div className={styles.waitingTitle}>{t('gameWeek.cancelledTitle')}</div>
        </div>
      )}

      {isOpen && (
        <div className={styles.windowBanner}>
          <span className={styles.windowIcon}>{deadlineMs != null && deadlineMs > 0 ? '⏳' : '🔒'}</span>
          <div>
            <div className={styles.windowTitle}>
              {deadlineMs != null && deadlineMs > 0
                ? t('gameWeek.deadline', { time: fmtCountdown(deadlineMs) })
                : t('gameWeek.deadlineMissed')}
            </div>
            <div className={styles.windowSub}>{t('gameWeek.windowOpen')}</div>
          </div>
        </div>
      )}

      {isLocked && (
        <div className={styles.centerState}>
          <div className={styles.waitingTitle}>{t('gameWeek.lockedTitle')}</div>
          <div className={styles.waitingDesc}>{t('gameWeek.lockedDesc')}</div>
        </div>
      )}

      {/* BUILD-TC-006.3 — durante la simulación NO hay acciones de picks:
          solo el progreso en vivo (estado del run + completed/total + %). */}
      {isSimulating && <SimulationProgress />}

      {isCompleted && (
        <>
          <div className={styles.completedBanner}>{t('gameWeek.simulationCompleted')}</div>
          <GameWeekResults />
          <GameWeekLeaderboard />
        </>
      )}

      {!isWaiting && !isCancelled && !isCompleted && (
        <>
          {(isOpen || isLocked) && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>{t('gameWeek.picksLabel')}</div>
                <div className={styles.counter}>
                  {t('gameWeek.picksCount', { done: pickCount, total: totalGames })}
                </div>
              </div>

              {requiredGames.length === 0 ? (
                <div className={styles.noGames}>{t('gameWeek.noGames')}</div>
              ) : (
                <div className={styles.grid}>
                  {requiredGames.map(g => (
                    <GameCard
                      key={g.id}
                      game={g}
                      pick={picks[g.id]}
                      onPick={handlePick}
                      results={null}
                      locked={locked}
                    />
                  ))}
                </div>
              )}

              {!complete && !locked && pickStatus !== PICK_STATUS.SUBMITTED && (
                <div className={styles.missingHint}>
                  {t('gameWeek.missingPicks', { total: totalGames })}
                </div>
              )}
            </div>
          )}

          {isOpen && (
            <div className={styles.confirm}>
              <div className={styles.confirmTitle}>{t('gameWeek.confirmTitle')}</div>
              <div className={styles.confirmDesc}>{t('gameWeek.confirmDesc')}</div>

              {notice && (
                <div className={`${styles.notice} ${styles[notice.type]}`}>{notice.text}</div>
              )}

              <button
                className={styles.confirmBtn}
                disabled={!complete || confirming || busy}
                onClick={handleConfirm}
              >
                {confirming ? t('gameWeek.confirming') : t('gameWeek.confirmBtn')}
              </button>

              {isAdmin && (
                <button className={styles.lockBtn} disabled={confirming || busy} onClick={handleLock}>
                  {t('gameWeek.lockAdminBtn')}
                </button>
              )}
            </div>
          )}

          {weekPersisted === 'local' && (
            <div className={styles.localNote}>💾 {t('gameWeek.localPersist')}</div>
          )}
        </>
      )}
    </div>
  )
}
