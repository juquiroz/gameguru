import { sportsRepository } from '../repositories/sportsRepository'

export const sportsService = {
  getScoreboard: (sport, date) => sportsRepository.getScoreboard(sport, date),
  getNews: (sport) => sportsRepository.getNews(sport),
  getTeamStandings: (sport, season) => sportsRepository.getTeamStandings(sport, season),
}
