import { useState } from 'react'
import { SPORTS } from '../data/nflData'
import { leaguesApi } from '../supabase'
import InviteModal from '../components/InviteModal'
import LeagueGamesManager from '../components/LeagueGamesManager'
import { canManageLeague } from '../domains/platform'

export default function LeaguePage({ user, league, onChangeLeague }) {
  const [showModal, setShowModal] = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const isAdmin    = canManageLeague(league, user)
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

      {isAdmin && (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)',
          padding: '1.5rem',
        }}>
          <LeagueGamesManager league={league} user={user} />
        </div>
      )}

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
