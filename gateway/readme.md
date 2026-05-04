# API Gateway

> Điểm vào duy nhất cho frontend — NestJS HTTP Proxy + JWT forwarding

## Định tuyến

| Route Pattern | Target Service | Cổng | Auth |
|---------------|---------------|------|------|
| `/auth/*` | Auth Service | 5005 | ❌ Public |
| `/bookings*` | Booking Service | 5001 | ✅ JWT forwarded |
| `/movies*` | Movie Service | 5003 | ❌ Public (POST yêu cầu ADMIN) |
| `/seats*` | Seat Service | 5002 | ❌ Public |
| `/wallets/me` | Payment Service | 5004 | ✅ JWT forwarded |
| `/recommendations/grouped` | AI Recommender Service | 5006 | ✅ JWT forwarded |
| `/health` | Self | — | ❌ |

## JWT Forwarding

Gateway tự động chuyển tiếp header `Authorization` từ client đến service đích. Không xác minh JWT — việc xác minh do từng service xử lý.

## Tech Stack

- **Runtime**: NestJS
- **Port**: 8080
- **Proxy**: fetch-based HTTP forwarding

## Cấu trúc

```
src/
├── main.ts
├── app.module.ts
└── gateway.controller.ts   # HTTP Proxy routes + JWT forwarding
```
