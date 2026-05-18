import { useState, useEffect, useCallback } from 'react'
import { masterGamesApi, leagueGamesApi } from '../supabase'
import { NFL_TEAMS } from '../data/nflData'
import TeamLogo from './TeamLogo'
import styles from './LeagueGamesManager.module.css'

const TOTAL_WEEKS = 18

export default function LeagueGamesManager({ league }) {
  const [activeWeek, setActiveWeek] = useState(1)
  const [masterGames, setMasterGames] = useState([])
  const [leagueGames, setLeagueGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const loadData = useCallback(async () => {
    if (!league) return
    setLoading(true)
    setMsg(null)
    const [masterRes, leagueRes] = await Promise.all([
      masterGamesApi.getAll(league.sport, '2026'),
      leagueGamesApi.getForLeague(league.id),
    ])
    if (!masterRes.error && masterRes.data) setMasterGames(masterRes.data)
    if (!leagueRes.error && leagueRes.data) setLeagueGames(leagueRes.data)
    setLoading(false)
  }, [league])

  useEffect(() => { loadData() }, [loadData])

  const leagueGameIds = new Set(leagueGames.map(g => g.game_id))

  const availableMaster = masterGames.filter(g => !leagueGameIds.has(g.game_id) && g.week === activeWeek)
  const leagueWeekGames = leagueGames.filter(g => g.week === activeWeek)

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

  const handleRemoveGame = async (gameId) => {
    const { error } = await leagueGamesApi.removeFromLeague(league.id, gameId)
    if (error) setMsg({ type: 'error', text: 'Error al eliminar.' })
    else {
      setLeagueGames(prev => prev.filter(g => g.game_id !== gameId))
      setMsg({ type: 'success', text: 'Juego eliminado de la liga.' })
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

        <div className="week-tabs">
          {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(w => (
            <button
              key={w}
              className={`week-tab ${activeWeek === w ? 'active' : ''}`}
              onClick={() => setActiveWeek(w)}
            >
              Semana {w}
            </button>
          ))}
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
                    <span className={styles.time}>{g.game_time}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

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
            {leagueWeekGames.map(g => (
              <div key={g.id} className={styles.gameRow}>
                <TeamLogo abbr={g.away_abbr} className={styles.emoji} size={24} />
                <span className={styles.abbr}>{g.away_abbr}</span>
                <span className={styles.vs}>@</span>
                <TeamLogo abbr={g.home_abbr} className={styles.emoji} size={24} />
                <span className={styles.abbr}>{g.home_abbr}</span>
                <span className={styles.time}>{g.game_time}</span>
                <button
                  className={styles.removeBtn}
                  onClick={() => handleRemoveGame(g.game_id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
