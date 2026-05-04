# Booking Service

> Dịch vụ quản lý vòng đời đặt vé xem phim — **Saga Initiator** + **JWT Protected**

## Vai trò trong Saga

- **Khởi tạo saga**: Tạo đơn đặt vé (PENDING) → phát sự kiện `BOOKING_CREATED`
- **Tiêu thụ sự kiện kết quả**:
  - `SEATS_RESERVED` → Cập nhật trạng thái `SEATS_RESERVED`
  - `PAYMENT_PROCESSED` → Xác nhận đơn → `CONFIRMED`
  - `SEAT_RESERVATION_FAILED` → Hủy đơn → `CANCELLED`
  - `SEATS_COMPENSATED` → Hủy đơn (bù trừ) → `CANCELLED`

## Xác thực

- Tất cả API endpoints (trừ `/health`) yêu cầu JWT token hợp lệ
- `userId` được trích xuất từ JWT payload (`req.user.sub`), **không** từ request body
- JWT được xác minh bằng shared secret (`JWT_SECRET` env variable)

## API Endpoints

| Endpoint | Method | Auth | Mô tả |
|----------|--------|------|-------|
| `/health` | GET | ❌ | Kiểm tra sức khỏe |
| `/bookings` | POST | ✅ | Tạo đơn đặt vé mới (userId từ JWT) |
| `/bookings` | GET | ✅ | Danh sách đơn đặt vé |
| `/bookings/:id` | GET | ✅ | Chi tiết đơn đặt vé |

## Tech Stack

- **Runtime**: NestJS + TypeORM + @nestjs/jwt
- **Database**: MySQL (`booking_db`)
- **Messaging**: Kafka Consumer (seat.events, payment.events)
- **Port**: 5001

## Cấu trúc

```
src/
├── main.ts                 # Entry point (HTTP + Kafka)
├── app.module.ts           # Root module
├── booking.module.ts       # Feature module + JWT
├── entities/
│   └── booking.entity.ts   # Booking entity
├── controllers/
│   └── booking.controller.ts  # REST API (JWT guarded)
├── services/
│   └── booking.service.ts  # Business logic + outbox
└── consumers/
    └── booking.consumer.ts # Kafka event consumer
```
