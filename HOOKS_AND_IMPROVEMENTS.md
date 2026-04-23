# 개선된 훅 및 시스템 사용 가이드

## 완성된 개선 사항

### 1️⃣ 모달 스택 관리 ✅

**파일**: `src/context/ModalStackContext.tsx`

**기능**:
- 우선순위 기반 모달 관리
- ESC 키로 최상단 모달 자동 닫기
- 자동 z-index 관리
- body 스크롤 자동 제어

**사용법**:
```tsx
import { useModalStack } from '@/context/ModalStackContext'

export function MyComponent() {
  const { openModal, closeModal, isModalOpen } = useModalStack()

  return (
    <>
      <button onClick={() => openModal('my-modal', 10)}>
        모달 열기
      </button>
      
      {isModalOpen('my-modal') && (
        <div style={{ zIndex: 100 }}>
          <p>모달 내용</p>
          <button onClick={() => closeModal('my-modal')}>닫기</button>
        </div>
      )}
    </>
  )
}
```

**API**:
```tsx
const {
  modals,              // Modal[] - 현재 열려있는 모달 목록
  openModal,           // (id: string, priority?: number) => void
  closeModal,          // (id: string) => void
  closeTopModal,       // () => void - ESC 누를 때 자동 호출
  isModalOpen,         // (id: string) => boolean
  getTopModal,         // () => Modal | null
} = useModalStack()
```

---

### 2️⃣ 키보드 입력 처리 ✅

**파일**: `src/hooks/useKeyboardInput.ts`

**기능**:
- IME (한글/일본어) 조합 중 Enter 무시
- Escape 키로 취소
- 통일된 인터페이스

**이전 코드** (WeeklyBoard):
```tsx
function useImeInput(onSubmit, onCancel) {
  const isComposing = useRef(false)
  return {
    onKeyDown: (e) => {
      if (e.nativeEvent.isComposing) return
      if (e.key === 'Enter') { e.preventDefault(); onSubmit() }
      if (e.key === 'Escape') onCancel()
    }
  }
}
```

**개선된 코드**:
```tsx
import { useKeyboardInput } from '@/hooks/useKeyboardInput'

export function MyForm() {
  const { handlers, onKeyDown } = useKeyboardInput()

  return (
    <input
      {...handlers}
      onKeyDown={(e) => onKeyDown(e, {
        submit: () => { console.log('제출') },
        cancel: () => { console.log('취소') }
      })}
    />
  )
}
```

---

### 3️⃣ 스크롤 락 ✅

**파일**: `src/hooks/useScrollLock.ts`

**기능**:
- 모달 열릴 때 배경 스크롤 방지
- 모달 닫을 때 스크롤 위치 복원
- 스크롤바 공간 유지 (UX 개선)

**이전 코드** (SettingsModal):
```tsx
useEffect(() => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
}, [isOpen])
```

**개선된 코드**:
```tsx
import { useScrollLock } from '@/hooks/useScrollLock'

export function SettingsModal({ isOpen }) {
  useScrollLock(isOpen)
  
  return <div>{/* ... */}</div>
}
```

---

### 4️⃣ 포커스 트래핑 ✅

**파일**: `src/hooks/useFocusTrap.ts`

**기능**:
- Tab 키로 모달 밖으로 나가지 않도록 제어
- 초기 포커스 자동 설정
- 스크린리더 지원

**사용법**:
```tsx
import { useFocusTrap } from '@/hooks/useFocusTrap'

export function Modal({ isOpen }) {
  const { containerRef, firstButtonRef } = useFocusTrap(isOpen)

  return (
    <div ref={containerRef} role="dialog">
      <button ref={firstButtonRef}>첫 버튼 (포커스됨)</button>
      <input type="text" />
      <button>확인</button>
    </div>
  )
}
```

---

### 5️⃣ 타입 안전 로컬스토리지 ✅

**파일**: `src/hooks/useLocalStorage.ts`

**기능**:
- 자동 직렬화/역직렬화
- 타입 안정성
- 에러 처리

**이전 코드** (WeeklyBoard):
```tsx
const view = localStorage.getItem('default-view')
if (view === 'weekly' || view === 'monthly') setDefaultView(view)
```

**개선된 코드**:
```tsx
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { STORAGE_KEYS } from '@/lib/storageKeys'

const [view, setView] = useLocalStorage<'weekly' | 'monthly'>(
  STORAGE_KEYS.BOARD_DEFAULT_VIEW,
  'weekly'
)
```

**API**:
```tsx
const [value, setValue, removeValue] = useLocalStorage<T>(key, initialValue)

// 모두 TypeScript 타입 안전함
setValue(newValue)           // 직접 설정
setValue(prev => prev + 1)   // 함수형 업데이트
removeValue()                // 삭제
```

---

### 6️⃣ 로컬스토리지 키 상수 ✅

**파일**: `src/lib/storageKeys.ts`

**기능**:
- 모든 로컬스토리지 키 중앙화
- 타이핑 실수 방지
- 자동 완성 지원

**사용법**:
```tsx
import { STORAGE_KEYS } from '@/lib/storageKeys'

// 자동 완성 + 타입 체크
const [theme, setTheme] = useLocalStorage(
  STORAGE_KEYS.BOARD_THEME,  // ← IDE에서 자동 완성
  'dark'
)
```

**정의된 키들**:
```
Board: DEFAULT_VIEW, WEEK_START, THEME, MOBILE_COLS, MONTH_COUNT
Calendar: ENABLED_CALENDARS_WEEKLY, ENABLED_CALENDARS_MONTHLY
Sidebar: COLLAPSED
AI: AUTO_FEEDBACK, FEEDBACK_DATA_TYPES
Pomodoro: POMODORO_SESSIONS_PREFIX
Onboarding: ONBOARDING_DONE, CAL_PROMPTED
Notes: NOTE_EDITING_PREFIX
```

---

## 단계별 적용 계획

### ✅ 완료
1. 모달 스택 관리 Context
2. 키보드 입력 훅
3. 스크롤 락 훅
4. 포커스 트래핑 훅
5. 로컬스토리지 훅
6. 로컬스토리지 키 상수

### 📝 다음 단계 (자동화 가능)
1. **WeeklyBoard** 마이그레이션 (2677줄 → ~2400줄)
   - `useKeyboardInput` 적용
   - `useScrollLock` 적용
   - `useLocalStorage` + `STORAGE_KEYS` 적용

2. **ProjectDetail** 마이그레이션 (999줄)
   - `useKeyboardInput` 적용
   - `useScrollLock` 적용

3. **Notes** 마이그레이션 (1290줄)
   - `useKeyboardInput` 적용
   - `useLocalStorage` 적용

4. **Habits** 마이그레이션 (674줄)
   - `useKeyboardInput` 적용

5. **SettingsModal** 마이그레이션
   - `useScrollLock` 적용

---

## 추가 개선 사항 (다음 단계)

### 토스트 시스템 (아직 미구현)
```tsx
const { toast } = useToast()

toast.success('저장되었습니다')
toast.error('작업 실패', { duration: 5000 })
toast.loading('저장 중...')
```

### 비동기 작업 관리
```tsx
const task = useAsyncTask(fetchData)

if (task.loading) return <Spinner />
if (task.error) return <Error message={task.error} />
return <Data data={task.data} />
```

### 폼 상태 관리
```tsx
const form = useFormState({
  title: '',
  date: null
})

form.set('title', 'new title')
form.reset()
form.isDirty // boolean
```

---

## 마이그레이션 체크리스트

### WeeklyBoard
- [x] SettingsModal에서 useScrollLock 적용 ✅
- [x] useKeyboardInput으로 IME 처리 통합 ✅
- [x] STORAGE_KEYS 사용으로 localStorage 접근 표준화 ✅
- [x] useLocalStorage로 모든 localStorage 접근 변경 ✅
- [ ] 모달 스택 Context 활용 (선택사항)

### ProjectDetail
- [x] useKeyboardInput 적용 ✅
- [x] useScrollLock 적용 (TODO 추가 폼) ✅
- [x] useFocusTrap 적용 (모바일 바텀시트) ✅

### Notes
- [x] useKeyboardInput 적용 ✅
- [x] useLocalStorage 적용 (draft recovery) ✅

### HabitTracker
- [x] useKeyboardInput 적용 ✅

### SettingsModal
- [x] useScrollLock 적용 ✅
- [x] useLocalStorage 적용 ✅
- [x] useFocusTrap 적용 ✅

### UpgradeModal
- [x] useScrollLock 적용 ✅
- [x] useFocusTrap 적용 ✅

### 모든 모달
- [x] useFocusTrap 적용 ✅ (Settings, Upgrade)
- [x] useScrollLock 적용 ✅ (Settings, Upgrade, ProjectDetail mobile)

---

## 성능 향상 기대효과

| 항목 | 효과 |
|------|------|
| 번들 크기 | ~5KB 감소 (중복 코드 제거) |
| 유지보수성 | 일관된 패턴으로 디버깅 용이 |
| 접근성 | 포커스 관리로 스크린리더 지원 |
| UX | 자동 스크롤 위치 복원 |
| 타입 안정성 | localStorage 타입 에러 방지 |

---

## 테스트 체크리스트

```tsx
// 모달 스택
- [ ] ESC 키로 최상단 모달만 닫기
- [ ] 여러 모달 동시 열기
- [ ] 우선순위 순서대로 표시
- [ ] 모든 모달 닫히면 body 스크롤 복원

// 키보드 입력
- [ ] 한글 입력 중 Enter 무시
- [ ] 한글 입력 완료 후 Enter 작동
- [ ] Escape로 취소

// 스크롤 락
- [ ] 모달 열 때 배경 스크롤 방지
- [ ] 모달 닫을 때 스크롤 위치 복원
- [ ] 스크롤바 깜빡임 없음

// 포커스 트래핑
- [ ] 초기 포커스 자동 설정
- [ ] Tab으로 순방향 포커스 이동
- [ ] Shift+Tab으로 역방향 포커스 이동
- [ ] 마지막 → 첫 요소로 루프

// 로컬스토리지
- [ ] 페이지 새로고침 후에도 값 유지
- [ ] 함수형 업데이트 작동
- [ ] removeValue로 삭제
```
