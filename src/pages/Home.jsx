import HomeDashboard from '../domains/dashboard/components/HomeDashboard'
import styles from './Home.module.css'

export default function Home(props) {
  const { loadingLeagues } = props

  if (loadingLeagues) {
    return (
      <div className={styles.wrap}>
        <div className={styles.loading}>Cargando...</div>
      </div>
    )
  }

  return <HomeDashboard {...props} />
}
