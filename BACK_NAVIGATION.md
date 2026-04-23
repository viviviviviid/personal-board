# 뒤로가기 네비게이션 로직

## 앱 깊이 구조

### 경로 기반 (Route Depth)
- **1depth**: `/`, `/projects`, `/habits`, `/notes`, `/vault`, `/login`
- **2depth**: `/projects/[id]` (프로젝트 상세)

### 모달/팝오버 레이어 (Dialog Depth)

#### 메인 보드 (`/`)
- 레벨 1: 
  - `selectedEntry` → EntryDetailPopover (타임라인 항목 상세)
  - `addingEntry` → 타임라인 생성 폼 (fixed 포지션 tooltip)
  - `addingTodoDay` → TODO 생성 폼
  - `calPanelOpen` → Google Calendar 선택 패널
  - `highlightOpenDay` → 데일리 하이라이트 입력
  - `AIPanel` 활성화 → AI 분석 패널

- 레벨 2: EntryDetailPopover 내부 삭제 확인 다이얼로그 (mode: single/future/all)

#### 프로젝트 상세 (`/projects/[id]`)
- 레벨 1:
  - `addingFor !== CLOSED` → TODO 추가 폼 (inline or 모바일 바텀시트)
  - `addingSectionTitle` → 섹션 추가 입력
  - `confirmDelete` → 프로젝트 삭제 확인 다이얼로그
  - TodoItem/SectionItem `editing` → 인라인 편집

- 레벨 2: 삭제 확인 → 실제 삭제 API 호출

#### Sidebar
- `settingsOpen` → SettingsModal (모바일 bottom-sheet, 데스크탑 center)

#### Notes 페이지
- `selectedNoteId` → 에디터 활성화

#### Habits 페이지
- 습관 추가 폼
- 습관 편집 폼

---

## 뒤로가기 버튼 로직

### 우선순위 (높음 → 낮음)
1. **모달/팝오버 닫기**: 현재 열려있는 모달이 있으면 먼저 닫기
2. **경로 뒤로**: 모달이 없으면 라우터 뒤로가기
3. **앱 종료**: 경로가 홈이고 모달도 없으면 (네이티브 앱에서만) 앱 종료 또는 경고

### 각 페이지별 구현

#### 메인 보드 (`/`)
```
뒤로가기 시:
1. selectedEntry 열려있나? → onClose() / setSelectedEntry(null)
2. addingEntry 열려있나? → setAddingEntry(null)
3. addingTodoDay 열려있나? → setAddingTodoDay(null)
4. calPanelOpen? → setCalPanelOpen(false)
5. highlightOpenDay? → setHighlightOpenDay(null)
6. AIPanel 활성화? → AIPanel 닫기
7. 아무것도 없으면 → 앱 종료 또는 경고
```

#### 프로젝트 상세 (`/projects/[id]`)
```
뒤로가기 시:
1. confirmDelete? → setConfirmDelete(false)
2. addingFor !== CLOSED? → setAddingFor(CLOSED)
3. addingSectionTitle? → setAddingSectionTitle(false)
4. TodoItem/SectionItem editing? → 해당 item 수정 취소
5. 아무것도 없으면 → router.back() 또는 /projects로 이동
```

#### Sidebar
```
뒤로가기 시:
1. settingsOpen? → setSettingsOpen(false)
2. 아니면 무시 (메인 페이지는 뒤로가기 처리하므로)
```

---

## 구현 방식

### Option 1: 각 페이지에서 전역 키보드/백버튼 핸들링
```tsx
useEffect(() => {
  const handleBackButton = () => {
    // 모달 닫기 로직
    if (selectedEntry) {
      setSelectedEntry(null)
      return
    }
    // 다음 모달...
    // 마지막에 라우터.back()
  }
  // 하드웨어 백버튼, 브라우저 백버튼 등 처리
}, [...dependencies])
```

### Option 2: 커스텀 훅 + Context
```tsx
// useBackNavigation 훅
// 각 페이지/컴포넌트가 핸들러 등록
// 뒤로가기 이벤트 시 우선순위대로 실행
```

### Option 3: 라우터 인터셉션 (Next.js 15+)
```tsx
// interceptors를 통해 라우트 변경 전 모달 확인
// 모달 닫기 후 라우트 변경
```

---

## 뒤로가기 발생 지점

1. **하드웨어 백버튼** (모바일 앱, Android)
   - 네이티브 브릿지에서 감지
   - JavaScript로 이벤트 전달

2. **브라우저 백버튼** / 뒤로가기 제스처
   - `popstate` 이벤트
   - `useRouter().back()` 호출

3. **네비게이션 바 뒤로가기** (사용자 정의 UI)
   - 헤더의 뒤로가기 버튼 클릭

---

## 주의사항

- **모달 닫기와 경로 변경 혼동 방지**: 열린 모달이 있으면 경로 변경 금지
- **Sidebar 상태**: 사이드바는 글로벌이므로 각 페이지 모달과 무관하게 처리
- **모바일 vs 데스크탑**: 데스크탑에서는 일부 모달(like SettingsModal)이 다를 수 있음
- **상태 복원**: 모달을 닫을 때 입력 중인 데이터 처리 (저장/취소)
