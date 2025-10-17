# HaruFit Server

다이어트 관리 앱 HaruFit의 Next.js 서버입니다.

## 기술 스택

- Next.js 14
- TypeScript
- Prisma ORM
- SQLite

## 설치 및 실행

```bash
# 의존성 설치
npm install

# Prisma 설정
npx prisma generate
npx prisma db push

# 개발 서버 실행
npm run dev
```

서버는 http://localhost:3000 에서 실행됩니다.

## API 엔드포인트

### Users
- `GET /api/users` - 모든 사용자 조회
- `POST /api/users` - 사용자 생성
- `GET /api/users/[id]` - 특정 사용자 조회
- `PUT /api/users/[id]` - 사용자 정보 수정

### Meals
- `GET /api/meals?userId=xxx&date=yyyy-mm-dd` - 식사 기록 조회
- `POST /api/meals` - 식사 기록 추가
- `DELETE /api/meals/[id]` - 식사 기록 삭제

### Weights
- `GET /api/weights?userId=xxx` - 체중 기록 조회
- `POST /api/weights` - 체중 기록 추가

## 데이터베이스

SQLite를 사용하며, 데이터는 `prisma/dev.db` 파일에 저장됩니다.

스키마 변경 시:
```bash
npx prisma db push
```

## 초기 데이터 설정

개발용 사용자 생성:
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트 사용자",
    "targetWeight": 65.0,
    "currentWeight": 70.0,
    "dailyCalorieGoal": 2000
  }'
```

