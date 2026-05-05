# Hệ thống Đặt vé Xem phim (Movie Ticket Booking System)

> Hệ thống đặt vé xem phim dựa trên kiến trúc microservices, triển khai **Saga Choreography**, **Kafka** giao tiếp hướng sự kiện, **Debezium CDC + Outbox Pattern** phát sự kiện đáng tin cậy, **Redis Distributed Locking** chống race condition khi giữ ghế, và **payOS Payment Gateway** nạp tiền ví qua chuyển khoản ngân hàng.

## Kiến trúc tổng quan

```mermaid
graph LR
    U["Khách hàng"] --> FE["Frontend :3000"]
    FE --> GW["API Gateway :8080"]
    GW --> BS["Booking Service :5001"]
    GW --> MS["Movie Service :5003"]
    GW --> AS["Auth Service :5005"]
    GW --> SS["Seat Service :5002"]
    GW --> PS["Payment Service :5004"]
    GW --> AI["AI Recommender :5006"]
    BS --> DB1[("booking_db")]
    SS --> DB2[("seat_db")]
    SS --> RD[("Redis")]
    MS --> DB3[("movie_db")]
    PS --> DB4[("payment_db")]
    AS --> DB5[("auth_db")]
    AI --> DB6[("ai_db")]
    PS -.->|"payOS API"| PO["payOS Gateway"]
    AS -.->|"HTTP: create wallet"| PS
    AI -.->|"HTTP: fetch movies"| MS
    MS -.->|"HTTP: generate seats"| SS

    DB1 -.->|CDC| DEB["Debezium"]
    DB2 -.->|CDC| DEB
    DB3 -.->|CDC| DEB
    DB4 -.->|CDC| DEB
    DEB --> K["Kafka"]

    K -.->|booking.events| SS
    K -.->|booking.events| AI
    K -.->|seat.events| PS
    K -.->|seat.events| BS
    K -.->|payment.events| BS
    K -.->|payment.events| SS
    K -.->|movie.events| AI
```

## Thành phần hệ thống

| Thành phần | Trách nhiệm | Công nghệ | Cổng |
|-----------|-------------|------------|------|
| **Frontend** | Giao diện duyệt phim, đặt vé, xem gợi ý AI | React + Vite | 3000 |
| **Gateway** | Định tuyến API, Aggregated Health Check | NestJS | 8080 |
| **Booking Service** | Vòng đời đặt vé, khởi tạo saga | NestJS + TypeORM + Kafka | 5001 |
| **Seat Service** | Quản lý ghế, Redis Distributed Locking, Hold Timeout | NestJS + TypeORM + Kafka + Redis | 5002 |
| **Movie Service** | Danh mục phim, quản lý suất chiếu, Admin CRUD | NestJS + TypeORM | 5003 |
| **Payment Service** | Xử lý thanh toán (ví điện tử), nạp tiền qua payOS, tạo ví tự động | NestJS + TypeORM + Kafka + JWT + payOS | 5004 |
| **Auth Service** | Xác thực JWT, đăng nhập/đăng ký, tự động tạo ví | NestJS + TypeORM + JWT + bcrypt | 5005 |
| **AI Recommender** | Gợi ý phim AI (Cosine + Jaccard + Bonus Tiers) | NestJS + TypeORM + Kafka + Transformers | 5006 |
| **Kafka** | Hàng đợi tin nhắn hướng sự kiện | Apache Kafka (KRaft) | 9092 |
| **Debezium** | CDC — bắt thay đổi outbox đẩy vào Kafka | Debezium Connect | 8083 |
| **Redis** | Distributed Locking cho seat reservation | Redis 7 Alpine | 6379 |
| **MySQL** | Cơ sở dữ liệu (Database per Service — 6 DB) | MySQL 8 | 3306 |

## Luồng đặt vé (Saga Flow + Redis Lock)

```mermaid
sequenceDiagram
    participant U as User
    participant BS as Booking Service
    participant SS as Seat Service
    participant RD as Redis
    participant PS as Payment Service

    U->>BS: Đặt vé (movieId, seatIds)
    BS->>BS: Tạo booking (PENDING)
    BS-->>SS: BOOKING_CREATED (via Kafka/CDC)

    SS->>RD: Pipeline: SET NX per seat (TTL 5s)
    alt Lock thành công
        SS->>SS: UPDATE SET HELD WHERE status=AVAILABLE
        SS->>SS: Check affectedRows == seatIds.length
        SS->>RD: Pipeline: release all locks
        SS-->>PS: SEATS_RESERVED (via Kafka/CDC)
        PS->>PS: Check wallet, trừ tiền
        alt Thanh toán thành công
            PS-->>BS: PAYMENT_PROCESSED
            PS-->>SS: PAYMENT_PROCESSED
            BS->>BS: Update CONFIRMED
            SS->>SS: UPDATE HELD → BOOKED WHERE expire_at > NOW()
        else Thanh toán thất bại
            PS-->>BS: PAYMENT_FAILED
            PS-->>SS: PAYMENT_FAILED
            BS->>BS: Update CANCELLED
            SS->>SS: Compensate → AVAILABLE
        end
    else Lock thất bại
        SS->>RD: Pipeline: rollback acquired locks
        SS-->>BS: SEAT_RESERVATION_FAILED
        BS->>BS: Update CANCELLED
    end

    Note over SS: Job cleanup: release expired HOLD mỗi 30s
```

## Các mô hình kiến trúc

| Mô hình | Mục đích |
|---------|----------|
| **Saga (Choreography)** | Giao dịch phân tán qua Kafka events, không cần orchestrator |
| **Outbox Pattern** | Ghi event + dữ liệu nghiệp vụ trong cùng DB transaction |
| **CDC (Debezium)** | Phát event đáng tin cậy từ outbox vào Kafka qua MySQL binlog |
| **Redis Distributed Locking** | Chống race condition khi giữ ghế, giảm tải DB lock |
| **Seat Hold + Timeout** | Ghế giữ tạm 5 phút, job tự động giải phóng ghế hết hạn |
| **Database per Service** | 6 database riêng biệt, cô lập dữ liệu |
| **Idempotent Consumers** | Bảng processed_events ngăn xử lý event trùng lặp |
| **JWT + RBAC** | Xác thực stateless, phân quyền USER/ADMIN |
| **AI Recommendation** | Cosine Similarity 60% + Jaccard Similarity 40% + Bonus Tiers |
| **Aggregated Health Check** | Gateway kiểm tra health tất cả services cùng lúc |
| **payOS Payment Gateway** | Nạp tiền ví qua chuyển khoản ngân hàng / QR, HMAC_SHA256 signature |

## Luồng nạp tiền ví (payOS Top-up Flow)

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant GW as Gateway
    participant PS as Payment Service
    participant PO as payOS
    participant BK as Ngân hàng

    U->>FE: Chọn nạp tiền (amount)
    FE->>GW: POST /topup {amount}
    GW->>PS: Proxy
    PS->>PS: Tạo orderCode + HMAC_SHA256 signature
    PS->>PO: POST /v2/payment-requests
    PO-->>PS: {checkoutUrl, paymentLinkId}
    PS->>PS: Lưu TopupEntity (PENDING)
    PS-->>FE: {checkoutUrl}
    FE->>U: Redirect → checkoutUrl (payOS)
    U->>PO: Quét QR / Chuyển khoản
    BK-->>PO: Xác nhận giao dịch
    PO->>GW: Redirect → /topup/verify/:orderCode
    GW->>PS: proxyRedirect
    PS->>PO: GET /v2/payment-requests/:orderCode
    PO-->>PS: {status: "PAID", transactions}
    PS->>PS: Cộng tiền wallet (DB transaction)
    PS-->>GW: Redirect → frontend?topup=success
    GW-->>U: Redirect → frontend
```

## Khởi chạy

```bash
git clone <your-repo-url>
cd <project-folder>
npm install
npm run env:local

# Chạy infrastructure (MySQL, Kafka, Debezium, Redis)
docker compose up -d kafka debezium redis

# Chạy tất cả services
npm run start:dev

# Chạy frontend
cd frontend && npm run dev
```

### Health Check

```bash
# Kiểm tra từng service
curl http://localhost:8080/health

# Aggregated health check (tất cả services)
curl http://localhost:8080/health/all
```

## Tài liệu

| Document | Description |
|----------|-------------|
| [`GETTING_STARTED.md`](GETTING_STARTED.md) | Hướng dẫn cài đặt và workflow |
| [`docs/architecture.md`](docs/architecture.md) | Kiến trúc hệ thống chi tiết |
| [`docs/analysis-and-design-ddd.md`](docs/analysis-and-design-ddd.md) | Phân tích & Thiết kế DDD |
| [`docs/api-specs/`](docs/api-specs/) | OpenAPI 3.0 specifications |

## Cấu trúc thư mục

```
├── services/
│   ├── booking-service/     # Saga orchestration, đặt vé
│   ├── seat-service/        # Redis locking, giữ ghế, timeout
│   ├── movie-service/       # CRUD phim, tạo suất chiếu
│   ├── payment-service/     # Thanh toán ví + Nạp tiền payOS
│   │   └── src/
│   │       ├── entities/
│   │       │   ├── wallet.entity.ts   # Ví tài khoản
│   │       │   ├── payment.entity.ts  # Thanh toán booking
│   │       │   └── topup.entity.ts    # Nạp tiền payOS
│   │       ├── controllers/
│   │       │   ├── payment.controller.ts  # Wallet API
│   │       │   └── topup.controller.ts    # Top-up API
│   │       └── services/
│   │           ├── payment.service.ts     # Saga payment
│   │           └── topup.service.ts       # payOS integration
│   ├── auth-service/        # JWT authentication
│   └── ai-recommender-service/ # AI gợi ý phim
├── gateway/                 # API Gateway + Aggregated Health
├── libs/common/             # Shared: Outbox, Idempotency, Redis, JWT
├── frontend/                # React + Vite SPA
├── scripts/                 # SQL init + seed data
└── docker-compose.yml       # Full infrastructure
```