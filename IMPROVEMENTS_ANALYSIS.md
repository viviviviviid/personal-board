# 앱 개선 분석: 우선순위 기반 상태 관리 패턴

## 🔍 발견된 문제점

뒤로가기 시스템과 유사한 "우선순위 기반 계층적 상태 관리"가 필요한 분야들:

### 1. 📱 모달/팝오버 관리 (가장 긴급)
**현재 상태**: 각 컴포넌트에서 독립적으로 관리
```tsx
// WeeklyBoard: 6개 모달 상태
const [selectedEntry, setSelectedEntry] = useState(null)
const [addingEntry, setAddingEntry] = useState(null)
const [calPanelOpen, setCalPanelOpen] = useState(false)
const [highlightOpenDay, setHighlightOpenDay] = useState(null)
const [addingTodoDay, setAddingTodoDay] = useState(null)
const [addingSectionTitle, setAddingSectionTitle] = useState(false)

// 문제점:
// - ESC 키를 누르면? 어떤 모달이 닫혀야 하나?
// - 백그라운드 스크롤 방지 중복
// - z-index 충돌 가능성
// - 포커스 관리 없음
```

**영향**: WeeklyBoard(2677줄), ProjectDetail(999줄), Notes(1290줄)

**개선안**:
```tsx
// useModalStack 훅
const { openModal, closeModal, closeTop } = useModalStack()

useEffect(() => {
  openModal('entry-detail', { priority: 10, component: EntryDetailPopover })
}, [selectedEntry])
```

---

### 2. ⌨️ 키보드 입력 처리 (중요)
**현재 상태**: 중복된 IME 처리 코드
```tsx
// WeeklyBoard에서
function useImeInput(onSubmit, onCancel) {
  const isComposing = useRef(false)
  return {
    onKeyDown: (e) => {
      if (e.key === 'Enter' && !isComposing.current) { ... }
      if (e.key === 'Escape') { ... }
    }
  }
}

// ProjectDetail에서 동일한 코드 반복
// Notes에서도 반복
// Habits에서도 반복
```

**파일별 발생 위치**:
- `src/components/WeeklyBoard.tsx` ✓ 구현됨
- `src/app/projects/[id]/page.tsx` ✓ 구현됨
- `src/app/notes/page.tsx` ✓ 구현됨
- `src/app/habits/page.tsx` ✓ 구현됨

**개선안**:
```tsx
// useKeyboardInput 훅 중앙화
export function useKeyboardInput() {
  const isComposing = useRef(false)
  
  return {
    onCompositionStart: () => { isComposing.current = true },
    onCompositionEnd: () => { isComposing.current = false },
    isComposing: () => isComposing.current,
    onKeyDown: (e, handlers) => {
      if (isComposing.current) return
      if (e.key === 'Enter') handlers.submit?.()
      if (e.key === 'Escape') handlers.cancel?.()
    }
  }
}
```

---

### 3. 🎯 포커스 관리 및 모달 트래핑 (높음)
**현재 상태**: 모달에서 포커스 관리 없음
```tsx
// SettingsModal에서
<div onClick={onClose}> {/* overlay */}
  <div onClick={e => e.stopPropagation()}> {/* modal */}
    {/* 내부 버튼들 */}
  </div>
</div>

// 문제:
// - Tab 키로 모달 밖으로 나갈 수 있음
// - 스크린 리더 지원 부족
// - 초기 포커스 설정 없음
```

**개선안**:
```tsx
function useFocusTrap(isOpen) {
  const containerRef = useRef()
  const initialFocusRef = useRef()

  useEffect(() => {
    if (!isOpen) return
    
    // 초기 포커스 설정
    initialFocusRef.current?.focus()

    // Tab 트래핑
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return
      const focusables = containerRef.current?.querySelectorAll(...)
      // ... 포커스 루프 로직
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return { containerRef, initialFocusRef }
}
```

---

### 4. 📜 스크롤 상태 관리 (중요)
**현재 상태**: 모달별 스크롤 제어 불일관
```tsx
// SettingsModal
useEffect(() => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
}, [isOpen])

// 문제:
// - 여러 모달이 동시에 있으면?
// - 참조 카운팅이 없음
// - 스크롤 위치 복원 없음
```

**개선안**:
```tsx
// useScrollLock 훅
function useScrollLock(isLocked) {
  useEffect(() => {
    if (isLocked) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = getScrollbarWidth() + 'px'
      
      return () => {
        document.body.style.overflow = ''
        document.body.style.paddingRight = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [isLocked])
}
```

---

### 5. 🔔 토스트/알림 관리 (중간)
**현재 상태**: 토스트 시스템 없음, 에러 메시지 산재
```tsx
// WeeklyBoard
if (res.ok) { /* 성공 처리 */ }
else { /* 에러 처리 없음 */ }

// ProjectDetail
setError('에러 메시지')  // 보이는 곳 없음

// 문제:
// - 일관된 피드백 없음
// - 여러 에러 동시 발생 시 처리 불명확
// - 성공/경고/에러 우선순위 없음
```

**개선안**:
```tsx
// useToast 훅 + Context
const { toast, info, warning, error, loading } = useToast()

// 우선순위 기반
toast({
  type: 'error',
  message: '작업 실패',
  priority: 10,
  duration: 5000,
  action: { label: 'Retry', onClick: () => {} }
})
```

---

### 6. ⏳ 로딩 상태 관리 (중간)
**현재 상태**: 각 작업마다 개별 로딩 state
```tsx
// WeeklyBoard
const [loading, setLoading] = useState(true)  // 페이지 로딩
const [saving, setSaving] = useState(false)   // 저장 중

// ProjectDetail
const [loading, setLoading] = useState(true)
const [saving, setSaving] = useState(false)

// 문제:
// - 동시 작업 시 상태 혼동
// - 로딩 UI 표시 위치 불명확
// - 취소 기능 없음
```

**개선안**:
```tsx
// useAsyncTask 훅
const task = useAsyncTask(async () => {
  const res = await fetch('/api/...')
  return res.json()
})

// task.loading, task.error, task.data, task.cancel()
```

---

### 7. 🎨 포모도로 타이머 (낮음)
**현재 상태**: PomodoroTimer 독립 컴포넌트, 로컬스토리지만 사용
```tsx
// 문제:
// - 백그라운드에서도 실행되나?
// - 여러 탭 동기화?
// - 서버 시간과 싱크?
```

---

### 8. 💾 로컬스토리지 동기화 (중간)
**현재 상태**: 모든 곳에서 직접 접근
```tsx
// WeeklyBoard
localStorage.setItem('enabled-calendars-weekly', JSON.stringify([...next]))
localStorage.getItem('default-view')

// Notes
localStorage.setItem('editing-note-' + id, ...)

// Habits
localStorage.setItem('habit-filter', ...)

// 문제:
// - 키 이름 중복/충돌 위험
// - 타입 안정성 없음
// - 동기화 전략 없음
```

**개선안**:
```tsx
// useLocalStorage 훅 (타입 안전)
const [view, setView] = useLocalStorage('board:default-view', 'weekly')
const [calendars, setCalendars] = useLocalStorage('board:calendars', [])
```

---

## 📊 우선순위 개선 순서

| 순서 | 항목 | 영향도 | 난이도 | 기간 |
|------|------|--------|--------|------|
| 1 | 모달 스택 관리 | ⭐⭐⭐⭐⭐ | 중 | 2-3일 |
| 2 | 키보드 입력 중앙화 | ⭐⭐⭐⭐ | 낮 | 1일 |
| 3 | 포커스 관리 | ⭐⭐⭐⭐ | 중 | 1-2일 |
| 4 | 스크롤 락 | ⭐⭐⭐ | 낮 | 반일 |
| 5 | 토스트 시스템 | ⭐⭐⭐⭐ | 중 | 2일 |
| 6 | 로딩 상태 | ⭐⭐⭐ | 낮 | 1일 |
| 7 | 로컬스토리지 | ⭐⭐⭐ | 낮 | 1일 |

---

## 코드 복잡도 분석

```
WeeklyBoard.tsx: 2677줄
  ├─ useImeInput 훅 (재사용 가능)
  ├─ 6개 모달 상태 (스택 관리 필요)
  ├─ 드래그 로직 (복잡)
  ├─ 자동 스크롤 (신규 추가됨)
  └─ 반복 항목 로직 (분리 가능)

ProjectDetail: 999줄
  ├─ useImeInput 훅 (중복)
  ├─ 인라인 편집 (포커스 관리 필요)
  ├─ TODO 추가 폼 (모달화 가능)
  └─ 모바일 바텀시트 (일관성 필요)

Notes: 1290줄
  ├─ 에디터 상태 관리 (복잡)
  ├─ 자동 저장 (디바운싱)
  └─ 검색/필터 (상태 관리)

Habits: 674줄
  ├─ 습관 추가/편집
  └─ 스트릭 계산
```

---

## 즉시 적용 가능한 개선

### 1. useKeyboardInput 훅 추출 (30분)
```tsx
// src/hooks/useKeyboardInput.ts
export function useKeyboardInput() {
  const isComposing = useRef(false)
  return { ... }
}

// 모든 페이지에서 import해서 사용
```

### 2. useScrollLock 훅 (15분)
```tsx
// src/hooks/useScrollLock.ts
export function useScrollLock(isLocked: boolean) {
  useEffect(() => { ... }, [isLocked])
}

// SettingsModal, EntryDetailPopover 등에서 사용
```

### 3. 로컬스토리지 상수화 (30분)
```tsx
// src/lib/storage.ts
export const STORAGE_KEYS = {
  BOARD_DEFAULT_VIEW: 'board:default-view',
  BOARD_WEEK_START: 'board:week-start',
  BOARD_THEME: 'board:theme',
  ENABLED_CALENDARS_WEEKLY: 'board:calendars-weekly',
  // ...
} as const
```

---

## 다음 단계

1. **모달 스택 Context 생성** (가장 효과 큼)
2. **토스트 시스템 구현** (사용자 경험 향상)
3. **Hook 라이브러리 정리** (코드 중복 제거)
4. **접근성 개선** (포커스 트래핑, ARIA)
