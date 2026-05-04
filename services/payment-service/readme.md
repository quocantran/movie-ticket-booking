# Payment Service

> Dịch vụ xử lý thanh toán — kiểm tra số dư ví và trừ tiền

## Vai trò trong Saga

- **Xử lý thanh toán**: Nhận `SEATS_RESERVED` → Kiểm tra số dư ví (wallet):
  - `balance >= totalAmount` → Trừ tiền → phát `PAYMENT_PROCESSED`
  - `balance < totalAmount` → phát `PAYMENT_FAILED` (kích hoạt compensation)

> ⚠️ **Auth đã chuyển sang auth-service (port 5005)** — Payment service không còn xử lý đăng nhập/đăng ký.

## API Endpoints

| Endpoint | Method | Auth | Mô tả |
|----------|--------|------|-------|
| `/health` | GET | ❌ | Kiểm tra sức khỏe |
| `/wallets/me` | GET | ✅ | Xem số dư ví của user hiện tại |
| `/wallets` | POST | ❌ | Tạo ví cho user mới (gọi nội bộ bởi Auth Service) |

> Payment Service còn hoạt động theo hướng sự kiện: nhận `SEATS_RESERVED` từ Kafka, xử lý thanh toán và phát `PAYMENT_PROCESSED` hoặc `PAYMENT_FAILED`.

## Kiến trúc số dư

- **wallets** table: lưu số dư tài khoản theo `user_id`
- Số dư được seed sẵn trong database
- Auth-related data (name, email, password) nằm trong `auth-service` (auth_db)

### Seed Wallets
| User ID | Số dư | Ghi chú |
|---------|-------|---------|
| user-001 | 500,000 ₫ | Đủ 3-4 vé |
| user-002 | 50,000 ₫ | Test PAYMENT_FAILED |
| user-005 | 3,000,000 ₫ | VIP |

## Tech Stack

- **Runtime**: NestJS + TypeORM
- **Database**: MySQL (`payment_db`)
- **Messaging**: Kafka Consumer (seat.events)
- **Port**: 5004

## Cấu trúc

```
src/
├── main.ts
├── app.module.ts
├── payment.module.ts
├── entities/
│   ├── wallet.entity.ts      # Ví tài khoản (user_id + balance)
│   └── payment.entity.ts     # Bản ghi thanh toán
├── controllers/
│   └── payment.controller.ts # Health + Wallet REST API
├── services/
│   └── payment.service.ts    # Balance check + deduction
└── consumers/
    └── payment.consumer.ts   # Kafka event consumer
```
