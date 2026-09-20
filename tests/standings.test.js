import { describe, it } from 'node:test'
import assert from 'node:assert'
import { calcStandings, calcStreak, calcStreaks } from '../src/utils/standings.js'

// BUILD-017-B — juegos cerrados ANTES de que el usuario se una cuentan como
// fallidos en su tabla (denominador total, 0 aciertos).
const now = Date.now()
const H = 3600 * 1000
const M = 60 * 1000
const iso = (ms) => new Date(ms).toISOString()

// Kickoffs: A ayer (cerrado hace rato), B hace 1h, C dentro de 2h.
const gameA = { game_id: 'A', game_time: iso(now - 24 * H), result: 'KC', finished: true }
const gameB = { game_id: 'B', game_time: iso(now - 1 * H), result: 'BUF', finished: true }
const gameC = { game_id: 'C', game_time: iso(now + 2 * H), result: 'DAL', finished: true }
const gameNoResult = { game_id: 'X', game_time: iso(now - 24 * H), finished: true } // sin result → nunca cuenta

const games = [gameA, gameB, gameC, gameNoResult]

// synthetic users
const JOE = 'u-joe'
const PAT = 'u-pat'
const MIA = 'u-mia'

describe('calcStandings — BUILD-017-C (matching robusto de claves)', () => {
  it('un pick guardado contra league_games.id (UUID) matchea igual que el master game_id', () => {
    const lg = [
      { id: 'lg-1', game_id: 'MASTER-1', game_time: iso(now - 24 * H), result: 'KC', finished: true },
      { id: 'lg-2', game_id: 'MASTER-2', game_time: iso(now - 24 * H), result: 'BUF', finished: true },
    ]
    const picks = [
      { user_id: JOE, game_id: 'lg-1', pick: 'KC' },   // clave UUID
      { user_id: JOE, game_id: 'MASTER-2', pick: 'BUF' }, // clave maestro
    ]
    const rows = calcStandings(picks, lg, {}, { now })
    assert.strictEqual(rows[0].total, 2)
    assert.strictEqual(rows[0].correct, 2)
  })

  it('un partido manual (game_id NULL) guardado con su UUID cuenta en standings y fallidos', () => {
    const lg = [
      { id: 'lg-manual-1', game_id: null, game_time: iso(now - 24 * H), result: 'SEA', finished: true },
      { id: 'lg-manual-2', game_id: null, game_time: iso(now - 24 * H), result: 'GB', finished: true },
    ]
    const picks = [{ user_id: MIA, game_id: 'lg-manual-1', pick: 'SEA' }] // correct por UUID
    const rows = calcStandings(picks, lg, {}, { now })
    assert.strictEqual(rows[0].total, 2) // lg-manual-1 (acierto) + lg-manual-2 (fallido)
    assert.strictEqual(rows[0].correct, 1)
  })
})

describe('calcStandings — BUILD-017-G2 (todo juego cerrado sin pick = fallido)', () => {
  it('sin picks de un juego cerrado, el fallido se suma aunque haya pickeado otro', () => {
    const picks = [
      { user_id: JOE, game_id: 'A', pick: 'KC' },  // correct
      { user_id: JOE, game_id: 'C', pick: 'CIN' }, // wrong
      { user_id: PAT, game_id: 'C', pick: 'DAL' }, // correct
    ]
    const rows = calcStandings(picks, games, {}, { now })
    const joe = rows.find(r => r.userId === JOE)
    const pat = rows.find(r => r.userId === PAT)
    // Joe: A y C pickeados (1 acierto) + B y X cerrados sin pick = 4.
    assert.strictEqual(joe.total, 4)
    assert.strictEqual(joe.correct, 1)
    // Pat: C (acierto) + A, B y X cerrados sin pick = 4.
    assert.strictEqual(pat.total, 4)
    assert.strictEqual(pat.correct, 1)
  })

  it('un juego aún abierto (deadline futuro) no cuenta como fallido', () => {
    const picks = [
      { user_id: JOE, game_id: 'A', pick: 'KC' },  // correct
      { user_id: JOE, game_id: 'B', pick: 'BUF' }, // correct
      { user_id: PAT, game_id: 'C', pick: 'DAL' }, // correct
    ]
    const rows = calcStandings(picks, games, {}, { now })
    const joe = rows.find(r => r.userId === JOE)
    const pat = rows.find(r => r.userId === PAT)
    // Joe: A y B (2 aciertos) + X cerrado sin pick = 3. C (future) no cuenta.
    assert.strictEqual(joe.total, 3)
    assert.strictEqual(joe.correct, 2)
    // Pat: C (acierto) + A, B y X cerrados sin pick = 4.
    assert.strictEqual(pat.total, 4)
    assert.strictEqual(pat.correct, 1)
  })

  it('el olvido sí penitencia: un juego cerrado que pudo elegir y no eligió cuenta', () => {
    const picks = [{ user_id: MIA, game_id: 'A', pick: 'KC' }]
    // MIA estaba en la liga mucho antes del kickoff; eligió A y se olvidó de B.
    const rows = calcStandings(picks, games, {}, { now })
    const mia = rows.find(r => r.userId === MIA)
    assert.strictEqual(mia.total, 3) // A acertado + B y X fallidos (C sigue abierto)
    assert.strictEqual(mia.correct, 1)
  })

  it('un juego cerrado SIN resultado cuenta como fallido (con o sin result)', () => {
    const picks = [{ user_id: JOE, game_id: 'A', pick: 'KC' }]
    const rows = calcStandings(picks, games, {}, { now })
    const joe = rows.find(r => r.userId === JOE)
    // A (pick) + B y X (fallidos; X sin resultado pero kickoff ya pasó) = 3.
    // C (deadline futuro) no cuenta.
    assert.strictEqual(joe.total, 3)
    assert.strictEqual(joe.correct, 1)
  })

  it('el juego que el usuario SÍ pickeó sin resultado no se marca fallido', () => {
    const lg = [
      { game_id: 'P1', game_time: iso(now - 24 * H), result: 'KC', finished: true },
      { game_id: 'P2', game_time: iso(now - 1 * H), finished: true }, // pickeado, sin resultado aún
    ]
    const picks = [
      { user_id: JOE, game_id: 'P2', pick: 'BUF' }, // ya lo eligió
    ]
    const rows = calcStandings(picks, lg, {}, { now })
    const joe = rows.find(r => r.userId === JOE)
    // P1 cerrado (sin pick) → fallido; P2 elegido → no cuenta como fallido ni
    // como acierto (sin resultado). total 1.
    assert.strictEqual(joe.total, 1)
    assert.strictEqual(joe.correct, 0)
  })

  it('Caso reportado: primer juego ya jugado sin pick → fallido (1/1 → 1/2)', () => {
    const lg = [
      { game_id: 'V1', game_time: iso(now - 20 * H), finished: false }, // ya jugado, sin resultado
      { game_id: 'V2', game_time: iso(now - 2 * H), result: 'KC', finished: true },
    ]
    const picks = [{ user_id: JOE, game_id: 'V2', pick: 'KC' }] // acierto al segundo
    const rows = calcStandings(picks, lg, {}, { now })
    const joe = rows.find(r => r.userId === JOE)
    assert.strictEqual(joe.total, 2) // V2 acertado + V1 perdido (no pickeado, kickoff pasado)
    assert.strictEqual(joe.correct, 1)
  })

  it('no usa joined_at: todos los miembros reciben fallidos de juegos cerrados', () => {
    const picks = [{ user_id: MIA, game_id: 'A', pick: 'KC' }]
    const rows = calcStandings(picks, games, {}, { now })
    const mia = rows.find(r => r.userId === MIA)
    assert.strictEqual(mia.total, 3) // A + B y X fallidos
    assert.strictEqual(mia.correct, 1)
  })

  it('soporta el campo time (formato estático NFL_WEEKS)', () => {
    const staticGames = [{ game_id: 'S1', time: iso(now - 24 * H), result: 'GB', finished: true }]
    const picks = [{ user_id: JOE, game_id: 'S1', pick: 'GB' }]
    const rows = calcStandings(picks, staticGames, {}, { now })
    assert.strictEqual(rows[0].total, 1)
    assert.strictEqual(rows[0].correct, 1)
  })

  it('un juego con deadline recién vencido (kickoff − 5 min, grace) ya cuenta', () => {
    // Juego cuyo kickoff es en 4 min → deadline en −1 min → cerrado al cómputo.
    const soon = { game_id: 'S2', game_time: iso(now + 4 * M), result: 'SEA', finished: false }
    const rows = calcStandings(
      [{ user_id: MIA, game_id: 'Z', pick: 'KC' }],
      [soon, { game_id: 'Z', game_time: iso(now - 24 * H), result: 'KC', finished: true }],
      {},
      { now },
    )
    assert.strictEqual(rows[0].total, 2) // Z acertado + S2 fallido (deadline vencido)
    assert.strictEqual(rows[0].correct, 1)
  })
})

// BUILD-017-F — racha: juegos acertados de seguido terminando en el último
// partido finalizado (orden cronológico). Un resultado no elegido corta la racha.
describe('calcStreak — rha (juegos acertados seguidos)', () => {
  const base = { finished: true }
  const games = [
    { ...base, game_id: 'G1', game_time: iso(now - 5 * H), result: 'KC' },
    { ...base, game_id: 'G2', game_time: iso(now - 4 * H), result: 'BUF' },
    { ...base, game_id: 'G3', game_time: iso(now - 3 * H), result: 'DAL' },
    { ...base, game_id: 'G4', game_time: iso(now - 2 * H), result: 'SEA' },
  ]

  it('cuenta los aciertos consecutivos al final', () => {
    const picks = [
      { user_id: JOE, game_id: 'G1', pick: 'KC' },   // ok
      { user_id: JOE, game_id: 'G2', pick: 'X' },    // falla → corta
      { user_id: JOE, game_id: 'G3', pick: 'DAL' },  // ok
      { user_id: JOE, game_id: 'G4', pick: 'SEA' },  // ok
    ]
    assert.strictEqual(calcStreak(picks, games, JOE), 2)
  })

  it('sin racha activa si el último resultado no se eligió', () => {
    const picks = [
      { user_id: JOE, game_id: 'G1', pick: 'KC' },
      { user_id: JOE, game_id: 'G2', pick: 'BUF' },
      { user_id: JOE, game_id: 'G3', pick: 'DAL' },
      // G4 (último) no pickeado → racha corta
    ]
    assert.strictEqual(calcStreak(picks, games, JOE), 0)
  })

  it('racha perfecta cuando acierta todo', () => {
    const picks = games.map(g => ({ user_id: JOE, game_id: g.game_id, pick: g.result }))
    assert.strictEqual(calcStreak(picks, games, JOE), 4)
  })

  it('un error al final corta la racha', () => {
    const picks = [
      { user_id: JOE, game_id: 'G1', pick: 'KC' },
      { user_id: JOE, game_id: 'G2', pick: 'BUF' },
      { user_id: JOE, game_id: 'G3', pick: 'DAL' },
      { user_id: JOE, game_id: 'G4', pick: 'WRONG' },
    ]
    assert.strictEqual(calcStreak(picks, games, JOE), 0)
  })

  it('soporta claves UUID (game_id NULL) con racha cruzada', () => {
    const mixedGames = [
      { id: 'lg-1', game_id: 'M1', game_time: iso(now - 5 * H), result: 'KC', finished: true },
      { id: 'lg-2', game_time: iso(now - 4 * H), result: 'BUF', finished: true }, // manual → game_id NULL
      { id: 'lg-3', game_time: iso(now - 3 * H), result: 'DAL', finished: true }, // manual → game_id NULL
    ]
    const picks = [
      { user_id: JOE, game_id: 'M1', pick: 'KC' },
      { user_id: JOE, game_id: 'lg-2', pick: 'BUF' },
      { user_id: JOE, game_id: 'lg-3', pick: 'DAL' },
    ]
    assert.strictEqual(calcStreak(picks, mixedGames, JOE), 3)
  })

  it('calcStreaks arma el mapa por usuario', () => {
    const picks = [
      { user_id: JOE, game_id: 'G1', pick: 'KC' },
      { user_id: JOE, game_id: 'G2', pick: 'BUF' },
      { user_id: JOE, game_id: 'G3', pick: 'DAL' },
      { user_id: JOE, game_id: 'G4', pick: 'SEA' },
      { user_id: PAT, game_id: 'G1', pick: 'KC' },
    ]
    const map = calcStreaks(picks, games, [JOE, PAT])
    assert.strictEqual(map[JOE], 4)
    assert.strictEqual(map[PAT], 0) // G4 sin pick → corta
  })

  it('sin juegos con resultado devuelve 0', () => {
    assert.strictEqual(calcStreak([], [], JOE), 0)
    assert.strictEqual(calcStreak([], [{ game_id: 'G1', finished: false, game_time: iso(now + 2 * H) }], JOE), 0)
  })
})