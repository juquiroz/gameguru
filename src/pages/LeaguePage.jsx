import { useState } from 'react'
import { SPORTS } from '../data/nflData'
import InviteModal from '../components/InviteModal'

export default function LeaguePage({ user, league }) {
  const [showModal, setShowModal] = useState(false)
  const [copied,    setCopied]    = useState(false)

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

  const isAdmin    = league.admin_id === user?.id || league.role === 'admin'
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

      {/* League info */}
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

      {/* Invite section — visible to everyone but emphasized for admin */}
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

      {/* Invite modal */}
      {showModal && (
        <InviteModal
          league={league}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
