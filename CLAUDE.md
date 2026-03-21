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
- `board-mobile-cols`: 모바일 주간 보드 열 수 (`'1'` / `'2'` / `'3'`, 기본 2)
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

### 반복 일정 (Recurring)
- `RecurringRule` 모델이 Todo/TimelineEntry 공용 템플릿, `type`: `'todo'` | `'timeline'`
- 생성 시 365일치 인스턴스를 `createMany` bulk insert (`src/lib/recurring.ts`)
- 주파수: `daily` / `weekdays` / `weekly`(요일별 복수 선택) / `monthly`
- `weekDays`: ISO 요일 배열 `[1,3]` (1=월…7=일), `monthly`는 `monthDay: number`
- **날짜 생성 시 반드시 `setUTCHours(0,0,0,0)` 사용** — `setHours`는 로컬 자정 기준으로 UTC+9에서 전날 날짜로 저장되는 버그 발생
- 삭제 3가지 모드: `single`(해당 인스턴스만) / `future`(이날 이후 인스턴스) / `all`(RecurringRule 삭제 → cascade)
- `prisma migrate dev`가 shadow DB 권한 부족 시 `prisma db push` 사용
- UI: `RepeatPicker` 컴포넌트 (WeeklyBoard.tsx 내 정의), 반복 항목은 🔁 인디케이터 표시

### TODO 동반 생성
- 타임라인 폼: "TODO" 토글 → 타임라인 생성과 동시에 동일 제목+날짜 투두 생성
- 습관 폼: "TODO도 추가" 토글 → 습관 생성과 동시에 오늘 날짜 투두 생성
- 반복 타임라인 + TODO 동시 생성 시 동일한 `freq`/`weekDays`/`monthDay`로 반복 투두도 함께 생성

### 타임라인 항목 상세/수정/삭제
- 항목 클릭 → `EntryDetailPopover` (fixed 포지션, 항목 우측 or 좌측 플립)
- 수정: 인라인 편집 (제목/시간/카테고리), 저장 시 반복 항목이면 `single`/`all` 선택
- 삭제: 반복 항목이면 `single`/`future`/`all` 3가지 옵션 다이얼로그
- API: `DELETE /api/timeline/[id]?mode=single|future|all`, `PATCH` body에 `mode: 'single'|'all'`

### 타임라인 생성 UX
- 빈 공간 **드래그** → 보라색 미리보기 블록 + 시간 레이블 표시, mouseup 시 선택 범위로 폼 열림
- 빈 공간 **클릭** → 해당 시간에 폼 열림 (기존 동작 유지)
- 생성 중 블록: 내부 드래그로 시간 이동, 하단 핸들 드래그로 종료 시간 조정
- 폼 필드(제목/카테고리/반복/TODO)는 블록 우측 **fixed 포지션 툴팁**으로 분리

### AI 어시스턴트 (AIPanel)
- `src/components/AIPanel.tsx` — 3가지 모드를 탭으로 통합
- **주간 회고** (`/api/ai/feedback`): 우선순위별 완료율, 아이젠하워 분포, 타임라인 카테고리별 시간, 습관 streak, 데일리 하이라이트 포함
- **일일 브리핑** (`/api/ai/daily-brief`): 오늘 할일/일정/미완료 습관 → TOP3 + 시간 활용 제안
- **프로젝트 진단** (`/api/ai/project`): goal 대비 섹션별 진행률 + 블로커 + 다음 액션
- WeeklyBoard에서 주간회고/일일브리핑 2탭, 프로젝트 상세에서 진단 단독 표시
- AI 모델: Google Gemini, `GEMINI_API_KEY` / `GEMINI_MODEL` 환경변수로 설정

### 테스트
- Jest + ts-jest, 테스트 파일: `src/__tests__/lib/`
- `npx jest` / `npm test`
- 커버 범위:
  - `recurring.ts`: generateDates (UTC 날짜 정확성 포함), createRecurringTodos, createRecurringTimelineEntries
  - `timelineDelete.test.ts`: single/future/all 삭제 모드 비즈니스 로직
  - `habitUtils.ts`, `timeUtils.ts`
- Prisma는 `jest.fn()` mock 사용 (실제 DB 연결 불필요)
