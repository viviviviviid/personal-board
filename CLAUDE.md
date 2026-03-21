@AGENTS.md

# Project: Personal Board

## 핵심 규칙

### Next.js 16 미들웨어
- `middleware.ts` **deprecated** → `proxy.ts` 사용
- export 함수명은 반드시 `proxy`
- next-auth v5 미들웨어 패턴: `export const proxy = auth(request => { ... })`
- API 라우트(`/api/`)는 proxy에서 `NextResponse.next()` 패스스루, 각 라우트가 직접 auth 처리

### next-auth v5 (beta)
- import: `@/lib/auth` → `{ auth, signIn, signOut, handlers }`
- 라우트 핸들러에서 세션: `const session = await auth()`
- 미들웨어에서 세션: `request.auth` (proxy 래퍼 패턴)
- 유저 ID: `session.user.id` (Session 타입 augmentation: `src/types/next-auth.d.ts`)

### API 라우트 패턴
모든 API 라우트는 동일 패턴으로 인증:
```ts
const session = await auth()
if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
// prisma 쿼리에 항상 userId: session.user.id 포함
```

### Google Calendar 토큰
- access_token, refresh_token은 `Account` 테이블에 저장됨
- 토큰 갱신: `src/lib/google-token.ts` → `getValidGoogleToken(userId)` 사용
- Calendar API 활성화 필요 (Google Cloud Console → API 라이브러리)

### 캘린더 표시 설정 (localStorage)
- `enabled-calendars-weekly`: 주간 보드에 표시할 캘린더 ID 배열
- `enabled-calendars-monthly`: 월간 캘린더에 표시할 캘린더 ID 배열
- `sidebar-collapsed`: 사이드바 접힘 상태 (`'true'` / `'false'`)
- `board-month-count`: 월간 표시 개수 (`'1'` / `'2'` / `'3'`)
- `pomodoro-yyyy-MM-dd`: 해당 날짜의 완료 포모도로 세션 수
- `pb-onboarding-done`: 온보딩 배너 표시 여부 — 설정되면 더 이상 표시 안 함

### 한글 IME 입력
- `onKeyDown`에서 Enter 처리 시 `isComposing` 체크 필수
- 패턴: `useImeInput` 훅 (`isComposing` ref + `onCompositionStart/End`) 사용 → `src/app/projects/[id]/page.tsx`
- 네이티브 input의 경우 `e.nativeEvent.isComposing` 직접 체크 (훅 없이도 가능)

### 모바일 입력 (키보드 레이아웃 밀림 방지)
- 인라인 input이 그리드/스크롤 컨테이너 내부에 있으면 소프트 키보드 진입 시 레이아웃이 밀림
- 패턴: `isMobile` 시 `position: fixed; bottom: 0` 바텀 시트로 input 렌더, 인라인 폼은 데스크탑 전용
- `padding-bottom: max(Xpx, env(safe-area-inset-bottom))` 으로 홈 인디케이터 대응
- `isMobile && isActive` 인 기존 자리에는 "입력 중..." 인디케이터를 표시해 UX 맥락 유지
- 적용: `WeeklyBoard.tsx` (주간 TODO), `src/app/projects/[id]/page.tsx` (할일/섹션 추가)

### 로딩 스켈레톤
- 모든 로딩 상태는 `animate-pulse` 스켈레톤으로 통일 (`로딩 중...` 텍스트 사용 금지)
- 색상: `var(--bg-card)` 또는 `var(--border)` 사용
- 모양: 내용을 모방한 rounded 사각형/선

### 아이젠하워 매트릭스
- Todo 모델의 `urgent: Boolean` + `priority: 'high'` 조합으로 4분면 도출
- important = `priority === 'high'`, urgent = `todo.urgent === true`
- 매트릭스 뷰는 WeeklyBoard.tsx 하단 `MatrixView` 컴포넌트 (파일 내 정의)
- 주간 보드 할일 hover 시 `!` 아이콘으로 urgent 토글

### 데일리 하이라이트
- `DailyHighlight` 모델: `@@unique([userId, date])` — 유저별 날짜당 1개
- API: `/api/daily-highlight` GET(week 파라미터)/POST(upsert)/PATCH/DELETE
- WeeklyBoard.tsx 하단 `HighlightCell` 컴포넌트 (파일 내 정의)

### 포모도로 타이머
- `src/components/PomodoroTimer.tsx` — 독립 컴포넌트, DB 없이 localStorage만 사용
- 집중 25분 → 휴식 5분 자동 전환, 브라우저 Notification API 사용
- 세션 카운터 키: `pomodoro-yyyy-MM-dd`
