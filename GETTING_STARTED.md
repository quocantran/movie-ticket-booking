# Getting Started — Hướng dẫn Thiết lập & Chạy

> Hướng dẫn chi tiết cách cài đặt, khởi chạy, và kiểm thử hệ thống Đặt vé Xem phim.

---

## Prerequisites

- [Docker Desktop](https://docs.docker.com/get-docker/) (includes Docker Compose)
- [Node.js 20+](https://nodejs.org/) (cho local dev)
- [Git](https://git-scm.com/)
- MySQL 8.0 (nếu chạy local, không cần nếu dùng Docker)

---

## Quick Start (Docker)

```bash
# 1. Clone repository
git clone <your-repo-url>
cd movie-ticket-booking-system

# 2. Chuyển sang profile Docker
npm run env:docker

# 3. Build và chạy toàn bộ hệ thống
docker compose up --build
# hoặc: npm run up:docker

# 4. Truy cập
# Frontend:   http://localhost:3000
# Gateway:    http://localhost:8080
# Kafka UI:   http://localhost:8099
```

### Verify Health

```bash
curl http://localhost:8080/health            # Gateway
curl http://localhost:5001/health            # Booking Service
curl http://localhost:5002/health            # Seat Service
curl http://localhost:5003/health            # Movie Service
curl http://localhost:5004/health            # Payment Service
curl http://localhost:5005/health            # Auth Service
curl http://localhost:5006/health            # AI Recommender Service
```

---

## Quick Start (Local Dev)

Nếu muốn chạy services trên local (không qua Docker), cần chạy infrastructure qua Docker trước:

```bash
# 1. Chuyển sang profile Local
npm run env:local

# 2. Chạy MySQL + Kafka + Debezium
docker compose up mysql kafka debezium -d
# hoặc: npm run up:infra

# 3. Khởi tạo database (chạy lần đầu)
# Khi MySQL container khởi động, nó tự động chạy scripts/init-db.sql và scripts/seed-data.sql

# 4. Cài đặt dependencies (từ root project)
npm install

# 5. Chạy từng service
npm run start:movie
npm run start:booking
npm run start:seat
npm run start:payment
npm run start:auth
npm run start:ai-recommender
npm run start:gateway

# 6. Frontend (terminal riêng)
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

### Chuyển profile nhanh

```bash
# Dùng khi chạy full Docker
npm run env:docker

# Dùng khi chạy app local + infra Docker
npm run env:local
```

> Lưu ý khi chạy local: nếu MySQL chạy trên máy host, đặt `DEBEZIUM_DB_HOST=host.docker.internal` trong `.env` để Debezium container kết nối được DB host.

---

## Project Structure

```
movie-ticket-booking-system/
├── README.md                       # Tổng quan project
├── GETTING_STARTED.md              # File này — hướng dẫn thiết lập
├── .env.docker.example             # Template biến môi trường khi chạy full Docker
├── .env.local.example              # Template biến môi trường khi chạy local app + Docker infra
├── docker-compose.yml              # Orchestration toàn bộ hệ thống
├── package.json                    # NestJS monorepo (root)
├── tsconfig.json                   # TypeScript config (root)
├── nest-cli.json                   # NestJS monorepo config
│
├── docs/                           # Tài liệu
│   ├── analysis-and-design-ddd.md  # Phân tích & thiết kế (DDD)
│   ├── architecture.md             # Kiến trúc & deployment
│   └── api-specs/                  # OpenAPI 3.0 specifications
│       ├── booking-service.yaml
│       ├── seat-service.yaml
│       ├── movie-service.yaml
│       ├── payment-service.yaml
│       ├── auth-service.yaml
│       └── ai-recommender-service.yaml
│
├── libs/                           # Thư viện dùng chung
│   └── common/
│       └── src/
│           ├── auth/               # JwtAuthGuard (shared)
│           ├── entities/           # OutboxEntity, ProcessedEventEntity
│           ├── events/             # Event types, payloads
│           ├── outbox/             # OutboxService, IdempotencyService, Debezium
│           └── types/              # Type declarations (bcryptjs.d.ts)
│
├── services/                       # Backend microservices
│   ├── booking-service/            # Saga Initiator + JWT Guard (port 5001)
│   ├── seat-service/               # Pessimistic Locking (port 5002)
│   ├── movie-service/              # Read API + Admin tạo phim (port 5003)
│   ├── payment-service/            # Balance check + Wallet API (port 5004)
│   ├── auth-service/               # JWT Auth (login/register/profile) + Wallet creation (port 5005)
│   └── ai-recommender-service/     # AI recommendations + Kafka consumers (port 5006)
│
├── gateway/                        # API Gateway + JWT Forwarding (port 8080)
├── frontend/                       # React + Vite (port 3000)
│   └── src/
│       ├── App.jsx                 # Orchestrator (routing + state)
│       ├── utils/                  # API helpers, formatting utilities
│       ├── constants/              # Status mapping
│       ├── components/             # Header, Toast
│       └── pages/                  # LoginPage, MovieListPage, BookingPage, etc.
│
└── scripts/
    ├── init-db.sql                 # Khởi tạo 6 databases
    └── seed-data.sql               # Dữ liệu mẫu
```

---

## Xác thực (JWT Authentication)

### Luồng xác thực

1. User gửi `POST /auth/login` với `{ email, password }` → Auth Service
2. Auth Service kiểm tra email/password bằng bcrypt
3. Nếu đúng → phát hành JWT token chứa `{ sub: userId, email, name, role }` (hết hạn 24h)
4. Frontend lưu token vào `localStorage`
5. Mọi request tiếp theo gửi header `Authorization: Bearer <token>`
6. Gateway chuyển tiếp header → service đích xác minh JWT
7. Khi đăng ký → Auth Service tự động gọi Payment Service tạo ví 200,000 ₫

### Tài khoản demo (mật khẩu mặc định: `123456`)

| Email | Tên | Số dư | Ghi chú |
|-------|-----|-------|---------|
| nguyenvana@email.com | Nguyễn Văn A | 500,000 ₫ | Đủ mua 3-4 vé |
| tranthib@email.com | Trần Thị B | 50,000 ₫ | **Test PAYMENT_FAILED** |
| levanc@email.com | Lê Văn C | 1,000,000 ₫ | Nhiều tiền |
| phamthid@email.com | Phạm Thị D | 200,000 ₫ | Vừa đủ 1-2 vé |
| hoangvane@email.com | Hoàng Văn E | 3,000,000 ₫ | VIP |
| (Đăng ký mới) | — | 200,000 ₫ | Tự động tạo ví |

> Mật khẩu được auto-hash bằng bcrypt khi Auth Service khởi động lần đầu.

---

## Seed Data (Dữ liệu mẫu)

### Movies (movie_db)
| ID | Phim | Thể loại | Thời lượng |
|----|------|----------|------------|
| movie-001 | Avengers: Endgame | Hành động | 181 phút |
| movie-002 | Spider-Man: No Way Home | Hành động | 148 phút |
| movie-003 | Dune: Part Two | Khoa học viễn tưởng | 166 phút |
| movie-004 | Oppenheimer | Tâm lý | 180 phút |
| movie-005 | Inside Out 2 | Hoạt hình | 96 phút |

### Seats (seat_db)
- Mỗi suất chiếu có **40 ghế** (5 hàng × 8 cột): A1-A8, B1-B8, ..., E1-E8
- Tổng: **11 suất chiếu × 40 ghế = 440 ghế**

---

## Test Luồng Saga

### Kịch bản 1: Đặt vé thành công (qua curl)

```bash
# 1. Đăng nhập lấy token
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nguyenvana@email.com","password":"123456"}' | jq -r '.access_token')

echo "Token: $TOKEN"

# 2. Tạo đơn đặt vé (userId tự lấy từ JWT)
curl -X POST http://localhost:8080/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "movieId": "movie-001",
    "showtimeId": "showtime-001",
    "seatIds": ["seat-showtime-001-A1", "seat-showtime-001-A2"],
    "totalAmount": 200000
  }'
```

**Luồng sự kiện:**
```
BOOKING_CREATED → SEATS_RESERVED → PAYMENT_PROCESSED → BOOKING_CONFIRMED
```

### Kịch bản 2: Thanh toán thất bại (không đủ tiền)

```bash
# Đăng nhập với user có ít tiền
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tranthib@email.com","password":"123456"}' | jq -r '.access_token')

curl -X POST http://localhost:8080/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "movieId": "movie-001",
    "showtimeId": "showtime-003",
    "seatIds": ["seat-showtime-003-A1"],
    "totalAmount": 150000
  }'
```

**Luồng sự kiện (compensation):**
```
BOOKING_CREATED → SEATS_RESERVED → PAYMENT_FAILED → SEATS_COMPENSATED → BOOKING_CANCELLED
```

### Kiểm tra kết quả

```bash
# Xem tất cả bookings (cần JWT)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/bookings

# Xem chi tiết 1 booking
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/bookings/<booking-id>

# Xem Kafka topics trên UI
# http://localhost:8099
```

---

## Using Make (optional)

```bash
make help      # Show all available commands
make up        # Build and start all services
make down      # Stop all services
make logs      # View logs
make clean     # Remove everything
```

---

## Phase Checklist

### Phase 1: Analysis & Design ✅
- [x] `docs/analysis-and-design-ddd.md` completed

### Phase 2: Architecture & API ✅
- [x] `docs/architecture.md` completed
- [x] OpenAPI specs in `docs/api-specs/` completed

### Phase 3: Implementation ✅
- [x] Shared library (`libs/common`) — Outbox, Idempotency, Debezium, Events, JwtAuthGuard
- [x] Movie Service — REST read API + ADMIN tạo phim (phát `MOVIE_CREATED`)
- [x] Booking Service — REST + Kafka Consumer (saga initiator) + JWT Guard
- [x] Seat Service — Kafka Consumer + Pessimistic Locking + REST API ghế
- [x] Payment Service — Kafka Consumer + Balance Check + Wallet API (balance + creation)
- [x] Auth Service — JWT Auth (login/register/profile) + auto-create wallet
- [x] AI Recommender Service — Kafka Consumer + AI Scoring (Cosine + Jaccard + Bonus Tiers)
- [x] API Gateway — HTTP Proxy routing + JWT Forwarding + All routes
- [x] Frontend — React + Vite UI (modular: utils, constants, components, pages)
- [x] Database init + seed data scripts (6 databases)
- [x] Docker Compose orchestration
- [x] Service readme.md files updated
- [x] Frontend `.env.local.example` created

### Phase 4: Finalization ✅
- [x] Verify `docker compose up --build` works end-to-end
- [x] Test all saga scenarios
- [x] Final documentation review

---
