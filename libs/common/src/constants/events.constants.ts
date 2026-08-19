export const AGGREGATE_TYPES = {
  BOOKING: 'booking',
  SEAT: 'seat',
  PAYMENT: 'payment',
  MOVIE: 'movie',
} as const;

export type AggregateType =
  typeof AGGREGATE_TYPES[keyof typeof AGGREGATE_TYPES];

export const EVENT_TYPES = {
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',

  SEATS_RESERVED: 'SEATS_RESERVED',
  SEAT_RESERVATION_FAILED: 'SEAT_RESERVATION_FAILED',
  SEATS_COMPENSATED: 'SEATS_COMPENSATED',

  PAYMENT_PROCESSED: 'PAYMENT_PROCESSED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  MOVIE_CREATED: 'MOVIE_CREATED',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

export interface BookingCreatedPayload {
  bookingId: string;
  userId: string;
  movieId: string;
  showtimeId: string;
  seatIds: string[];
  totalAmount: number;
}

export interface SeatsReservedPayload {
  bookingId: string;
  userId: string;
  showtimeId: string;
  seatIds: string[];
  totalAmount: number;
}

export interface SeatReservationFailedPayload {
  bookingId: string;
  showtimeId: string;
  seatIds: string[];
  reason: string;
}

export interface PaymentProcessedPayload {
  bookingId: string;
  paymentId: string;
  amount: number;
}

export interface PaymentFailedPayload {
  bookingId: string;
  showtimeId: string;
  seatIds: string[];
  reason: string;
}

export interface SeatsCompensatedPayload {
  bookingId: string;
  showtimeId: string;
  seatIds: string[];
  reason: string;
}

export interface BookingConfirmedPayload {
  bookingId: string;
  userId: string;
  movieId: string;
  showtimeId: string;
  seatIds: string[];
  status: string;
}

export interface MovieCreatedPayload {
  movieId: string;
  title: string;
  genre: string;
  description: string;
  duration: number;
  posterUrl?: string;
}

export interface BookingCancelledPayload {
  bookingId: string;
  reason: string;
  status: string;
}

export interface DebeziumOutboxEvent {
  id: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: any;
  timestamp?: string;
}
