import { useState } from 'react'
import { SPORTS } from '../data/nflData'
import { leaguesApi } from '../supabase'
import InviteModal from '../components/InviteModal'
import { canManageLeague } from '../domains/platform'
import styles from './Lobby.module.css'

export default function Lobby({ user, myLeagues, loadingLeagues, onCreateLeague, onJoinLeague, onEnterLeague, onRefreshLeagues }) {
  const [tab,            setTab]            = useState('ligas')
  const [leagueName,     setLeagueName]     = useState('')
  const [selectedSport,  setSelectedSport]  = useState('NFL')
  const [joinCode,       setJoinCode]       = useState('')
  const [creating,       setCreating]       = useState(false)
  const [joining,        setJoining]        = useState(false)
  const [createMsg,      setCreateMsg]      = useState(null)
  const [joinMsg,        setJoinMsg]        = useState(null)
  const [inviteLeague,   setInviteLeague]   = useState(null) // shows modal

  // Pre-fill join code from URL ?join=XXXXXX
  useState(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('join')
    if (code) setJoinCode(code.toUpperCase())
  })

  const handleCreate = async () => {
    if (!leagueName.trim()) return setCreateMsg({ type: 'error', text: 'Escribe un nombre para la liga.' })
    setCreating(true)
    setCreateMsg(null)
    const { data, error } = await onCreateLeague(leagueName.trim(), selectedSport)
    setCreating(false)
    if (error) { setCreateMsg({ type: 'error', text: error.message }); return }
    setLeagueName('')
    setInviteLeague(data)  // open invite modal
  }

  const handleJoin = async () => {
    if (joinCode.length !== 6) return setJoinMsg({ type: 'error', text: 'El código debe tener 6 caracteres.' })
    setJoining(true)
    setJoinMsg(null)
    const { data, error, alreadyMember } = await onJoinLeague(joinCode)
    setJoining(false)
    if (error) { setJoinMsg({ type: 'error', text: error.message }); return }
    if (alreadyMember) {
      setJoinMsg({ type: 'info', text: 'Ya eres miembro de esa liga. Entrando...' })
    } else {
      setJoinMsg({ type: 'success', text: `✅ ¡Te uniste a ${data.name}!` })
    }
    setTimeout(() => { setJoinMsg(null); onEnterLeague(data) }, 1200)
  }

  const handleDeleteLeague = async (e, league) => {
    e.stopPropagation()
    if (!window.confirm(`¿Eliminar la liga "${league.name}"? Esta acción no se puede deshacer.`)) return
    if (!window.confirm('¿Estás seguro? Se borrarán todos los picks y datos asociados.')) return
    try {
      const { error } = await leaguesApi.delete(league.id)
      if (error) { alert('Error: ' + error.message); return }
    } catch (ex) {
      console.error('handleDeleteLeague excepción:', ex)
      alert('Error inesperado: ' + (ex?.message || 'desconocido'))
      return
    }
    onRefreshLeagues()
  }

  const username = user?.email?.split('@')[0] || 'Jugador'

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.brand}>GameGuru</div>
        <div className={styles.welcome}>
          Bienvenido, <span className={styles.uname}>{username}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'ligas' ? styles.tabActive : ''}`}
          onClick={() => setTab('ligas')}
        >🏆 Mis Ligas</button>
        <button
          className={`${styles.tab} ${tab === 'crear' ? styles.tabActive : ''}`}
          onClick={() => setTab('crear')}
        >➕ Crear</button>
        <button
          className={`${styles.tab} ${tab === 'unirse' ? styles.tabActive : ''}`}
          onClick={() => setTab('unirse')}
        >🔗 Unirse</button>
      </div>

      <div className={styles.body}>

        {/* Mis Ligas */}
        {tab === 'ligas' && (
          <div className={styles.card}>
            {loadingLeagues ? (
              <div className={styles.loadingText}>Cargando ligas...</div>
            ) : myLeagues.length === 0 ? (
              <>
                <div className={styles.cardTitle}>🏆 Mis Ligas</div>
                <div className={styles.cardSub}>Aún no estás en ninguna liga.</div>
              </>
            ) : (
              <>
                <div className={styles.cardTitle}>🏆 Mis Ligas</div>
                <div className={styles.cardSub}>Selecciona una liga para entrar.</div>
                <div className={styles.leagueList}>
                  {myLeagues.map(lg => (
                    <div
                      key={lg.id}
                      className={styles.leagueItem}
                      role="button"
                      tabIndex={0}
                      onClick={() => onEnterLeague(lg)}
                      onKeyDown={e => e.key === 'Enter' && onEnterLeague(lg)}
                    >
                      <div className={styles.leagueIcon}>
                        {SPORTS.find(s => s.id === lg.sport)?.icon || '🏆'}
                      </div>
                      <div className={styles.leagueInfo}>
                        <div className={styles.leagueName}>{lg.name}</div>
                        <div className={styles.leagueMeta}>{lg.sport} · {lg.code}</div>
                      </div>
                      {canManageLeague(lg, user) && (
                        <>
                          <span className={styles.adminBadge}>Admin</span>
                          <button
                            className={styles.deleteBtn}
                            onClick={e => handleDeleteLeague(e, lg)}
                            title="Eliminar liga"
                          >
                            ✕
                          </button>
                        </>
                      )}
                      <span className={styles.arrow}>›</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Crear liga */}
        {tab === 'crear' && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>➕ Crear Liga</div>
            <div className={styles.cardSub}>
              Crea tu propia liga y comparte el enlace de invitación.
            </div>

            <div className="field">
              <label>Nombre de la liga</label>
              <input
                type="text"
                placeholder="Ej: Los Carnales Fantasy"
                maxLength={40}
                value={leagueName}
                onChange={e => setLeagueName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <div className="field">
              <label>Deporte</label>
              <div className={styles.sportGrid}>
                {SPORTS.map(sport => (
                  <button
                    key={sport.id}
                    className={`${styles.sportBtn} ${selectedSport === sport.id ? styles.sportActive : ''}`}
                    onClick={() => setSelectedSport(sport.id)}
                  >
                    <span className={styles.sportIcon}>{sport.icon}</span>
                    <span className={styles.sportLabel}>{sport.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? 'Creando...' : 'Crear y obtener enlace de invitación'}
            </button>

            {createMsg && (
              <div className={`msg ${createMsg.type}`} style={{ marginTop: '0.75rem' }}>
                {createMsg.text}
              </div>
            )}
          </div>
        )}

        {/* Unirse a liga */}
        {tab === 'unirse' && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>🔗 Unirse a una Liga</div>
            <div className={styles.cardSub}>¿Tienes un código de invitación? Ingrésalo aquí.</div>

            <div className={styles.joinRow}>
              <input
                type="text"
                className={styles.codeInput}
                placeholder="Código de 6 letras"
                maxLength={6}
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
              <button
                className={`btn-secondary ${styles.joinBtn}`}
                onClick={handleJoin}
                disabled={joining}
              >
                {joining ? '...' : 'Unirme'}
              </button>
            </div>

            {joinMsg && (
              <div className={`msg ${joinMsg.type}`} style={{ marginTop: '0.75rem' }}>
                {joinMsg.text}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Invite modal after creating */}
      {inviteLeague && (
        <InviteModal
          league={inviteLeague}
          onClose={() => { setInviteLeague(null); onEnterLeague(inviteLeague) }}
        />
      )}
    </div>
  )
}
