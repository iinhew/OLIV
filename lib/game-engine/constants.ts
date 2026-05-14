export const GAME_CONSTANTS = {
  // Configurações Físicas da Azeitona
  PLAYER_START_X: 350,
  PLAYER_START_Y: 150,
  PLAYER_WIDTH: 20,
  PLAYER_HEIGHT: 20,
  GRAVITY: 0.4,
  JUMP_STRENGTH: -7,

  // Sistema de Velocidade
  INITIAL_GAME_SPEED: 3,
  SPEED_INCREMENT: 0.001,
  MAX_GAME_SPEED: 15, // Optional cap

  // Power-Ups e Propriedades Físicas
  BOUNCE_MULTIPLIER: 2.0,
  MAGNET_DURATION_MS: 10000,
  BREAK_DELAY_MS: 500,

  // Animações e Feedback
  SHAKE_FRAMES: 15,
  COUNTDOWN_MS: 3000,
  SCORE_MULTIPLIER: 0.1,
  COIN_SCORE: 20,

  // Geração Procedural
  SPAWN_OFFSET_DISTANCE: 300, // Distance from edge to spawn new obstacle
  TRAMPOLINE_SPAWN_CHANCE: 0.1,
  MAGNET_SPAWN_CHANCE: 0.05,
  BRAND_SPAWN_CHANCE: 0.6,
  BRAND_BREAKABLE_CHANCE: 0.15,
  BRAND_BOUNCY_CHANCE: 0.15,

  // Spritesheets e Rendering
  MAGNET_SPRITE_FRAMES: 24,
  MAGNET_SPRITE_COLS: 8,
  MAGNET_SPRITE_ROWS: 3,
  MAGNET_RENDER_WIDTH: 45,

  COIN_SPRITE_FRAMES: 8,
  COIN_CENTERS_X: [366, 665, 941, 1217],
  COIN_CENTERS_Y: [333, 722],
  COIN_SOURCE_SIZE: 250,

  // Partículas
  PARTICLE_GRAVITY: 0, // Currently they float/fall linearly
  PARTICLE_LIFETIME_DECREMENT: 0.05,
  PARTICLE_GLITTER_COLOR: 'rgba(255, 223, 0, {alpha})',
  PARTICLE_DEFAULT_COLOR: 'rgba(174, 197, 81, {alpha})',

  // --- NOVO: Pixels Vermelhos (Red Coins) ---
  RED_COIN_SPAWN_CHANCE: 0.30,       // 30% das moedas viram red coins
  HEAVY_GRAVITY_DURATION_MS: 4000,   // 4 segundos de gravidade pesada
  HEAVY_GRAVITY_MULTIPLIER: 2.0,     // Gravidade 2x

  // --- NOVO: Moedas Isca (Bait Coins) ---
  BAIT_COIN_SPAWN_CHANCE: 0.20,      // 20% chance após gerar uma plataforma
  BAIT_COIN_VALUE: 5,                // 5 Pixels por moeda isca
  BAIT_COIN_SCORE: 50,              // +50 score por moeda isca
  BAIT_COIN_SIZE_MULTIPLIER: 2.0,   // Dobro do tamanho da moeda normal

  // --- NOVO: Armadilhas de Pouso (Spike Traps) ---
  SPIKE_TRAP_CHANCE: 0.20,          // 20% das plataformas têm espinhos
  SPIKE_HEIGHT: 6,                  // Altura visual dos espinhos em pixels
};
