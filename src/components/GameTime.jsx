const DATE_REGEX = /^\d{4}-\d{2}-\d{2}/

export default function GameTime({ when, className }) {
  if (!when) return null

  if (DATE_REGEX.test(when)) {
    const normalized = when.trim().replace(' ', 'T').replace(/Z$/, '-05:00')
    const date = new Date(normalized)
    if (!isNaN(date)) {
      const formatted = new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(date)
      return <time className={className} dateTime={normalized}>{formatted}</time>
    }
  }

  return <span className={className}>{when}</span>
}
