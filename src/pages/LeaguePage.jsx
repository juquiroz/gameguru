import { useState, useEffect } from 'react'
import { SPORTS } from '../data/nflData'
import { leaguesApi, membersApi } from '../supabase'
import InviteModal from '../components/InviteModal'
import LeagueGamesManager from '../components/LeagueGamesManager'
import { canManageLeague } from '../domains/platform'
import { useLanguage } from '../i18n/context'

export default function LeaguePage({ user, league, onChangeLeague }) {
  const { t } = useLanguage()
  // BUILD-017: la admin section se usa en hooks (efectos), así que se calcula
  // antes del early-return. canManageLeague(null, user) → false, es seguro.
  const isAdmin = canManageLeague(league, user)
  const [showModal, setShowModal] = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [lifecycle, setLifecycle] = useState({ finished: false, revealed: false })
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  // BUILD-017 — gestión de participantes (solo admin).
  const [members, setMembers] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!league?.id || !isAdmin) return
    let active = true
    leaguesApi.getMembers(league.id).then(({ data }) => {
      if (active && data) setMembers(data)
    })
    return () => { active = false }
  }, [league?.id, isAdmin])

  if (!league) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="big">🏟️</div>
          No hay liga activa.
        </div>
      </div>
    )
  }

  const sportIcon  = SPORTS.find(s => s.id === league.sport)?.icon || '🏆'
  const inviteLink = `${window.location.origin}${window.location.pathname}?join=${league.code}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  // BUILD-AUTH-NICK-001: ciclo de revelación admin (Finalizar → Revelar).
  // Carga el estado persistido; localmente se sincroniza con league si viene.
  useEffect(() => {
    if (!league?.id) return
    let active = true
    leaguesApi.getLeadLifecycle(league.id).then(({ data }) => {
      if (!active || !data) return
      setLifecycle({ finished: !!data.finished, revealed: !!data.revealed })
    })
    return () => { active = false }
  }, [league?.id])

  useEffect(() => {
    if (league && typeof league.finished === 'boolean') {
      setLifecycle(prev => ({ ...prev, finished: !!league.finished }))
    }
    if (league && typeof league.revealed === 'boolean') {
      setLifecycle(prev => ({ ...prev, revealed: !!league.revealed }))
    }
  }, [league?.finished, league?.revealed])

  const finishLeague = async () => {
    setLifecycleBusy(true)
    const { error } = await leaguesApi.updateLeadLifecycle(league.id, { finished: true })
    setLifecycleBusy(false)
    if (error) return alert('Error al finalizar la liga: ' + error.message)
    setLifecycle(prev => ({ ...prev, finished: true }))
    setConfirmFinish(false)
  }

  const revealNames = async () => {
    setLifecycleBusy(true)
    const { error } = await leaguesApi.updateLeadLifecycle(league.id, { revealed: true })
    setLifecycleBusy(false)
    if (error) return alert('Error al revelar nombres: ' + error.message)
    setLifecycle(prev => ({ ...prev, revealed: true }))
  }

  const canReveal = lifecycle.finished && !lifecycle.revealed

  // BUILD-017 — quitar participante: delega en el RPC (valida admin y límites
  // en BD). Al éxito se refresca la lista local sin recargar.
  const handleRemoveMember = async (member) => {
    setRemoving(true)
    const { error } = await membersApi.removeMember(league.id, member.user_id)
    setRemoving(false)
    if (error) return alert('Error al quitar participante: ' + error.message)
    setMembers(prev => (prev || []).filter(x => x.user_id !== member.user_id))
    setRemoveTarget(null)
  }

  return (
    <div className="page">
      <div className="page-title">Mi Liga</div>
      <div className="page-sub">{league.name} · {league.sport}</div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="s-label">Deporte</div>
          <div className="s-val">{sportIcon}</div>
          <div className="s-sub">{league.sport}</div>
        </div>
        <div className="stat-card">
          <div className="s-label">Tu Rol</div>
          <div className="s-val" style={{ fontSize: '1.4rem', color: isAdmin ? 'var(--accent)' : 'var(--text)' }}>
            {isAdmin ? '👑' : '🏈'}
          </div>
          <div className="s-sub">{isAdmin ? 'Administrador' : 'Miembro'}</div>
        </div>
      </div>

      <div style={{
        background: 'var(--bg2)',
        border: `1px solid ${isAdmin ? 'rgba(245,166,35,.3)' : 'var(--border)'}`,
        borderRadius: 'var(--r-xl)',
        padding: '1.5rem',
        marginBottom: '1rem',
      }}>
        <div className="sec-title">
          {isAdmin ? '🔗 Enlace de Invitación' : '📋 Código de la Liga'}
        </div>
        <p style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '1rem', lineHeight: 1.5 }}>
          {isAdmin
            ? 'Comparte este enlace o código para que otros se unan a tu liga.'
            : 'Comparte este código con amigos para invitarlos.'}
        </p>

        <div className="invite-code-box">
          <span className="invite-code">{league.code}</span>
          <span className="invite-hint">Código de invitación</span>
        </div>

        {isAdmin && (
          <>
            <div className="invite-link-box">{inviteLink}</div>
            <button className="btn-primary" onClick={handleCopy}>
              {copied ? '✓ Enlace copiado' : '📋 Copiar enlace de invitación'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowModal(true)}
              style={{ width: '100%', marginTop: '8px' }}
            >
              Ver modal de invitación
            </button>
          </>
        )}
      </div>

      {showModal && (
        <InviteModal
          league={league}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* BUILD-017 — gestión de participantes (solo admin): lista a los
          miembros y permite quitar a cualquiera salvo al dueño y a sí mismo. */}
      {isAdmin && (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)',
          padding: '1.5rem',
          marginBottom: '1rem',
        }}>
          <div className="sec-title">👥 Participantes ({members?.length ?? 0})</div>
          {!members ? (
            <p style={{ fontSize: '.85rem', color: 'var(--text3)' }}>Cargando...</p>
          ) : members.length === 0 ? (
            <p style={{ fontSize: '.85rem', color: 'var(--text3)' }}>Sin participantes.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {members.map(m => {
                const isOwner = m.user_id === league.admin_id
                const isSelf = m.user_id === user.id
                const shortId = (m.user_id || '').slice(0, 4)
                return (
                  <li key={m.user_id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.5rem',
                    padding: '.55rem 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      {isOwner ? '👑 ' : '🏈 '}
                      <strong>{m.nickname || `Jugador ${shortId}`}</strong>
                      <span style={{ color: 'var(--text3)', fontSize: '.75rem', marginLeft: '.5rem' }}>
                        {isOwner ? 'admin (dueño)' : m.role === 'admin' ? 'co-admin' : 'miembro'}
                      </span>
                      {isSelf && (
                        <span style={{ color: 'var(--accent)', fontSize: '.75rem', marginLeft: '.5rem' }}>(vos)</span>
                      )}
                    </span>
                    {!isOwner && !isSelf && (
                      removeTarget?.user_id === m.user_id ? (
                        <span style={{ display: 'inline-flex', gap: '.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <span style={{ color: 'var(--red)', fontSize: '.78rem' }}>¿Quitar?</span>
                          <button
                            className="btn-primary"
                            style={{ padding: '.25rem .6rem', fontSize: '.75rem', background: 'var(--red)', borderColor: 'var(--red)' }}
                            onClick={() => handleRemoveMember(m)}
                            disabled={removing}
                          >
                            {removing ? '...' : 'Quitar'}
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '.25rem .6rem', fontSize: '.75rem' }}
                            onClick={() => setRemoveTarget(null)}
                            disabled={removing}
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          className="btn-secondary"
                          style={{ padding: '.25rem .6rem', fontSize: '.75rem', flexShrink: 0 }}
                          onClick={() => setRemoveTarget(m)}
                        >
                          Quitar
                        </button>
                      )
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* BUILD-AUTH-NICK-001: ciclo de revelación admin (Finalizar → Revelar) */}
      {isAdmin && (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)',
          padding: '1.5rem',
          marginBottom: '1rem',
        }}>
          {lifecycle.revealed ? (
            <div style={{ color: 'var(--green)', fontSize: '.9rem', fontWeight: 600 }}>
              {t('league.namesRevealed')}
            </div>
          ) : (
            <>
              {lifecycle.finished ? (
                <div className="msg info">{t('league.finishedBadge')}</div>
              ) : (
                <p style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  {t('league.finishHint')}
                </p>
              )}

              {!lifecycle.finished ? (
                confirmFinish ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--accent)', fontSize: '.85rem' }}>{t('league.finishConfirm')}</span>
                    <button
                      className="btn-primary"
                      style={{ flexShrink: 0 }}
                      onClick={finishLeague}
                      disabled={lifecycleBusy}
                    >
                      {lifecycleBusy ? t('auth.loading') : t('league.finish')}
                    </button>
                    <button className="btn-secondary" onClick={() => setConfirmFinish(false)}>Cancelar</button>
                  </div>
                ) : (
                  <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setConfirmFinish(true)}>
                    {t('league.finish')}
                  </button>
                )
              ) : (
                <button
                  className="btn-primary"
                  style={{ width: '100%' }}
                  onClick={revealNames}
                  disabled={lifecycleBusy}
                >
                  {t('league.reveal')}
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)',
        padding: '1.5rem',
      }}>
        <LeagueGamesManager league={league} user={user} readOnly={!isAdmin} />
      </div>

      {isAdmin && (
        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--red)', fontSize: '.85rem' }}>
                ⚠ ¿Eliminar la liga <strong>{league.name}</strong>? Se borrarán todos los datos (picks, miembros, juegos).
              </span>
              <button
                className="btn-primary"
                onClick={async () => {
                  setDeleting(true)
                  try {
                    console.log('deleteLeague onClick – empezando')
                    const { error } = await leaguesApi.delete(league.id)
                    console.log('deleteLeague onClick – resultado:', error)
                    if (error) { alert('Error: ' + error.message); setDeleting(false); return }
                  } catch (ex) {
                    console.error('deleteLeague onClick – excepción:', ex)
                    alert('Error inesperado: ' + (ex?.message || 'desconocido'))
                    setDeleting(false)
                    return
                  }
                  onChangeLeague()
                }}
                disabled={deleting}
                style={{ background: 'var(--red)', flexShrink: 0 }}
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar liga'}
              </button>
              <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                padding: '0.5rem 1rem',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '.78rem',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                border: '1px solid rgba(239,68,68,.3)',
                color: 'var(--red)',
                borderRadius: 'var(--r-sm)',
                background: 'none',
                cursor: 'pointer',
              }}
            >
              🗑 Eliminar esta liga
            </button>
          )}
        </div>
      )}
    </div>
  )
}
