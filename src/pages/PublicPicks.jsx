import PublicPicksMatrix from '../components/PublicPicksMatrix'

// Ruta standalone de Picks Públicos. La misma matriz se embebe (expandible) en
// la Tabla de Posiciones vía PublicPicksMatrix (BUILD-017-E).
export default function PublicPicks({ league }) {
  return (
    <div className="page">
      <div className="page-title">👁️ Picks Públicos</div>
      <div className="page-sub">
        Los picks de todos los participantes por semana, para comparar qué juegos eligió cada miembro
      </div>
      <PublicPicksMatrix league={league} />
    </div>
  )
}