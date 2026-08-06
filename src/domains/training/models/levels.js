export const TRAINING_LEVELS = {
  express: {
    id: 'express',
    icon: '⚡',
    gameCount: 5,
    speed: 'fast',
  },
  standard: {
    id: 'standard',
    icon: '🎯',
    gameCount: 10,
    speed: 'normal',
  },
  advanced: {
    id: 'advanced',
    icon: '🔥',
    gameCount: 20,
    speed: 'normal',
  },
  custom: {
    id: 'custom',
    icon: '⚙️',
    gameCount: 10,
    speed: 'normal',
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
export function resolveConfig({ level, gameCount, speed }) {
  const base = getTrainingLevel(level)
  return {
    level: base.id,
    gameCount: base.id === 'custom' ? (gameCount || base.gameCount) : base.gameCount,
    speed: base.id === 'custom' ? (speed || base.speed) : base.speed,
  }
}
