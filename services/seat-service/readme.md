# Seat Service

> Dịch vụ quản lý kho ghế theo suất chiếu — **Xử lý đồng thời (Pessimistic Locking)**

## Vai trò trong Saga

- **Giữ ghế**: Nhận `BOOKING_CREATED` → `SELECT FOR UPDATE` → phát `SEATS_RESERVED` hoặc `SEAT_RESERVATION_FAILED`
- **Bù trừ**: Nhận `PAYMENT_FAILED` → Giải phóng ghế → phát `SEATS_COMPENSATED`
- **Xác nhận**: Nhận `PAYMENT_PROCESSED` → Chuyển ghế HELD → BOOKED

## API Endpoints

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/health` | GET | Kiểm tra sức khỏe |
| `/seats?showtimeId=xxx` | GET | Danh sách ghế theo suất chiếu kèm trạng thái (AVAILABLE / HELD / BOOKED) |

> Seat Service còn hoạt động theo hướng sự kiện — tiêu thụ `booking.events` và `payment.events` từ Kafka, phát đến `seat.events`.

## Xử lý đồng thời

Sử dụng **Pessimistic Locking** (`SELECT FOR UPDATE`) để ngăn 2 booking đồng thời giữ cùng ghế.

## Tech Stack

- **Runtime**: NestJS + TypeORM
- **Database**: MySQL (`seat_db`)
- **Messaging**: Kafka Consumer (booking.events, payment.events)
- **Port**: 5002

## Cấu trúc

```
src/
├── main.ts
├── app.module.ts
├── seat.module.ts
├── entities/
│   └── seat.entity.ts
├── controllers/
│   └── seat.controller.ts    # Health check + GET /seats
├── services/
│   └── seat.service.ts       # Pessimistic locking logic
└── consumers/
    └── seat.consumer.ts      # Kafka event consumer
```
