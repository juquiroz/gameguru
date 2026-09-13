import { useEffect, useRef } from 'react'

// BUILD-AUTO-RESULTS-002 — auto-refresh silencioso para que los resultados
// (scores/finished en league_games) se reflejen solos en la UI sin recargar la
// página. No usa la huella reactiva: delega el callback actual vía ref para no
// reinstalar el intervalo cuando cambia de semana/selección.
//
// onRefresh: función a ejecutar en cada tick. Se llama solo con la pestaña
// visible (document.visibilityState === 'visible') para no gastar requests
// cuando el usuario está en otra pestaña.
export function useAutoRefresh(onRefresh, intervalMs) {
  const cbRef = useRef(onRefresh)
  cbRef.current = onRefresh

  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return undefined
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        cbRef.current?.()
      }
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}