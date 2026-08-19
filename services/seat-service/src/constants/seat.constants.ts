export const SEAT_CONFIG = {
  REDIS_LOCK_TTL_MS: 5000,
  SEAT_HOLD_MINUTES: 5,
  CLEANUP_INTERVAL_MS: 30000,
  DEFAULT_ROWS: 5,
  DEFAULT_COLS: 8,
} as const;

export const getSeatLockKey = (showtimeId: string, seatId: string): string =>
  `lock:seat:${showtimeId}:${seatId}`;
