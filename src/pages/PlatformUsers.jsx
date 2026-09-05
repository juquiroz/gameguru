import { useState, useEffect, useCallback } from 'react'
import { platformApi } from '../supabase'
import {
  USER_NO_FILTER,
  DEFAULT_USERS_PAGE_SIZE,
  buildUserFilterOptions,
  normalizePlatformRole,
} from '../domains/platform'
import { navigate, platformRoute, platformUserRoute } from '../router/routes'
import styles from './PlatformUsers.module.css'

// BUILD-SUP-003 — Listado global de usuarios (read-only).
// La API arma el índice client-side (4 reads planos + dominio puro) y devuelve
// { items, count }; cada item trae leaguesCount/administers/picksCount/
// lastActivity ya calculados. La UI no define lógica de filtrado.
const ROLE_LABEL = {
  user: 'Usuario',
  platform_admin: 'Admin de plataforma',
  platform_superadmin: 'Superadmin',
}

const fmt = (v) =>
  v ? new Date(v).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export default function PlatformUsers() {
  const [options, setOptions] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    platform_role: USER_NO_FILTER,
    has_leagues: USER_NO_FILTER,
    has_picks: USER_NO_FILTER,
    league_role: USER_NO_FILTER,
    participation_mode: USER_NO_FILTER,
    simulation: USER_NO_FILTER,
  })
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    platformApi.userFilterOptions()
      .then(({ data, error }) => {
        if (error) setError(error)
        else setOptions({ ...buildUserFilterOptions(), ...data })
      })
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, filters])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await platformApi.usersList({ filters, search, page, pageSize: DEFAULT_USERS_PAGE_SIZE })
    setLoading(false)
    if (error) setError(error)
    else setRows(data)
  }, [filters, search, page])

  useEffect(() => { load() }, [load])

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  if (error) {
    return (
      <div className="page">
        <div className="page-title">Usuarios de Plataforma</div>
        <div className="msg error">Unable to load users.</div>
        <button className="btn-ghost" onClick={() => navigate(platformRoute())}>← Consola</button>
      </div>
    )
  }

  const hasAnyFilter =
    search.trim() !== '' ||
    filters.platform_role !== USER_NO_FILTER ||
    filters.has_leagues !== USER_NO_FILTER ||
    filters.has_picks !== USER_NO_FILTER ||
    filters.league_role !== USER_NO_FILTER ||
    filters.participation_mode !== USER_NO_FILTER ||
    filters.simulation !== USER_NO_FILTER

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <div className="page-title">Usuarios de Plataforma</div>
          <div className="page-sub">Consulta global de usuarios (solo lectura)</div>
        </div>
        <button className="btn-ghost" onClick={() => navigate(platformRoute())}>← Consola</button>
      </div>

      <div className={styles.toolbar}>
        <select
          className="field"
          aria-label="Filtrar por rol de plataforma"
          value={filters.platform_role}
          onChange={(e) => setFilter('platform_role', e.target.value)}
        >
          <option value={USER_NO_FILTER}>Rol: Todos</option>
          {(options?.platformRoles || []).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>
          ))}
        </select>

        <select
          className="field"
          aria-label="Filtrar por ligas"
          value={filters.has_leagues}
          onChange={(e) => setFilter('has_leagues', e.target.value)}
        >
          <option value={USER_NO_FILTER}>Ligas: Todas</option>
          <option value="yes">En ≥1 liga</option>
          <option value="no">Sin ligas</option>
        </select>

        <select
          className="field"
          aria-label="Filtrar por picks"
          value={filters.has_picks}
          onChange={(e) => setFilter('has_picks', e.target.value)}
        >
          <option value={USER_NO_FILTER}>Picks: Todos</option>
          <option value="yes">Con picks</option>
          <option value="no">Sin picks</option>
        </select>

        <select
          className="field"
          aria-label="Filtrar por rol en liga"
          value={filters.league_role}
          onChange={(e) => setFilter('league_role', e.target.value)}
        >
          <option value={USER_NO_FILTER}>Rol en liga: Todos</option>
          {(options?.leagueRoles || []).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select
          className="field"
          aria-label="Filtrar por modo de participación"
          value={filters.participation_mode}
          onChange={(e) => setFilter('participation_mode', e.target.value)}
        >
          <option value={USER_NO_FILTER}>Modo: Todos</option>
          {(options?.participationModes || []).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          className="field"
          aria-label="Filtrar por simulación"
          value={filters.simulation}
          onChange={(e) => setFilter('simulation', e.target.value)}
        >
          <option value={USER_NO_FILTER}>Simulación: Todas</option>
          <option value="true">Simulación: Sí</option>
          <option value="false">Simulación: No</option>
        </select>

        <input
          className="field"
          placeholder="Buscar usuario..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput) }}
        />
        <button className="btn-secondary" onClick={() => setSearch(searchInput)}>Buscar</button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="big">⏳</div>Cargando usuarios...</div>
      ) : !rows || rows.items.length === 0 ? (
        <div className="empty-state">
          <div className="big">👥</div>
          {search.trim() !== ''
            ? `No results for "${search.trim()}".`
            : hasAnyFilter ? 'No users match the current filters.' : 'No users found.'}
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Platform Role</th>
                  <th>Registered</th>
                  <th>Leagues</th>
                  <th>Administers</th>
                  <th>Picks</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {rows.items.map((user) => (
                  <tr
                    key={user.id}
                    className={styles.row}
                    onClick={() => navigate(platformUserRoute(user.id))}
                  >
                    <td className={styles.userCell}>{user.username || '—'}</td>
                    <td>{ROLE_LABEL[normalizePlatformRole(user.platform_role)] || user.platform_role}</td>
                    <td>{fmt(user.created_at)}</td>
                    <td>{user.leaguesCount}</td>
                    <td>{user.administers}</td>
                    <td>{user.picksCount}</td>
                    <td>{user.lastActivity ? fmt(user.lastActivity) : '—'}</td>
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
              Página {page} de {Math.max(1, Math.ceil((rows.count || 0) / DEFAULT_USERS_PAGE_SIZE))} · {rows.count} usuarios
            </span>
            <button
              className="btn-ghost"
              disabled={page * DEFAULT_USERS_PAGE_SIZE >= (rows.count || 0)}
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
