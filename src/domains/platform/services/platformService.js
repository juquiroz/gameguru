// BUILD-SUP-000 — Autorización de gestión de liga.
// Única fuente de verdad para decidir si un usuario gestiona una liga:
//   - es el admin directo (leagues.admin_id) o
//   - su membresía tiene role 'admin'.
// Reemplaza el chequeo inline repetido en 9 puntos:
//   src/pages/LeaguePage.jsx, src/pages/Lobby.jsx,
//   src/domains/dashboard/components/{LeagueDashboard,HomeDashboard,LeaguesSummary,LeaguesOverview}.jsx,
//   src/domains/dashboard/hooks/useDashboardData.js,
//   src/domains/training/hooks/useTrainingSession.js,
//   src/domains/game-week/GameWeekContext.jsx.
// `league.role` proviene del join de membresías (league_members.role).
export function canManageLeague(league, user) {
  if (!league || typeof league !== 'object' || !user || !user.id) return false
  return league.admin_id === user.id || league.role === 'admin'
}
