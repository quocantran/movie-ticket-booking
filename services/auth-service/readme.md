# Auth Service

> Dịch vụ xác thực JWT (đăng nhập / đăng ký / profile)

## Vai trò

- **Xác thực người dùng**: Quản lý tài khoản, đăng nhập, đăng ký
- **Phát hành JWT**: Token chứa `{ sub: userId, email, name, role }`, hết hạn 24h
- **Không tham gia Saga** — Chỉ cung cấp REST API đồng bộ

## API Endpoints

| Endpoint | Method | Auth | Mô tả |
|----------|--------|------|-------|
| `/health` | GET | ❌ | Kiểm tra sức khỏe |
| `/auth/login` | POST | ❌ | Đăng nhập bằng email + mật khẩu → JWT |
| `/auth/register` | POST | ❌ | Đăng ký tài khoản mới |
| `/auth/me` | GET | ✅ | Thông tin user từ JWT |

### JWT Flow
1. User gửi email + password → Auth Service xác minh bằng bcrypt
2. Nếu đúng → phát hành JWT token (chứa `{ sub: userId, email, name, role }`, hết hạn 24h)
3. Frontend lưu token → gửi kèm header `Authorization: Bearer <token>` cho mỗi request
4. Booking Service xác minh JWT → trích xuất `userId` từ payload

### Seed Users (mật khẩu mặc định: `123456`)
| Email | Ghi chú |
|-------|---------|
| nguyenvana@email.com | User thông thường |
| tranthib@email.com | User thông thường |
| hoangvane@email.com | VIP |

## Tech Stack

- **Runtime**: NestJS + TypeORM + @nestjs/jwt + bcryptjs
- **Database**: MySQL (`auth_db`)
- **Port**: 5005

## Cấu trúc

```
src/
├── main.ts
├── app.module.ts
├── auth.module.ts
├── entities/
│   └── user.entity.ts       # Tài khoản user (email + password_hash)
├── controllers/
│   └── auth.controller.ts   # Login / Register / Profile
└── services/
    └── auth.service.ts      # JWT + bcrypt logic
```
