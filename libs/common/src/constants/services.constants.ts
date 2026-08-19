export const SERVICE_NAMES = {
  BOOKING: 'booking-service',
  SEAT: 'seat-service',
  MOVIE: 'movie-service',
  PAYMENT: 'payment-service',
  AUTH: 'auth-service',
  AI_RECOMMENDER: 'ai-recommender-service',
  GATEWAY: 'gateway',
  FRONTEND: 'frontend',
} as const;

export type ServiceName = typeof SERVICE_NAMES[keyof typeof SERVICE_NAMES];
