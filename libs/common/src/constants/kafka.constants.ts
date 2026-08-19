export const KAFKA_TOPICS = {
  BOOKING_EVENTS: 'booking.events',
  SEAT_EVENTS: 'seat.events',
  PAYMENT_EVENTS: 'payment.events',
  MOVIE_EVENTS: 'movie.events',
} as const;

export type KafkaTopic = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];

export const KAFKA_CONSUMER_GROUPS = {
  BOOKING: 'booking-service-group',
  SEAT: 'seat-service-group',
  PAYMENT: 'payment-service-group',
  AI_RECOMMENDER: 'ai-recommender-service-group',
} as const;

export type KafkaConsumerGroup =
  typeof KAFKA_CONSUMER_GROUPS[keyof typeof KAFKA_CONSUMER_GROUPS];

export const KAFKA_CLIENT_IDS = {
  BOOKING: 'booking-service',
  SEAT: 'seat-service',
  PAYMENT: 'payment-service',
  AI_RECOMMENDER: 'ai-recommender-service',
} as const;

export type KafkaClientId =
  typeof KAFKA_CLIENT_IDS[keyof typeof KAFKA_CLIENT_IDS];
