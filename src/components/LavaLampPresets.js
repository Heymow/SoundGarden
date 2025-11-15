// Presets de couleurs pour le composant LavaLamp

export const LAVA_LAMP_PRESETS = {
  // Vert (par défaut, comme PhaseInfo)
  green: [
    "rgba(74, 222, 128, 0.4)",
    "rgba(52, 211, 153, 0.45)",
    "rgba(34, 197, 94, 0.4)",
    "rgba(16, 185, 129, 0.35)",
  ],

  // Bleu/Cyan
  blue: [
    "rgba(59, 130, 246, 0.4)",
    "rgba(34, 211, 238, 0.45)",
    "rgba(14, 165, 233, 0.4)",
    "rgba(6, 182, 212, 0.35)",
  ],

  // Violet/Magenta
  purple: [
    "rgba(168, 85, 247, 0.4)",
    "rgba(217, 70, 239, 0.45)",
    "rgba(147, 51, 234, 0.4)",
    "rgba(196, 181, 253, 0.35)",
  ],

  // Orange/Rouge
  orange: [
    "rgba(251, 146, 60, 0.4)",
    "rgba(248, 113, 113, 0.45)",
    "rgba(239, 68, 68, 0.4)",
    "rgba(252, 165, 165, 0.35)",
  ],

  // Rose/Pink
  pink: [
    "rgba(236, 72, 153, 0.4)",
    "rgba(244, 114, 182, 0.45)",
    "rgba(219, 39, 119, 0.4)",
    "rgba(251, 207, 232, 0.35)",
  ],

  // Jaune/Ambre
  yellow: [
    "rgba(251, 191, 36, 0.4)",
    "rgba(245, 158, 11, 0.45)",
    "rgba(217, 119, 6, 0.4)",
    "rgba(252, 211, 77, 0.35)",
  ],

  // Monochrome (gris)
  mono: [
    "rgba(156, 163, 175, 0.4)",
    "rgba(107, 114, 128, 0.45)",
    "rgba(75, 85, 99, 0.4)",
    "rgba(209, 213, 219, 0.35)",
  ],

  // Arc-en-ciel
  rainbow: [
    "rgba(239, 68, 68, 0.4)", // Rouge
    "rgba(251, 146, 60, 0.4)", // Orange
    "rgba(251, 191, 36, 0.4)", // Jaune
    "rgba(34, 197, 94, 0.4)", // Vert
    "rgba(59, 130, 246, 0.4)", // Bleu
    "rgba(168, 85, 247, 0.4)", // Violet
    "rgba(236, 72, 153, 0.4)", // Rose
  ],
};

// Configurations prédéfinies pour différents usages
export const LAVA_LAMP_CONFIGS = {
  // Subtil (pour arrière-plans discrets)
  subtle: {
    blobCount: 3,
    speed: 0.5,
    blur: 30,
    opacity: 0.5,
  },

  // Normal (équilibré)
  normal: {
    blobCount: 5,
    speed: 1,
    blur: 25,
    opacity: 0.7,
  },

  // Intense (pour des effets dramatiques)
  intense: {
    blobCount: 8,
    speed: 1.5,
    blur: 20,
    opacity: 0.8,
  },

  // Calme (mouvement lent)
  calm: {
    blobCount: 4,
    speed: 0.3,
    blur: 35,
    opacity: 0.6,
  },

  // Énergique (mouvement rapide)
  energetic: {
    blobCount: 7,
    speed: 2,
    blur: 15,
    opacity: 0.9,
  },
};

// Helper function pour combiner preset et config
export const createLavaLampProps = (
  colorPreset = "green",
  config = "normal"
) => ({
  colors: LAVA_LAMP_PRESETS[colorPreset] || LAVA_LAMP_PRESETS.green,
  ...(LAVA_LAMP_CONFIGS[config] || LAVA_LAMP_CONFIGS.normal),
});
