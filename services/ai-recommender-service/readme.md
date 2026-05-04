# AI Recommender Service

> Dịch vụ gợi ý phim dựa trên AI — **Semantic Similarity** + **Kafka Consumer** + **JWT Protected**

## Vai trò

- **Gợi ý phim cho user** dựa trên lịch sử đặt vé (user behavior)
- **Sinh embedding** cho phim mới khi nhận sự kiện `MOVIE_CREATED` từ Kafka
- **Lưu user behavior** khi nhận sự kiện `BOOKING_CONFIRMED` từ Kafka
- **Không tham gia saga** — hoạt động độc lập, chỉ tiêu thụ sự kiện

## Thuật toán gợi ý

```
Score = (0.6 × CosineSimilarity + 0.4 × JaccardSimilarity + BonusTiers) / 1.18
```

- **Cosine Similarity (60%)**: So sánh mô tả phim qua semantic embeddings (all-MiniLM-L6-v2, 384 dims)
- **Jaccard Similarity (40%)**: So sánh thể loại phim (genre overlap)
- **Bonus Tiers**: Điểm cộng theo ngưỡng để phân hóa phim có điểm gần nhau

### Bonus Tiers

| Loại | Ngưỡng | Bonus |
|------|--------|-------|
| Cosine | > 0.8 | +0.10 |
| Cosine | > 0.6 | +0.05 |
| Cosine | > 0.4 | +0.02 |
| Jaccard | > 0.6 | +0.08 |
| Jaccard | > 0.3 | +0.04 |
| Jaccard | > 0.1 | +0.01 |

## Kafka Consumer

| Topic | Sự kiện | Hành động |
|-------|---------|-----------|
| `movie.events` | `MOVIE_CREATED` | Sinh embedding cho phim mới |
| `booking.events` | `BOOKING_CONFIRMED` | Lưu user behavior (userId → movieId) |

## API Endpoints

| Endpoint | Method | Auth | Mô tả |
|----------|--------|------|-------|
| `/health` | GET | ❌ | Kiểm tra sức khỏe |
| `/recommendations/grouped` | GET | ✅ | Gợi ý phim theo sections (Top Picks + Per-Genre) |

## Tech Stack

- **Runtime**: NestJS + TypeORM
- **AI Model**: @xenova/transformers (all-MiniLM-L6-v2)
- **Database**: MySQL (`ai_db`)
- **Messaging**: Kafka Consumer (movie.events, booking.events)
- **Port**: 5006

## Cấu trúc

```
src/
├── main.ts                          # Entry point (HTTP + Kafka)
├── app.module.ts                    # Root module
├── recommender.module.ts            # Feature module + JWT
├── entities/
│   ├── movie-embedding.entity.ts    # Vector embeddings (384 dims)
│   └── user-behavior.entity.ts      # Lịch sử phim user đã đặt vé
├── controllers/
│   └── recommender.controller.ts    # REST API (JWT guarded)
├── services/
│   ├── recommender.service.ts       # Business logic + scoring
│   └── embedding.service.ts         # all-MiniLM-L6-v2 model
└── consumers/
    └── recommender.consumer.ts      # Kafka event consumer
```
