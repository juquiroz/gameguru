import { useLanguage } from '../i18n/context'
import TrainingCampPage from '../domains/training-camp/components/TrainingCampPage'

export default function TrainingCamp({ user, league }) {
  const { t } = useLanguage()

  if (!league) {
    return (
      <div className="page">
        <div className="page-title">🎓 {t('training.name')}</div>
        <div className="empty-state">
          <div className="big">🎓</div>
          {t('training.needLeague')}
        </div>
      </div>
    )
  }

  return <TrainingCampPage user={user} league={league} />
}
