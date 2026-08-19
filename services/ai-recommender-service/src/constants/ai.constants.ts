export const AI_CONFIG = {
  MODEL_NAME: 'Xenova/all-MiniLM-L6-v2',
  TASK_NAME: 'feature-extraction',
  MAX_TEXT_LENGTH: 5000,
  DEFAULT_RECOMMENDATION_LIMIT: 10,
  DEFAULT_GENRE_SECTION_LIMIT: 8,
  COSINE_WEIGHT: 0.6,
  JACCARD_WEIGHT: 0.4,
  MAX_RAW_SCORE: 1.18,
  COSINE_BONUS_TIERS: [
    { threshold: 0.8, bonus: 0.1 },
    { threshold: 0.6, bonus: 0.05 },
    { threshold: 0.4, bonus: 0.02 },
  ],
  JACCARD_BONUS_TIERS: [
    { threshold: 0.6, bonus: 0.08 },
    { threshold: 0.3, bonus: 0.04 },
    { threshold: 0.1, bonus: 0.01 },
  ],
} as const;
