import { useState } from 'react'
import { useTrainingCamp } from '../hooks/useTrainingCamp'
import SetupWizard from './SetupWizard'
import WeekManager from './WeekManager'
import TrainingCampPicksBoard from './PicksBoard'
import styles from '../training-camp.module.css'

// BUILD-TC-V2: Container principal del Training Camp rediseñado (simple y
// manual): wizard de semanas → construcción del calendario por semana →
// invitación → picks con deadline → resultados manuales → snapshot auditoría.
export default function TrainingCampPage({ user, league }) {
  const tc = useTrainingCamp({ leagueId: league?.id, userId: user?.id, league })
  const {
    loading, busy, phase, isAdmin, session, totalWeeks, currentWeek, scheduleComplete,
    games, currentWeekGames, picks, submitted, membersByUser,
    deadline, deadlineMinutes, picksLocked, weekComplete, progress,
    createCamp, markScheduleComplete, startCamp, setCurrentWeek, addGame, removeGame, setResult,
    savePick, confirmPicks, goToNextWeek, snapshots, t,
  } = tc
  const [copied, setCopied] = useState(false)

  if (loading) return <div className={styles.spinner}>{t('app.loading')}</div>

  const inviteUrl = league?.code ? `${window.location.origin}/?join=${league.code}` : null

  const copyInvite = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const snapshotUrl = snapshots[currentWeek]?.snapshot_hash
    ? `${window.location.origin}/#/training/audit/${snapshots[currentWeek].snapshot_hash}`
    : null

  // Semanas que el admin ya debe completar en modo setup (1..totalWeeks).
  const setupWeeksPresent = Array.from({ length: totalWeeks }, (_, i) => i + 1)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>🎓 {league?.name || 'Training Camp'}</div>
        <div className={styles.eyebrow}>
          {phase === 'setup' && 'Configuración · define tus semanas'}
          {phase === 'inviting' && 'Invita jugadores · los picks cierran 5 min antes del primer juego'}
          {phase === 'active' && `Semana ${currentWeek} de ${totalWeeks} · resultados manuales`}
          {phase === 'finished' && 'Campamento finalizado'}
        </div>
      </div>

      {/* FASE SETUP: sin sesión → wizard de semanas; con sesión → construir calendario */}
      {phase === 'setup' && !isAdmin && (
        <div className={`${styles.note} ${styles.noteInfo}`}>
          El admin está configurando el campamento. Vuelve en un momento.
        </div>
      )}

      {phase === 'setup' && isAdmin && !session && (
        <SetupWizard onSave={createCamp} busy={busy} />
      )}

      {phase === 'setup' && isAdmin && session && scheduleComplete === false && (
        <>
          <div className={styles.weekTabs}>
            {setupWeeksPresent.map(w => (
              <span key={w} className={`${styles.weekTab} ${w === currentWeek ? styles.weekTabActive : ''}`}>
                Semana {w}
              </span>
            ))}
          </div>
          <WeekManager
            mode="setup" week={currentWeek} totalWeeks={totalWeeks}
            games={currentWeekGames} progress={progress} busy={busy}
            onAddGame={addGame} onRemoveGame={removeGame}
            onNextWeek={() => setCurrentWeek(currentWeek + 1)}
            onFinishSchedule={markScheduleComplete}
          />
        </>
      )}

      {/* FASE INVITING: compartir enlace + comenzar */}
      {phase === 'inviting' && (
        <>
          <div className={`${styles.note} ${styles.noteOk}`}>
            ✅ Calendario de {totalWeeks} semanas configurado.
          </div>
          {inviteUrl && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Invitar jugadores</div>
              <div className={styles.row} style={{ marginBottom: '.5rem' }}>
                <input className={styles.input} readOnly value={inviteUrl} style={{ flex: 1 }} />
                <button className={styles.btn} onClick={copyInvite}>
                  {copied ? '✓ Copiado' : '📋 Copiar'}
                </button>
              </div>
              <p style={{ fontSize: '.82rem', color: 'var(--text2)' }}>
                Cada jugador elegirá su nickname al entrar. Los picks cierran {deadlineMinutes} min antes del primer juego de la semana.
              </p>
              {isAdmin && (
                <button className={styles.btnPrimary} disabled={busy} onClick={startCamp}>
                  Comenzar semana 1 →
                </button>
              )}
            </div>
          )}
          {!isAdmin && (
            <div className={styles.empty}>Esperando que el admin inicie el campamento…</div>
          )}
        </>
      )}

      {/* FASE ACTIVE: tabs + gestión admin + picks */}
      {phase === 'active' && (
        <>
          <div className={styles.weekTabs}>
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => {
              const locked = w > currentWeek
              return (
                <button
                  key={w}
                  className={`${styles.weekTab} ${w === currentWeek ? styles.weekTabActive : ''} ${locked ? styles.weekTabLocked : ''}`}
                  onClick={() => !locked && setCurrentWeek(w)}
                  disabled={locked}
                >
                  Semana {w}
                </button>
              )
            })}
          </div>

          {isAdmin && (
            <WeekManager
              mode="active" week={currentWeek} totalWeeks={totalWeeks}
              games={currentWeekGames}
              deadline={deadline} picksLocked={picksLocked}
              weekComplete={weekComplete} progress={progress}
              busy={busy}
              onAddGame={addGame} onRemoveGame={removeGame} onSetResult={setResult}
              onNextWeek={goToNextWeek}
            />
          )}

          {!isAdmin && (
            <TrainingCampPicksBoard
              league={league} week={currentWeek}
              games={currentWeekGames} picks={picks} submitted={submitted}
              picksLocked={picksLocked} deadline={deadline} busy={busy}
              onPick={(gameId, abbr) => savePick({ gameId, pick: abbr })}
              onConfirm={confirmPicks}
            />
          )}

          {snapshotUrl && (
            <div className={`${styles.note} ${styles.noteInfo}`}>
              <div style={{ fontWeight: 700, marginBottom: '.25rem' }}>🔍 Auditoría de la semana {currentWeek}</div>
              <div style={{ fontSize: '.85rem' }}>Los picks públicos quedaron congelados al iniciar el primer juego. Comparte esta URL para auditar:</div>
              <input className={styles.input} readOnly value={snapshotUrl} style={{ width: '100%', marginTop: '.5rem', fontSize: '.75rem' }} />
            </div>
          )}

          {Object.keys(membersByUser).length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Participantes</div>
              <div className={styles.grid}>
                {Object.entries(membersByUser).map(([uid, m]) => (
                  <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                    <span>{m.role === 'admin' ? '👑' : '👤'}</span>
                    <span>{m.nickname}</span>
                    {m.role === 'admin' && <span className={`${styles.badge} ${styles.badgeOpen}`}>Admin</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* FASE FINISHED */}
      {phase === 'finished' && (
        <div className={`${styles.note} ${styles.noteOk}`}>🎉 ¡Training Camp completado!</div>
      )}
    </div>
  )
}
