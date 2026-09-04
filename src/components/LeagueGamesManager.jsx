import { useState, useEffect, useCallback } from 'react'
import { masterGamesApi, leagueGamesApi } from '../supabase'
import { NFL_TEAMS } from '../data/nflData'
import { getLeagueMode, getLeagueSeason, isOfficialMode, masterPhaseForMode, getLeagueTimezone } from '../domains/league'
import { localTZOffset, getCurrentWeek } from '../utils/dates'
import TeamLogo from './TeamLogo'
import GameTime from './GameTime'
import ScoreEditor from './ScoreEditor'
import SyncStatus from './SyncStatus'
import styles from './LeagueGamesManager.module.css'

const TOTAL_WEEKS = 18

export default function LeagueGamesManager({ league, user }) {
  const [activeWeek, setActiveWeek] = useState(1)
  const [masterGames, setMasterGames] = useState([])
  const [leagueGames, setLeagueGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [resultForm, setResultForm] = useState(null)
  const [customAway, setCustomAway] = useState('')
  const [customHome, setCustomHome] = useState('')
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('')

  const loadData = useCallback(async (keepMsg) => {
    if (!league) return
    setLoading(true)
    if (!keepMsg) setMsg(null)
    const mode = getLeagueMode(league)
    const phase = masterPhaseForMode(mode)
    const [masterRes, leagueRes] = await Promise.all([
      masterGamesApi.getAll(league.sport, getLeagueSeason(league), phase),
      leagueGamesApi.getForLeague(league.id),
    ])
    if (!masterRes.error && masterRes.data) setMasterGames(masterRes.data)
    if (!leagueRes.error && leagueRes.data) setLeagueGames(leagueRes.data)
    setLoading(false)
  }, [league])

  useEffect(() => { loadData() }, [loadData])

  const leagueGameIds = new Set(leagueGames.map(g => g.game_id))

  const mode = getLeagueMode(league)
  const isOfficial = isOfficialMode(mode)
  const leagueTz = getLeagueTimezone(league)

  const masterWeeks = [...new Set(masterGames.map(g => g.week))].sort((a, b) => a - b)
  const weekList = masterWeeks.length > 0 ? masterWeeks : Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1)

  useEffect(() => {
    if (weekList.length > 0 && !weekList.includes(activeWeek)) {
      const current = getCurrentWeek(masterGames)
      setActiveWeek(current || weekList[weekList.length - 1])
    }
  }, [weekList.join(','), activeWeek])

  const availableMaster = masterGames.filter(g => !leagueGameIds.has(g.game_id) && g.week === activeWeek)
  const leagueWeekGames = leagueGames
    .filter(g => g.week === activeWeek)
    .sort((a, b) => {
      const ta = a.game_time || ''
      const tb = b.game_time || ''
      if (ta < tb) return -1
      if (ta > tb) return 1
      return 0
    })

  const toggleSelect = (gameId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(gameId)) next.delete(gameId)
      else next.add(gameId)
      return next
    })
  }

  const importToLeague = async (games) => {
    if (!games.length) return
    setSaving(true)
    const rows = games.map(g => ({
      league_id: league.id,
      master_game_id: g.id,
      sport: g.sport,
      season: g.season,
      week: g.week,
      game_id: g.game_id,
      home_team: g.home_team,
      away_team: g.away_team,
      home_abbr: g.home_abbr,
      away_abbr: g.away_abbr,
      game_time: g.game_time,
    }))
    const { error } = await leagueGamesApi.insertAll(rows)
    if (error) setMsg({ type: 'error', text: `Error al importar: ${error.message}` })
    else {
      setMsg({ type: 'success', text: `${games.length} juego(s) importado(s) a la liga.` })
      await loadData()
      setSelectedIds(new Set())
    }
    setSaving(false)
  }

  const handleImportAll = () => importToLeague(availableMaster)
  const handleImportSelected = () => {
    const selected = availableMaster.filter(g => selectedIds.has(g.game_id))
    importToLeague(selected)
  }

  const handleSetScores = async (game, awayValue, homeValue) => {
    if (homeValue === '' || awayValue === '') {
      setMsg({ type: 'error', text: 'Los scores están vacíos.' })
      return
    }
    setSaving(true)
    try {
      const hs = Number(homeValue)
      const as = Number(awayValue)
      if (!game.id) {
        setSaving(false)
        setMsg({ type: 'error', text: 'Error: game.id es undefined' })
        return
      }
      const { error: lgErr } = await leagueGamesApi.setScores(
        game.id, hs, as,
        game.home_abbr, game.away_abbr
      )
      if (lgErr) {
        console.error('Error leagueGamesApi.setScores:', lgErr)
        setSaving(false)
        setMsg({ type: 'error', text: `Error al guardar resultado: ${lgErr.message}` })
        return
      }
      // BUILD-SCORE-001: league_games es la source of truth para las vistas de
      // la liga durante la captura manual. El sync a master_games se eliminó
      // (League Admin no tiene permiso UPDATE por RLS; ver superadmin.md).
      await loadData(true)
      setSaving(false)
      setResultForm(null)
      setMsg({ type: 'success', text: `Resultado guardado: ${game.away_abbr} ${awayValue} - ${homeValue} ${game.home_abbr}` })
    } catch (e) {
      console.error('Error inesperado en handleSetScores:', e)
      setSaving(false)
      setMsg({ type: 'error', text: `Error inesperado: ${e.message}` })
    }
  }

  const handleAddCustomGame = async () => {
    if (!customAway || !customHome) return setMsg({ type: 'error', text: 'Selecciona ambos equipos.' })
    if (customAway === customHome) return setMsg({ type: 'error', text: 'Los equipos deben ser distintos.' })
    if (!customDate || !customTime) return setMsg({ type: 'error', text: 'Completa fecha y hora.' })
    setSaving(true)
    const tz = localTZOffset()
    const game = {
      league_id: league.id,
      master_game_id: null,
      sport: league.sport,
      season: 'Sim',
      week: activeWeek,
      game_id: `manual-${Date.now()}`,
      home_team: NFL_TEAMS[customHome]?.name || customHome,
      away_team: NFL_TEAMS[customAway]?.name || customAway,
      home_abbr: customHome,
      away_abbr: customAway,
      game_time: `${customDate}T${customTime}:00${tz}`,
    }
    const { error } = await leagueGamesApi.addGame(game)
    setSaving(false)
    if (error) { setMsg({ type: 'error', text: `Error: ${error.message}` }); return }
    setCustomAway(''); setCustomHome(''); setCustomDate(''); setCustomTime('')
    setMsg({ type: 'success', text: `✅ Partido ${customAway} @ ${customHome} agregado.` })
    await loadData()
  }

  const TEAM_OPTIONS = Object.entries(NFL_TEAMS).map(([abbr, data]) => ({ abbr, ...data }))
  const availCustomAway = TEAM_OPTIONS.filter(t => t.abbr !== customHome)
  const availCustomHome = TEAM_OPTIONS.filter(t => t.abbr !== customAway)

  const handleToggleActive = async (gameId, currentlyActive) => {
    const newActive = !currentlyActive
    const { error } = await leagueGamesApi.setActive(league.id, gameId, newActive)
    if (error) setMsg({ type: 'error', text: 'Error al actualizar.' })
    else {
      setLeagueGames(prev => prev.map(g =>
        g.game_id === gameId ? { ...g, active: newActive } : g
      ))
      setMsg({ type: 'success', text: newActive ? 'Juego habilitado.' : 'Juego inhabilitado.' })
    }
  }

  if (!league) return null

  return (
    <div>
      <div className="sec-title">📋 Gestión de Partidos</div>
      <p style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '1rem', lineHeight: 1.5 }}>
        Importa partidos del calendario maestro a tu liga. Los miembros harán sus picks sobre estos partidos.
      </p>

      {msg && (
        <div className={`msg ${msg.type}`} style={{ marginBottom: '1rem' }}>
          {msg.text}
          <button
            style={{ marginLeft: '1rem', color: 'var(--text2)', fontSize: '.8rem' }}
            onClick={() => setMsg(null)}
          >✕</button>
        </div>
      )}

      {isOfficial && <SyncStatus league={league} user={user} onSyncComplete={() => loadData(true)} />}

      {/* Week tabs */}
      <div className="week-tabs" style={{ marginBottom: '1rem' }}>
        {weekList.map(w => (
          <button
            key={w}
            className={`week-tab ${activeWeek === w ? 'active' : ''}`}
            onClick={() => setActiveWeek(w)}
          >
            Semana {w}
          </button>
        ))}
      </div>

      {!league.simulation && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span>📅 Calendario Maestro — Semana {activeWeek}</span>
            <div className={styles.sectionActions}>
              <button
                className="btn-ghost"
                onClick={loadData}
                disabled={loading}
              >⟳</button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state"><div className="big">⏳</div></div>
          ) : masterGames.length === 0 ? (
            <div className="empty-state">
              <div className="big">📭</div>
              No hay calendario maestro cargado. El superadmin debe cargar los juegos primero.
            </div>
          ) : (
            <>
              <div className={styles.availHeader}>
                <span className={styles.availTitle}>
                  Disponibles ({availableMaster.length})
                </span>
                {availableMaster.length > 0 && (
                  <div className={styles.availActions}>
                    {selectedIds.size > 0 && (
                      <button
                        className={styles.actionBtn}
                        onClick={handleImportSelected}
                        disabled={saving}
                      >
                        Importar {selectedIds.size} seleccionados
                      </button>
                    )}
                    <button
                      className={styles.actionBtn}
                      onClick={handleImportAll}
                      disabled={saving}
                    >
                      {saving ? 'Importando...' : '📥 Importar Todos'}
                    </button>
                  </div>
                )}
              </div>
              <div className={styles.gamesList}>
                {availableMaster.length === 0 ? (
                  <div className={styles.emptyRow}>Todos los juegos de esta semana ya fueron importados ✓</div>
                ) : (
                  availableMaster.map(g => (
                    <div
                      key={g.id}
                      className={`${styles.gameRow} ${selectedIds.has(g.game_id) ? styles.selected : ''}`}
                      onClick={() => toggleSelect(g.game_id)}
                    >
                      <span className={styles.chk}>{selectedIds.has(g.game_id) ? '☑' : '☐'}</span>
                      <TeamLogo abbr={g.away_abbr} className={styles.emoji} size={24} />
                      <span className={styles.abbr}>{g.away_abbr}</span>
                      <span className={styles.vs}>@</span>
                      <TeamLogo abbr={g.home_abbr} className={styles.emoji} size={24} />
                      <span className={styles.abbr}>{g.home_abbr}</span>
                      <span className={styles.time}><GameTime when={g.game_time} timeZone={leagueTz} /></span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <span>🏟️ Partidos en {league.name} — Semana {activeWeek}</span>
        </div>

        {leagueWeekGames.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem' }}>
            <div className="big" style={{ fontSize: '1.5rem' }}>🔄</div>
            No hay partidos en esta semana. Impórtalos desde el calendario maestro.
          </div>
        ) : (
          <div className={styles.gamesList}>
            {leagueWeekGames.map(g => {
              const hasResult = g.finished && (
                g.result ||
                (g.home_score != null && g.away_score != null)
              )
              const editing = resultForm === g.id
              return (
                <div
                  key={g.id}
                  className={`${styles.gameRow} ${g.active === false ? styles.inactive : ''} ${hasResult ? styles.hasResult : ''} ${editing ? styles.editing : ''}`}
                  onClick={() => { if (!editing) setResultForm(g.id) }}
                >
                  {g.active === false && <span className={styles.inactiveBadge}>🚫</span>}

                  {!editing && (
                    <div className={styles.teamsRow}>
                      <TeamLogo abbr={g.away_abbr} className={styles.emoji} size={24} />
                      <span className={`${styles.abbr} ${hasResult && g.result === g.away_abbr ? styles.winner : ''}`}>{g.away_abbr}</span>
                      {hasResult ? (
                        <span className={styles.score}>{g.away_score}</span>
                      ) : (
                        <span className={styles.vs}>@</span>
                      )}
                      <TeamLogo abbr={g.home_abbr} className={styles.emoji} size={24} />
                      <span className={`${styles.abbr} ${hasResult && g.result === g.home_abbr ? styles.winner : ''}`}>{g.home_abbr}</span>
                      {hasResult && <span className={styles.score}>{g.home_score}</span>}
                    </div>
                  )}

                  <div className={editing ? styles.editMeta : styles.rowMeta}>
                    <span className={styles.time}><GameTime when={g.game_time} timeZone={leagueTz} /></span>

                    {!editing && (
                      <button
                        className={styles.resultBtn}
                        onClick={(e) => { e.stopPropagation(); setResultForm(g.id) }}
                        title={hasResult ? 'Editar resultado' : 'Ingresar resultado'}
                      >
                        {hasResult ? '📝' : '🏆'}
                      </button>
                    )}
                    <button
                      className={g.active === false ? styles.enableBtn : styles.disableBtn}
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(g.game_id, g.active !== false) }}
                      title={g.active === false ? 'Habilitar' : 'Inhabilitar'}
                    >
                      {g.active === false ? '✓' : '✕'}
                    </button>
                  </div>

                  {editing && (
                    <ScoreEditor
                      away={{ abbr: g.away_abbr, name: g.away_team }}
                      home={{ abbr: g.home_abbr, name: g.home_team }}
                      initialAwayScore={g.away_score}
                      initialHomeScore={g.home_score}
                      saving={saving}
                      official={isOfficial}
                      onSave={(away, home) => handleSetScores(g, away, home)}
                      onCancel={() => setResultForm(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!isOfficial && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span>➕ Agregar juego manual a Semana {activeWeek}</span>
          </div>
        <div className={styles.addForm}>
          <div className={styles.teamRow}>
            <select className={styles.teamSelect} value={customAway} onChange={e => setCustomAway(e.target.value)}>
              <option value="">Visitante</option>
              {availCustomAway.map(t => (
                <option key={t.abbr} value={t.abbr}>{t.abbr} — {t.name}</option>
              ))}
            </select>
            <span className={styles.teamVs}>@</span>
            <select className={styles.teamSelect} value={customHome} onChange={e => setCustomHome(e.target.value)}>
              <option value="">Local</option>
              {availCustomHome.map(t => (
                <option key={t.abbr} value={t.abbr}>{t.abbr} — {t.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.dateRow}>
            <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
              className={styles.inputDate} />
            <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)}
              className={styles.inputTime} />
            <button onClick={handleAddCustomGame} disabled={saving}
              className={styles.addBtn}>+ Agregar</button>
          </div>
        </div>
        </div>
      )}
    </div>
  )
}
