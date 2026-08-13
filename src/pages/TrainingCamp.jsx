import { useLanguage } from '../i18n/context'
import TrainingCampLobby from '../domains/training/components/TrainingCampLobby'

export default function TrainingCamp({ user, league, onConfigure }) {
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

  return <TrainingCampLobby user={user} league={league} onConfigure={onConfigure} />
}
