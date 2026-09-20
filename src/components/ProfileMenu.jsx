import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/context'
import { profilesApi, membersApi } from '../supabase'
import { isEmailLike } from '../domains/league/models/identity'
import styles from './ProfileMenu.module.css'

// ════════════════════════════════════════════════════════════════════
// ProfileMenu — resumen de perfil del usuario (clic en el email del Topbar)
//
// El email arriba a la derecha es el UNICO punto donde el app muestra la
// identidad real de la cuenta. Un clic abre este resumen para que el usuario
// pueda validar:
//   - su correo (cuenta registrada),
//   - su NOMBRE REAL (profiles.real_name) — privado; se les revela a los
//     demás jugadores cuando el admin finaliza y revela cada liga,
//   - su username global (si lo configuró),
//   - su nickname POR LIGA (el que aparece en tablas/picks de cada liga).
//
// Solo lee datos del propio usuario (profiles + sus memberships): respeta la
// privacidad de real_name (nunca se expone al resto del app).
// ════════════════════════════════════════════════════════════════════

export default function ProfileMenu({ user, league = null, myLeagues = [] }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const [nicks, setNicks] = useState(null)
  const rootRef = useRef(null)

  const toggle = () => setOpen(o => !o)

  useEffect(() => {
    if (!open || !user?.id) return
    let active = true
    profilesApi.get(user.id).then(({ data }) => { if (active) setProfile(data || null) })
    const leagues = (myLeagues || []).filter(Boolean)
    if (leagues.length) {
      Promise.all(leagues.map(async lg => {
        const res = await membersApi.getMyMembership(lg.id, user.id)
        return { leagueId: lg.id, leagueName: lg.name, nickname: res?.data?.nickname || null }
      })).then(rows => { if (active) setNicks(rows) })
    } else {
      setNicks([])
    }
    return () => { active = false }
  }, [open, user?.id, myLeagues])

  // Cierra al hacer clic fuera o pulsar Esc.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const email = user?.email || ''
  const emailPrefix = (email || '?').split('@')[0]
  const realName = profile?.real_name && String(profile?.real_name).trim() ? String(profile?.real_name).trim() : null
  const realLooksEmail = !!(realName && isEmailLike(realName))
  const username = profile?.username && String(profile?.username).trim() ? String(profile?.username).trim() : null

  const initials = realName && !realLooksEmail
    ? realName.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    : emailPrefix.slice(0, 1).toUpperCase()

  return (
    <div ref={rootRef} className={styles.wrap}>
      <button
        className={`${styles.userBtn} ${open ? styles.open : ''}`}
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        title={t('topbar.profileOpen')}
      >
        <span className={styles.email}>{emailPrefix}</span>
        <span className={styles.chevron}>▾</span>
      </button>

      {open && (
        <div className={styles.menu} role="dialog" aria-label={t('topbar.profile')}>
          <div className={styles.userHead}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.userWho}>
              <div className={styles.userEmail}>{email}</div>
              {realName && !realLooksEmail && (
                <div className={styles.userReal}>{realName}</div>
              )}
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.blockLabel}>{t('topbar.profileRealName')}</div>
            {realName ? (
              <div className={styles.realValue}>{realName}</div>
            ) : (
              <div className={styles.realEmpty}>
                {t('topbar.profileRealNameEmpty')}
              </div>
            )}
            <div className={styles.lockNote}>
              🔒 {realLooksEmail ? t('topbar.profileRealNameInvalid') : t('topbar.profileRealNameHint')}
            </div>
          </div>

          {username && (
            <div className={styles.block}>
              <div className={styles.blockLabel}>{t('topbar.profileUsername')}</div>
              <div className={styles.realValue}>{username}</div>
            </div>
          )}

          <div className={styles.block}>
            <div className={styles.blockLabel}>{t('topbar.profileLeagueNicks')}</div>
            {nicks && (
              nicks.length === 0 ? (
                <div className={styles.nickEmpty}>{t('topbar.profileNoLeagues')}</div>
              ) : (
                <ul className={styles.nickList}>
                  {nicks.map(n => (
                    <li key={n.leagueId} className={styles.nickRow}>
                      <span className={styles.nickLeague}>{n.leagueName}</span>
                      <span className={n.nickname ? styles.nickValue : styles.nickValueEmpty}>
                        {n.nickname || t('topbar.profileNoNickname')}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>

          {league && league.name && (
            (() => {
              const nick = nicks && nicks.find(n => n.leagueId === league.id)?.nickname
              return nick
                ? <div className={styles.helpLine}>{t('topbar.profileNickCurrent', { nick, league: league.name })}</div>
                : null
            })()
          )}
        </div>
      )}
    </div>
  )
}