import { useState } from 'react'
import { TEAM_LOGOS } from '../data/nflData'

const LOGO_URL = 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500'

export default function TeamLogo({ abbr, className, size = 28 }) {
  const [failed, setFailed] = useState(false)

  if (failed || !abbr) {
    return <span className={className} style={{ fontSize: size }}>{TEAM_LOGOS[abbr] || '🏈'}</span>
  }

  return (
    <img
      src={`${LOGO_URL}/${abbr.toLowerCase()}.png`}
      alt={abbr}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      onError={() => setFailed(true)}
    />
  )
}
