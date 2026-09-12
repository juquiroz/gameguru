import { useState } from 'react'
import styles from './InviteModal.module.css'

export default function InviteModal({ league, onClose }) {
  const [copied, setCopied] = useState(false)
  if (!league) return null

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

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-box">
        <div className="modal-title">🎉 Liga Creada</div>
        <div className="modal-sub">
          Comparte este código o enlace con tus amigos para que se unan a <strong>{league.name}</strong>.
        </div>

        <div className="invite-code-box">
          <span className="invite-code">{league.code}</span>
          <span className="invite-hint">Código de invitación</span>
        </div>

        <div className="invite-link-box">{inviteLink}</div>

        <div className={styles.actions}>
          <button className="btn-primary" onClick={handleCopy} style={{ flex: 1, padding: '0.7rem' }}>
            {copied ? '✓ Copiado' : '📋 Copiar enlace'}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        {copied && (
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--green)', marginTop: '0.75rem' }}>
            ✓ Enlace copiado al portapapeles
          </p>
        )}
      </div>
    </div>
  )
}
