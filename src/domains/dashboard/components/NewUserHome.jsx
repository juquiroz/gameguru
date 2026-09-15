import { NFL_WEEKS } from '../../../data/nflData'
import TeamLogo from '../../../components/TeamLogo'
import styles from '../../../pages/Home.module.css'

const WEEKLY_GAMES = NFL_WEEKS[1]

export default function NewUserHome({ onCreateNew, onJoinClick }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <div className={styles.heroBrand}>GameGuru</div>
        <p className={styles.heroSub}>
          Tu pool de pronósticos deportivos. Crea una liga, invita a tus amigos y
          demuestra quién sabe más de la NFL.
        </p>
      </div>

      <div className={styles.features}>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🏆</span>
          <span className={styles.featureTitle}>Crea tu liga</span>
          <span className={styles.featureDesc}>Armá tu pool personalizado en segundos.</span>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>📨</span>
          <span className={styles.featureTitle}>Invita amigos</span>
          <span className={styles.featureDesc}>Compartí el código y que se unan al instante.</span>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🏅</span>
          <span className={styles.featureTitle}>Gana el pool</span>
          <span className={styles.featureDesc}>Más aciertos = más gloria (y bragging rights).</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className="btn-primary" style={{ flex: 1 }} onClick={onCreateNew}>
          ➕ Crear mi primera liga
        </button>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={onJoinClick}>
          🔗 Unirme a una liga
        </button>
      </div>

      <div className={styles.preview}>
        <div className={styles.previewTitle}>📅 Partidos de la Semana 1</div>
        <div className={styles.gameList}>
          {WEEKLY_GAMES.games.slice(0, 4).map(g => (
            <div key={g.id} className={styles.gameCard}>
              <span className={styles.gameTeam}>
                <TeamLogo abbr={g.aA} size={18} />
                {g.away}
              </span>
              <span className={styles.gameVs}>@</span>
              <span className={styles.gameTeam}>
                <TeamLogo abbr={g.hA} size={18} />
                {g.home}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
