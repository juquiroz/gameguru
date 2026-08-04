import { useState } from 'react'
import { useLanguage } from '../../../i18n/context'

export default function CopyReminder({ league, week, deadline }) {
  const { t, lang } = useLanguage()
  const [copied, setCopied] = useState(false)

  const fmtDeadline = () => {
    if (!deadline) return ''
    const d = new Date(deadline)
    if (isNaN(d)) return ''
    const locale = lang === 'en' ? 'en-US' : 'es-MX'
    return d.toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const handleCopy = async () => {
    const msg = t('dashboard.reminderText', {
      league: league?.name || '',
      week,
      deadline: fmtDeadline(),
    })
    try {
      await navigator.clipboard.writeText(msg)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button className="btn-ghost" style={{ flex: 1 }} onClick={handleCopy}>
      {copied ? t('dashboard.reminderCopied') : t('dashboard.copyReminder')}
    </button>
  )
}
