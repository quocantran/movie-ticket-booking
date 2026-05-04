# Movie Service

> Dịch vụ quản lý danh mục phim và suất chiếu — **API đọc + Admin tạo phim**

## API Endpoints

| Endpoint | Method | Auth | Mô tả |
|----------|--------|------|-------|
| `/health` | GET | ❌ | Kiểm tra sức khỏe |
| `/movies` | GET | ❌ | Danh sách tất cả phim |
| `/movies` | POST | ✅ ADMIN | Tạo phim mới (phát sự kiện `MOVIE_CREATED`) |
| `/movies/:id` | GET | ❌ | Chi tiết phim |
| `/movies/:id/showtimes` | GET | ❌ | Suất chiếu của phim |

> Khi Admin tạo phim mới (POST /movies), hệ thống phát sự kiện `MOVIE_CREATED` để AI Recommender Service sinh embedding.

## Tech Stack

- **Runtime**: NestJS + TypeORM
- **Database**: MySQL (`movie_db`)
- **Port**: 5003
- **Event Publisher**: Phát sự kiện `MOVIE_CREATED` cho AI Recommender

## Cấu trúc

```
src/
├── main.ts
├── app.module.ts
├── movie.module.ts
├── entities/
│   ├── movie.entity.ts
│   └── showtime.entity.ts
├── controllers/
│   └── movie.controller.ts    # REST API + Admin create
└── services/
    └── movie.service.ts       # Read API + create movie
```
