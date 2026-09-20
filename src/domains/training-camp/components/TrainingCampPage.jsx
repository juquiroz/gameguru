import { useEffect, useMemo, useState } from 'react'
import { useTrainingCamp } from '../hooks/useTrainingCamp'
import SetupWizard from './SetupWizard'
import WeekManager from './WeekManager'
import TrainingCampPicksBoard from './PicksBoard'
import { buildLeaderboard } from '../../game-week/simulationView'
import styles from '../training-camp.module.css'

// BUILD-TC-V2-AUTO: Container del Training Camp rediseñado.
//  - Manual (014.0): wizard → calendario manual → invitación → picks con
//    deadline semanal → resultados manuales → snapshot auditoría.
//  - Automático (BUILD-TC-V2-AUTO): el wizard genera 5 juegos/semana,
//    los picks cierran por juego, los resultados se resuelven solos, la
//    semana activa avanza sola y los nombres se revelan al final.
const pad = (n) => String(n).padStart(2, '0')
const toLocalInput = (d) => {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  const off = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
  return `${off.getFullYear()}-${pad(off.getMonth() + 1)}-${pad(off.getDate())}T${pad(off.getHours())}:${pad(off.getMinutes())}`
}

export default function TrainingCampPage({ user, league }) {
  const tc = useTrainingCamp({ leagueId: league?.id, userId: user?.id, league })
  const {
    loading, busy, phase, isAdmin, session, totalWeeks, currentWeek, scheduleComplete,
    games, currentWeekGames, picks, submitted, allPicks, membersByUser,
    deadline, deadlineMinutes, picksLocked, weekComplete, progress, pendingGames,
    gameLocks, auto, campStarted, currentStarts, regenerateWeek,
    revealReady, revealed, revealNames, leaderboard,
    createCamp, markScheduleComplete, startCamp, setCurrentWeek, addGame, removeGame, setResult,
    savePick, confirmPicks, goToNextWeek, snapshots, t,
  } = tc

  const [copied, setCopied] = useState(false)
  const [viewWeek, setViewWeek] = useState(1)
  const [startDrafts, setStartDrafts] = useState([])
  const [editMsg, setEditMsg] = useState(null)

  // Sigue la semana activa (auto) una vez que el admin no está editando.
  useEffect(() => {
    if (auto) setViewWeek(currentWeek)
  }, [auto, currentWeek])

  // Carga los inicios editables cuando entran los datos del calendario.
  useEffect(() => {
    if (auto && currentStarts.length) {
      setStartDrafts(currentStarts.map(s => toLocalInput(s)))
    }
  }, [auto, currentStarts])

  // Standings de la semana seleccionada (auto): el hook expone el leaderboard
  // de la semana ACTIVA; acá se recalcula para la pestaña en foco (viewWeek).
  const viewLeaderboard = useMemo(() => {
    if (!auto) return leaderboard
    const wk = games.filter(g => Number(g.week) === Number(viewWeek) && g.finished)
    if (wk.length === 0) return []
    const participants = Object.entries(membersByUser).map(([uid, m], i) => ({
      id: uid,
      username: revealed ? m.nickname : `Jugador ${i + 1}`,
    }))
    return buildLeaderboard({
      participants,
      picks: (allPicks || []).filter(p => p.submitted_at),
      games: wk,
    })
  }, [auto, viewWeek, games, membersByUser, revealed, allPicks, leaderboard])

  if (loading) return <div className={styles.spinner}>{t('app.loading')}</div>

  const inviteUrl = league?.code ? `${window.location.origin}/?join=${league.code}` : null

  const copyInvite = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const snapshotUrl = snapshots[viewWeek]?.snapshot_hash
    ? `${window.location.origin}/#/training/audit/${snapshots[viewWeek].snapshot_hash}`
    : null

  const doRegenerate = async (week) => {
    const draft = startDrafts[week - 1]
    if (!draft) return setEditMsg(`Define el inicio de la semana ${week}.`)
    try {
      const res = await regenerateWeek(week, new Date(draft).toISOString())
      if (res?.error) setEditMsg(res.error.message)
      else setEditMsg(null)
    } catch (err) {
      setEditMsg(err?.message || 'No se pudo regenerar el calendario.')
    }
  }

  const setupWeeksPresent = Array.from({ length: totalWeeks }, (_, i) => i + 1)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>🎓 {league?.name || 'Training Camp'}</div>
        <div className={styles.eyebrow}>
          {phase === 'setup' && 'Configuración · define tus semanas'}
          {phase === 'inviting' && (
            auto
              ? 'Invita jugadores · cada juego cierra sus picks 10 min antes del inicio'
              : 'Invita jugadores · los picks cierran 5 min antes del primer juego'
          )}
          {phase === 'active' && !auto && `Semana ${currentWeek} de ${totalWeeks} · resultados manuales`}
          {phase === 'active' && auto && `Semana activa ${currentWeek} de ${totalWeeks} · todo automático`}
          {phase === 'finished' && (
            auto && !revealed ? 'Campamento finalizado · revela los nombres ✓' : 'Campamento finalizado'
          )}
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

      {phase === 'setup' && isAdmin && session && scheduleComplete === false && !auto && (
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

      {/* FASE INVITING: compartir enlace + horarios (auto) + comenzar */}
      {phase === 'inviting' && (
        <>
          <div className={`${styles.note} ${styles.noteOk}`}>
            ✅ Calendario de {totalWeeks} semanas configurado{auto ? ' automáticamente' : ''}.
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
                {auto
                  ? `Cada jugador elegirá su nickname al entrar. Los picks se cierran ${deadlineMinutes} min antes de cada juego.`
                  : `Cada jugador elegirá su nickname al entrar. Los picks cierran ${deadlineMinutes} min antes del primer juego de la semana.`}
              </p>

              {auto && isAdmin && (
                <div className={styles.section} style={{ marginTop: '.75rem' }}>
                  <div className={styles.sectionTitle}>Horarios de cada semana</div>
                  {campStarted ? (
                    <p style={{ fontSize: '.82rem', color: 'var(--text2)' }}>
                      El campamento ya comenzó; los horarios ya no se pueden cambiar.
                    </p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                        {setupWeeksPresent.map(w => (
                          <div key={w} className={styles.row}>
                            <label style={{ fontSize: '.82rem', width: 70 }}>Semana {w}</label>
                            <input
                              className={styles.input}
                              type="datetime-local"
                              value={startDrafts[w - 1] || ''}
                              onChange={e => setStartDrafts(prev => prev.map((v, i) => (i === w - 1 ? e.target.value : v)))}
                              style={{ flex: 1 }}
                            />
                            <button className={styles.btnGhost} disabled={busy} onClick={() => doRegenerate(w)}>
                              Actualizar
                            </button>
                          </div>
                        ))}
                      </div>
                      {editMsg && <div className={`${styles.note} ${styles.noteInfo}`}>{editMsg}</div>}
                      <p style={{ fontSize: '.8rem', color: 'var(--text2)', marginTop: '.5rem' }}>
                        Al actualizar se re-genera el calendario con los nuevos horarios (los 5 juegos de cada semana, 5 min entre tips).
                      </p>
                    </>
                  )}
                </div>
              )}

              {auto && !isAdmin && (
                <p style={{ fontSize: '.8rem', color: 'var(--text2)' }}>
                  El campamento se iniciará solo cuando llegue la hora del primer juego.
                </p>
              )}
              {auto && campStarted && (
                <p style={{ fontSize: '.8rem', color: 'var(--text2)' }}>
                  La hora del primer juego ya pasó; el campamento se está iniciando…
                </p>
              )}

              {isAdmin && (<button className={styles.btnPrimary} disabled={busy} onClick={startCamp}>
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

      {/* FASE ACTIVE: tabs + gestión admin + picks + standings */}
      {(phase === 'active' || phase === 'finished') && (
        <>
          <div className={styles.weekTabs}>
            {setupWeeksPresent.map(w => {
              const isActive = (auto || phase === 'finished') ? w === viewWeek : w === currentWeek
              const clickable = auto || !(w > currentWeek)
              return (
                <button
                  key={w}
                  className={`${styles.weekTab} ${isActive ? styles.weekTabActive : ''} ${!clickable ? styles.weekTabLocked : ''}`}
                  onClick={() => clickable && setViewWeek(w)}
                  disabled={!clickable}
                >
                  Semana {w}
                </button>
              )
            })}
          </div>

          {auto && (phase === 'active') && (
            <div className={`${styles.note} ${styles.noteInfo}`}>
              {pendingGames.length > 0
                ? `Próximo juego en ${deadlineMinutes} min. Los resultados se resuelven solos al inicio de cada juego.`
                : 'Semana completa. Los nombres de los jugadores se revelarán al final del campamento.'}
            </div>
          )}

          {isAdmin && (
            <WeekManager
              mode="active" week={viewWeek} totalWeeks={totalWeeks}
              games={auto ? games.filter(g => Number(g.week) === Number(viewWeek)) : (viewWeek === currentWeek ? currentWeekGames : [])}
              deadline={deadline} picksLocked={picksLocked}
              weekComplete={weekComplete} progress={progress}
              busy={busy}
              readOnly={auto}
              onAddGame={addGame} onRemoveGame={removeGame} onSetResult={setResult}
              onNextWeek={goToNextWeek}
            />
          )}

          {!isAdmin && auto && (
            <TrainingCampPicksBoard
              league={league} session={session} week={viewWeek}
              games={games.filter(g => Number(g.week) === Number(viewWeek))}
              picks={picks} submitted={submitted}
              picksLocked={picksLocked} deadline={deadline}
              busy={busy} auto gameLocks={gameLocks}
              deadlineMinutes={deadlineMinutes}
              onPick={(gameId, abbr) => savePick({ gameId, pick: abbr })}
              onConfirm={confirmPicks}
            />
          )}

          {!isAdmin && !auto && (
            <TrainingCampPicksBoard
              league={league} session={session} week={viewWeek}
              games={viewWeek === currentWeek ? currentWeekGames : []}
              picks={picks} submitted={submitted}
              picksLocked={picksLocked} deadline={deadline} busy={busy}
              onPick={(gameId, abbr) => savePick({ gameId, pick: abbr })}
              onConfirm={confirmPicks}
            />
          )}

          {snapshotUrl && (
            <div className={`${styles.note} ${styles.noteInfo}`}>
              <div style={{ fontWeight: 700, marginBottom: '.25rem' }}>🔍 Auditoría de la semana {viewWeek}</div>
              <div style={{ fontSize: '.85rem' }}>Los picks públicos quedaron congelados al iniciar el primer juego. Comparte esta URL para auditar:</div>
              <input className={styles.input} readOnly value={snapshotUrl} style={{ width: '100%', marginTop: '.5rem', fontSize: '.75rem' }} />
            </div>
          )}

          {/* Standings / leaderboard (modo auto) */}
          {auto && viewLeaderboard.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                Tabla de la semana {viewWeek} {revealed ? '· nombres revelados' : ''}
              </div>
              {revealReady && !revealed && (
                <div className={`${styles.note} ${styles.noteOk}`} style={{ marginBottom: '.5rem' }}>
                  El último juego ya terminó.
                  <button
                    className={styles.btnPrimary}
                    style={{ marginLeft: '.5rem' }}
                    onClick={revealNames}
                  >
                    👁️ Revelar nombres
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                {viewLeaderboard.map(row => (
                  <div key={row.userId} className={styles.row} style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: row.rank === 1 ? 700 : 400 }}>
                      {row.rank}. {row.username}
                    </span>
                    <span style={{ color: 'var(--text2)', fontSize: '.85rem' }}>
                      {row.correct}/{row.total} correctos · {row.points} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {auto && !revealReady && viewLeaderboard.length === 0 && currentWeekGames.length > 0 && (
            <div className={`${styles.note} ${styles.noteInfo}`}>
              Los picks se revelan cuando termine el último juego del campamento.
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

      {/* FASE FINISHED (manual) */}
      {phase === 'finished' && !auto && (
        <div className={`${styles.note} ${styles.noteOk}`}>🎉 ¡Training Camp completado!</div>
      )}
    </div>
  )
}