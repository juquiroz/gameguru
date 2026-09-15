export const TRAINING_LEVELS = {
  express: {
    id: 'express',
    icon: '⚡',
    gameCount: 5,
    speed: 'fast',
    pickWindowMinutes: 5,
  },
  standard: {
    id: 'standard',
    icon: '🎯',
    gameCount: 10,
    speed: 'normal',
    pickWindowMinutes: 10,
  },
  advanced: {
    id: 'advanced',
    icon: '🔥',
    gameCount: 20,
    speed: 'normal',
    pickWindowMinutes: 15,
  },
  custom: {
    id: 'custom',
    icon: '⚙️',
    gameCount: 10,
    speed: 'normal',
    pickWindowMinutes: 15,
  },
}

export const TRAINING_LEVELS_LIST = Object.values(TRAINING_LEVELS)

export const TRAINING_SPEEDS = [
  { id: 'demo',   label: 'demo' },
  { id: 'normal', label: 'normal' },
  { id: 'fast',   label: 'fast' },
]

export const GAME_COUNT_OPTIONS = [5, 10, 15, 20]

export const getTrainingLevel = (level) =>
  TRAINING_LEVELS[level] || TRAINING_LEVELS.standard

// Configuración efectiva del evento (aplica presets del nivel; custom usa lo elegido)
export function resolveConfig({ level, gameCount, speed, pickWindowMinutes }) {
  const base = getTrainingLevel(level)
  return {
    level: base.id,
    gameCount: base.id === 'custom' ? (gameCount || base.gameCount) : base.gameCount,
    speed: base.id === 'custom' ? (speed || base.speed) : base.speed,
    // Ventana de picks en minutos (BUILD-TC-005): express 5' / standard 10' /
    // advanced 15' / custom editable. El deadline de la jornada = apertura + N.
    pickWindowMinutes: base.id === 'custom'
      ? (Number(pickWindowMinutes) > 0 ? Number(pickWindowMinutes) : base.pickWindowMinutes)
      : base.pickWindowMinutes,
  }
}
