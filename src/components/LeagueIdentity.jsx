import { useLanguage } from '../i18n/context'
import { getLeagueMode } from '../domains/league'

// ════════════════════════════════════════════════════════════════════
// LeagueIdentity — identidad de la liga SIEMPRE visible (PLAN-01.1)
//
// Picks/Standings/Game Week no pueden depender solo del Topbar para
// mostrar en qué liga se está jugando. Este badge compacto renderiza:
//   🏆 {league.name} · {code} [🎓 Training Camp #n] [Semana n]
// Es puro y presentacional: recibe la liga y datos opcionales del evento
// (sessionNo para TC, week para la jornada/calendario).
// ════════════════════════════════════════════════════════════════════

export default function LeagueIdentity({ league, sessionNo, week }) {
  const { t } = useLanguage()
  if (!league) return null
  const isPractice = league.league_mode === 'practice' || league.simulation
  const mode = getLeagueMode(league)
  const modeCss = mode === 'practice' ? 'mode-tc' : mode === 'preseason' ? 'mode-ps' : 'mode-rs'

  return (
    <div className="league-identity">
      <span className="league-identity-main">{t('league.identity', { name: league.name })}</span>
      {league.code && <span className="league-identity-code">{t('league.identityCode', { code: league.code })}</span>}
      {isPractice && sessionNo != null ? (
        <span className="league-identity-chip">{t('league.identityTC', { no: sessionNo })}</span>
      ) : (
        mode !== 'regular' && <span className={`league-identity-chip ${modeCss}`}>{t(`modes.${mode}`)}</span>
      )}
      {week != null && <span className="league-identity-chip">{t('league.identityWeek', { week })}</span>}
    </div>
  )
}
