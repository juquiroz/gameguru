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
    const rows = calcStandings(picks, lg, {})
    assert.strictEqual(rows[0].total, 2)
    assert.strictEqual(rows[0].correct, 2)
  })

  it('un partido manual (game_id NULL) guardado con su UUID cuenta en standings y fallidos', () => {
    const lg = [
      { id: 'lg-manual-1', game_id: null, game_time: iso(now - 24 * H), result: 'SEA', finished: true },
      { id: 'lg-manual-2', game_id: null, game_time: iso(now - 24 * H), result: 'GB', finished: true },
    ]
    const picks = [{ user_id: MIA, game_id: 'lg-manual-1', pick: 'SEA' }] // correct por UUID
    const joinedAt = { [MIA]: iso(now - 1 * H) } // se une tras ambos kickoffs
    const rows = calcStandings(picks, lg, {}, { joinedAt })
    assert.strictEqual(rows[0].total, 2) // lg-manual-1 (acierto) + lg-manual-2 (fallido pre-cerrado)
    assert.strictEqual(rows[0].correct, 1)
  })
})

describe('calcStandings — BUILD-017-B (juegos pre-cerrados → fallidos)', () => {
  it('legacy: sin joinedAt se mantiene el comportamiento histórico', () => {
    const picks = [
      { user_id: JOE, game_id: 'A', pick: 'KC' },  // correct
      { user_id: JOE, game_id: 'C', pick: 'CIN' }, // wrong
      { user_id: PAT, game_id: 'C', pick: 'DAL' }, // correct
    ]
    const rows = calcStandings(picks, games, {})
    const joe = rows.find(r => r.userId === JOE)
    const pat = rows.find(r => r.userId === PAT)
    assert.strictEqual(joe.total, 2) // solo los juegos que pickeo
    assert.strictEqual(joe.correct, 1)
    assert.strictEqual(pat.total, 1)
    assert.strictEqual(pat.correct, 1)
  })

  it('el que se unió después del deadline de un juego lo cuenta como fallido', () => {
    const picks = [
      { user_id: JOE, game_id: 'A', pick: 'KC' },  // correct
      { user_id: JOE, game_id: 'B', pick: 'BUF' }, // correct
      { user_id: PAT, game_id: 'C', pick: 'DAL' }, // correct
    ]
    const joinedAt = {
      [JOE]: iso(now - 48 * H), // antes de todos los juegos
      [PAT]: iso(now - 30 * M), // se une después del kickoff de A y B (deadline = kickoff − 5 min)
    }
    const rows = calcStandings(picks, games, {}, { joinedAt })
    const joe = rows.find(r => r.userId === JOE)
    const pat = rows.find(r => r.userId === PAT)
    assert.strictEqual(joe.total, 2)
    assert.strictEqual(joe.correct, 2)
    assert.strictEqual(pat.total, 4) // C acertado + A, B y X fallidos (X pre-cerrado sin resultado)
    assert.strictEqual(pat.correct, 1)
    // Orden: más aciertos primero (Joe > Pat).
    assert.strictEqual(rows[0].userId, JOE)
  })

  it('un juego abierto al momento de unirse y NO pickeado no penaliza (no es olvido)', () => {
    const picks = [{ user_id: MIA, game_id: 'A', pick: 'KC' }]
    // MIA se une recién ahora; C arranca en +2h → deadline en el futuro.
    const joinedAt = { [MIA]: iso(now) }
    const rows = calcStandings(picks, games, {}, { joinedAt })
    const mia = rows.find(r => r.userId === MIA)
    assert.strictEqual(mia.total, 3) // A acertado + B y X fallidos (pre-cerrados al unirse)
    assert.strictEqual(mia.correct, 1)
  })

  it('un juego pasado SIN resultado al unirse cuenta como fallido (BUILD-017-G)', () => {
    const picks = [{ user_id: JOE, game_id: 'A', pick: 'KC' }]
    const joinedAt = { [JOE]: iso(now + 3 * H) } // se une tras todos los kickoffs
    const rows = calcStandings(picks, games, {}, { joinedAt })
    const joe = rows.find(r => r.userId === JOE)
    // A (pick) + B y C (fallidos pre-cerrados al unirse) + X (sin resultado,
    // pero kickoff ya pasó al unirse) = 4. BUILD-017-G: los pre-cerrados sin
    // resultado también cuentan como perdidos.
    assert.strictEqual(joe.total, 4)
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
    const joinedAt = { [JOE]: iso(now - 30 * M) } // se une tras P1, antes del kickoff de P2
    const rows = calcStandings(picks, lg, {}, { joinedAt })
    const joe = rows.find(r => r.userId === JOE)
    // P1 pre-cerrado (sin pick, kickoff viejo) → fallido; P2 elegido → no cuenta
    // como fallido y no afecta aún (sin resultado). total 1.
    assert.strictEqual(joe.total, 1)
    assert.strictEqual(joe.correct, 0)
  })

  it('Caso reportado: registrado ayer, primer juego ya jugado → fallido (1/1 → 1/2)', () => {
    const lg = [
      { game_id: 'V1', game_time: iso(now - 20 * H), finished: false }, // ya jugado, sin resultado
      { game_id: 'V2', game_time: iso(now - 2 * H), result: 'KC', finished: true },
    ]
    const picks = [{ user_id: JOE, game_id: 'V2', pick: 'KC' }] // acierto al segundo
    const joinedAt = { [JOE]: iso(now - 10 * H) } // se registró "ayer/antes"
    const rows = calcStandings(picks, lg, {}, { joinedAt })
    const joe = rows.find(r => r.userId === JOE)
    assert.strictEqual(joe.total, 2) // V2 acertado + V1 perdido por pre-cerrado
    assert.strictEqual(joe.correct, 1)
  })

  it('usuarios sin joined_at no reciben fallidos automáticos', () => {
    const picks = [{ user_id: MIA, game_id: 'A', pick: 'KC' }]
    const joinedAt = { [JOE]: iso(now - 48 * H) } // solo Joe tiene joined_at
    const rows = calcStandings(picks, games, {}, { joinedAt })
    const mia = rows.find(r => r.userId === MIA)
    assert.strictEqual(mia.total, 1)
    assert.strictEqual(mia.correct, 1)
  })

  it('soporta el campo time (formato estático NFL_WEEKS)', () => {
    const staticGames = [{ game_id: 'S1', time: iso(now - 24 * H), result: 'GB', finished: true }]
    const picks = [{ user_id: JOE, game_id: 'S1', pick: 'GB' }]
    const joinedAt = { [JOE]: iso(now - 1 * H) }
    const rows = calcStandings(picks, staticGames, {}, { joinedAt })
    assert.strictEqual(rows[0].total, 1)
    assert.strictEqual(rows[0].correct, 1)
  })

  it('deadline usa el grace de 5 minutos (kickoff − 5 min)', () => {
    // Juego cuyo kickoff es en 4 min → deadline en −1 min → ya cerrado si te unes ahora.
    const soon = { game_id: 'S2', game_time: iso(now + 4 * M), result: 'SEA', finished: false }
    const picks = [{ user_id: MIA, game_id: 'S1', pick: 'GB' }].map(p => ({ ...p, game_id: 'Z', pick: 'KC' }))
    // MIA no pickea S2; joine suscripción: joinedAt ahora.
    const rows = calcStandings(
      [{ user_id: MIA, game_id: 'Z', pick: 'KC', }],
      [soon, { game_id: 'Z', game_time: iso(now - 24 * H), result: 'KC', finished: true }],
      {},
      { joinedAt: { [MIA]: iso(now) } },
    )
    assert.strictEqual(rows[0].total, 2) // Z acertado + S2 fallido (deadline ya pasó al unirse)
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