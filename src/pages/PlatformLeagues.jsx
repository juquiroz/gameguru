import { useState, useEffect, useCallback } from 'react'
import { platformApi } from '../supabase'
import {
  buildOwnerMap,
  ownerName,
  buildFilterOptions,
  DEFAULT_PAGE_SIZE,
} from '../domains/platform'
import { LEAGUE_MODES } from '../domains/league/models/modes'
import { navigate, platformRoute, platformLeagueRoute } from '../router/routes'
import styles from './PlatformLeagues.module.css'

// BUILD-SUP-002 — Listado global de ligas (read-only).
// Consulta paginada server-side (count exact + range) con counts embebidos.
// La UI no define lógica: filtros/búsqueda/owner viven en el dominio.
const NO_FILTER = ''

export default function PlatformLeagues() {
  const [options, setOptions] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    sport: NO_FILTER,
    season: NO_FILTER,
    league_mode: NO_FILTER,
    simulation: NO_FILTER,
    timezone: NO_FILTER,
    ownerQuery: '',
  })
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    platformApi.leagueFilterOptions()
      .then(({ data, error }) => {
        if (error) setError(error)
        else setOptions(buildFilterOptions(data || []))
      })
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, filters])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await platformApi.leaguesList({ filters, search, page, pageSize: DEFAULT_PAGE_SIZE })
    setLoading(false)
    if (error) setError(error)
    else setRows(data)
  }, [filters, search, page])

  useEffect(() => { load() }, [load])

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  const parseSimulation = (v) =>
    v === NO_FILTER ? NO_FILTER : v === 'true'

  if (error) {
    return (
      <div className="page">
        <div className="page-title">Ligas de Plataforma</div>
        <div className="msg error">Unable to load leagues.</div>
      </div>
    )
  }

  const ownerMap = buildOwnerMap(rows?.ownerMap || [])
  const hasAnyFilter =
    search.trim() !== '' ||
    filters.sport || filters.season || filters.league_mode ||
    filters.simulation !== NO_FILTER || filters.timezone || filters.ownerQuery.trim() !== ''

  const modeOf = (league) => {
    const mode = LEAGUE_MODES[league.league_mode]
    return mode ? `${mode.icon} ${mode.label}` : league.league_mode
  }

  const countOf = (league, key) => league[key]?.[0]?.count ?? 0

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <div className="page-title">Ligas de Plataforma</div>
          <div className="page-sub">Consulta global de ligas (solo lectura)</div>
        </div>
        <button className="btn-ghost" onClick={() => navigate(platformRoute())}>← Consola</button>
      </div>

      <div className={styles.toolbar}>
        <select
          className="field"
          aria-label="Filtrar por deporte"
          value={filters.sport}
          onChange={(e) => setFilter('sport', e.target.value)}
        >
          <option value={NO_FILTER}>Deporte: Todos</option>
          {(options?.sports || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          className="field"
          aria-label="Filtrar por temporada"
          value={filters.season}
          onChange={(e) => setFilter('season', e.target.value)}
        >
          <option value={NO_FILTER}>Temporada: Todas</option>
          {(options?.seasons || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          className="field"
          aria-label="Filtrar por modo"
          value={filters.league_mode}
          onChange={(e) => setFilter('league_mode', e.target.value)}
        >
          <option value={NO_FILTER}>Modo: Todos</option>
          {(options?.modes || []).map((m) => (
            <option key={m} value={m}>{LEAGUE_MODES[m]?.label || m}</option>
          ))}
        </select>

        <select
          className="field"
          aria-label="Filtrar por simulación"
          value={filters.simulation}
          onChange={(e) => setFilter('simulation', parseSimulation(e.target.value))}
        >
          <option value={NO_FILTER}>Simulación: Todas</option>
          <option value="true">Simulación: Sí</option>
          <option value="false">Simulación: No</option>
        </select>

        <select
          className="field"
          aria-label="Filtrar por timezone"
          value={filters.timezone}
          onChange={(e) => setFilter('timezone', e.target.value)}
        >
          <option value={NO_FILTER}>Timezone: Todos</option>
          {(options?.timezones || []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <input
          className="field"
          placeholder="Owner (username)"
          value={filters.ownerQuery}
          onChange={(e) => setFilter('ownerQuery', e.target.value)}
        />

        <input
          className="field"
          placeholder="Buscar liga..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput) }}
        />
        <button className="btn-secondary" onClick={() => setSearch(searchInput)}>Buscar</button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="big">⏳</div>Cargando ligas...</div>
      ) : !rows || rows.items.length === 0 ? (
        <div className="empty-state">
          <div className="big">🏟️</div>
          {search.trim() !== ''
            ? `No results for "${search.trim()}".`
            : hasAnyFilter ? 'No leagues match the current filters.' : 'No leagues found.'}
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>League</th>
                  <th>Sport</th>
                  <th>Season</th>
                  <th>Mode</th>
                  <th>Sim</th>
                  <th>Owner</th>
                  <th>Members</th>
                  <th>Games</th>
                  <th>Picks</th>
                  <th>Timezone</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.items.map((league) => (
                  <tr
                    key={league.id}
                    className={styles.row}
                    onClick={() => navigate(platformLeagueRoute(league.id))}
                  >
                    <td className={styles.leagueCell}>{league.name}</td>
                    <td>{league.sport}</td>
                    <td>{league.season}</td>
                    <td>{modeOf(league)}</td>
                    <td>{league.simulation ? 'Sí' : 'No'}</td>
                    <td>{ownerName(ownerMap, league.admin_id)}</td>
                    <td>{countOf(league, 'league_members')}</td>
                    <td>{countOf(league, 'league_games')}</td>
                    <td>{countOf(league, 'picks')}</td>
                    <td>{league.timezone}</td>
                    <td>{new Date(league.created_at).toLocaleDateString('en-US', { dateStyle: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <button
              className="btn-ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            <span className={styles.pageInfo}>
              Página {page} de {Math.max(1, Math.ceil((rows.count || 0) / DEFAULT_PAGE_SIZE))} · {rows.count} ligas
            </span>
            <button
              className="btn-ghost"
              disabled={page * DEFAULT_PAGE_SIZE >= (rows.count || 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
