# Personal Board

개인 생산성 대시보드. 주간/월간 캘린더, 투두, 타임라인, 습관 트래커, 프로젝트 관리를 통합한 Next.js 앱.

## 기능

- **Google 로그인** — OAuth 2.0, 유저별 데이터 완전 격리
- **주간 보드** — 요일별 투두 + 타임라인(드래그/리사이즈), 현재 시간 표시, 좌우 화살표 키로 주 이동
- **데일리 하이라이트** — 날짜별 오늘의 핵심 목표 1개 설정 (Make Time 방법론)
- **아이젠하워 매트릭스** — 긴급/중요 2축으로 할일 4분면 분류 뷰 (주간 | 월간 | 매트릭스)
- **포모도로 타이머** — 25분 집중 / 5분 휴식, 원형 프로그레스, 일일 세션 카운터
- **월간 캘린더** — 1/2/3개월 동시 표시, 날짜 셀 클릭으로 투두 인라인 추가
- **Google Calendar 연동** — 캘린더별 주간/월간 표시 여부를 독립적으로 토글
- **습관 트래커** — 일별 체크인, 스트릭 표시
- **프로젝트** — 섹션별 투두, 인라인 제목 편집, 기한 날짜 설정
- **사이드바** — 접기/펼치기, localStorage 유지
- **AI 피드백** — Claude API 기반 주간 회고
- **온보딩** — 첫 로그인 시 사용법 안내 배너 (1회 표시)
- **모바일 최적화** — 소프트 키보드 레이아웃 밀림 방지 (고정 바텀 시트 입력)

## 기술 스택

- **Framework**: Next.js 16.2.0 (App Router)
- **Auth**: next-auth v5 beta (Google OAuth, PrismaAdapter)
- **DB**: MySQL + Prisma ORM
- **Styling**: Tailwind CSS + CSS Variables (Obsidian 테마)
- **Calendar**: Google Calendar API v3 (read-only)

## 로컬 실행

### 환경 변수 설정

`.env` 파일:
```
DATABASE_URL=mysql://root:password@127.0.0.1:3306/personal_board
```

`.env.local` 파일:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

### Google Cloud Console 설정

1. OAuth 2.0 클라이언트 ID 생성 (웹 애플리케이션)
2. 승인된 리디렉션 URI 추가: `http://localhost:3000/api/auth/callback/google`
3. **Google Calendar API** 활성화 (API 및 서비스 → 라이브러리)
4. OAuth 동의 화면 → 테스트 사용자에 본인 이메일 추가

### 실행

```bash
npm install
npx prisma db push
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속 후 Google 로그인.

## 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth 핸들러
│   │   ├── google-calendar/      # Google Calendar 이벤트 + 목록
│   │   ├── todos/
│   │   ├── timeline/
│   │   ├── habits/
│   │   └── projects/
│   ├── login/                    # Google 로그인 페이지
│   └── projects/[id]/            # 프로젝트 상세
├── components/
│   ├── WeeklyBoard.tsx           # 주간/월간/매트릭스 뷰 메인 컴포넌트
│   ├── MonthlyCalendar.tsx       # 월간 캘린더
│   ├── PomodoroTimer.tsx         # 포모도로 타이머 위젯
│   ├── Sidebar.tsx               # 사이드바 (접기/펼치기, 로그아웃)
│   ├── HabitTracker.tsx
│   └── AIFeedback.tsx
├── context/
│   └── SidebarContext.tsx
├── lib/
│   ├── auth.ts                   # NextAuth v5 설정
│   ├── google-token.ts           # access_token 갱신 로직
│   └── prisma.ts
├── app/api/daily-highlight/      # 데일리 하이라이트 CRUD
└── proxy.ts                      # 인증 미들웨어 (middleware.ts 대체)
```

## 주의사항

- Next.js 16에서 `middleware.ts` deprecated → `proxy.ts` 사용, export 함수명 `proxy`
- next-auth v5에서 미들웨어는 `export const proxy = auth(request => {...})` 래퍼 패턴 사용
- Google Calendar 토큰은 `Account` 테이블에 저장, 만료 시 자동 갱신
