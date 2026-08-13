// ─── Hook del mini-router (PLAN-LEAGUE-CONTEXT, Fase 1) ─────────────────────
// Suscribe el componente al evento `hashchange` y devuelve la ruta actual
// parseada. Idempotente (StrictMode-safe): agrega/remueve el listener limpio.

import { useEffect, useState } from 'react'
import { parseHash } from './hashRouter'

export function useHashRoute() {
  const getRoute = () => parseHash(
    typeof globalThis !== 'undefined' && globalThis.location
      ? globalThis.location.hash
      : ''
  )

  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const onChange = () => setRoute(getRoute())
    if (typeof globalThis !== 'undefined' && globalThis.addEventListener) {
      globalThis.addEventListener('hashchange', onChange)
      return () => globalThis.removeEventListener('hashchange', onChange)
    }
    return undefined
  }, [])

  return {
    route,
    hash: typeof globalThis !== 'undefined' && globalThis.location ? globalThis.location.hash : '',
  }
}
