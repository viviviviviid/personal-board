# 뒤로가기 네비게이션 사용 가이드

## 설정 완료
- ✅ `BackNavigationContext` 생성
- ✅ `layout.tsx`에 `BackNavigationProvider` 추가
- ✅ `NativeAppBridge`에서 백버튼 이벤트 처리
- ✅ `popstate` 이벤트로 브라우저 백버튼 지원

## 각 페이지에서 사용법

### WeeklyBoard 예시 (메인 보드)

```tsx
import { useBackNavigation } from '@/context/BackNavigationContext'

export default function WeeklyBoard() {
  const { registerHandler, unregisterHandler } = useBackNavigation()
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [addingEntry, setAddingEntry] = useState(null)
  const [calPanelOpen, setCalPanelOpen] = useState(false)

  // 백버튼 핸들러 등록
  useEffect(() => {
    registerHandler('weekly-board', () => {
      // 우선순위 1: EntryDetailPopover 닫기
      if (selectedEntry) {
        setSelectedEntry(null)
        return true // handled
      }

      // 우선순위 2: 타임라인/TODO 생성 폼 닫기
      if (addingEntry) {
        setAddingEntry(null)
        return true
      }

      // 우선순위 3: Calendar 패널 닫기
      if (calPanelOpen) {
        setCalPanelOpen(false)
        return true
      }

      // 아무것도 열려있지 않음 - 다음 핸들러로
      return false
    }, 10) // priority: 10 (높을수록 먼저 처리)

    return () => unregisterHandler('weekly-board')
  }, [selectedEntry, addingEntry, calPanelOpen, registerHandler, unregisterHandler])

  // ... rest of component
}
```

### 프로젝트 상세 페이지 예시

```tsx
import { useBackNavigation } from '@/context/BackNavigationContext'
import { useRouter } from 'next/navigation'

export default function ProjectDetail() {
  const { registerHandler, unregisterHandler } = useBackNavigation()
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addingFor, setAddingFor] = useState(CLOSED)

  useEffect(() => {
    registerHandler('project-detail', () => {
      // 우선순위 1: 삭제 확인 다이얼로그 닫기
      if (confirmDelete) {
        setConfirmDelete(false)
        return true
      }

      // 우선순위 2: TODO/섹션 추가 폼 닫기
      if (addingFor !== CLOSED) {
        setAddingFor(CLOSED)
        return true
      }

      // 모달이 없으면 경로 뒤로 (Sidebar에서도 처리)
      router.back()
      return true
    }, 10)

    return () => unregisterHandler('project-detail')
  }, [confirmDelete, addingFor, registerHandler, unregisterHandler, router])

  // ... rest of component
}
```

### Sidebar 예시 (글로벌)

```tsx
import { useBackNavigation } from '@/context/BackNavigationContext'

export default function Sidebar() {
  const { registerHandler, unregisterHandler } = useBackNavigation()
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    registerHandler('sidebar', () => {
      // Settings는 항상 닫기 (priority가 낮으면 메인 페이지가 먼저 처리)
      if (settingsOpen) {
        setSettingsOpen(false)
        return true
      }
      return false
    }, 5) // priority: 5 (낮게)

    return () => unregisterHandler('sidebar')
  }, [settingsOpen, registerHandler, unregisterHandler])

  // ... rest of component
}
```

## 우선순위 가이드

| Priority | 역할 | 예시 |
|----------|------|------|
| 20+ | 최상위 모달 | 삭제 확인, 중요한 경고 |
| 10-15 | 페이지 메인 모달 | EntryDetailPopover, TodoForm, CalendarPanel |
| 5-9 | 글로벌 모달 | SettingsModal, AIPanel |
| 0-4 | 보조 상태 | TodoItem editing, 인라인 폼 |

## 처리 흐름

```
사용자가 백버튼 클릭
  ↓
BackNavigationContext.triggerBack() 호출
  ↓
등록된 핸들러들을 우선순위 높은 순서로 호출
  ↓
handler() === true? → 처리 완료, 종료
  ↓
handler() === false? → 다음 핸들러 시도
  ↓
모든 핸들러 false → router.back() 자동 호출
```

## 주의사항

1. **핸들러 ID 고유성**: 같은 페이지에서 중복되지 않도록
   ```tsx
   registerHandler('weekly-board', ...)  // ✅ 고유함
   registerHandler('weekly-board', ...)  // ❌ 중복
   ```

2. **의존성 배열**: registerHandler/unregisterHandler는 필수
   ```tsx
   useEffect(() => {
     registerHandler('my-component', () => {
       if (myModalOpen) return true
       return false
     })
     return () => unregisterHandler('my-component')
   }, [registerHandler, unregisterHandler]) // ✅ 필수
   ```

3. **상태 의존성**: 핸들러 내부에서 참조하는 상태들
   ```tsx
   useEffect(() => {
     registerHandler('modal', () => {
       return modalOpen // ← 여기서 참조
     })
   }, [modalOpen, registerHandler, unregisterHandler]) // ← 여기도 포함
   ```

4. **네이티브 앱 콜백**: 백버튼 처리 후 네이티브로 알려야 하면
   ```tsx
   const handleClose = () => {
     setSettingsOpen(false)
     if ((window as any).flutter_inappwebview) {
       (window as any).flutter_inappwebview.callHandler('personalBoardBridge', {
         action: 'backHandled'
       })
     }
   }
   ```

## 테스트 방법

### 브라우저에서
```tsx
// 콘솔에서 직접 테스트
window.dispatchEvent(new Event('personalboard:backPressed'))
```

### 네이티브 앱에서
- Android: 기본 백버튼 (자동으로 이벤트 발생)
- iOS: 뒤로가기 제스처 또는 커스텀 버튼

## 추가 고려사항

### 모달 데이터 저장
백버튼으로 모달을 닫을 때 입력 데이터 처리:
```tsx
const handleBackInForm = () => {
  if (hasUnsavedChanges) {
    // 확인 다이얼로그
    setShowConfirm(true)
    return true // 백버튼 처리 완료 (모달 유지)
  }
  // 저장된 데이터, 안전하게 닫기
  setAddingFor(CLOSED)
  return true
}
```

### 여러 탭/라우트 관리
각 페이지/탭에서 독립적으로 핸들러 등록:
```tsx
// /projects에서
registerHandler('projects-page', ...., 10)

// /projects/[id]에서 (다른 컴포넌트)
registerHandler('project-detail', ...., 10)

// 경로 변경 시 자동으로 이전 페이지 핸들러는 unregister됨
```
