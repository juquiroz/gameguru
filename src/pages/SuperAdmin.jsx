import { useState, useEffect, useCallback } from 'react'
import { masterGamesApi } from '../supabase'
import { NFL_TEAMS } from '../data/nflData'
import TeamLogo from '../components/TeamLogo'
import GameTime from '../components/GameTime'
import { localTZOffset } from '../utils/dates'
import nflSchedule from '../data/nflSchedule2026.json'
import nflPreseason from '../data/nflPreseason2026.json'
import styles from './SuperAdmin.module.css'

const PHASES = [
  { id: 'regular', label: '🏆 Temporada', json: nflSchedule, totalWeeks: 18, prefix: 'w' },
  { id: 'preseason', label: '🏈 Pretemporada', json: nflPreseason, totalWeeks: 4, prefix: 'psw' },
]

export default function SuperAdmin() {
  const [phase, setPhase] = useState('regular')
  const phaseCfg = PHASES.find(p => p.id === phase)
  const [activeWeek, setActiveWeek] = useState(1)
  const [masterGames, setMasterGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({
    week: 1, home_abbr: '', away_abbr: '', game_time: '',
  })

  const loadGames = useCallback(async (ph) => {
    setLoading(true)
    setMsg(null)
    const { data, error } = await masterGamesApi.getAll('NFL', '2026', ph)
    if (!error && data) setMasterGames(data)
    else setMsg({ type: 'error', text: 'Error al cargar juegos.' })
    setLoading(false)
  }, [])

  useEffect(() => { loadGames(phase) }, [phase, loadGames])

  useEffect(() => {
    if (activeWeek > phaseCfg.totalWeeks) setActiveWeek(1)
  }, [phase, phaseCfg.totalWeeks, activeWeek])

  const handleLoadSchedule = async () => {
    setSaving(true)
    setMsg(null)

    const nameToAbbr = {}
    for (const [abbr, data] of Object.entries(NFL_TEAMS)) {
      nameToAbbr[data.name] = abbr
    }

    const weekCounts = {}
    const games = phaseCfg.json.map(g => {
      weekCounts[g.RoundNumber] = (weekCounts[g.RoundNumber] || 0) + 1
      const idx = weekCounts[g.RoundNumber]
      return {
        sport: 'NFL',
        season: '2026',
        phase,
        week: g.RoundNumber,
        game_id: `${phaseCfg.prefix}${g.RoundNumber}g${idx}`,
        home_team: g.HomeTeam,
        away_team: g.AwayTeam,
        home_abbr: nameToAbbr[g.HomeTeam] || '???',
        away_abbr: nameToAbbr[g.AwayTeam] || '???',
        game_time: g.DateUtc,
      }
    })

    const { error } = await masterGamesApi.insertAll(games)
    if (error) {
      if (error.code === '23505') setMsg({ type: 'warning', text: `El calendario de ${phaseCfg.label} 2026 ya ha sido cargado.` })
      else setMsg({ type: 'error', text: `Error: ${error.message}` })
    } else {
      setMsg({ type: 'success', text: `¡Calendario ${phaseCfg.label} 2026 cargado! ${games.length} partidos insertados.` })
      await loadGames(phase)
    }
    setSaving(false)
  }

  const handleDeleteGame = async (id) => {
    const { error } = await masterGamesApi.remove(id)
    if (error) setMsg({ type: 'error', text: 'Error al eliminar.' })
    else {
      setMasterGames(prev => prev.filter(g => g.id !== id))
      setMsg({ type: 'success', text: 'Juego eliminado.' })
    }
  }

  const handleAddGame = async (e) => {
    e.preventDefault()
    if (!form.home_abbr || !form.away_abbr || !form.game_time) {
      setMsg({ type: 'error', text: 'Completa todos los campos.' })
      return
    }
    setSaving(true)
    const hAbbr = form.home_abbr.toUpperCase()
    const aAbbr = form.away_abbr.toUpperCase()
    const game = {
      sport: 'NFL',
      season: '2026',
      phase,
      week: Number(form.week),
      game_id: `${phaseCfg.prefix}-manual-${Date.now()}`,
      home_team: NFL_TEAMS[hAbbr]?.name || hAbbr,
      away_team: NFL_TEAMS[aAbbr]?.name || aAbbr,
      home_abbr: hAbbr,
      away_abbr: aAbbr,
      game_time: `${form.game_time}:00${localTZOffset()}`,
    }
    const { data, error } = await masterGamesApi.insert(game)
    if (error) setMsg({ type: 'error', text: `Error: ${error.message}` })
    else {
      setMasterGames(prev => [...prev, data])
      setMsg({ type: 'success', text: 'Juego agregado.' })
      setShowForm(false)
    }
    setSaving(false)
  }

  const weekGames = masterGames.filter(g => g.week === activeWeek)
  const weeksWithGames = [...new Set(masterGames.map(g => g.week))].sort((a, b) => a - b)

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <div className="page-title">Admin Global</div>
          <div className="page-sub">Gestión del calendario maestro de juegos</div>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.phaseSwitch}>
            {PHASES.map(p => (
              <button
                key={p.id}
                className={`${styles.phaseBtn} ${phase === p.id ? styles.phaseBtnActive : ''}`}
                onClick={() => setPhase(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button className="btn-secondary" onClick={() => loadGames(phase)} disabled={loading}>
            ⟳ Recargar
          </button>
          <button
            className={styles.loadBtn}
            onClick={handleLoadSchedule}
            disabled={saving}
          >
            {saving ? 'Cargando...' : `📅 Cargar ${phaseCfg.label} 2026`}
          </button>
          {confirmDelete ? (
            <>
              <button
                className={`${styles.dangerBtn} ${styles.active}`}
                onClick={async () => {
                  setConfirmDelete(false)
                  setSaving(true)
                  setMsg(null)
                  const { error } = await masterGamesApi.deleteAll('NFL', '2026', phase)
                  if (error) setMsg({ type: 'error', text: `Error: ${error.message}` })
                  else {
                    setMsg({ type: 'success', text: `Todo el calendario de ${phaseCfg.label} 2026 fue eliminado.` })
                    await loadGames(phase)
                  }
                  setSaving(false)
                }}
                disabled={saving}
              >
                ⚠ ¿Seguro? ¡Esto no se puede deshacer!
              </button>
              <button
                className="btn-secondary"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              className={styles.dangerBtn}
              onClick={() => setConfirmDelete(true)}
              disabled={saving || masterGames.length === 0}
            >
              🗑 Borrar todo
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`msg ${msg.type}`} style={{ marginBottom: '1rem' }}>
          {msg.text}
          <button
            style={{ marginLeft: '1rem', color: 'var(--text2)', fontSize: '.8rem' }}
            onClick={() => setMsg(null)}
          >✕</button>
        </div>
      )}

      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <span className={styles.statVal}>{masterGames.length}</span>
          <span className={styles.statLabel}>Total Juegos</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal}>{weeksWithGames.length}</span>
          <span className={styles.statLabel}>Semanas</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal}>{weekGames.length}</span>
          <span className={styles.statLabel}>Semana {activeWeek}</span>
        </div>
      </div>

      <div className="week-tabs">
        {Array.from({ length: phaseCfg.totalWeeks }, (_, i) => i + 1).map(w => (
          <button
            key={w}
            className={`week-tab ${activeWeek === w ? 'active' : ''}`}
            onClick={() => setActiveWeek(w)}
          >
            Semana {w}
            {weeksWithGames.includes(w) &&
              <span className={styles.weekCount}>{masterGames.filter(g => g.week === w).length}</span>
            }
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-secondary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancelar' : '➕ Agregar Manual'}
        </button>
      </div>

      {showForm && (
        <form className={styles.addForm} onSubmit={handleAddGame}>
          <div className="field">
            <label>Semana</label>
            <select value={form.week} onChange={e => setForm(f => ({ ...f, week: e.target.value }))}>
              {Array.from({ length: phaseCfg.totalWeeks }, (_, i) => (
                <option key={i + 1} value={i + 1}>Semana {i + 1}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Equipo Visitante (abbr)</label>
            <input
              value={form.away_abbr}
              onChange={e => setForm(f => ({ ...f, away_abbr: e.target.value.toUpperCase() }))}
              placeholder="Ej: KC"
              maxLength={4}
            />
          </div>
          <div className="field">
            <label>Equipo Local (abbr)</label>
            <input
              value={form.home_abbr}
              onChange={e => setForm(f => ({ ...f, home_abbr: e.target.value.toUpperCase() }))}
              placeholder="Ej: BUF"
              maxLength={4}
            />
          </div>
          <div className="field">
            <label>Horario (hora local)</label>
            <input
              type="datetime-local"
              value={form.game_time}
              onChange={e => setForm(f => ({ ...f, game_time: e.target.value }))}
            />
          </div>
          <button className="btn-primary" disabled={saving} style={{ marginTop: '.5rem' }}>
            {saving ? 'Guardando...' : 'Guardar Juego'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="empty-state"><div className="big">⏳</div>Cargando juegos...</div>
      ) : weekGames.length === 0 ? (
        <div className="empty-state">
          <div className="big">📭</div>
          No hay juegos para la Semana {activeWeek}.
          {masterGames.length === 0 && (
            <><br /><span style={{ fontSize: '.82rem', color: 'var(--text3)' }}>
              Haz clic en "Cargar {phaseCfg.label} 2026" para cargar el calendario.
            </span></>
          )}
        </div>
      ) : (
        <div className={styles.gamesGrid}>
          {weekGames.map(g => (
            <div key={g.id} className={styles.gameCard}>
              <div className={styles.gameTime}><GameTime when={g.game_time} timeZone="UTC" /></div>
              <div className={styles.teamsRow}>
                <div className={styles.teamInfo}>
                  <TeamLogo abbr={g.away_abbr} className={styles.teamEmoji} size={32} />
                  <span className={styles.teamAbbr}>{g.away_abbr}</span>
                  <span className={styles.teamName}>{g.away_team}</span>
                </div>
                <span className={styles.vs}>@</span>
                <div className={styles.teamInfo}>
                  <TeamLogo abbr={g.home_abbr} className={styles.teamEmoji} size={32} />
                  <span className={styles.teamAbbr}>{g.home_abbr}</span>
                  <span className={styles.teamName}>{g.home_team}</span>
                </div>
              </div>
              <div className={styles.gameId}>ID: {g.game_id}</div>
              <button
                className={styles.delBtn}
                onClick={() => handleDeleteGame(g.id)}
              >
                🗑 Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
