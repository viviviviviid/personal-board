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

### 한글 IME 입력
- `onKeyDown`에서 Enter 처리 시 `isComposing` 체크 필수
- 패턴: `useImeInput` 훅 (`isComposing` ref + `onCompositionStart/End`) 사용
- 위치: `src/app/projects/[id]/page.tsx`
