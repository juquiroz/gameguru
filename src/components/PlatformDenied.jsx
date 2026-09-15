// BUILD-SUP-000 — Pantalla de acceso denegado para secciones de plataforma.
// Reemplaza el "drop silencioso" a dashboard cuando un usuario sin rol de
// plataforma navega a #superadmin / #platform.
export default function PlatformDenied({ onNavigate }) {
  return (
    <div className="page">
      <div className="empty-state">
        <div className="big">🔒</div>
        Acceso restringido.
        <div style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.25rem' }}>
          Solo administradores de plataforma pueden acceder a esta sección.
        </div>
        <button className="btn-secondary" style={{ marginTop: '1rem' }} onClick={() => onNavigate('dashboard')}>
          Volver al inicio
        </button>
      </div>
    </div>
  )
}
